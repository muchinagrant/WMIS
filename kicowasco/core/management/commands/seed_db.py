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
    help = "Seeds the database with 90 days of realistic KICOWASCO test data"

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING("Seeding database with 90 days of data... This will take a moment."))

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
            user, _ = User.objects.get_or_create(username=u_data["username"])
            user.first_name = u_data["first_name"]
            user.last_name = u_data["last_name"]
            user.role = u_data["role"]
            user.set_password("kicowasco123")
            user.save()
            users_dict[u_data["username"]] = user

        # --- 2. CREATE FLEET ---
        now = timezone.now()
        ex1, _ = Exhauster.objects.get_or_create(
            reg_no="KCC 123A",
            defaults={"owner": "Clean Waste Ltd", "capacity_m3": 10},
        )
        ex2, _ = Exhauster.objects.get_or_create(
            reg_no="KDD 456B",
            defaults={"owner": "Green Env Services", "capacity_m3": 15},
        )
        ex3, _ = Exhauster.objects.get_or_create(
            reg_no="KEE 789C",
            defaults={"owner": "County Exhauster", "capacity_m3": 8},
        )

        License.objects.get_or_create(
            exhauster=ex1,
            defaults={
                "license_no": "LIC-2026-001",
                "start_date": now.date() - timedelta(days=30),
                "end_date": now.date() + timedelta(days=330),
                "status": "valid",
            },
        )
        License.objects.get_or_create(
            exhauster=ex2,
            defaults={
                "license_no": "LIC-2025-999",
                "start_date": now.date() - timedelta(days=400),
                "end_date": now.date() - timedelta(days=35),
                "status": "expired",
            },
        )
        License.objects.get_or_create(
            exhauster=ex3,
            defaults={
                "license_no": "LIC-2026-002",
                "start_date": now.date() - timedelta(days=15),
                "end_date": now.date() + timedelta(days=180),
                "status": "valid",
            },
        )

        # --- 3. GENERATE 90 DAYS OF HISTORICAL DATA ---
        days_to_seed = 90

        for day_offset in range(days_to_seed):
            sim_dt = now - timedelta(days=days_to_seed - day_offset)
            sim_date = sim_dt.date()

            # A. Daily Treatment Log (F203 Lab Data)
            is_good_day = random.random() > 0.15
            tlog, _ = TreatmentLog.objects.get_or_create(
                report_date=sim_date,
                defaults={"operator": users_dict["Alice"], "shift": "Day", "alert": not is_good_day},
            )
            if not tlog.operator_id:
                tlog.operator = users_dict["Alice"]
                tlog.shift = tlog.shift or "Day"
                tlog.alert = not is_good_day
                tlog.save()

            TreatmentParameter.objects.get_or_create(
                tlog=tlog,
                parameter="BOD (mg/l)",
                defaults={
                    "influent_value": random.uniform(400, 500),
                    "effluent_value": random.uniform(30, 60) if is_good_day else random.uniform(90, 150),
                },
            )
            TreatmentParameter.objects.get_or_create(
                tlog=tlog,
                parameter="TSS (mg/l)",
                defaults={
                    "influent_value": random.uniform(300, 400),
                    "effluent_value": random.uniform(20, 50) if is_good_day else random.uniform(80, 120),
                },
            )

            # B. Daily Sludge Manifests (2-5 trucks per day)
            for _ in range(random.randint(2, 5)):
                SludgeCollection.objects.create(
                    collection_date=sim_date,
                    source_type=random.choice(["residential", "institutional", "commercial"]),
                    source_name=fake.company(),
                    volume_m3=random.uniform(5, 15),
                    exhauster=random.choice([ex1, ex2, ex3]),
                    receiving_officer=users_dict["John"],
                    manifest_status="completed",
                )

            # C. F201 Weekly Patrol (1 per day simulating different routes)
            WeeklyLinePatrol.objects.create(
                date=sim_date,
                time=sim_dt.time(),
                drainage_area=random.choice(["Kerugoya Central", "Kutus Market", "Sagana Highway"]),
                sewer_line_ref=f"SL-{random.randint(100, 999)}",
                attendant=users_dict["Kevin"],
                abnormality_observed=random.choice(["none", "none", "blockage", "missing_cover"]),
                new_mother_accounts=random.randint(0, 2),
                new_child_accounts=random.randint(0, 3),
            )

            # D. Incidents and Repairs Pipeline
            for _ in range(random.randint(1, 2)):
                if day_offset > days_to_seed - 7:
                    status_choice = random.choice(["new", "assigned", "in_progress", "pending_certification", "resolved"])
                else:
                    status_choice = "resolved"

                category = random.choice(["blockage", "burst", "spillage", "odor", "missing_cover"])
                reported_at = sim_dt.replace(hour=random.randint(6, 18), minute=random.randint(0, 59), second=0, microsecond=0)

                incident = Incident.objects.create(
                    reported_at=reported_at,
                    category=category,
                    severity=random.choice(["low", "medium", "high"]),
                    location_text=fake.street_address(),
                    reported_by_name=fake.name(),
                    status="new",
                )

                if status_choice in ["assigned", "in_progress", "pending_certification", "resolved"]:
                    incident.status = "assigned"
                    incident.assigned_to = users_dict["Kevin"]
                    incident.assigned_at = reported_at + timedelta(hours=1)
                    incident.save()

                if status_choice in ["in_progress", "pending_certification", "resolved"]:
                    incident.status = "in_progress"
                    incident.in_progress_at = reported_at + timedelta(hours=2)
                    incident.save()

                if status_choice in ["pending_certification", "resolved"]:
                    incident.status = "pending_certification"
                    incident.save()

                    Repair.objects.create(
                        incident=incident,
                        completion_date=sim_date,
                        location=incident.location_text,
                        repair_type="rodding" if category == "blockage" else "pipe_replacement",
                        scope_of_work=f"Attended to {category}. Flushed lines and verified flow.",
                        materials_used="2 units PVC, 1 unit cement" if category == "burst" else "None",
                        technician=users_dict["Kevin"],
                        supervisor=users_dict["Peter"] if status_choice == "resolved" else None,
                        certified_at=(reported_at + timedelta(hours=5)) if status_choice == "resolved" else None,
                    )

                if status_choice == "resolved":
                    incident.status = "resolved"
                    incident.resolved_at = reported_at + timedelta(hours=5)
                    incident.save()

        self.stdout.write(self.style.SUCCESS("\nSUCCESS! Seeded 90 days of massive operational data."))
