from rest_framework import viewsets, mixins
from rest_framework.permissions import IsAuthenticated, AllowAny, SAFE_METHODS
from rest_framework.response import Response
from rest_framework import status
from rest_framework import generics
from django.utils import timezone
from poa_document.models import Persona, Direccion, DocumentoPOA, ObjetivoEspecifico, Actividad, DetallePresupuesto
from .serializers import (
    PersonaSerializer,
    DireccionSerializer,
    DocumentoPOASerializer,
    ObjetivoEspecificoSerializer,
    ActividadSerializer,
    DetallePresupuestoSerializer,
)
from catalogos.models import OperacionCatalogo
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404


class PersonaViewSet(viewsets.ModelViewSet):
    queryset = Persona.objects.all()
    serializer_class = PersonaSerializer
    permission_classes = [AllowAny]  # Changed to allow anonymous access

class DireccionViewSet(viewsets.ModelViewSet):
    queryset = Direccion.objects.all()
    serializer_class = DireccionSerializer
    permission_classes = [AllowAny]  # Changed to allow anonymous access



class DocumentoPOAViewSet(viewsets.ModelViewSet):
    """
    API CRUD para todos los documentos POA registrados.
    """
    queryset = DocumentoPOA.objects.all()
    serializer_class = DocumentoPOASerializer

    permission_classes = [AllowAny]

    @action(detail=True, methods=['get'])
    def tree(self, request, pk=None):
        """Devuelve el documento con su arbol: objetivos -> actividades -> detalles de presupuesto"""
        # Requerir que se pase la gestion para mantener consistencia con get_object()
        req_year = request.query_params.get('gestion') or request.query_params.get('year')
        if not req_year:
            return Response({'detail': "El parámetro de consulta 'gestion' es obligatorio para esta operación. Ejemplo: ?gestion=2025"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            year = int(req_year)
        except (ValueError, TypeError):
            return Response({'detail': "El parámetro 'gestion' debe ser un entero válido."}, status=status.HTTP_400_BAD_REQUEST)

        # Obtener documento con prefetch para evitar N+1
        documento = DocumentoPOA.objects.filter(pk=pk).prefetch_related(
            'objetivos__actividades__detalles_presupuesto',
        ).select_related('elaborado_por', 'jefe_unidad').first()
        if not documento:
            return Response({'detail': 'Documento no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        if documento.gestion != year:
            return Response({'detail': 'El documento no pertenece a la gestión solicitada'}, status=status.HTTP_404_NOT_FOUND)

        doc_data = DocumentoPOASerializer(documento, context={'request': request}).data
        objetivos = []
        for obj in documento.objetivos.all():
            obj_ser = ObjetivoEspecificoSerializer(obj).data
            actividades = []
            for act in obj.actividades.all():
                act_ser = ActividadSerializer(act).data
                detalles = DetallePresupuestoSerializer(list(act.detalles_presupuesto.all()), many=True).data
                act_ser['detalles_presupuesto'] = detalles
                actividades.append(act_ser)
            obj_ser['actividades'] = actividades
            objetivos.append(obj_ser)

        doc_data['objetivos'] = objetivos
        return Response(doc_data)

    def list(self, request, *args, **kwargs):
        """Requiere query param 'gestion' o 'year' para listar documentos. Evita listar documentos globalmente."""
        req_year = request.query_params.get('gestion') or request.query_params.get('year')
        if not req_year:
            return Response({'detail': "El parámetro de consulta 'gestion' es obligatorio para listar documentos. Use /documentos_poa_por_gestion/?gestion=2025"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            year = int(req_year)
        except (ValueError, TypeError):
            return Response({'detail': "El parámetro 'gestion' debe ser un entero válido."}, status=status.HTTP_400_BAD_REQUEST)

        queryset = DocumentoPOA.objects.filter(gestion=year)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def get_object(self):
        """Obtener objeto asegurando que pertenezca a la gestión solicitada.
        Se exige el query param 'gestion' o 'year' para las operaciones sobre detalle.
        """
        req_year = self.request.query_params.get('gestion') or self.request.query_params.get('year')
        if not req_year:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({
                'detail': "El parámetro de consulta 'gestion' es obligatorio para operar sobre documentos. Ejemplo: ?gestion=2025"
            })
        try:
            year = int(req_year)
        except (ValueError, TypeError):
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': "El parámetro 'gestion' debe ser un entero válido."})

        obj = super().get_object()
        if obj.gestion != year:
            from rest_framework.exceptions import NotFound
            raise NotFound(detail='El documento no pertenece a la gestión solicitada')
        return obj





# Objetivos y Actividades integrados en `poa_document`.
# No registrar viewsets duplicados aquí para evitar conflictos y duplicación.

class DocumentoPOAReadOnlyViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API de solo lectura para visualizar encabezados de documentos POA del año actual.
    """
    serializer_class = DocumentoPOASerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        """
        Permite filtrar por query param `gestion` o `year`:
        - /documentos_poa_encabezados/ -> devuelve documentos del año actual
        - /documentos_poa_encabezados/?gestion=2024 -> devuelve documentos de 2024
        Si `gestion` no es un entero válido, devuelve queryset vacío.
        """
        req_year = self.request.query_params.get('gestion') or self.request.query_params.get('year')
        if req_year:
            try:
                year = int(req_year)
            except (ValueError, TypeError):
                return DocumentoPOA.objects.none()
            return DocumentoPOA.objects.filter(gestion=year)

        current_year = timezone.now().year
        return DocumentoPOA.objects.filter(gestion=current_year)


# --- ViewSets para Objetivos y Actividades ---
class ObjetivoEspecificoViewSet(viewsets.ModelViewSet):
    serializer_class = ObjetivoEspecificoSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = ObjetivoEspecifico.objects.all()
        documento_id = self.request.query_params.get('documento_id')
        if documento_id:
            try:
                return qs.filter(documento_id=int(documento_id))
            except (ValueError, TypeError):
                return qs.none()
        return qs

    @action(detail=False, methods=['get'])
    def por_documento(self, request):
        documento_id = request.query_params.get('documento_id')
        if not documento_id:
            return Response({'error': 'Debe proporcionar documento_id'}, status=400)
        try:
            objs = self.get_queryset().filter(documento_id=int(documento_id))
        except (ValueError, TypeError):
            return Response({'error': 'documento_id inválido'}, status=400)
        serializer = self.get_serializer(objs, many=True)
        return Response(serializer.data)

    def list(self, request, *args, **kwargs):
        """Lista objetivos sólo si se pasa ?documento_id=. Evita listado global."""
        documento_id = request.query_params.get('documento_id')
        if not documento_id:
            return Response({'detail': "El parámetro 'documento_id' es obligatorio para listar objetivos."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            doc_id = int(documento_id)
        except (ValueError, TypeError):
            return Response({'detail': "El parámetro 'documento_id' debe ser un entero válido."}, status=status.HTTP_400_BAD_REQUEST)

        qs = self.get_queryset().filter(documento_id=doc_id)
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        # Exigir documento_id en el payload para crear un objetivo
        if 'documento_id' not in request.data:
            return Response({'detail': "El campo 'documento_id' es obligatorio para crear un objetivo."}, status=status.HTTP_400_BAD_REQUEST)
        return super().create(request, *args, **kwargs)


class ActividadViewSet(viewsets.ModelViewSet):
    serializer_class = ActividadSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        # indicador_descripcion ahora es texto; no es posible hacer select_related sobre él
        qs = Actividad.objects.select_related('objetivo__documento').all()
        objetivo_id = self.request.query_params.get('objetivo_id')
        if objetivo_id:
            try:
                return qs.filter(objetivo_id=int(objetivo_id))
            except (ValueError, TypeError):
                return qs.none()
        return qs

    @action(detail=True, methods=['patch'])
    def asignar_catalogo(self, request, pk=None):
        actividad = self.get_object()
        # Aceptamos texto directo (catalogo_descripcion) o, como fallback, catalogo_id
        catalogo_text = request.data.get('catalogo_descripcion') or request.data.get('catalogo_text')
        catalogo_id = request.data.get('catalogo_id')
        if not catalogo_text and not catalogo_id:
            return Response({'error': 'Debe proporcionar catalogo_descripcion (texto) o catalogo_id'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            if catalogo_text:
                actividad.indicador_descripcion = catalogo_text
            else:
                catalogo = get_object_or_404(OperacionCatalogo, id=catalogo_id)
                # Si se provee ID, guardamos la descripción del catálogo (campo 'indicador')
                actividad.indicador_descripcion = catalogo.indicador
            actividad.save()
            serializer = self.get_serializer(actividad)
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': f'Error al asignar el catálogo: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def por_objetivo(self, request):
        objetivo_id = request.query_params.get('objetivo_id')
        if not objetivo_id:
            return Response({'error': 'Debe proporcionar el ID del objetivo'}, status=status.HTTP_400_BAD_REQUEST)
        actividades = self.get_queryset().filter(objetivo_id=objetivo_id)
        serializer = self.get_serializer(actividades, many=True)
        return Response(serializer.data)

    def list(self, request, *args, **kwargs):
        """Lista actividades sólo si se pasa ?objetivo_id=. Evita listado global."""
        objetivo_id = request.query_params.get('objetivo_id')
        if not objetivo_id:
            return Response({'detail': "El parámetro 'objetivo_id' es obligatorio para listar actividades."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            obj_id = int(objetivo_id)
        except (ValueError, TypeError):
            return Response({'detail': "El parámetro 'objetivo_id' debe ser un entero válido."}, status=status.HTTP_400_BAD_REQUEST)

        # Si se pasa documento_id, validar que el objetivo pertenece a ese documento
        documento_id = request.query_params.get('documento_id')
        if documento_id:
            try:
                doc_id = int(documento_id)
            except (ValueError, TypeError):
                return Response({'detail': "El parámetro 'documento_id' debe ser un entero válido."}, status=status.HTTP_400_BAD_REQUEST)
            objetivo = None
            try:
                objetivo = ObjetivoEspecifico.objects.select_related('documento').get(pk=obj_id)
            except ObjetivoEspecifico.DoesNotExist:
                return Response({'detail': 'Objetivo no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
            if objetivo.documento_id != doc_id:
                return Response({'detail': 'El objetivo no pertenece al documento solicitado.'}, status=status.HTTP_400_BAD_REQUEST)

        qs = self.get_queryset().filter(objetivo_id=obj_id)
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        # Exigir objetivo_id en el payload para crear una actividad
        if 'objetivo_id' not in request.data:
            return Response({'detail': "El campo 'objetivo_id' es obligatorio para crear una actividad."}, status=status.HTTP_400_BAD_REQUEST)
        # Validar que, si el cliente indica ?documento_id=, el objetivo pertenece a ese documento
        objetivo_id = request.data.get('objetivo_id')
        try:
            objetivo_pk = int(objetivo_id)
        except (ValueError, TypeError):
            return Response({'detail': "El campo 'objetivo_id' debe ser un entero válido."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            objetivo = ObjetivoEspecifico.objects.select_related('documento').get(pk=objetivo_pk)
        except ObjetivoEspecifico.DoesNotExist:
            return Response({'detail': 'Objetivo no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        documento_param = request.query_params.get('documento_id')
        if documento_param:
            try:
                doc_param = int(documento_param)
            except (ValueError, TypeError):
                return Response({'detail': "El parámetro 'documento_id' debe ser un entero válido."}, status=status.HTTP_400_BAD_REQUEST)
            if objetivo.documento_id != doc_param:
                return Response({'detail': 'El objetivo no pertenece al documento solicitado.'}, status=status.HTTP_400_BAD_REQUEST)

        return super().create(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    def indicadores_por_direccion(self, request):
        direccion_id = request.query_params.get('direccion_id')
        if not direccion_id:
            return Response({'error': 'Debe proporcionar el ID de la dirección'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            indicadores = OperacionCatalogo.objects.filter(direccion_id=direccion_id).select_related('direccion')
            from catalogos.api.serializers import OperacionCatalogoSerializer
            serializer = OperacionCatalogoSerializer(indicadores, many=True)
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': f'Error al obtener indicadores: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['patch'])
    def asignar_indicador(self, request, pk=None):
        actividad = self.get_object()
        # Aceptamos indicador_descripcion (texto) o indicador_id como fallback
        indicador_text = request.data.get('indicador_descripcion') or request.data.get('indicador_text')
        indicador_id = request.data.get('indicador_id')
        if not indicador_text and not indicador_id:
            return Response({'error': 'Debe proporcionar indicador_descripcion (texto) o indicador_id'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            if indicador_text:
                actividad.indicador_descripcion = indicador_text
            else:
                indicador = get_object_or_404(OperacionCatalogo, id=indicador_id)
                # como compatibilidad, guardamos la descripción del indicador
                # Ya no validamos dirección porque unidad_solicitante es texto libre
                actividad.indicador_descripcion = indicador.indicador
            actividad.save()
            serializer = self.get_serializer(actividad)
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': f'Error al asignar el indicador: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)


# --- ViewSet estándar para DetallePresupuesto ---
class DetallePresupuestoViewSet(viewsets.ModelViewSet):
    serializer_class = DetallePresupuestoSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        # 'partida' e 'item' ya no son ForeignKey, son CharField.
        # Mantener select_related sólo para relaciones reales (actividad).
        qs = DetallePresupuesto.objects.select_related('actividad').all()
        actividad_id = self.request.query_params.get('actividad_id')
        if actividad_id:
            try:
                return qs.filter(actividad_id=int(actividad_id))
            except (ValueError, TypeError):
                return qs.none()
        return qs

    def list(self, request, *args, **kwargs):
        # Forzar filtro por actividad para evitar listados globales
        actividad_id = request.query_params.get('actividad_id')
        if not actividad_id:
            return Response({'detail': "El parámetro 'actividad_id' es obligatorio para listar detalle de presupuesto."}, status=status.HTTP_400_BAD_REQUEST)
        # Si se pasa documento_id, validar que la actividad pertenece a un objetivo del documento
        documento_id = request.query_params.get('documento_id')
        if documento_id:
            try:
                doc_id = int(documento_id)
            except (ValueError, TypeError):
                return Response({'detail': "El parámetro 'documento_id' debe ser un entero válido."}, status=status.HTTP_400_BAD_REQUEST)
            try:
                actividad_pk = int(actividad_id)
            except (ValueError, TypeError):
                return Response({'detail': "El parámetro 'actividad_id' debe ser un entero válido."}, status=status.HTTP_400_BAD_REQUEST)
            try:
                actividad = Actividad.objects.select_related('objetivo__documento').get(pk=actividad_pk)
            except Actividad.DoesNotExist:
                return Response({'detail': 'Actividad no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
            if actividad.objetivo.documento_id != doc_id:
                return Response({'detail': 'La actividad no pertenece al documento solicitado.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        # Exigir actividad_id en payload para crear detalle
        if 'actividad_id' not in request.data:
            return Response({'detail': "El campo 'actividad_id' es obligatorio para crear un detalle de presupuesto."}, status=status.HTTP_400_BAD_REQUEST)
        # Validar que, si el cliente indica ?documento_id=, la actividad pertenece al documento
        actividad_id = request.data.get('actividad_id')
        try:
            actividad_pk = int(actividad_id)
        except (ValueError, TypeError):
            return Response({'detail': "El campo 'actividad_id' debe ser un entero válido."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            actividad = Actividad.objects.select_related('objetivo__documento').get(pk=actividad_pk)
        except Actividad.DoesNotExist:
            return Response({'detail': 'Actividad no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        documento_param = request.query_params.get('documento_id')
        if documento_param:
            try:
                doc_param = int(documento_param)
            except (ValueError, TypeError):
                return Response({'detail': "El parámetro 'documento_id' debe ser un entero válido."}, status=status.HTTP_400_BAD_REQUEST)
            if actividad.objetivo.documento_id != doc_param:
                return Response({'detail': 'La actividad no pertenece al documento solicitado.'}, status=status.HTTP_400_BAD_REQUEST)

        return super().create(request, *args, **kwargs)



