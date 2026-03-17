from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0028_docente_fecha_ingreso'),
    ]

    operations = [
        migrations.AddField(
            model_name='perfilusuario',
            name='foto_perfil_cifrada',
            field=models.BinaryField(blank=True, editable=False, null=True),
        ),
        migrations.AddField(
            model_name='perfilusuario',
            name='foto_perfil_mime',
            field=models.CharField(blank=True, default='', max_length=64),
        ),
    ]
