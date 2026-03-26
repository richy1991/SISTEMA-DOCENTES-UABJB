from django.contrib import admin
from catalogos.models import ItemCatalogo, OperacionCatalogo

@admin.register(ItemCatalogo)
class ItemCatalogoAdmin(admin.ModelAdmin):
	list_display = ("detalle", "unidad_medida", "partida")
	search_fields = ("detalle", "partida", "unidad_medida")
	list_filter = ("partida",)

@admin.register(OperacionCatalogo)
class OperacionCatalogoAdmin(admin.ModelAdmin):
	list_display = ("direccion", "servicio", "proceso", "operacion")
	search_fields = ("servicio", "proceso", "operacion")
	list_filter = ("direccion",)



# Register your models here.
