import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0015_sewerlinesection_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='weeklylinepatrol',
            name='status',
            field=models.CharField(
                choices=[('submitted', 'Submitted'), ('verified', 'Verified')],
                default='submitted',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='weeklylinepatrol',
            name='verified_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='verified_patrols',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='weeklylinepatrol',
            name='verified_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
