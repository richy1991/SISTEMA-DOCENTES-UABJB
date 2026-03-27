import unicodedata

from openpyxl import load_workbook
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny, BasePermission, SAFE_METHODS, IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse

from catalogos.models import ItemCatalogo, OperacionCatalogo, Direccion
from poa_document.models import UsuarioPOA
from catalogos.api.serializers import (
    ItemCatalogoSerializer,
    OperacionCatalogoSerializer,
    DireccionSerializer,
    PartidaCatalogoSerializer,
)


class IsElaboradorOrReadOnly(BasePermission):
    """Permite lectura a usuarios autenticados y escritura solo a rol elaborador."""

    message = 'Solo usuarios con rol elaborador pueden modificar el catálogo de items.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if request.method in SAFE_METHODS:
            return True

        return UsuarioPOA.objects.filter(
            user=user,
            activo=True,
            rol='elaborador',
        ).exists()


class ItemCatalogoViewSet(viewsets.ModelViewSet):
    serializer_class = ItemCatalogoSerializer
    permission_classes = [IsElaboradorOrReadOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @staticmethod
    def _normalize_header(value):
        if value is None:
            return ''
        text = str(value).strip().lower()
        text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')
        return text.replace(' ', '_')

    @staticmethod
    def _normalize_code(value):
        if value is None:
            return ''
        if isinstance(value, float) and value.is_integer():
            value = int(value)
        return str(value).strip()

    @action(detail=False, methods=['get', 'post'], url_path='importar-excel')
    def importar_excel(self, request, *args, **kwargs):
        if request.method == 'GET':
            return Response(
                {
                    'detail': 'Endpoint de importación de catálogo.',
                    'uso': 'Envíe POST multipart/form-data con el archivo en el campo "archivo".',
                },
                status=200,
            )

        archivo = request.FILES.get('archivo')
        if not archivo:
            return Response({'detail': 'Debe adjuntar un archivo Excel en el campo "archivo".'}, status=400)

        dry_run = str(request.data.get('dry_run', 'false')).strip().lower() in {'1', 'true', 'si', 'yes'}
        replace_duplicates = str(request.data.get('replace_duplicates', 'false')).strip().lower() in {'1', 'true', 'si', 'yes'}

        try:
            workbook = load_workbook(filename=archivo, data_only=True, read_only=True)
            sheet = workbook[workbook.sheetnames[0]]
        except Exception as exc:
            return Response({'detail': f'No se pudo leer el archivo: {exc}'}, status=400)

        iterator = sheet.iter_rows(values_only=True)
        header_row = next(iterator, None)
        if not header_row:
            return Response({'detail': 'El archivo no contiene encabezados.'}, status=400)

        header_map = {self._normalize_header(value): idx for idx, value in enumerate(header_row) if value is not None}

        def col_idx(candidates):
            for candidate in candidates:
                idx = header_map.get(candidate)
                if idx is not None:
                    return idx
            return None

        col_detalle = col_idx(['detalle', 'descripcion'])
        col_partida = col_idx(['partida', 'partida_codigo', 'codigo_partida'])
        col_unidad = col_idx(['unidad', 'unidad_medida', 'uom'])

        missing = []
        if col_detalle is None:
            missing.append('DETALLE/descripcion')
        if col_partida is None:
            missing.append('partida/partida_codigo')
        if missing:
            return Response(
                {
                    'detail': 'Faltan columnas requeridas en el Excel.',
                    'faltantes': missing,
                    'encabezados_detectados': list(header_map.keys()),
                },
                status=400,
            )

        stats = {
            'filas_procesadas': 0,
            'filas_vacias': 0,
            'items_creados': 0,
            'items_actualizados': 0,
            'duplicados_detectados': 0,
            'errores': 0,
            'detalle_truncado': 0,
            'dry_run': dry_run,
            'replace_duplicates': replace_duplicates,
            'partidas_unicas_detectadas': 0,
        }
        errores = []

        partidas_detectadas = set()
        to_create = []
        to_update = {}
        duplicados_conflicto = []
        existing_by_detalle = {}

        if not dry_run:
            for item in ItemCatalogo.objects.all().only('id', 'detalle', 'partida', 'unidad_medida'):
                key = str(item.detalle or '').strip().lower()
                if key:
                    existing_by_detalle[key] = item

        def get_cell(row, idx):
            if idx is None or idx >= len(row):
                return None
            return row[idx]

        for excel_row_num, row in enumerate(iterator, start=2):
            detalle = str(get_cell(row, col_detalle) or '').strip()
            partida_codigo = self._normalize_code(get_cell(row, col_partida))
            unidad_medida = str(get_cell(row, col_unidad) or 'Sin unidad').strip() if col_unidad is not None else 'Sin unidad'

            if not detalle and not partida_codigo:
                stats['filas_vacias'] += 1
                continue

            stats['filas_procesadas'] += 1
            if not detalle or not partida_codigo:
                stats['errores'] += 1
                if len(errores) < 200:
                    errores.append({'fila': excel_row_num, 'error': 'DETALLE y partida son obligatorios.'})
                continue

            if len(detalle) > 255:
                detalle = detalle[:255]
                stats['detalle_truncado'] += 1

            partidas_detectadas.add(partida_codigo)

            if dry_run:
                stats['items_creados'] += 1
                continue

            detail_key = detalle.lower()
            existing = existing_by_detalle.get(detail_key)
            if existing is not None:
                stats['duplicados_detectados'] += 1
                if not replace_duplicates:
                    if len(duplicados_conflicto) < 200:
                        duplicados_conflicto.append(
                            {
                                'fila': excel_row_num,
                                'detalle': detalle,
                                'item_existente_id': existing.id,
                                'error': 'Detalle duplicado en catálogo existente.',
                            }
                        )
                    continue

                existing.partida = partida_codigo
                existing.unidad_medida = unidad_medida or 'Sin unidad'
                to_update[existing.id] = existing
                stats['items_actualizados'] += 1
                continue

            to_create.append(
                ItemCatalogo(
                    partida=partida_codigo,
                    detalle=detalle,
                    unidad_medida=unidad_medida or 'Sin unidad',
                )
            )
            existing_by_detalle[detail_key] = to_create[-1]

        if not dry_run and duplicados_conflicto and not replace_duplicates:
            return Response(
                {
                    'detail': 'Se detectaron DETALLE duplicados en el catálogo existente.',
                    'requires_confirmation': True,
                    'accion_recomendada': 'replace_duplicates=true para reemplazar registros existentes',
                    'resumen': stats,
                    'duplicados': duplicados_conflicto,
                },
                status=409,
            )

        if not dry_run:
            with transaction.atomic():
                if to_update:
                    ItemCatalogo.objects.bulk_update(
                        list(to_update.values()),
                        fields=['partida', 'unidad_medida'],
                        batch_size=1000,
                    )
                if to_create:
                    ItemCatalogo.objects.bulk_create(to_create, batch_size=1000)
                    stats['items_creados'] = len(to_create)
        stats['partidas_unicas_detectadas'] = len(partidas_detectadas)

        return Response({'resumen': stats, 'errores': errores}, status=200)

    def get_queryset(self):
        qs = ItemCatalogo.objects.all()
        partida_codigo = (
            self.request.query_params.get('partida')
            or self.request.query_params.get('partida_codigo')
            or self.request.query_params.get('partida_id')
        )
        if partida_codigo:
            return qs.filter(partida=str(partida_codigo).strip())
        # No devolver listado global; exigir filtro por partida
        return qs

    def list(self, request, *args, **kwargs):
        partida_codigo = request.query_params.get('partida') or request.query_params.get('partida_codigo') or request.query_params.get('partida_id')
        if not partida_codigo:
            return Response({'detail': "El parámetro 'partida' es obligatorio para listar items."}, status=400)
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        # Mantener compatibilidad: si llega partida_id usarlo como codigo de partida
        if 'partida' not in data and 'partida_id' in data:
            data['partida'] = str(data.get('partida_id')).strip()
        if 'partida' not in data:
            return Response({'detail': "El campo 'partida' es obligatorio para crear un item."}, status=400)

        detalle = str(data.get('detalle') or '').strip()
        replace_existing = str(data.get('replace_existing', 'false')).strip().lower() in {'1', 'true', 'si', 'yes'}
        if detalle:
            existente = ItemCatalogo.objects.filter(detalle__iexact=detalle).first()
            if existente and not replace_existing:
                return Response(
                    {
                        'detail': 'Ya existe un item con el mismo DETALLE.',
                        'requires_confirmation': True,
                        'duplicate_item_id': existente.id,
                        'duplicate_detalle': existente.detalle,
                    },
                    status=409,
                )
            if existente and replace_existing:
                serializer = self.get_serializer(existente, data=data, partial=True)
                serializer.is_valid(raise_exception=True)
                serializer.save()
                return Response(serializer.data, status=status.HTTP_200_OK)

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)



class OperacionCatalogoViewSet(viewsets.ModelViewSet):
    serializer_class = OperacionCatalogoSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = OperacionCatalogo.objects.select_related('direccion').all()
        direccion_id = self.request.query_params.get('direccion_id')
        if direccion_id:
            try:
                return qs.filter(direccion_id=int(direccion_id))
            except (ValueError, TypeError):
                return qs.none()
        # devolver conjunto completo por seguridad, pero list() exigirá filtro
        return qs

    def list(self, request, *args, **kwargs):
        direccion_id = request.query_params.get('direccion_id')
        if not direccion_id:
            return Response({'detail': "El parámetro 'direccion_id' es obligatorio para listar operaciones."}, status=400)
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        if 'direccion_id' not in request.data and 'direccion' not in request.data:
            return Response({'detail': "El campo 'direccion_id' es obligatorio para crear una operación."}, status=400)
        return super().create(request, *args, **kwargs)


class DireccionViewSet(viewsets.ModelViewSet):
    queryset = Direccion.objects.all()
    serializer_class = DireccionSerializer
    permission_classes = [AllowAny]


class PartidaPresupuestariaViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PartidaCatalogoSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        partidas = (
            ItemCatalogo.objects
            .exclude(partida='')
            .values_list('partida', flat=True)
            .distinct()
            .order_by('partida')
        )
        return [{'id': p, 'codigo': p, 'nombre': p} for p in partidas]


class ItemCatalogoReadOnlyViewSet(viewsets.ReadOnlyModelViewSet):
    """Endpoint solo-lectura para listar/ver detalles de items junto con su partida.

    Este viewset expone GET / y GET /<id>/ sin exigir el filtro por partida_id.
    """
    queryset = ItemCatalogo.objects.all()
    serializer_class = ItemCatalogoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        partida_codigo = (
            self.request.query_params.get('partida')
            or self.request.query_params.get('partida_codigo')
            or self.request.query_params.get('partida_id')
        )
        if partida_codigo:
            qs = qs.filter(partida=str(partida_codigo).strip())

        search = (self.request.query_params.get('q') or self.request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(
                Q(detalle__icontains=search)
                | Q(unidad_medida__icontains=search)
                | Q(partida__icontains=search)
            )

        return qs.order_by('id')

    def list(self, request, *args, **kwargs):
        search = (request.query_params.get('q') or request.query_params.get('search') or '').strip()
        queryset = self.filter_queryset(self.get_queryset())

        # En búsquedas devolver una muestra mayor sin paginación para UX más fluida.
        if search:
            serializer = self.get_serializer(queryset[:200], many=True)
            return Response(serializer.data)

        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=['get'], url_path='exportar-excel')
    def exportar_excel(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset()).order_by('id')
        wb = Workbook()
        ws = wb.active
        ws.title = 'CatalogoItems'

        headers = ['DETALLE', 'partida', 'UNIDAD_MEDIDA']
        ws.append(headers)

        header_fill = PatternFill(fill_type='solid', fgColor='1F4E78')
        header_font = Font(color='FFFFFF', bold=True)
        header_alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        thin_side = Side(style='thin', color='D9D9D9')
        border = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)

        for col_idx, _ in enumerate(headers, start=1):
            cell = ws.cell(row=1, column=col_idx)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = header_alignment
            cell.border = border

        for it in queryset.iterator():
            ws.append([
                str(it.detalle or ''),
                str(it.partida or ''),
                str(it.unidad_medida or ''),
            ])

        # Estilo del cuerpo y mejor legibilidad
        body_alignment = Alignment(horizontal='left', vertical='top', wrap_text=True)
        for row in ws.iter_rows(min_row=2, max_row=ws.max_row, min_col=1, max_col=3):
            for cell in row:
                cell.alignment = body_alignment
                cell.border = border

        # Congelar encabezado y habilitar autofiltro
        ws.freeze_panes = 'A2'
        ws.auto_filter.ref = f"A1:{get_column_letter(ws.max_column)}{ws.max_row}"

        # Autoajustar ancho de columnas según contenido
        for col_idx in range(1, ws.max_column + 1):
            col_letter = get_column_letter(col_idx)
            max_length = 0
            for row_idx in range(1, ws.max_row + 1):
                value = ws.cell(row=row_idx, column=col_idx).value
                if value is None:
                    continue
                text = str(value)
                if len(text) > max_length:
                    max_length = len(text)
            ws.column_dimensions[col_letter].width = min(max(max_length + 2, 14), 90)

        ws.row_dimensions[1].height = 24

        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="catalogo_items.xlsx"'
        wb.save(response)
        return response


class OperacionCatalogoReadOnlyViewSet(viewsets.ReadOnlyModelViewSet):
    """Exponer todas las operaciones sin requerir filtro por dirección."""
    queryset = OperacionCatalogo.objects.select_related('direccion').all()
    serializer_class = OperacionCatalogoSerializer
    permission_classes = [AllowAny]


