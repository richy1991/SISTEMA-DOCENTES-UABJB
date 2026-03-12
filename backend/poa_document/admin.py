from django.contrib import admin
from poa_document.models import UsuarioPOA, Direccion, DocumentoPOA

@admin.register(UsuarioPOA)
class UsuarioPOAAdmin(admin.ModelAdmin):
    list_display = ('docente', 'rol', 'nombre_entidad', 'activo', 'fecha_asignacion')
    list_filter = ('rol', 'activo')
    search_fields = ('docente__nombres', 'docente__apellido_paterno', 'nombre_entidad')
    ordering = ('rol', 'docente__apellido_paterno')
       

@admin.register(Direccion)
class DireccionAdmin(admin.ModelAdmin):
    list_display = ('nombre',)
    search_fields = ('nombre',)
    ordering = ('nombre',)

@admin.register(DocumentoPOA)
class DocumentoPOAAdmin(admin.ModelAdmin):  
    list_display = ('gestion', 'unidad_solicitante', 'programa', 'elaborado_por', 'jefe_unidad', 'fecha_elaboracion')
    search_fields = ('programa', 'objetivo_gestion_institucional')
    list_filter = ('gestion', 'unidad_solicitante')
    ordering = ('-gestion', 'unidad_solicitante', 'programa')   
    date_hierarchy = 'fecha_elaboracion'
    readonly_fields = ('creado_en', 'actualizado_en')
    fieldsets = (
        (None, {
            'fields': ('gestion', 'unidad_solicitante', 'programa', 'objetivo_gestion_institucional')
        }),
        ('Responsables', {
            'fields': ('elaborado_por', 'jefe_unidad')
        }),
        ('Fechas', {
            'fields': ('fecha_elaboracion', 'creado_en', 'actualizado_en')
        }),
    )


