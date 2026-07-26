from datetime import date
from decimal import Decimal
from io import BytesIO

from rest_framework import viewsets, mixins
from rest_framework.permissions import IsAuthenticated, AllowAny, SAFE_METHODS
from rest_framework.response import Response
from rest_framework import status
from rest_framework import generics
from rest_framework.views import APIView
from django.http import FileResponse, HttpResponse
from django.utils import timezone
from django.db import transaction
from django.db.models import Count, DecimalField, Prefetch, Q, Sum
from django.db.models.functions import Coalesce
from django.core.exceptions import ObjectDoesNotExist
from rest_framework.exceptions import PermissionDenied
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Spacer, Table, TableStyle, Paragraph
from poa_document.models import (
    Direccion,
    DocumentoPOA,
    ObjetivoEspecifico,
    Actividad,
    DetallePresupuesto,
    UsuarioPOA,
    HistorialDocumentoPOA,
    ObservacionDocumentoPOA,
    SolicitudCambioPOA,
    MensajeChat,
    BloqueoChat,
    Evidencia,
    EvidenciaArchivo,
)
from fondos.models import Docente
from django.contrib.auth.models import User
from .serializers import (
    DireccionSerializer,
    DocumentoPOASerializer,
    ObjetivoEspecificoSerializer,
    ActividadSerializer,
    DetallePresupuestoSerializer,
    UsuarioPOASerializer,
    ObservacionDocumentoPOASerializer,
    SolicitudCambioPOASerializer,
    DocenteSimpleSerializer,
    MensajeChatSerializer,
    EvidenciaSerializer,
    EvidenciaArchivoSerializer,
)
from catalogos.models import IndicadorCatalogo
from rest_framework.decorators import action
from rest_framework.response import Response
from django.conf import settings
from django.shortcuts import get_object_or_404
from poa_document.utils.pdf_generator import DocumentoPOAPDFGenerator


def _get_user_profile(user):
    """Obtiene perfil de usuario de forma segura (incluye casos sin perfil en superuser)."""
    if not user or not getattr(user, 'is_authenticated', False):
        return None
    try:
        return user.perfil
    except ObjectDoesNotExist:
        return None


def _carrera_usuario_poa(user):
    if not user or not user.is_authenticated or user.is_superuser:
        return None
    perfil = _get_user_profile(user)
    if not perfil:
        return None
    if perfil.carrera_id:
        return perfil.carrera
    carreras = perfil.get_carreras_activas() if hasattr(perfil, 'get_carreras_activas') else None
    if carreras and carreras.exists():
        return carreras.first()
    return None


def _filtrar_documentos_por_usuario(qs, user):
    if not user or not user.is_authenticated:
        return qs.none()
    if user.is_superuser:
        return qs
    carrera = _carrera_usuario_poa(user)
    if not carrera:
        return qs.none()
    return qs.filter(unidad_solicitante_id=carrera.id)


def _usuario_pertenece_a_carrera(user_obj, carrera):
    if not user_obj or not carrera:
        return False
    perfil = _get_user_profile(user_obj)
    if getattr(perfil, 'carrera_id', None) == carrera.id:
        return True
    if getattr(perfil, 'docente_id', None):
        if Docente.objects.filter(
            pk=perfil.docente_id,
            asignaciones_carrera__carrera_id=carrera.id,
            asignaciones_carrera__activo=True,
        ).exists():
            return True
    return user_obj.asignaciones_carrera.filter(carrera_id=carrera.id, activo=True).exists()


def _documento_accesible_para_usuario(user, documento):
    if not documento:
        return False
    if user and user.is_superuser:
        return True
    carrera = _carrera_usuario_poa(user)
    if not carrera:
        return False
    return documento.unidad_solicitante_id == carrera.id


def _obtener_documento_accesible(user, documento_id):
    if documento_id in [None, '']:
        return None
    try:
        documento_id = int(documento_id)
    except (TypeError, ValueError):
        return None
    qs = _filtrar_documentos_por_usuario(_documentos_queryset().filter(pk=documento_id), user)
    return qs.first()


def _poa_roles_activos(user):
    if not user or not user.is_authenticated:
        return set()
    filtros = Q(user=user)
    perfil = _get_user_profile(user)
    docente_id = getattr(perfil, 'docente_id', None)
    if docente_id:
        filtros |= Q(docente_id=docente_id)
    qs = UsuarioPOA.objects.filter(filtros, activo=True)
    if not user.is_superuser:
        carrera = _carrera_usuario_poa(user)
        if not carrera:
            return set()
        qs = qs.filter(carrera_id=carrera.id)
    return set(qs.values_list('rol', flat=True))


def _es_elaborador(user):
    if not user or not user.is_authenticated:
        return False
    roles = _poa_roles_activos(user)
    if 'elaborador' in roles:
        return True
    return False


def _es_revisor(user):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    perfil = _get_user_profile(user)
    return getattr(perfil, 'rol', None) == 'director'


def _requerir_elaborador(request):
    if not _es_elaborador(request.user):
        roles = sorted(_poa_roles_activos(request.user))
        raise PermissionDenied(
            f"Solo el rol Elaborador del POA puede realizar esta acción. "
            f"Usuario autenticado: {request.user.username}. Roles POA detectados: {roles or ['ninguno']}."
        )


def _es_admin_principal(user):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    perfil = _get_user_profile(user)
    return getattr(perfil, 'rol', None) == 'iiisyp'


def _requerir_gestor_o_director(request):
    if not (_es_admin_principal(request.user) or _es_revisor(request.user)):
        raise PermissionDenied('Solo Director de Carrera o el superusuario puede gestionar accesos POA.')


def _requerir_revisor(request):
    if not _es_revisor(request.user):
        raise PermissionDenied('Solo el Director del sistema principal puede realizar esta acción.')


def _crear_historial_documento(documento, usuario, tipo_evento, descripcion, estado_anterior='', estado_nuevo='', datos_evento=None):
    if not usuario or not getattr(usuario, 'is_authenticated', False):
        return None
    return HistorialDocumentoPOA.objects.create(
        documento=documento,
        usuario=usuario,
        tipo_evento=tipo_evento,
        descripcion=descripcion,
        estado_anterior=estado_anterior or '',
        estado_nuevo=estado_nuevo or '',
        datos_evento=datos_evento or {},
    )


ESTADOS_PLANIFICACION_EDITABLE = ('elaboracion', 'observado')
ESTADOS_PLANIFICACION_CON_SOLICITUD = ('aprobado', 'ejecucion')


def _requerir_documento_editable_directo(request, documento):
    _requerir_elaborador(request)
    if documento.estado not in ESTADOS_PLANIFICACION_EDITABLE:
        raise PermissionDenied(
            'Este documento esta bloqueado para edicion directa. '
            'Debe enviar una solicitud de cambios al Director de Carrera.'
        )


def _requerir_evidencia_editable(request, actividad):
    _requerir_elaborador(request)
    documento = actividad.objetivo.documento
    if documento.estado != 'ejecucion':
        raise PermissionDenied('Las evidencias solo pueden cargarse cuando el documento esta en ejecucion.')


def _parse_observaciones_items(value):
    if isinstance(value, list):
        raw_items = value
    else:
        raw_items = str(value or '').replace('\r', '\n').split('\n')
    items = []
    for item in raw_items:
        text = str(item or '').strip()
        text = text.lstrip('-*• ').strip()
        while text and text[0].isdigit():
            text = text[1:].strip()
            if text.startswith(('.', ')', '-')):
                text = text[1:].strip()
            else:
                break
        if text:
            items.append(text)
    return items


def _recalcular_montos_actividad(actividad):
    if not actividad:
        return
    detalles = actividad.detalles_presupuesto.all()
    monto_funcion = Decimal('0')
    monto_inversion = Decimal('0')
    for detalle in detalles:
        monto = Decimal(detalle.costo_total or 0)
        tipo = str(detalle.tipo or '').lower()
        if tipo == 'inversion':
            monto_inversion += monto
        else:
            monto_funcion += monto
    Actividad.objects.filter(pk=actividad.pk).update(
        monto_funcion=monto_funcion,
        monto_inversion=monto_inversion,
    )


def _aplicar_solicitud_cambio(solicitud):
    documento = solicitud.documento
    payload = solicitud.payload or {}
    tipo = solicitud.tipo_objeto
    accion = solicitud.accion

    if documento.estado not in ESTADOS_PLANIFICACION_CON_SOLICITUD:
        raise PermissionDenied('Solo se pueden aprobar solicitudes de documentos aprobados o en ejecucion.')

    if tipo == 'documento':
        if accion != 'editar':
            raise PermissionDenied('La solicitud de documento solo permite edicion.')
        allowed = {
            'programa',
            'objetivo_gestion_institucional',
            'elaborado_por',
            'jefe_unidad',
            'fecha_elaboracion',
            'observaciones',
        }
        cambios = []
        for field in allowed:
            if field not in payload:
                continue
            anterior = getattr(documento, field)
            nuevo = payload.get(field)
            if str(anterior or '') == str(nuevo or ''):
                continue
            setattr(documento, field, nuevo)
            cambios.append({'campo': field, 'antes': str(anterior or ''), 'despues': str(nuevo or '')})
        if cambios:
            documento.save(update_fields=[c['campo'] for c in cambios] + ['actualizado_en'])
        return {'cambios': cambios}

    if tipo == 'objetivo':
        if accion == 'crear':
            obj = ObjetivoEspecifico.objects.create(
                documento=documento,
                codigo=payload.get('codigo') or '',
                descripcion=payload.get('descripcion') or '',
            )
            return {'objetivo_id': obj.id}
        obj = ObjetivoEspecifico.objects.filter(pk=solicitud.objeto_id, documento=documento).first()
        if not obj:
            raise PermissionDenied('El objetivo solicitado no pertenece al documento.')
        if accion == 'editar':
            obj.codigo = payload.get('codigo', obj.codigo) or ''
            obj.descripcion = payload.get('descripcion', obj.descripcion) or ''
            obj.save(update_fields=['codigo', 'descripcion'])
            return {'objetivo_id': obj.id}
        if accion == 'eliminar':
            obj.delete()
            return {'objetivo_id': solicitud.objeto_id}

    if tipo == 'actividad':
        if accion == 'crear':
            objetivo_id = payload.get('objetivo_id') or payload.get('objetivo')
            objetivo = ObjetivoEspecifico.objects.filter(pk=objetivo_id, documento=documento).first()
            if not objetivo:
                raise PermissionDenied('El objetivo de la actividad no pertenece al documento.')
            actividad = Actividad.objects.create(
                objetivo=objetivo,
                codigo=payload.get('codigo') or '',
                nombre=payload.get('nombre') or '',
                responsable=payload.get('responsable') or '',
                productos_esperados=payload.get('productos_esperados') or '',
                mes_inicio=payload.get('mes_inicio') or '',
                mes_fin=payload.get('mes_fin') or '',
                indicador_descripcion=payload.get('indicador_descripcion') or '',
                indicador_unidad=payload.get('indicador_unidad') or 'numero',
                indicador_linea_base=payload.get('indicador_linea_base') or 0,
                indicador_meta=payload.get('indicador_meta') or 0,
                estado=payload.get('estado') or 'programado',
            )
            return {'actividad_id': actividad.id}
        actividad = Actividad.objects.select_related('objetivo__documento').filter(
            pk=solicitud.objeto_id,
            objetivo__documento=documento,
        ).first()
        if not actividad:
            raise PermissionDenied('La actividad solicitada no pertenece al documento.')
        if accion == 'editar':
            editable = [
                'codigo', 'nombre', 'responsable', 'productos_esperados',
                'mes_inicio', 'mes_fin', 'indicador_descripcion',
                'indicador_unidad', 'indicador_linea_base', 'indicador_meta',
                'estado',
            ]
            for field in editable:
                if field in payload:
                    setattr(actividad, field, payload.get(field))
            actividad.save(update_fields=editable)
            return {'actividad_id': actividad.id}
        if accion == 'eliminar':
            actividad.delete()
            return {'actividad_id': solicitud.objeto_id}

    if tipo == 'presupuesto':
        actividad = None
        if accion == 'crear':
            actividad_id = payload.get('actividad_id') or payload.get('actividad')
            actividad = Actividad.objects.select_related('objetivo__documento').filter(
                pk=actividad_id,
                objetivo__documento=documento,
            ).first()
            if not actividad:
                raise PermissionDenied('La actividad del presupuesto no pertenece al documento.')
            detalle = DetallePresupuesto.objects.create(
                actividad=actividad,
                tipo=payload.get('tipo') or 'funcionamiento',
                partida=payload.get('partida') or '',
                item=payload.get('item') or '',
                unidad_medida=payload.get('unidad_medida') or '',
                caracteristicas=payload.get('caracteristicas') or '',
                cantidad=payload.get('cantidad') or 0,
                costo_unitario=payload.get('costo_unitario') or 0,
                costo_total=0,
                mes_requerimiento=payload.get('mes_requerimiento') or '',
            )
            _recalcular_montos_actividad(actividad)
            return {'detalle_id': detalle.id}
        detalle = DetallePresupuesto.objects.select_related('actividad__objetivo__documento').filter(
            pk=solicitud.objeto_id,
            actividad__objetivo__documento=documento,
        ).first()
        if not detalle:
            raise PermissionDenied('El presupuesto solicitado no pertenece al documento.')
        actividad = detalle.actividad
        if accion == 'editar':
            editable = [
                'tipo', 'partida', 'item', 'unidad_medida',
                'caracteristicas', 'cantidad', 'costo_unitario',
                'mes_requerimiento',
            ]
            for field in editable:
                if field in payload:
                    setattr(detalle, field, payload.get(field))
            detalle.save()
            _recalcular_montos_actividad(actividad)
            return {'detalle_id': detalle.id}
        if accion == 'eliminar':
            detalle_id = detalle.id
            detalle.delete()
            _recalcular_montos_actividad(actividad)
            return {'detalle_id': detalle_id}

    raise PermissionDenied('La solicitud de cambio no es valida.')


def _objetivos_con_resumen_queryset():
    return ObjetivoEspecifico.objects.select_related('documento').annotate(
        actividades_count=Count('actividades', distinct=True),
        monto_funcion_total=Coalesce(
            Sum('actividades__monto_funcion'),
            Decimal('0'),
            output_field=DecimalField(max_digits=14, decimal_places=2),
        ),
        monto_inversion_total=Coalesce(
            Sum('actividades__monto_inversion'),
            Decimal('0'),
            output_field=DecimalField(max_digits=14, decimal_places=2),
        ),
    )


def _documentos_queryset():
    return DocumentoPOA.objects.prefetch_related(
        Prefetch('objetivos', queryset=_objetivos_con_resumen_queryset()),
        'revisiones__revisor__user',
        'historial__usuario',
        'observaciones_checklist__creado_por',
        'observaciones_checklist__resuelto_por',
        'solicitudes_cambio__solicitado_por',
        'solicitudes_cambio__revisado_por',
    )


class UsuarioPOAViewSet(viewsets.ModelViewSet):
    """CRUD de usuarios con acceso al módulo POA."""
    queryset = UsuarioPOA.objects.select_related('user', 'docente', 'carrera').all()
    serializer_class = UsuarioPOASerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        _requerir_gestor_o_director(request)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data.get('user')
        rol = serializer.validated_data.get('rol')
        carrera_solicitante = _carrera_usuario_poa(request.user)
        carrera = carrera_solicitante if not request.user.is_superuser else (
            carrera_solicitante or serializer.validated_data.get('carrera')
        )

        if not carrera:
            return Response(
                {'carrera': ['Debe existir una carrera activa para asignar un elaborador POA.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not request.user.is_superuser and not _usuario_pertenece_a_carrera(user, carrera):
            return Response(
                {'user': ['Solo puede asignar usuarios que pertenecen a su misma carrera.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if rol == 'elaborador':
            existing_assignment = UsuarioPOA.objects.filter(user=user, rol=rol, carrera=carrera).first()

            if existing_assignment and existing_assignment.activo:
                nombre_usuario = user.get_full_name() or user.username
                return Response(
                    {'detail': f'El usuario {nombre_usuario} ya está asignado como {rol} del POA.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            with transaction.atomic():
                # Desactivar todos los otros elaboradores activos
                UsuarioPOA.objects.filter(
                    rol='elaborador',
                    activo=True,
                    carrera=carrera,
                ).exclude(user=user).update(activo=False)

                if existing_assignment: # significa que estaba inactivo
                    existing_assignment.activo = True
                    existing_assignment.carrera = carrera
                    existing_assignment.save(update_fields=['activo', 'carrera'])
                    serializer = self.get_serializer(existing_assignment)
                    headers = self.get_success_headers(serializer.data)
                    return Response(serializer.data, status=status.HTTP_200_OK, headers=headers)
                else: # no existia
                    instance = serializer.save(carrera=carrera)
                    headers = self.get_success_headers(serializer.data)
                    return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        else:
            return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        _requerir_gestor_o_director(request)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        _requerir_gestor_o_director(request)
        instance = self.get_object()
        
        # Si se está activando un elaborador
        if instance.rol == 'elaborador' and request.data.get('activo') is True:
            with transaction.atomic():
                # Desactivar todos los demás elaboradores
                carrera = instance.carrera or _carrera_usuario_poa(request.user)
                if not carrera:
                    return Response(
                        {'carrera': ['Debe existir una carrera activa para activar este acceso.']},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                instance.carrera = carrera
                instance.save(update_fields=['carrera'])
                UsuarioPOA.objects.filter(
                    rol='elaborador',
                    activo=True,
                    carrera=carrera,
                ).exclude(pk=instance.pk).update(activo=False)
                # Proceder con la activación del actual
                return super().partial_update(request, *args, **kwargs)

        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        _requerir_gestor_o_director(request)
        return super().destroy(request, *args, **kwargs)

    def perform_update(self, serializer):
        carrera = serializer.validated_data.get('carrera') or serializer.instance.carrera or _carrera_usuario_poa(self.request.user)
        user = serializer.validated_data.get('user') or serializer.instance.user

        if not self.request.user.is_superuser:
            carrera_usuario = _carrera_usuario_poa(self.request.user)
            if not carrera_usuario:
                raise PermissionDenied('El usuario no tiene una carrera activa para gestionar accesos POA.')
            carrera = carrera_usuario
            if user and not _usuario_pertenece_a_carrera(user, carrera):
                raise PermissionDenied('Solo puede asignar usuarios que pertenecen a su misma carrera.')

        instance = serializer.save(carrera=carrera)
        if instance.rol == 'elaborador' and instance.activo and instance.carrera_id:
            UsuarioPOA.objects.filter(
                rol='elaborador',
                activo=True,
                carrera_id=instance.carrera_id,
            ).exclude(pk=instance.pk).update(activo=False)

    def get_queryset(self):
        qs = UsuarioPOA.objects.select_related('user', 'docente', 'carrera').all()
        if not self.request.user.is_superuser:
            carrera = _carrera_usuario_poa(self.request.user)
            if not carrera:
                return UsuarioPOA.objects.none()
            qs = qs.filter(carrera_id=carrera.id)
        activo = self.request.query_params.get('activo')
        if activo in ('true', '1'):
            qs = qs.filter(activo=True)
        elif activo in ('false', '0'):
            qs = qs.filter(activo=False)
        return qs


class DocenteBusquedaView(APIView):
    """Busca docentes del sistema principal para asignarles roles POA."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        _requerir_gestor_o_director(request)
        q = request.query_params.get('q', '').strip()
        if len(q) < 2:
            return Response([])
        qs = Docente.objects.filter(
            Q(nombres__icontains=q) |
            Q(apellido_paterno__icontains=q) |
            Q(apellido_materno__icontains=q) |
            Q(ci__icontains=q) |
            Q(email__icontains=q),
            activo=True,
        ).order_by('apellido_paterno', 'nombres')[:20]
        # Si el solicitante es Director, limitar resultados a la misma carrera
        perfil = _get_user_profile(request.user)
        perfil_rol = getattr(perfil, 'rol', None)
        roles_poa = _poa_roles_activos(request.user)
        es_director = request.user.is_superuser or perfil_rol == 'director' or 'director' in roles_poa
        carrera = _carrera_usuario_poa(request.user)
        if es_director and carrera:
            qs = Docente.objects.filter(
                Q(nombres__icontains=q) |
                Q(apellido_paterno__icontains=q) |
                Q(apellido_materno__icontains=q) |
                Q(ci__icontains=q) |
                Q(email__icontains=q),
                activo=True,
            ).filter(
                Q(asignaciones_carrera__carrera_id=carrera.id, asignaciones_carrera__activo=True)
            ).order_by('apellido_paterno', 'nombres')[:20]

        return Response(DocenteSimpleSerializer(qs, many=True).data)


class UsuarioBusquedaView(APIView):
    """Busca usuarios del sistema principal para asignarles roles POA."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        _requerir_gestor_o_director(request)
        q = request.query_params.get('q', '').strip()
        if len(q) < 2:
            return Response([])
        qs = User.objects.select_related('perfil', 'perfil__docente').filter(
            Q(username__icontains=q) |
            Q(first_name__icontains=q) |
            Q(last_name__icontains=q) |
            Q(email__icontains=q),
            is_active=True,
        ).order_by('last_name', 'first_name')[:20]
        # Si el solicitante es Director, limitar la búsqueda a usuarios de la misma carrera
        perfil = _get_user_profile(request.user)
        perfil_rol = getattr(perfil, 'rol', None)
        roles_poa = _poa_roles_activos(request.user)
        es_director = request.user.is_superuser or perfil_rol == 'director' or 'director' in roles_poa
        carrera = _carrera_usuario_poa(request.user)
        if es_director and carrera:
            qs = User.objects.select_related('perfil', 'perfil__docente').filter(
                Q(username__icontains=q) |
                Q(first_name__icontains=q) |
                Q(last_name__icontains=q) |
                Q(email__icontains=q),
                is_active=True,
            ).filter(
                Q(perfil__carrera_id=carrera.id) |
                Q(perfil__docente__asignaciones_carrera__carrera_id=carrera.id, perfil__docente__asignaciones_carrera__activo=True)
            ).order_by('last_name', 'first_name')[:20]
        results = []
        for u in qs:
            perfil = _get_user_profile(u)
            results.append({
                'id': u.id,
                'username': u.username,
                'email': u.email,
                'nombre_completo': u.get_full_name() or u.username,
                'perfil': {
                    'rol': perfil.rol if perfil else None,
                    'docente': perfil.docente_id if perfil else None,
                } if perfil else None,
            })
        return Response(results)


class UsuarioBusquedaChatView(APIView):
    """Busca usuarios activos del sistema para chat directo."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        if len(q) < 2:
            return Response([])

        qs = User.objects.select_related('perfil').filter(
            Q(username__icontains=q) |
            Q(first_name__icontains=q) |
            Q(last_name__icontains=q) |
            Q(email__icontains=q),
            is_active=True,
        ).exclude(pk=request.user.id).order_by('last_name', 'first_name', 'username')[:20]

        results = []
        for u in qs:
            perfil = _get_user_profile(u)
            results.append({
                'id': u.id,
                'username': u.username,
                'email': u.email,
                'nombre_completo': u.get_full_name() or u.username,
                'perfil': {
                    'rol': perfil.rol if perfil else None,
                    'docente': perfil.docente_id if perfil else None,
                } if perfil else None,
            })
        return Response(results)


class DirectorCarreraActualView(APIView):
    """Retorna el Director de Carrera de la carrera activa del usuario autenticado."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        carrera = _carrera_usuario_poa(request.user)
        if not carrera:
            return Response({'detail': 'El usuario no tiene carrera activa.'}, status=status.HTTP_404_NOT_FOUND)

        director = User.objects.select_related('perfil').filter(
            is_active=True,
            perfil__rol='director',
        ).filter(
            Q(perfil__carrera_id=carrera.id) |
            Q(asignaciones_carrera__carrera_id=carrera.id, asignaciones_carrera__activo=True)
        ).distinct().first()

        if not director:
            return Response({'detail': 'No existe Director de Carrera para la carrera activa.'}, status=status.HTTP_404_NOT_FOUND)

        nombre = director.get_full_name() or director.username
        return Response({
            'id': director.id,
            'username': director.username,
            'nombre': nombre,
            'rol': 'director',
            'carrera_id': carrera.id,
            'carrera_nombre': getattr(carrera, 'nombre', ''),
        })


class ReporteGeneralPOAView(APIView):
    """Genera un PDF con el resumen general de documentos POA por gestión."""
    permission_classes = [IsAuthenticated]

    def _build_pdf(self, documentos, gestion):
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(letter),
            leftMargin=18,
            rightMargin=18,
            topMargin=18,
            bottomMargin=18,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'poa-report-title',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=16,
            leading=18,
            textColor=colors.HexColor('#0f172a'),
        )
        subtitle_style = ParagraphStyle(
            'poa-report-subtitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            leading=11,
            textColor=colors.HexColor('#334155'),
        )
        cell_style = ParagraphStyle(
            'poa-report-cell',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8,
            leading=10,
        )
        cell_bold_style = ParagraphStyle(
            'poa-report-cell-bold',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8,
            leading=10,
        )

        total = len(documentos)
        resumen = {
            'elaboracion': 0,
            'revision': 0,
            'observado': 0,
            'aprobado': 0,
            'ejecucion': 0,
        }
        for documento in documentos:
            estado = getattr(documento, 'estado', 'elaboracion')
            if estado in resumen:
                resumen[estado] += 1

        story = [
            Paragraph(f'Reporte General POA - Gestión {gestion}', title_style),
            Paragraph('Resumen de documentos disponibles para la gestión seleccionada.', subtitle_style),
            Spacer(1, 10),
        ]

        resumen_data = [
            [Paragraph('<b>Total</b>', cell_bold_style), Paragraph(str(total), cell_style)],
            [Paragraph('<b>En elaboración</b>', cell_bold_style), Paragraph(str(resumen['elaboracion']), cell_style)],
            [Paragraph('<b>En revisión</b>', cell_bold_style), Paragraph(str(resumen['revision']), cell_style)],
            [Paragraph('<b>Observado</b>', cell_bold_style), Paragraph(str(resumen['observado']), cell_style)],
            [Paragraph('<b>Aprobado</b>', cell_bold_style), Paragraph(str(resumen['aprobado']), cell_style)],
            [Paragraph('<b>En ejecución</b>', cell_bold_style), Paragraph(str(resumen['ejecucion']), cell_style)],
        ]
        resumen_table = Table(resumen_data, colWidths=[170, 60])
        resumen_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.extend([resumen_table, Spacer(1, 12)])

        rows = [[
            Paragraph('<b>#</b>', cell_bold_style),
            Paragraph('<b>Programa</b>', cell_bold_style),
            Paragraph('<b>Unidad solicitante</b>', cell_bold_style),
            Paragraph('<b>Estado</b>', cell_bold_style),
            Paragraph('<b>Fecha elaboración</b>', cell_bold_style),
            Paragraph('<b>Elaborado por</b>', cell_bold_style),
            Paragraph('<b>Director de Carrera</b>', cell_bold_style),
        ]]

        if documentos:
            for index, documento in enumerate(documentos, start=1):
                unidad = getattr(getattr(documento, 'unidad_solicitante', None), 'nombre', '') or getattr(getattr(documento, 'unidad_solicitante', None), 'codigo', '') or ''
                rows.append([
                    Paragraph(str(index), cell_style),
                    Paragraph(str(getattr(documento, 'programa', '') or ''), cell_style),
                    Paragraph(str(unidad), cell_style),
                    Paragraph(str(documento.get_estado_display()), cell_style),
                    Paragraph(str(getattr(documento, 'fecha_elaboracion', '')), cell_style),
                    Paragraph(str(getattr(documento, 'elaborado_por', '') or ''), cell_style),
                    Paragraph(str(getattr(documento, 'jefe_unidad', '') or ''), cell_style),
                ])
        else:
            rows.append([
                Paragraph('Sin documentos registrados para esta gestión.', cell_style), '', '', '', '', '', ''
            ])

        table = Table(rows, colWidths=[24, 170, 105, 72, 78, 115, 115], repeatRows=1)
        table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.45, colors.HexColor('#94a3b8')),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e2e8f0')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 5),
            ('RIGHTPADDING', (0, 0), (-1, -1), 5),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(table)

        doc.build(story)
        buffer.seek(0)
        return buffer

    def get(self, request):
        gestion_param = request.query_params.get('gestion')
        if gestion_param in (None, ''):
            return Response({'detail': "El parámetro de consulta 'gestion' es obligatorio. Ejemplo: ?gestion=2025"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            gestion = int(gestion_param)
        except (TypeError, ValueError):
            return Response({'detail': "El parámetro 'gestion' debe ser un entero válido."}, status=status.HTTP_400_BAD_REQUEST)

        documentos = _filtrar_documentos_por_usuario(
            _documentos_queryset().filter(gestion=gestion),
            request.user,
        ).select_related('unidad_solicitante').prefetch_related(
            'objetivos__actividades__detalles_presupuesto',
        ).order_by('programa', 'id')

        buffer = DocumentoPOAPDFGenerator.generar_reporte_general(list(documentos), gestion)
        nombre_archivo = f'reporte_documentos_{gestion}.pdf'
        return FileResponse(buffer, as_attachment=True, filename=nombre_archivo)


class ChatContactosPOAView(APIView):
    """Retorna los contactos válidos para chat según el rol del usuario actual."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        perfil = _get_user_profile(request.user)
        perfil_rol = getattr(perfil, 'rol', None)
        roles_poa = _poa_roles_activos(request.user)

        # Obtener carrera activa del usuario (puede ser None)
        carrera = _carrera_usuario_poa(request.user)

        # Default: sugerencias dentro de POA deben enlazar director <-> elaborador
        # exclusivamente dentro de la misma carrera.
        contactos_qs = User.objects.select_related('perfil').none()
        rol_contactos = None
        requiere_asignar_elaborador = False
        alerta_asignacion = None

        if request.user.is_superuser:
            # El administrador puede chatear con cualquier usuario activo.
            contactos_qs = User.objects.select_related('perfil').filter(is_active=True).exclude(pk=request.user.id).distinct().order_by('last_name', 'first_name', 'username')
            rol_contactos = 'usuarios'
        elif carrera:
            # Si el usuario es elaborador POA, sugerimos el Director de la misma carrera
            if 'elaborador' in roles_poa:
                contactos_qs = User.objects.select_related('perfil').filter(
                    is_active=True,
                    perfil__rol='director',
                ).filter(
                    Q(perfil__carrera_id=carrera.id) | Q(asignaciones_carrera__carrera_id=carrera.id, asignaciones_carrera__activo=True)
                ).exclude(pk=request.user.id).distinct().order_by('last_name', 'first_name', 'username')
                rol_contactos = 'director'
            # Si el usuario es director, sugerimos elaboradores POA vinculados a la misma carrera
            elif request.user.is_superuser or perfil_rol == 'director' or 'director' in roles_poa:
                accesos_elaborador_qs = UsuarioPOA.objects.select_related('user', 'docente').filter(
                    rol='elaborador',
                    activo=True,
                    carrera_id=carrera.id,
                ).filter(
                    Q(user__is_active=True, user__perfil__carrera_id=carrera.id)
                    | Q(docente__activo=True, docente__asignaciones_carrera__carrera_id=carrera.id, docente__asignaciones_carrera__activo=True)
                )

                if accesos_elaborador_qs.exists():
                    contactos_qs = User.objects.select_related('perfil').filter(
                        is_active=True,
                        accesos_poa__activo=True,
                        accesos_poa__rol='elaborador',
                        accesos_poa__carrera_id=carrera.id,
                    ).filter(
                        Q(accesos_poa__docente__asignaciones_carrera__carrera_id=carrera.id, accesos_poa__docente__asignaciones_carrera__activo=True)
                        | Q(perfil__carrera_id=carrera.id)
                    ).exclude(pk=request.user.id).distinct().order_by('last_name', 'first_name', 'username')
                else:
                    contactos_qs = User.objects.select_related('perfil').none()
                rol_contactos = 'elaborador'
                asignado_inactivo_qs = UsuarioPOA.objects.select_related('user', 'docente').filter(
                    rol='elaborador',
                    activo=False,
                    carrera_id=carrera.id,
                ).filter(
                    Q(user__perfil__carrera_id=carrera.id)
                    | Q(docente__asignaciones_carrera__carrera_id=carrera.id)
                )
                if not accesos_elaborador_qs.exists() and asignado_inactivo_qs.exists():
                    requiere_asignar_elaborador = True
                    alerta_asignacion = {
                        'titulo': 'El elaborador del POA está inactivo',
                        'mensaje': 'Existe un elaborador POA asignado, pero su acceso está inactivo. Debe activarlo o asignar uno nuevo.',
                        'link': '/poa/accesos',
                        'texto_link': 'Asignar',
                    }
                elif not accesos_elaborador_qs.exists():
                    requiere_asignar_elaborador = True
                    alerta_asignacion = {
                        'titulo': 'Usted debe asignar un elaborador del POA',
                        'mensaje': 'No existe un elaborador POA asignado para su carrera. Debe asignarlo antes de usar el chat sugerido.',
                        'link': '/poa/accesos',
                        'texto_link': 'Asignar',
                    }
        else:
            # Sin carrera, no sugerimos contactos por defecto dentro de POA; el usuario
            # podrá usar recent/search para hablar con cualquier usuario del sistema.
            contactos_qs = User.objects.select_related('perfil').filter(is_active=True).exclude(pk=request.user.id).distinct().order_by('last_name', 'first_name', 'username')
            rol_contactos = 'usuarios'

        no_leidos_qs = MensajeChat.objects.filter(receptor=request.user, leido_en__isnull=True)
        no_leidos_total = no_leidos_qs.count()
        no_leidos_por_usuario = dict(
            no_leidos_qs.values('emisor_id')
            .annotate(total=Count('id'))
            .values_list('emisor_id', 'total')
        )

        contactos = []
        for usuario in contactos_qs:
            perfil = _get_user_profile(usuario)
            contactos.append({
                'id': usuario.id,
                'username': usuario.username,
                'nombre_completo': usuario.get_full_name() or usuario.username,
                'rol': rol_contactos or getattr(perfil, 'rol', None),
                'no_leidos': no_leidos_por_usuario.get(usuario.id, 0),
            })

        recientes_map = {}
        recientes_qs = MensajeChat.objects.select_related('emisor', 'receptor').filter(
            Q(emisor=request.user) | Q(receptor=request.user)
        ).order_by('-fecha')[:200]
        for mensaje in recientes_qs:
            peer = mensaje.receptor if mensaje.emisor_id == request.user.id else mensaje.emisor
            peer_id = peer.id
            if peer_id in recientes_map:
                continue
            perfil = _get_user_profile(peer)
            recientes_map[peer_id] = {
                'id': peer.id,
                'username': peer.username,
                'nombre_completo': peer.get_full_name() or peer.username,
                'rol': getattr(perfil, 'rol', None),
                'fecha_ultimo_mensaje': mensaje.fecha,
                'ultimo_mensaje': mensaje.texto,
                'no_leidos': no_leidos_por_usuario.get(peer_id, 0),
            }

        recientes = list(recientes_map.values())

        # El chat por defecto solo se mantiene fijo entre director y elaborador.
        # Para los demas usuarios, el historial/buscador decide la conversacion.
        mantiene_chat_director_elaborador = rol_contactos in ('director', 'elaborador')

        if contactos and mantiene_chat_director_elaborador and not requiere_asignar_elaborador:
            contacto_default = contactos[0]
        elif recientes:
            contacto_default = recientes[0]
        else:
            contacto_default = None

        contactos_sugeridos = contactos

        # Determinar rol actual del usuario
        es_director = request.user.is_superuser or perfil_rol == 'director' or 'director' in roles_poa
        es_elaborador = 'elaborador' in roles_poa

        return Response({
            'rol_actual': 'admin' if request.user.is_superuser else ('director' if es_director else ('elaborador' if es_elaborador else 'usuario')),
            'rol_contactos': rol_contactos,
            'contactos': contactos_sugeridos,
            'contactos_recientes': recientes,
            'contacto_default': contacto_default,
            'no_leidos_total': no_leidos_total,
            'requiere_seleccion': len(contactos_sugeridos) > 1,
            'requiere_asignar_elaborador': requiere_asignar_elaborador,
            'alerta_asignacion': alerta_asignacion,
        })


class CurrentUserAPIView(APIView):
    """Retorna información básica del usuario autenticado."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            'id': user.id,
            'username': user.username,
            'nombre_completo': user.get_full_name() or user.username,
        })


class DireccionViewSet(viewsets.ModelViewSet):
    queryset = Direccion.objects.all()
    serializer_class = DireccionSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        _requerir_elaborador(request)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        _requerir_elaborador(request)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        _requerir_elaborador(request)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        _requerir_elaborador(request)
        return super().destroy(request, *args, **kwargs)



class DocumentoPOAViewSet(viewsets.ModelViewSet):
    """
    API CRUD para todos los documentos POA registrados.
    """
    queryset = _documentos_queryset()
    serializer_class = DocumentoPOASerializer

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return _filtrar_documentos_por_usuario(_documentos_queryset(), self.request.user)

    def create(self, request, *args, **kwargs):
        _requerir_elaborador(request)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        doc = self.get_object()
        _requerir_documento_editable_directo(request, doc)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        doc = self.get_object()
        _requerir_documento_editable_directo(request, doc)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        doc = self.get_object()
        _requerir_documento_editable_directo(request, doc)
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        documento = serializer.save()
        _crear_historial_documento(
            documento=documento,
            usuario=self.request.user,
            tipo_evento='creacion',
            descripcion='Documento POA creado.',
            estado_anterior='',
            estado_nuevo=documento.estado,
            datos_evento={
                'gestion': documento.gestion,
                'programa': documento.programa,
            },
        )

    def perform_update(self, serializer):
        instancia = serializer.instance
        estado_anterior = serializer.instance.estado if serializer.instance else ''
        def _string_valor(valor):
            if valor is None or valor == '':
                return 'Sin valor'
            if hasattr(valor, 'nombre_display'):
                return valor.nombre_display
            if hasattr(valor, 'nombre_completo'):
                return valor.nombre_completo
            if hasattr(valor, 'isoformat'):
                return str(valor.isoformat())
            return str(valor)

        field_labels = {
            'gestion': 'Gestión',
            'unidad_solicitante': 'Unidad solicitante',
            'programa': 'Programa',
            'objetivo_gestion_institucional': 'Objetivo institucional',
            'elaborado_por': 'Elaborado por',
            'jefe_unidad': 'Director de carrera',
            'fecha_elaboracion': 'Fecha de elaboración',
            'estado': 'Estado',
            'observaciones': 'Observaciones',
        }

        cambios = []
        for field_name, nuevo_valor in serializer.validated_data.items():
            anterior_valor = getattr(instancia, field_name, None)
            if _string_valor(anterior_valor) == _string_valor(nuevo_valor):
                continue
            cambios.append({
                'campo': field_name,
                'etiqueta': field_labels.get(field_name, field_name.replace('_', ' ').title()),
                'antes': _string_valor(anterior_valor),
                'despues': _string_valor(nuevo_valor),
            })

        documento = serializer.save()
        registrar_bitacora = (instancia.ciclo_revision_actual or 0) > 0 or estado_anterior != 'elaboracion'
        if not registrar_bitacora:
            return

        descripcion = 'Documento POA editado.'
        if cambios:
            descripcion = f"Documento POA editado ({', '.join(c['etiqueta'] for c in cambios)})."
        _crear_historial_documento(
            documento=documento,
            usuario=self.request.user,
            tipo_evento='edicion',
            descripcion=descripcion,
            estado_anterior=estado_anterior,
            estado_nuevo=documento.estado,
            datos_evento={
                'gestion': documento.gestion,
                'programa': documento.programa,
                'cambios': cambios,
            },
        )

    @action(detail=True, methods=['get'], url_path='historial')
    def historial_completo(self, request, pk=None):
        doc = self.get_object()
        from poa_document.api.serializers import HistorialDocumentoPOASerializer as H
        qs = doc.historial.select_related('usuario').all()
        return Response(H(qs, many=True, context={'request': request}).data)

    @action(detail=True, methods=['get'], url_path='pdf-oficial')
    def generar_pdf_oficial(self, request, pk=None):
        try:
            documento = self.get_object()
            buffer = DocumentoPOAPDFGenerator.generar_reporte_individual(documento)

            programa = (documento.programa or 'Documento').replace(' ', '_')
            gestion = documento.gestion
            nombre_archivo = f"POA_{programa}_{gestion}.pdf"

            return FileResponse(buffer, as_attachment=True, filename=nombre_archivo)
        except Exception as e:
            return HttpResponse(f"Error crítico al generar PDF: {str(e)}", status=500)

    @action(detail=True, methods=['post'], url_path='enviar-revision')
    def enviar_revision(self, request, pk=None):
        _requerir_elaborador(request)
        doc = self.get_object()
        if doc.estado not in ('elaboracion', 'observado'):
            return Response({'detail': f'No se puede enviar a revisión desde el estado {doc.get_estado_display()}.'}, status=status.HTTP_400_BAD_REQUEST)

        director = (doc.jefe_unidad or '').strip()
        if not director:
            return Response({'jefe_unidad': ['El documento debe tener un Director de Carrera asignado antes de enviarse a revisión.']}, status=status.HTTP_400_BAD_REQUEST)

        estado_anterior = doc.estado
        doc.revisiones.filter(activo=True).update(activo=False)
        nuevo_ciclo = doc.ciclo_revision_actual + 1

        doc.estado = 'revision'
        doc.ciclo_revision_actual = nuevo_ciclo
        doc.observaciones = ''
        doc.save(update_fields=['estado', 'ciclo_revision_actual', 'observaciones', 'actualizado_en'])

        _crear_historial_documento(
            documento=doc,
            usuario=request.user,
            tipo_evento='envio_revision',
            descripcion='Documento enviado a revisión del Director del sistema principal.',
            estado_anterior=estado_anterior,
            estado_nuevo=doc.estado,
            datos_evento={
                'ciclo_revision': nuevo_ciclo,
                'director': director,
            },
        )
        return Response(self.get_serializer(doc).data)

    @action(detail=True, methods=['post'], url_path='aprobar')
    def aprobar(self, request, pk=None):
        _requerir_revisor(request)
        doc = self.get_object()
        if doc.estado != 'revision':
            return Response({'detail': f'Solo se puede aprobar en estado En revisión. Estado actual: {doc.get_estado_display()}.'}, status=status.HTTP_400_BAD_REQUEST)

        observacion = (request.data.get('observacion') or request.data.get('observaciones') or '').strip()
        estado_anterior = doc.estado
        doc.estado = 'aprobado'
        doc.observaciones = ''
        doc.save(update_fields=['estado', 'observaciones', 'actualizado_en'])

        _crear_historial_documento(
            documento=doc,
            usuario=request.user,
            tipo_evento='aprobacion_revision',
            descripcion='Documento aprobado por Director del sistema principal.',
            estado_anterior=estado_anterior,
            estado_nuevo=doc.estado,
            datos_evento={
                'observacion': observacion,
            },
        )
        return Response(self.get_serializer(doc).data)

    @action(detail=True, methods=['post'], url_path='iniciar-ejecucion')
    def iniciar_ejecucion(self, request, pk=None):
        _requerir_revisor(request)
        doc = self.get_object()
        if doc.estado != 'aprobado':
            return Response({'detail': f'Solo se puede iniciar ejecucion desde estado Aprobado. Estado actual: {doc.get_estado_display()}.'}, status=status.HTTP_400_BAD_REQUEST)

        hoy = timezone.now().date()
        gestion_actual = hoy.year
        excepcion_archivo_2026 = hoy <= date(2026, 12, 31) and doc.gestion < gestion_actual
        if doc.gestion != gestion_actual and not excepcion_archivo_2026:
            return Response({'detail': 'Solo se puede iniciar ejecucion para documentos aprobados de la gestion actual.'}, status=status.HTTP_400_BAD_REQUEST)

        estado_anterior = doc.estado
        doc.estado = 'ejecucion'
        doc.save(update_fields=['estado', 'actualizado_en'])

        _crear_historial_documento(
            documento=doc,
            usuario=request.user,
            tipo_evento='inicio_ejecucion',
            descripcion='Documento POA iniciado en ejecucion.',
            estado_anterior=estado_anterior,
            estado_nuevo=doc.estado,
            datos_evento={
                'gestion': doc.gestion,
                'excepcion_archivo_2026': excepcion_archivo_2026,
            },
        )
        return Response(self.get_serializer(doc).data)

    @action(detail=True, methods=['post'], url_path='observar')
    def observar(self, request, pk=None):
        _requerir_revisor(request)
        doc = self.get_object()
        if doc.estado != 'revision':
            return Response({'detail': f'Solo se puede observar en estado En revisión. Estado actual: {doc.get_estado_display()}.'}, status=status.HTTP_400_BAD_REQUEST)

        observaciones_raw = request.data.get('observaciones')
        if observaciones_raw is None:
            observaciones_raw = request.data.get('observacion') or ''
        observaciones_items = _parse_observaciones_items(observaciones_raw)
        observaciones = '\n'.join(observaciones_items).strip()
        if not observaciones_items:
            return Response({'observaciones': ['Debe registrar observaciones para marcar el documento como observado.']}, status=status.HTTP_400_BAD_REQUEST)

        estado_anterior = doc.estado
        doc.estado = 'observado'
        doc.observaciones = observaciones
        doc.save(update_fields=['estado', 'observaciones', 'actualizado_en'])

        doc.observaciones_checklist.filter(ciclo_revision=doc.ciclo_revision_actual).delete()
        ObservacionDocumentoPOA.objects.bulk_create([
            ObservacionDocumentoPOA(
                documento=doc,
                ciclo_revision=doc.ciclo_revision_actual,
                texto=texto,
                creado_por=request.user,
            )
            for texto in observaciones_items
        ])

        _crear_historial_documento(
            documento=doc,
            usuario=request.user,
            tipo_evento='observacion_revision',
            descripcion='Documento observado por Director del sistema principal.',
            estado_anterior=estado_anterior,
            estado_nuevo=doc.estado,
            datos_evento={
                'observaciones': observaciones,
            },
        )
        return Response(self.get_serializer(doc).data)

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
        documento = _documentos_queryset().filter(pk=pk).prefetch_related(
            'objetivos__actividades__detalles_presupuesto',
        ).first()
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

        queryset = self.get_queryset().filter(gestion=year)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class ObservacionDocumentoPOAViewSet(viewsets.ModelViewSet):
    serializer_class = ObservacionDocumentoPOASerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        docs = _filtrar_documentos_por_usuario(DocumentoPOA.objects.all(), self.request.user)
        qs = ObservacionDocumentoPOA.objects.select_related(
            'documento',
            'creado_por',
            'resuelto_por',
        ).filter(documento__in=docs)
        documento_id = self.request.query_params.get('documento_id')
        if documento_id:
            qs = qs.filter(documento_id=documento_id)
        return qs.order_by('ciclo_revision', 'id')

    def create(self, request, *args, **kwargs):
        return Response({'detail': 'Las observaciones se crean al observar un documento.'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def update(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        _requerir_elaborador(request)
        observacion = self.get_object()
        documento = observacion.documento
        if documento.estado != 'observado':
            return Response({'detail': 'Solo se pueden marcar observaciones mientras el documento esta observado.'}, status=status.HTTP_400_BAD_REQUEST)

        resuelta = bool(request.data.get('resuelta'))
        observacion.resuelta = resuelta
        if resuelta:
            observacion.resuelto_por = request.user
            observacion.resuelto_en = timezone.now()
        else:
            observacion.resuelto_por = None
            observacion.resuelto_en = None
        observacion.save(update_fields=['resuelta', 'resuelto_por', 'resuelto_en'])

        _crear_historial_documento(
            documento=documento,
            usuario=request.user,
            tipo_evento='edicion',
            descripcion='Observacion marcada como corregida.' if resuelta else 'Observacion marcada como pendiente.',
            estado_anterior=documento.estado,
            estado_nuevo=documento.estado,
            datos_evento={
                'observacion_id': observacion.id,
                'observacion': observacion.texto,
                'resuelta': resuelta,
            },
        )
        return Response(self.get_serializer(observacion).data)

    def destroy(self, request, *args, **kwargs):
        return Response({'detail': 'Las observaciones no se eliminan desde este endpoint.'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)


class SolicitudCambioPOAViewSet(viewsets.ModelViewSet):
    serializer_class = SolicitudCambioPOASerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        docs = _filtrar_documentos_por_usuario(DocumentoPOA.objects.all(), self.request.user)
        qs = SolicitudCambioPOA.objects.select_related(
            'documento',
            'solicitado_por',
            'revisado_por',
        ).filter(documento__in=docs)
        estado_param = self.request.query_params.get('estado')
        if estado_param:
            qs = qs.filter(estado=estado_param)
        documento_id = self.request.query_params.get('documento_id')
        if documento_id:
            qs = qs.filter(documento_id=documento_id)
        return qs

    def create(self, request, *args, **kwargs):
        _requerir_elaborador(request)
        documento = _obtener_documento_accesible(request.user, request.data.get('documento'))
        if not documento:
            return Response({'documento': ['Documento no encontrado o sin permisos.']}, status=status.HTTP_404_NOT_FOUND)
        if documento.estado not in ESTADOS_PLANIFICACION_CON_SOLICITUD:
            return Response(
                {'detail': 'Las solicitudes de cambio solo aplican a documentos aprobados o en ejecucion.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        solicitud = serializer.save(documento=documento, solicitado_por=request.user)

        _crear_historial_documento(
            documento=documento,
            usuario=request.user,
            tipo_evento='solicitud_cambio',
            descripcion='Solicitud de cambio enviada al Director de Carrera.',
            estado_anterior=documento.estado,
            estado_nuevo=documento.estado,
            datos_evento={
                'solicitud_id': solicitud.id,
                'tipo_objeto': solicitud.tipo_objeto,
                'accion': solicitud.accion,
                'descripcion': solicitud.descripcion,
                'resumen': solicitud.resumen,
            },
        )
        return Response(self.get_serializer(solicitud).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        return Response({'detail': 'Use aprobar o rechazar para resolver solicitudes.'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        solicitud = self.get_object()
        if solicitud.estado != 'pendiente':
            return Response({'detail': 'Solo se pueden cancelar solicitudes pendientes.'}, status=status.HTTP_400_BAD_REQUEST)
        if solicitud.solicitado_por_id != request.user.id and not request.user.is_superuser:
            raise PermissionDenied('Solo quien solicito el cambio puede cancelarlo.')
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='aprobar')
    def aprobar(self, request, pk=None):
        _requerir_revisor(request)
        solicitud = self.get_object()
        if solicitud.estado != 'pendiente':
            return Response({'detail': 'Esta solicitud ya fue resuelta.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            resultado = _aplicar_solicitud_cambio(solicitud)
            solicitud.estado = 'aprobado'
            solicitud.revisado_por = request.user
            solicitud.respuesta = (request.data.get('respuesta') or '').strip()
            solicitud.respondido_en = timezone.now()
            solicitud.save(update_fields=['estado', 'revisado_por', 'respuesta', 'respondido_en', 'actualizado_en'])

            _crear_historial_documento(
                documento=solicitud.documento,
                usuario=request.user,
                tipo_evento='aprobacion_cambio',
                descripcion='Solicitud de cambio aprobada y aplicada.',
                estado_anterior=solicitud.documento.estado,
                estado_nuevo=solicitud.documento.estado,
                datos_evento={
                    'solicitud_id': solicitud.id,
                    'tipo_objeto': solicitud.tipo_objeto,
                    'accion': solicitud.accion,
                    'resultado': resultado,
                    'respuesta': solicitud.respuesta,
                },
            )
        return Response(self.get_serializer(solicitud).data)

    @action(detail=True, methods=['post'], url_path='rechazar')
    def rechazar(self, request, pk=None):
        _requerir_revisor(request)
        solicitud = self.get_object()
        if solicitud.estado != 'pendiente':
            return Response({'detail': 'Esta solicitud ya fue resuelta.'}, status=status.HTTP_400_BAD_REQUEST)

        solicitud.estado = 'rechazado'
        solicitud.revisado_por = request.user
        solicitud.respuesta = (request.data.get('respuesta') or '').strip()
        solicitud.respondido_en = timezone.now()
        solicitud.save(update_fields=['estado', 'revisado_por', 'respuesta', 'respondido_en', 'actualizado_en'])

        _crear_historial_documento(
            documento=solicitud.documento,
            usuario=request.user,
            tipo_evento='rechazo_cambio',
            descripcion='Solicitud de cambio rechazada.',
            estado_anterior=solicitud.documento.estado,
            estado_nuevo=solicitud.documento.estado,
            datos_evento={
                'solicitud_id': solicitud.id,
                'tipo_objeto': solicitud.tipo_objeto,
                'accion': solicitud.accion,
                'respuesta': solicitud.respuesta,
            },
        )
        return Response(self.get_serializer(solicitud).data)


class EvidenciaViewSet(viewsets.ModelViewSet):
    """CRUD para evidencias asociadas a actividades."""
    queryset = Evidencia.objects.select_related('actividad__objetivo__documento').prefetch_related('archivos').all()
    serializer_class = EvidenciaSerializer
    permission_classes = [IsAuthenticated]

    def _sincronizar_estado_actividad(self, actividad_id, estado):
        if not actividad_id:
            return

        Actividad.objects.filter(pk=actividad_id).update(estado=estado)

    def _guardar_adjuntos(self, evidencia, request, data, replace_links=False):
        files = request.FILES.getlist('archivos') or []
        for f in files:
            EvidenciaArchivo.objects.create(evidencia=evidencia, tipo='imagen', archivo=f)

        removed_raw = data.get('removed_archivos')
        if removed_raw:
            try:
                import json
                if isinstance(removed_raw, str):
                    removed_ids = json.loads(removed_raw) if removed_raw.strip().startswith('[') else [removed_raw]
                else:
                    removed_ids = list(removed_raw)

                removed_ids = [int(value) for value in removed_ids if str(value).strip().isdigit()]
                if removed_ids:
                    evidencia.archivos.filter(tipo='imagen', id__in=removed_ids).delete()
            except Exception:
                pass

        if replace_links:
            evidencia.archivos.filter(tipo='link').delete()

        links_raw = data.get('links')
        links = []
        if links_raw:
            try:
                import json
                if isinstance(links_raw, str):
                    if links_raw.strip().startswith('['):
                        links = json.loads(links_raw)
                    else:
                        links = [l.strip() for l in links_raw.split(',') if l.strip()]
            except Exception:
                links = [l.strip() for l in str(links_raw).split(',') if l.strip()]

        for url in links:
            EvidenciaArchivo.objects.create(evidencia=evidencia, tipo='link', url=url)

    def get_queryset(self):
        docs = _filtrar_documentos_por_usuario(DocumentoPOA.objects.all(), self.request.user)
        qs = self.queryset.filter(actividad__objetivo__documento__in=docs)
        actividad_id = self.request.query_params.get('actividad_id') or self.request.data.get('actividad_id')
        if actividad_id:
            try:
                actividad_id = int(actividad_id)
                qs = qs.filter(actividad_id=actividad_id)
            except (TypeError, ValueError):
                return Evidencia.objects.none()
        return qs.order_by('-creado_en')

    def create(self, request, *args, **kwargs):
        # Esperamos FormData con archivos opcionales y campos JSON.
        data = request.data.copy()
        actividad = data.get('actividad_id') or data.get('actividad')
        if not actividad:
            return Response({'actividad_id': ['El campo actividad_id es obligatorio.']}, status=status.HTTP_400_BAD_REQUEST)
        try:
            actividad_obj = Actividad.objects.select_related('objetivo__documento').get(pk=int(actividad))
        except (TypeError, ValueError, Actividad.DoesNotExist):
            return Response({'actividad_id': ['Actividad no encontrada.']}, status=status.HTTP_404_NOT_FOUND)
        if not _documento_accesible_para_usuario(request.user, actividad_obj.objetivo.documento):
            return Response({'detail': 'Actividad no encontrada o sin permisos.'}, status=status.HTTP_404_NOT_FOUND)
        _requerir_evidencia_editable(request, actividad_obj)

        with transaction.atomic():
            # Validar y crear la evidencia
            ser = self.get_serializer(data=data)
            ser.is_valid(raise_exception=True)
            evidencia = ser.save()

            self._guardar_adjuntos(evidencia, request, data)
            self._sincronizar_estado_actividad(evidencia.actividad_id, 'completado')
            _crear_historial_documento(
                documento=actividad_obj.objetivo.documento,
                usuario=request.user,
                tipo_evento='evidencia',
                descripcion='Evidencia registrada.',
                estado_anterior=actividad_obj.objetivo.documento.estado,
                estado_nuevo=actividad_obj.objetivo.documento.estado,
                datos_evento={'actividad_id': evidencia.actividad_id, 'evidencia_id': evidencia.id},
            )

        out = EvidenciaSerializer(evidencia, context={'request': request}).data
        return Response(out, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        actividad_obj = instance.actividad
        _requerir_evidencia_editable(request, actividad_obj)
        data = request.data.copy()

        with transaction.atomic():
            ser = self.get_serializer(instance, data=data, partial=partial)
            ser.is_valid(raise_exception=True)
            evidencia = ser.save()

            self._guardar_adjuntos(evidencia, request, data, replace_links=True)
            self._sincronizar_estado_actividad(evidencia.actividad_id, 'completado')
            _crear_historial_documento(
                documento=actividad_obj.objetivo.documento,
                usuario=request.user,
                tipo_evento='evidencia',
                descripcion='Evidencia actualizada.',
                estado_anterior=actividad_obj.objetivo.documento.estado,
                estado_nuevo=actividad_obj.objetivo.documento.estado,
                datos_evento={'actividad_id': evidencia.actividad_id, 'evidencia_id': evidencia.id},
            )

        out = EvidenciaSerializer(evidencia, context={'request': request}).data
        return Response(out, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        actividad_obj = instance.actividad
        _requerir_evidencia_editable(request, actividad_obj)
        actividad_id = instance.actividad_id

        with transaction.atomic():
            documento = actividad_obj.objetivo.documento
            evidencia_id = instance.id
            response = super().destroy(request, *args, **kwargs)
            self._sincronizar_estado_actividad(actividad_id, 'programado')
            _crear_historial_documento(
                documento=documento,
                usuario=request.user,
                tipo_evento='evidencia',
                descripcion='Evidencia eliminada.',
                estado_anterior=documento.estado,
                estado_nuevo=documento.estado,
                datos_evento={'actividad_id': actividad_id, 'evidencia_id': evidencia_id},
            )

        return response





# Objetivos y Actividades integrados en `poa_document`.
# No registrar viewsets duplicados aquí para evitar conflictos y duplicación.

class DocumentoPOAReadOnlyViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API de solo lectura para visualizar encabezados de documentos POA del año actual.
    """
    serializer_class = DocumentoPOASerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Devuelve documentos de la gestión solicitada, restringidos a la carrera del usuario.
        Si no se envía gestion/year, usa el año actual.
        """
        req_year = self.request.query_params.get('gestion') or self.request.query_params.get('year')
        if req_year:
            try:
                year = int(req_year)
            except (ValueError, TypeError):
                return DocumentoPOA.objects.none()
        else:
            year = timezone.now().year

        qs = _filtrar_documentos_por_usuario(_documentos_queryset(), self.request.user)
        return qs.filter(gestion=year)


# --- ViewSets para Objetivos y Actividades ---
class ObjetivoEspecificoViewSet(viewsets.ModelViewSet):
    serializer_class = ObjetivoEspecificoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = _objetivos_con_resumen_queryset()
        documento_id = self.request.query_params.get('documento_id')
        if documento_id:
            documento = _obtener_documento_accesible(self.request.user, documento_id)
            if not documento:
                return qs.none()
            return qs.filter(documento=documento)
        return qs

    def get_object(self):
        obj = super().get_object()
        if not _documento_accesible_para_usuario(self.request.user, obj.documento):
            from rest_framework.exceptions import NotFound
            raise NotFound('El objetivo no pertenece a una carrera accesible para este usuario.')
        return obj

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
        documento = _obtener_documento_accesible(request.user, documento_id)
        if not documento:
            return Response({'detail': 'Documento no encontrado o sin permisos para verlo.'}, status=status.HTTP_404_NOT_FOUND)

        qs = self.get_queryset().filter(documento=documento)
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        _requerir_elaborador(request)
        # Exigir documento_id en el payload para crear un objetivo
        if 'documento_id' not in request.data:
            return Response({'detail': "El campo 'documento_id' es obligatorio para crear un objetivo."}, status=status.HTTP_400_BAD_REQUEST)
        documento = _obtener_documento_accesible(request.user, request.data.get('documento_id'))
        if not documento:
            return Response({'detail': 'Documento no encontrado o sin permisos para modificarlo.'}, status=status.HTTP_404_NOT_FOUND)
        _requerir_documento_editable_directo(request, documento)
        response = super().create(request, *args, **kwargs)
        _crear_historial_documento(
            documento=documento,
            usuario=request.user,
            tipo_evento='edicion',
            descripcion='Objetivo especifico creado.',
            estado_anterior=documento.estado,
            estado_nuevo=documento.estado,
            datos_evento={'objetivo': response.data},
        )
        return response

    def update(self, request, *args, **kwargs):
        obj = self.get_object()
        _requerir_documento_editable_directo(request, obj.documento)
        response = super().update(request, *args, **kwargs)
        _crear_historial_documento(
            documento=obj.documento,
            usuario=request.user,
            tipo_evento='edicion',
            descripcion='Objetivo especifico actualizado.',
            estado_anterior=obj.documento.estado,
            estado_nuevo=obj.documento.estado,
            datos_evento={'objetivo_id': obj.id},
        )
        return response

    def partial_update(self, request, *args, **kwargs):
        obj = self.get_object()
        _requerir_documento_editable_directo(request, obj.documento)
        response = super().partial_update(request, *args, **kwargs)
        _crear_historial_documento(
            documento=obj.documento,
            usuario=request.user,
            tipo_evento='edicion',
            descripcion='Objetivo especifico actualizado.',
            estado_anterior=obj.documento.estado,
            estado_nuevo=obj.documento.estado,
            datos_evento={'objetivo_id': obj.id},
        )
        return response

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        documento = obj.documento
        objetivo_id = obj.id
        _requerir_documento_editable_directo(request, documento)
        response = super().destroy(request, *args, **kwargs)
        _crear_historial_documento(
            documento=documento,
            usuario=request.user,
            tipo_evento='edicion',
            descripcion='Objetivo especifico eliminado.',
            estado_anterior=documento.estado,
            estado_nuevo=documento.estado,
            datos_evento={'objetivo_id': objetivo_id},
        )
        return response


class ActividadViewSet(viewsets.ModelViewSet):
    serializer_class = ActividadSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # indicador_descripcion ahora es texto; no es posible hacer select_related sobre él
        qs = Actividad.objects.select_related('objetivo__documento').prefetch_related('evidencias').all()
        objetivo_id = self.request.query_params.get('objetivo_id')
        if objetivo_id:
            try:
                objetivo = ObjetivoEspecifico.objects.select_related('documento').get(pk=int(objetivo_id))
            except (ValueError, TypeError, ObjetivoEspecifico.DoesNotExist):
                return qs.none()
            if not _documento_accesible_para_usuario(self.request.user, objetivo.documento):
                return qs.none()
            return qs.filter(objetivo=objetivo)
        return qs

    def get_object(self):
        obj = super().get_object()
        if not _documento_accesible_para_usuario(self.request.user, obj.objetivo.documento):
            from rest_framework.exceptions import NotFound
            raise NotFound('La actividad no pertenece a una carrera accesible para este usuario.')
        return obj

    @action(detail=True, methods=['patch'])
    def asignar_catalogo(self, request, pk=None):
        actividad = self.get_object()
        _requerir_documento_editable_directo(request, actividad.objetivo.documento)
        # Aceptamos texto directo (catalogo_descripcion) o, como fallback, catalogo_id
        catalogo_text = request.data.get('catalogo_descripcion') or request.data.get('catalogo_text')
        catalogo_id = request.data.get('catalogo_id')
        if not catalogo_text and not catalogo_id:
            return Response({'error': 'Debe proporcionar catalogo_descripcion (texto) o catalogo_id'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            if catalogo_text:
                actividad.indicador_descripcion = catalogo_text
            else:
                catalogo = get_object_or_404(IndicadorCatalogo, id=catalogo_id)
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
            if not _documento_accesible_para_usuario(request.user, objetivo.documento):
                return Response({'detail': 'Documento no encontrado o sin permisos para verlo.'}, status=status.HTTP_404_NOT_FOUND)

        qs = self.get_queryset().filter(objetivo_id=obj_id)
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        _requerir_elaborador(request)
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

        if not _documento_accesible_para_usuario(request.user, objetivo.documento):
            return Response({'detail': 'Documento no encontrado o sin permisos para modificarlo.'}, status=status.HTTP_404_NOT_FOUND)
        _requerir_documento_editable_directo(request, objetivo.documento)

        documento_param = request.query_params.get('documento_id')
        if documento_param:
            try:
                doc_param = int(documento_param)
            except (ValueError, TypeError):
                return Response({'detail': "El parámetro 'documento_id' debe ser un entero válido."}, status=status.HTTP_400_BAD_REQUEST)
            if objetivo.documento_id != doc_param:
                return Response({'detail': 'El objetivo no pertenece al documento solicitado.'}, status=status.HTTP_400_BAD_REQUEST)

        response = super().create(request, *args, **kwargs)
        _crear_historial_documento(
            documento=objetivo.documento,
            usuario=request.user,
            tipo_evento='edicion',
            descripcion='Actividad creada.',
            estado_anterior=objetivo.documento.estado,
            estado_nuevo=objetivo.documento.estado,
            datos_evento={'actividad': response.data},
        )
        return response

    def update(self, request, *args, **kwargs):
        actividad = self.get_object()
        documento = actividad.objetivo.documento
        _requerir_documento_editable_directo(request, documento)
        response = super().update(request, *args, **kwargs)
        _crear_historial_documento(
            documento=documento,
            usuario=request.user,
            tipo_evento='edicion',
            descripcion='Actividad actualizada.',
            estado_anterior=documento.estado,
            estado_nuevo=documento.estado,
            datos_evento={'actividad_id': actividad.id},
        )
        return response

    def partial_update(self, request, *args, **kwargs):
        actividad = self.get_object()
        documento = actividad.objetivo.documento
        _requerir_documento_editable_directo(request, documento)
        response = super().partial_update(request, *args, **kwargs)
        _crear_historial_documento(
            documento=documento,
            usuario=request.user,
            tipo_evento='edicion',
            descripcion='Actividad actualizada.',
            estado_anterior=documento.estado,
            estado_nuevo=documento.estado,
            datos_evento={'actividad_id': actividad.id},
        )
        return response

    def destroy(self, request, *args, **kwargs):
        actividad = self.get_object()
        documento = actividad.objetivo.documento
        actividad_id = actividad.id
        _requerir_documento_editable_directo(request, documento)
        response = super().destroy(request, *args, **kwargs)
        _crear_historial_documento(
            documento=documento,
            usuario=request.user,
            tipo_evento='edicion',
            descripcion='Actividad eliminada.',
            estado_anterior=documento.estado,
            estado_nuevo=documento.estado,
            datos_evento={'actividad_id': actividad_id},
        )
        return response

    @action(detail=False, methods=['get'])
    def indicadores_por_direccion(self, request):
        search = (request.query_params.get('q') or request.query_params.get('search') or '').strip()
        try:
            indicadores = IndicadorCatalogo.objects.all().order_by('indicador')
            if search:
                indicadores = indicadores.filter(indicador__icontains=search)
            from catalogos.api.serializers import IndicadorCatalogoSerializer
            serializer = IndicadorCatalogoSerializer(indicadores, many=True)
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': f'Error al obtener indicadores: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['patch'])
    def asignar_indicador(self, request, pk=None):
        actividad = self.get_object()
        _requerir_documento_editable_directo(request, actividad.objetivo.documento)
        # Aceptamos indicador_descripcion (texto) o indicador_id como fallback
        indicador_text = request.data.get('indicador_descripcion') or request.data.get('indicador_text')
        indicador_id = request.data.get('indicador_id')
        if not indicador_text and not indicador_id:
            return Response({'error': 'Debe proporcionar indicador_descripcion (texto) o indicador_id'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            if indicador_text:
                actividad.indicador_descripcion = indicador_text
            else:
                indicador = get_object_or_404(IndicadorCatalogo, id=indicador_id)
                actividad.indicador_descripcion = indicador.indicador
            actividad.save()
            serializer = self.get_serializer(actividad)
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': f'Error al asignar el indicador: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)


# --- ViewSet estándar para DetallePresupuesto ---
class DetallePresupuestoViewSet(viewsets.ModelViewSet):
    serializer_class = DetallePresupuestoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # 'partida' e 'item' ya no son ForeignKey, son CharField.
        # Mantener select_related sólo para relaciones reales (actividad).
        qs = DetallePresupuesto.objects.select_related('actividad').all()
        actividad_id = self.request.query_params.get('actividad_id')
        if actividad_id:
            try:
                actividad = Actividad.objects.select_related('objetivo__documento').get(pk=int(actividad_id))
            except (ValueError, TypeError, Actividad.DoesNotExist):
                return qs.none()
            if not _documento_accesible_para_usuario(self.request.user, actividad.objetivo.documento):
                return qs.none()
            return qs.filter(actividad=actividad)
        return qs

    def get_object(self):
        obj = super().get_object()
        if not _documento_accesible_para_usuario(self.request.user, obj.actividad.objetivo.documento):
            from rest_framework.exceptions import NotFound
            raise NotFound('El detalle de presupuesto no pertenece a una carrera accesible para este usuario.')
        return obj

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
            if not _documento_accesible_para_usuario(request.user, actividad.objetivo.documento):
                return Response({'detail': 'Documento no encontrado o sin permisos para verlo.'}, status=status.HTTP_404_NOT_FOUND)
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        _requerir_elaborador(request)
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

        if not _documento_accesible_para_usuario(request.user, actividad.objetivo.documento):
            return Response({'detail': 'Documento no encontrado o sin permisos para modificarlo.'}, status=status.HTTP_404_NOT_FOUND)
        _requerir_documento_editable_directo(request, actividad.objetivo.documento)

        documento_param = request.query_params.get('documento_id')
        if documento_param:
            try:
                doc_param = int(documento_param)
            except (ValueError, TypeError):
                return Response({'detail': "El parámetro 'documento_id' debe ser un entero válido."}, status=status.HTTP_400_BAD_REQUEST)
            if actividad.objetivo.documento_id != doc_param:
                return Response({'detail': 'La actividad no pertenece al documento solicitado.'}, status=status.HTTP_400_BAD_REQUEST)

        response = super().create(request, *args, **kwargs)
        _recalcular_montos_actividad(actividad)
        _crear_historial_documento(
            documento=actividad.objetivo.documento,
            usuario=request.user,
            tipo_evento='edicion',
            descripcion='Presupuesto creado.',
            estado_anterior=actividad.objetivo.documento.estado,
            estado_nuevo=actividad.objetivo.documento.estado,
            datos_evento={'presupuesto': response.data},
        )
        return response

    def update(self, request, *args, **kwargs):
        detalle = self.get_object()
        documento = detalle.actividad.objetivo.documento
        _requerir_documento_editable_directo(request, documento)
        response = super().update(request, *args, **kwargs)
        _recalcular_montos_actividad(detalle.actividad)
        _crear_historial_documento(
            documento=documento,
            usuario=request.user,
            tipo_evento='edicion',
            descripcion='Presupuesto actualizado.',
            estado_anterior=documento.estado,
            estado_nuevo=documento.estado,
            datos_evento={'detalle_id': detalle.id},
        )
        return response

    def partial_update(self, request, *args, **kwargs):
        detalle = self.get_object()
        documento = detalle.actividad.objetivo.documento
        _requerir_documento_editable_directo(request, documento)
        response = super().partial_update(request, *args, **kwargs)
        _recalcular_montos_actividad(detalle.actividad)
        _crear_historial_documento(
            documento=documento,
            usuario=request.user,
            tipo_evento='edicion',
            descripcion='Presupuesto actualizado.',
            estado_anterior=documento.estado,
            estado_nuevo=documento.estado,
            datos_evento={'detalle_id': detalle.id},
        )
        return response

    def destroy(self, request, *args, **kwargs):
        detalle = self.get_object()
        documento = detalle.actividad.objetivo.documento
        actividad = detalle.actividad
        detalle_id = detalle.id
        _requerir_documento_editable_directo(request, documento)
        response = super().destroy(request, *args, **kwargs)
        _recalcular_montos_actividad(actividad)
        _crear_historial_documento(
            documento=documento,
            usuario=request.user,
            tipo_evento='edicion',
            descripcion='Presupuesto eliminado.',
            estado_anterior=documento.estado,
            estado_nuevo=documento.estado,
            datos_evento={'detalle_id': detalle_id},
        )
        return response





class MensajeChatViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = MensajeChatSerializer
    permission_classes = [IsAuthenticated]

    def _get_peer_id(self):
        peer_user_id = self.request.query_params.get('peer_user_id')
        if not peer_user_id:
            return None
        try:
            return int(peer_user_id)
        except (ValueError, TypeError):
            return None

    def get_queryset(self):
        qs = MensajeChat.objects.select_related('emisor', 'receptor')
        peer_user_id = self.request.query_params.get('peer_user_id')
        peer_id = self._get_peer_id()

        if peer_user_id:
            if not peer_id:
                return qs.none()
            return qs.filter(
                (Q(emisor=self.request.user) & Q(receptor_id=peer_id)) |
                (Q(emisor_id=peer_id) & Q(receptor=self.request.user))
            ).order_by('fecha')

        return qs.filter(
            Q(emisor=self.request.user) | Q(receptor=self.request.user)
        ).order_by('fecha')

    def _marcar_mensajes_entrantes_como_leidos(self):
        peer_id = self._get_peer_id()
        if not peer_id or peer_id == self.request.user.id:
            return

        MensajeChat.objects.filter(
            emisor_id=peer_id,
            receptor=self.request.user,
            leido_en__isnull=True,
        ).update(leido_en=timezone.now())

    def list(self, request, *args, **kwargs):
        """Return the last page by default when no page param is provided."""
        self._marcar_mensajes_entrantes_como_leidos()
        qs = self.get_queryset()
        # if pagination is configured and no page param, set page to last
        if getattr(self, 'paginator', None) is None and getattr(self, 'pagination_class', None):
            self.paginator = self.pagination_class()

        if self.paginator and not request.query_params.get('page'):
            page_size = getattr(self.paginator, 'page_size', None) or (settings.REST_FRAMEWORK.get('PAGE_SIZE', 10))
            total = qs.count()
            from math import ceil
            last = max(1, int(ceil(total / float(page_size)))) if total else 1
            # mutate underlying GET to include page param
            try:
                # DRF Request.query_params may be immutable; mutate underlying django GET
                request._request.GET = request._request.GET.copy()
                request._request.GET['page'] = str(last)
                # also reflect in QueryDict used by DRF
                request.query_params._mutable = True
                request.query_params['page'] = str(last)
                request.query_params._mutable = False
            except Exception:
                pass

        return super().list(request, *args, **kwargs)

    def get_object(self):
        obj = super().get_object()
        if obj.emisor_id == self.request.user.id or obj.receptor_id == self.request.user.id:
            return obj
        from rest_framework.exceptions import NotFound
        raise NotFound('El mensaje no pertenece a una conversación accesible para este usuario.')

    def create(self, request, *args, **kwargs):
        emisor_id = request.data.get('emisor')
        receptor_id = request.data.get('receptor') or request.data.get('peer_user_id')
        texto = (request.data.get('texto') or '').strip()

        if emisor_id not in (None, ''):
            try:
                emisor_id = int(emisor_id)
            except (ValueError, TypeError):
                return Response({'detail': "El campo 'emisor' debe ser un entero válido."}, status=status.HTTP_400_BAD_REQUEST)
            if emisor_id != request.user.id:
                return Response({'detail': 'El emisor debe coincidir con el usuario autenticado.'}, status=status.HTTP_400_BAD_REQUEST)

        if not receptor_id:
            contactos_view = ChatContactosPOAView()
            contactos_view.request = request
            respuesta = contactos_view.get(request)
            default_contact = respuesta.data.get('contacto_default') if hasattr(respuesta, 'data') else None
            if default_contact and default_contact.get('id'):
                receptor_id = default_contact['id']
            else:
                return Response({'detail': "El campo 'receptor' es obligatorio."}, status=status.HTTP_400_BAD_REQUEST)
        if not texto:
            return Response({'detail': 'El mensaje no puede estar vacio.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(texto) < 2:
            return Response({'detail': 'El mensaje debe tener al menos 2 caracteres.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            receptor_id = int(receptor_id)
        except (ValueError, TypeError):
            return Response({'detail': "El campo 'receptor' debe ser un entero válido."}, status=status.HTTP_400_BAD_REQUEST)

        if receptor_id == request.user.id:
            return Response({'detail': 'No puedes enviarte mensajes a ti mismo.'}, status=status.HTTP_400_BAD_REQUEST)

        receptor = User.objects.filter(pk=receptor_id, is_active=True).first()
        if not receptor:
            return Response({'detail': 'Usuario receptor no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        # Excepciones para superusuario: el superusuario no puede ser bloqueado
        # y puede enviar/recibir mensajes sin restricciones.
        if not (request.user.is_superuser or receptor.is_superuser):
            if BloqueoChat.objects.filter(bloqueador=request.user, bloqueado=receptor).exists():
                return Response({'detail': 'Desbloquea al usuario para poder enviarle mensajes.'}, status=status.HTTP_400_BAD_REQUEST)

            if BloqueoChat.objects.filter(bloqueador=receptor, bloqueado=request.user).exists():
                return Response({'detail': 'Este usuario te ha bloqueado y no puede recibir tus mensajes.'}, status=status.HTTP_403_FORBIDDEN)

        mensaje = MensajeChat.objects.create(
            emisor=request.user,
            receptor=receptor,
            texto=texto,
        )
        return Response(MensajeChatSerializer(mensaje).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        mensaje = self.get_object()
        if mensaje.emisor_id != request.user.id:
            raise PermissionDenied('Solo puedes eliminar tus propios mensajes.')
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['delete'], url_path='vaciar')
    def vaciar_chat(self, request):
        peer_user_id = request.query_params.get('peer_user_id') or request.data.get('peer_user_id')
        if not peer_user_id:
            return Response({'detail': "El campo 'peer_user_id' es obligatorio."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            peer_id = int(peer_user_id)
        except (ValueError, TypeError):
            return Response({'detail': "El campo 'peer_user_id' debe ser un entero válido."}, status=status.HTTP_400_BAD_REQUEST)
        if peer_id == request.user.id:
            return Response({'detail': 'No puedes vaciar un chat contigo mismo.'}, status=status.HTTP_400_BAD_REQUEST)

        eliminados = MensajeChat.objects.filter(
            (Q(emisor=request.user) & Q(receptor_id=peer_id)) |
            (Q(emisor_id=peer_id) & Q(receptor=request.user))
        ).delete()[0]
        return Response({'detail': 'Chat vaciado correctamente.', 'eliminados': eliminados})

    @action(detail=False, methods=['get'], url_path='bloqueo-estado')
    def bloqueo_estado(self, request):
        peer_user_id = request.query_params.get('peer_user_id')
        if not peer_user_id:
            return Response({'detail': "El campo 'peer_user_id' es obligatorio."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            peer_id = int(peer_user_id)
        except (ValueError, TypeError):
            return Response({'detail': "El campo 'peer_user_id' debe ser un entero válido."}, status=status.HTTP_400_BAD_REQUEST)
        if peer_id == request.user.id:
            return Response({'detail': 'No aplica bloqueo sobre tu propio usuario.'}, status=status.HTTP_400_BAD_REQUEST)

        bloqueado_por_mi = BloqueoChat.objects.filter(bloqueador=request.user, bloqueado_id=peer_id).exists()
        bloqueado_por_peer = BloqueoChat.objects.filter(bloqueador_id=peer_id, bloqueado=request.user).exists()
        return Response({
            'bloqueado_por_mi': bloqueado_por_mi,
            'bloqueado_por_peer': bloqueado_por_peer,
        })

    @action(detail=False, methods=['post'], url_path='bloquear')
    def bloquear_usuario(self, request):
        peer_user_id = request.data.get('peer_user_id') or request.query_params.get('peer_user_id')
        if not peer_user_id:
            return Response({'detail': "El campo 'peer_user_id' es obligatorio."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            peer_id = int(peer_user_id)
        except (ValueError, TypeError):
            return Response({'detail': "El campo 'peer_user_id' debe ser un entero válido."}, status=status.HTTP_400_BAD_REQUEST)
        if peer_id == request.user.id:
            return Response({'detail': 'No puedes bloquearte a ti mismo.'}, status=status.HTTP_400_BAD_REQUEST)

        peer = User.objects.filter(pk=peer_id, is_active=True).first()
        if not peer:
            return Response({'detail': 'Usuario no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        # No permitir bloquear al superusuario
        if peer.is_superuser:
            return Response({'detail': 'No es posible bloquear al superusuario.'}, status=status.HTTP_400_BAD_REQUEST)

        bloqueo, created = BloqueoChat.objects.get_or_create(bloqueador=request.user, bloqueado=peer)
        return Response({
            'detail': 'Usuario bloqueado correctamente.' if created else 'El usuario ya estaba bloqueado.',
            'bloqueado_por_mi': True,
        })

    @action(detail=False, methods=['post'], url_path='desbloquear')
    def desbloquear_usuario(self, request):
        peer_user_id = request.data.get('peer_user_id') or request.query_params.get('peer_user_id')
        if not peer_user_id:
            return Response({'detail': "El campo 'peer_user_id' es obligatorio."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            peer_id = int(peer_user_id)
        except (ValueError, TypeError):
            return Response({'detail': "El campo 'peer_user_id' debe ser un entero válido."}, status=status.HTTP_400_BAD_REQUEST)
        if peer_id == request.user.id:
            return Response({'detail': 'No puedes desbloquearte a ti mismo.'}, status=status.HTTP_400_BAD_REQUEST)

        peer = User.objects.filter(pk=peer_id, is_active=True).first()
        if not peer:
            return Response({'detail': 'Usuario no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        # Si el peer es superusuario no hay bloqueo aplicable
        if peer.is_superuser:
            return Response({'detail': 'No aplica: el superusuario no puede ser bloqueado.', 'bloqueado_por_mi': False})

        deleted = BloqueoChat.objects.filter(bloqueador=request.user, bloqueado_id=peer_id).delete()[0]
        return Response({
            'detail': 'Usuario desbloqueado correctamente.' if deleted else 'El usuario no estaba bloqueado.',
            'bloqueado_por_mi': False,
        })
