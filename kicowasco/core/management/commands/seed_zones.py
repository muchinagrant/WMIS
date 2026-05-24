from django.core.management.base import BaseCommand

from core.models import Zone


ZONE_DATA = [
    {
        'zone_code': 'KCN-01',
        'name': 'Kerugoya Central',
        'description': 'Kerugoya town centre, CBD, market area, Kerugoya District Hospital vicinity',
        'min_lat': -0.5050,
        'max_lat': -0.4850,
        'min_lon': 37.2700,
        'max_lon': 37.2950,
    },
    {
        'zone_code': 'KCN-02',
        'name': 'Kerugoya North',
        'description': 'Kerugoya North ward, residential estates north of CBD',
        'min_lat': -0.4850,
        'max_lat': -0.4650,
        'min_lon': 37.2650,
        'max_lon': 37.2950,
    },
    {
        'zone_code': 'KCN-03',
        'name': 'Kerugoya South',
        'description': 'Kerugoya South ward, estates toward Kutus road',
        'min_lat': -0.5250,
        'max_lat': -0.5050,
        'min_lon': 37.2700,
        'max_lon': 37.2950,
    },
    {
        'zone_code': 'KTS-01',
        'name': 'Kutus Central',
        'description': 'Kutus town centre, county headquarters area',
        'min_lat': -0.5750,
        'max_lat': -0.5500,
        'min_lon': 37.3150,
        'max_lon': 37.3400,
    },
    {
        'zone_code': 'KTS-02',
        'name': 'Kutus South',
        'description': 'Kutus South ward, residential and peri-urban areas',
        'min_lat': -0.5950,
        'max_lat': -0.5750,
        'min_lon': 37.3100,
        'max_lon': 37.3400,
    },
    {
        'zone_code': 'KAG-01',
        'name': 'Kagio',
        'description': 'Kagio urban centre and surroundings',
        'min_lat': -0.5350,
        'max_lat': -0.5100,
        'min_lon': 37.3350,
        'max_lon': 37.3600,
    },
    {
        'zone_code': 'NDU-01',
        'name': 'Nduini',
        'description': 'Nduini ward, estates between Kerugoya and Kutus',
        'min_lat': -0.5400,
        'max_lat': -0.5150,
        'min_lon': 37.2900,
        'max_lon': 37.3200,
    },
]


class Command(BaseCommand):
    help = 'Seed Kirinyaga field operation zones with bounding boxes.'

    def handle(self, *args, **options):
        created = 0
        updated = 0
        for data in ZONE_DATA:
            obj, was_created = Zone.objects.update_or_create(
                zone_code=data['zone_code'],
                defaults={
                    'name': data['name'],
                    'description': data['description'],
                    'min_lat': data['min_lat'],
                    'max_lat': data['max_lat'],
                    'min_lon': data['min_lon'],
                    'max_lon': data['max_lon'],
                    'is_active': True,
                },
            )
            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(self.style.SUCCESS(f'Zones seeded. Created={created}, Updated={updated}'))
