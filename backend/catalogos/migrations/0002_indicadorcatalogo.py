from django.db import migrations, models


def forward_copy_indicators(apps, schema_editor):
    OperacionCatalogo = apps.get_model('catalogos', 'OperacionCatalogo')
    IndicadorCatalogo = apps.get_model('catalogos', 'IndicadorCatalogo')

    seen = set()
    for value in (
        OperacionCatalogo.objects.exclude(indicador='')
        .exclude(indicador__isnull=True)
        .values_list('indicador', flat=True)
        .order_by('indicador')
        .distinct()
    ):
        indicador = str(value or '').strip()
        if not indicador:
            continue
        key = indicador.lower()
        if key in seen:
            continue
        seen.add(key)
        IndicadorCatalogo.objects.get_or_create(indicador=indicador)


def reverse_clear_indicators(apps, schema_editor):
    IndicadorCatalogo = apps.get_model('catalogos', 'IndicadorCatalogo')
    IndicadorCatalogo.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('catalogos', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='IndicadorCatalogo',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('indicador', models.CharField(db_index=True, max_length=500, unique=True)),
            ],
            options={
                'ordering': ['indicador'],
            },
        ),
        migrations.RunPython(forward_copy_indicators, reverse_clear_indicators),
    ]