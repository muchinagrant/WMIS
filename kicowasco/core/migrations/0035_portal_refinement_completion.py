# Generated manually for portal refinement completion

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0034_treatmentpond_frequency'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='treatmentlog',
            name='review_status',
            field=models.CharField(
                choices=[
                    ('pending_review', 'Pending Supervisor Review'),
                    ('correction_requested', 'Correction Requested'),
                    ('supervisor_approved', 'Supervisor Approved'),
                ],
                default='pending_review',
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name='treatmentlog',
            name='supervisor_comment',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='treatmentlog',
            name='correction_note',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='treatmentlog',
            name='reviewed_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='treatment_logs_reviewed',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='treatmentlog',
            name='reviewed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='monthlysummarysnapshot',
            name='supervisor_draft_notes',
            field=models.TextField(blank=True, help_text='Plant-level notes compiled by STP Supervisor before superintendent lock.'),
        ),
        migrations.AddField(
            model_name='dailylabrecord',
            name='retest_requested',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='dailylabrecord',
            name='retest_note',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='ponddailylog',
            name='daily_inspection_done',
            field=models.BooleanField(default=False, help_text='Inspect ponds and record abnormalities'),
        ),
        migrations.AddField(
            model_name='ponddailylog',
            name='valves_hand_stops_ok',
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='ponddailylog',
            name='inspection_incidences',
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='ponddailylog',
            name='spillage_incidences',
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='ponddailylog',
            name='new_mother_connections',
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='ponddailylog',
            name='new_child_connections',
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='ponddailylog',
            name='repairs_completed',
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='ponddailylog',
            name='bod_incidences',
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='ponddailylog',
            name='exhauster_volume_m3',
            field=models.DecimalField(blank=True, decimal_places=3, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name='ponddailylog',
            name='effluent_volume_m3',
            field=models.DecimalField(blank=True, decimal_places=3, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name='ponddailylog',
            name='yearly_desludging',
            field=models.CharField(blank=True, choices=[('Y', 'Yes'), ('N', 'No')], max_length=1),
        ),
        migrations.AddField(
            model_name='ponddailylog',
            name='yearly_rust_removal',
            field=models.CharField(blank=True, choices=[('Y', 'Yes'), ('N', 'No')], max_length=1),
        ),
        migrations.AddField(
            model_name='ponddailylog',
            name='yearly_painting',
            field=models.CharField(blank=True, choices=[('Y', 'Yes'), ('N', 'No')], max_length=1),
        ),
        migrations.AddField(
            model_name='ponddailylog',
            name='yearly_grease_paint_valves',
            field=models.CharField(blank=True, choices=[('Y', 'Yes'), ('N', 'No')], max_length=1),
        ),
        migrations.AddField(
            model_name='ponddailylog',
            name='intermittent_grass_cutting',
            field=models.CharField(blank=True, choices=[('Y', 'Yes'), ('N', 'No')], max_length=1),
        ),
        migrations.AddField(
            model_name='ponddailylog',
            name='intermittent_floating_material',
            field=models.CharField(blank=True, choices=[('Y', 'Yes'), ('N', 'No')], max_length=1),
        ),
    ]
