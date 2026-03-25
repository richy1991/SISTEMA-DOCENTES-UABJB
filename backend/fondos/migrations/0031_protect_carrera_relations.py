from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0030_saldovacacionesgestion'),
    ]

    operations = [
        migrations.AlterField(
            model_name='materia',
            name='carrera',
            field=models.ForeignKey(on_delete=models.PROTECT, related_name='materias', to='fondos.carrera'),
        ),
        migrations.AlterField(
            model_name='fondotiempo',
            name='carrera',
            field=models.ForeignKey(on_delete=models.PROTECT, related_name='fondos_tiempo', to='fondos.carrera'),
        ),
    ]
