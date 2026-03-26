from django.db import migrations


class Migration(migrations.Migration):
	# Nota: esta migración queda intencionalmente sin operaciones.
	# Se creó durante un intento de mover `item` a Actividad, pero ese cambio
	# fue revertido porque `item` pertenece solo a DetallePresupuesto.

	dependencies = [
		('poa_document', '0008_add_comentario_poa'),
	]

	operations = []

