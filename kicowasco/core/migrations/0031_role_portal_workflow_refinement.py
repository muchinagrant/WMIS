from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0030_section5_weekly_patrol_refinements'),
    ]

    operations = [
        migrations.AddField(
            model_name='sludgecollection',
            name='entered_by',
            field=models.ForeignKey(blank=True, help_text='Authenticated user who entered the driver/origin section.', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='collections_entered', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='sludgecollection',
            name='rejected_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='sludgecollection',
            name='rejected_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='collections_rejected', to=settings.AUTH_USER_MODEL),
        ),
        migrations.RemoveField(
            model_name='dailyflowrecord',
            name='status',
        ),
        migrations.RemoveField(
            model_name='dailyflowrecord',
            name='verified_at',
        ),
        migrations.RemoveField(
            model_name='dailyflowrecord',
            name='verified_by',
        ),
        migrations.AddField(
            model_name='dailyflowrecord',
            name='operator_note',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='dailyflowrecord',
            name='supervisor_note',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='dailylabrecord',
            name='bod_removal_efficiency',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True),
        ),
        migrations.AddField(
            model_name='dailylabrecord',
            name='effluent_conductivity',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='uS/cm', max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name='dailylabrecord',
            name='effluent_ecoli',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='E.coli CFU/100mL', max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name='dailylabrecord',
            name='effluent_nitrates',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Nitrates mg/L', max_digits=8, null=True),
        ),
        migrations.AddField(
            model_name='dailylabrecord',
            name='effluent_phosphates',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Phosphates mg/L', max_digits=8, null=True),
        ),
        migrations.AddField(
            model_name='dailylabrecord',
            name='effluent_total_coliforms',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Total Coliforms MPN/100mL', max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name='dailylabrecord',
            name='effluent_volume_m3',
            field=models.DecimalField(blank=True, decimal_places=3, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name='dailylabrecord',
            name='inflow_conductivity',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='uS/cm', max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name='dailylabrecord',
            name='inflow_do',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Dissolved Oxygen mg/L', max_digits=6, null=True),
        ),
        migrations.AddField(
            model_name='dailylabrecord',
            name='inflow_nitrates',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Nitrates mg/L', max_digits=8, null=True),
        ),
        migrations.AddField(
            model_name='dailylabrecord',
            name='inflow_phosphates',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Phosphates mg/L', max_digits=8, null=True),
        ),
        migrations.AddField(
            model_name='dailylabrecord',
            name='inflow_turbidity',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='NTU', max_digits=8, null=True),
        ),
        migrations.AddField(
            model_name='dailylabrecord',
            name='inflow_volume_m3',
            field=models.DecimalField(blank=True, decimal_places=3, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name='dailylabrecord',
            name='tss_removal_efficiency',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True),
        ),
        migrations.AlterField(
            model_name='dailylabrecord',
            name='effluent_fc',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Fecal Coliforms MPN/100mL — W', max_digits=12, null=True),
        ),
        migrations.CreateModel(
            name='LabComplianceFlag',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('parameter_key', models.CharField(max_length=80)),
                ('measured_value', models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ('threshold_value', models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ('threshold_mode', models.CharField(choices=[('min', 'Min'), ('max', 'Max')], default='max', max_length=8)),
                ('severity', models.CharField(choices=[('amber', 'Amber'), ('red', 'Red')], max_length=10)),
                ('status', models.CharField(choices=[('open', 'Open'), ('resolved', 'Resolved'), ('acknowledged', 'Acknowledged'), ('escalated', 'Escalated to Superintendent')], default='open', max_length=20)),
                ('notes', models.TextField(blank=True)),
                ('corrective_action', models.TextField(blank=True)),
                ('corrective_action_at', models.DateTimeField(blank=True, null=True)),
                ('acknowledged_at', models.DateTimeField(blank=True, null=True)),
                ('escalated_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('acknowledged_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='acknowledged_lab_flags', to=settings.AUTH_USER_MODEL)),
                ('corrected_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='resolved_lab_flags', to=settings.AUTH_USER_MODEL)),
                ('escalated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='escalated_lab_flags', to=settings.AUTH_USER_MODEL)),
                ('lab_record', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='compliance_flags', to='core.dailylabrecord')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='labcomplianceflag',
            index=models.Index(fields=['severity', 'status'], name='core_labcom_severit_7026e9_idx'),
        ),
        migrations.AddIndex(
            model_name='labcomplianceflag',
            index=models.Index(fields=['parameter_key'], name='core_labcom_paramet_d649dd_idx'),
        ),
    ]
