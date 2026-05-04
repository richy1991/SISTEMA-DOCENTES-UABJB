from rest_framework import routers
from django.urls import path
from .views import (
    DireccionViewSet,
    DocumentoPOAViewSet,
    DocumentoPOAReadOnlyViewSet,
    UsuarioPOAViewSet,
    DocenteBusquedaView,
    UsuarioBusquedaView,
    UsuarioBusquedaChatView,
    DirectorCarreraActualView,
    ChatContactosPOAView,
    MensajeChatViewSet,
    EvidenciaViewSet,
    CurrentUserAPIView,
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
router.register(r'evidencias', EvidenciaViewSet, basename='evidencias')

# detalle de presupuesto (CRUD estándar): list/create -> /detalle-presupuesto/ ; detail -> /detalle-presupuesto/{pk}/
router.register(r'detalle-presupuesto', DetallePresupuestoViewSet, basename='detalle_presupuesto')

router.register(r'mensajes-chat', MensajeChatViewSet, basename='mensaje_chat')

urlpatterns = router.urls + [
    path('docentes/buscar/', DocenteBusquedaView.as_view(), name='docente-buscar-poa'),
    path('usuarios/buscar/', UsuarioBusquedaView.as_view(), name='usuario-buscar-poa'),
    path('usuarios-chat/buscar/', UsuarioBusquedaChatView.as_view(), name='usuario-buscar-chat-poa'),
    path('director-carrera-actual/', DirectorCarreraActualView.as_view(), name='director-carrera-actual-poa'),
    path('chat-contactos/', ChatContactosPOAView.as_view(), name='chat-contactos-poa'),
    path('me/', CurrentUserAPIView.as_view(), name='current-user-poa'),
]

