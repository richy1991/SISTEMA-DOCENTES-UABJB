from django.db import migrations


def backfill_asignaciones(apps, schema_editor):
    PerfilUsuario = apps.get_model('fondos', 'PerfilUsuario')
    AsignacionCarrera = apps.get_model('fondos', 'AsignacionCarrera')

    perfiles = PerfilUsuario.objects.filter(user__isnull=False, carrera__isnull=False)

    for perfil in perfiles.iterator():
        AsignacionCarrera.objects.update_or_create(
            user=perfil.user,
            carrera=perfil.carrera,
            rol=perfil.rol,
            defaults={
                'docente': perfil.docente,
                'activo': perfil.activo,
            }
        )


def reverse_backfill_asignaciones(apps, schema_editor):
    AsignacionCarrera = apps.get_model('fondos', 'AsignacionCarrera')
    AsignacionCarrera.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0052_alter_perfilusuario_docente_asignacioncarrera'),
    ]

    operations = [
        migrations.RunPython(backfill_asignaciones, reverse_backfill_asignaciones),
    ]
