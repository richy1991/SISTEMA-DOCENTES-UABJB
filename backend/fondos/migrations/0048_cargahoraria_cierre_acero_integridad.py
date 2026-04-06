from django.db import migrations, models
import django.db.models.deletion


def limpiar_cargas_sin_materia(apps, schema_editor):
    CargaHoraria = apps.get_model('fondos', 'CargaHoraria')
    CargaHoraria.objects.filter(materia__isnull=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0047_refactor_cargahoraria_materia_horario'),
    ]

    operations = [
        migrations.RunPython(limpiar_cargas_sin_materia, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='cargahoraria',
            name='materia',
            field=models.ForeignKey(
                help_text='Materia del plan de estudios asignada al docente.',
                on_delete=django.db.models.deletion.PROTECT,
                related_name='asignaciones_horarias',
                to='fondos.materia',
            ),
        ),
        migrations.AlterField(
            model_name='cargahoraria',
            name='dia_semana',
            field=models.CharField(
                choices=[
                    ('lunes', 'Lunes'),
                    ('martes', 'Martes'),
                    ('miercoles', 'Miercoles'),
                    ('jueves', 'Jueves'),
                    ('viernes', 'Viernes'),
                    ('sabado', 'Sabado'),
                ],
                max_length=10,
            ),
        ),
        migrations.AlterField(
            model_name='cargahoraria',
            name='hora_inicio',
            field=models.TimeField(),
        ),
        migrations.AlterField(
            model_name='cargahoraria',
            name='hora_fin',
            field=models.TimeField(),
        ),
        migrations.AddConstraint(
            model_name='cargahoraria',
            constraint=models.CheckConstraint(
                condition=models.Q(hora_fin__gt=models.F('hora_inicio')),
                name='cargahoraria_hora_fin_gt_inicio',
            ),
        ),
    ]
