"""
End-to-end API smoke tests for role portal workflows (Step 9).
Run: python manage.py test core.test_workflow_smoke -v 2
"""
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from core.models import (
    DailyFlowRecord,
    DailyLabRecord,
    Exhauster,
    InletWorksDailyTask,
    LabComplianceFlag,
    MonthlySummarySnapshot,
    Notification,
    PondDailyLog,
    SludgeCollection,
    TreatmentPond,
)

User = get_user_model()
PASSWORD = 'smoke-test-pass'


class WorkflowSmokeTests(TestCase):
    """API-level smoke tests for cross-role operational workflows."""

    @classmethod
    def setUpTestData(cls):
        roles = [
            ('Mary', 'stp_attendant'),
            ('John', 'stp_operator'),
            ('Alice', 'lab_tech'),
            ('Peter', 'stp_supervisor'),
            ('Sarah', 'stp_superintendent'),
        ]
        cls.users = {}
        for username, role in roles:
            user, _ = User.objects.get_or_create(username=username, defaults={'role': role})
            user.role = role
            user.set_password(PASSWORD)
            user.save()
            cls.users[role] = user

        cls.exhauster, _ = Exhauster.objects.get_or_create(
            reg_no='SMOKE-001',
            defaults={
                'owner': 'Smoke Test Fleet',
                'capacity_m3': Decimal('10.00'),
                'status': 'active',
            },
        )
        cls.pond, _ = TreatmentPond.objects.get_or_create(
            code='SMK-P1',
            defaults={
                'name': 'Smoke Test Pond',
                'capacity_m3': Decimal('1000'),
                'frequency': 'daily',
                'is_active': True,
            },
        )

        cls.base_date = date.today() + timedelta(days=400)

    def setUp(self):
        self.client = APIClient()

    def _auth(self, role):
        user = self.users[role]
        self.client.force_authenticate(user=user)
        return user

    def _f203a_payload(self, day_offset=0):
        d = self.base_date + timedelta(days=day_offset)
        return {
            'date': d.isoformat(),
            'raking_t1': True,
            'raking_t2': True,
            'raking_t3': False,
            'raking_t3_reason': 'Rain — deferred to next shift',
            'screenings_burial': True,
            'grit_scooping': True,
            'grit_burial': True,
            'submit_for_signoff': True,
        }

    def test_attendant_blocked_from_treatment_log(self):
        self._auth('stp_attendant')
        res = self.client.post('/api/treatment-logs/', {
            'report_date': self.base_date.isoformat(),
            'shift': 'Day',
            'parameters': [
                {'parameter': 'BOD (mg/l)', 'influent_value': 200, 'effluent_value': 40},
            ],
        }, format='json')
        self.assertEqual(res.status_code, 403)

    def test_f203a_cosign_workflow(self):
        self._auth('stp_attendant')
        create = self.client.post('/api/f203a/', self._f203a_payload(0), format='json')
        self.assertEqual(create.status_code, 201, create.data)
        task_id = create.data['id']
        self.assertEqual(create.data['status'], 'pending_operator')

        op_notifications_before = Notification.objects.filter(
            recipient=self.users['stp_operator'],
            title='F203A Pending Co-sign',
        ).count()

        self._auth('stp_operator')
        sign = self.client.patch(f'/api/f203a/{task_id}/sign/')
        self.assertEqual(sign.status_code, 200)
        self.assertEqual(sign.data['status'], 'fully_signed')

        self.assertGreaterEqual(
            Notification.objects.filter(
                recipient=self.users['stp_attendant'],
                title='F203A Fully Signed',
            ).count(),
            1,
        )
        self.assertGreaterEqual(op_notifications_before, 1)

    def test_f203a_correction_request(self):
        self._auth('stp_attendant')
        create = self.client.post('/api/f203a/', self._f203a_payload(1), format='json')
        self.assertEqual(create.status_code, 201)
        task_id = create.data['id']

        self._auth('stp_operator')
        ret = self.client.patch(
            f'/api/f203a/{task_id}/request_correction/',
            {'correction_note': 'Grit burial not recorded correctly.'},
            format='json',
        )
        self.assertEqual(ret.status_code, 200)
        self.assertEqual(ret.data['status'], 'returned')

    def test_f203c_partial_flow_reading(self):
        flow_date = (self.base_date + timedelta(days=2)).isoformat()
        DailyFlowRecord.objects.filter(date=flow_date).delete()

        self._auth('stp_attendant')
        res = self.client.post('/api/flow-records/', {
            'date': flow_date,
            'remarks': 'Morning reading only',
            'readings': [{'time_slot': '09:00', 'meter_1': '12.5', 'meter_2': '12.0'}],
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertIsNotNone(res.data.get('average_daily_flow'))

        patch = self.client.patch(f'/api/flow-records/{res.data["id"]}/', {
            'date': flow_date,
            'remarks': 'Added midday',
            'readings': [
                {'time_slot': '09:00', 'meter_1': '12.5', 'meter_2': '12.0'},
                {'time_slot': '12:00', 'meter_1': '13.0', 'meter_2': '12.8'},
            ],
        }, format='json')
        self.assertEqual(patch.status_code, 200)

        self._auth('stp_operator')
        note = self.client.patch(
            f'/api/flow-records/{res.data["id"]}/add_operator_note/',
            {'operator_note': 'Readings reviewed.'},
            format='json',
        )
        self.assertEqual(note.status_code, 200)

    def test_sludge_manifest_and_operator_approval(self):
        self._auth('stp_attendant')
        coll_date = (self.base_date + timedelta(days=3)).isoformat()
        create = self.client.post('/api/sludge/', {
            'exhauster': self.exhauster.id,
            'collection_date': coll_date,
            'source_name': 'Smoke Test Plot',
            'area_ward': 'Kerugoya',
            'toilets_present': True,
            'source_type': 'residential',
            'volume_m3': '2.5',
            'driver_name': 'Test Driver',
        }, format='json')
        self.assertEqual(create.status_code, 201, create.data)
        manifest_id = create.data['id']

        self.assertGreaterEqual(
            Notification.objects.filter(
                recipient=self.users['stp_operator'],
                title='Sludge Manifest Awaiting Approval',
            ).count(),
            1,
        )

        self._auth('stp_operator')
        approve = self.client.patch(f'/api/sludge/{manifest_id}/receive/')
        self.assertEqual(approve.status_code, 200)
        self.assertEqual(approve.data['manifest_status'], 'approved')

    def test_lab_flag_and_operator_corrective_action(self):
        lab_date = self.base_date + timedelta(days=4)
        DailyLabRecord.objects.filter(record_date=lab_date).delete()

        self._auth('lab_tech')
        create = self.client.post('/api/lab-records/', {
            'record_date': lab_date.isoformat(),
            'inflow_bod': '100',
            'effluent_bod': '55',
            'inflow_tss': '80',
            'effluent_tss': '20',
        }, format='json')
        self.assertEqual(create.status_code, 201, create.data)
        self.assertLess(float(create.data['bod_removal_efficiency']), 60)

        flags = LabComplianceFlag.objects.filter(lab_record_id=create.data['id'])
        self.assertTrue(flags.exists())
        red = flags.filter(severity='red').first()
        self.assertIsNotNone(red)

        self.assertGreaterEqual(
            Notification.objects.filter(
                recipient=self.users['stp_operator'],
                title='Red Lab Compliance Flag',
            ).count(),
            1,
        )

        self._auth('stp_operator')
        resolve = self.client.patch(
            f'/api/lab-flags/{red.id}/resolve/',
            {'corrective_action': 'Increased aeration and checked return sludge.'},
            format='json',
        )
        self.assertEqual(resolve.status_code, 200)
        self.assertEqual(resolve.data['status'], 'resolved')

    def test_pond_three_step_cosign(self):
        log_date = self.base_date + timedelta(days=5)
        PondDailyLog.objects.filter(pond=self.pond, log_date=log_date).delete()

        self._auth('stp_attendant')
        create = self.client.post('/api/pond-logs/', {
            'pond': self.pond.id,
            'log_date': log_date.isoformat(),
            'remarks': 'Routine inspection',
            'surface_scum': False,
        }, format='json')
        self.assertEqual(create.status_code, 201, create.data)
        self.assertEqual(create.data['status'], 'pending_second_sign')
        log_id = create.data['id']

        self._auth('stp_operator')
        cosign = self.client.patch(f'/api/pond-logs/{log_id}/cosign/')
        self.assertEqual(cosign.status_code, 200)
        self.assertEqual(cosign.data['status'], 'pending_supervisor')

        self._auth('stp_supervisor')
        verify = self.client.patch(f'/api/pond-logs/{log_id}/verify/')
        self.assertEqual(verify.status_code, 200)
        self.assertEqual(verify.data['status'], 'fully_signed')

    def test_superintendent_compliance_day_detail(self):
        lab_date = self.base_date + timedelta(days=6)
        record, _ = DailyLabRecord.objects.update_or_create(
            record_date=lab_date,
            defaults={
                'attendant': self.users['lab_tech'],
                'inflow_bod': Decimal('100'),
                'effluent_bod': Decimal('50'),
                'inflow_tss': Decimal('90'),
                'effluent_tss': Decimal('25'),
            },
        )
        record.save()

        self._auth('stp_superintendent')
        res = self.client.get(f'/api/summary/?record_id={record.id}')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['record_id'], record.id)
        self.assertIn('bod_removal_efficiency', res.data)
        self.assertIn('flags', res.data)

    def test_month_lock_blocks_edits(self):
        lock_year, lock_month = 2098, 11
        MonthlySummarySnapshot.objects.filter(year=lock_year, month=lock_month).delete()

        self._auth('stp_superintendent')
        lock = self.client.post(
            '/api/summary/lock_month/',
            {'year': lock_year, 'month': lock_month},
            format='json',
        )
        self.assertEqual(lock.status_code, 200, lock.data)

        locked_date = date(lock_year, lock_month, 15)
        InletWorksDailyTask.objects.filter(date=locked_date).delete()

        self._auth('stp_attendant')
        blocked = self.client.post('/api/f203a/', {
            **self._f203a_payload(0),
            'date': locked_date.isoformat(),
        }, format='json')
        self.assertEqual(blocked.status_code, 403)

    def test_quick_flag_notifies_supervisor(self):
        self._auth('stp_attendant')
        before = Notification.objects.filter(recipient=self.users['stp_supervisor']).count()
        res = self.client.post('/api/notifications/quick_flag/', {
            'form': 'F203A',
            'description': 'Unusual odour at screens.',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertGreater(Notification.objects.filter(recipient=self.users['stp_supervisor']).count(), before)
