from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0042_alter_perfilusuario_user'),
    ]

    operations = [
        migrations.AddField(
            model_name='carrera',
            name='logo_carrera',
            field=models.ImageField(blank=True, null=True, upload_to='carreras/'),
        ),
        migrations.AddField(
            model_name='carrera',
            name='logo_carrera_cifrada',
            field=models.BinaryField(blank=True, editable=False, null=True),
        ),
        migrations.AddField(
            model_name='carrera',
            name='logo_carrera_mime',
            field=models.CharField(blank=True, default='', max_length=64),
        ),
    ]
