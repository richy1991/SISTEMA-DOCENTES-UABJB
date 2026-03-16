
from rest_framework import viewsets, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from catalogos.models import ItemCatalogo, OperacionCatalogo, Direccion, PartidaPresupuestaria
from catalogos.api.serializers import (
    ItemCatalogoSerializer,
    OperacionCatalogoSerializer,
    DireccionSerializer,
    PartidaPresupuestariaSerializer,
)


class ItemCatalogoViewSet(viewsets.ModelViewSet):
    serializer_class = ItemCatalogoSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = ItemCatalogo.objects.select_related('partida').all()
        partida_id = self.request.query_params.get('partida_id')
        if partida_id:
            try:
                return qs.filter(partida_id=int(partida_id))
            except (ValueError, TypeError):
                return qs.none()
        # No devolver listado global; exigir filtro por partida
        return qs

    def list(self, request, *args, **kwargs):
        partida_id = request.query_params.get('partida_id')
        if not partida_id:
            return Response({'detail': "El parámetro 'partida_id' es obligatorio para listar items."}, status=400)
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        # exigir partida_id en payload (o partida_id en datos)
        if 'partida_id' not in request.data and 'partida' not in request.data:
            return Response({'detail': "El campo 'partida_id' es obligatorio para crear un item."}, status=400)
        return super().create(request, *args, **kwargs)



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


class PartidaPresupuestariaViewSet(viewsets.ModelViewSet):
    queryset = PartidaPresupuestaria.objects.all()
    serializer_class = PartidaPresupuestariaSerializer
    permission_classes = [AllowAny]


class ItemCatalogoReadOnlyViewSet(viewsets.ReadOnlyModelViewSet):
    """Endpoint solo-lectura para listar/ver detalles de items junto con su partida.

    Este viewset expone GET / y GET /<id>/ sin exigir el filtro por partida_id.
    """
    queryset = ItemCatalogo.objects.select_related('partida').all()
    serializer_class = ItemCatalogoSerializer
    permission_classes = [AllowAny]


class OperacionCatalogoReadOnlyViewSet(viewsets.ReadOnlyModelViewSet):
    """Exponer todas las operaciones sin requerir filtro por dirección."""
    queryset = OperacionCatalogo.objects.select_related('direccion').all()
    serializer_class = OperacionCatalogoSerializer
    permission_classes = [AllowAny]


