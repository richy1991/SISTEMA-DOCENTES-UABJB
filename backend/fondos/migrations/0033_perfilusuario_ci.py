from django.db import migrations, models


def copy_ci_from_docente(apps, schema_editor):
    PerfilUsuario = apps.get_model('fondos', 'PerfilUsuario')

    for perfil in PerfilUsuario.objects.select_related('docente').all():
        if perfil.ci or not perfil.docente or not perfil.docente.ci:
            continue
        perfil.ci = perfil.docente.ci
        perfil.save(update_fields=['ci'])


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0032_alter_fondotiempo_calendario_academico_protect'),
    ]

    operations = [
        migrations.AddField(
            model_name='perfilusuario',
            name='ci',
            field=models.CharField(blank=True, max_length=20, null=True, unique=True, verbose_name='Cédula de Identidad'),
        ),
        migrations.RunPython(copy_ci_from_docente, migrations.RunPython.noop),
    ]
