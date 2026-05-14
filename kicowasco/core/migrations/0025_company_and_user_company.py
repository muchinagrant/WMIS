from django.db import migrations, models
import django.db.models.deletion


def seed_default_company(apps, schema_editor):
    Company = apps.get_model('core', 'Company')
    User = apps.get_model('core', 'User')

    company, _ = Company.objects.get_or_create(
        code='kicowasco',
        defaults={
            'name': 'Kirinyaga County Water & Sanitation PLC',
            'email': 'info@kicowasco.co.ke',
            'phone': '0746555368',
            'website': 'www.kicowasco.co.ke',
            'address': 'P.O BOX 360-10300, KERUGOYA',
            'is_active': True,
        },
    )

    User.objects.filter(company__isnull=True).update(company=company)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0024_connectionapp_ward'),
    ]

    operations = [
        migrations.CreateModel(
            name='Company',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=50, unique=True)),
                ('name', models.CharField(max_length=255)),
                ('email', models.EmailField(blank=True, max_length=254)),
                ('phone', models.CharField(blank=True, max_length=50)),
                ('website', models.CharField(blank=True, max_length=255)),
                ('address', models.CharField(blank=True, max_length=255)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['name'],
            },
        ),
        migrations.AddField(
            model_name='user',
            name='company',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='users', to='core.company'),
        ),
        migrations.RunPython(seed_default_company, migrations.RunPython.noop),
    ]
