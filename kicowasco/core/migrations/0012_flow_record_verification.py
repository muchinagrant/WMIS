from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0011_update_user_roles'),
    ]

    operations = [
        migrations.AddField(
            model_name='dailyflowrecord',
            name='status',
            field=models.CharField(
                choices=[('submitted', 'Submitted'), ('verified', 'Verified')],
                default='submitted',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='dailyflowrecord',
            name='submitted_at',
            field=models.DateTimeField(auto_now_add=True),
        ),
        migrations.AddField(
            model_name='dailyflowrecord',
            name='verified_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='dailyflowrecord',
            name='verified_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name='verified_flow_records',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterUniqueTogether(
            name='flowreading',
            unique_together={('daily_record', 'time_slot')},
        ),
    ]
