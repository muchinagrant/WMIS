import datetime

from django.core.management.base import BaseCommand

from core.models import SewerLine, Zone


SEWER_LINES = [
    ('SL-KCN-01', 'KCN-01', 'Market Road Main Trunk', 'Kerugoya Market to Junction A'),
    ('SL-KCN-02', 'KCN-01', 'Hospital Road Lateral', 'Kerugoya District Hospital to Market Road junction'),
    ('SL-KCN-03', 'KCN-01', 'Stadium Road Branch', 'Kerugoya Stadium vicinity'),
    ('SL-KCN-04', 'KCN-01', 'CBD Commercial Lateral', 'Kerugoya town shops and offices'),
    ('SL-KCN-05', 'KCN-02', 'North Residential Trunk Line', 'Northern residential estates main line'),
    ('SL-KCN-06', 'KCN-02', 'Kagumo Road Branch', 'Kagumo Road secondary branch'),
    ('SL-KCN-07', 'KCN-03', 'South Estates Main Lateral', 'Southern estates primary lateral'),
    ('SL-KCN-08', 'KCN-03', 'Kerugoya–Kutus Road Branch', 'Line running along Kerugoya–Kutus road'),
    ('SL-KTS-01', 'KTS-01', 'Kutus Town Trunk Line', 'Main trunk through Kutus town centre'),
    ('SL-KTS-02', 'KTS-01', 'County Headquarters Lateral', 'Serving county government offices area'),
    ('SL-KTS-03', 'KTS-01', 'Kutus Market Branch', 'Kutus market and surrounding commercial area'),
    ('SL-KTS-04', 'KTS-02', 'Kutus South Residential Trunk', 'Southern residential estates trunk'),
    ('SL-KTS-05', 'KTS-02', 'Kutus–Kagio Road Lateral', 'Line along Kutus–Kagio road corridor'),
    ('SL-KAG-01', 'KAG-01', 'Kagio Main Trunk', 'Primary trunk through Kagio centre'),
    ('SL-KAG-02', 'KAG-01', 'Kagio Market Lateral', 'Kagio market and vicinity branch'),
    ('SL-NDU-01', 'NDU-01', 'Nduini Residential Trunk', 'Main residential trunk in Nduini'),
    ('SL-NDU-02', 'NDU-01', 'Nduini–Kerugoya Junction Branch', 'Branch at Nduini–Kerugoya road junction'),
]


class Command(BaseCommand):
    help = 'Seed sewer lines for Kirinyaga line registry.'

    def handle(self, *args, **options):
        created = 0
        updated = 0

        for reference_code, zone_code, title, description in SEWER_LINES:
            zone = Zone.objects.filter(zone_code=zone_code).first()
            if not zone:
                self.stdout.write(self.style.WARNING(f'Skipping {reference_code}; zone {zone_code} missing. Run seed_zones first.'))
                continue

            obj, was_created = SewerLine.objects.update_or_create(
                reference_code=reference_code,
                defaults={
                    'zone': zone,
                    'description': f'{title} | {description}',
                    'start_point': title,
                    'end_point': description,
                    'pipe_material': 'pvc',
                    'diameter_mm': 150,
                    'installation_date': datetime.date(2015, 1, 1),
                    'is_active': True,
                    'patrol_frequency_per_month': 4,
                },
            )
            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(self.style.SUCCESS(f'Sewer lines seeded. Created={created}, Updated={updated}'))
