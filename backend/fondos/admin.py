from django.contrib import admin
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from .models import (
    Docente, Carrera, CalendarioAcademico, FondoTiempo,
    CategoriaFuncion, Actividad, Proyecto, InformeFondo,
    ObservacionFondo, HistorialFondo, PerfilUsuario,
    MensajeObservacion, HistorialFondo
)


# =====================================================
# DOCENTE ADMIN
# =====================================================

@admin.register(Docente)
class DocenteAdmin(admin.ModelAdmin):
    list_display = [
        'id','nombre_completo', 'ci', 'carrera', 'categoria', 'dedicacion',
        'horas_semanales_badge', 'email', 'activo'
    ]
    list_filter = ['carrera', 'categoria', 'dedicacion', 'activo']
    search_fields = ['nombres', 'apellido_paterno', 'apellido_materno', 'ci', 'email', 'carrera__nombre']
    ordering = ['carrera__facultad', 'carrera__nombre', 'apellido_paterno', 'apellido_materno', 'nombres']
    
    fieldsets = (
        ('Información Personal', {
            'fields': ('nombres', 'apellido_paterno', 'apellido_materno', 'ci', 'carrera')
        }),
        ('Información Laboral', {
            'fields': ('categoria', 'dedicacion'),
            'description': 'Tipo de dedicación según Reglamento UAB Art. 11'
        }),
        ('Contacto', {
            'fields': ('email', 'telefono', 'horas_contrato_semanales')
        }),
        ('Estado', {
            'fields': ('activo',)
        }),
    )
    
    def horas_semanales_badge(self, obj):
        horas = obj.horas_semanales_maximas
        if horas:
            color = '#10b981' if horas == 40 else '#f59e0b'
            return format_html(
                '<span style="color: white; background: {}; padding: 3px 10px; border-radius: 3px; font-weight: bold;">{} hrs/sem</span>',
                color, horas
            )
        return mark_safe('<span style="color: gray;">Sin límite</span>')
    horas_semanales_badge.short_description = 'Límite Semanal'


# =====================================================
# CARRERA ADMIN
# =====================================================

@admin.register(Carrera)
class CarreraAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'codigo', 'facultad', 'activo']
    list_filter = ['facultad', 'activo']
    search_fields = ['nombre', 'codigo', 'facultad']
    ordering = ['facultad', 'nombre']


# =====================================================
# CALENDARIO ACADÉMICO ADMIN (NUEVO)
# =====================================================

@admin.register(CalendarioAcademico)
class CalendarioAcademicoAdmin(admin.ModelAdmin):
    list_display = [
        '__str__', 'fecha_inicio', 'fecha_fin',
        'semanas_efectivas', 'activo_badge'
    ]
    list_filter = ['gestion', 'periodo', 'activo']
    search_fields = ['gestion']
    ordering = ['-gestion', '-periodo']
    
    fieldsets = (
        ('Periodo Académico', {
            'fields': ('gestion', 'periodo', 'semanas_efectivas')
        }),
        ('Fechas del Periodo', {
            'fields': ('fecha_inicio', 'fecha_fin')
        }),
        ('Presentación de Proyectos (Art. 18)', {
            'fields': (
                'fecha_inicio_presentacion_proyectos',
                'fecha_limite_presentacion_proyectos'
            ),
            'description': 'Fechas para presentación de proyectos y programas analíticos'
        }),
        ('Estado', {
            'fields': ('activo',)
        }),
    )
    
    def activo_badge(self, obj):
        if obj.activo:
            return mark_safe(
                '<span style="color: white; background: #10b981; padding: 3px 10px; border-radius: 3px; font-weight: bold;">✓ ACTIVO</span>'
            )
        return mark_safe('<span style="color: gray;">Inactivo</span>')
    activo_badge.short_description = 'Estado'


# =====================================================
# FONDO DE TIEMPO ADMIN
# =====================================================

@admin.register(FondoTiempo)
class FondoTiempoAdmin(admin.ModelAdmin):
    list_display = [
        'docente', 'asignatura', 'gestion', 'periodo',
        'estado_badge', 'porcentaje_badge', 'programa_badge'
    ]
    list_filter = ['estado', 'gestion', 'periodo', 'carrera', 'archivado']
    search_fields = [
        'docente__nombres', 'docente__apellido_paterno',
        'docente__apellido_materno', 'asignatura'
    ]
    ordering = ['-gestion', '-periodo', 'docente__apellido_paterno']
    
    fieldsets = (
        ('Información Básica', {
            'fields': ('docente', 'carrera', 'calendario_academico')
        }),
        ('Periodo Académico', {
            'fields': ('gestion', 'periodo', 'asignatura')
        }),
        ('Configuración de Horas', {
            'fields': (
                'semanas_año', 'horas_semana', 'horas_vacacion',
                'horas_feriados', 'horas_efectivas'
            ),
            'classes': ('collapse',)
        }),
        ('Programa Analítico (Art. 15, 18)', {
            'fields': ('tiene_programa_analitico', 'programa_analitico_url'),
            'description': 'Programa analítico obligatorio para presentación'
        }),
        ('Control de Estado', {
            'fields': (
                'estado', 'fecha_presentacion', 'fecha_aprobacion',
                'fecha_validacion', 'aprobado_por', 'validado_por'
            )
        }),
        ('Observaciones y Archivado', {
            'fields': ('observaciones', 'comentarios_admin', 'archivado'),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ['fecha_creacion', 'fecha_modificacion']
    
    def estado_badge(self, obj):
        colores = {
            'borrador': '#6b7280',
            'presentado_director': '#3b82f6',
            'revision_director': '#f59e0b',
            'aprobado_director': '#10b981',
            'en_ejecucion': '#8b5cf6',
            'finalizado': '#059669',
            'observado': '#ef4444',
            'rechazado': '#dc2626',
        }
        color = colores.get(obj.estado, '#6b7280')
        return format_html(
            '<span style="color: white; background: {}; padding: 3px 10px; border-radius: 3px;">{}</span>',
            color, obj.get_estado_display()
        )
    estado_badge.short_description = 'Estado'
    
    def porcentaje_badge(self, obj):
        porcentaje = obj.porcentaje_completado
        if porcentaje < 30:
            color = '#ef4444'
        elif porcentaje < 70:
            color = '#f59e0b'
        elif porcentaje < 100:
            color = '#10b981'
        else:
            color = '#059669'
        
        return format_html(
            '<span style="color: white; background: {}; padding: 3px 10px; border-radius: 3px; font-weight: bold;">{}%</span>',
            color,
            round(porcentaje, 1) 
        )
    porcentaje_badge.short_description = '% Completado'
    
    def programa_badge(self, obj):
        if obj.tiene_programa_analitico:
            return mark_safe('<span style="color: green; font-weight: bold;">✓ Sí</span>')
        return mark_safe('<span style="color: red;">✗ No</span>')
    programa_badge.short_description = 'Programa'


# =====================================================
# CATEGORÍA FUNCIÓN ADMIN
# =====================================================

@admin.register(CategoriaFuncion)
class CategoriaFuncionAdmin(admin.ModelAdmin):
    list_display = ['fondo_tiempo', 'tipo_display', 'total_horas', 'porcentaje']
    list_filter = ['tipo']
    search_fields = ['fondo_tiempo__asignatura', 'fondo_tiempo__docente__apellido_paterno']
    
    def tipo_display(self, obj):
        return obj.get_tipo_display()
    tipo_display.short_description = 'Función'


# =====================================================
# ACTIVIDAD ADMIN
# =====================================================

@admin.register(Actividad)
class ActividadAdmin(admin.ModelAdmin):
    list_display = ['detalle', 'categoria', 'horas_semana', 'horas_año', 'proyecto']
    list_filter = ['categoria__tipo']
    search_fields = ['detalle', 'categoria__fondo_tiempo__asignatura']
    ordering = ['categoria', 'orden']


# =====================================================
# PROYECTO ADMIN (NUEVO)
# =====================================================

@admin.register(Proyecto)
class ProyectoAdmin(admin.ModelAdmin):
    list_display = [
        'titulo', 'fondo_tiempo', 'tipo_display',
        'estado_badge', 'es_curso_seminario', 'fecha_presentacion'
    ]
    list_filter = ['tipo', 'estado', 'es_curso_seminario', 'modalidad']
    search_fields = [
        'titulo', 'fondo_tiempo__asignatura',
        'fondo_tiempo__docente__apellido_paterno'
    ]
    ordering = ['-fecha_creacion']
    
    fieldsets = (
        ('Información Básica', {
            'fields': ('fondo_tiempo', 'categoria', 'titulo', 'tipo')
        }),
        ('Campos Obligatorios (Art. 16)', {
            'fields': ('antecedentes', 'justificacion', 'objetivos', 'problema'),
            'description': 'Campos requeridos según Artículo 16 del reglamento'
        }),
        ('Cronograma', {
            'fields': ('cronograma',),
            'description': 'Lugar, fecha, hora de realización'
        }),
        ('Para Cursos/Seminarios (Art. 17)', {
            'fields': (
                'es_curso_seminario', 'bibliografia', 'grupo_objetivo',
                'requisitos_asistencia', 'modalidad', 'frecuencia',
                'horas_diarias', 'material_didactico'
            ),
            'classes': ('collapse',),
            'description': 'Campos adicionales si es curso, seminario o capacitación'
        }),
        ('Control', {
            'fields': (
                'estado', 'fecha_presentacion', 'fecha_aprobacion',
                'fecha_inicio', 'fecha_fin'
            )
        }),
    )
    
    def tipo_display(self, obj):
        return obj.get_tipo_display()
    tipo_display.short_description = 'Tipo'
    
    def estado_badge(self, obj):
        colores = {
            'borrador': '#6b7280',
            'presentado': '#3b82f6',
            'aprobado': '#10b981',
            'en_ejecucion': '#8b5cf6',
            'finalizado': '#059669',
            'observado': '#ef4444',
        }
        color = colores.get(obj.estado, '#6b7280')
        return format_html(
            '<span style="color: white; background: {}; padding: 3px 8px; border-radius: 3px;">{}</span>',
            color, obj.get_estado_display()
        )
    estado_badge.short_description = 'Estado'


# =====================================================
# INFORME FONDO ADMIN (NUEVO)
# =====================================================

@admin.register(InformeFondo)
class InformeFondoAdmin(admin.ModelAdmin):
    list_display = [
        'fondo_tiempo', 'tipo_display', 'cumplimiento_badge',
        'fecha_elaboracion', 'elaborado_por'
    ]
    list_filter = ['tipo', 'cumplimiento', 'fecha_elaboracion']
    search_fields = [
        'fondo_tiempo__asignatura',
        'fondo_tiempo__docente__apellido_paterno',
        'elaborado_por__username'
    ]
    ordering = ['-fecha_elaboracion']
    
    fieldsets = (
        ('Información Básica', {
            'fields': ('fondo_tiempo', 'tipo', 'elaborado_por')
        }),
        ('Contenido del Informe', {
            'fields': (
                'resumen_ejecutivo', 'actividades_realizadas',
                'resultados', 'evidencias', 'observaciones'
            )
        }),
        ('Evaluación (Director)', {
            'fields': (
                'cumplimiento', 'evaluacion_director',
                'fecha_evaluacion', 'evaluado_por'
            ),
            'description': 'Evaluación realizada por el Director de Carrera'
        }),
        ('Archivo Adjunto', {
            'fields': ('archivo_adjunto',),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ['fecha_elaboracion', 'fecha_modificacion']
    
    def tipo_display(self, obj):
        return obj.get_tipo_display()
    tipo_display.short_description = 'Tipo'
    
    def cumplimiento_badge(self, obj):
        if not obj.cumplimiento:
            return mark_safe('<span style="color: gray;">Pendiente</span>')
        
        colores = {
            'cumplido': '#10b981',
            'parcial': '#f59e0b',
            'incumplido': '#ef4444',
        }
        color = colores.get(obj.cumplimiento, '#6b7280')
        return format_html(
            '<span style="color: white; background: {}; padding: 3px 10px; border-radius: 3px;">{}</span>',
            color, obj.get_cumplimiento_display()
        )
    cumplimiento_badge.short_description = 'Cumplimiento'


# =====================================================
# OBSERVACIÓN FONDO ADMIN (NUEVO)
# =====================================================

@admin.register(ObservacionFondo)
class ObservacionFondoAdmin(admin.ModelAdmin):
    list_display = ['id', 'fondo_tiempo', 'fecha_creacion', 'resuelta']
    list_filter = ['resuelta', 'fecha_creacion']
    search_fields = ['fondo_tiempo__docente__nombres']
    readonly_fields = ['fecha_creacion', 'fecha_resolucion']
    ordering = ['-fecha_creacion']


@admin.register(MensajeObservacion)
class MensajeObservacionAdmin(admin.ModelAdmin):
    list_display = ['id', 'observacion', 'autor', 'fecha', 'es_admin']
    list_filter = ['es_admin', 'fecha']
    search_fields = ['texto', 'autor__username']
    readonly_fields = ['fecha']
    ordering = ['-fecha']


# =====================================================
# HISTORIAL FONDO ADMIN (NUEVO)
# =====================================================

@admin.register(HistorialFondo)
class HistorialFondoAdmin(admin.ModelAdmin):
    list_display = [
        'fondo_tiempo', 'tipo_cambio_display', 'usuario',
        'fecha', 'estado_anterior', 'estado_nuevo'
    ]
    list_filter = ['tipo_cambio', 'fecha']
    search_fields = [
        'fondo_tiempo__asignatura',
        'fondo_tiempo__docente__apellido_paterno',
        'usuario__username', 'descripcion'
    ]
    ordering = ['-fecha']
    
    fieldsets = (
        ('Información', {
            'fields': ('fondo_tiempo', 'usuario', 'fecha', 'tipo_cambio')
        }),
        ('Cambio de Estado', {
            'fields': ('estado_anterior', 'estado_nuevo', 'descripcion')
        }),
        ('Datos del Cambio', {
            'fields': ('datos_cambio',),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ['fecha']
    
    def tipo_cambio_display(self, obj):
        return obj.get_tipo_cambio_display()
    tipo_cambio_display.short_description = 'Tipo'
    
    def has_add_permission(self, request):
        # El historial se crea automáticamente
        return False
    
    def has_delete_permission(self, request, obj=None):
        # El historial no se puede eliminar
        return False


# =====================================================
# PERFIL USUARIO ADMIN
# =====================================================

@admin.register(PerfilUsuario)
class PerfilUsuarioAdmin(admin.ModelAdmin):
    list_display = ['user', 'rol_display', 'carrera', 'docente', 'activo']
    list_filter = ['rol', 'activo', 'carrera']
    search_fields = [
        'user__username', 'user__first_name', 'user__last_name',
        'docente__nombres', 'docente__apellido_paterno'
    ]
    
    fieldsets = (
        ('Usuario', {
            'fields': ('user', 'rol', 'activo')
        }),
        ('Relaciones', {
            'fields': ('docente', 'carrera')
        }),
        ('Contacto', {
            'fields': ('telefono',)
        }),
    )
    
    def rol_display(self, obj):
        return obj.get_rol_display()
    rol_display.short_description = 'Rol'


# Personalización del sitio admin
admin.site.site_header = "Sistema de Fondos de Tiempo - UAB"
admin.site.site_title = "Admin Fondos UAB"
admin.site.index_title = "Panel de Administración"