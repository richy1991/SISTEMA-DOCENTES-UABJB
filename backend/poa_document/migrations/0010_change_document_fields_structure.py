# Generated migration - Change DocumentoPOA fields structure

from django.db import migrations, models
import django.db.models.deletion


def _copy_usuario_names(apps, schema_editor):
    """Copy UsuarioPOA names to temporary CharField fields"""
    DocumentoPOA = apps.get_model('poa_document', 'DocumentoPOA')
    for doc in DocumentoPOA.objects.select_related('elaborado_por__user', 'elaborado_por__docente', 'jefe_unidad__user', 'jefe_unidad__docente'):
        if doc.elaborado_por:
            usuario = doc.elaborado_por
            if usuario.user:
                full_name = f"{usuario.user.first_name} {usuario.user.last_name}".strip() or usuario.user.username
                doc.elaborado_por_nombre = full_name
            elif usuario.docente:
                doc.elaborado_por_nombre = usuario.docente.nombre_completo
            else:
                doc.elaborado_por_nombre = f'UsuarioPOA #{usuario.pk}'
        if doc.jefe_unidad:
            usuario = doc.jefe_unidad
            if usuario.user:
                full_name = f"{usuario.user.first_name} {usuario.user.last_name}".strip() or usuario.user.username
                doc.jefe_unidad_nombre = full_name
            elif usuario.docente:
                doc.jefe_unidad_nombre = usuario.docente.nombre_completo
            else:
                doc.jefe_unidad_nombre = f'UsuarioPOA #{usuario.pk}'
        doc.save()


def _migrate_carrera_names(apps, schema_editor):
    """Migrate unidad_solicitante names to Carrera FK"""
    DocumentoPOA = apps.get_model('poa_document', 'DocumentoPOA')
    Carrera = apps.get_model('fondos', 'Carrera')

    for doc in DocumentoPOA.objects.all():
        if doc.unidad_solicitante:  # It's still a CharField at this point
            # Try to find matching carrera by name
            try:
                carrera = Carrera.objects.get(nombre__iexact=doc.unidad_solicitante.strip())
                doc.carrera_temp = carrera
                doc.save()
            except Carrera.DoesNotExist:
                # If not found, leave it null - will need manual intervention
                pass


class Migration(migrations.Migration):

    dependencies = [
        ('poa_document', '0009_documentopoa_poa_doc_gestion_unidad_idx'),
        ('fondos', '0001_initial'),
    ]

    operations = [
        # Step 1: Remove the index first
        migrations.RemoveIndex(
            model_name='documentopoa',
            name='poa_doc_gestion_unidad_idx',
        ),

        # Step 2: Remove unique constraint
        migrations.AlterUniqueTogether(
            name='documentopoa',
            unique_together=set(),
        ),

        # Step 3: Create temporary CharField fields to store names
        migrations.AddField(
            model_name='documentopoa',
            name='elaborado_por_nombre',
            field=models.CharField(max_length=255, default='', blank=True),
        ),
        migrations.AddField(
            model_name='documentopoa',
            name='jefe_unidad_nombre',
            field=models.CharField(max_length=255, default='', blank=True),
        ),

        # Step 4: Copy data from FK to temp CharField fields
        migrations.RunPython(
            _copy_usuario_names,
            migrations.RunPython.noop
        ),

        # Step 5: Create temporary Carrera FK field
        migrations.AddField(
            model_name='documentopoa',
            name='carrera_temp',
            field=models.ForeignKey(null=True, blank=True, on_delete=django.db.models.deletion.PROTECT, to='fondos.carrera'),
        ),

        # Step 6: Copy carrera data
        migrations.RunPython(
            _migrate_carrera_names,
            migrations.RunPython.noop
        ),

        # Step 7: Remove old FK fields
        migrations.RemoveField(
            model_name='documentopoa',
            name='elaborado_por',
        ),
        migrations.RemoveField(
            model_name='documentopoa',
            name='jefe_unidad',
        ),
        migrations.RemoveField(
            model_name='documentopoa',
            name='unidad_solicitante',
        ),

        # Step 8: Rename temp fields to final names
        migrations.RenameField(
            model_name='documentopoa',
            old_name='elaborado_por_nombre',
            new_name='elaborado_por',
        ),
        migrations.RenameField(
            model_name='documentopoa',
            old_name='jefe_unidad_nombre',
            new_name='jefe_unidad',
        ),
        migrations.RenameField(
            model_name='documentopoa',
            old_name='carrera_temp',
            new_name='unidad_solicitante',
        ),

        # Step 9: Re-add unique constraint with new fields
        migrations.AlterUniqueTogether(
            name='documentopoa',
            unique_together={('gestion', 'unidad_solicitante', 'programa')},
        ),

        # Step 10: Add new index
        migrations.AddIndex(
            model_name='documentopoa',
            index=models.Index(fields=['gestion', 'unidad_solicitante'], name='poa_doc_gestion_carrera_idx'),
        ),
    ]
