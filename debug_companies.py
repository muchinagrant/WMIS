import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kicowasco.settings')
sys.path.insert(0, '/Users/mchna/Desktop/kicowasco')
django.setup()

from django.contrib.auth import get_user_model
from core.models import Incident, DailyLabRecord, Company

User = get_user_model()

print("=== USERS AND COMPANIES ===")
for user in User.objects.all()[:5]:
    print(f"User: {user.username}, Role: {user.role}, Company: {user.company}")

print(f"\n=== TOTAL USERS: {User.objects.count()}")

print("\n=== COMPANIES ===")
for company in Company.objects.all():
    print(f"Company: {company.code} - {company.name}")

print(f"\nTotal companies: {Company.objects.count()}")

print("\n=== INCIDENT SAMPLE ===")
incident = Incident.objects.first()
if incident:
    print(f"Incident ID: {incident.id}")
    print(f"Created by: {incident.created_by} (company: {incident.created_by.company if incident.created_by else 'N/A'})")
    print(f"Assigned to: {incident.assigned_to} (company: {incident.assigned_to.company if incident.assigned_to else 'N/A'})")

print("\n=== LAB RECORD SAMPLE ===")
lab = DailyLabRecord.objects.first()
if lab:
    print(f"Lab ID: {lab.id}")
    print(f"Attendant: {lab.attendant} (company: {lab.attendant.company if lab.attendant else 'N/A'})")

print("\n=== FILTERING TEST ===")
sarah = User.objects.filter(username='sarah').first()
if sarah:
    print(f"Sarah: {sarah.username}, Company: {sarah.company}")
    if sarah.company:
        filtered_incidents = Incident.objects.filter(
            created_by__company=sarah.company
        ) | Incident.objects.filter(
            assigned_to__company=sarah.company
        )
        print(f"Incidents visible to Sarah: {filtered_incidents.count()}")
    else:
        print("Sarah has NO company assigned - can see ALL incidents (unrestricted)")
