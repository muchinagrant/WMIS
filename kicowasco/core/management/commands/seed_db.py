import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone
from faker import Faker

from core.models import (
    Exhauster,
    Incident,
    License,
    Repair,
    SludgeCollection,
    TreatmentLog,
    TreatmentParameter,
    WeeklyLinePatrol,
)

User = get_user_model()
fake = Faker()


class Command(BaseCommand):
    help = "Seeds the database with realistic KICOWASCO test data"

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING("Seeding database... This might take a moment."))

        # --- 1. CREATE USERS ---
        users_data = [
            {"username": "Sarah", "first_name": "Sarah", "last_name": "Wanjiku", "role": "superintendent"},
            {"username": "Peter", "first_name": "Peter", "last_name": "Kamau", "role": "supervisor"},
            {"username": "Alice", "first_name": "Alice", "last_name": "Muthoni", "role": "lab_tech"},
            {"username": "John", "first_name": "John", "last_name": "Musyoka", "role": "operator"},
            {"username": "Kevin", "first_name": "Kevin", "last_name": "Otieno", "role": "attendant"},
        ]

        users_dict = {}
        for u_data in users_data:
            user, created = User.objects.get_or_create(username=u_data["username"])
            if created:
                user.first_name = u_data["first_name"]
                user.last_name = u_data["last_name"]
                user.role = u_data["role"]
                user.set_password("kicowasco123")  # Default testing password
                user.save()
            users_dict[u_data["username"]] = user

        self.stdout.write(self.style.SUCCESS("Users verified/created (Password: kicowasco123)"))

        # --- 2. CREATE FLEET (EXHAUSTERS & LICENSES) ---
        now = timezone.now()

        ex1, _ = Exhauster.objects.get_or_create(
            reg_no="KCC 123A", defaults={"owner": "Clean Waste Ltd", "capacity_m3": 10}
        )
        ex2, _ = Exhauster.objects.get_or_create(
            reg_no="KDD 456B", defaults={"owner": "Green Env Services", "capacity_m3": 15}
        )

        # Valid License
        License.objects.get_or_create(
            exhauster=ex1,
            defaults={
                "license_no": "LIC-2026-001",
                "start_date": now.date() - timedelta(days=30),
                "end_date": now.date() + timedelta(days=330),
                "status": "valid",
            },
        )
        # Expired License (To test our frontend block logic!)
        License.objects.get_or_create(
            exhauster=ex2,
            defaults={
                "license_no": "LIC-2025-999",
                "start_date": now.date() - timedelta(days=400),
                "end_date": now.date() - timedelta(days=35),
                "status": "expired",
            },
        )

        self.stdout.write(self.style.SUCCESS("Fleet & Licenses created (including 1 expired license)"))

        # --- 3. CREATE HISTORICAL OPERATIONS (F201 & F203) ---
        # Generate some lab data to make the Grade 3 Dashboard charts look good
        for i in range(5):
            log_date = now.date() - timedelta(days=i)
            tlog, _ = TreatmentLog.objects.get_or_create(
                report_date=log_date, defaults={"operator": users_dict["Alice"], "shift": "Day"}
            )

            # Create BOD & TSS parameters with ~85% efficiency
            TreatmentParameter.objects.get_or_create(
                tlog=tlog,
                parameter="BOD (mg/l)",
                defaults={"influent_value": random.uniform(400, 500), "effluent_value": random.uniform(30, 60)},
            )
            TreatmentParameter.objects.get_or_create(
                tlog=tlog,
                parameter="TSS (mg/l)",
                defaults={"influent_value": random.uniform(300, 400), "effluent_value": random.uniform(20, 50)},
            )

            # F201 Weekly Patrol (Finding Mother/Child Accounts for revenue dashboard)
            WeeklyLinePatrol.objects.get_or_create(
                date=log_date,
                time=now.time(),
                drainage_area="Kerugoya Central",
                sewer_line_ref=f"SL-{100 + i}",
                defaults={
                    "attendant": users_dict["Kevin"],
                    "abnormality_observed": "none",
                    "new_mother_accounts": random.randint(0, 3),
                    "new_child_accounts": random.randint(0, 5),
                },
            )

            # Sludge Manifest (Using the Valid Exhauster)
            SludgeCollection.objects.get_or_create(
                collection_date=log_date,
                defaults={
                    "source_type": "residential",
                    "source_name": fake.company(),
                    "volume_m3": random.uniform(5, 10),
                    "exhauster": ex1,
                    "receiving_officer": users_dict["John"],
                },
            )

        self.stdout.write(self.style.SUCCESS("F201 Patrols, F203 Lab Logs, and Sludge Manifests generated"))

        # --- 4. CREATE INCIDENT & REPAIR WORKFLOW ---
        # 1. New Incident (Unassigned)
        Incident.objects.get_or_create(
            description="Severe odor near market",
            defaults={
                "reported_at": now - timedelta(days=1),
                "category": "odor",
                "severity": "medium",
                "location_text": "Kutus Market Gate",
                "reported_by_name": "Civilian",
                "status": "new",
            },
        )

        # 2. Resolved Incident with a linked Repair
        inc_resolved, _ = Incident.objects.get_or_create(
            description="Burst pipe flooding the street",
            defaults={
                "reported_at": now - timedelta(days=4),
                "category": "burst",
                "severity": "high",
                "location_text": "Sagana Highway",
                "reported_by_name": "Highway Patrol",
                "status": "resolved",
                "assigned_to": users_dict["Kevin"],
                "assigned_at": now - timedelta(days=3),
                "resolved_at": now - timedelta(days=2),
            },
        )

        repair, rep_created = Repair.objects.get_or_create(
            incident=inc_resolved,
            defaults={
                "completion_date": (now - timedelta(days=2)).date(),
                "location": inc_resolved.location_text,
                "repair_type": "pipe_replacement",
                "scope_of_work": "Excavated and replaced damaged sewer pipe section.",
                "materials_used": "2 PVC pipes, 1 bag cement",
                "technician": users_dict["Kevin"],
                "supervisor": users_dict["Peter"],
                "certified_at": now - timedelta(days=2),
            },
        )

        if rep_created:
            self.stdout.write(self.style.SUCCESS("Resolved incident and completion certificate mapped"))

        self.stdout.write(self.style.SUCCESS("\nSEEDING COMPLETE! You can now log in with the test accounts."))
