from rest_framework import viewsets, filters, status, generics, serializers as drf_serializers
from rest_framework.decorators import action, api_view, permission_classes, renderer_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser, BasePermission
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from django.http import HttpResponse, JsonResponse, FileResponse
from django.db import transaction, IntegrityError
from django.db.models import Prefetch, ProtectedError, prefetch_related_objects
from django.core.exceptions import ValidationError as DjangoValidationError
from .utils.pdf_generator import FondoPDFGenerator
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import (
    Docente, Carrera, Materia, FondoTiempo, CategoriaFuncion, Actividad, PerfilUsuario, CargaHoraria,
    CalendarioAcademico, Proyecto, InformeFondo, ObservacionFondo, MensajeObservacion, HistorialFondo,
    SaldoVacacionesGestion
)
from .serializers import (
    DocenteSerializer, CarreraSerializer, MateriaSerializer, FondoTiempoSerializer,
    FondoTiempoListSerializer, CategoriaFuncionSerializer, ActividadSerializer, CargaHorariaSerializer,
    UsuarioSerializer, CrearUsuarioSerializer, ActualizarUsuarioSerializer,
    FotoPerfilSerializer,
    CalendarioAcademicoSerializer, ProyectoSerializer, ProyectoListSerializer,
    InformeFondoSerializer, InformeFondoListSerializer,
    ObservacionFondoSerializer, MensajeObservacionSerializer,
    HistorialFondoSerializer, DocenteDetalleSerializer,
    FondoTiempoDetalleSerializer, PresentarFondoSerializer,
    AprobarFondoSerializer, ObservarFondoSerializer,
    SaldoVacacionesGestionSerializer,
    CustomTokenObtainPairSerializer
)

class IsFullAdmin(BasePermission):
    """
    Permite acceso solo a usuarios autenticados con perfil y rol 'admin'.
    Bloquea a cualquier otro rol aunque tenga is_staff=True.
    """
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, 'perfil')
            and request.user.perfil.rol == 'admin'
        )

class IsAdminOrDirector(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (
            request.user.is_superuser or 
            (hasattr(request.user, 'perfil') and request.user.perfil.rol in ['admin', 'director'])
        ))

class DocenteViewSet(viewsets.ModelViewSet):
    queryset = Docente.objects.all()
    serializer_class = DocenteSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nombres', 'apellido_paterno', 'apellido_materno', 'ci']
    ordering_fields = ['apellido_paterno', 'nombres']
    ordering = ['apellido_paterno']

    def get_permissions(self):
        """
        Restringir listado y creación a administradores.
        Docentes solo pueden ver/editar su propio perfil.
        """
        # Acciones de modificación: ESTRICTAMENTE para Admin Real (bloquea a Jefe de Estudios)
        # Incluimos update y partial_update para evitar que editen.
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsFullAdmin()]
            
        # List y Retrieve permitidos para autenticados (el filtro se hace en get_queryset)
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
            
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        # Permitir a Staff (Admin) O al Jefe de Estudios ver todos los docentes
        es_jefe_estudios = hasattr(user, 'perfil') and user.perfil.rol == 'jefe_estudios'
        
        if user.is_staff or es_jefe_estudios:
            return Docente.objects.all()
        
        if hasattr(user, 'perfil') and user.perfil.docente:
            return Docente.objects.filter(id=user.perfil.docente.id)
            
        return Docente.objects.none()

    def destroy(self, request, *args, **kwargs):
        """
        Eliminación segura de docente con manejo de errores de integridad.
        """
        docente = self.get_object()
        estados_bloqueantes = ['aprobado_director', 'en_ejecucion', 'finalizado']

        if FondoTiempo.objects.filter(docente=docente, estado__in=estados_bloqueantes).exists():
            raise drf_serializers.ValidationError(
                'No se puede eliminar al docente porque tiene historial académico vinculado. Considere desactivar su usuario en su lugar'
            )

        try:
            self.perform_destroy(docente)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ProtectedError:
            return Response(
                {'error': 'No se puede eliminar el docente porque tiene registros protegidos asociados (ej. Cargas Horarias en calendarios cerrados).'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'Error interno al eliminar docente: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SaldoVacacionesGestionViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar saldos de vacaciones por docente y gestión.
    Permite cargar masivamente los saldos del PDF de 'Vacaciones 2024'.
    """
    queryset = SaldoVacacionesGestion.objects.all()
    serializer_class = SaldoVacacionesGestionSerializer
    permission_classes = [IsFullAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['docente__nombres', 'docente__apellido_paterno', 'docente__apellido_materno', 'gestion']
    ordering_fields = ['gestion', 'docente']
    ordering = ['-gestion', 'docente']

    def get_queryset(self):
        """Solo admin puede acceder a los saldos de vacaciones."""
        return SaldoVacacionesGestion.objects.all()

    @action(detail=False, methods=['post'], permission_classes=[IsFullAdmin])
    def cargar_masivo(self, request):
        """
        Endpoint para cargar masivamente saldos de vacaciones.
        
        Esperado (JSON):
        [
            {"docente_id": 5, "gestion": 2024, "dias_disponibles": 15},
            {"docente_id": 7, "gestion": 2024, "dias_disponibles": 20},
            ...
        ]
        
        Retorna: Cantidad de registros creados/actualizados y errores (si los hay)
        """
        data = request.data
        
        if not isinstance(data, list):
            return Response(
                {'error': 'Se esperaba una lista de registros'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        resultado = {
            'creados': 0,
            'actualizados': 0,
            'errores': []
        }
        
        for idx, item in enumerate(data):
            serializer = SaldoVacacionesGestionSerializer(data=item)
            if serializer.is_valid():
                try:
                    obj, created = SaldoVacacionesGestion.objects.update_or_create(
                        docente_id=item.get('docente_id'),
                        gestion=item.get('gestion'),
                        defaults={'dias_disponibles': item.get('dias_disponibles')}
                    )
                    if created:
                        resultado['creados'] += 1
                    else:
                        resultado['actualizados'] += 1
                except Exception as e:
                    resultado['errores'].append({
                        'fila': idx + 1,
                        'docente_id': item.get('docente_id'),
                        'gestion': item.get('gestion'),
                        'error': str(e)
                    })
            else:
                resultado['errores'].append({
                    'fila': idx + 1,
                    'validacion': serializer.errors
                })
        
        return Response(resultado, status=status.HTTP_201_CREATED if resultado['errores'] == [] else status.HTTP_207_MULTI_STATUS)


class CarreraViewSet(viewsets.ModelViewSet):
    queryset = Carrera.objects.filter(activo=True)
    serializer_class = CarreraSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['nombre', 'codigo', 'facultad']

    def get_permissions(self):
        # Configuración global de carreras: solo admin real.
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsFullAdmin()]
        return [IsAuthenticated()]

    def _build_dependency_counts(self, carrera):
        materias_qs = Materia.objects.filter(carrera=carrera)
        materias_count = materias_qs.count()
        semestres_count = materias_qs.values('semestre').distinct().count()
        fondos_qs = FondoTiempo.objects.filter(carrera=carrera)
        informes_count = InformeFondo.objects.filter(fondo_tiempo__in=fondos_qs).count()
        return {
            'materias': materias_count,
            'semestres': semestres_count,
            'informes': informes_count,
            'can_delete': materias_count == 0 and informes_count == 0,
        }

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def dependencias(self, request, pk=None):
        carrera = self.get_object()
        counts = self._build_dependency_counts(carrera)
        return Response(counts, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        carrera = self.get_object()
        try:
            carrera.delete()
            return Response({'detail': 'Carrera eliminada correctamente.'}, status=status.HTTP_200_OK)
        except ProtectedError:
            counts = self._build_dependency_counts(carrera)
            return Response(
                {
                    'code': 'protected_error',
                    'detail': f"ERROR DE INTEGRIDAD: No se puede eliminar la carrera {carrera.nombre} porque aún tiene {counts['materias']} materias e informes vinculados.",
                    'dependencias': counts,
                },
                status=status.HTTP_409_CONFLICT,
            )


class MateriaViewSet(viewsets.ModelViewSet):
    queryset = Materia.objects.select_related('carrera').all()
    serializer_class = MateriaSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['semestre', 'carrera']
    search_fields = ['nombre', 'sigla', 'carrera__nombre']
    ordering_fields = ['semestre', 'nombre', 'carrera']
    ordering = ['carrera', 'semestre', 'nombre']

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if hasattr(user, 'perfil') and user.perfil.carrera and user.perfil.rol in ['jefe_estudios', 'director']:
            queryset = queryset.filter(carrera=user.perfil.carrera)
        return queryset

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminOrDirector()]
        return [IsAuthenticated()]

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        self.perform_update(serializer)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)


class CargaHorariaViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la asignación de horas por parte de Jefes de Estudio y Admins.
    - Jefes/Admins: CRUD completo.
    - Directores: Lectura de su carrera.
    - Docentes: Lectura de sus propias asignaciones.
    """
    queryset = CargaHoraria.objects.select_related('docente', 'calendario', 'creado_por').all()
    serializer_class = CargaHorariaSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['docente', 'calendario', 'categoria']
    search_fields = ['titulo_actividad', 'docente__nombres', 'docente__apellido_paterno']
    ordering_fields = ['calendario__gestion', 'docente', 'horas']
    ordering = ['-calendario__gestion']

    def get_permissions(self):
        """
        Solo Jefes de Estudio y Admins pueden crear, editar o borrar.
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            if not hasattr(self.request.user, 'perfil') or self.request.user.perfil.rol not in ['admin', 'jefe_estudios']:
                raise PermissionDenied("Solo Jefes de Estudio o Administradores pueden modificar cargas horarias.")
        
        return super().get_permissions()

    def get_queryset(self):
        """
        Filtra la carga horaria según el rol del usuario.
        """
        user = self.request.user
        try:
            perfil = user.perfil
        except Exception:
            perfil = None
        queryset = super().get_queryset()

        if not perfil or perfil.rol == 'admin' or user.is_staff:
            return queryset

        if perfil.rol in ['director', 'jefe_estudios'] and perfil.carrera:
            docentes_carrera = Docente.objects.filter(fondos_tiempo__carrera=perfil.carrera).distinct()
            return queryset.filter(docente__in=docentes_carrera)

        if perfil.rol == 'docente' and perfil.docente:
            return queryset.filter(docente=perfil.docente)

        return queryset.none()
    
    def _validar_estado_fondo(self, docente, calendario):
        """Valida que el fondo esté en estado editable (borrador/observado)"""
        fondo = FondoTiempo.objects.filter(
            docente=docente, 
            calendario_academico=calendario,
            archivado=False
        ).first()
        
        if fondo and fondo.estado not in ['borrador', 'observado']:
            raise PermissionDenied(f"No se puede modificar la carga horaria. El fondo está en estado '{fondo.get_estado_display()}'.")

    def perform_create(self, serializer):
        self._validar_estado_fondo(serializer.validated_data['docente'], serializer.validated_data['calendario'])
        serializer.save()

    def perform_update(self, serializer):
        instance = self.get_object()
        docente = serializer.validated_data.get('docente', instance.docente)
        calendario = serializer.validated_data.get('calendario', instance.calendario)
        self._validar_estado_fondo(docente, calendario)
        serializer.save()

    def perform_destroy(self, instance):
        self._validar_estado_fondo(instance.docente, instance.calendario)
        instance.delete()

# =====================================================
# CALENDARIO ACADÉMICO VIEWSET
# =====================================================

class CalendarioAcademicoViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar calendarios académicos"""
    queryset = CalendarioAcademico.objects.all()
    serializer_class = CalendarioAcademicoSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['gestion', 'periodo']
    ordering = ['-gestion', '-periodo']
    
    def get_permissions(self):
        """Solo admins pueden crear, editar y eliminar calendarios"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsFullAdmin()]
        return [IsAuthenticated()]

    def _build_dependency_counts(self, calendario):
        fondos_qs = FondoTiempo.objects.filter(calendario_academico=calendario)
        fondos_count = fondos_qs.count()
        informes_count = InformeFondo.objects.filter(fondo_tiempo__in=fondos_qs).count()
        cargas_horarias_count = CargaHoraria.objects.filter(calendario=calendario).count()

        return {
            'planificaciones': fondos_count,
            'informes': informes_count,
            'cargas_horarias': cargas_horarias_count,
            'can_delete': fondos_count == 0 and informes_count == 0 and cargas_horarias_count == 0,
        }

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def dependencias(self, request, pk=None):
        calendario = self.get_object()
        counts = self._build_dependency_counts(calendario)
        return Response(counts, status=status.HTTP_200_OK)
    
    def destroy(self, request, *args, **kwargs):
        """Eliminar calendario respetando integridad referencial (PROTECT)."""
        instance = self.get_object()
        try:
            instance.delete()
            return Response({'detail': 'Calendario eliminado correctamente.'}, status=status.HTTP_200_OK)
        except ProtectedError:
            counts = self._build_dependency_counts(instance)
            return Response(
                {
                    'code': 'protected_error',
                    'detail': (
                        f"ERROR DE INTEGRIDAD: No se puede eliminar el calendario {instance.gestion}-{instance.get_periodo_display()} "
                        f"porque tiene {counts['planificaciones']} planificaciones y {counts['informes']} informes vinculados."
                    ),
                    'dependencias': counts,
                },
                status=status.HTTP_409_CONFLICT
            )
        except IntegrityError:
            counts = self._build_dependency_counts(instance)
            return Response(
                {
                    'code': 'integrity_error',
                    'detail': 'No se puede eliminar el calendario por integridad referencial.',
                    'dependencias': counts,
                },
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def activo(self, request):
        """Obtener el calendario académico activo"""
        calendario = CalendarioAcademico.objects.filter(activo=True).first()
        if calendario:
            serializer = self.get_serializer(calendario)
            return Response(serializer.data)
        return Response(
            {'error': 'No hay un calendario académico activo'},
            status=status.HTTP_404_NOT_FOUND
        )


class FondoTiempoViewSet(viewsets.ModelViewSet):
    """
    ViewSet con sistema híbrido de permisos:
    - Admin: puede editar solo borradores, cambiar estados, archivar
    - Docente: puede editar solo sus borradores
    """
    queryset = FondoTiempo.objects.select_related(
        'docente', 'carrera', 'calendario_academico', 'aprobado_por', 'validado_por'
    ).prefetch_related('categorias__actividades', 'proyectos', 'observaciones_detalladas')
    serializer_class = FondoTiempoSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """
        Filtrar fondos según el usuario:
        - Admin: ve todos.
        - Director/Jefe de Estudios: ve todos los de su carrera.
        - Docente: solo ve los suyos.
        """
        queryset = super().get_queryset().filter(archivado=False)
        user = self.request.user
        try:
            perfil = user.perfil
        except Exception:
            perfil = None

        # Permitir que superusuarios vean todo siempre (evita problemas si su rol es 'docente' por defecto)
        if user.is_superuser:
            return queryset

        if not perfil:
            return queryset.none()

        # Admin ve todo
        if perfil.rol == 'admin':
            return queryset

        # Director y Jefe de Estudios ven los de su carrera
        if perfil.rol in ['director', 'jefe_estudios']:
            if perfil.carrera:
                return queryset.filter(carrera=perfil.carrera)
            return queryset.none()

        # Docente ve solo los suyos
        if perfil.rol == 'docente':
            if perfil.docente:
                return queryset.filter(docente=perfil.docente)
            return queryset.none()

        return queryset
    
    def get_object(self):
        """
        Permitir acceso a fondos archivados para acciones específicas
        (retrieve, restaurar, destroy)
        """
        # 1. Definir Queryset Base SIN Prefetch inicial (para evitar caché obsoleto)
        queryset = FondoTiempo.objects.select_related(
            'docente', 'carrera', 'calendario_academico', 'aprobado_por', 'validado_por'
        )
        
        # 2. Aplicar filtros según la acción
        if self.action in ['retrieve', 'restaurar', 'destroy', 'generar_pdf_oficial']:
            # Acciones que permiten ver archivados (con validación de dueño)
            if not self.request.user.is_staff:
                if hasattr(self.request.user, 'perfil') and self.request.user.perfil.docente:
                    queryset = queryset.filter(docente=self.request.user.perfil.docente)
                else:
                    queryset = queryset.none()
        else:
            # Acciones estándar: NO mostrar archivados
            queryset = queryset.filter(archivado=False)
            
            # Replicar lógica de permisos de get_queryset para consistencia
            user = self.request.user
            try:
                perfil = user.perfil
            except Exception:
                perfil = None

            if not perfil:
                queryset = queryset.none()
            elif perfil.rol == 'admin':
                pass
            elif perfil.rol in ['director', 'jefe_estudios']:
                if perfil.carrera:
                    queryset = queryset.filter(carrera=perfil.carrera)
                else:
                    queryset = queryset.none()
            elif perfil.rol == 'docente':
                if perfil.docente:
                    queryset = queryset.filter(docente=perfil.docente)
                else:
                    queryset = queryset.none()
            elif user.is_staff:
                pass
        
        # Obtener el objeto por pk
        obj = get_object_or_404(queryset, pk=self.kwargs.get('pk'))
        
        # Verificar permisos de objeto
        self.check_object_permissions(self.request, obj)

        # CORRECCIÓN DE RAÍZ: Asegurar que existan las categorías para que se vea la carga de Jefatura
        self._asegurar_categorias(obj)
        
        # AHORA hacemos el prefetch manual para incluir las categorías recién creadas
        prefetch_related_objects([obj], 
            'categorias',
            Prefetch('categorias__actividades', queryset=Actividad.objects.all().order_by('orden', 'id')),
            'proyectos', 'informes', 'observaciones_detalladas'
        )
        
        return obj
    
    def _asegurar_categorias(self, fondo):
        """Garantiza que el fondo tenga las 7 categorías creadas para recibir carga horaria."""
        tipos_requeridos = [
            'docente', 'investigacion', 'extension', 'asesorias', 
            'tribunales', 'administrativo', 'vida_universitaria'
        ]
        existentes = set(fondo.categorias.values_list('tipo', flat=True))
        for tipo in tipos_requeridos:
            if tipo not in existentes:
                CategoriaFuncion.objects.create(fondo_tiempo=fondo, tipo=tipo)

    def get_serializer_class(self):
        if self.action == 'list':
            return FondoTiempoListSerializer
        elif self.action == 'retrieve':
            return FondoTiempoDetalleSerializer
        return FondoTiempoSerializer

    def _flatten_validation_messages(self, detail):
        if isinstance(detail, dict):
            messages = []
            for value in detail.values():
                nested = self._flatten_validation_messages(value)
                if nested:
                    messages.append(nested)
            return ' '.join([m for m in messages if m]).strip()
        if isinstance(detail, list):
            messages = [self._flatten_validation_messages(item) for item in detail]
            return ' '.join([m for m in messages if m]).strip()
        return str(detail) if detail is not None else ''

    def _validation_error_response(self, detail):
        message = self._flatten_validation_messages(detail) or 'Error de validación en los datos enviados.'
        return Response({'error': message, 'details': detail}, status=status.HTTP_400_BAD_REQUEST)
    
    def create(self, request, *args, **kwargs):
        """
        Aplica reglas de negocio para la creación de Fondos de Tiempo.
        Según Reglamento (Art. 9, 14), la creación es responsabilidad de Jefatura/Admin, no del Docente.
        """
        user = self.request.user
        try:
            perfil = user.perfil
        except Exception:
            perfil = None

        # 1. Permitir Admin/Superuser
        if user.is_superuser or (perfil and perfil.rol == 'admin'):
            pass
        # 2. Bloquear a Docentes
        elif perfil and perfil.rol == 'docente':
             raise PermissionDenied("Los docentes no pueden crear Fondos de Tiempo. Esta tarea corresponde a Jefatura de Estudios.")
        # 3. Bloquear usuarios sin perfil
        elif not perfil:
             raise PermissionDenied("El usuario no tiene un perfil asignado.")

        # Validación de Calendario
        if not CalendarioAcademico.objects.filter(activo=True).exists():
            return Response(
                {'error': 'No existe un periodo académico activo para iniciar la planificación.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
        except drf_serializers.ValidationError as exc:
            return self._validation_error_response(exc.detail)
        except DjangoValidationError as exc:
            detail = getattr(exc, 'message_dict', None) or getattr(exc, 'messages', None) or str(exc)
            return self._validation_error_response(detail)
        except IntegrityError as exc:
            return self._validation_error_response(str(exc))

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        """Al crear un fondo, se asocia al calendario activo. El docente viene en el payload."""
        calendario_activo = CalendarioAcademico.objects.get(activo=True)
        
        # Ya no forzamos el docente del usuario logueado.
        # El serializer valida que 'docente' venga en el request.
        fondo = serializer.save(calendario_academico=calendario_activo)
        
        # CORRECCIÓN DE RAÍZ: Crear inmediatamente las categorías vacías
        tipos = [
            'docente', 'investigacion', 'extension', 'asesorias', 
            'tribunales', 'administrativo', 'vida_universitaria'
        ]
        for tipo in tipos:
            CategoriaFuncion.objects.create(fondo_tiempo=fondo, tipo=tipo)

    def update(self, request, *args, **kwargs):
        """Verificar permisos de edición"""
        instance = self.get_object()
        
        if not instance.puede_editar(request.user):
            raise PermissionDenied(
                "Acción no permitida. Solo el docente dueño (en estado borrador/observado/en_ejecucion) o un administrador pueden editar."
            )
        
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        try:
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
        except drf_serializers.ValidationError as exc:
            return self._validation_error_response(exc.detail)
        except DjangoValidationError as exc:
            detail = getattr(exc, 'message_dict', None) or getattr(exc, 'messages', None) or str(exc)
            return self._validation_error_response(detail)
        except IntegrityError as exc:
            return self._validation_error_response(str(exc))

        return Response(serializer.data)
    
    def partial_update(self, request, *args, **kwargs):
        """Verificar permisos de edición parcial"""
        instance = self.get_object()
        
        if not instance.puede_editar(request.user):
            raise PermissionDenied(
                "Acción no permitida. Solo el docente dueño (en estado borrador/observado/en_ejecucion) o un administrador pueden editar."
            )
        
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        """
        No se elimina realmente, se archiva
        Solo admin puede archivar
        """
        instance = self.get_object()
        
        if not instance.puede_archivar(request.user):
            raise PermissionDenied("Solo administradores pueden archivar fondos")
        
        # Archivar en lugar de eliminar
        instance.archivado = True
        instance.save()
        
        return Response(
            {'message': 'Fondo archivado correctamente'},
            status=status.HTTP_200_OK
        )
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def cambiar_estado(self, request, pk=None):
        """
        Cambiar estado del fondo (solo admin/director/jefe_estudios según permisos)
        Estados: borrador → revision → aprobado → validado
        
        Permisos especiales:
        - 'observado': Solo jefe_estudios o admin
        """
        fondo = self.get_object()
        nuevo_estado = request.data.get('estado')
        comentarios = request.data.get('comentarios', '')
        
        # Validar permisos (incluyendo validación para 'observado')
        if not fondo.puede_cambiar_estado(request.user, nuevo_estado):
            raise PermissionDenied(
                f"No tiene permisos para cambiar el estado a '{nuevo_estado}'. "
                f"Solo jefe_estudios o admin pueden cambiar a 'observado'."
            )
        
        estados_validos = [choice[0] for choice in FondoTiempo.ESTADO_CHOICES]
        if nuevo_estado not in estados_validos:
            return Response(
                {'error': f'Estado inválido. Válidos: {estados_validos}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Actualizar estado y registrar quién lo hizo
        fondo.estado = nuevo_estado
        
        if comentarios:
            if fondo.comentarios_admin:
                fondo.comentarios_admin += f"\n\n[{request.user.username}]: {comentarios}"
            else:
                fondo.comentarios_admin = f"[{request.user.username}]: {comentarios}"
        
        # Registrar quién aprobó/validó
        if nuevo_estado == 'aprobado_director' and not fondo.aprobado_por:
            fondo.aprobado_por = request.user
        elif nuevo_estado == 'validado' and not fondo.validado_por:
            fondo.validado_por = request.user
        
        fondo.save()
        
        serializer = self.get_serializer(fondo)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def agregar_comentario(self, request, pk=None):
        """Agregar comentario administrativo"""
        fondo = self.get_object()
        comentario = request.data.get('comentario', '')
        
        if not comentario:
            return Response(
                {'error': 'El comentario no puede estar vacío'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if fondo.comentarios_admin:
            fondo.comentarios_admin += f"\n\n[{request.user.username}]: {comentario}"
        else:
            fondo.comentarios_admin = f"[{request.user.username}]: {comentario}"
        
        fondo.save()
        
        serializer = self.get_serializer(fondo)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def comparar(self, request):
        """Endpoint para comparar fondos de tiempo entre gestiones"""
        docente_id = request.query_params.get('docente')
        gestion1 = request.query_params.get('gestion1')
        gestion2 = request.query_params.get('gestion2')
        
        if not all([docente_id, gestion1, gestion2]):
            return Response({
                'error': 'Se requieren los parámetros: docente, gestion1, gestion2'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        fondos = FondoTiempo.objects.filter(
            docente_id=docente_id,
            gestion__in=[gestion1, gestion2],
            archivado=False
        ).select_related('docente', 'carrera').prefetch_related(
            Prefetch('categorias__actividades', queryset=Actividad.objects.all())
        )
        
        serializer = self.get_serializer(fondos, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def archivados(self, request):
        """
        Ver fondos archivados.
        - Docentes ven solo sus fondos archivados.
        - Admins ven todos los fondos archivados.
        """
        queryset = FondoTiempo.objects.filter(archivado=True).select_related('docente', 'carrera')

        if not request.user.is_staff:
            if hasattr(request.user, 'perfil') and request.user.perfil.docente:
                queryset = queryset.filter(docente=request.user.perfil.docente)
            else:
                # If user is not staff and not a teacher, they see no archived funds.
                queryset = queryset.none()
        
        # Admins will see the full queryset
        
        serializer = FondoTiempoListSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def restaurar(self, request, pk=None):
        """Restaurar un fondo archivado (solo admin)"""
        fondo = self.get_object()
        
        if not fondo.archivado:
            return Response(
                {'error': 'Este fondo no está archivado'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        fondo.archivado = False
        fondo.save()
        
        serializer = self.get_serializer(fondo)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='largo-plazo')
    def largo_plazo(self, request):
        """
        Obtener fondos de tiempo a largo plazo.
        """
        queryset = self.get_queryset().filter(tipo_fondo='largo_plazo')
        
        # Aplicar paginación
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = FondoTiempoListSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)

        serializer = FondoTiempoListSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)
    
    # NUEVAS ACCIONES SEGÚN REGLAMENTO UAB
    
    @action(detail=True, methods=['post'])
    @transaction.atomic
    def presentar(self, request, pk=None):
        """Presentar fondo a Director de Carrera (Art. 18)"""
        fondo = self.get_object()
        
        # Verificar que sea el docente dueño del fondo
        if not self.request.user.is_staff:
            if hasattr(self.request.user, 'perfil') and self.request.user.perfil.docente:
                if fondo.docente != self.request.user.perfil.docente:
                    raise PermissionDenied("No puede presentar fondos de otros docentes")
            else:
                raise PermissionDenied("Usuario no tiene docente asignado")
        
        # LÓGICA FLEXIBLE: Manejo de estados
        if fondo.estado == 'en_ejecucion':
            # Obtener datos del informe final
            resumen = request.data.get('resumen', '').strip()
            logros = request.data.get('logros', '').strip()
            dificultades = request.data.get('dificultades', '').strip()
            conclusiones = request.data.get('conclusiones', '').strip()

            # Transición directa para informe (Modo Flexible)
            estado_anterior = fondo.estado
            fondo.estado = 'informe_presentado'
            fondo.fecha_informe = timezone.now()
            fondo.save()

            # Crear o actualizar el informe con datos reales
            InformeFondo.objects.update_or_create(
                fondo_tiempo=fondo,
                tipo='parcial',
                defaults={
                    'elaborado_por': request.user,
                    'resumen_ejecutivo': resumen or "Sin resumen",
                    'actividades_realizadas': resumen or "Ver resumen ejecutivo", # Mapeo por defecto
                    'logros': logros or "Sin logros registrados",
                    'dificultades': dificultades or "Sin dificultades registradas",
                    'resultados': conclusiones or "Sin conclusiones", # Mapeamos conclusiones a resultados
                    'fecha_elaboracion': timezone.now().date()
                }
            )

            # Registrar en historial
            HistorialFondo.objects.create(
                fondo_tiempo=fondo,
                usuario=request.user,
                tipo_cambio='informe_presentado',
                descripcion='Docente presentó Informe Final de cumplimiento.',
                estado_anterior=estado_anterior,
                estado_nuevo='informe_presentado'
            )
            
            return Response({'message': 'Informe presentado exitosamente'})

        serializer = PresentarFondoSerializer(data=request.data, context={'fondo': fondo})
        serializer.is_valid(raise_exception=True)
        
        # Cambiar estado
        fondo.estado = 'presentado_jefe'
        fondo.fecha_presentacion = timezone.now()
        fondo.save()
        
        # Registrar en historial
        HistorialFondo.objects.create(
            fondo_tiempo=fondo,
            usuario=request.user,
            tipo_cambio='presentacion',
            descripcion='Fondo presentado a Jefe de Estudios para revisión técnica.',
            estado_anterior='borrador',
            estado_nuevo='presentado_jefe'
        )
        
        output_serializer = FondoTiempoDetalleSerializer(fondo, context={'request': request})
        return Response(output_serializer.data)
    
    @action(detail=True, methods=['patch'], url_path='presentar-a-director')
    def presentar_a_director(self, request, pk=None):
        """
        Endpoint para presentar fondo directamente a Director.
        """
        fondo = self.get_object()
        
        if fondo.estado == 'borrador':
            fondo.estado = 'presentado_director'
            fondo.fecha_presentacion = timezone.now()
            fondo.save()
            return Response({'status': 'Fondo presentado correctamente'}, status=status.HTTP_200_OK)
        return Response({'error': 'Solo se pueden presentar fondos en estado borrador'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    @transaction.atomic
    def aprobar(self, request, pk=None):
        """Aprobar fondo (Director)"""
        # MEJORA: Solo un Director debería poder aprobar, no un Admin genérico.
        if not (hasattr(request.user, 'perfil') and request.user.perfil.rol == 'director'):
            raise PermissionDenied("Solo los Directores de Carrera pueden aprobar fondos.")

        fondo = self.get_object()
        
        # Un director puede aprobar fondos presentados o que él mismo haya observado y el docente corrigió.
        if fondo.estado != 'presentado_director':
            return Response(
                {'error': f'Solo se pueden aprobar fondos en estado "Presentado a Director". Estado actual: {fondo.get_estado_display()}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = AprobarFondoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Cambiar estado
        estado_anterior = fondo.estado
        fondo.estado = 'aprobado_director'
        fondo.fecha_aprobacion = timezone.now()
        fondo.aprobado_por = request.user
        
        observacion = serializer.validated_data.get('observacion', '')
        if observacion:
            if fondo.comentarios_admin:
                fondo.comentarios_admin += f"\n\n[Aprobación - {request.user.username}]: {observacion}"
            else:
                fondo.comentarios_admin = f"[Aprobación - {request.user.username}]: {observacion}"
        
        fondo.save()
        
        # Registrar en historial
        HistorialFondo.objects.create(
            fondo_tiempo=fondo,
            usuario=request.user,
            tipo_cambio='aprobacion',
            descripcion=f'Fondo aprobado por Director. {observacion}',
            estado_anterior=estado_anterior,
            estado_nuevo='aprobado_director'
        )
        
        output_serializer = FondoTiempoDetalleSerializer(fondo, context={'request': request})
        return Response(output_serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    @transaction.atomic
    def observar(self, request, pk=None):
        """Observar o rechazar fondo (Director)"""
        try:
            # MEJORA: Solo un Director debería poder observar, no un Admin genérico.
            if not (hasattr(request.user, 'perfil') and request.user.perfil.rol == 'director'):
                raise PermissionDenied("Solo los Directores de Carrera pueden observar fondos.")

            fondo = self.get_object()

            if fondo.estado != 'presentado_director':
                return Response(
                    {'error': f'Solo se pueden observar fondos en estado "Presentado a Director". Estado actual: {fondo.get_estado_display()}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            serializer = ObservarFondoSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            accion = serializer.validated_data['accion']
            observacion_texto = serializer.validated_data['observacion']
            
            # Crear hilo de observación con primer mensaje
            observacion = ObservacionFondo.objects.create(
                fondo_tiempo_id=fondo.id, # Usar ID explícito para evitar problemas de referencia
                resuelta=False
            )
            
            # Crear primer mensaje del admin
            MensajeObservacion.objects.create(
                observacion=observacion,
                autor=request.user,
                texto=observacion_texto,
                es_admin=True # Director es una autoridad
            )
            
            # Cambiar estado
            estado_anterior = fondo.estado
            if accion == 'observar':
                fondo.estado = 'observado'
                tipo_cambio = 'observacion'
                descripcion = 'Fondo observado por Director'
            else:  # rechazar
                fondo.estado = 'rechazado'
                tipo_cambio = 'rechazo'
                descripcion = 'Fondo rechazado por Director'
            
            fondo.save()
            
            # Registrar en historial
            HistorialFondo.objects.create(
                fondo_tiempo=fondo,
                usuario=request.user,
                tipo_cambio=tipo_cambio,
                descripcion=f'{descripcion}: {observacion_texto}',
                estado_anterior=estado_anterior,
                estado_nuevo=fondo.estado
            )
            
            return Response(self.get_serializer(fondo).data)
            
        except Exception as e:
            # Si es una excepción de validación de DRF, la dejamos pasar para que el frontend la maneje
            if hasattr(e, 'detail'):
                raise e
            # Si es otro error interno, lo capturamos y devolvemos el detalle
            transaction.set_rollback(True)
            return Response(
                {'error': f'Error interno al procesar la observación: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'], url_path='validar-jefe')
    @transaction.atomic
    def validar_jefe(self, request, pk=None):
        """Jefe de Estudios valida el fondo y lo pasa al Director."""
        fondo = self.get_object()
        user = request.user
        try:
            perfil = user.perfil
        except Exception:
            perfil = None

        # Permission check
        if not (perfil and perfil.rol == 'jefe_estudios' and perfil.carrera == fondo.carrera):
            raise PermissionDenied("Solo el Jefe de Estudios de la carrera puede validar este fondo.")

        if fondo.estado != 'presentado_jefe':
            return Response(
                {'error': f'Solo se pueden validar fondos en estado "Presentado a Jefe de Estudios". Estado actual: {fondo.get_estado_display()}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Change state
        estado_anterior = fondo.estado
        fondo.estado = 'presentado_director'
        fondo.validado_por = user
        fondo.fecha_validacion = timezone.now()
        fondo.save()

        # Add to history
        HistorialFondo.objects.create(
            fondo_tiempo=fondo,
            usuario=user,
            tipo_cambio='validacion',
            descripcion='Fondo validado por Jefe de Estudios y enviado a Director.',
            estado_anterior=estado_anterior,
            estado_nuevo=fondo.estado
        )

        serializer = FondoTiempoDetalleSerializer(fondo, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='observar-jefe')
    @transaction.atomic
    def observar_jefe(self, request, pk=None):
        """Jefe de Estudios observa el fondo y lo devuelve al docente."""
        fondo = self.get_object()
        user = request.user
        try:
            perfil = user.perfil
        except Exception:
            perfil = None

        # Permission check
        if not (perfil and perfil.rol == 'jefe_estudios' and perfil.carrera == fondo.carrera):
            raise PermissionDenied("Solo el Jefe de Estudios de la carrera puede observar este fondo.")

        if fondo.estado != 'presentado_jefe':
            return Response(
                {'error': f'Solo se pueden observar fondos en estado "Presentado a Jefe de Estudios". Estado actual: {fondo.get_estado_display()}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Usamos el mismo serializer que el director, pero ignoramos la acción 'rechazar'
        serializer = ObservarFondoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        observacion_texto = serializer.validated_data['observacion']

        # Create observation thread
        observacion = ObservacionFondo.objects.create(fondo_tiempo=fondo)
        MensajeObservacion.objects.create(
            observacion=observacion,
            autor=user,
            texto=observacion_texto,
            es_admin=True # Lo marcamos como autoridad para diferenciarlo del docente en el chat
        )

        # Change state
        estado_anterior = fondo.estado
        fondo.estado = 'observado'
        fondo.save()

        # Add to history
        HistorialFondo.objects.create(
            fondo_tiempo=fondo,
            usuario=user,
            tipo_cambio='observacion',
            descripcion=f'Fondo observado por Jefe de Estudios: {observacion_texto}',
            estado_anterior=estado_anterior,
            estado_nuevo=fondo.estado
        )

        serializer = FondoTiempoDetalleSerializer(fondo, context={'request': request})
        return Response(serializer.data)

    # =====================================================
    # NUEVAS ACCIONES PARA COMPLETAR FLUJO DE ESTADOS
    # =====================================================

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    @transaction.atomic
    def iniciar_ejecucion(self, request, pk=None):
        """
        Iniciar ejecución del fondo (cuando comienza el semestre)
        Solo admin/director puede hacerlo
        Estado: aprobado_director → en_ejecucion
        """
        fondo = self.get_object()
        
        # Validar estado actual
        if fondo.estado != 'aprobado_director':
            return Response(
                {'error': f'Solo se pueden iniciar fondos aprobados. Estado actual: {fondo.get_estado_display()}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Cambiar estado
        estado_anterior = fondo.estado
        fondo.estado = 'en_ejecucion'
        fondo.fecha_inicio_ejecucion = timezone.now()
        fondo.save()
        
        # Registrar en historial
        HistorialFondo.objects.create(
            fondo_tiempo=fondo,
            usuario=request.user,
            tipo_cambio='inicio_ejecucion',
            descripcion='Fondo iniciado - Semestre en curso',
            estado_anterior=estado_anterior,
            estado_nuevo=fondo.estado
        )
        
        output_serializer = FondoTiempoDetalleSerializer(fondo, context={'request': request})
        return Response(output_serializer.data)


    @action(detail=True, methods=['post'], url_path='presentar-informe')
    @transaction.atomic
    def presentar_informe(self, request, pk=None):
        """
        Presentar informe de cumplimiento al finalizar el semestre
        Solo el docente puede hacerlo
        Estado: en_ejecucion → informe_presentado
        """
        fondo = self.get_object()
        
        # Verificar que sea el docente dueño del fondo
        if not self.request.user.is_staff:
            if hasattr(self.request.user, 'perfil') and self.request.user.perfil.docente:
                if fondo.docente != self.request.user.perfil.docente:
                    raise PermissionDenied("No puede presentar informes de otros docentes")
            else:
                raise PermissionDenied("Usuario no tiene docente asignado")
        
        # Validar estado actual
        if fondo.estado != 'en_ejecucion':
            return Response(
                {'error': f'Solo se pueden presentar informes de fondos en ejecución. Estado actual: {fondo.get_estado_display()}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validar datos del informe
        actividades_realizadas = request.data.get('actividades_realizadas', '').strip()
        logros = request.data.get('logros', '').strip()
        dificultades = request.data.get('dificultades', '').strip()
        archivo_adjunto = request.FILES.get('archivo_adjunto', None)
        
        if not actividades_realizadas or len(actividades_realizadas) < 50:
            return Response(
                {'error': 'Debe describir las actividades realizadas (mínimo 50 caracteres)'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not logros or len(logros) < 30:
            return Response(
                {'error': 'Debe describir los logros alcanzados (mínimo 30 caracteres)'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Crear el informe
        informe = InformeFondo.objects.create(
            fondo_tiempo=fondo,
            tipo='parcial',
            actividades_realizadas=actividades_realizadas,
            logros=logros,
            dificultades=dificultades,
            elaborado_por=request.user,
            fecha_elaboracion=timezone.now().date(),
            archivo_adjunto=archivo_adjunto
        )
        
        # Cambiar estado del fondo
        estado_anterior = fondo.estado
        fondo.estado = 'informe_presentado'
        fondo.fecha_informe = timezone.now()
        fondo.save()
        
        # Registrar en historial
        HistorialFondo.objects.create(
            fondo_tiempo=fondo,
            usuario=request.user,
            tipo_cambio='informe_presentado',
            descripcion=f'Docente presentó informe de cumplimiento (ID: {informe.id})',
            estado_anterior=estado_anterior,
            estado_nuevo=fondo.estado
        )
        
        output_serializer = FondoTiempoDetalleSerializer(fondo, context={'request': request})
        return Response({
            'fondo': output_serializer.data,
            'informe_id': informe.id,
            'message': 'Informe presentado exitosamente'
        })


    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated], url_path='evaluar-y-finalizar')
    @transaction.atomic
    def evaluar_y_finalizar(self, request, pk=None):
        """
        Evaluar informe y finalizar el ciclo del fondo
        Solo el Director de Carrera puede hacerlo (Art. 19)
        Estado: informe_presentado → finalizado
        """
        fondo = self.get_object()
        user = request.user
        try:
            perfil = user.perfil
        except Exception:
            perfil = None

        # REGLA: Solo el Director de la carrera correspondiente puede evaluar.
        if not (perfil and perfil.rol == 'director' and perfil.carrera == fondo.carrera):
            raise PermissionDenied("Solo el Director de la carrera correspondiente puede evaluar y finalizar el fondo.")
        
        # Validar estado actual
        if fondo.estado != 'informe_presentado':
            return Response(
                {'error': f'Solo se pueden evaluar fondos con informe presentado. Estado actual: {fondo.get_estado_display()}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validar que exista al menos un informe
        informe = fondo.informes.filter(tipo='parcial').order_by('-fecha_elaboracion').first()
        if not informe:
            return Response(
                {'error': 'No se encontró informe asociado al fondo'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validar datos de evaluación
        cumplimiento = request.data.get('cumplimiento', '').strip()
        evaluacion_director = request.data.get('evaluacion_director', '').strip()
        
        cumplimientos_validos = ['cumplido', 'parcial', 'incumplido']
        if cumplimiento not in cumplimientos_validos:
            return Response(
                {'error': f'Cumplimiento inválido. Valores válidos: {", ".join(cumplimientos_validos)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not evaluacion_director or len(evaluacion_director) < 30:
            return Response(
                {'error': 'Debe proporcionar una evaluación detallada (mínimo 30 caracteres)'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Actualizar el informe con la evaluación
        informe.cumplimiento = cumplimiento
        informe.evaluacion_director = evaluacion_director
        informe.evaluado_por = request.user
        informe.fecha_evaluacion = timezone.now().date()
        informe.save()
        
        # Cambiar estado del fondo a finalizado
        estado_anterior = fondo.estado
        fondo.estado = 'finalizado'
        fondo.fecha_finalizacion = timezone.now()
        fondo.save()
        
        # Registrar en historial
        HistorialFondo.objects.create(
            fondo_tiempo=fondo,
            usuario=request.user,
            tipo_cambio='finalizacion',
            descripcion=f'Fondo evaluado y finalizado - Cumplimiento: {cumplimiento}',
            estado_anterior=estado_anterior,
            estado_nuevo=fondo.estado
        )
        
        output_serializer = FondoTiempoDetalleSerializer(fondo, context={'request': request})
        return Response({
            'fondo': output_serializer.data,
            'informe_id': informe.id,
            'cumplimiento': cumplimiento,
            'message': 'Fondo evaluado y finalizado exitosamente'
        })

    @action(detail=True, methods=['get'], url_path='pdf-oficial')
    def generar_pdf_oficial(self, request, pk=None):
        try:
            fondo = self.get_object()
            
            # 1. Generar el buffer (Llama a tu generador en utils)
            buffer = FondoPDFGenerator.generar_reporte_individual(fondo)
            
            # 2. CONSTRUIR NOMBRE DESCRIPTIVO (Sugerencia de tu AI mejorada)
            # Limpiamos el nombre del docente (cambiamos espacios por guiones bajos)
            nombre_docente = "Docente"
            if fondo.docente:
                nombre_docente = fondo.docente.nombre_completo.replace(" ", "_")
            
            # Obtenemos la gestión (año)
            gestion = fondo.gestion
            
            # Construimos el nombre final: Ej. Fondo_Victor_Cruz_2026.pdf
            # (Si tienes un campo 'periodo', puedes agregarlo al f-string también)
            nombre_archivo = f"Fondo_{nombre_docente}_{gestion}.pdf"

            # 3. RETORNAR ARCHIVO
            # as_attachment=True fuerza la descarga con el nombre que definimos arriba
            return FileResponse(buffer, as_attachment=True, filename=nombre_archivo)

        except Exception as e:
            print(f"❌ ERROR PDF: {e}")
            import traceback
            traceback.print_exc()
            return HttpResponse(f"Error crítico: {str(e)}", status=500)
        
class CategoriaFuncionViewSet(viewsets.ModelViewSet):
    queryset = CategoriaFuncion.objects.all()
    serializer_class = CategoriaFuncionSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['fondo_tiempo', 'tipo']


class ActividadViewSet(viewsets.ModelViewSet):
    queryset = Actividad.objects.all()
    serializer_class = ActividadSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['categoria', 'categoria__fondo_tiempo', 'proyecto']
    search_fields = ['detalle', 'evidencias']

    def get_queryset(self):
        """
        Asegurar que se retornen todas las actividades sin filtros ocultos.
        """
        return Actividad.objects.all()


# =====================================================
# PROYECTO VIEWSET
# =====================================================

class ProyectoViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar proyectos (Art. 14-17)"""
    queryset = Proyecto.objects.select_related(
        'fondo_tiempo', 'categoria', 'fondo_tiempo__docente'
    ).all()
    serializer_class = ProyectoSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['tipo', 'estado', 'fondo_tiempo', 'categoria']
    search_fields = ['titulo', 'antecedentes', 'objetivos']
    ordering_fields = ['fecha_creacion', 'fecha_inicio']
    ordering = ['-fecha_creacion']
    
    def get_queryset(self):
        """Filtrar proyectos según el usuario"""
        queryset = super().get_queryset()
        
        # Si no es admin, solo ver sus proyectos
        if not self.request.user.is_staff:
            if hasattr(self.request.user, 'perfil') and self.request.user.perfil.docente:
                queryset = queryset.filter(fondo_tiempo__docente=self.request.user.perfil.docente)
            else:
                queryset = queryset.none()
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'list':
            return ProyectoListSerializer
        return ProyectoSerializer
    
    def perform_create(self, serializer):
        """Validar que el fondo pertenece al docente"""
        fondo = serializer.validated_data.get('fondo_tiempo')
        
        if not self.request.user.is_staff:
            if hasattr(self.request.user, 'perfil') and self.request.user.perfil.docente:
                if fondo.docente != self.request.user.perfil.docente:
                    raise PermissionDenied("No puede crear proyectos para otros docentes")
            else:
                raise PermissionDenied("Usuario no tiene docente asignado")
        
        serializer.save()
    
    @action(detail=True, methods=['post'])
    def cambiar_estado(self, request, pk=None):
        """Cambiar estado del proyecto"""
        proyecto = self.get_object()
        nuevo_estado = request.data.get('estado')
        
        estados_validos = ['borrador', 'presentado', 'aprobado', 'en_ejecucion', 'finalizado', 'observado']
        if nuevo_estado not in estados_validos:
            return Response(
                {'error': f'Estado inválido. Válidos: {estados_validos}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        proyecto.estado = nuevo_estado
        
        # Registrar fechas automáticamente
        if nuevo_estado == 'presentado' and not proyecto.fecha_presentacion:
            proyecto.fecha_presentacion = timezone.now().date()
        elif nuevo_estado == 'aprobado' and not proyecto.fecha_aprobacion:
            proyecto.fecha_aprobacion = timezone.now().date()
        
        proyecto.save()
        
        serializer = self.get_serializer(proyecto)
        return Response(serializer.data)


# =====================================================
# INFORME FONDO VIEWSET
# =====================================================

class InformeFondoViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar informes (Art. 28)"""
    queryset = InformeFondo.objects.select_related(
        'fondo_tiempo', 'elaborado_por', 'evaluado_por',
        'fondo_tiempo__docente'
    ).all()
    serializer_class = InformeFondoSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['tipo', 'cumplimiento', 'fondo_tiempo']
    ordering_fields = ['fecha_elaboracion', 'fecha_evaluacion']
    ordering = ['-fecha_elaboracion']
    
    def get_queryset(self):
        """Filtrar informes según el usuario"""
        queryset = super().get_queryset()
        
        # Si no es admin, solo ver sus informes
        if not self.request.user.is_staff:
            if hasattr(self.request.user, 'perfil') and self.request.user.perfil.docente:
                queryset = queryset.filter(fondo_tiempo__docente=self.request.user.perfil.docente)
            else:
                queryset = queryset.none()
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'list':
            return InformeFondoListSerializer
        return InformeFondoSerializer
    
    def perform_create(self, serializer):
        """Asociar informe al usuario que lo crea"""
        serializer.save(elaborado_por=self.request.user)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def evaluar(self, request, pk=None):
        """Evaluar informe (Director)"""
        informe = self.get_object()
        cumplimiento = request.data.get('cumplimiento')
        evaluacion = request.data.get('evaluacion_director', '')
        
        cumplimientos_validos = ['cumplido', 'parcial', 'incumplido']
        if cumplimiento not in cumplimientos_validos:
            return Response(
                {'error': f'Cumplimiento inválido. Válidos: {cumplimientos_validos}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        informe.cumplimiento = cumplimiento
        informe.evaluacion_director = evaluacion
        informe.fecha_evaluacion = timezone.now().date()
        informe.evaluado_por = request.user
        informe.save()
        
        serializer = self.get_serializer(informe)
        return Response(serializer.data)


# =====================================================
# OBSERVACIÓN FONDO VIEWSET
# =====================================================

class ObservacionFondoViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar hilos de observaciones"""
    queryset = ObservacionFondo.objects.select_related(
        'fondo_tiempo', 'resuelta_por',
        'fondo_tiempo__docente'
    ).prefetch_related('mensajes__autor').order_by('-fecha_creacion') # Asegurar orden
    serializer_class = ObservacionFondoSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['fondo_tiempo', 'resuelta']
    ordering_fields = ['fecha_creacion']
    ordering = ['-fecha_creacion']
    
    def get_queryset(self):
        """Filtrar observaciones según el usuario y fondo"""
        queryset = super().get_queryset()
    
        # Si no es staff (es docente), solo ver observaciones de sus fondos
        if not self.request.user.is_staff:
            if hasattr(self.request.user, 'perfil') and self.request.user.perfil.docente:
                # Filtrar explícitamente por el ID del docente del perfil
                queryset = queryset.filter(fondo_tiempo__docente_id=self.request.user.perfil.docente.id)
            else:
                queryset = queryset.none()
    
        # Filtrar por fondo_tiempo si viene en parámetros (DESPUÉS del filtro de permisos)
        fondo_id = self.request.query_params.get('fondo_tiempo', None)
        if fondo_id:
            queryset = queryset.filter(fondo_tiempo_id=fondo_id)
    
        return queryset
    
    @action(detail=True, methods=['post'], url_path='agregar-mensaje')
    def agregar_mensaje(self, request, pk=None):
        """Agregar un mensaje al hilo"""
        observacion = self.get_object()
    
        # Verificar permisos
        es_admin = request.user.is_staff
    
        if not es_admin:
            # Si es docente, verificar que sea su fondo
           if hasattr(request.user, 'perfil') and request.user.perfil.docente:
               if observacion.fondo_tiempo.docente != request.user.perfil.docente:
                   raise PermissionDenied("No puede agregar mensajes a observaciones de otros docentes")
           else:
               raise PermissionDenied("Usuario no tiene docente asignado")
    
        # Validar que haya texto
        texto = request.data.get('texto', '').strip()
        if not texto or len(texto) < 10:
            return Response(
                {'error': 'El mensaje debe tener al menos 10 caracteres'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
        # Crear mensaje
        mensaje = MensajeObservacion.objects.create(
            observacion=observacion,
            autor=request.user,
            texto=texto,
            es_admin=request.user.perfil.rol in ['admin', 'director', 'jefe_estudios']
       )
    
        # NUEVO: Si estaba resuelta y el admin envía mensaje, reabrir Y cambiar fondo a observado
        if observacion.resuelta and es_admin:
            observacion.reabrir()
        
            # Cambiar el estado del fondo a "observado"
            fondo = observacion.fondo_tiempo
            estado_anterior = fondo.estado
            fondo.estado = 'observado'
            fondo.save()
        
            # Registrar en historial
            HistorialFondo.objects.create(
                fondo_tiempo=fondo,
                usuario=request.user,
                tipo_cambio='observacion',
                descripcion='Director reabrió observación - Fondo requiere correcciones',
                estado_anterior=estado_anterior,
                estado_nuevo=fondo.estado
          )
    
        # Devolver observación actualizada
        output_serializer = self.get_serializer(observacion)
        return Response(output_serializer.data)
    
    @action(detail=True, methods=['post'], url_path='marcar-resuelta')
    def marcar_resuelta(self, request, pk=None):
        """Marcar hilo como resuelto (solo docente)"""
        observacion = self.get_object()
      
        # Solo el docente puede marcar como resuelta
        if request.user.is_staff:
            return Response(
                {'error': 'Solo el docente puede marcar como resuelta'},
                status=status.HTTP_403_FORBIDDEN
        )
    
        # Verificar que sea el docente dueño del fondo
        if hasattr(request.user, 'perfil') and request.user.perfil.docente:
             if observacion.fondo_tiempo.docente != request.user.perfil.docente:
                 raise PermissionDenied("No puede resolver observaciones de otros docentes")
        else:
             raise PermissionDenied("Usuario no tiene docente asignado")
    
        if observacion.resuelta:
            return Response(
                {'error': 'Esta observación ya fue resuelta'},
                status=status.HTTP_400_BAD_REQUEST
        )   
    
        observacion.marcar_resuelta(request.user)
    
        # NUEVO: Cambiar el estado del fondo a "presentado_director"
        fondo = observacion.fondo_tiempo
        estado_anterior = fondo.estado

        # Determinar a quién devolver el fondo (Jefe o Director)
        primer_mensaje = observacion.mensajes.order_by('fecha').first()
        siguiente_estado = 'presentado_jefe' # Por defecto, vuelve al Jefe de Estudios
        descripcion_historial = 'Docente marcó observación como resuelta y presentó a Jefe de Estudios.'

        if primer_mensaje and hasattr(primer_mensaje.autor, 'perfil'):
            if primer_mensaje.autor.perfil.rol == 'director':
                siguiente_estado = 'presentado_director'
                descripcion_historial = 'Docente marcó observación como resuelta y presentó a Director.'

        fondo.estado = siguiente_estado
        fondo.save()
    
        # Registrar en historial
        HistorialFondo.objects.create(
            fondo_tiempo=fondo,
            usuario=request.user,
            tipo_cambio='presentacion',
            descripcion=descripcion_historial,
            estado_anterior=estado_anterior,
            estado_nuevo=siguiente_estado
        )
    
        output_serializer = self.get_serializer(observacion)
        return Response(output_serializer.data)
# =====================================================
# HISTORIAL FONDO VIEWSET
# =====================================================

class HistorialFondoViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet de solo lectura para historial (auditoría)"""
    queryset = HistorialFondo.objects.select_related(
        'fondo_tiempo', 'usuario', 'fondo_tiempo__docente'
    ).all()
    serializer_class = HistorialFondoSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['fondo_tiempo', 'tipo_cambio', 'usuario']
    ordering_fields = ['-fecha_creacion']
    ordering = ['-fecha_creacion']
    
    def get_queryset(self):
        """Filtrar historial según el usuario"""
        queryset = super().get_queryset()
        
        # Si no es admin, solo ver historial de sus fondos
        if not self.request.user.is_staff:
            if hasattr(self.request.user, 'perfil') and self.request.user.perfil.docente:
                queryset = queryset.filter(fondo_tiempo__docente=self.request.user.perfil.docente)
            else:
                queryset = queryset.none()
        
        return queryset


# ============================================
# VIEWSET PARA GESTIÓN DE USUARIOS
# ============================================

class UsuarioViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestión completa de usuarios.
    Solo usuarios administradores pueden crear, editar y eliminar usuarios.
    """
    queryset = User.objects.select_related('perfil').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['username', 'email', 'first_name', 'last_name']
    ordering_fields = ['username', 'date_joined']
    ordering = ['-date_joined']

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def roles(self, request):
        """
        Retorna la lista de roles de usuario disponibles en el sistema. 
        Se define explícitamente para evitar problemas de caché o reinicio del servidor
        que puedan causar que la lista en el frontend esté incompleta.
        """
        roles = [
            ('admin', 'Administrador'),
            ('director', 'Director de Carrera'),
            ('jefe_estudios', 'Jefe de Estudios'),
            ('docente', 'Docente'),
        ]
        return Response([{'value': r[0], 'label': r[1]} for r in roles])
    
    def get_serializer_class(self):
        if self.action == 'create':
            return CrearUsuarioSerializer
        elif self.action in ['update', 'partial_update']:
            return ActualizarUsuarioSerializer
        return UsuarioSerializer
    
    def get_permissions(self):
        """
        Solo admins pueden listar, crear y eliminar usuarios.
        Usuarios autenticados pueden ver y editar su propio perfil.
        """
        if self.action in ['list', 'create', 'destroy']:
            return [IsFullAdmin()]
        return [IsAuthenticated()]
    
    def get_queryset(self):
        user = self.request.user
        queryset = User.objects.select_related('perfil').all()

        if hasattr(user, 'perfil') and user.perfil.rol == 'admin':
            return queryset
            
        return queryset.filter(id=user.id)

    def create(self, request, *args, **kwargs):
        """Crear nuevo usuario con perfil"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Retornar con el serializer de lectura
        output_serializer = UsuarioSerializer(user)
        output_serializer = UsuarioSerializer(user, context={'request': request})
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)
    
    def update(self, request, *args, **kwargs):
        """Actualizar usuario y perfil"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Retornar con el serializer de lectura
        output_serializer = UsuarioSerializer(user)
        output_serializer = UsuarioSerializer(user, context={'request': request})
        return Response(output_serializer.data)
    
    def destroy(self, request, *args, **kwargs):
        """
        Eliminar usuario.
        Si el usuario tiene registros protegidos (Historial, Informes), se eliminan
        manualmente para permitir el borrado del usuario.
        """
        user = self.get_object()
        
        # 0. Validación de Seguridad: Impedir eliminar superusuarios
        if user.is_superuser:
            return Response(
                {'error': 'No se puede eliminar a un superusuario por seguridad. Debe hacerlo desde la consola.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Se ha eliminado la restricción que impedía borrar usuarios vinculados a docentes.
        
        # 2. Eliminación forzada de dependencias (Superar PROTECT)
        try:
            with transaction.atomic():
                # Eliminar registros que impiden el borrado por integridad referencial
                HistorialFondo.objects.filter(usuario=user).delete()
                MensajeObservacion.objects.filter(autor=user).delete()
                InformeFondo.objects.filter(elaborado_por=user).delete()
                
                # Ahora sí, eliminar el usuario
                return super().destroy(request, *args, **kwargs)
        except Exception as e:
            return Response(
                {'error': f'Error interno al eliminar usuario: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'], permission_classes=[IsFullAdmin])
    def cambiar_password(self, request, pk=None):
        """Cambiar contraseña de un usuario"""
        user = self.get_object()
        password = request.data.get('password')
        password_confirm = request.data.get('password_confirm')
        
        if not password or not password_confirm:
            return Response(
                {'error': 'Se requieren ambas contraseñas'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if password != password_confirm:
            return Response(
                {'error': 'Las contraseñas no coinciden'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(password) < 8:
            return Response(
                {'error': 'La contraseña debe tener al menos 8 caracteres'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.set_password(password)
        user.save()
        
        return Response({'success': 'Contraseña actualizada correctamente'})

    @action(detail=True, methods=['post'], permission_classes=[IsFullAdmin])
    def resetear_password(self, request, pk=None):
        """Restablece la contraseña del usuario a la contraseña por defecto (username + UABJB)"""
        user = self.get_object()
        nueva_password = f"{user.username}UABJB"
        user.set_password(nueva_password)
        user.save()
        if hasattr(user, 'perfil'):
            user.perfil.debe_cambiar_password = True
            user.perfil.save()
        return Response({'success': f'Contraseña restablecida correctamente a: {nueva_password}'})

    @action(detail=True, methods=['post'], permission_classes=[IsFullAdmin])
    def toggle_activo(self, request, pk=None):
        """Activar o desactivar usuario"""
        user = self.get_object()
        user.is_active = not user.is_active
        user.save()
        
        output_serializer = UsuarioSerializer(user)
        output_serializer = UsuarioSerializer(user, context={'request': request})
        return Response(output_serializer.data)


# ============================================
# FUNCIÓN PARA USUARIO ACTUAL
# ============================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def usuario_actual(request):
    """Retorna la información completa del usuario actual"""
    user = request.user
    serializer = UsuarioSerializer(user, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """
    Retorna estadísticas rápidas para el dashboard de administración.
    """
    try:
        user_count = User.objects.count()
        docente_count = Docente.objects.count()
        carrera_count = Carrera.objects.filter(activo=True).count()
        
        stats = {
            'usuarios': user_count,
            'docentes': docente_count,
            'carreras': carrera_count,
        }
        return Response(stats)
    except Exception as e:
        return Response(
            {'error': f'Error al obtener estadísticas: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class FotoPerfilUpdateView(generics.RetrieveUpdateDestroyAPIView):
    """
    Endpoint para que un usuario obtenga, actualice o elimine su propia foto de perfil.
    - PATCH: Sube una nueva foto.
    - DELETE: Elimina la foto actual.
    """
    serializer_class = FotoPerfilSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        """Retorna el perfil del usuario autenticado."""
        return self.request.user.perfil

    def perform_destroy(self, instance):
        """Al hacer DELETE, solo borra la foto de perfil, no el objeto PerfilUsuario."""
        instance.clear_foto_perfil()
        instance.save(update_fields=['foto_perfil', 'foto_perfil_cifrada', 'foto_perfil_mime'])


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cambiar_password_inicial(request):
    """
    Endpoint para que el usuario cambie su contraseña obligatoria al primer inicio de sesión.
    """
    user = request.user
    nueva_password = request.data.get('password')
    
    if not nueva_password or len(nueva_password) < 8:
        return Response(
            {'error': 'La contraseña debe tener al menos 8 caracteres.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user.set_password(nueva_password)
    user.save()
    
    user.perfil.debe_cambiar_password = False
    user.perfil.save()
    
    return Response({'message': 'Contraseña actualizada correctamente. Por favor inicie sesión nuevamente.'})

class CustomTokenObtainPairView(TokenObtainPairView):
    """Vista de login personalizada que usa el serializer extendido"""
    serializer_class = CustomTokenObtainPairSerializer
