from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0012_flow_record_verification'),
    ]

    operations = [
        migrations.AddField(
            model_name='inletworksdailytask',
            name='t1_grit_buried',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='inletworksdailytask',
            name='t2_screenings_buried',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='inletworksdailytask',
            name='shift_notes',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='inletworksdailytask',
            name='submitted_at',
            field=models.DateTimeField(auto_now_add=True),
        ),
        migrations.AddField(
            model_name='inletworksdailytask',
            name='status',
            field=models.CharField(
                choices=[('submitted', 'Submitted'), ('verified', 'Verified')],
                default='submitted',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='inletworksdailytask',
            name='verified_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='inletworksdailytask',
            name='incident_created',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name='f203a_tasks',
                to='core.incident',
            ),
        ),
        migrations.AddField(
            model_name='inletworksdailytask',
            name='submitted_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name='submitted_inlet_tasks',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='inletworksdailytask',
            name='verified_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name='verified_inlet_tasks',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
