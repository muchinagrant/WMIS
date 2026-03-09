from django.db import migrations


def ensure_bootstrap_admin(apps, schema_editor):
    import os
    from django.contrib.auth import get_user_model

    username = os.environ.get("BOOTSTRAP_ADMIN_USERNAME")
    email = os.environ.get("BOOTSTRAP_ADMIN_EMAIL")
    password = os.environ.get("BOOTSTRAP_ADMIN_PASSWORD")

    if not (username and email and password):
        return

    User = get_user_model()

    user, created = User.objects.get_or_create(
        username=username,
        defaults={
            "email": email,
            "is_staff": True,
            "is_superuser": True,
            "is_active": True,
        },
    )

    user.email = email
    user.is_staff = True
    user.is_superuser = True
    user.is_active = True
    user.set_password(password)
    user.save()


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0004_bootstrap_admin_user_retry"),
    ]

    operations = [
        migrations.RunPython(ensure_bootstrap_admin, noop),
    ]