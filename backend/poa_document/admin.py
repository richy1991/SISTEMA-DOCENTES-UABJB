from django.contrib import admin
from poa_document.models import UsuarioPOA, Direccion, DocumentoPOA, RevisionDocumentoPOA, HistorialDocumentoPOA

@admin.register(UsuarioPOA)
class UsuarioPOAAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'rol', 'nombre_entidad', 'activo', 'fecha_asignacion')
    list_filter = ('rol', 'activo')
    search_fields = ('user__username', 'user__first_name', 'user__last_name',
                     'docente__nombres', 'docente__apellido_paterno', 'nombre_entidad')
    ordering = ('rol',)
       

@admin.register(Direccion)
class DireccionAdmin(admin.ModelAdmin):
    list_display = ('nombre',)
    search_fields = ('nombre',)
    ordering = ('nombre',)

@admin.register(DocumentoPOA)
class DocumentoPOAAdmin(admin.ModelAdmin):  
    list_display = ('gestion', 'unidad_solicitante', 'programa', 'estado', 'elaborado_por', 'jefe_unidad', 'fecha_elaboracion')
    search_fields = ('programa', 'objetivo_gestion_institucional')
    list_filter = ('gestion', 'unidad_solicitante', 'estado')
    ordering = ('-gestion', 'unidad_solicitante', 'programa')   
    date_hierarchy = 'fecha_elaboracion'
    readonly_fields = ('creado_en', 'actualizado_en')
    fieldsets = (
        (None, {
            'fields': ('gestion', 'unidad_solicitante', 'programa', 'objetivo_gestion_institucional', 'estado', 'observaciones')
        }),
        ('Responsables', {
            'fields': ('elaborado_por', 'jefe_unidad')
        }),
        ('Fechas', {
            'fields': ('fecha_elaboracion', 'creado_en', 'actualizado_en')
        }),
    )


@admin.register(RevisionDocumentoPOA)
class RevisionDocumentoPOAAdmin(admin.ModelAdmin):
    list_display = ('documento', 'ciclo_revision', 'revisor', 'tipo_revisor', 'estado', 'activo', 'fecha_asignacion', 'fecha_respuesta')
    list_filter = ('tipo_revisor', 'estado', 'activo', 'ciclo_revision')
    search_fields = ('documento__programa', 'revisor__user__username', 'revisor__nombre_entidad')
    ordering = ('-fecha_asignacion',)


@admin.register(HistorialDocumentoPOA)
class HistorialDocumentoPOAAdmin(admin.ModelAdmin):
    list_display = ('documento', 'tipo_evento', 'usuario', 'estado_anterior', 'estado_nuevo', 'fecha')
    list_filter = ('tipo_evento', 'estado_nuevo')
    search_fields = ('documento__programa', 'descripcion', 'usuario__username')
    ordering = ('-fecha',)


