from rest_framework import serializers
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Docente, Carrera, Materia, FondoTiempo, CategoriaFuncion, Actividad, PerfilUsuario, InformeFondo, ObservacionFondo, MensajeObservacion, HistorialFondo, CargaHoraria, SaldoVacacionesGestion
from django.db.models import Sum
from django.db import transaction
from decimal import Decimal
    

def validar_unicidad_cargo_por_carrera(carrera, rol, exclude_user_id=None):
    """
    Garantiza que solo exista un Director, Jefe de Estudios o Admin activo por carrera.
    """
    if rol not in ['director', 'jefe_estudios', 'admin'] or not carrera:
        return

    cargos = {
        'director': 'Director',
        'jefe_estudios': 'Jefe de Estudios',
        'admin': 'Administrador',
    }

    queryset = PerfilUsuario.objects.filter(
        rol=rol,
        carrera=carrera,
        activo=True,
        user__is_active=True,
    )

    if exclude_user_id:
        queryset = queryset.exclude(user_id=exclude_user_id)

    if queryset.exists():
        raise serializers.ValidationError(
            f'La carrera de {carrera.nombre} ya tiene un {cargos[rol]} asignado. '
            'Debe dar de baja al titular actual antes de asignar uno nuevo'
        )


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
    carrera_id = serializers.SerializerMethodField()
    carrera_nombre = serializers.SerializerMethodField()
    carrera = serializers.PrimaryKeyRelatedField(
        queryset=Carrera.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Docente
        fields = '__all__'

    def get_usuario_email(self, obj):
        """Obtiene el email del usuario asociado al docente si existe."""
        if hasattr(obj, 'usuario') and obj.usuario and obj.usuario.user:
            return obj.usuario.user.email
        return None

    def get_carrera_id(self, obj):
        """Obtiene la carrera asociada al perfil vinculado del docente si existe."""
        if hasattr(obj, 'usuario') and obj.usuario and obj.usuario.carrera:
            return obj.usuario.carrera.id
        return None

    def get_carrera_nombre(self, obj):
        """Obtiene el nombre de la carrera asociada al perfil vinculado del docente si existe."""
        if hasattr(obj, 'usuario') and obj.usuario and obj.usuario.carrera:
            return obj.usuario.carrera.nombre
        return None

    def validate_horas_contrato_semanales(self, value):
        """
        🔒 BLINDAJE: Valida que las horas de contrato semanales estén dentro del rango permitido.
        Límite máximo: 56 horas semanales (Art. 13 del reglamento)
        """
        if value is not None:
            if value < 1:
                raise serializers.ValidationError(
                    'Las horas semanales deben ser al menos 1 hora.'
                )
            if value > 56:
                raise serializers.ValidationError(
                    '⚠️ Límite excedido: La carga horaria no puede superar las 56 horas semanales. '
                    'Este es el máximo permitido por el reglamento para dedicación Horario.'
                )
        return value

    def validate_ci(self, value):
        ci_normalizado = (value or '').strip()
        if not ci_normalizado:
            return ci_normalizado

        perfiles_conflicto = PerfilUsuario.objects.filter(ci=ci_normalizado)
        if self.instance:
            perfiles_conflicto = perfiles_conflicto.exclude(docente=self.instance)

        perfil_conflicto = perfiles_conflicto.select_related('user').first()
        if perfil_conflicto and perfil_conflicto.user:
            rol_conflicto = perfil_conflicto.get_rol_display() if hasattr(perfil_conflicto, 'get_rol_display') else perfil_conflicto.rol
            raise serializers.ValidationError(
                f'El CI ya esta registrado en el usuario "{perfil_conflicto.user.username}" ({rol_conflicto}).'
            )

        return ci_normalizado

    def validate(self, data):
        """
        🔒 BLINDAJE: Validaciones adicionales para el docente.
        - Verifica límite de 56 horas semanales
        - Valida coherencia entre dedicación y horas
        """
        dedicacion = data.get('dedicacion', self.instance.dedicacion if self.instance else None)
        horas_contrato = data.get('horas_contrato_semanales',
                                   self.instance.horas_contrato_semanales if self.instance else None)

        # Validar que Horario tenga horas de contrato
        if dedicacion == 'horario':
            if not horas_contrato or horas_contrato <= 0:
                raise serializers.ValidationError({
                    'horas_contrato_semanales': 'Para dedicación "Horario", debe especificar un número de horas de contrato semanales mayor a cero.'
                })

            # 🔒 VALIDACIÓN DE LÍMITE DE 56 HORAS
            if horas_contrato > 56:
                raise serializers.ValidationError({
                    'horas_contrato_semanales': 
                    f'⚠️ LÍMITE EXCEDIDO: Has ingresado {horas_contrato} horas semanales, pero el máximo permitido es 56 horas. '
                    'Por favor, ajusta la carga horaria para cumplir con el reglamento.'
                })

        # Validar coherencia para Tiempo Completo (40 horas fijas)
        if dedicacion == 'tiempo_completo':
            if horas_contrato and horas_contrato > 40:
                raise serializers.ValidationError({
                    'horas_contrato_semanales': 
                    f'⚠️ INCOHERENCIA: Para dedicación "Tiempo Completo" el máximo es 40 horas, pero has ingresado {horas_contrato} horas.'
                })

        # Validar coherencia para Medio Tiempo (20 horas fijas)
        if dedicacion == 'medio_tiempo':
            if horas_contrato and horas_contrato > 20:
                raise serializers.ValidationError({
                    'horas_contrato_semanales': 
                    f'⚠️ INCOHERENCIA: Para dedicación "Medio Tiempo" el máximo es 20 horas, pero has ingresado {horas_contrato} horas.'
                })

        carrera = data.get('carrera')
        if self.instance is None and not carrera:
            raise serializers.ValidationError({
                'carrera': 'Debe seleccionar una carrera para el docente.'
            })
        if self.instance is not None and 'carrera' in data and not carrera:
            raise serializers.ValidationError({
                'carrera': 'Debe seleccionar una carrera valida para el docente.'
            })

        return data

    def create(self, validated_data):
        carrera = validated_data.pop('carrera', None)
        docente = super().create(validated_data)

        perfil = PerfilUsuario.objects.filter(docente=docente).first()
        if perfil:
            if carrera is not None:
                perfil.carrera = carrera
                perfil.save(update_fields=['carrera'])
        else:
            PerfilUsuario.objects.create(
                user=None,
                docente=docente,
                rol='docente',
                carrera=carrera,
                telefono='',
                activo=True,
                debe_cambiar_password=False,
            )

        return docente

    def update(self, instance, validated_data):
        carrera = validated_data.pop('carrera', serializers.empty)
        docente = super().update(instance, validated_data)

        if carrera is not serializers.empty:
            perfil, _ = PerfilUsuario.objects.get_or_create(
                docente=docente,
                defaults={
                    'user': None,
                    'rol': 'docente',
                    'carrera': carrera,
                    'telefono': '',
                    'activo': True,
                    'debe_cambiar_password': False,
                }
            )
            if perfil.carrera != carrera:
                perfil.carrera = carrera
                perfil.save(update_fields=['carrera'])

        return docente


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
    logo_carrera = serializers.SerializerMethodField(read_only=True)
    logo_carrera_file = serializers.ImageField(write_only=True, required=False, allow_null=True)
    remove_logo_carrera = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = Carrera
        fields = [
            'id',
            'nombre',
            'codigo',
            'facultad',
            'activo',
            'logo_carrera',
            'logo_carrera_file',
            'remove_logo_carrera',
        ]

    def get_logo_carrera(self, obj):
        return obj.get_logo_carrera_data_uri()

    def create(self, validated_data):
        logo_file = validated_data.pop('logo_carrera_file', None)
        validated_data.pop('remove_logo_carrera', None)

        instance = super().create(validated_data)
        if logo_file:
            instance.set_logo_carrera_cifrada(logo_file)
            instance.save(update_fields=['logo_carrera', 'logo_carrera_cifrada', 'logo_carrera_mime'])
        return instance

    def update(self, instance, validated_data):
        logo_file = validated_data.pop('logo_carrera_file', serializers.empty)
        remove_logo = validated_data.pop('remove_logo_carrera', False)

        instance = super().update(instance, validated_data)

        if remove_logo:
            instance.clear_logo_carrera()
            instance.save(update_fields=['logo_carrera', 'logo_carrera_cifrada', 'logo_carrera_mime'])
            return instance

        if logo_file is not serializers.empty and logo_file is not None:
            instance.set_logo_carrera_cifrada(logo_file)
            instance.save(update_fields=['logo_carrera', 'logo_carrera_cifrada', 'logo_carrera_mime'])

        return instance


class MateriaSerializer(serializers.ModelSerializer):
    carrera_nombre = serializers.CharField(source='carrera.nombre', read_only=True)
    horas_totales = serializers.ReadOnlyField()

    class Meta:
        model = Materia
        fields = '__all__'

    def validate(self, attrs):
        instance = getattr(self, 'instance', None)

        sigla = attrs.get('sigla', getattr(instance, 'sigla', None))
        horas_teoricas = attrs.get('horas_teoricas', getattr(instance, 'horas_teoricas', 0))
        horas_practicas = attrs.get('horas_practicas', getattr(instance, 'horas_practicas', 0))

        errors = {}

        if horas_teoricas is None or horas_teoricas < 0:
            errors['horas_teoricas'] = 'Las horas teóricas deben ser positivas o cero.'

        if horas_practicas is None or horas_practicas < 0:
            errors['horas_practicas'] = 'Las horas prácticas deben ser positivas o cero.'

        total_horas_semana = (horas_teoricas or 0) + (horas_practicas or 0)
        if total_horas_semana <= 0:
            errors['non_field_errors'] = ['La materia debe tener al menos una carga horaria positiva.']

        # Relación reglamentaria usada en el sistema para materia semestral.
        horas_periodo_20_semanas = total_horas_semana * 20
        if horas_periodo_20_semanas <= 0:
            errors['non_field_errors'] = ['La relación con 20 semanas debe resultar en horas mayores a cero.']

        if sigla:
            sigla_qs = Materia.objects.filter(sigla__iexact=sigla)
            if instance:
                sigla_qs = sigla_qs.exclude(pk=instance.pk)
            if sigla_qs.exists():
                errors['sigla'] = 'Ya existe una materia con esta sigla.'

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def _raise_model_validation_error(self, exc):
        detail = getattr(exc, 'message_dict', None) or {'non_field_errors': exc.messages}
        raise serializers.ValidationError(detail)

    def create(self, validated_data):
        instance = Materia(**validated_data)
        try:
            instance.full_clean()
        except DjangoValidationError as exc:
            self._raise_model_validation_error(exc)
        instance.save()
        return instance

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        try:
            instance.full_clean()
        except DjangoValidationError as exc:
            self._raise_model_validation_error(exc)

        instance.save()
        return instance


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

    def validate(self, data):
        """
        🔒 BLINDAJE: Validación de horas acumuladas (Límite 56 horas semanales)
        Verifica que la suma de todas las actividades no supere el límite del docente.
        """
        # Obtener el docente (puede venir en data o ya existir en la instancia)
        docente = data.get('docente')
        if not docente and hasattr(self, 'instance') and self.instance:
            docente = self.instance.docente
        
        if not docente:
            return data
        
        # Obtener horas máximas del docente según su dedicación
        horas_maximas_semanales = docente.horas_semanales_maximas
        
        # Calcular total de horas asignadas en este fondo de tiempo
        total_horas_asignadas = Decimal(0)
        
        # Si estamos actualizando, obtener las categorías existentes
        if self.instance and hasattr(self.instance, 'categorias'):
            for categoria in self.instance.categorias.all():
                total_horas_asignadas += categoria.total_horas or Decimal(0)
        
        # Convertir a horas semanales (asumiendo 52 semanas por año)
        horas_semanales_asignadas = total_horas_asignadas / Decimal(52)
        
        # 🔒 VALIDACIÓN DE LÍMITE DE 56 HORAS SEMANALES
        if horas_semanales_asignadas > Decimal('56'):
            raise serializers.ValidationError({
                'horas_efectivas': 
                f'⚠️ LÍMITE EXCEDIDO: La suma de todas las actividades ({horas_semanales_asignadas:.2f} horas/semana) '
                f'supera el máximo permitido de 56 horas semanales. '
                f'Total anual: {total_horas_asignadas:.2f} horas. '
                f'Por favor, reduce la carga de actividades.'
            })
        
        # Validación adicional: comparar con el límite específico del docente
        if horas_semanales_asignadas > horas_maximas_semanales:
            raise serializers.ValidationError({
                'horas_efectivas': 
                f'⚠️ LÍMITE PERSONAL EXCEDIDO: Tu dedicación ({docente.dedicacion}) tiene un límite de '
                f'{horas_maximas_semanales} horas semanales, pero has asignado {horas_semanales_asignadas:.2f} horas. '
                f'Por favor, ajusta las actividades para cumplir con tu dedicación.'
            })
        
        return data

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
    docente_id = serializers.SerializerMethodField()
    foto_perfil = serializers.SerializerMethodField()

    class Meta:
        model = PerfilUsuario
        fields = ['id', 'rol', 'carrera', 'carrera_nombre', 'docente', 'docente_id', 'docente_nombre',
                  'telefono', 'activo', 'foto_perfil', 'debe_cambiar_password']

    def get_carrera_nombre(self, obj):
        """Retorna el nombre de la carrera si existe, si no, None."""
        return obj.carrera.nombre if obj.carrera else None

    def get_docente_nombre(self, obj):
        """Retorna el nombre completo del docente si existe, si no, None."""
        return obj.docente.nombre_completo if obj.docente else None

    def get_docente_id(self, obj):
        """Retorna el ID del docente si existe, si no, None."""
        return obj.docente.id if obj.docente else None

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
    ci = serializers.SerializerMethodField()
    carrera_codigo = serializers.SerializerMethodField()
    telefono = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'nombre_completo',
                  'is_staff', 'is_superuser', 'is_active', 'date_joined', 'perfil',
                  'ci', 'carrera_codigo', 'telefono']
        read_only_fields = ['id', 'date_joined']

    def get_perfil(self, obj):
        """
        Retorna los datos del perfil si existe, de lo contrario retorna None.
        Esto previene errores si un usuario no tiene un perfil asociado.
        """
        if hasattr(obj, 'perfil'):
            data = PerfilUsuarioSerializer(obj.perfil, context=self.context).data

            # 🔒 PROTECCIÓN INTEGRAL: Validar vínculo docente
            # Si el rol es 'docente' pero no tiene docente vinculado, marcar error
            if data.get('rol') == 'docente' and not data.get('docente'):
                data['error_vinculo'] = True
                data['mensaje_error'] = 'Usuario sin docente vinculado. Contacta al administrador.'

            # GARANTÍA DE ACCESO: Si es superusuario, el frontend SIEMPRE debe verlo como admin
            if obj.is_superuser:
                data['rol'] = 'admin'
                # FIX: Forzar que al admin NUNCA se le pida cambio de contraseña, ignorando la BD
                data['debe_cambiar_password'] = False
                # Los superusuarios nunca tienen error de vínculo
                data.pop('error_vinculo', None)
                data.pop('mensaje_error', None)
            return data

        # Fallback de seguridad: Si es superusuario pero NO tiene perfil creado (error de integridad),
        # devolvemos una estructura simulada de admin para no bloquear el acceso.
        if obj.is_superuser:
            return {
                'id': None,
                'rol': 'admin',
                'carrera': None,
                'carrera_codigo': None,
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

    def get_ci(self, obj):
        """
        Retorna el CI del docente vinculado; si no existe, usa CI del perfil.
        """
        if hasattr(obj, 'perfil') and obj.perfil:
            if obj.perfil.docente and obj.perfil.docente.ci:
                return obj.perfil.docente.ci
            if obj.perfil.ci:
                return obj.perfil.ci
        return None

    def get_carrera_codigo(self, obj):
        """
        Retorna el código de la carrera si el usuario tiene una asignada.
        """
        if hasattr(obj, 'perfil') and obj.perfil and obj.perfil.carrera:
            return obj.perfil.carrera.codigo
        return None

    def get_telefono(self, obj):
        """
        Retorna el teléfono del perfil del usuario.
        """
        if hasattr(obj, 'perfil') and obj.perfil:
            return obj.perfil.telefono or ''
        return ''


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
        # Obtener usuario actual del contexto (quien está creando)
        request = self.context.get('request')
        current_user = request.user if request else None
        
        # Validar que las contraseñas coincidan
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({
                'password_confirm': 'Las contraseñas no coinciden'
            })

        # Validar que solo superuser pueda asignar rol 'admin'
        if data['rol'] == 'admin':
            if not current_user or not current_user.is_superuser:
                raise serializers.ValidationError({
                    'rol': 'Solo un SuperAdmin puede asignar el rol de Administrador de Carrera.'
                })

        # Validar que admin, director y jefe_estudios tengan carrera asignada
        if data['rol'] in ['admin', 'director', 'jefe_estudios'] and not data.get('carrera'):
            raise serializers.ValidationError({
                'carrera': 'Los administradores, directores y jefes de estudio deben tener una carrera asignada'
            })

        # Validar unicidad de cargos por carrera (admin, director, jefe_estudios)
        if data['rol'] in ['admin', 'director', 'jefe_estudios']:
            validar_unicidad_cargo_por_carrera(data.get('carrera'), data['rol'])

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
        with transaction.atomic():
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

            perfil_existente = None
            if docente_obj:
                perfil_existente = PerfilUsuario.objects.filter(docente=docente_obj).select_related('user').first()
                if perfil_existente and perfil_existente.user and perfil_existente.user_id != user.id:
                    raise serializers.ValidationError({
                        'docente': f'El docente "{docente_obj.nombre_completo}" ya esta vinculado a otro usuario.'
                    })

            # Asignar is_staff para roles de autoridad que lo requieran
            if rol in ['admin', 'director', 'jefe_estudios']:
                user.is_staff = True
                user.save(update_fields=['is_staff'])

            # Actualizar perfil (se crea automáticamente por signal)
            # VERIFICACIÓN: Si no existe el perfil, crearlo manualmente
            if perfil_existente:
                perfil = perfil_existente
                if hasattr(user, 'perfil') and user.perfil and user.perfil.id != perfil.id:
                    user.perfil.delete()
                perfil.user = user
                perfil.rol = rol
                perfil.carrera = carrera or perfil.carrera
                perfil.docente = docente_obj
                perfil.telefono = ''
                perfil.activo = True
                perfil.debe_cambiar_password = False
                perfil.save()
            elif not hasattr(user, 'perfil'):
                # La signal falló, crear perfil manualmente
                PerfilUsuario.objects.create(
                    user=user,
                    rol=rol,
                    carrera=carrera,
                    docente=docente_obj,
                    telefono='',
                    activo=True,
                    debe_cambiar_password=False
                )
            else:
                # Perfil existe, actualizarlo
                user.perfil.rol = rol
                user.perfil.carrera = carrera
                user.perfil.docente = docente_obj
                user.perfil.save()

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
    ci = serializers.CharField(required=False, allow_blank=True)
    
    class Meta:
        model = User
        fields = ['email', 'first_name', 'last_name', 'is_active', 
                  'rol', 'carrera', 'docente', 'docente_data', 'ci']
        extra_kwargs = {
            'first_name': {'allow_blank': False},
            'last_name': {'allow_blank': False},
            'email': {'allow_blank': False},
        }

    def _get_perfil_actual(self):
        return PerfilUsuario.objects.filter(user=self.instance).first()

    def _mensaje_conflicto_ci_docente(self, docente_conflicto):
        perfil_vinculado = PerfilUsuario.objects.filter(docente=docente_conflicto).select_related('user').first()
        if perfil_vinculado and perfil_vinculado.user:
            rol_conflicto = perfil_vinculado.get_rol_display() if hasattr(perfil_vinculado, 'get_rol_display') else perfil_vinculado.rol
            return f'El CI ya esta registrado en el usuario "{perfil_vinculado.user.username}" ({rol_conflicto}).'
        return f'El CI ya esta registrado en el docente "{docente_conflicto.nombre_completo}".'
    
    def validate(self, data):
        """
        Valida los datos para asegurar la consistencia al cambiar de rol.
        """
        # Obtener usuario actual del contexto (quien está editando)
        request = self.context.get('request')
        current_user = request.user if request else None
        
        perfil_actual = self._get_perfil_actual()
        rol_actual = perfil_actual.rol if perfil_actual else ('admin' if self.instance.is_superuser else 'docente')
        carrera_actual = perfil_actual.carrera if perfil_actual else None
        docente_actual = perfil_actual.docente if perfil_actual else None

        # Determina el rol final (el nuevo si se provee, o el existente si no)
        rol = data.get('rol', rol_actual)
        carrera_final = data.get('carrera', carrera_actual)
        is_active_final = data.get('is_active', self.instance.is_active)
        es_superusuario_objetivo = bool(self.instance.is_superuser)

        if es_superusuario_objetivo:
            if 'is_active' in data and data.get('is_active') is False:
                raise serializers.ValidationError({'is_active': 'El Super Admin no puede desactivarse.'})
            if 'rol' in data and data.get('rol') != 'admin':
                raise serializers.ValidationError({'rol': 'El rol del Super Admin no puede modificarse.'})

        # Regla 0: Solo superuser puede asignar rol 'admin'
        if rol == 'admin' and rol_actual != 'admin':
            # Se está intentando asignar rol admin a alguien que no era admin
            if not current_user or not current_user.is_superuser:
                raise serializers.ValidationError({
                    'rol': 'Solo un SuperAdmin puede asignar el rol de Administrador de Carrera.'
                })

        # Regla 0.5: Admin, Directores y Jefes de Estudio deben tener carrera
        if rol in ['admin', 'director', 'jefe_estudios'] and not es_superusuario_objetivo:
            # Se está intentando poner la carrera a null explícitamente?
            if 'carrera' in data and data.get('carrera') is None:
                raise serializers.ValidationError({'carrera': 'Los administradores, directores y jefes de estudio deben tener una carrera asignada.'})
            # No se está proveyendo una carrera y el usuario no tiene una ya?
            if 'carrera' not in data and not carrera_actual:
                raise serializers.ValidationError({'carrera': 'Debe asignar una carrera para este rol.'})
            if is_active_final:
                validar_unicidad_cargo_por_carrera(
                    carrera_final,
                    rol,
                    exclude_user_id=self.instance.id,
                )

        # Regla 1: Directores y Jefes de Estudio deben tener una carrera.
        if rol in ['director', 'jefe_estudios'] and 'carrera' not in data:
            # Validación adicional específica para director/jefe (ya cubierta por regla 0.5 para admin)
            pass  # La validación ya se hizo arriba

        # Regla 1.5: Admin, Director, Jefe de Estudios NO pueden tener docente vinculado
        if rol in ['admin', 'director', 'jefe_estudios']:
            if 'docente' in data and data.get('docente') is not None:
                raise serializers.ValidationError({
                    'docente': f'Un usuario con rol {rol.replace("_", " ")} no puede tener un docente vinculado.'
                })
            # Si ya tiene docente, se eliminará en el update
        
        # Regla 2: El rol de Docente debe tener un perfil de docente asociado.
        if rol == 'docente':
            docente_objetivo = data.get('docente', docente_actual)

            if docente_objetivo is not None:
                perfil_docente = PerfilUsuario.objects.filter(docente=docente_objetivo).select_related('user').first()
                if perfil_docente and perfil_docente.user and perfil_docente.user_id != self.instance.id:
                    raise serializers.ValidationError({
                        'docente': f'El docente "{docente_objetivo.nombre_completo}" ya esta vinculado al usuario "{perfil_docente.user.username}".'
                    })

            # Se está intentando poner el docente a null y no se crea uno nuevo?
            if 'docente' in data and data.get('docente') is None and not data.get('docente_data'):
                raise serializers.ValidationError({'docente': 'El rol de Docente requiere un perfil de docente asociado.'})
            # No se provee un docente y el usuario no tiene uno ya?
            if 'docente' not in data and 'docente_data' not in data and not docente_actual:
                raise serializers.ValidationError({'docente': 'Debe asociar un perfil de docente para este rol.'})

        return data
    
    def update(self, instance, validated_data):
        perfil, _ = PerfilUsuario.objects.get_or_create(
            user=instance,
            defaults={
                'rol': 'admin' if instance.is_superuser else 'docente',
                'activo': instance.is_active,
                'debe_cambiar_password': not instance.is_superuser,
            }
        )
        ci = validated_data.pop('ci', None)

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
        perfil.activo = instance.is_active

        # 3. Ajustar 'is_staff' según el rol final
        if final_rol in ['admin', 'director', 'jefe_estudios']:
            instance.is_staff = True
        else:
            instance.is_staff = False

        # 4. Gestionar 'carrera'
        # Se permite guardar carrera para docente cuando viene desde el flujo de creacion/vinculacion.
        if 'carrera' in validated_data:
            perfil.carrera = validated_data.get('carrera')

        # 4.1 Gestionar 'ci' (se guarda en Docente si existe vínculo)
        if ci is not None:
            ci_normalizado = ci.strip() if ci else ''
            docente_objetivo = validated_data.get('docente', perfil.docente)
            
            # Si el CI es vacío, limpiar
            if not ci_normalizado:
                if perfil.docente:
                    perfil.docente.ci = ''
                    perfil.docente.save(update_fields=['ci'])
                perfil.ci = None
            else:
                # Validar que no exista en otros docentes (siempre), excluyendo el docente actual o el seleccionado
                docentes_con_ci = Docente.objects.filter(ci=ci_normalizado)
                docentes_a_excluir = []
                if perfil.docente:
                    docentes_a_excluir.append(perfil.docente.id)
                if docente_objetivo:
                    docentes_a_excluir.append(docente_objetivo.id)
                if docentes_a_excluir:
                    docentes_con_ci = docentes_con_ci.exclude(id__in=docentes_a_excluir)

                docente_conflicto = docentes_con_ci.first()
                if docente_conflicto:
                    raise serializers.ValidationError({'ci': self._mensaje_conflicto_ci_docente(docente_conflicto)})
                
                # Validar que no exista en otros perfiles
                perfiles_conflicto = PerfilUsuario.objects.filter(
                    ci=ci_normalizado
                ).exclude(id=perfil.id).exists()
                if perfiles_conflicto:
                    perfil_conflicto = PerfilUsuario.objects.filter(ci=ci_normalizado).exclude(id=perfil.id).select_related('user').first()
                    if perfil_conflicto and perfil_conflicto.user:
                        rol_conflicto = perfil_conflicto.get_rol_display() if hasattr(perfil_conflicto, 'get_rol_display') else perfil_conflicto.rol
                        raise serializers.ValidationError({'ci': f'El CI ya esta registrado en el usuario "{perfil_conflicto.user.username}" ({rol_conflicto}).'})
                    raise serializers.ValidationError({'ci': 'El CI ya esta registrado en otro usuario.'})
                
                # Guardar CI en docente si existe vínculo
                if docente_objetivo:
                    docente_objetivo.ci = ci_normalizado
                    docente_objetivo.save(update_fields=['ci'])
                
                # Guardar CI en perfil
                perfil.ci = ci_normalizado

        # 5. Gestionar 'docente'
        if final_rol == 'docente':
            if 'docente_data' in validated_data and validated_data.get('docente_data'):
                docente_serializer = DocenteSerializer(data=validated_data['docente_data'])
                docente_serializer.is_valid(raise_exception=True)
                docente_obj = docente_serializer.save()
                perfil.docente = docente_obj
            elif 'docente' in validated_data:
                docente_objetivo = validated_data.get('docente')

                # Si existe un perfil huerfano (user=None) para ese docente,
                # liberamos el docente de ese perfil y transferimos datos utiles.
                if docente_objetivo is not None:
                    perfil_huerfano = PerfilUsuario.objects.filter(
                        docente=docente_objetivo,
                        user__isnull=True,
                    ).exclude(id=perfil.id).first()

                    if perfil_huerfano:
                        if not perfil.carrera and perfil_huerfano.carrera:
                            perfil.carrera = perfil_huerfano.carrera
                        if not perfil.telefono and perfil_huerfano.telefono:
                            perfil.telefono = perfil_huerfano.telefono

                        perfil_huerfano.docente = None
                        perfil_huerfano.save(update_fields=['docente'])

                perfil.docente = docente_objetivo
        else:
            # Si el rol NO es docente, siempre limpiar el docente vinculado
            perfil.docente = None
        
        # 6. Guardar el perfil con todos los cambios
        perfil.save()
        
        # 7. Guardar el usuario. La señal post_save se encargará de sincronizar es_active.
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

    def validate(self, attrs):
        instance = getattr(self, 'instance', None)

        fecha_inicio = attrs.get('fecha_inicio', getattr(instance, 'fecha_inicio', None))
        fecha_fin = attrs.get('fecha_fin', getattr(instance, 'fecha_fin', None))
        fecha_inicio_proy = attrs.get(
            'fecha_inicio_presentacion_proyectos',
            getattr(instance, 'fecha_inicio_presentacion_proyectos', None)
        )
        fecha_fin_proy = attrs.get(
            'fecha_limite_presentacion_proyectos',
            getattr(instance, 'fecha_limite_presentacion_proyectos', None)
        )

        if fecha_inicio and fecha_fin and fecha_fin < fecha_inicio:
            raise serializers.ValidationError({
                'fecha_fin': 'La fecha de finalización no puede ser anterior a la de inicio.'
            })

        if fecha_inicio_proy and fecha_fin_proy and fecha_fin_proy <= fecha_inicio_proy:
            raise serializers.ValidationError({
                'fecha_limite_presentacion_proyectos': 'La fecha límite de proyectos debe ser posterior a la fecha de inicio.'
            })

        if fecha_inicio and fecha_fin and fecha_inicio_proy:
            if fecha_inicio_proy < fecha_inicio or fecha_inicio_proy > fecha_fin:
                raise serializers.ValidationError({
                    'fecha_inicio_presentacion_proyectos': 'Error Crítico: la fecha de inicio de presentación de proyectos debe estar dentro del rango del periodo académico.'
                })

        if fecha_inicio and fecha_fin and fecha_fin_proy:
            if fecha_fin_proy < fecha_inicio or fecha_fin_proy > fecha_fin:
                raise serializers.ValidationError({
                    'fecha_limite_presentacion_proyectos': 'Error Crítico: la fecha límite de presentación de proyectos debe estar dentro del rango del periodo académico.'
                })

        return attrs


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
