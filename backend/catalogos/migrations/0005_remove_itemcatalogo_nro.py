from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('catalogos', '0004_single_table_excel_names'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='itemcatalogo',
            name='nro',
        ),
    ]
