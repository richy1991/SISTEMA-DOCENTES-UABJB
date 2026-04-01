from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0040_alter_historialfondo_usuario_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='perfilusuario',
            name='ci',
            field=models.CharField(blank=True, max_length=20, null=True, unique=True, verbose_name='Cedula de Identidad'),
        ),
    ]
