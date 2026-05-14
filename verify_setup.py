#!/usr/bin/env python
"""
Verification script to check if database is properly set up and seeded.
"""
import os
import sys
import django
from pathlib import Path

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kicowasco.settings')
sys.path.insert(0, str(Path(__file__).parent / 'kicowasco'))

django.setup()

from django.contrib.auth import get_user_model
from core.models import (
    Company, Incident, DailyLabRecord, SludgeCollection, 
    WeeklyLinePatrol, PondDailyLog, TreatmentLog
)

User = get_user_model()

def check_database():
    print("\n" + "=" * 70)
    print("KICOWASCO Database Verification")
    print("=" * 70 + "\n")
    
    checks = {
        "Companies": Company.objects.count(),
        "Users": User.objects.count(),
        "Incidents": Incident.objects.count(),
        "Lab Records": DailyLabRecord.objects.count(),
        "Sludge Collections": SludgeCollection.objects.count(),
        "Weekly Patrols": WeeklyLinePatrol.objects.count(),
        "Pond Logs": PondDailyLog.objects.count(),
        "Treatment Logs": TreatmentLog.objects.count(),
    }
    
    all_good = True
    for name, count in checks.items():
        status = "✓" if count > 0 else "✗"
        print(f"{status} {name:.<40} {count:>6}")
        if count == 0:
            all_good = False
    
    print("\n" + "=" * 70)
    
    if all_good:
        print("✓ Database is properly seeded!")
        print("\nYou can now:")
        print("  1. Start the server: python kicowasco/manage.py runserver")
        print("  2. Access the API at http://localhost:8000/api/")
        print("  3. Login with credentials from seed data")
        print("\nTest the API:")
        print("  - Incidents: http://localhost:8000/api/incidents/")
        print("  - Summary: http://localhost:8000/api/summary/?year=2026&month=5")
        print("  - Lab Records: http://localhost:8000/api/lab-records/?year=2026&month=5")
    else:
        print("✗ Database is NOT properly seeded!")
        print("\nRun the setup script:")
        print("  python setup_and_seed.py")
    
    print("=" * 70 + "\n")
    return all_good

if __name__ == '__main__':
    success = check_database()
    sys.exit(0 if success else 1)
