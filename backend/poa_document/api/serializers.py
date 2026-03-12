from rest_framework import serializers

# Modelos del paquete
from poa_document.models import DocumentoPOA, ObjetivoEspecifico, Actividad, DetallePresupuesto, UsuarioPOA
from fondos.models import Docente
from catalogos.api.serializers import DireccionSerializer
from catalogos.models import Direccion
from catalogos.models import OperacionCatalogo


class DocenteSimpleSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.ReadOnlyField()

    class Meta:
        model = Docente
        fields = ['id', 'nombre_completo', 'apellido_paterno', 'apellido_materno',
                  'nombres', 'ci', 'email', 'categoria', 'dedicacion']


class UsuarioPOASerializer(serializers.ModelSerializer):
    docente_detalle = DocenteSimpleSerializer(source='docente', read_only=True)
    rol_display = serializers.CharField(source='get_rol_display', read_only=True)

    class Meta:
        model = UsuarioPOA
        fields = ['id', 'docente', 'docente_detalle', 'rol', 'rol_display',
                  'nombre_entidad', 'activo', 'fecha_asignacion']
        read_only_fields = ['fecha_asignacion']


# DireccionSerializer ahora se importa desde catalogos.api.serializers


class DocumentoPOASerializer(serializers.ModelSerializer):
    elaborado_por = UsuarioPOASerializer(read_only=True)
    jefe_unidad = UsuarioPOASerializer(read_only=True)

    elaborado_por_id = serializers.PrimaryKeyRelatedField(queryset=UsuarioPOA.objects.all(), source='elaborado_por', write_only=True, required=False, allow_null=True)
    jefe_unidad_id = serializers.PrimaryKeyRelatedField(queryset=UsuarioPOA.objects.all(), source='jefe_unidad', write_only=True, required=False, allow_null=True)

    objetivos = serializers.SerializerMethodField()

    class Meta:
        model = DocumentoPOA
        fields = [
            'id', 'gestion', 'unidad_solicitante', 'programa', 'objetivo_gestion_institucional',
            'elaborado_por', 'jefe_unidad', 'fecha_elaboracion', 'estado', 'creado_en', 'actualizado_en',
            'elaborado_por_id', 'jefe_unidad_id', 'objetivos'
        ]

    def get_objetivos(self, obj):
        return ObjetivoEspecificoSerializer(obj.objetivos.all(), many=True).data


# Serializers para Objetivos/Actividades (integrados en poa_document)
class OperacionCatalogoSerializer(serializers.ModelSerializer):
    class Meta:
        model = OperacionCatalogo
        fields = ['id', 'operacion', 'indicador', 'servicio', 'proceso']


class ObjetivoEspecificoSerializer(serializers.ModelSerializer):
    # Para crear/editar desde la API requerimos relacionar explícitamente el documento
    # No forzamos el campo en updates/patches; la vista validará su presencia en create
    documento_id = serializers.PrimaryKeyRelatedField(queryset=DocumentoPOA.objects.all(), source='documento', write_only=True, required=False)

    class Meta:
        model = ObjetivoEspecifico
        fields = ['id', 'codigo', 'descripcion', 'documento_id']


class ActividadSerializer(serializers.ModelSerializer):
    # indicador_descripcion ahora es un TextField: se puede escribir directamente como texto
    indicador_descripcion_texto = serializers.CharField(source='indicador_descripcion', read_only=True)
    indicadores_disponibles = serializers.SerializerMethodField()

    # campo write-only para relacionar el objetivo (misma convención)
    objetivo_id = serializers.PrimaryKeyRelatedField(queryset=ObjetivoEspecifico.objects.all(), source='objetivo', write_only=True, required=False)

    class Meta:
        model = Actividad
        fields = [
            'id', 'objetivo_id', 'codigo', 'nombre', 'responsable', 'productos_esperados',
            'mes_inicio', 'mes_fin', 'indicador_descripcion', 'indicador_descripcion_texto',
            'indicadores_disponibles',
            'indicador_unidad', 'indicador_linea_base', 'indicador_meta',
            'monto_funcion', 'monto_inversion', 'estado'
        ]
        read_only_fields = ['id']

    def validate_objetivo(self, value):
        if value and (not hasattr(value, 'documento') or not value.documento):
            raise serializers.ValidationError("El objetivo debe tener un documento POA asociado")
        return value

    def validate(self, attrs):
        # Si es POST (crear), exigir que venga objetivo_id en los datos (write-only)
        request = self.context.get('request')
        if request and request.method == 'POST':
            if 'objetivo' not in attrs:
                raise serializers.ValidationError({ 'objetivo_id': 'El campo objetivo_id es obligatorio para crear una actividad.' })
        return attrs

    def create(self, validated_data):
        try:
            actividad = Actividad.objects.create(**validated_data)
            return actividad
        except Exception as e:
            raise serializers.ValidationError(f"Error al crear la actividad: {str(e)}")

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        try:
            instance.save()
            return instance
        except Exception as e:
            raise serializers.ValidationError(f"Error al actualizar la actividad: {str(e)}")

    def get_indicadores_disponibles(self, obj):
        # unidad_solicitante ahora es texto libre, no hay filtro por dirección
        return []


# Serializer para DetallePresupuesto (integrado en poa_document)
class DetallePresupuestoSerializer(serializers.ModelSerializer):
    # actividad_id no es obligatorio en updates; la vista exige su presencia al crear
    actividad_id = serializers.PrimaryKeyRelatedField(queryset=Actividad.objects.all(), source='actividad', write_only=True, required=False)
    # Asegurar que 'cantidad' sea validada como entero en el endpoint
    cantidad = serializers.IntegerField(min_value=0)
    tipo = serializers.ChoiceField(choices=DetallePresupuesto.TIPOS, default='funcion')
    class Meta:
        model = DetallePresupuesto
        # Exponer sólo los campos que existen en la base de datos. No incluimos

        fields = [
            'id',
            'actividad_id',
            'tipo',
            'partida',
            'item',
            'unidad_medida',
            'caracteristicas',
            'cantidad',
            'costo_unitario',
            'costo_total',
            'mes_requerimiento',
        ]
        read_only_fields = ['id', 'costo_total']
