from rest_framework.routers import DefaultRouter
from catalogos.api.views import (
	ItemCatalogoViewSet,
	ItemCatalogoReadOnlyViewSet,
	OperacionCatalogoViewSet,
	OperacionCatalogoReadOnlyViewSet,
	DireccionViewSet,
	PartidaPresupuestariaViewSet,
)

router = DefaultRouter()

router.register('partidas', PartidaPresupuestariaViewSet, basename='partidapresupuestaria')
router.register('items', ItemCatalogoViewSet, basename='itemcatalogo')

router.register('direcciones', DireccionViewSet, basename='direccion')
router.register('operaciones', OperacionCatalogoViewSet, basename='operacioncatalogo')

router.register('items-catalogo', ItemCatalogoReadOnlyViewSet, basename='itemcatalogo-readonly')
router.register('operaciones-catalogo', OperacionCatalogoReadOnlyViewSet, basename='operacioncatalogo-readonly')

urlpatterns = router.urls
