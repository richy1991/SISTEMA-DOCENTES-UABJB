from rest_framework import serializers
from django.contrib.auth.models import User
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Docente, Carrera, Materia, FondoTiempo, CategoriaFuncion, Actividad, PerfilUsuario, InformeFondo, ObservacionFondo, MensajeObservacion, HistorialFondo, CargaHoraria, SaldoVacacionesGestion
from django.db.models import Sum
    

class CargaHorariaSerializer(serializers.ModelSerializer):
    docente_nombre = serializers.CharField(source='docente.nombre_completo', read_only=True)
    calendario_gestion = serializers.IntegerField(source='calendario.gestion', read_only=True)
    calendario_periodo = serializers.CharField(source='calendario.get_periodo_display', read_only=True)
    categoria_display = serializers.CharField(source='get_categoria_display', read_only=True)
    creado_por_nombre = serializers.CharField(source='creado_por.get_full_name', read_only=True)

    class Meta:
        model = CargaHoraria
        fields = '__all__'
        read_only_fields = ['creado_por']

    def create(self, validated_data):
        # Asignar el usuario que crea el registro
        validated_data['creado_por'] = self.context['request'].user
        return super().create(validated_data)



class DocenteSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.ReadOnlyField()
    usuario_email = serializers.SerializerMethodField()
    
    class Meta:
        model = Docente
        fields = '__all__'

    def get_usuario_email(self, obj):
        """Obtiene el email del usuario asociado al docente si existe."""
        if hasattr(obj, 'usuario') and obj.usuario and obj.usuario.user:
            return obj.usuario.user.email
        return None


class SaldoVacacionesGestionSerializer(serializers.ModelSerializer):
    docente_nombre = serializers.CharField(source='docente.nombre_completo', read_only=True)
    docente_id = serializers.IntegerField(write_only=False)
    
    class Meta:
        model = SaldoVacacionesGestion
        fields = ['id', 'docente_id', 'docente_nombre', 'gestion', 'dias_disponibles']
    
    def validate_docente_id(self, value):
        """Valida que el docente exista."""
        if not Docente.objects.filter(id=value).exists():
            raise serializers.ValidationError("El docente especificado no existe.")
        return value
    
    def create(self, validated_data):
        docente_id = validated_data.pop('docente_id')
        validated_data['docente_id'] = docente_id
        return super().create(validated_data)


class CarreraSerializer(serializers.ModelSerializer):
    class Meta:
        model = Carrera
        fields = '__all__'


class MateriaSerializer(serializers.ModelSerializer):
    carrera_nombre = serializers.CharField(source='carrera.nombre', read_only=True)
    horas_totales = serializers.ReadOnlyField()

    class Meta:
        model = Materia
        fields = '__all__'


class ActividadSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source='categoria.get_tipo_display', read_only=True)
    
    class Meta:
        model = Actividad
        fields = ['id', 'categoria', 'categoria_nombre', 'detalle', 'horas_semana', 
                  'horas_año', 'evidencias', 'orden', 'archivo_evidencia']
        extra_kwargs = {
            'evidencias': {'required': False, 'allow_null': True, 'allow_blank': True}
        }

    def validate_evidencias(self, value):
        """Asegura que evidencias sea una cadena vacía si es None."""
        return value or ""

    def validate_horas_semana(self, value):
        """Valida que las horas semanales no sean negativas."""
        if value < 0:
            raise serializers.ValidationError("Las horas semanales no pueden ser negativas.")
        return value

    def validate_horas_año(self, value):
        """Valida que las horas anuales no sean negativas."""
        if value < 0:
            raise serializers.ValidationError("Las horas anuales no pueden ser negativas.")
        return value


class CategoriaFuncionSerializer(serializers.ModelSerializer):
    actividades = ActividadSerializer(many=True, read_only=True) # IMPORTANTE: Devuelve TODAS las actividades sin filtrar
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    # total_horas se elimina como SerializerMethodField para permitir escritura (guardado en BD)
    porcentaje = serializers.SerializerMethodField()
    detalles_carga = serializers.SerializerMethodField()
    
    class Meta:
        model = CategoriaFuncion
        fields = ['id', 'fondo_tiempo', 'tipo', 'tipo_display', 'total_horas', 
                  'porcentaje', 'actividades', 'detalles_carga']

    def _get_horas_reales(self, obj):
        """Helper para calcular horas efectivas (Jefatura > Manual)"""
        # obj is CategoriaFuncion
        fondo = obj.fondo_tiempo
        horas_manuales = obj.total_horas
        if not fondo.docente or not fondo.calendario_academico:
            return horas_manuales

        # Usar el contexto para evitar recalcular para cada categoría del mismo fondo.
        context = self.context
        cache_key = f"carga_horaria_fondo_{fondo.id}"

        if cache_key not in context:
            # Calcular totales para todas las categorías de este fondo una sola vez.
            cargas = CargaHoraria.objects.filter(
                docente=fondo.docente,
                calendario=fondo.calendario_academico
            ).values('categoria').annotate(total=Sum('horas'))
            
            context[cache_key] = {item['categoria']: item['total'] for item in cargas}

        horas_jefatura = context[cache_key].get(obj.tipo, 0) or 0
        
        if horas_jefatura > 0:
            return horas_jefatura
            
        return horas_manuales

    def to_representation(self, instance):
        """Sobrescribimos la salida para mostrar las horas calculadas, pero permitimos guardar las manuales."""
        ret = super().to_representation(instance)
        ret['total_horas'] = self._get_horas_reales(instance)
        return ret

    def get_porcentaje(self, obj):
        total_horas_categoria = self._get_horas_reales(obj)
        fondo = obj.fondo_tiempo
        if not fondo.horas_efectivas or fondo.horas_efectivas == 0:
            return 0
        return (total_horas_categoria / fondo.horas_efectivas) * 100

    def get_detalles_carga(self, obj):
        fondo = obj.fondo_tiempo
        if not fondo.docente or not fondo.calendario_academico:
            return []

        # Usar el contexto para evitar recalcular para cada categoría del mismo fondo.
        context = self.context
        cache_key = f"carga_horaria_detalles_{fondo.id}"

        if cache_key not in context:
            # Obtener todas las cargas de este fondo en una sola consulta
            cargas = CargaHoraria.objects.filter(
                docente=fondo.docente,
                calendario=fondo.calendario_academico
            )
            
            # Agrupar por categoría en memoria
            detalles_map = {}
            for carga in cargas:
                if carga.categoria not in detalles_map:
                    detalles_map[carga.categoria] = []
                
                detalles_map[carga.categoria].append({
                    "id": carga.id,
                    "titulo_actividad": carga.titulo_actividad,
                    "horas": carga.horas,
                    "respaldo": carga.documento_respaldo
                })
            
            context[cache_key] = detalles_map

        return context[cache_key].get(obj.tipo, [])


class FondoTiempoSerializer(serializers.ModelSerializer):
    docente_nombre = serializers.CharField(source='docente.nombre_completo', read_only=True)
    carrera_nombre = serializers.CharField(source='carrera.nombre', read_only=True)
    categorias = CategoriaFuncionSerializer(many=True, read_only=True) # Nested serializer explícito
    requerimientos = CategoriaFuncionSerializer(many=True, read_only=True, source='categorias') # Alias para frontend
    porcentaje_completado = serializers.SerializerMethodField()
    proyectos = serializers.SerializerMethodField()
    horas_disponibles = serializers.SerializerMethodField()
    total_asignado = serializers.SerializerMethodField()
    informe_actual = serializers.SerializerMethodField()
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        # Para docentes, la URL del programa analítico es de solo lectura (ver/clic pero no editar)
        if request and hasattr(request.user, 'perfil') and request.user.perfil.rol == 'docente':
            self.fields['programa_analitico_url'].read_only = True
    # Aseguramos que se devuelva la URL como string explícito
    programa_analitico_url = serializers.URLField(required=False, allow_blank=True)

    class Meta:
        model = FondoTiempo
        fields = '__all__'
        read_only_fields = [
            'estado', 'horas_efectivas', 'fecha_aprobacion', 
            'fecha_validacion', 'fecha_inicio_ejecucion', 'fecha_informe', 'fecha_finalizacion'
        ]
    
    def get_proyectos(self, obj):
        """Devuelve los proyectos asociados usando el serializer de lista definido más abajo."""
        return ProyectoListSerializer(obj.proyectos.all(), many=True).data

    def get_total_asignado(self, obj):
        if not hasattr(obj, '_total_asignado_calculado'):
            if not obj.docente or not obj.calendario_academico:
                total = 0
            else:
                # Obtener mapa de horas de Jefatura
                cargas = CargaHoraria.objects.filter(
                    docente=obj.docente,
                    calendario=obj.calendario_academico
                ).values('categoria').annotate(total=Sum('horas'))
                cargas_map = {c['categoria']: c['total'] for c in cargas}

                # Sumar iterando sobre las categorías del fondo
                total_calculado = 0
                for cat in obj.categorias.all():
                    horas_jefatura = cargas_map.get(cat.tipo, 0)
                    # Si hay horas de jefatura (>0), se usan esas. Si no, las manuales.
                    total_calculado += horas_jefatura if horas_jefatura > 0 else cat.total_horas
                
                total = total_calculado
            obj._total_asignado_calculado = total
        return obj._total_asignado_calculado

    def get_porcentaje_completado(self, obj):
        total_asignado = self.get_total_asignado(obj)
        if not obj.horas_efectivas or obj.horas_efectivas == 0:
            return 0
        return (total_asignado / obj.horas_efectivas) * 100

    def get_horas_disponibles(self, obj):
        total_asignado = self.get_total_asignado(obj)
        return obj.horas_efectivas - total_asignado

    def get_informe_actual(self, obj):
        """Obtiene el informe más reciente del fondo"""
        informe = obj.informes.filter(tipo='parcial').order_by('-fecha_elaboracion').first()
        if informe:
            return InformeFondoSerializer(informe).data
        return None


class FondoTiempoListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listados"""
    docente_nombre = serializers.CharField(source='docente.nombre_completo', read_only=True)
    carrera_nombre = serializers.CharField(source='carrera.nombre', read_only=True)
    porcentaje_completado = serializers.SerializerMethodField()
    total_asignado = serializers.SerializerMethodField()
    # Aseguramos que se devuelva la URL como string explícito
    programa_analitico_url = serializers.URLField(read_only=True)
    
    class Meta:
        model = FondoTiempo
        fields = ['id', 'docente', 'docente_nombre', 'carrera', 'carrera_nombre', 
                  'gestion', 'asignatura', 'total_asignado', 'horas_efectivas', 
                  'porcentaje_completado', 'estado', 'programa_analitico_url']

    def get_total_asignado(self, obj):
        # NOTA DE RENDIMIENTO: Esto puede causar N+1 queries en la vista de lista.
        # Para optimizar, se podría anotar el queryset en el ViewSet.
        if not hasattr(obj, '_total_asignado_calculado'):
            if not obj.docente or not obj.calendario_academico:
                total = 0
            else:
                # Lógica Híbrida Unificada (Igual que en Detalle)
                cargas = CargaHoraria.objects.filter(
                    docente=obj.docente,
                    calendario=obj.calendario_academico
                ).values('categoria').annotate(total=Sum('horas'))
                cargas_map = {c['categoria']: c['total'] for c in cargas}

                total_calculado = 0
                for cat in obj.categorias.all():
                    horas_jefatura = cargas_map.get(cat.tipo, 0)
                    total_calculado += horas_jefatura if horas_jefatura > 0 else cat.total_horas
                
                total = total_calculado
            obj._total_asignado_calculado = total
        return obj._total_asignado_calculado

    def get_porcentaje_completado(self, obj):
        total_asignado = self.get_total_asignado(obj)
        if not obj.horas_efectivas or obj.horas_efectivas == 0:
            return 0
        return (total_asignado / obj.horas_efectivas) * 100


# ============================================
# SERIALIZERS PARA GESTIÓN DE USUARIOS
# ============================================

class PerfilUsuarioSerializer(serializers.ModelSerializer):
    carrera_nombre = serializers.SerializerMethodField()
    docente_nombre = serializers.SerializerMethodField()
    foto_perfil = serializers.SerializerMethodField()

    class Meta:
        model = PerfilUsuario
        fields = ['id', 'rol', 'carrera', 'carrera_nombre', 'docente', 'docente_nombre', 
                  'telefono', 'activo', 'foto_perfil', 'debe_cambiar_password']

    def get_carrera_nombre(self, obj):
        """Retorna el nombre de la carrera si existe, si no, None."""
        return obj.carrera.nombre if obj.carrera else None

    def get_docente_nombre(self, obj):
        """Retorna el nombre completo del docente si existe, si no, None."""
        return obj.docente.nombre_completo if obj.docente else None

    def get_foto_perfil(self, obj):
        return obj.get_foto_perfil_data_uri()


class FotoPerfilSerializer(serializers.Serializer):
    foto_perfil = serializers.ImageField(required=False, allow_null=True)

    def to_representation(self, instance):
        return {'foto_perfil': instance.get_foto_perfil_data_uri()}

    def update(self, instance, validated_data):
        incoming = validated_data.get('foto_perfil', serializers.empty)

        if incoming is serializers.empty:
            return instance

        if incoming is None:
            instance.clear_foto_perfil()
        else:
            instance.set_foto_perfil_cifrada(incoming)

        instance.save(update_fields=['foto_perfil', 'foto_perfil_cifrada', 'foto_perfil_mime'])
        return instance


class UsuarioSerializer(serializers.ModelSerializer):
    perfil = serializers.SerializerMethodField()
    nombre_completo = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'nombre_completo',
                  'is_staff', 'is_superuser', 'is_active', 'date_joined', 'perfil']
        read_only_fields = ['id', 'date_joined']

    def get_perfil(self, obj):
        """
        Retorna los datos del perfil si existe, de lo contrario retorna None.
        Esto previene errores si un usuario no tiene un perfil asociado.
        """
        if hasattr(obj, 'perfil'):
            data = PerfilUsuarioSerializer(obj.perfil, context=self.context).data
            # GARANTÍA DE ACCESO: Si es superusuario, el frontend SIEMPRE debe verlo como admin
            if obj.is_superuser:
                data['rol'] = 'admin'
                # FIX: Forzar que al admin NUNCA se le pida cambio de contraseña, ignorando la BD
                data['debe_cambiar_password'] = False
            return data
        
        # Fallback de seguridad: Si es superusuario pero NO tiene perfil creado (error de integridad),
        # devolvemos una estructura simulada de admin para no bloquear el acceso.
        if obj.is_superuser:
            return {
                'id': None,
                'rol': 'admin',
                'carrera': None,
                'carrera_nombre': None,
                'docente': None,
                'docente_nombre': None,
                'telefono': '',
                'activo': True,
                'foto_perfil': None,
                'debe_cambiar_password': False
            }
        return None

    def get_nombre_completo(self, obj):
        """
        Retorna el nombre completo del usuario, o el username si no tiene nombre.
        """
        nombre_completo = obj.get_full_name()
        return nombre_completo if nombre_completo else obj.username


class CrearUsuarioSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, required=True)
    # Se definen los roles explícitamente para evitar problemas de carga
    # en el servidor de desarrollo que puedan mostrar una lista incompleta.
    rol = serializers.ChoiceField(choices=[
        ('admin', 'Administrador'),
        ('director', 'Director de Carrera'),
        ('jefe_estudios', 'Jefe de Estudios'),
        ('docente', 'Docente')], required=True)
    carrera = serializers.PrimaryKeyRelatedField(
        queryset=Carrera.objects.all(), 
        required=False, 
        allow_null=True
    )
    docente = serializers.PrimaryKeyRelatedField(
        queryset=Docente.objects.all(), 
        required=False, 
        allow_null=True
    )
    # Campo para recibir datos de un nuevo docente a crear
    docente_data = serializers.JSONField(write_only=True, required=False, allow_null=True)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password_confirm', 'first_name',
                  'last_name', 'rol', 'carrera', 'docente', 'docente_data']
        extra_kwargs = {
            'first_name': {'required': True, 'allow_blank': False},
            'last_name': {'required': True, 'allow_blank': False},
            'email': {'required': False, 'allow_blank': True},
        }
    
    def validate(self, data):
        # Validar que las contraseñas coincidan
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({
                'password_confirm': 'Las contraseñas no coinciden'
            })
        
        # Validar que el director tenga carrera asignada
        if data['rol'] in ['director', 'jefe_estudios'] and not data.get('carrera'):
            raise serializers.ValidationError({
                'carrera': 'Los directores y jefes de estudio deben tener una carrera asignada'
            })
        
        # Validar rol docente: debe tener un docente existente o datos para uno nuevo
        if data['rol'] == 'docente' and not data.get('docente') and not data.get('docente_data'):
            raise serializers.ValidationError({
                'docente': 'Para el rol "docente", debe seleccionar un docente existente o proporcionar datos para crear uno nuevo.'
            })
        
        if data.get('docente') and data.get('docente_data'):
            raise serializers.ValidationError("No puede seleccionar un docente existente y crear uno nuevo al mismo tiempo.")

        # Validar los datos del nuevo docente si se proporcionan
        if data.get('docente_data'):
            docente_data = data.get('docente_data')
            docente_serializer = DocenteSerializer(data=docente_data)
            docente_serializer.is_valid(raise_exception=True)
            if 'ci' in docente_data and Docente.objects.filter(ci=docente_data['ci']).exists():
                raise serializers.ValidationError({'docente_data': {'ci': 'Ya existe un docente con este CI.'}})
        
        return data
    
    def create(self, validated_data):
        # Extraer datos del perfil
        validated_data.pop('password_confirm')
        rol = validated_data.pop('rol')
        carrera = validated_data.pop('carrera', None)
        docente = validated_data.pop('docente', None)
        docente_data = validated_data.pop('docente_data', None)
        
        # Crear usuario
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )
        
        # El perfil se crea automáticamente con rol 'docente' via signal.
        # Ahora lo actualizamos con los datos correctos.
        docente_obj = None
        if rol == 'docente':
            if docente_data:
                docente_serializer = DocenteSerializer(data=docente_data)
                docente_serializer.is_valid(raise_exception=True)
                docente_obj = docente_serializer.save()
            elif docente:
                docente_obj = docente
        
        # Asignar is_staff para roles de autoridad que lo requieran
        if rol in ['admin', 'director', 'jefe_estudios']:
            user.is_staff = True
        
        # Actualizar perfil (se crea automáticamente por signal)
        user.perfil.rol = rol
        user.perfil.carrera = carrera
        user.perfil.docente = docente_obj

        # Guardamos el usuario. La señal 'guardar_perfil_usuario' se encargará de guardar el perfil.
        user.save()
        
        return user


class ActualizarUsuarioSerializer(serializers.ModelSerializer):
    # Se definen los roles explícitamente para asegurar que la opción 'Jefe de Estudios'
    # siempre esté disponible en los formularios de edición.
    rol = serializers.ChoiceField(choices=[
        ('admin', 'Administrador'),
        ('director', 'Director de Carrera'),
        ('jefe_estudios', 'Jefe de Estudios'),
        ('docente', 'Docente')], required=False)
    carrera = serializers.PrimaryKeyRelatedField(
        queryset=Carrera.objects.all(), 
        required=False, 
        allow_null=True
    )
    docente = serializers.PrimaryKeyRelatedField(
        queryset=Docente.objects.all(), 
        required=False, 
        allow_null=True
    )
    # Campo para recibir datos de un nuevo docente a crear
    docente_data = serializers.JSONField(write_only=True, required=False, allow_null=True)
    
    class Meta:
        model = User
        fields = ['email', 'first_name', 'last_name', 'is_active', 
                  'rol', 'carrera', 'docente', 'docente_data']
        extra_kwargs = {
            'first_name': {'allow_blank': False},
            'last_name': {'allow_blank': False},
            'email': {'allow_blank': False},
        }
    
    def validate(self, data):
        """
        Valida los datos para asegurar la consistencia al cambiar de rol.
        """
        # Determina el rol final (el nuevo si se provee, o el existente si no)
        rol = data.get('rol', self.instance.perfil.rol)

        # Regla 1: Directores y Jefes de Estudio deben tener una carrera.
        if rol in ['director', 'jefe_estudios']:
            # Se está intentando poner la carrera a null explícitamente?
            if 'carrera' in data and data.get('carrera') is None:
                raise serializers.ValidationError({'carrera': 'Directores y Jefes de Estudio deben tener una carrera asignada.'})
            # No se está proveyendo una carrera y el usuario no tiene una ya?
            if 'carrera' not in data and not self.instance.perfil.carrera:
                raise serializers.ValidationError({'carrera': 'Debe asignar una carrera para este rol.'})

        # Regla 2: El rol de Docente debe tener un perfil de docente asociado.
        if rol == 'docente':
            # Se está intentando poner el docente a null y no se crea uno nuevo?
            if 'docente' in data and data.get('docente') is None and not data.get('docente_data'):
                raise serializers.ValidationError({'docente': 'El rol de Docente requiere un perfil de docente asociado.'})
            # No se provee un docente y el usuario no tiene uno ya?
            if 'docente' not in data and 'docente_data' not in data and not self.instance.perfil.docente:
                raise serializers.ValidationError({'docente': 'Debe asociar un perfil de docente para este rol.'})

        return data
    
    def update(self, instance, validated_data):
        perfil = instance.perfil

        # 1. Actualizar campos del modelo User
        instance.email = validated_data.get('email', instance.email)
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        instance.is_active = validated_data.get('is_active', instance.is_active)

        # 2. Determinar el rol final y si ha cambiado
        new_rol = validated_data.get('rol')
        role_changed = new_rol and new_rol != perfil.rol
        final_rol = new_rol or perfil.rol

        # Actualizar el rol en el perfil
        perfil.rol = final_rol

        # 3. Ajustar 'is_staff' según el rol final
        if final_rol in ['admin', 'director', 'jefe_estudios']:
            instance.is_staff = True
        else:
            instance.is_staff = False

        # 4. Gestionar 'carrera'
        if final_rol in ['director', 'jefe_estudios']:
            if 'carrera' in validated_data:
                perfil.carrera = validated_data.get('carrera')
        elif role_changed:  # Si el rol cambió a algo que no es director/jefe
            perfil.carrera = None

        # 5. Gestionar 'docente'
        if final_rol == 'docente':
            if 'docente_data' in validated_data and validated_data.get('docente_data'):
                docente_serializer = DocenteSerializer(data=validated_data['docente_data'])
                docente_serializer.is_valid(raise_exception=True)
                docente_obj = docente_serializer.save()
                perfil.docente = docente_obj
            elif 'docente' in validated_data:
                perfil.docente = validated_data.get('docente')
        elif role_changed:  # Si el rol cambió a algo que no es docente
            perfil.docente = None
        
        # 6. Guardar el usuario. La señal post_save se encargará de guardar el perfil.
        instance.save()
        
        return instance
    
# ============================================
# SERIALIZERS PARA MODELOS NUEVOS (Reglamento UAB)
# ============================================

from .models import CalendarioAcademico, Proyecto, InformeFondo, ObservacionFondo, HistorialFondo


# =====================================================
# CALENDARIO ACADÉMICO SERIALIZER
# =====================================================

class CalendarioAcademicoSerializer(serializers.ModelSerializer):
    periodo_display = serializers.CharField(source='get_periodo_display', read_only=True)
    
    class Meta:
        model = CalendarioAcademico
        fields = [
            'id', 'gestion', 'periodo', 'periodo_display',
            'fecha_inicio', 'fecha_fin',
            'fecha_inicio_presentacion_proyectos',
            'fecha_limite_presentacion_proyectos',
            'semanas_efectivas', 'activo'
        ]


# =====================================================
# PROYECTO SERIALIZER
# =====================================================

class ProyectoSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    modalidad_display = serializers.CharField(source='get_modalidad_display', read_only=True)
    fondo_asignatura = serializers.CharField(source='fondo_tiempo.asignatura', read_only=True)
    categoria_nombre = serializers.CharField(source='categoria.get_tipo_display', read_only=True)
    
    class Meta:
        model = Proyecto
        fields = [
            'id', 'fondo_tiempo', 'fondo_asignatura', 'categoria', 'categoria_nombre',
            'titulo', 'tipo', 'tipo_display',
            # Campos obligatorios Art. 16
            'antecedentes', 'justificacion', 'objetivos', 'problema', 'cronograma',
            # Campos Art. 17 (cursos/seminarios)
            'es_curso_seminario', 'bibliografia', 'grupo_objetivo',
            'requisitos_asistencia', 'modalidad', 'modalidad_display',
            'frecuencia', 'horas_diarias', 'material_didactico',
            # Control
            'estado', 'estado_display', 'fecha_presentacion', 'fecha_aprobacion',
            'fecha_inicio', 'fecha_fin',
            'fecha_creacion', 'fecha_modificacion'
        ]
        read_only_fields = ['fecha_creacion', 'fecha_modificacion']


class ProyectoListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listados"""
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    fondo_asignatura = serializers.CharField(source='fondo_tiempo.asignatura', read_only=True)
    
    class Meta:
        model = Proyecto
        fields = [
            'id', 'titulo', 'tipo', 'tipo_display', 'estado', 'estado_display',
            'fondo_tiempo', 'fondo_asignatura', 'fecha_inicio', 'fecha_fin'
        ]


# =====================================================
# INFORME FONDO SERIALIZER
# =====================================================

class InformeFondoSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    cumplimiento_display = serializers.CharField(source='get_cumplimiento_display', read_only=True)
    elaborado_por_nombre = serializers.CharField(source='elaborado_por.get_full_name', read_only=True)
    evaluado_por_nombre = serializers.SerializerMethodField()
    fondo_asignatura = serializers.CharField(source='fondo_tiempo.asignatura', read_only=True)
    
    class Meta:
        model = InformeFondo
        fields = [
            'id', 'fondo_tiempo', 'fondo_asignatura',
            'tipo', 'tipo_display', 'fecha_elaboracion',
            'elaborado_por', 'elaborado_por_nombre',
            'resumen_ejecutivo', 'actividades_realizadas', 'resultados',
            'logros' , 'dificultades',
            'evidencias', 'observaciones',
            'cumplimiento', 'cumplimiento_display',
            'evaluacion_director', 'fecha_evaluacion',
            'evaluado_por', 'evaluado_por_nombre',
            'archivo_adjunto', 'fecha_modificacion'
        ]
        read_only_fields = ['fecha_elaboracion', 'fecha_modificacion']

    def get_evaluado_por_nombre(self, obj):
        """Retorna el nombre completo del evaluador si existe."""
        if obj.evaluado_por:
            return obj.evaluado_por.get_full_name()
        return None


class InformeFondoListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listados"""
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    cumplimiento_display = serializers.CharField(source='get_cumplimiento_display', read_only=True)
    fondo_asignatura = serializers.CharField(source='fondo_tiempo.asignatura', read_only=True)
    
    class Meta:
        model = InformeFondo
        fields = [
            'id', 'fondo_tiempo', 'fondo_asignatura', 'tipo', 'tipo_display',
            'cumplimiento', 'cumplimiento_display', 'fecha_elaboracion',
            'archivo_adjunto'
        ]


# =====================================================
# OBSERVACIÓN FONDO SERIALIZER
# =====================================================

class MensajeObservacionSerializer(serializers.ModelSerializer):
    """Serializer para mensajes individuales"""
    autor_nombre = serializers.SerializerMethodField()
    def get_autor_nombre(self, obj):
        nombre_completo = f"{obj.autor.first_name} {obj.autor.last_name}".strip()
        if nombre_completo:
            return nombre_completo
        return obj.autor.username
    autor_username = serializers.CharField(source='autor.username', read_only=True)
    
    class Meta:
        model = MensajeObservacion
        fields = [
            'id', 'observacion', 'autor', 'autor_nombre', 'autor_username',
            'texto', 'fecha', 'es_admin'
        ]
        read_only_fields = ['id', 'autor', 'fecha', 'es_admin']


class ObservacionFondoSerializer(serializers.ModelSerializer):
    """Serializer para hilos de observación"""
    mensajes = MensajeObservacionSerializer(many=True, read_only=True)
    resuelta_por_nombre = serializers.SerializerMethodField()
    cantidad_mensajes = serializers.SerializerMethodField()
    ultimo_mensaje = serializers.SerializerMethodField()
    
    class Meta:
        model = ObservacionFondo
        fields = [
            'id', 'fondo_tiempo', 'fecha_creacion', 'resuelta', 
            'resuelta_por', 'resuelta_por_nombre', 'fecha_resolucion',
            'mensajes', 'cantidad_mensajes', 'ultimo_mensaje'
        ]
        read_only_fields = ['id', 'fecha_creacion', 'resuelta', 'resuelta_por', 'fecha_resolucion']
    
    def get_cantidad_mensajes(self, obj):
        return obj.mensajes.count()
    
    def get_ultimo_mensaje(self, obj):
        ultimo = obj.mensajes.last()
        if ultimo:
            return {
                'texto': ultimo.texto,
                'autor': ultimo.autor.get_full_name(),
                'fecha': ultimo.fecha,
                'es_admin': ultimo.es_admin
            }
        return None

    def get_resuelta_por_nombre(self, obj):
        """Retorna el nombre completo del usuario que resolvió la observación."""
        if obj.resuelta_por:
            return obj.resuelta_por.get_full_name()
        return None



# =====================================================
# HISTORIAL FONDO SERIALIZER
# =====================================================

class HistorialFondoSerializer(serializers.ModelSerializer):
    tipo_cambio_display = serializers.CharField(source='get_tipo_cambio_display', read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.get_full_name', read_only=True)
    fondo_asignatura = serializers.CharField(source='fondo_tiempo.asignatura', read_only=True)
    
    class Meta:
        model = HistorialFondo
        fields = [
            'id', 'fondo_tiempo', 'fondo_asignatura',
            'usuario', 'usuario_nombre', 'fecha',
            'tipo_cambio', 'tipo_cambio_display', 'descripcion',
            'estado_anterior', 'estado_nuevo', 'datos_cambio'
        ]
        read_only_fields = ['fecha']


# =====================================================
# ACTUALIZACIÓN DE DOCENTE SERIALIZER
# =====================================================

class DocenteDetalleSerializer(serializers.ModelSerializer):
    """Serializer completo con propiedades calculadas"""
    nombre_completo = serializers.ReadOnlyField()
    horas_semanales_maximas = serializers.ReadOnlyField()
    horas_anuales_maximas = serializers.ReadOnlyField()
    dedicacion_display = serializers.CharField(source='get_dedicacion_display', read_only=True)
    categoria_display = serializers.CharField(source='get_categoria_display', read_only=True)
    
    class Meta:
        model = Docente
        fields = [
            'id', 'nombres', 'apellido_paterno', 'apellido_materno', 'ci',
            'categoria', 'categoria_display', 'dedicacion', 'dedicacion_display', 'fecha_ingreso',
            'email', 'telefono', 'activo', 'fecha_creacion',
            'nombre_completo', 'horas_semanales_maximas', 'horas_anuales_maximas'
        ]


# =====================================================
# ACTUALIZACIÓN DE FONDO TIEMPO SERIALIZER
# =====================================================

class FondoTiempoDetalleSerializer(serializers.ModelSerializer):
    """Serializer completo con todas las relaciones"""
    docente = DocenteDetalleSerializer(read_only=True)
    carrera = CarreraSerializer(read_only=True)
    calendario_academico = CalendarioAcademicoSerializer(read_only=True)
    
    periodo_display = serializers.CharField(source='get_periodo_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    # Aseguramos que se devuelva la URL como string explícito
    programa_analitico_url = serializers.URLField(read_only=True)
    
    # Propiedades calculadas
    porcentaje_completado = serializers.SerializerMethodField()
    horas_disponibles = serializers.SerializerMethodField()
    antiguedad = serializers.SerializerMethodField()
    
    # Relaciones
    categorias = CategoriaFuncionSerializer(many=True, read_only=True) # Nested serializer explícito
    requerimientos = CategoriaFuncionSerializer(many=True, read_only=True, source='categorias') # Alias para frontend
    proyectos = ProyectoListSerializer(many=True, read_only=True)
    informes = InformeFondoListSerializer(many=True, read_only=True)
    observaciones_detalladas = ObservacionFondoSerializer(many=True, read_only=True)
    informe_actual = serializers.SerializerMethodField()
    
    total_asignado = serializers.SerializerMethodField()
    # Permisos
    puede_editar = serializers.SerializerMethodField()
    puede_presentar = serializers.SerializerMethodField()
    
    class Meta:
        model = FondoTiempo
        fields = [
            'id', 'docente', 'carrera', 'calendario_academico',
            'gestion', 'periodo', 'periodo_display', 'asignatura',
            'semanas_año', 'horas_semana', 'horas_vacacion', 'horas_feriados',
            'contrato_horas', 'clases_aula_horas', 'funciones_sustantivas_horas',
            'horas_efectivas', 'total_asignado',
            'estado', 'estado_display', 'observaciones',
            'tiene_programa_analitico', 'programa_analitico_url',
            'fecha_presentacion', 'fecha_aprobacion', 'fecha_validacion',
            'aprobado_por', 'validado_por',
            'archivado', 'comentarios_admin',
            'fecha_creacion', 'fecha_modificacion',
            # Calculados
            'porcentaje_completado', 'horas_disponibles',
            'antiguedad', # Relaciones
            'categorias', 'requerimientos', 'proyectos', 'informes', 'observaciones_detalladas',
            'informe_actual',
            # Permisos
            'puede_editar', 'puede_presentar'
        ]
        read_only_fields = [
            'estado', 'horas_efectivas',
            'fecha_aprobacion', 'fecha_validacion',
            'programa_analitico_url'
        ]
    
    def get_total_asignado(self, obj):
        if not hasattr(obj, '_total_asignado_calculado'):
            if not obj.docente or not obj.calendario_academico:
                total = 0
            else:
                cargas = CargaHoraria.objects.filter(
                    docente=obj.docente,
                    calendario=obj.calendario_academico
                ).values('categoria').annotate(total=Sum('horas'))
                cargas_map = {c['categoria']: c['total'] for c in cargas}

                total_calculado = 0
                for cat in obj.categorias.all():
                    horas_jefatura = cargas_map.get(cat.tipo, 0) or 0
                    total_calculado += horas_jefatura if horas_jefatura > 0 else cat.total_horas
                
                total = total_calculado
            obj._total_asignado_calculado = total
        return obj._total_asignado_calculado

    def get_porcentaje_completado(self, obj):
        total_asignado = self.get_total_asignado(obj)
        if not obj.horas_efectivas or obj.horas_efectivas == 0:
            return 0
        return float((total_asignado / obj.horas_efectivas) * 100)

    def get_horas_disponibles(self, obj):
        total_asignado = self.get_total_asignado(obj)
        return obj.horas_efectivas - total_asignado

    def get_antiguedad(self, obj):
        if obj.docente:
            return obj.docente.calcular_antiguedad(obj.gestion)
        return 0

    def get_puede_editar(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            return obj.puede_editar(request.user)
        return False
    
    def get_puede_presentar(self, obj):
        return obj.puede_presentar()
    
    def get_informe_actual(self, obj):
        """Obtiene el informe más reciente del fondo"""
        informe = obj.informes.filter(tipo='parcial').order_by('-fecha_elaboracion').first()
        if informe:
            return InformeFondoSerializer(informe).data
        return None


# =====================================================
# SERIALIZERS PARA ACCIONES ESPECÍFICAS
# =====================================================

class PresentarFondoSerializer(serializers.Serializer):
    """Serializer para presentar fondo a Director"""
    observacion = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Observación opcional al presentar"
    )
    
    def validate(self, data):
        fondo = self.context.get('fondo')
        
        if not fondo.puede_presentar():
            errores = []
            if not fondo.tiene_programa_analitico:
                errores.append('Debe adjuntar el programa analítico')
            if fondo.total_asignado == 0:
                errores.append('Debe asignar horas a al menos una función')
            
            raise serializers.ValidationError(
                f"No se puede presentar el fondo: {', '.join(errores)}"
            )
        
        return data


class AprobarFondoSerializer(serializers.Serializer):
    """Serializer para aprobar fondo (Director)"""
    observacion = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Observación opcional al aprobar"
    )


class ObservarFondoSerializer(serializers.Serializer):
    """Serializer para observar/rechazar fondo"""
    observacion = serializers.CharField(
        required=True,
        min_length=10,
        help_text="Observación (mínimo 10 caracteres)"
    )
    accion = serializers.ChoiceField(
        choices=['observar', 'rechazar'],
        help_text="Acción a realizar"
    )
    
    def validate_observacion(self, value):
        if len(value.strip()) < 10:
            raise serializers.ValidationError(
                'La observación debe tener al menos 10 caracteres'
            )
        return value


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Serializer personalizado para devolver información extra en el login,
    específicamente si el usuario debe cambiar su contraseña.
    """
    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Agregar claims personalizados a la respuesta del token
        # Lógica de inmunidad: Admin (superuser) nunca es forzado a cambiar contraseña
        if self.user.is_superuser:
            data['debe_cambiar_password'] = False
        else:
            data['debe_cambiar_password'] = self.user.perfil.debe_cambiar_password
            
        data['user_id'] = self.user.id
        data['username'] = self.user.username
        data['rol'] = self.user.perfil.rol
        
        return data
