from django.db import migrations


SEMANAS_SEMESTRE = 18


def recalcular_cargas_horarias_semestre(apps, schema_editor):
    CargaHoraria = apps.get_model('fondos', 'CargaHoraria')

    cargas = CargaHoraria.objects.select_related('materia').filter(materia__isnull=False)
    for carga in cargas.iterator():
        horas_semana = (
            (carga.materia.horas_teoricas or 0)
            + (carga.materia.horas_practicas or 0)
        )
        horas_semestre = round(horas_semana * SEMANAS_SEMESTRE)
        if carga.horas != horas_semestre:
            carga.horas = horas_semestre
            carga.save(update_fields=['horas'])


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0071_mensajeobservacion_responde_a'),
    ]

    operations = [
        migrations.RunPython(recalcular_cargas_horarias_semestre, migrations.RunPython.noop),
    ]
