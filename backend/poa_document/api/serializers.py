from rest_framework import serializers
from django.contrib.auth.models import User

# Modelos del paquete
from poa_document.models import DocumentoPOA, ObjetivoEspecifico, Actividad, DetallePresupuesto, UsuarioPOA, RevisionDocumentoPOA, HistorialDocumentoPOA, ComentarioPOA, MensajeComentarioPOA
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


class UserSimpleSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'nombre_completo']

    def get_nombre_completo(self, obj):
        return obj.get_full_name() or obj.username


class UsuarioPOASerializer(serializers.ModelSerializer):
    user_detalle = UserSimpleSerializer(source='user', read_only=True)
    docente_detalle = DocenteSimpleSerializer(source='docente', read_only=True)
    rol_display = serializers.CharField(source='get_rol_display', read_only=True)
    nombre_display = serializers.SerializerMethodField()

    class Meta:
        model = UsuarioPOA
        fields = ['id', 'user', 'user_detalle', 'docente', 'docente_detalle',
                  'rol', 'rol_display', 'nombre_display',
                  'nombre_entidad', 'activo', 'fecha_asignacion']
        read_only_fields = ['fecha_asignacion']
        extra_kwargs = {
            'user': {'required': False, 'allow_null': True},
            'docente': {'required': False, 'allow_null': True},
        }

    def get_nombre_display(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.username
        if obj.docente:
            return obj.docente.nombre_completo
        return f'UsuarioPOA #{obj.pk}'


class RevisionDocumentoPOASerializer(serializers.ModelSerializer):
    revisor_nombre = serializers.SerializerMethodField()
    revisor_entidad = serializers.CharField(source='revisor.nombre_entidad', read_only=True)
    revisor_rol_display = serializers.CharField(source='revisor.get_rol_display', read_only=True)
    tipo_revisor_display = serializers.CharField(source='get_tipo_revisor_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    respondido_por_nombre = serializers.SerializerMethodField()
    es_revisor_actual = serializers.SerializerMethodField()

    class Meta:
        model = RevisionDocumentoPOA
        fields = [
            'id', 'ciclo_revision', 'revisor', 'revisor_nombre', 'revisor_entidad', 'revisor_rol_display',
            'tipo_revisor', 'tipo_revisor_display', 'estado', 'estado_display', 'observaciones',
            'fecha_asignacion', 'fecha_respuesta', 'respondido_por', 'respondido_por_nombre',
            'activo', 'es_revisor_actual'
        ]
        read_only_fields = fields

    def get_revisor_nombre(self, obj):
        return obj.revisor.nombre_entidad or obj.revisor.nombre_display

    def get_respondido_por_nombre(self, obj):
        if not obj.respondido_por:
            return ''
        return obj.respondido_por.get_full_name() or obj.respondido_por.username

    def get_es_revisor_actual(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        return obj.revisor.user_id == user.id


class HistorialDocumentoPOASerializer(serializers.ModelSerializer):
    tipo_evento_display = serializers.CharField(source='get_tipo_evento_display', read_only=True)
    usuario_nombre = serializers.SerializerMethodField()
    justificacion = serializers.SerializerMethodField()

    class Meta:
        model = HistorialDocumentoPOA
        fields = [
            'id', 'fecha', 'tipo_evento', 'tipo_evento_display', 'descripcion',
            'estado_anterior', 'estado_nuevo', 'datos_evento', 'usuario', 'usuario_nombre',
            'justificacion',
        ]
        read_only_fields = fields

    def get_usuario_nombre(self, obj):
        return obj.usuario.get_full_name() or obj.usuario.username

    def get_justificacion(self, obj):
        return (obj.datos_evento or {}).get('justificacion', '')


# DireccionSerializer ahora se importa desde catalogos.api.serializers


class DocumentoPOASerializer(serializers.ModelSerializer):
    elaborado_por = UsuarioPOASerializer(read_only=True)
    jefe_unidad = UsuarioPOASerializer(read_only=True)

    elaborado_por_id = serializers.PrimaryKeyRelatedField(queryset=UsuarioPOA.objects.all(), source='elaborado_por', write_only=True, required=False, allow_null=True)
    jefe_unidad_id = serializers.PrimaryKeyRelatedField(queryset=UsuarioPOA.objects.all(), source='jefe_unidad', write_only=True, required=False, allow_null=True)

    objetivos = serializers.SerializerMethodField()
    revisiones_activas = serializers.SerializerMethodField()
    historial = serializers.SerializerMethodField()

    class Meta:
        model = DocumentoPOA
        fields = [
            'id', 'gestion', 'unidad_solicitante', 'programa', 'objetivo_gestion_institucional',
            'elaborado_por', 'jefe_unidad', 'fecha_elaboracion', 'estado', 'observaciones', 'ciclo_revision_actual',
            'creado_en', 'actualizado_en', 'elaborado_por_id', 'jefe_unidad_id', 'objetivos', 'revisiones_activas', 'historial'
        ]

    def validate(self, attrs):
        elaborado_por = attrs.get('elaborado_por', getattr(self.instance, 'elaborado_por', None))
        jefe_unidad = attrs.get('jefe_unidad', getattr(self.instance, 'jefe_unidad', None))
        estado = attrs.get('estado', getattr(self.instance, 'estado', 'elaboracion'))
        observaciones = attrs.get('observaciones', getattr(self.instance, 'observaciones', ''))

        errors = {}

        if elaborado_por is not None:
            if not elaborado_por.activo:
                errors['elaborado_por_id'] = 'El usuario seleccionado para "Elaborado por" debe estar activo en Accesos POA.'
            elif elaborado_por.rol != 'elaborador':
                errors['elaborado_por_id'] = 'El usuario seleccionado para "Elaborado por" debe tener el rol Elaborador del POA.'

        if jefe_unidad is not None:
            if not jefe_unidad.activo:
                errors['jefe_unidad_id'] = 'El usuario seleccionado para "Jefe de unidad" debe estar activo en Accesos POA.'
            elif jefe_unidad.rol != 'director_carrera':
                errors['jefe_unidad_id'] = 'El usuario seleccionado para "Jefe de unidad" debe tener el rol Director de Carrera.'

        if elaborado_por is not None and jefe_unidad is not None and elaborado_por.pk == jefe_unidad.pk:
            errors['non_field_errors'] = '"Elaborado por" y "Jefe de unidad" deben ser personas diferentes.'

        if estado == 'observado' and not str(observaciones or '').strip():
            errors['observaciones'] = 'Debe registrar observaciones cuando el estado es Observado.'

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def get_objetivos(self, obj):
        return ObjetivoEspecificoSerializer(obj.objetivos.all(), many=True).data

    def get_revisiones_activas(self, obj):
        revisiones = obj.revisiones.filter(activo=True, ciclo_revision=obj.ciclo_revision_actual).select_related('revisor__user', 'respondido_por')
        return RevisionDocumentoPOASerializer(revisiones, many=True, context=self.context).data

    def get_historial(self, obj):
        historial = obj.historial.select_related('usuario').all()[:10]
        return HistorialDocumentoPOASerializer(historial, many=True, context=self.context).data


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


# ─── Conversaciones POA ───────────────────────────────────────────────────────

class MensajeComentarioPOASerializer(serializers.ModelSerializer):
    autor_nombre = serializers.SerializerMethodField()
    autor_username = serializers.CharField(source='autor.username', read_only=True)

    class Meta:
        model = MensajeComentarioPOA
        fields = ['id', 'comentario', 'autor', 'autor_nombre', 'autor_username',
                  'texto', 'es_revisor', 'fecha']
        read_only_fields = ['id', 'autor', 'autor_nombre', 'autor_username',
                            'es_revisor', 'fecha']

    def get_autor_nombre(self, obj):
        return obj.autor.get_full_name() or obj.autor.username


class ComentarioPOASerializer(serializers.ModelSerializer):
    mensajes = MensajeComentarioPOASerializer(many=True, read_only=True)
    cantidad_mensajes = serializers.SerializerMethodField()
    ultimo_mensaje = serializers.SerializerMethodField()

    class Meta:
        model = ComentarioPOA
        fields = ['id', 'documento', 'gestion', 'abierto', 'creado_en',
                  'mensajes', 'cantidad_mensajes', 'ultimo_mensaje']
        read_only_fields = ['id', 'gestion', 'abierto', 'creado_en']

    def get_cantidad_mensajes(self, obj):
        return obj.mensajes.count()

    def get_ultimo_mensaje(self, obj):
        ultimo = obj.mensajes.last()
        if ultimo:
            return {
                'texto': ultimo.texto,
                'autor': ultimo.autor.get_full_name() or ultimo.autor.username,
                'fecha': ultimo.fecha,
                'es_revisor': ultimo.es_revisor,
            }
        return None
