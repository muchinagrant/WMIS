from django.db import migrations, models


def remap_deprecated_role(apps, schema_editor):
    User = apps.get_model('core', 'User')
    User.objects.filter(role='sewer_line_officer').update(role='line_attendant')


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0025_company_and_user_company'),
    ]

    operations = [
        migrations.RunPython(remap_deprecated_role, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[
                    ('stp_superintendent', 'STP Superintendent (Grade 3)'),
                    ('stp_supervisor', 'STP Supervisor (Grade 4)'),
                    ('lab_tech', 'Lab Technologist (Grade 4)'),
                    ('stp_operator', 'STP Operator (Grade 5)'),
                    ('stp_attendant', 'STP Attendant (Grade 6)'),
                    ('line_supervisor', 'Line Supervisor (Grade 4)'),
                    ('line_attendant', 'Line Attendant / Plumber (Grade 6)'),
                    ('admin', 'System Admin'),
                ],
                default='line_attendant',
                max_length=20,
            ),
        ),
    ]
