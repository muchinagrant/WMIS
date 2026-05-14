import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone
from faker import Faker

from core.models import (
    Company,
    DailyLabRecord,
    Exhauster,
    ExhausterLicense,
    Incident,
    PondDailyLog,
    PondYearlyTask,
    Repair,
    SewerLineSection,
    PatrolRow,
    SludgeCollection,
    TreatmentLog,
    TreatmentParameter,
    TreatmentPond,
    WeeklyLinePatrol,
)

User = get_user_model()
fake = Faker()


class Command(BaseCommand):
    help = "Seeds the database with 90 days of realistic KICOWASCO test data"

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING("Seeding database with 90 days of data... This will take a moment."))

        default_company, _ = Company.objects.get_or_create(
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

        # --- 1. CREATE USERS ---
        users_data = [
            {"username": "Sarah", "first_name": "Sarah", "last_name": "Wanjiku", "role": "stp_superintendent"},
            {"username": "Peter", "first_name": "Peter", "last_name": "Kamau", "role": "stp_supervisor"},
            {"username": "Alice", "first_name": "Alice", "last_name": "Muthoni", "role": "lab_tech"},
            {"username": "John", "first_name": "John", "last_name": "Musyoka", "role": "stp_operator"},
            {"username": "Kevin", "first_name": "Kevin", "last_name": "Otieno", "role": "line_attendant"},
            {"username": "linespv", "first_name": "Line", "last_name": "Supervisor", "role": "line_supervisor"},
        ]

        users_dict = {}
        for u_data in users_data:
            user, _ = User.objects.get_or_create(username=u_data["username"])
            user.first_name = u_data["first_name"]
            user.last_name = u_data["last_name"]
            user.role = u_data["role"]
            user.company = default_company
            # Ensure existing users are allowed to authenticate after reseeding.
            user.is_active = True
            user.set_password("kicowasco123")
            user.save()
            users_dict[u_data["username"]] = user

        # --- 2. SEED SEWER LINE SECTIONS ---
        sections_to_seed = [
            {'code': 'KRG-MAIN', 'is_confirmed': False},
            {'code': 'KTS-MAIN', 'is_confirmed': False},
            {'code': 'SGN-MAIN', 'is_confirmed': False},
        ]
        sewer_sections = {}
        for sec_data in sections_to_seed:
            section, _ = SewerLineSection.objects.get_or_create(
                code=sec_data['code'],
                defaults={'is_confirmed': sec_data['is_confirmed']},
            )
            sewer_sections[sec_data['code']] = section

        # --- 3. CREATE FLEET ---
        now = timezone.now()
        # --- 1b. TREATMENT PONDS ---
        pond1, _ = TreatmentPond.objects.get_or_create(
            code='AP-01',
            defaults={'name': 'Anaerobic Pond 1', 'capacity_m3': 2500, 'is_active': True},
        )
        pond2, _ = TreatmentPond.objects.get_or_create(
            code='AP-02',
            defaults={'name': 'Anaerobic Pond 2', 'capacity_m3': 2500, 'is_active': True},
        )

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

        ExhausterLicense.objects.get_or_create(
            exhauster=ex1,
            defaults={
                "license_no": "LIC-2026-001",
                "start_date": now.date() - timedelta(days=30),
                "end_date": now.date() + timedelta(days=330),
                "status": "active",
            },
        )
        ExhausterLicense.objects.get_or_create(
            exhauster=ex2,
            defaults={
                "license_no": "LIC-2025-999",
                "start_date": now.date() - timedelta(days=400),
                "end_date": now.date() - timedelta(days=35),
                "status": "expired",
            },
        )
        ExhausterLicense.objects.get_or_create(
            exhauster=ex3,
            defaults={
                "license_no": "LIC-2026-002",
                "start_date": now.date() - timedelta(days=15),
                "end_date": now.date() + timedelta(days=180),
                "status": "active",
            },
        )

        # --- 3. GENERATE 90 DAYS OF HISTORICAL DATA ---
        days_to_seed = 90

        for day_offset in range(days_to_seed):
            sim_dt = now - timedelta(days=days_to_seed - day_offset)
            sim_date = sim_dt.date()

            # A. Daily Treatment Log (F203 Lab Data)
            is_good_day = random.random() > 0.15
            tlog = TreatmentLog.objects.filter(report_date=sim_date).order_by("id").first()
            if tlog is None:
                tlog = TreatmentLog.objects.create(
                    report_date=sim_date,
                    operator=users_dict["Alice"],
                    shift="Day",
                    alert=not is_good_day,
                )
            else:
                tlog.operator = tlog.operator or users_dict["Alice"]
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
                    received_by=users_dict["John"],
                    manifest_status="received",
                )

            # C. F201 Weekly Patrol (1 per day simulating different routes)
            area_section_map = {
                "Kerugoya Central": sewer_sections['KRG-MAIN'],
                "Kutus Market": sewer_sections['KTS-MAIN'],
                "Sagana Highway": sewer_sections['SGN-MAIN'],
            }
            drainage_area = random.choice(["Kerugoya Central", "Kutus Market", "Sagana Highway"])
            patrol = WeeklyLinePatrol.objects.create(
                date=sim_date,
                week_number=sim_dt.isocalendar()[1],
                drainage_area=drainage_area,
                attendant=users_dict["Kevin"],
            )
            PatrolRow.objects.create(
                weekly_patrol=patrol,
                time=sim_dt.time(),
                sewer_line_section=area_section_map[drainage_area],
                sewer_line_ref_text=f"SL-{random.randint(100, 999)}",
                abnormality_observed=random.choice(["none", "none", "blockage", "missing_cover"]),
                new_mother_connections=random.randint(0, 2),
                new_child_connections=random.randint(0, 3),
            )

            # C2. Pond Daily Logs
            for pond in [pond1, pond2]:
                if not PondDailyLog.objects.filter(pond=pond, log_date=sim_date).exists():
                    PondDailyLog.objects.create(
                        pond=pond,
                        log_date=sim_date,
                        submitted_by=users_dict.get('Kevin'),
                        ph=round(random.uniform(6.8, 7.8), 2),
                        temperature=round(random.uniform(20.0, 28.0), 2),
                        do_level=round(random.uniform(0.1, 1.5), 2),
                        surface_scum=random.random() < 0.15,
                        odour_complaint=random.random() < 0.10,
                        colour=random.choice(['grey', 'dark grey', 'brown', 'black']),
                        status='submitted',
                    )

            # D. Daily Lab Record
            if not DailyLabRecord.objects.filter(record_date=sim_date).exists():
                DailyLabRecord.objects.create(
                    record_date=sim_date,
                    attendant=users_dict.get('Kevin'),
                    inflow_ph=round(random.uniform(6.5, 8.5), 2),
                    inflow_temperature=round(random.uniform(20.0, 30.0), 2),
                    inflow_tss=round(random.uniform(180, 350), 2),
                    inflow_bod=round(random.uniform(150, 320), 2) if day_offset % 3 == 0 else None,
                    effluent_ph=round(random.uniform(6.8, 7.8), 2),
                    effluent_temperature=round(random.uniform(19.0, 27.0), 2),
                    effluent_tss=round(random.uniform(10, 45), 2),
                    effluent_bod=round(random.uniform(8, 40), 2) if day_offset % 3 == 0 else None,
                    effluent_turbidity=round(random.uniform(2.0, 8.0), 2),
                    effluent_chlorine=round(random.uniform(0.5, 3.5), 2),
                    effluent_do=round(random.uniform(4.0, 8.0), 2),
                    volume_treated_m3=round(random.uniform(200, 450), 3),
                    status='submitted',
                )

            # E. Incidents and Repairs Pipeline
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
                        supervisor=users_dict["linespv"] if status_choice == "resolved" else None,
                        certified_at=(reported_at + timedelta(hours=5)) if status_choice == "resolved" else None,
                    )

                if status_choice == "resolved":
                    incident.status = "resolved"
                    incident.resolved_at = reported_at + timedelta(hours=5)
                    incident.save()

        self.stdout.write(self.style.SUCCESS("\nSUCCESS! Seeded 90 days of massive operational data."))
