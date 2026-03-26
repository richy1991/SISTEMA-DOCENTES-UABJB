from django.db import migrations, models


def copy_partida_codigo_to_text(apps, schema_editor):
    ItemCatalogo = apps.get_model('catalogos', 'ItemCatalogo')
    for item in ItemCatalogo.objects.select_related('partida').all().iterator():
        partida_obj = getattr(item, 'partida', None)
        item.partida_text = str(getattr(partida_obj, 'codigo', '') or '')
        item.save(update_fields=['partida_text'])


class Migration(migrations.Migration):

    dependencies = [
        ('catalogos', '0003_remove_itemmaestro_partida_and_more'),
    ]

    operations = [
        migrations.RenameField(
            model_name='itemcatalogo',
            old_name='descripcion',
            new_name='detalle',
        ),
        migrations.AddField(
            model_name='itemcatalogo',
            name='nro',
            field=models.CharField(default='', max_length=50),
        ),
        migrations.AddField(
            model_name='itemcatalogo',
            name='partida_text',
            field=models.CharField(default='', max_length=50),
        ),
        migrations.RunPython(copy_partida_codigo_to_text, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='itemcatalogo',
            name='partida',
        ),
        migrations.RenameField(
            model_name='itemcatalogo',
            old_name='partida_text',
            new_name='partida',
        ),
        migrations.AlterField(
            model_name='itemcatalogo',
            name='partida',
            field=models.CharField(db_index=True, max_length=50),
        ),
        migrations.DeleteModel(
            name='PartidaPresupuestaria',
        ),
    ]
