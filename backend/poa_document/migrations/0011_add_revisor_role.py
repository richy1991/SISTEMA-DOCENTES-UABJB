# Generated migration - Add revisor role to UsuarioPOA

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('poa_document', '0010_change_document_fields_structure'),
    ]

    operations = [
        migrations.AlterField(
            model_name='usuariopoa',
            name='rol',
            field=models.CharField(
                choices=[
                    ('elaborador', 'Elaborador del POA'),
                    ('revisor', 'Revisor del POA'),
                ],
                max_length=30,
                verbose_name='Rol POA'
            ),
        ),
    ]
