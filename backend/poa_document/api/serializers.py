from rest_framework import serializers
from django.contrib.auth.models import User

# Modelos del paquete
from poa_document.models import DocumentoPOA, ObjetivoEspecifico, Actividad, DetallePresupuesto, UsuarioPOA, RevisionDocumentoPOA, HistorialDocumentoPOA, MensajeChat
from poa_document.models import Evidencia, EvidenciaArchivo
from fondos.models import Docente, Carrera
from catalogos.api.serializers import DireccionSerializer
from catalogos.models import Direccion
from catalogos.models import OperacionCatalogo


class DocenteSimpleSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.ReadOnlyField()

    class Meta:
        model = Docente
        fields = ['id', 'nombre_completo', 'apellido_paterno', 'apellido_materno',
                  'nombres', 'ci', 'email']


class UserSimpleSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'nombre_completo']

    def get_nombre_completo(self, obj):
        return obj.get_full_name() or obj.username


class CarreraSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Carrera
        fields = ['id', 'nombre', 'codigo']


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

    def validate_rol(self, value):
        if value != 'elaborador':
            raise serializers.ValidationError('Solo se permite asignar el rol Elaborador del POA.')
        return value


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
    unidad_solicitante_detalle = CarreraSimpleSerializer(source='unidad_solicitante', read_only=True)

    elaborado_por_id = serializers.PrimaryKeyRelatedField(queryset=UsuarioPOA.objects.all(), write_only=True, required=False, allow_null=True)
    jefe_unidad_id = serializers.PrimaryKeyRelatedField(queryset=UsuarioPOA.objects.all(), write_only=True, required=False, allow_null=True)

    objetivos = serializers.SerializerMethodField()
    revisiones_activas = serializers.SerializerMethodField()
    historial = serializers.SerializerMethodField()

    class Meta:
        model = DocumentoPOA
        fields = [
            'id', 'gestion', 'unidad_solicitante', 'unidad_solicitante_detalle', 'programa', 'objetivo_gestion_institucional',
            'elaborado_por', 'jefe_unidad', 'fecha_elaboracion', 'estado', 'observaciones', 'ciclo_revision_actual',
            'creado_en', 'actualizado_en', 'elaborado_por_id', 'jefe_unidad_id', 'objetivos', 'revisiones_activas', 'historial'
        ]

    def validate(self, attrs):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        elaborado_por_obj = attrs.pop('elaborado_por_id', None)
        jefe_unidad_obj = attrs.pop('jefe_unidad_id', None)
        elaborado_por = elaborado_por_obj or attrs.get('elaborado_por', getattr(self.instance, 'elaborado_por', ''))
        jefe_unidad = jefe_unidad_obj or attrs.get('jefe_unidad', getattr(self.instance, 'jefe_unidad', ''))
        estado = attrs.get('estado', getattr(self.instance, 'estado', 'elaboracion'))
        observaciones = attrs.get('observaciones', getattr(self.instance, 'observaciones', ''))

        errors = {}

        if user and user.is_authenticated and not user.is_superuser:
            perfil = getattr(user, 'perfil', None)
            carrera = getattr(perfil, 'carrera', None)
            if not carrera:
                errors['unidad_solicitante'] = 'El usuario no tiene una carrera asignada para crear o editar documentos POA.'
            else:
                attrs['unidad_solicitante'] = carrera

        if elaborado_por is not None:
            if hasattr(elaborado_por, 'activo') and not elaborado_por.activo:
                errors['elaborado_por_id'] = 'El usuario seleccionado para "Elaborado por" debe estar activo en Accesos POA.'
            elif hasattr(elaborado_por, 'rol') and elaborado_por.rol != 'elaborador':
                errors['elaborado_por_id'] = 'El usuario seleccionado para "Elaborado por" debe tener el rol Elaborador del POA.'

        if jefe_unidad is not None:
            if hasattr(jefe_unidad, 'activo') and not jefe_unidad.activo:
                errors['jefe_unidad_id'] = 'El usuario seleccionado para "Jefe de unidad" debe estar activo en Accesos POA.'

        if hasattr(elaborado_por, 'pk') and hasattr(jefe_unidad, 'pk') and elaborado_por.pk == jefe_unidad.pk:
            errors['non_field_errors'] = '"Elaborado por" y "Jefe de unidad" deben ser personas diferentes.'

        if estado == 'observado' and not str(observaciones or '').strip():
            errors['observaciones'] = 'Debe registrar observaciones cuando el estado es Observado.'

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def _resolver_nombre_usuario_poa(self, usuario_poa):
        if not usuario_poa:
            return ''
        if getattr(usuario_poa, 'user_id', None):
            return usuario_poa.user.get_full_name() or usuario_poa.user.username
        if getattr(usuario_poa, 'docente_id', None):
            return usuario_poa.docente.nombre_completo
        return getattr(usuario_poa, 'nombre_display', '') or f'UsuarioPOA #{usuario_poa.pk}'

    def create(self, validated_data):
        elaborado_por_obj = validated_data.pop('elaborado_por_id', None)
        jefe_unidad_obj = validated_data.pop('jefe_unidad_id', None)
        if elaborado_por_obj is not None:
            validated_data['elaborado_por'] = self._resolver_nombre_usuario_poa(elaborado_por_obj)
        if jefe_unidad_obj is not None:
            validated_data['jefe_unidad'] = self._resolver_nombre_usuario_poa(jefe_unidad_obj)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        elaborado_por_obj = validated_data.pop('elaborado_por_id', None)
        jefe_unidad_obj = validated_data.pop('jefe_unidad_id', None)
        if elaborado_por_obj is not None:
            validated_data['elaborado_por'] = self._resolver_nombre_usuario_poa(elaborado_por_obj)
        if jefe_unidad_obj is not None:
            validated_data['jefe_unidad'] = self._resolver_nombre_usuario_poa(jefe_unidad_obj)
        return super().update(instance, validated_data)

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
    evidencia_registrada = serializers.SerializerMethodField()
    evidencia_cumplimiento = serializers.SerializerMethodField()

    # campo write-only para relacionar el objetivo (misma convención)
    objetivo_id = serializers.PrimaryKeyRelatedField(queryset=ObjetivoEspecifico.objects.all(), source='objetivo', write_only=True, required=False)

    class Meta:
        model = Actividad
        fields = [
            'id', 'objetivo_id', 'codigo', 'nombre', 'responsable', 'productos_esperados',
            'mes_inicio', 'mes_fin', 'indicador_descripcion', 'indicador_descripcion_texto',
            'indicadores_disponibles',
            'indicador_unidad', 'indicador_linea_base', 'indicador_meta',
            'monto_funcion', 'monto_inversion', 'estado',
            'evidencia_registrada', 'evidencia_cumplimiento'
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
        # La carrera solicitante ya está resuelta en el documento; no aplica filtro adicional aquí.
        return []

    def get_evidencia_registrada(self, obj):
        return bool(getattr(obj, 'evidencias', None) and obj.evidencias.exists())

    def get_evidencia_cumplimiento(self, obj):
        try:
            evidencia = obj.evidencias.first()
            if not evidencia:
                return 0
            return float(evidencia.grado_cumplimiento or 0)
        except Exception:
            return 0


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


class MensajeChatSerializer(serializers.ModelSerializer):
    emisor_nombre = serializers.SerializerMethodField()
    emisor_username = serializers.CharField(source='emisor.username', read_only=True)
    receptor_nombre = serializers.SerializerMethodField()
    receptor_username = serializers.CharField(source='receptor.username', read_only=True)

    class Meta:
        model = MensajeChat
        fields = [
            'id', 'emisor', 'emisor_nombre', 'emisor_username',
            'receptor', 'receptor_nombre', 'receptor_username',
            'texto', 'fecha', 'leido_en',
        ]
        read_only_fields = fields

    def get_emisor_nombre(self, obj):
        return obj.emisor.get_full_name() or obj.emisor.username

    def get_receptor_nombre(self, obj):
        return obj.receptor.get_full_name() or obj.receptor.username


class EvidenciaArchivoSerializer(serializers.ModelSerializer):
    archivo_url = serializers.SerializerMethodField()

    class Meta:
        model = EvidenciaArchivo
        fields = ['id', 'tipo', 'archivo', 'archivo_url', 'url', 'creado_en']
        read_only_fields = ['id', 'archivo_url', 'creado_en']

    def get_archivo_url(self, obj):
        request = self.context.get('request')
        if obj.archivo and request:
            return request.build_absolute_uri(obj.archivo.url)
        return None


class EvidenciaSerializer(serializers.ModelSerializer):
    archivos = EvidenciaArchivoSerializer(many=True, read_only=True)
    actividad_id = serializers.PrimaryKeyRelatedField(queryset=Actividad.objects.all(), source='actividad', write_only=True)
    resultados_logrados = serializers.CharField(required=True, allow_blank=False)

    class Meta:
        model = Evidencia
        fields = ['id', 'actividad', 'actividad_id', 'resultados_logrados', 'programado', 'ejecutado', 'grado_cumplimiento', 'creado_en', 'actualizado_en', 'archivos']
        read_only_fields = ['id', 'actividad', 'creado_en', 'actualizado_en', 'archivos']

    def create(self, validated_data):
        # actividad llega como objeto por actividad_id
        return Evidencia.objects.create(**validated_data)

