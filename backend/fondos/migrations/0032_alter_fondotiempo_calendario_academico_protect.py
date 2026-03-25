from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0031_protect_carrera_relations'),
    ]

    operations = [
        migrations.AlterField(
            model_name='fondotiempo',
            name='calendario_academico',
            field=models.ForeignKey(
                blank=True,
                help_text='Calendario académico al que pertenece este fondo (si aplica)',
                null=True,
                on_delete=models.PROTECT,
                related_name='fondos',
                to='fondos.calendarioacademico',
            ),
        ),
    ]
