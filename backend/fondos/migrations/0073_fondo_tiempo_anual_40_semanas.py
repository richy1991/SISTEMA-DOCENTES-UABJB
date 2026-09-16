from decimal import Decimal

from django.db import migrations, models


def recalcular_micro_anual(apps, schema_editor):
    CargaHoraria = apps.get_model('fondos', 'CargaHoraria')
    Actividad = apps.get_model('fondos', 'Actividad')
    FondoTiempo = apps.get_model('fondos', 'FondoTiempo')

    for carga in CargaHoraria.objects.select_related('materia').filter(categoria='academica', materia__isnull=False):
        horas_semana = Decimal(str(carga.materia.horas_teoricas or 0)) + Decimal(str(carga.materia.horas_practicas or 0))
        carga.horas = int((horas_semana * Decimal('40')).quantize(Decimal('1')))
        carga.save(update_fields=['horas'])

    for actividad in Actividad.objects.all():
        actividad.horas_año = (Decimal(str(actividad.horas_semana or 0)) * Decimal('40')).quantize(Decimal('0.01'))
        actividad.save(update_fields=['horas_año'])

    for fondo in FondoTiempo.objects.all():
        horas_semana = Decimal(str(fondo.horas_semana or 0))
        fondo.semanas_año = Decimal('52.0')
        fondo.contrato_horas = int(horas_semana * Decimal('52'))
        horas_diarias = horas_semana / Decimal('5') if horas_semana else Decimal('0')
        fondo.horas_vacacion = int(horas_diarias * Decimal('30'))
        fondo.horas_feriados = int(horas_diarias * Decimal('16'))
        fondo.horas_efectivas = Decimal(max(fondo.contrato_horas - fondo.horas_vacacion - fondo.horas_feriados, 0)).quantize(Decimal('0.01'))
        fondo.funciones_sustantivas_horas = int(max(Decimal(fondo.horas_efectivas) - Decimal(str(fondo.clases_aula_horas or 0)), Decimal('0')))
        fondo.save(update_fields=[
            'semanas_año',
            'contrato_horas',
            'horas_vacacion',
            'horas_feriados',
            'horas_efectivas',
            'funciones_sustantivas_horas',
        ])


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0072_recalcular_carga_horaria_semestre'),
    ]

    operations = [
        migrations.AlterField(
            model_name='fondotiempo',
            name='semanas_año',
            field=models.DecimalField(decimal_places=1, default=Decimal('52.0'), help_text='Número de semanas efectivas del año para cÃ¡lculo de horas anuales', max_digits=4),
        ),
        migrations.AlterField(
            model_name='fondotiempo',
            name='horas_vacacion',
            field=models.IntegerField(default=240),
        ),
        migrations.AlterField(
            model_name='fondotiempo',
            name='horas_feriados',
            field=models.IntegerField(default=128),
        ),
        migrations.AlterField(
            model_name='fondotiempo',
            name='funciones_sustantivas_horas',
            field=models.IntegerField(default=1472),
        ),
        migrations.AlterField(
            model_name='fondotiempo',
            name='horas_efectivas',
            field=models.DecimalField(decimal_places=2, default=1712.0, max_digits=6),
        ),
        migrations.RunPython(recalcular_micro_anual, migrations.RunPython.noop),
    ]
