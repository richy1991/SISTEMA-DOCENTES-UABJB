from catalogos.models import ItemCatalogo, OperacionCatalogo, Direccion, PartidaPresupuestaria
from rest_framework import serializers
from django.db import transaction

class PartidaPresupuestariaSerializer(serializers.ModelSerializer):
    class Meta:
        model = PartidaPresupuestaria
        fields = ['id', 'codigo', 'nombre']
        read_only_fields = ['id']


class ItemCatalogoSerializer(serializers.ModelSerializer):
    # Mostrar datos de la partida en lectura y aceptar partida_id en escritura
    partida = PartidaPresupuestariaSerializer(read_only=True)
    partida_id = serializers.PrimaryKeyRelatedField(queryset=PartidaPresupuestaria.objects.all(), source='partida', write_only=True, required=False)

    class Meta:
        model = ItemCatalogo
        fields = ['id', 'descripcion', 'unidad_medida', 'partida', 'partida_id']
        read_only_fields = ['id']


class DireccionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Direccion
        fields = ['id', 'nombre']


class PartidaPresupuestariaSerializer(serializers.ModelSerializer):
    class Meta:
        model = PartidaPresupuestaria
        fields = ['id', 'codigo', 'nombre']
        read_only_fields = ['id']

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
    
