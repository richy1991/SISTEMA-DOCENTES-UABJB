from rest_framework.routers import DefaultRouter
from catalogos.api.views import (
	ItemCatalogoViewSet,
	ItemCatalogoReadOnlyViewSet,
	OperacionCatalogoViewSet,
	OperacionCatalogoReadOnlyViewSet,
	IndicadorCatalogoViewSet,
	IndicadorCatalogoReadOnlyViewSet,
	DireccionViewSet,
	PartidaPresupuestariaViewSet,
)

router = DefaultRouter()

router.register('partidas', PartidaPresupuestariaViewSet, basename='partidapresupuestaria')
router.register('items', ItemCatalogoViewSet, basename='itemcatalogo')

router.register('direcciones', DireccionViewSet, basename='direccion')
router.register('operaciones', OperacionCatalogoViewSet, basename='operacioncatalogo')
router.register('indicadores', IndicadorCatalogoViewSet, basename='indicadorcatalogo')

router.register('items-catalogo', ItemCatalogoReadOnlyViewSet, basename='itemcatalogo-readonly')
router.register('operaciones-catalogo', OperacionCatalogoReadOnlyViewSet, basename='operacioncatalogo-readonly')
router.register('indicadores-catalogo', IndicadorCatalogoReadOnlyViewSet, basename='indicadorcatalogo-readonly')

urlpatterns = router.urls
