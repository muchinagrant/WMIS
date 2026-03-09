from django.db import migrations


def create_bootstrap_admin(apps, schema_editor):
    import os
    from django.contrib.auth import get_user_model

    username = os.environ.get("BOOTSTRAP_ADMIN_USERNAME")
    email = os.environ.get("BOOTSTRAP_ADMIN_EMAIL")
    password = os.environ.get("BOOTSTRAP_ADMIN_PASSWORD")

    if not (username and email and password):
        return

    User = get_user_model()

    if User.objects.filter(username=username).exists():
        return

    User.objects.create_superuser(
        username=username,
        email=email,
        password=password,
    )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0002_alter_incident_options_exhauster_inspection_and_more"),
    ]

    operations = [
        migrations.RunPython(create_bootstrap_admin, noop),
    ]