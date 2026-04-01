from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0036_protect_docente_relations'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='perfilusuario',
            name='unico_director_por_carrera',
        ),
        migrations.RemoveConstraint(
            model_name='perfilusuario',
            name='unico_jefe_por_carrera',
        ),
        migrations.AddConstraint(
            model_name='perfilusuario',
            constraint=models.UniqueConstraint(
                condition=models.Q(('activo', True), ('rol', 'director')),
                fields=('carrera', 'rol'),
                name='unico_director_por_carrera',
            ),
        ),
        migrations.AddConstraint(
            model_name='perfilusuario',
            constraint=models.UniqueConstraint(
                condition=models.Q(('activo', True), ('rol', 'jefe_estudios')),
                fields=('carrera', 'rol'),
                name='unico_jefe_por_carrera',
            ),
        ),
    ]
