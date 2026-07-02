from django.contrib import admin
from catalogos.models import ItemCatalogo, OperacionCatalogo, IndicadorCatalogo

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


@admin.register(IndicadorCatalogo)
class IndicadorCatalogoAdmin(admin.ModelAdmin):
	list_display = ("indicador",)
	search_fields = ("indicador",)



# Register your models here.
