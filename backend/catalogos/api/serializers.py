from catalogos.models import ItemCatalogo, OperacionCatalogo, Direccion
from rest_framework import serializers
from django.db import transaction


class PartidaCatalogoSerializer(serializers.Serializer):
    id = serializers.CharField()
    codigo = serializers.CharField()
    nombre = serializers.CharField()


class ItemCatalogoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemCatalogo
        fields = [
            'id',
            'detalle',
            'unidad_medida',
            'partida',
        ]
        read_only_fields = ['id']


class DireccionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Direccion
        fields = ['id', 'nombre']

class OperacionCatalogoSerializer(serializers.ModelSerializer):
    direccion = DireccionSerializer(read_only=True)
    direccion_id = serializers.PrimaryKeyRelatedField(
        queryset=Direccion.objects.all(), source='direccion', write_only=True
    )

    class Meta:
        model = OperacionCatalogo
        fields = ['id', 'direccion', 'direccion_id', 'servicio', 'proceso', 'operacion', 'producto_intermedio', 'indicador']
        read_only_fields = ['id']

    @transaction.atomic
    def create(self, validated_data):
        return super().create(validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        return super().update(instance, validated_data)
    
