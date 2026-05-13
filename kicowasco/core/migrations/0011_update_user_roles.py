from django.db import migrations, models


def forwards(apps, schema_editor):
    User = apps.get_model('core', 'User')

    role_map = {
        'superintendent': 'stp_superintendent',
        'supervisor': 'stp_supervisor',
        'operator': 'stp_operator',
        'lab_tech': 'lab_tech',
        'admin': 'admin',
    }

    for old_role, new_role in role_map.items():
        User.objects.filter(role=old_role).update(role=new_role)

    attendant_map = {
        'peter': 'stp_operator',
        'sarah': 'stp_operator',
        'alice': 'line_attendant',
        'kevin': 'line_attendant',
    }

    unmapped = []
    for user in User.objects.filter(role='attendant'):
        target_role = attendant_map.get(user.username.lower())
        if not target_role:
            unmapped.append(user.username)
            continue
        user.role = target_role
        user.save(update_fields=['role'])

    if unmapped:
        unmapped_list = ', '.join(sorted(unmapped))
        raise RuntimeError(
            "Unmapped attendant users require manual role assignment: "
            f"{unmapped_list}"
        )


def backwards(apps, schema_editor):
    User = apps.get_model('core', 'User')

    reverse_map = {
        'stp_superintendent': 'superintendent',
        'stp_supervisor': 'supervisor',
        'stp_operator': 'operator',
        'line_supervisor': 'supervisor',
        'sewer_line_officer': 'attendant',
        'line_attendant': 'attendant',
        'lab_tech': 'lab_tech',
        'admin': 'admin',
    }

    for new_role, old_role in reverse_map.items():
        User.objects.filter(role=new_role).update(role=old_role)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0010_remove_materialrequisition_material_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[
                    ('stp_superintendent', 'STP Superintendent (Grade 3)'),
                    ('stp_supervisor', 'STP Supervisor (Grade 4)'),
                    ('lab_tech', 'Lab Technologist (Grade 4)'),
                    ('stp_operator', 'STP Operator (Grade 5)'),
                    ('line_supervisor', 'Line Supervisor (Grade 4)'),
                    ('sewer_line_officer', 'Sewer Line Officer'),
                    ('line_attendant', 'Line Attendant / Plumber (Grade 6)'),
                    ('admin', 'System Admin'),
                ],
                default='line_attendant',
                max_length=20,
            ),
        ),
        migrations.RunPython(forwards, backwards),
    ]
