from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('poa_document', '0006_documentopoa_observado_observaciones'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='documentopoa',
            name='ciclo_revision_actual',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.CreateModel(
            name='HistorialDocumentoPOA',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('fecha', models.DateTimeField(auto_now_add=True)),
                ('tipo_evento', models.CharField(choices=[('creacion', 'Creacion'), ('edicion', 'Edicion'), ('envio_revision', 'Envio a revision'), ('aprobacion_revision', 'Aprobacion de revision'), ('observacion_revision', 'Observacion de revision'), ('aprobacion_final', 'Aprobacion final')], max_length=30)),
                ('descripcion', models.TextField()),
                ('estado_anterior', models.CharField(blank=True, max_length=30)),
                ('estado_nuevo', models.CharField(blank=True, max_length=30)),
                ('datos_evento', models.JSONField(blank=True, default=dict)),
                ('documento', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='historial', to='poa_document.documentopoa')),
                ('usuario', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='historial_documentos_poa', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Historial de Documento POA',
                'verbose_name_plural': 'Historiales de Documento POA',
                'ordering': ['-fecha'],
            },
        ),
        migrations.CreateModel(
            name='RevisionDocumentoPOA',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ciclo_revision', models.PositiveIntegerField(default=1)),
                ('tipo_revisor', models.CharField(choices=[('entidad', 'Entidad Revisora'), ('director', 'Director de Carrera')], max_length=20)),
                ('estado', models.CharField(choices=[('pendiente', 'Pendiente'), ('aprobado', 'Aprobado'), ('observado', 'Observado')], default='pendiente', max_length=20)),
                ('observaciones', models.TextField(blank=True, default='')),
                ('fecha_asignacion', models.DateTimeField(auto_now_add=True)),
                ('fecha_respuesta', models.DateTimeField(blank=True, null=True)),
                ('activo', models.BooleanField(default=True)),
                ('documento', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='revisiones', to='poa_document.documentopoa')),
                ('respondido_por', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='respuestas_revision_poa', to=settings.AUTH_USER_MODEL)),
                ('revisor', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='revisiones_documento_poa', to='poa_document.usuariopoa')),
            ],
            options={
                'verbose_name': 'Revision de Documento POA',
                'verbose_name_plural': 'Revisiones de Documento POA',
                'ordering': ['tipo_revisor', 'fecha_asignacion'],
                'constraints': [models.UniqueConstraint(fields=('documento', 'ciclo_revision', 'revisor'), name='unique_revision_documento_poa_por_ciclo')],
            },
        ),
    ]