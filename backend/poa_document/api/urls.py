from rest_framework import routers
from .views import (
    PersonaViewSet,
    DireccionViewSet,
    DocumentoPOAViewSet,
    DocumentoPOAReadOnlyViewSet,
)
from .views import ObjetivoEspecificoViewSet, ActividadViewSet, DetallePresupuestoViewSet

router = routers.DefaultRouter()
router.register('personas', PersonaViewSet, basename='persona')
router.register('direcciones', DireccionViewSet, basename='direccion')
router.register('documentos_poa', DocumentoPOAViewSet, basename='documento_poa')
router.register('documentos_poa_encabezados', DocumentoPOAReadOnlyViewSet, basename='documento_poa_encabezado')

# endpoints para objetivos, actividades y detalle de presupuesto
router.register(r'objetivos-especificos', ObjetivoEspecificoViewSet, basename='objetivos_especificos')
router.register(r'actividades', ActividadViewSet, basename='actividades')

# detalle de presupuesto (CRUD estándar): list/create -> /detalle-presupuesto/ ; detail -> /detalle-presupuesto/{pk}/
router.register(r'detalle-presupuesto', DetallePresupuestoViewSet, basename='detalle_presupuesto')

urlpatterns = router.urls