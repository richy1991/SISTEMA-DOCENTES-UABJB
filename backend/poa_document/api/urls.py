from rest_framework import routers
from django.urls import path
from .views import (
    DireccionViewSet,
    DocumentoPOAViewSet,
    DocumentoPOAReadOnlyViewSet,
    UsuarioPOAViewSet,
    DocenteBusquedaView,
    UsuarioBusquedaView,
    ComentarioPOAViewSet,
    MensajeComentarioPOAViewSet,
    DirectorPorCarreraView,
    CarreraPorIdView,
)
from .views import ObjetivoEspecificoViewSet, ActividadViewSet, DetallePresupuestoViewSet

router = routers.DefaultRouter()
router.register('usuarios-poa', UsuarioPOAViewSet, basename='usuario_poa')
router.register('direcciones', DireccionViewSet, basename='direccion')
router.register('documentos_poa', DocumentoPOAViewSet, basename='documento_poa')
router.register('documentos_poa_encabezados', DocumentoPOAReadOnlyViewSet, basename='documento_poa_encabezado')

# endpoints para objetivos, actividades y detalle de presupuesto
router.register(r'objetivos-especificos', ObjetivoEspecificoViewSet, basename='objetivos_especificos')
router.register(r'actividades', ActividadViewSet, basename='actividades')

# detalle de presupuesto (CRUD estándar): list/create -> /detalle-presupuesto/ ; detail -> /detalle-presupuesto/{pk}/
router.register(r'detalle-presupuesto', DetallePresupuestoViewSet, basename='detalle_presupuesto')

# conversaciones POA
router.register(r'comentarios-poa', ComentarioPOAViewSet, basename='comentario_poa')
router.register(r'mensajes-poa', MensajeComentarioPOAViewSet, basename='mensaje_poa')

urlpatterns = router.urls + [
    path('docentes/buscar/', DocenteBusquedaView.as_view(), name='docente-buscar-poa'),
    path('usuarios/buscar/', UsuarioBusquedaView.as_view(), name='usuario-buscar-poa'),
    path('director-por-carrera/<int:carrera_id>/', DirectorPorCarreraView.as_view(), name='director-por-carrera'),
    path('carrera/<int:carrera_id>/', CarreraPorIdView.as_view(), name='carrera-por-id'),
]

