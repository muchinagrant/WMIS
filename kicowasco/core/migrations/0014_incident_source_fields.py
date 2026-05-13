from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0013_inletworks_workflow'),
    ]

    operations = [
        migrations.AddField(
            model_name='incident',
            name='source_module',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name='incident',
            name='source_reference_id',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
