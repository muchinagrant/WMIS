from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from core.models import Zone


User = get_user_model()
PASSWORD = 'line-smoke-pass'


class LineWorkflowSmokeTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.attendant = User.objects.create_user(
            username='line_attendant_smoke',
            password=PASSWORD,
            role='line_attendant',
            first_name='Line',
            last_name='Attendant',
        )
        cls.supervisor = User.objects.create_user(
            username='line_supervisor_smoke',
            password=PASSWORD,
            role='line_supervisor',
            first_name='Line',
            last_name='Supervisor',
        )
        cls.zone = Zone.objects.create(name='Smoke Zone', zone_code='SMK-Z1', is_active=True)

    def setUp(self):
        self.client = APIClient()

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def test_line_incident_critical_path_end_to_end(self):
        self._auth(self.attendant)
        create = self.client.post('/api/incidents/', {
            'reported_at': '2026-05-24T08:30:00Z',
            'category': 'blockage',
            'severity': 'high',
            'system_suggested_severity': 'medium',
            'final_severity': 'high',
            'override_reason': 'Overflow now reaching roadside drainage channel.',
            'location_text': 'Kerugoya Main Road near market junction',
            'zone': self.zone.id,
            'reported_by_name': 'Field Attendant',
            'reported_contact': '+254700000001',
            'description': 'Blockage causing overflow from manhole.',
            'sewer_line_reference': 'SL-104',
        }, format='json')
        self.assertEqual(create.status_code, 201, create.data)
        incident_id = create.data['id']

        self._auth(self.supervisor)
        assign = self.client.post(f'/api/incidents/{incident_id}/assign/', {
            'user_id': self.attendant.id,
            'assisting_crew': 'Crew A',
            'assignment_instructions': 'Clear blockage and confirm downstream flow.',
        }, format='json')
        self.assertEqual(assign.status_code, 200, assign.data)
        self.assertEqual(assign.data['status'], 'assigned')

        self._auth(self.attendant)
        start = self.client.post(f'/api/incidents/{incident_id}/update_status/', {
            'status': 'in_progress',
        }, format='json')
        self.assertEqual(start.status_code, 200, start.data)
        self.assertEqual(start.data['status'], 'in_progress')

        attempt_1 = self.client.post(f'/api/incidents/{incident_id}/submit_attempt/', {
            'work_performed': 'Rodded line and removed debris from manhole.',
            'materials_used': 'Rodding set, gloves',
        }, format='json')
        self.assertEqual(attempt_1.status_code, 201, attempt_1.data)
        self.assertEqual(attempt_1.data['incident']['status'], 'pending_certification')

        self._auth(self.supervisor)
        send_back = self.client.post(f'/api/incidents/{incident_id}/send_back/', {
            'reason': 'Please include additional flushing and confirm free flow at outlet.',
        }, format='json')
        self.assertEqual(send_back.status_code, 200, send_back.data)
        self.assertEqual(send_back.data['status'], 'revision_required')

        self._auth(self.attendant)
        my_tasks = self.client.get('/api/incidents/my-tasks/')
        self.assertEqual(my_tasks.status_code, 200, my_tasks.data)
        self.assertTrue(any(item['id'] == incident_id and item['status'] == 'revision_required' for item in my_tasks.data))

        attempt_2 = self.client.post(f'/api/incidents/{incident_id}/submit_attempt/', {
            'work_performed': 'Performed additional flushing and validated flow at downstream outlet.',
            'materials_used': 'Water jet, PPE',
        }, format='json')
        self.assertEqual(attempt_2.status_code, 201, attempt_2.data)
        self.assertEqual(attempt_2.data['attempt']['attempt_number'], 2)
        self.assertEqual(attempt_2.data['incident']['status'], 'pending_certification')

        self._auth(self.supervisor)
        certify = self.client.post(f'/api/incidents/{incident_id}/certify/', {
            'certification_notes': 'Verified completion and restored service.',
        }, format='json')
        self.assertEqual(certify.status_code, 200, certify.data)
        self.assertEqual(certify.data['status'], 'closed')

        history = self.client.get('/api/incidents/?status=closed')
        self.assertEqual(history.status_code, 200, history.data)
        history_results = history.data if isinstance(history.data, list) else history.data.get('results', [])
        record = next((item for item in history_results if item['id'] == incident_id), None)
        self.assertIsNotNone(record)
        self.assertEqual(record['system_suggested_severity'], 'medium')
        self.assertEqual(record['final_severity'], 'high')
