from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('poa_document', '0005_usuariopoa_user_fk_docente_opcional'),
    ]

    operations = [
        migrations.AddField(
            model_name='documentopoa',
            name='observaciones',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AlterField(
            model_name='documentopoa',
            name='estado',
            field=models.CharField(
                choices=[
                    ('elaboracion', 'En elaboración'),
                    ('revision', 'En revisión'),
                    ('observado', 'Observado'),
                    ('aprobado', 'Aprobado'),
                    ('ejecucion', 'En ejecución'),
                ],
                default='elaboracion',
                max_length=20,
                verbose_name='Estado',
            ),
        ),
    ]
