from django.contrib import admin
from poa_document.models import Persona, Direccion, DocumentoPOA

@admin.register(Persona)
class PersonaAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'cargo', 'activo', 'user')
    search_fields = ('nombre', 'cargo')
    list_filter = ('activo',)
    ordering = ('nombre',)
       

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


