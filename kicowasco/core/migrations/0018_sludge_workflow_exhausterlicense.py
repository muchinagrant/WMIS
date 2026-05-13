import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def migrate_sludge_status(apps, schema_editor):
    SludgeCollection = apps.get_model('core', 'SludgeCollection')
    SludgeCollection.objects.filter(manifest_status='completed').update(manifest_status='received')


def migrate_license_status(apps, schema_editor):
    License = apps.get_model('core', 'License')
    License.objects.filter(status='valid').update(status='active')
    License.objects.filter(status='suspended').update(status='revoked')
    License.objects.filter(status='pending').update(status='active')


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0017_patrol_meta'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # --- SludgeCollection field renames ---
        migrations.RenameField(
            model_name='sludgecollection',
            old_name='last_emptied',
            new_name='last_emptying_date',
        ),
        migrations.RenameField(
            model_name='sludgecollection',
            old_name='users',
            new_name='number_of_users',
        ),
        migrations.RenameField(
            model_name='sludgecollection',
            old_name='receiving_officer',
            new_name='received_by',
        ),

        # --- SludgeCollection new fields ---
        migrations.AddField(
            model_name='sludgecollection',
            name='driver_name',
            field=models.CharField(blank=True, max_length=200, help_text='Name of the exhauster driver'),
        ),
        migrations.AddField(
            model_name='sludgecollection',
            name='received_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='sludgecollection',
            name='rejection_reason',
            field=models.TextField(blank=True),
        ),

        # --- Data migration: completed → received ---
        migrations.RunPython(migrate_sludge_status, migrations.RunPython.noop),

        # --- Update manifest_status choices ---
        migrations.AlterField(
            model_name='sludgecollection',
            name='manifest_status',
            field=models.CharField(
                choices=[('pending', 'Pending'), ('received', 'Received'), ('rejected', 'Rejected')],
                default='pending',
                max_length=20,
            ),
        ),

        # --- Data migration: License status values ---
        migrations.RunPython(migrate_license_status, migrations.RunPython.noop),

        # --- Update License.status choices ---
        migrations.AlterField(
            model_name='license',
            name='status',
            field=models.CharField(
                choices=[('active', 'Active'), ('expired', 'Expired'), ('revoked', 'Revoked')],
                default='active',
                max_length=20,
            ),
        ),

        # --- Rename License → ExhausterLicense ---
        migrations.RenameModel(
            old_name='License',
            new_name='ExhausterLicense',
        ),
    ]
