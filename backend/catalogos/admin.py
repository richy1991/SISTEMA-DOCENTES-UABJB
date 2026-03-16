from django.contrib import admin
from catalogos.models import PartidaPresupuestaria, ItemCatalogo, OperacionCatalogo



@admin.register(PartidaPresupuestaria)
class PartidaPresupuestariaAdmin(admin.ModelAdmin):
	list_display = ("codigo", "nombre")
	search_fields = ("codigo", "nombre")

@admin.register(ItemCatalogo)
class ItemCatalogoAdmin(admin.ModelAdmin):
	list_display = ("descripcion", "unidad_medida", "partida")
	search_fields = ("descripcion",)
	list_filter = ("partida",)

@admin.register(OperacionCatalogo)
class OperacionCatalogoAdmin(admin.ModelAdmin):
	list_display = ("direccion", "servicio", "proceso", "operacion")
	search_fields = ("servicio", "proceso", "operacion")
	list_filter = ("direccion",)



# Register your models here.
