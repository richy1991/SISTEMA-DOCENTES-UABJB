from django.db import migrations, models


DEFAULT_FACULTADES = [
    'Facultad de Ingeniería y Tecnología',
    'Facultad de Ciencias y Tecnologia',
    'Facultad de Ciencias de la Salud',
    'Facultad de Ciencias Juridicas, Politicas y Sociales',
    'Facultad de Ciencias Economicas y Financieras',
    'Facultad de Humanidades y Ciencias de la Educacion',
    'Facultad de Ciencias Agropecuarias',
]


def seed_facultades(apps, schema_editor):
    FacultadCatalogo = apps.get_model('fondos', 'FacultadCatalogo')
    for nombre in DEFAULT_FACULTADES:
        FacultadCatalogo.objects.get_or_create(nombre=nombre)


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0055_merge_0032_0054'),
    ]

    operations = [
        migrations.CreateModel(
            name='FacultadCatalogo',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=200, unique=True)),
                ('fecha_creacion', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Facultad',
                'verbose_name_plural': 'Facultades',
                'ordering': ['nombre'],
            },
        ),
        migrations.AlterField(
            model_name='carrera',
            name='facultad',
            field=models.CharField(max_length=200),
        ),
        migrations.RunPython(seed_facultades, migrations.RunPython.noop),
    ]
