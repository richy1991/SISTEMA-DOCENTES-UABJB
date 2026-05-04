from rest_framework import viewsets, mixins
from rest_framework.permissions import IsAuthenticated, AllowAny, SAFE_METHODS
from rest_framework.response import Response
from rest_framework import status
from rest_framework import generics
from rest_framework.views import APIView
from django.http import FileResponse, HttpResponse
from django.utils import timezone
from django.db import transaction
from django.db.models import Q
from django.core.exceptions import ObjectDoesNotExist
from rest_framework.exceptions import PermissionDenied
from poa_document.models import Direccion, DocumentoPOA, ObjetivoEspecifico, Actividad, DetallePresupuesto, UsuarioPOA, RevisionDocumentoPOA, HistorialDocumentoPOA, MensajeChat, BloqueoChat, Evidencia, EvidenciaArchivo
from fondos.models import Docente
from django.contrib.auth.models import User
from .serializers import (
    DireccionSerializer,
    DocumentoPOASerializer,
    ObjetivoEspecificoSerializer,
    ActividadSerializer,
    DetallePresupuestoSerializer,
    UsuarioPOASerializer,
    DocenteSimpleSerializer,
    MensajeChatSerializer,
    EvidenciaSerializer,
    EvidenciaArchivoSerializer,
)
from catalogos.models import OperacionCatalogo
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
    return set(UsuarioPOA.objects.filter(filtros, activo=True).values_list('rol', flat=True))


def _es_elaborador(user):
    if not user or not user.is_authenticated:
        return False
    roles = _poa_roles_activos(user)
    if 'elaborador' in roles:
        return True
    perfil = _get_user_profile(user)
    docente_id = getattr(perfil, 'docente_id', None)
    return UsuarioPOA.objects.filter(
        Q(user_id=user.id) | Q(docente_id=docente_id),
        activo=True,
        rol='elaborador',
    ).exists()


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


def _requerir_gestor_accesos(request):
    if not (_es_elaborador(request.user) or _es_admin_principal(request.user)):
        raise PermissionDenied('Solo el rol Elaborador POA o Administrador principal puede gestionar accesos POA.')


def _requerir_revisor(request):
    if not _es_revisor(request.user):
        raise PermissionDenied('Solo el Director del sistema principal puede realizar esta acción.')


def _accesos_poa_usuario(user):
    if not user or not user.is_authenticated:
        return UsuarioPOA.objects.none()
    filtros = Q(user=user)
    perfil = _get_user_profile(user)
    docente_id = getattr(perfil, 'docente_id', None)
    if docente_id:
        filtros |= Q(docente_id=docente_id)
    return UsuarioPOA.objects.filter(filtros)


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


def _resumen_observaciones_revision(documento):
    observadas = documento.revisiones.filter(
        activo=True,
        ciclo_revision=documento.ciclo_revision_actual,
        estado='observado',
    ).select_related('revisor__user')
    mensajes = []
    for revision in observadas:
        etiqueta = revision.revisor.nombre_entidad or revision.revisor.nombre_display
        if revision.observaciones:
            mensajes.append(f'[{etiqueta}] {revision.observaciones}')
    return '\n\n'.join(mensajes)


def _obtener_revision_del_usuario(documento, user):
    acceso_ids = list(_accesos_poa_usuario(user).values_list('id', flat=True))
    if not acceso_ids:
        return None
    return documento.revisiones.filter(
        activo=True,
        ciclo_revision=documento.ciclo_revision_actual,
        revisor_id__in=acceso_ids,
    ).select_related('revisor__user').first()


def _documentos_queryset():
    return DocumentoPOA.objects.prefetch_related(
        'objetivos',
        'revisiones__revisor__user',
        'historial__usuario',
    )


class UsuarioPOAViewSet(viewsets.ModelViewSet):
    """CRUD de usuarios con acceso al módulo POA."""
    queryset = UsuarioPOA.objects.select_related('user', 'docente').all()
    serializer_class = UsuarioPOASerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        _requerir_gestor_accesos(request)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        _requerir_gestor_accesos(request)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        _requerir_gestor_accesos(request)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        _requerir_gestor_accesos(request)
        return super().destroy(request, *args, **kwargs)

    def get_queryset(self):
        qs = UsuarioPOA.objects.select_related('user', 'docente').all()
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
        _requerir_gestor_accesos(request)
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
        return Response(DocenteSimpleSerializer(qs, many=True).data)


class UsuarioBusquedaView(APIView):
    """Busca usuarios del sistema principal para asignarles roles POA."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        _requerir_gestor_accesos(request)
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
                ).filter(
                    Q(user__is_active=True, user__perfil__carrera_id=carrera.id)
                    | Q(docente__activo=True, docente__asignaciones_carrera__carrera_id=carrera.id, docente__asignaciones_carrera__activo=True)
                )

                if accesos_elaborador_qs.exists():
                    contactos_qs = User.objects.select_related('perfil').filter(
                        is_active=True,
                        accesos_poa__activo=True,
                        accesos_poa__rol='elaborador',
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

        contactos = []
        for usuario in contactos_qs:
            perfil = _get_user_profile(usuario)
            contactos.append({
                'id': usuario.id,
                'username': usuario.username,
                'nombre_completo': usuario.get_full_name() or usuario.username,
                'rol': rol_contactos or getattr(perfil, 'rol', None),
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
            }

        recientes = list(recientes_map.values())

        # El predeterminado en POA prioriza la sugerencia por rol/carrera (contactos),
        # y si no existe se toma el más reciente.
        if contactos and not requiere_asignar_elaborador:
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
        _requerir_elaborador(request)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        _requerir_elaborador(request)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        _requerir_elaborador(request)
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        instancia = serializer.instance
        estado_anterior = serializer.instance.estado if serializer.instance else ''
        justificacion = ''
        if estado_anterior in ('aprobado', 'ejecucion'):
            justificacion = str(self.request.data.get('justificacion_edicion', '')).strip()
            if not justificacion:
                from rest_framework.exceptions import ValidationError as DRFValidationError
                raise DRFValidationError({'justificacion_edicion': 'Debe ingresar una justificación para editar un documento aprobado.'})

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
                'justificacion': justificacion,
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

    @action(detail=True, methods=['post'], url_path='observar')
    def observar(self, request, pk=None):
        _requerir_revisor(request)
        doc = self.get_object()
        if doc.estado != 'revision':
            return Response({'detail': f'Solo se puede observar en estado En revisión. Estado actual: {doc.get_estado_display()}.'}, status=status.HTTP_400_BAD_REQUEST)

        observaciones = (request.data.get('observaciones') or request.data.get('observacion') or '').strip()
        if not observaciones:
            return Response({'observaciones': ['Debe registrar observaciones para marcar el documento como observado.']}, status=status.HTTP_400_BAD_REQUEST)

        estado_anterior = doc.estado
        doc.estado = 'observado'
        doc.observaciones = observaciones
        doc.save(update_fields=['estado', 'observaciones', 'actualizado_en'])

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


class EvidenciaViewSet(viewsets.ModelViewSet):
    """CRUD para evidencias asociadas a actividades."""
    queryset = Evidencia.objects.select_related('actividad').prefetch_related('archivos').all()
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
        qs = self.queryset
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

        with transaction.atomic():
            # Validar y crear la evidencia
            ser = self.get_serializer(data=data)
            ser.is_valid(raise_exception=True)
            evidencia = ser.save()

            self._guardar_adjuntos(evidencia, request, data)
            self._sincronizar_estado_actividad(evidencia.actividad_id, 'completado')

        out = EvidenciaSerializer(evidencia, context={'request': request}).data
        return Response(out, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        data = request.data.copy()

        with transaction.atomic():
            ser = self.get_serializer(instance, data=data, partial=partial)
            ser.is_valid(raise_exception=True)
            evidencia = ser.save()

            self._guardar_adjuntos(evidencia, request, data, replace_links=True)
            self._sincronizar_estado_actividad(evidencia.actividad_id, 'completado')

        out = EvidenciaSerializer(evidencia, context={'request': request}).data
        return Response(out, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        actividad_id = instance.actividad_id

        with transaction.atomic():
            response = super().destroy(request, *args, **kwargs)
            self._sincronizar_estado_actividad(actividad_id, 'programado')

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
        qs = ObjetivoEspecifico.objects.select_related('documento').all()
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

        documento_param = request.query_params.get('documento_id')
        if documento_param:
            try:
                doc_param = int(documento_param)
            except (ValueError, TypeError):
                return Response({'detail': "El parámetro 'documento_id' debe ser un entero válido."}, status=status.HTTP_400_BAD_REQUEST)
            if objetivo.documento_id != doc_param:
                return Response({'detail': 'El objetivo no pertenece al documento solicitado.'}, status=status.HTTP_400_BAD_REQUEST)

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

        documento_param = request.query_params.get('documento_id')
        if documento_param:
            try:
                doc_param = int(documento_param)
            except (ValueError, TypeError):
                return Response({'detail': "El parámetro 'documento_id' debe ser un entero válido."}, status=status.HTTP_400_BAD_REQUEST)
            if actividad.objetivo.documento_id != doc_param:
                return Response({'detail': 'La actividad no pertenece al documento solicitado.'}, status=status.HTTP_400_BAD_REQUEST)

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





class MensajeChatViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = MensajeChatSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = MensajeChat.objects.select_related('emisor', 'receptor')
        peer_user_id = self.request.query_params.get('peer_user_id')

        if peer_user_id:
            try:
                peer_id = int(peer_user_id)
            except (ValueError, TypeError):
                return qs.none()
            return qs.filter(
                (Q(emisor=self.request.user) & Q(receptor_id=peer_id)) |
                (Q(emisor_id=peer_id) & Q(receptor=self.request.user))
            ).order_by('fecha')

        return qs.filter(
            Q(emisor=self.request.user) | Q(receptor=self.request.user)
        ).order_by('fecha')

    def list(self, request, *args, **kwargs):
        """Return the last page by default when no page param is provided."""
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