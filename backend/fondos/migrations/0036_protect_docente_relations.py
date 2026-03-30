from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0035_remove_perfilusuario_ci'),
    ]

    operations = [
        migrations.AlterField(
            model_name='cargahoraria',
            name='docente',
            field=models.ForeignKey(on_delete=models.PROTECT, related_name='cargas_horarias', to='fondos.docente'),
        ),
        migrations.AlterField(
            model_name='fondotiempo',
            name='docente',
            field=models.ForeignKey(on_delete=models.PROTECT, related_name='fondos_tiempo', to='fondos.docente'),
        ),
        migrations.AlterField(
            model_name='saldovacacionesgestion',
            name='docente',
            field=models.ForeignKey(on_delete=models.PROTECT, related_name='saldos_vacaciones', to='fondos.docente'),
        ),
    ]
