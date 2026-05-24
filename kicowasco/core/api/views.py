from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.conf import settings
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum, Avg, Count, Q
from django.http import HttpResponse
import calendar
import csv
import datetime

from core.models import (
    Incident, RepairAttempt, Inspection, TreatmentLog, Exhauster,
    ExhausterLicense, SludgeCollection, ConnectionReport, Attachment,
    SewerLineSection, PatrolRow, WeeklyLinePatrol,
    InletWorksDailyTask, DailyFlowRecord, TreatmentParameter, DailyLabRecord,
    MonthlySummarySnapshot, TreatmentPond, PondDailyLog, PondYearlyTask,
    Zone, SewerLine, Notification, LabComplianceFlag, TeamMembership, FieldMonthlyReport,
)
from core.permissions import (
    IsLineSupervisorOrAbove, IsSTPOperatorOrAbove, IsSTPSupervisorOrAbove,
    IsSTPOperator, IsSTPOperatorOrLabTech, IsSTPSuperintendent,
)
from core.api.mixins import LockEnforcementMixin, ExecutiveReadOnlyMixin, MonthLockEnforcementMixin
from .serializers import (
    IncidentSerializer, RepairAttemptSerializer, InspectionSerializer,
    TreatmentLogSerializer, ExhausterSerializer, ExhausterLicenseSerializer,
    SludgeCollectionSerializer, ConnectionReportSerializer,
    CustomTokenObtainPairSerializer,
    SewerLineSectionSerializer, PatrolRowSerializer, WeeklyLinePatrolSerializer,
    InletWorksDailyTaskSerializer, DailyFlowRecordSerializer,
    DailyLabRecordSerializer, AttachmentSerializer, UserSerializer,
    TreatmentPondSerializer, PondDailyLogSerializer, PondYearlyTaskSerializer,
    ZoneSerializer, SewerLineSerializer, NotificationSerializer, LabComplianceFlagSerializer,
    TeamMembershipSerializer, FieldMonthlyReportSerializer,
)


def _notify_roles(roles, title, message, notification_type='approval', link_url=''):
    recipients = User.objects.filter(role__in=roles)
    notifications = [
        Notification(
            recipient=user,
            title=title,
            message=message,
            notification_type=notification_type,
            link_url=link_url,
        )
        for user in recipients
    ]
    if notifications:
        Notification.objects.bulk_create(notifications)


def _notify_user(user, title, message, notification_type='general', link_url='', related_incident=None):
    if not user:
        return
    Notification.objects.create(
        recipient=user,
        title=title,
        message=message,
        notification_type=notification_type,
        link_url=link_url,
        related_incident=related_incident,
    )

# --- CUSTOM AUTHENTICATION VIEW ---
class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Overrides the default token view to use our custom serializer,
    which injects the user's role into the JWT payload for frontend RBAC.
    """
    serializer_class = CustomTokenObtainPairSerializer


# --- EXISTING VIEWSETS ---

User = get_user_model()


def _company_filter_kwargs(path, company):
    return {f'{path}__company': company}


def _scope_queryset_by_company(qs, user, path):
    company = getattr(user, 'company', None)
    if not company:
        return qs
    return qs.filter(**_company_filter_kwargs(path, company))

class IncidentViewSet(ExecutiveReadOnlyMixin, viewsets.ModelViewSet):
    queryset = Incident.objects.all().order_by('-reported_at')
    serializer_class = IncidentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'category', 'severity', 'zone', 'assigned_to']
    search_fields = ['incident_number', 'location_text', 'reported_by_name', 'description']

    def get_queryset(self):
        qs = super().get_queryset()
        # For single-company deployments, bypass company filtering
        # TODO: Re-enable multi-company isolation when needed
        return qs

    def perform_create(self, serializer):
        incident = serializer.save(created_by=self.request.user)
        if not incident.system_suggested_severity:
            incident.system_suggested_severity = incident.severity
        if not incident.final_severity:
            incident.final_severity = incident.severity
        incident.save(update_fields=['system_suggested_severity', 'final_severity'])
        if incident.severity in {'high', 'critical'}:
            reporter = incident.reported_by_name or self.request.user.get_full_name() or self.request.user.username
            body = f'⚠ CRITICAL INCIDENT: {incident.get_category_display()} reported at {incident.location_text} by {reporter}. Immediate action required.'
            if incident.system_suggested_severity and incident.final_severity and incident.system_suggested_severity != incident.final_severity:
                body = (
                    f'⚠ CRITICAL INCIDENT (manually escalated): {incident.get_category_display()} at {incident.location_text}. '
                    f'Attendant override reason: {incident.override_reason or "No reason provided"}.'
                )
            _notify_roles(
                ['line_supervisor'],
                'Critical Incident Alert',
                body,
                notification_type='incident_critical',
                link_url='/dispatch',
            )

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsLineSupervisorOrAbove])
    def close(self, request, pk=None):
        incident = self.get_object()
        if incident.status == 'closed':
            return Response({'error': 'Incident is already closed.'}, status=status.HTTP_400_BAD_REQUEST)
        incident.status = 'closed'
        incident.save()
        return Response(self.get_serializer(incident).data)

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsLineSupervisorOrAbove])
    def reopen(self, request, pk=None):
        incident = self.get_object()
        if incident.status not in ('closed', 'resolved', 'deferred', 'rejected'):
            return Response(
                {'error': 'Only closed, resolved, deferred or rejected incidents can be reopened.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        incident.status = 'in_progress'
        incident.resolved_at = None
        incident.save()
        return Response(self.get_serializer(incident).data)

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsLineSupervisorOrAbove])
    def mark_duplicate(self, request, pk=None):
        incident = self.get_object()
        original_id = request.data.get('duplicate_of')
        if not original_id:
            return Response({'error': 'duplicate_of (incident id) is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            original = Incident.objects.get(pk=original_id)
        except Incident.DoesNotExist:
            return Response({'error': 'Original incident not found.'}, status=status.HTTP_404_NOT_FOUND)
        if original.pk == incident.pk:
            return Response({'error': 'An incident cannot be a duplicate of itself.'}, status=status.HTTP_400_BAD_REQUEST)
        incident.status = 'duplicate'
        incident.duplicate_of = original
        incident.save()
        return Response(self.get_serializer(incident).data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsLineSupervisorOrAbove])
    def assign(self, request, pk=None):
        """
        Supervisor-Only Endpoint: Assigns an incident to a field technician 
        and automatically advances the state machine.
        """
        incident = self.get_object()
        user_id = request.data.get('user_id')
        assisting_crew = request.data.get('assisting_crew', '')
        
        if not user_id:
            return Response({'error': 'A user_id is required to assign an incident.'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            technician = User.objects.get(id=user_id)
            if getattr(request.user, 'company_id', None) and technician.company_id != request.user.company_id:
                return Response({'error': 'Cannot assign incidents across companies.'}, status=status.HTTP_403_FORBIDDEN)

            with transaction.atomic():
                incident.assigned_to = technician
                incident.assisting_crew = assisting_crew
                incident.status = 'assigned'
                incident.assigned_at = timezone.now()
                incident.assignment_instructions = request.data.get('assignment_instructions', request.data.get('instructions', ''))
                incident.save(update_fields=['assigned_to', 'assisting_crew', 'status', 'assigned_at', 'assignment_instructions', 'updated_at'])

            _notify_user(
                technician,
                'New Task Assigned',
                f'New task assigned: {incident.get_category_display()} at {incident.location_text}. Tap to view.',
                notification_type='task_assigned',
                link_url='/my-tasks',
                related_incident=incident,
            )
            
            serializer = self.get_serializer(incident)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except User.DoesNotExist:
            return Response({'error': 'Technician not found.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """
        Enforces strict business rules on who can change an incident's status.
        """
        incident = self.get_object()
        new_status = request.data.get('status')
        user_role = getattr(request.user, 'role', '')

        if not new_status:
            return Response({'error': 'status is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # --- RULE 1: Line Attendants ---
        if user_role == 'line_attendant':
            if new_status == 'in_progress' and incident.status == 'assigned':
                if incident.assigned_to != request.user:
                    return Response({'error': 'You can only start incidents assigned specifically to you.'}, status=status.HTTP_403_FORBIDDEN)
                
                # UPGRADED: Start the active work timer automatically
                incident.in_progress_at = timezone.now()  # <-- AUTOMATED TIMESTAMP

            elif new_status == 'pending_certification':
                if incident.assigned_to != request.user:
                    return Response({'error': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)
                latest_attempt = incident.repair_attempts.order_by('-attempt_number').first()
                if latest_attempt is None:
                    return Response({'error': 'A repair attempt is required before submitting for certification.'}, status=status.HTTP_400_BAD_REQUEST)
                
            elif new_status in ['resolved', 'closed']:
                return Response({
                    'error': 'Line attendants cannot directly resolve incidents. You must submit for certification.'
                }, status=status.HTTP_403_FORBIDDEN)
            # Handle exception states for plumbers (e.g., waiting for parts)
            elif new_status not in ['on_hold_materials', 'on_hold_equipment', 'pending_certification']:
                return Response({'error': 'Invalid status transition for your role.'}, status=status.HTTP_403_FORBIDDEN)

        # --- RULE 2: Grade 4 Supervisors override authority ---
        old_status = incident.status
        incident.status = new_status
        if new_status == 'pending_certification' and request.user.role == 'line_attendant':
            incident.completed_at = timezone.now()
        if new_status == 'revision_required':
            incident.revision_reason = request.data.get('revision_reason', '')
        incident.save()

        if old_status != 'pending_certification' and new_status == 'pending_certification' and incident.assigned_to == request.user:
            supervisors = User.objects.filter(role='line_supervisor')
            for supervisor in supervisors:
                _notify_user(
                    supervisor,
                    'Task Completion Pending Certification',
                    f'{request.user.get_full_name() or request.user.username} has completed {incident.get_category_display()} at {incident.location_text}. Pending your certification.',
                    notification_type='task_completed',
                    link_url='/dispatch',
                    related_incident=incident,
                )

        serializer = self.get_serializer(incident)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_tasks(self, request):
        tasks = Incident.objects.filter(
            assigned_to=request.user,
            status__in=['assigned', 'in_progress', 'pending_certification', 'revision_required', 'closed']
        ).order_by('-updated_at')
        serializer = self.get_serializer(tasks, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated], url_path='my-tasks', url_name='my-tasks')
    def my_tasks_hyphen(self, request):
        tasks = Incident.objects.filter(
            assigned_to=request.user,
            status__in=['assigned', 'in_progress', 'pending_certification', 'revision_required', 'closed']
        ).order_by('-updated_at')
        serializer = self.get_serializer(tasks, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def certify(self, request, pk=None):
        try:
            incident = self.get_object()
        except Incident.DoesNotExist:
            return Response({'error': 'Incident not found.'}, status=status.HTTP_404_NOT_FOUND)

        if getattr(request.user, 'role', '') != 'line_supervisor':
            return Response({'error': 'Only a line supervisor can certify incidents.'}, status=status.HTTP_403_FORBIDDEN)

        if incident.status != 'pending_certification':
            return Response({'error': f'This incident is not in pending certification status. Current status: {incident.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        incident.status = 'closed'
        incident.certified_by = request.user
        incident.certified_at = timezone.now()
        if 'certification_notes' in request.data:
            incident.assignment_instructions = request.data.get('certification_notes', '')
        incident.save(update_fields=['status', 'certified_by', 'certified_at', 'updated_at'])

        _notify_user(
            incident.assigned_to,
            'Incident Certified',
            f'Your repair on {incident.incident_number} — {incident.get_category_display()} at {incident.location_text} has been certified by {request.user.full_name}.',
            notification_type='task_completed',
            link_url='/my-tasks',
            related_incident=incident,
        )

        serializer = self.get_serializer(incident)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsLineSupervisorOrAbove])
    def send_back(self, request, pk=None):
        incident = self.get_object()
        reason = (request.data.get('reason') or '').strip()
        if not reason:
            return Response({'error': 'Reason for returning is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if incident.status != 'pending_certification':
            return Response({'error': f'Incident must be pending_certification to send back. Current status: {incident.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        incident.status = 'revision_required'
        incident.revision_reason = reason
        incident.save(update_fields=['status', 'revision_reason', 'updated_at'])

        _notify_user(
            incident.assigned_to,
            'Revision Required',
            f'{request.user.full_name} returned {incident.incident_number} for revision: {reason}. Tap to view in My Tasks.',
            notification_type='task_assigned',
            link_url='/my-tasks',
            related_incident=incident,
        )
        return Response(self.get_serializer(incident).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def submit_attempt(self, request, pk=None):
        incident = self.get_object()
        if incident.assigned_to_id != request.user.id:
            return Response({'error': 'Only assigned attendant can submit attempt.'}, status=status.HTTP_403_FORBIDDEN)

        work_performed = (request.data.get('work_performed') or '').strip()
        if not work_performed:
            return Response({'error': 'work_performed is required.'}, status=status.HTTP_400_BAD_REQUEST)

        last_attempt = incident.repair_attempts.order_by('-attempt_number').first()
        next_attempt_number = (last_attempt.attempt_number + 1) if last_attempt else 1
        attempt = RepairAttempt.objects.create(
            incident=incident,
            attempt_number=next_attempt_number,
            work_performed=work_performed,
            materials_used=request.data.get('materials_used', ''),
            attendant=request.user,
        )

        incident.status = 'pending_certification'
        incident.completed_at = timezone.now()
        incident.save(update_fields=['status', 'completed_at', 'updated_at'])

        supervisors = User.objects.filter(role='line_supervisor')
        for supervisor in supervisors:
            _notify_user(
                supervisor,
                'Task Completion Pending Certification',
                f'{request.user.full_name} has completed {incident.get_category_display()} at {incident.location_text}. Pending your certification.',
                notification_type='task_completed',
                link_url='/dispatch',
                related_incident=incident,
            )

        serializer = RepairAttemptSerializer(attempt, context={'request': request})
        return Response({'attempt': serializer.data, 'incident': self.get_serializer(incident).data}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def search(self, request):
        """
        Search for related incidents by location query (Section 4.7).
        Query parameter: location (string to search in location_text, reported_by_name, description)
        Returns: List of incidents matching the search, ordered by reported_at descending.
        """
        location_query = request.query_params.get('location', '').strip()
        if not location_query or len(location_query) < 2:
            return Response({'results': []}, status=status.HTTP_200_OK)
        
        # Search incidents by location, reporter name, or description
        incidents = Incident.objects.filter(
            Q(location_text__icontains=location_query) |
            Q(reported_by_name__icontains=location_query) |
            Q(description__icontains=location_query),
            status__in=['assigned', 'in_progress', 'pending_certification', 'resolved', 'closed']
        ).order_by('-reported_at')[:20]  # Limit to 20 results
        
        results = [
            {
                'id': incident.id,
                'reference_number': incident.incident_number,
                'category': incident.get_category_display(),
                'date': incident.reported_at.date().isoformat() if incident.reported_at else None,
                'location': incident.location_text,
            }
            for incident in incidents
        ]
        return Response({'results': results}, status=status.HTTP_200_OK)


class RepairViewSet(LockEnforcementMixin, ExecutiveReadOnlyMixin, viewsets.ModelViewSet):
    queryset = RepairAttempt.objects.all().order_by('-submitted_at')
    serializer_class = RepairAttemptSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def perform_create(self, serializer):
        incident = serializer.validated_data['incident']
        last_attempt = incident.repair_attempts.order_by('-attempt_number').first()
        attempt_number = (last_attempt.attempt_number + 1) if last_attempt else 1
        serializer.save(attendant=self.request.user, attempt_number=attempt_number)

class InspectionViewSet(ExecutiveReadOnlyMixin, viewsets.ModelViewSet):
    queryset = Inspection.objects.all().order_by('-start_date')
    serializer_class = InspectionSerializer
    permission_classes = [IsAuthenticated]

class TreatmentLogViewSet(MonthLockEnforcementMixin, ExecutiveReadOnlyMixin, viewsets.ModelViewSet):
    queryset = TreatmentLog.objects.all().order_by('-report_date')
    serializer_class = TreatmentLogSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(operator=self.request.user, review_status='pending_review')

    def create(self, request, *args, **kwargs):
        if getattr(request.user, 'role', '') != 'stp_operator':
            return Response({'error': 'Only STP Operator can submit treatment logs.'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if getattr(request.user, 'role', '') != 'stp_operator':
            return Response({'error': 'Only STP Operator can edit treatment logs.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if getattr(request.user, 'role', '') != 'stp_operator':
            return Response({'error': 'Only STP Operator can edit treatment logs.'}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsSTPSupervisorOrAbove])
    def request_correction(self, request, pk=None):
        log = self.get_object()
        note = (request.data.get('correction_note') or '').strip()
        if not note:
            return Response({'error': 'correction_note is required.'}, status=status.HTTP_400_BAD_REQUEST)
        log.review_status = 'correction_requested'
        log.correction_note = note
        log.reviewed_by = request.user
        log.reviewed_at = timezone.now()
        log.save(update_fields=['review_status', 'correction_note', 'reviewed_by', 'reviewed_at'])
        _notify_roles(
            ['stp_operator'],
            'Treatment Log Correction Requested',
            f'Supervisor requested correction for treatment log {log.report_date}: {note}',
            notification_type='approval',
            link_url='/treatment',
        )
        return Response(self.get_serializer(log).data)

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsSTPSupervisorOrAbove])
    def approve_review(self, request, pk=None):
        log = self.get_object()
        comment = (request.data.get('supervisor_comment') or '').strip()
        log.review_status = 'supervisor_approved'
        log.supervisor_comment = comment
        log.reviewed_by = request.user
        log.reviewed_at = timezone.now()
        log.save(update_fields=['review_status', 'supervisor_comment', 'reviewed_by', 'reviewed_at'])
        return Response(self.get_serializer(log).data)

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsSTPSupervisorOrAbove])
    def add_comment(self, request, pk=None):
        log = self.get_object()
        comment = (request.data.get('supervisor_comment') or '').strip()
        if not comment:
            return Response({'error': 'supervisor_comment is required.'}, status=status.HTTP_400_BAD_REQUEST)
        log.supervisor_comment = comment
        log.save(update_fields=['supervisor_comment'])
        return Response(self.get_serializer(log).data)

class ExhausterViewSet(ExecutiveReadOnlyMixin, viewsets.ModelViewSet):
    queryset = Exhauster.objects.all().order_by('reg_no')
    serializer_class = ExhausterSerializer
    permission_classes = [IsAuthenticated]

class ExhausterLicenseViewSet(ExecutiveReadOnlyMixin, viewsets.ModelViewSet):
    queryset = ExhausterLicense.objects.all().order_by('-end_date')
    serializer_class = ExhausterLicenseSerializer
    permission_classes = [IsAuthenticated]


LicenseViewSet = ExhausterLicenseViewSet


class SludgeCollectionViewSet(MonthLockEnforcementMixin, ExecutiveReadOnlyMixin, viewsets.ModelViewSet):
    queryset = SludgeCollection.objects.all().order_by('-collection_date')
    serializer_class = SludgeCollectionSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        manifest = serializer.save(entered_by=self.request.user)
        if manifest.manifest_status == 'pending':
            _notify_roles(
                ['stp_operator'],
                'Sludge Manifest Awaiting Approval',
                f'New sludge delivery from {manifest.source_name or "unknown source"} awaits operator approval.',
                notification_type='approval',
                link_url='/sludge',
            )

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsSTPOperatorOrAbove])
    def receive(self, request, pk=None):
        manifest = self.get_object()
        if manifest.manifest_status != 'pending':
            return Response(
                {'error': 'Only pending manifests can be received.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if getattr(request.user, 'role', '') != 'stp_operator':
            return Response({'error': 'Only STP Operator can approve sludge manifests.'}, status=status.HTTP_403_FORBIDDEN)
        manifest.manifest_status = 'approved'
        manifest.received_by = request.user
        manifest.received_at = timezone.now()
        manifest.save()
        _notify_roles(
            ['stp_supervisor'],
            'Sludge Manifest Approved',
            f'Manifest #{manifest.id} approved by operator.',
            notification_type='approval',
            link_url='/sludge',
        )
        serializer = self.get_serializer(manifest)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsSTPOperator])
    def reject(self, request, pk=None):
        manifest = self.get_object()
        if manifest.manifest_status != 'pending':
            return Response(
                {'error': 'Only pending manifests can be rejected.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        rejection_reason = request.data.get('rejection_reason', '').strip()
        if not rejection_reason:
            return Response(
                {'rejection_reason': 'Rejection reason is required and cannot be blank.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        manifest.manifest_status = 'rejected'
        manifest.rejection_reason = rejection_reason
        manifest.rejected_by = request.user
        manifest.rejected_at = timezone.now()
        manifest.save()
        _notify_roles(
            ['stp_supervisor'],
            'Sludge Manifest Rejected',
            f'Manifest #{manifest.id} rejected by operator. Reason: {rejection_reason}',
            notification_type='approval',
            link_url='/sludge',
        )
        serializer = self.get_serializer(manifest)
        return Response(serializer.data)

class ConnectionReportViewSet(ExecutiveReadOnlyMixin, viewsets.ModelViewSet):
    queryset = ConnectionReport.objects.all().order_by('-start_date')
    serializer_class = ConnectionReportSerializer
    permission_classes = [IsAuthenticated]


# --- NEW OPERATIONAL VIEWSETS ---

class SewerLineSectionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only endpoint for sewer line section autocomplete in the F201 patrol form.
    """
    queryset = SewerLineSection.objects.all().order_by('code')
    serializer_class = SewerLineSectionSerializer
    permission_classes = [IsAuthenticated]


class PatrolRowViewSet(ExecutiveReadOnlyMixin, viewsets.ModelViewSet):
    """
    Endpoint for individual F201 patrol row entries with escalation support.
    """
    queryset = PatrolRow.objects.all().order_by('weekly_patrol__date', 'time')
    serializer_class = PatrolRowSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        # For single-company deployments, bypass company filtering
        # TODO: Re-enable multi-company isolation when needed
        return qs

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsLineSupervisorOrAbove])
    def escalate(self, request, pk=None):
        row = self.get_object()

        if row.incident_created_id:
            return Response(
                {'error': 'Incident already created for this patrol row.'},
                status=status.HTTP_409_CONFLICT
            )

        open_incident = Incident.objects.filter(
            patrol_rows__sewer_line_section=row.sewer_line_section,
        ).exclude(status__in=['resolved', 'closed']).first()

        if open_incident:
            return Response(
                {'error': f'An open incident already exists for section {row.sewer_line_section.code}.'},
                status=status.HTTP_409_CONFLICT
            )

        abnormality = row.abnormality_details or row.get_abnormality_observed_display()
        reported_by_name = getattr(request.user, 'full_name', None) or request.user.username

        incident = Incident.objects.create(
            reported_at=timezone.now(),
            reported_by_name=reported_by_name,
            description=abnormality,
            category='other',
            severity='medium',
            location_text=f'{row.sewer_line_section.code} — {row.sewer_line_ref_text}',
            source_module='patrol',
            source_reference_id=row.id,
            created_by=request.user,
        )

        row.incident_created = incident
        row.save(update_fields=['incident_created'])

        serializer = self.get_serializer(row)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class WeeklyLinePatrolViewSet(ExecutiveReadOnlyMixin, viewsets.ModelViewSet):
    """
    [cite_start]Endpoint for F201 Sewer Lines Weekly Tasks Record Sheet. [cite: 205]
    """
    queryset = WeeklyLinePatrol.objects.all().order_by('-date')
    serializer_class = WeeklyLinePatrolSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        # For single-company deployments, bypass company filtering
        # TODO: Re-enable multi-company isolation when needed
        return qs.order_by('-date')

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsLineSupervisorOrAbove])
    def verify(self, request, pk=None):
        patrol = self.get_object()

        if patrol.status == 'verified':
            return Response({'error': 'Record already verified and locked.'}, status=status.HTTP_400_BAD_REQUEST)

        patrol.status = 'verified'
        patrol.verified_by = request.user
        patrol.verified_at = timezone.now()
        patrol.save()

        serializer = self.get_serializer(patrol)
        return Response(serializer.data)

class InletWorksDailyTaskViewSet(MonthLockEnforcementMixin, LockEnforcementMixin, ExecutiveReadOnlyMixin, viewsets.ModelViewSet):
    """
    [cite_start]Endpoint for F203A Inlet Works Screens & Grit Removal. [cite: 218]
    """
    queryset = InletWorksDailyTask.objects.all().order_by('-date')
    serializer_class = InletWorksDailyTaskSerializer
    permission_classes = [IsAuthenticated]
    locked_values = {'fully_signed'}
    lock_error_message = 'F203A log already fully signed and locked.'

    def perform_create(self, serializer):
        submit_for_signoff = str(self.request.data.get('submit_for_signoff', '')).lower() in {'1', 'true', 'yes', 'on'}
        status_value = 'pending_operator' if submit_for_signoff else 'draft'
        record = serializer.save(attendant=self.request.user, submitted_by=self.request.user, status=status_value)
        if status_value == 'pending_operator':
            _notify_roles(
                ['stp_operator'],
                'F203A Pending Co-sign',
                f'F203A entry for {record.date} is awaiting your signature.',
                notification_type='approval',
                link_url='/f203a',
            )

    def perform_update(self, serializer):
        submit_for_signoff = str(self.request.data.get('submit_for_signoff', '')).lower() in {'1', 'true', 'yes', 'on'}
        instance = serializer.instance
        previous_status = instance.status
        status_value = 'pending_operator' if submit_for_signoff else ('returned' if previous_status == 'returned' else 'draft')
        record = serializer.save(status=status_value)
        if status_value == 'pending_operator' and previous_status != 'pending_operator':
            _notify_roles(
                ['stp_operator'],
                'F203A Pending Co-sign',
                f'F203A entry for {record.date} is awaiting your signature.',
                notification_type='approval',
                link_url='/f203a',
            )

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsSTPOperator])
    def sign(self, request, pk=None):
        task = self.get_object()
        if task.status not in ['pending_operator', 'returned']:
            return Response({'error': f'Cannot sign task with status {task.status}.'}, status=status.HTTP_400_BAD_REQUEST)
        task.status = 'fully_signed'
        task.verified_by = request.user
        task.verified_at = timezone.now()
        task.correction_note = ''
        task.save()
        _notify_roles(
            ['stp_attendant'],
            'F203A Fully Signed',
            f'F203A entry for {task.date} was signed by operator.',
            notification_type='approval',
            link_url='/f203a',
        )

        serializer = self.get_serializer(task)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsSTPOperator])
    def request_correction(self, request, pk=None):
        task = self.get_object()
        if task.status not in ['pending_operator', 'fully_signed']:
            return Response({'error': f'Cannot return task with status {task.status}.'}, status=status.HTTP_400_BAD_REQUEST)
        note = request.data.get('correction_note', '').strip()
        if not note:
            return Response({'error': 'correction_note is required.'}, status=status.HTTP_400_BAD_REQUEST)
        task.status = 'returned'
        task.correction_note = note
        task.save(update_fields=['status', 'correction_note'])
        _notify_roles(
            ['stp_attendant'],
            'F203A Correction Requested',
            f'Operator requested correction for F203A {task.date}: {note}',
            notification_type='approval',
            link_url='/f203a',
        )
        serializer = self.get_serializer(task)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsSTPSupervisorOrAbove])
    def escalate(self, request, pk=None):
        task = self.get_object()

        if task.incident_created_id:
            return Response({'error': 'Incident already created for this task.'}, status=status.HTTP_409_CONFLICT)

        description = task.abnormalities or task.shift_notes or 'F203A escalation.'
        reported_by_name = getattr(request.user, 'full_name', None) or request.user.username

        incident = Incident.objects.create(
            reported_at=timezone.now(),
            reported_by_name=reported_by_name,
            description=description,
            category='other',
            severity='medium',
            location_text='Inlet works',
            source_module='f203a',
            source_reference_id=task.id,
        )

        task.incident_created = incident
        task.save(update_fields=['incident_created'])

        serializer = self.get_serializer(task)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DailyLabRecordViewSet(MonthLockEnforcementMixin, LockEnforcementMixin, ExecutiveReadOnlyMixin, viewsets.ModelViewSet):
    """
    F203B: Daily Lab Record with partial-entry support (PATCH preserves nulls)
    and supervisor verification workflow.
    """
    serializer_class = DailyLabRecordSerializer
    permission_classes = [IsAuthenticated]
    locked_values = {'fully_signed'}
    lock_error_message = 'Lab record already verified and locked.'

    def get_queryset(self):
        # For single-company deployments, bypass company filtering
        # TODO: Re-enable multi-company isolation when needed
        qs = DailyLabRecord.objects.all()
        year = self.request.query_params.get('year')
        month = self.request.query_params.get('month')
        if year:
            qs = qs.filter(record_date__year=year)
        if month:
            qs = qs.filter(record_date__month=month)
        return qs.order_by('record_date')

    def perform_create(self, serializer):
        if getattr(self.request.user, 'role', '') != 'lab_tech':
            raise PermissionDenied('Only lab_tech can create lab records.')
        record = serializer.save(attendant=self.request.user)
        self._sync_flags(record)

    def perform_update(self, serializer):
        if getattr(self.request.user, 'role', '') != 'lab_tech':
            raise PermissionDenied('Only lab_tech can update lab records.')
        record = serializer.save()
        self._sync_flags(record)

    def _sync_flags(self, record):
        record.compliance_flags.filter(status='open').delete()
        created = []

        red_threshold = float(settings.BOD_REMOVAL_RED_THRESHOLD)
        amber_threshold = float(settings.BOD_REMOVAL_AMBER_THRESHOLD)

        if record.bod_removal_efficiency is not None:
            if float(record.bod_removal_efficiency) < red_threshold:
                created.append(LabComplianceFlag.objects.create(
                    lab_record=record,
                    parameter_key='bod_removal_efficiency',
                    measured_value=record.bod_removal_efficiency,
                    threshold_value=red_threshold,
                    threshold_mode='min',
                    severity='red',
                ))
            elif float(record.bod_removal_efficiency) < amber_threshold:
                created.append(LabComplianceFlag.objects.create(
                    lab_record=record,
                    parameter_key='bod_removal_efficiency',
                    measured_value=record.bod_removal_efficiency,
                    threshold_value=amber_threshold,
                    threshold_mode='min',
                    severity='amber',
                ))

        for parameter_key, measured_value, threshold_value, threshold_mode in record.effluent_limit_breaches():
            created.append(LabComplianceFlag.objects.create(
                lab_record=record,
                parameter_key=parameter_key,
                measured_value=measured_value,
                threshold_value=threshold_value,
                threshold_mode=threshold_mode,
                severity='red',
            ))

        for flag in created:
            if flag.severity == 'red':
                _notify_roles(
                    ['stp_operator', 'stp_supervisor'],
                    'Red Lab Compliance Flag',
                    f'{flag.parameter_key} breached on {record.record_date}.',
                    notification_type='incident_critical',
                    link_url='/alerts',
                )
            else:
                _notify_roles(
                    ['stp_operator'],
                    'Amber Lab Efficiency Flag',
                    f'{flag.parameter_key} is in amber range on {record.record_date}.',
                    notification_type='approval',
                    link_url='/alerts',
                )

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated])
    def verify(self, request, pk=None):
        record = self.get_object()
        if getattr(request.user, 'role', '') != 'lab_tech':
            return Response({'error': 'Only lab_tech can verify lab records.'}, status=status.HTTP_403_FORBIDDEN)
        if record.status == 'fully_signed':
            return Response({'error': 'Record already verified and locked.'}, status=status.HTTP_400_BAD_REQUEST)
        record.status = 'fully_signed'
        record.verified_by = request.user
        record.verified_at = timezone.now()
        record.save()
        return Response(self.get_serializer(record).data)

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsSTPSupervisorOrAbove])
    def request_retest(self, request, pk=None):
        record = self.get_object()
        note = (request.data.get('retest_note') or '').strip()
        if not note:
            return Response({'error': 'retest_note is required.'}, status=status.HTTP_400_BAD_REQUEST)
        record.retest_requested = True
        record.retest_note = note
        record.save(update_fields=['retest_requested', 'retest_note'])
        _notify_roles(
            ['lab_tech'],
            'Lab Retest Requested',
            f'Supervisor requested retest for {record.record_date}: {note}',
            notification_type='approval',
            link_url='/lab-records',
        )
        return Response(self.get_serializer(record).data)


class DailyFlowRecordViewSet(MonthLockEnforcementMixin, ExecutiveReadOnlyMixin, viewsets.ModelViewSet):
    """
    [cite_start]Endpoint for F203C Inlet Works Flow Measurement Task Record. [cite: 190]
    """
    queryset = DailyFlowRecord.objects.all().order_by('-date')
    serializer_class = DailyFlowRecordSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        if getattr(request.user, 'role', '') != 'stp_attendant':
            return Response({'error': 'Only STP Attendant can submit flow records.'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        role = getattr(request.user, 'role', '')
        if role == 'stp_attendant':
            return super().update(request, *args, **kwargs)
        return Response({'error': 'Only STP Attendant can edit flow readings directly.'}, status=status.HTTP_403_FORBIDDEN)

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsSTPOperatorOrAbove])
    def add_operator_note(self, request, pk=None):
        record = self.get_object()
        note = request.data.get('operator_note', '').strip()
        if not note:
            return Response({'error': 'operator_note is required.'}, status=status.HTTP_400_BAD_REQUEST)
        record.operator_note = note
        record.save(update_fields=['operator_note'])
        return Response(self.get_serializer(record).data)

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsSTPSupervisorOrAbove])
    def add_supervisor_note(self, request, pk=None):
        record = self.get_object()
        note = request.data.get('supervisor_note', '').strip()
        if not note:
            return Response({'error': 'supervisor_note is required.'}, status=status.HTTP_400_BAD_REQUEST)
        record.supervisor_note = note
        record.save(update_fields=['supervisor_note'])
        return Response(self.get_serializer(record).data)


# --- USER VIEWSET ---

class UserViewSet(viewsets.ModelViewSet):
    """
    API endpoint for user data management.
    Used by the dispatch dashboard to list available field staff for assignment.
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # For single-company deployments, bypass company filtering
        # TODO: Re-enable multi-company isolation when needed
        qs = super().get_queryset()
        role = self.request.query_params.get('role')
        if role:
            qs = qs.filter(role=role)
        include_task_count = str(self.request.query_params.get('include_task_count', '')).lower() in {'1', 'true', 'yes', 'on'}
        if include_task_count:
            qs = qs.annotate(
                assigned_tasks_count=Count(
                    'assigned_incidents',
                    filter=Q(assigned_incidents__status__in=['assigned', 'in_progress'])
                )
            )
        return qs

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        response = super().retrieve(request, *args, **kwargs)

        thirty_days_ago = timezone.now() - datetime.timedelta(days=30)

        if instance.role == 'line_attendant':
            membership = TeamMembership.objects.filter(attendant=instance, assigned_to__isnull=True).select_related('supervisor').first()
            response.data['supervisor_name'] = membership.supervisor.full_name if membership and membership.supervisor else None
            response.data['supervisor_phone_number'] = membership.supervisor.phone_number if membership and membership.supervisor else None
            resolved_incidents = Incident.objects.filter(
                assigned_to=instance,
                assigned_at__isnull=False,
                completed_at__isnull=False,
                completed_at__gte=thirty_days_ago,
            )
            durations = [incident.resolution_time_minutes for incident in resolved_incidents if incident.resolution_time_minutes is not None]
            response.data['avg_resolution_minutes_30d'] = int(sum(durations) / len(durations)) if durations else None

        if instance.role == 'line_supervisor':
            memberships = TeamMembership.objects.filter(supervisor=instance, assigned_to__isnull=True).select_related('attendant', 'zone')
            per_attendant = []
            for membership in memberships:
                attendant = membership.attendant
                resolved_incidents = Incident.objects.filter(
                    assigned_to=attendant,
                    assigned_at__isnull=False,
                    completed_at__isnull=False,
                    completed_at__gte=thirty_days_ago,
                )
                durations = [incident.resolution_time_minutes for incident in resolved_incidents if incident.resolution_time_minutes is not None]
                active_count = Incident.objects.filter(assigned_to=attendant, status__in=['assigned', 'in_progress', 'revision_required']).count()
                per_attendant.append({
                    'attendant_id': attendant.id,
                    'attendant_name': attendant.get_full_name() or attendant.username,
                    'assigned_zones': [z.name for z in attendant.assigned_zones.all()],
                    'membership_zone': membership.zone.name if membership.zone else None,
                    'active_task_count': active_count,
                    'avg_resolution_minutes_30d': int(sum(durations) / len(durations)) if durations else None,
                })
            response.data['team_avg_resolution_minutes_30d'] = per_attendant

        return response

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def fcm_token(self, request):
        token = (request.data.get('token') or '').strip()
        if not token:
            return Response({'error': 'token is required.'}, status=status.HTTP_400_BAD_REQUEST)
        request.user.fcm_token = token
        request.user.save(update_fields=['fcm_token'])
        return Response({'message': 'FCM token saved.'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def change_password(self, request):
        """
        Change password endpoint for authenticated users.
        Expects: old_password, new_password
        """
        user = request.user
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')

        if not old_password or not new_password:
            return Response({'error': 'Both old_password and new_password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if not user.check_password(old_password):
            return Response({'error': 'Old password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        return Response({'message': 'Password changed successfully.'}, status=status.HTTP_200_OK)


# --- ATTACHMENT VIEWSET ---

class AttachmentViewSet(ExecutiveReadOnlyMixin, viewsets.ModelViewSet):
    """
    API endpoint for uploading and managing attachments (photos, documents, etc.)
    for incidents, repairs, and other entities.
    """
    queryset = Attachment.objects.all()
    serializer_class = AttachmentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


# --- ANAEROBIC POND VIEWSETS ---

class TreatmentPondViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only lookup of pond codes — used in the daily log form dropdown.
    """
    queryset = TreatmentPond.objects.filter(is_active=True).order_by('code')
    serializer_class = TreatmentPondSerializer
    permission_classes = [IsAuthenticated]


class PondDailyLogViewSet(MonthLockEnforcementMixin, LockEnforcementMixin, ExecutiveReadOnlyMixin, viewsets.ModelViewSet):
    """
    Daily pond observation log with 3-level sign-off:
      submitted → cosigned_op → verified
    """
    serializer_class = PondDailyLogSerializer
    permission_classes = [IsAuthenticated]
    locked_values = {'fully_signed'}
    lock_error_message = 'Pond log already verified and locked.'

    def get_queryset(self):
        qs = PondDailyLog.objects.select_related('pond', 'submitted_by', 'cosigned_by', 'verified_by').all()
        # For single-company deployments, bypass company filtering
        # TODO: Re-enable multi-company isolation when needed
        year  = self.request.query_params.get('year')
        month = self.request.query_params.get('month')
        pond  = self.request.query_params.get('pond')
        if year:  qs = qs.filter(log_date__year=year)
        if month: qs = qs.filter(log_date__month=month)
        if pond:  qs = qs.filter(pond__code=pond)
        return qs.order_by('log_date', 'pond__code')

    def perform_create(self, serializer):
        log = serializer.save(submitted_by=self.request.user, status='pending_second_sign')
        _notify_roles(
            ['stp_operator', 'lab_tech'],
            'Pond Entry Pending Second Sign',
            f'Pond entry {log.pond.code} for {log.log_date} awaits STW-OP/LT signature.',
            notification_type='approval',
            link_url='/ponds',
        )

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsSTPOperatorOrLabTech])
    def cosign(self, request, pk=None):
        log = self.get_object()
        if log.status != 'pending_second_sign':
            return Response(
                {'error': f'Cannot cosign a log with status "{log.status}".'},
                status=status.HTTP_400_BAD_REQUEST
            )
        log.status = 'pending_supervisor'
        log.cosigned_by = request.user
        log.cosigned_at = timezone.now()
        log.save()
        Notification.objects.filter(
            title='Pond Entry Pending Second Sign',
            message__contains=str(log.log_date),
            is_read=False,
        ).exclude(recipient__role='stp_supervisor').update(is_read=True, read_at=timezone.now())
        _notify_roles(
            ['stp_supervisor'],
            'Pond Entry Pending Supervisor Sign',
            f'Pond entry {log.pond.code} for {log.log_date} is awaiting STW-SP signature.',
            notification_type='approval',
            link_url='/ponds',
        )
        return Response(self.get_serializer(log).data)

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsSTPSupervisorOrAbove])
    def verify(self, request, pk=None):
        log = self.get_object()
        if log.status == 'fully_signed':
            return Response({'error': 'Log already verified.'}, status=status.HTTP_400_BAD_REQUEST)
        if log.status != 'pending_supervisor':
            return Response(
                {'error': 'Log must be co-signed by an operator before supervisor verification.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        log.status = 'fully_signed'
        log.verified_by = request.user
        log.verified_at = timezone.now()
        log.save()
        return Response(self.get_serializer(log).data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsSTPSupervisorOrAbove])
    def escalate(self, request, pk=None):
        log = self.get_object()
        if log.incident_created_id:
            return Response(
                {'error': 'Incident already created for this pond log.'},
                status=status.HTTP_409_CONFLICT
            )
        reported_by_name = getattr(request.user, 'full_name', None) or request.user.username
        description = f"Pond {log.pond.code} alert: {request.data.get('description', log.remarks or 'Abnormal observation logged.')}"
        incident = Incident.objects.create(
            reported_at=timezone.now(),
            reported_by_name=reported_by_name,
            description=description,
            category='other',
            severity='medium',
            location_text=f'{log.pond.code} — {log.pond.name}',
            source_module='pond',
            source_reference_id=log.id,
            created_by=request.user,
        )
        log.incident_created = incident
        log.save(update_fields=['incident_created'])
        return Response(self.get_serializer(log).data, status=status.HTTP_201_CREATED)


class LabComplianceFlagViewSet(ExecutiveReadOnlyMixin, viewsets.ModelViewSet):
    serializer_class = LabComplianceFlagSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['lab_record', 'status', 'severity']

    def get_queryset(self):
        qs = LabComplianceFlag.objects.select_related('lab_record', 'corrected_by', 'acknowledged_by', 'escalated_by')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs.order_by('-created_at')

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsSTPOperator])
    def resolve(self, request, pk=None):
        flag = self.get_object()
        action_text = request.data.get('corrective_action', '').strip()
        notes = request.data.get('notes', '').strip()
        if not action_text:
            return Response({'error': 'corrective_action is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if notes:
            action_text = f'{action_text}\n\nNotes: {notes}'
        flag.corrective_action = action_text
        flag.corrected_by = request.user
        flag.corrective_action_at = timezone.now()
        flag.status = 'resolved'
        flag.save(update_fields=['corrective_action', 'corrected_by', 'corrective_action_at', 'status'])
        _notify_roles(
            ['lab_tech', 'stp_supervisor'],
            'Lab Flag Resolved',
            f'Flag {flag.parameter_key} resolved by operator.',
            notification_type='approval',
            link_url='/alerts',
        )
        return Response(self.get_serializer(flag).data)

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsSTPSupervisorOrAbove])
    def acknowledge(self, request, pk=None):
        flag = self.get_object()
        flag.status = 'acknowledged'
        flag.acknowledged_by = request.user
        flag.acknowledged_at = timezone.now()
        flag.save(update_fields=['status', 'acknowledged_by', 'acknowledged_at'])
        return Response(self.get_serializer(flag).data)

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsSTPSupervisorOrAbove])
    def escalate(self, request, pk=None):
        flag = self.get_object()
        flag.status = 'escalated'
        flag.escalated_by = request.user
        flag.escalated_at = timezone.now()
        flag.save(update_fields=['status', 'escalated_by', 'escalated_at'])
        _notify_roles(
            ['stp_superintendent'],
            'Supervisor Escalation',
            f'Lab flag {flag.parameter_key} was escalated to superintendent.',
            notification_type='incident_critical',
            link_url='/summary',
        )
        return Response(self.get_serializer(flag).data)

class PondYearlyTaskViewSet(MonthLockEnforcementMixin, ExecutiveReadOnlyMixin, viewsets.ModelViewSet):
    serializer_class = PondYearlyTaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = PondYearlyTask.objects.select_related('pond', 'assigned_to').all()
        year = self.request.query_params.get('year')
        pond = self.request.query_params.get('pond')
        if year: qs = qs.filter(year=year)
        if pond: qs = qs.filter(pond__code=pond)
        return qs.order_by('due_date')


# --- SUMMARY VIEWSET ---

class SummaryViewSet(APIView):
    permission_classes = [IsAuthenticated]

    def _aggregate_month(self, year, month, user=None):
        """Live aggregation of all metrics for the given year/month."""
        month_name = calendar.month_name[month]

        # For single-company deployments, bypass company filtering
        # TODO: Re-enable multi-company isolation when needed

        incidents = Incident.objects.filter(reported_at__year=year, reported_at__month=month)

        patrol_rows = PatrolRow.objects.filter(weekly_patrol__date__year=year, weekly_patrol__date__month=month)

        new_main = patrol_rows.aggregate(Sum('new_main_connections'))['new_main_connections__sum'] or 0
        new_branch = patrol_rows.aggregate(Sum('new_branch_connections'))['new_branch_connections__sum'] or 0
        repairs_completed = RepairAttempt.objects.filter(submitted_at__year=year, submitted_at__month=month).count()
        repairs_certified = Incident.objects.filter(certified_at__year=year, certified_at__month=month).count()

        lab_qs = DailyLabRecord.objects.filter(record_date__year=year, record_date__month=month)

        bod_exceedance_days = sum(1 for r in lab_qs if r.is_bod_exceedance)
        tss_exceedance_days = sum(1 for r in lab_qs if r.is_tss_exceedance)
        bod_vals = [r.bod_removal_efficiency for r in lab_qs if r.bod_removal_efficiency is not None]
        tss_vals = [r.tss_removal_efficiency for r in lab_qs if r.tss_removal_efficiency is not None]
        avg_bod = round(sum(bod_vals) / len(bod_vals), 1) if bod_vals else None
        avg_tss = round(sum(tss_vals) / len(tss_vals), 1) if tss_vals else None

        compliance_heat_map = []
        for day in range(1, calendar.monthrange(year, month)[1] + 1):
            day_record = lab_qs.filter(record_date__day=day).first()
            if not day_record:
                compliance_heat_map.append({'day': day, 'status': 'grey'})
            else:
                band = day_record.bod_efficiency_band or 'grey'
                compliance_heat_map.append({'day': day, 'status': 'yellow' if band == 'amber' else band, 'record_id': day_record.id})

        collections = SludgeCollection.objects.filter(collection_date__year=year, collection_date__month=month)

        total_volume = collections.aggregate(Sum('volume_m3'))['volume_m3__sum'] or 0
        res_vol = collections.filter(source_type='residential').aggregate(Sum('volume_m3'))['volume_m3__sum'] or 0
        inst_vol = collections.filter(source_type='institutional').aggregate(Sum('volume_m3'))['volume_m3__sum'] or 0
        com_vol = collections.filter(source_type='commercial').aggregate(Sum('volume_m3'))['volume_m3__sum'] or 0

        return {
            "collection": {
                "total_incidents": incidents.count(),
                "resolved_incidents": incidents.filter(status__in=['resolved', 'closed']).count(),
                "repairs_completed": repairs_completed,
                "repairs_certified": repairs_certified,
                "new_connections": new_main + new_branch,
                "spillage_incidences": incidents.filter(category='spillage').count(),
            },
            "treatment": {
                "data_available": lab_qs.exists(),
                "avg_bod_removal": avg_bod,
                "avg_tss_removal": avg_tss,
                "days_with_alerts": bod_exceedance_days + tss_exceedance_days,
                "bod_incidences": bod_exceedance_days,
                "tss_incidences": tss_exceedance_days,
            },
            "sludge": {
                "total_volume_m3": float(total_volume),
                "breakdown": {
                    "residential": float(res_vol),
                    "institutional": float(inst_vol),
                    "commercial": float(com_vol),
                },
                "collections_count": collections.count(),
                "received_count": collections.filter(manifest_status='approved').count(),
                "rejected_count": collections.filter(manifest_status='rejected').count(),
                "pending_count": collections.filter(manifest_status='pending').count(),
                "active_exhausters": Exhauster.objects.filter(status='active').count(),
            },
            "period": {
                "year": year,
                "month": month,
                "month_name": month_name,
            },
            "compliance_heat_map": compliance_heat_map,
        }

    def _compliance_day_detail(self, record_id):
        """Read-only executive drill-down for a single lab day (heat map red-day click)."""
        try:
            record = DailyLabRecord.objects.get(pk=record_id)
        except DailyLabRecord.DoesNotExist:
            return Response({'error': 'Lab record not found.'}, status=status.HTTP_404_NOT_FOUND)

        flags = record.compliance_flags.all().order_by('-created_at')
        breaches = [
            {
                'parameter_key': key,
                'measured_value': measured,
                'threshold_value': threshold,
                'threshold_mode': mode,
            }
            for key, measured, threshold, mode in record.effluent_limit_breaches()
        ]

        return Response({
            'record_id': record.id,
            'record_date': record.record_date.isoformat(),
            'attendant_name': record.attendant.get_full_name() if record.attendant else None,
            'bod_removal_efficiency': record.bod_removal_efficiency,
            'tss_removal_efficiency': record.tss_removal_efficiency,
            'bod_efficiency_band': record.bod_efficiency_band,
            'tss_efficiency_band': record.tss_efficiency_band,
            'inflow_bod': record.inflow_bod,
            'effluent_bod': record.effluent_bod,
            'inflow_tss': record.inflow_tss,
            'effluent_tss': record.effluent_tss,
            'effluent_ph': record.effluent_ph,
            'effluent_do': record.effluent_do,
            'effluent_turbidity': record.effluent_turbidity,
            'effluent_fc': record.effluent_fc,
            'effluent_ecoli': record.effluent_ecoli,
            'effluent_total_coliforms': record.effluent_total_coliforms,
            'remarks': record.remarks,
            'effluent_breaches': breaches,
            'flags': LabComplianceFlagSerializer(flags, many=True).data,
        })

    def get(self, request):
        record_id = request.query_params.get('record_id')
        if record_id:
            return self._compliance_day_detail(int(record_id))

        year = request.query_params.get('year')
        month = request.query_params.get('month')

        if not year or not month:
            return Response(
                {"error": "Both 'year' and 'month' query parameters are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        year = int(year)
        month = int(month)

        # Check for a frozen snapshot first
        try:
            snap = MonthlySummarySnapshot.objects.get(year=year, month=month, is_locked=True)
            data = snap.snapshot_data.copy()
            data['is_locked'] = True
            data['locked_by'] = snap.locked_by.get_full_name() if snap.locked_by else None
            data['locked_at'] = snap.locked_at.isoformat() if snap.locked_at else None
            data['supervisor_draft_notes'] = snap.supervisor_draft_notes or ''
            export_format = request.query_params.get('export', 'json').lower()
            if export_format != 'csv':
                return Response(data)
        except MonthlySummarySnapshot.DoesNotExist:
            pass

        real_data = self._aggregate_month(year, month, request.user)
        real_data['is_locked'] = False
        try:
            snap = MonthlySummarySnapshot.objects.get(year=year, month=month)
            real_data['supervisor_draft_notes'] = snap.supervisor_draft_notes or ''
        except MonthlySummarySnapshot.DoesNotExist:
            real_data['supervisor_draft_notes'] = ''

        # Extract refs for CSV export
        treatment_data = real_data['treatment']
        total_volume = real_data['sludge']['total_volume_m3']
        res_vol = real_data['sludge']['breakdown']['residential']
        inst_vol = real_data['sludge']['breakdown']['institutional']
        com_vol = real_data['sludge']['breakdown']['commercial']
        total_incidents = real_data['collection']['total_incidents']
        resolved_incidents = real_data['collection']['resolved_incidents']
        repairs_completed = real_data['collection']['repairs_completed']
        export_format = request.query_params.get('export', 'json').lower()
        if export_format == 'csv':
            response = HttpResponse(
                content_type='text/csv',
                headers={'Content-Disposition': f'attachment; filename="KICOWASCO_Summary_{year}_{month:02d}.csv"'},
            )
            writer = csv.writer(response)

            writer.writerow(['KICOWASCO Monthly Summary Report'])
            writer.writerow(['Period', f'{year}-{month:02d}'])
            writer.writerow(['Generated On', datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
            writer.writerow([])

            writer.writerow(['--- COLLECTION SYSTEM ---'])
            writer.writerow(['Total Incidents Reported', total_incidents])
            writer.writerow(['Resolved/Closed Incidents', resolved_incidents])
            writer.writerow(['Repairs Completed', repairs_completed])
            writer.writerow(['New Connections (F201)', real_data['collection']['new_connections']])
            writer.writerow(['Spillage Incidences', real_data['collection']['spillage_incidences']])
            writer.writerow([])

            writer.writerow(['--- TREATMENT PLANT ---'])
            writer.writerow(['Data Available', 'Yes' if treatment_data.get('data_available') else 'No'])
            writer.writerow(['Avg BOD Removal (%)', treatment_data.get('avg_bod_removal')])
            writer.writerow(['Avg TSS Removal (%)', treatment_data.get('avg_tss_removal')])
            writer.writerow(['Compliance Alerts', treatment_data.get('days_with_alerts')])
            writer.writerow([])

            writer.writerow(['--- SLUDGE MANAGEMENT ---'])
            writer.writerow(['Total Volume (m3)', float(total_volume)])
            writer.writerow(['Residential (m3)', float(res_vol)])
            writer.writerow(['Institutional (m3)', float(inst_vol)])
            writer.writerow(['Commercial (m3)', float(com_vol)])
            writer.writerow(['Collections Count', real_data['sludge']['collections_count']])
            writer.writerow(['Active Exhausters', Exhauster.objects.filter(status='active').count()])

            return response

        return Response(real_data)

    def patch(self, request):
        """Supervisor compiles draft plant notes for a month (before superintendent lock)."""
        if getattr(request.user, 'role', '') != 'stp_supervisor':
            return Response({'error': 'Only STP Supervisor can save summary draft notes.'}, status=status.HTTP_403_FORBIDDEN)

        year = request.data.get('year') or request.query_params.get('year')
        month = request.data.get('month') or request.query_params.get('month')
        notes = request.data.get('supervisor_draft_notes', '')

        if not year or not month:
            return Response({'error': 'year and month are required.'}, status=status.HTTP_400_BAD_REQUEST)

        year, month = int(year), int(month)
        snap, _ = MonthlySummarySnapshot.objects.get_or_create(year=year, month=month)
        if snap.is_locked:
            return Response({'error': 'Month is locked; draft notes cannot be changed.'}, status=status.HTTP_403_FORBIDDEN)

        snap.supervisor_draft_notes = notes
        snap.save(update_fields=['supervisor_draft_notes', 'updated_at'])
        return Response({
            'message': 'Draft notes saved.',
            'supervisor_draft_notes': snap.supervisor_draft_notes,
        })

    def post(self, request):
        """Lock a month's summary into an immutable snapshot (supervisor workflow)."""
        if getattr(request.user, 'role', '') != 'stp_superintendent':
            return Response({'error': 'Only the STP Superintendent can lock a monthly summary.'}, status=status.HTTP_403_FORBIDDEN)

        year  = request.data.get('year')  or request.query_params.get('year')
        month = request.data.get('month') or request.query_params.get('month')

        if not year or not month:
            return Response({'error': 'year and month are required.'}, status=status.HTTP_400_BAD_REQUEST)

        year  = int(year)
        month = int(month)

        snap, _ = MonthlySummarySnapshot.objects.get_or_create(year=year, month=month)
        if snap.is_locked:
            return Response({'error': f'{calendar.month_name[month]} {year} is already locked.'}, status=status.HTTP_400_BAD_REQUEST)

        snapshot_data = self._aggregate_month(year, month, request.user)
        snap.is_locked    = True
        snap.locked_by    = request.user
        snap.locked_at    = timezone.now()
        snap.snapshot_data = snapshot_data
        snap.save()

        _notify_roles(
            ['stp_supervisor', 'lab_tech', 'stp_operator', 'stp_attendant'],
            'Month Locked by Superintendent',
            f'{calendar.month_name[month]} {year} has been locked and is now read-only.',
            notification_type='system',
            link_url='/summary',
        )

        return Response({
            'message': f'{calendar.month_name[month]} {year} summary locked successfully.',
            'locked_at': snap.locked_at.isoformat(),
            'locked_by': request.user.get_full_name(),
        }, status=status.HTTP_200_OK)


# --- ZONE VIEWSET (Section 3.1) ---

class ZoneViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Zone/drainage area model.
    Provides GET list (active zones) for form dropdowns.
    """
    queryset = Zone.objects.filter(is_active=True).order_by('name')
    serializer_class = ZoneSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']

    def _ensure_admin(self, request):
        if getattr(request.user, 'role', '') != 'admin':
            raise PermissionDenied('Only admin users can modify zones.')

    def create(self, request, *args, **kwargs):
        self._ensure_admin(request)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        self._ensure_admin(request)
        return super().partial_update(request, *args, **kwargs)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated], url_path='detect')
    def detect(self, request):
        try:
            lat = float(request.query_params.get('lat'))
            lon = float(request.query_params.get('lon'))
        except (TypeError, ValueError):
            return Response({'zone': None}, status=status.HTTP_200_OK)

        zone = Zone.objects.filter(
            is_active=True,
            min_lat__isnull=False,
            max_lat__isnull=False,
            min_lon__isnull=False,
            max_lon__isnull=False,
            min_lat__lte=lat,
            max_lat__gte=lat,
            min_lon__lte=lon,
            max_lon__gte=lon,
        ).first()
        if not zone:
            return Response({'zone': None}, status=status.HTTP_200_OK)
        return Response({'zone': ZoneSerializer(zone, context={'request': request}).data}, status=status.HTTP_200_OK)


class TeamMembershipViewSet(viewsets.ModelViewSet):
    queryset = TeamMembership.objects.select_related('supervisor', 'attendant', 'zone').all().order_by('-assigned_from')
    serializer_class = TeamMembershipSerializer
    permission_classes = [IsAuthenticated]

    def _ensure_admin(self, request):
        if getattr(request.user, 'role', '') != 'admin':
            raise PermissionDenied('Only admin users can manage team memberships.')

    def get_queryset(self):
        qs = super().get_queryset()
        active_only = str(self.request.query_params.get('active', '')).lower() in {'1', 'true', 'yes', 'on'}
        if active_only:
            qs = qs.filter(assigned_to__isnull=True)
        return qs

    def create(self, request, *args, **kwargs):
        self._ensure_admin(request)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        attendant = serializer.validated_data['attendant']
        active = TeamMembership.objects.filter(attendant=attendant, assigned_to__isnull=True).first()
        if active:
            active.assigned_to = timezone.now().date()
            active.save(update_fields=['assigned_to'])
        membership = serializer.save()
        return Response(self.get_serializer(membership).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        self._ensure_admin(request)
        instance = self.get_object()
        if request.data.get('assigned_to') == 'today':
            instance.assigned_to = timezone.now().date()
            instance.save(update_fields=['assigned_to'])
            return Response(self.get_serializer(instance).data, status=status.HTTP_200_OK)
        return super().partial_update(request, *args, **kwargs)


class FieldMonthlyReportViewSet(viewsets.ModelViewSet):
    queryset = FieldMonthlyReport.objects.select_related('supervisor', 'acknowledged_by').all().order_by('-year', '-month')
    serializer_class = FieldMonthlyReportSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated], url_path='compile')
    def compile(self, request):
        try:
            month = int(request.query_params.get('month'))
            year = int(request.query_params.get('year'))
        except (TypeError, ValueError):
            return Response({'error': 'month and year are required.'}, status=status.HTTP_400_BAD_REQUEST)

        incidents = Incident.objects.filter(reported_at__year=year, reported_at__month=month)
        closed = incidents.filter(status='closed')
        recurring = (
            incidents.filter(related_incident__isnull=False)
            .values('location_text')
            .annotate(count=Count('id'))
            .filter(count__gt=1)
            .order_by('-count')
        )

        patrol_summary = []
        for line in SewerLine.objects.filter(is_active=True).select_related('zone'):
            submitted = PatrolRow.objects.filter(
                sewer_line=line,
                weekly_patrol__date__year=year,
                weekly_patrol__date__month=month,
                weekly_patrol__status__in=['submitted', 'verified'],
            ).count()
            patrol_summary.append({
                'line_ref': line.reference_code,
                'zone': line.zone.name,
                'expected': line.patrol_frequency_per_month,
                'submitted': submitted,
            })

        durations = [i.resolution_time_minutes for i in closed if i.resolution_time_minutes is not None]

        return Response({
            'total_incidents': incidents.count(),
            'incidents_by_category': list(incidents.values('category').annotate(count=Count('id')).order_by('-count')),
            'incidents_by_zone': list(incidents.values('zone__name').annotate(count=Count('id')).order_by('-count')),
            'incidents_by_priority': list(incidents.values('severity').annotate(count=Count('id')).order_by('-count')),
            'resolved_incidents': closed.count(),
            'unresolved_incidents': incidents.exclude(status='closed').count(),
            'avg_resolution_minutes': int(sum(durations) / len(durations)) if durations else None,
            'certifications_completed': incidents.filter(certified_at__year=year, certified_at__month=month).count(),
            'patrol_compliance': patrol_summary,
            'recurring_locations': list(recurring),
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsSTPSuperintendent], url_path='acknowledge')
    def acknowledge(self, request, pk=None):
        report = self.get_object()
        report.status = 'acknowledged'
        report.acknowledged_by = request.user
        report.acknowledged_at = timezone.now()
        report.save(update_fields=['status', 'acknowledged_by', 'acknowledged_at'])
        return Response(self.get_serializer(report).data, status=status.HTTP_200_OK)


# --- SEWER LINE VIEWSET (Section 3.2) ---

class SewerLineViewSet(viewsets.ModelViewSet):
    """
    ViewSet for SewerLine asset registry.
    Provides GET list with zone filtering and search for patrol forms.
    """
    queryset = SewerLine.objects.filter(is_active=True).order_by('zone', 'reference_code')
    serializer_class = SewerLineSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['zone', 'is_active', 'pipe_material']
    search_fields = ['reference_code', 'description', 'start_point', 'end_point']
    ordering_fields = ['reference_code', 'zone', 'created_at']

    def _ensure_admin(self, request):
        if getattr(request.user, 'role', '') != 'admin':
            raise PermissionDenied('Only admin users can modify sewer lines.')

    def create(self, request, *args, **kwargs):
        self._ensure_admin(request)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        self._ensure_admin(request)
        return super().partial_update(request, *args, **kwargs)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated], url_path='patrol-compliance')
    def patrol_compliance(self, request):
        today = timezone.now().date()
        zone_id = request.query_params.get('zone')
        lines = self.get_queryset()
        if zone_id:
            lines = lines.filter(zone_id=zone_id)

        data = []
        for line in lines.select_related('zone'):
            submitted = PatrolRow.objects.filter(
                sewer_line=line,
                weekly_patrol__date__year=today.year,
                weekly_patrol__date__month=today.month,
                weekly_patrol__status__in=['submitted', 'verified'],
            ).count()
            expected = line.patrol_frequency_per_month
            if submitted >= expected:
                status_label = 'On Track'
                status_color = 'green'
            elif submitted > 0:
                status_label = 'Behind'
                status_color = 'amber'
            elif today.day > 7:
                status_label = 'Overdue'
                status_color = 'red'
            else:
                status_label = 'Behind'
                status_color = 'amber'
            data.append({
                'line_reference': line.reference_code,
                'zone': line.zone.name,
                'expected': expected,
                'submitted': submitted,
                'status': status_label,
                'status_color': status_color,
            })
        return Response(data, status=status.HTTP_200_OK)


# --- NOTIFICATION VIEWSET (Section 2) ---

class NotificationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for user notifications.
    Provides GET list, PATCH mark_as_read, and bulk mark_all_read action.
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['is_read', 'notification_type']
    search_fields = ['title', 'message']
    ordering_fields = ['created_at', 'is_read']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Return only notifications for the authenticated user."""
        return Notification.objects.filter(recipient=self.request.user)
    
    @action(detail=False, methods=['patch'], permission_classes=[IsAuthenticated])
    def mark_all_read(self, request):
        """Mark all unread notifications for the user as read."""
        notifications = self.get_queryset().filter(is_read=False)
        count = notifications.update(is_read=True, read_at=timezone.now())
        return Response({
            'message': f'{count} notifications marked as read.',
            'count': count
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated])
    def mark_as_read(self, request, pk=None):
        """Mark a specific notification as read."""
        notification = self.get_object()
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = timezone.now()
            notification.save()
        return Response({
            'message': 'Notification marked as read.',
            'is_read': notification.is_read,
            'read_at': notification.read_at.isoformat() if notification.read_at else None
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def quick_flag(self, request):
        form_name = request.data.get('form', 'Other')
        description = (request.data.get('description') or '').strip()
        if not description:
            return Response({'error': 'description is required.'}, status=status.HTTP_400_BAD_REQUEST)
        author = getattr(request.user, 'full_name', None) or request.user.username
        _notify_roles(
            ['stp_supervisor'],
            f'Abnormality Flagged: {form_name}',
            f'{author} flagged an abnormality on {form_name}: {description}',
            notification_type='incident_critical',
            link_url='/portal/supervisor',
        )
        return Response({'message': 'Abnormality flagged successfully.'}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, IsSTPSupervisorOrAbove])
    def escalate_superintendent(self, request):
        note = (request.data.get('note') or '').strip()
        if not note:
            return Response({'error': 'note is required.'}, status=status.HTTP_400_BAD_REQUEST)
        author = getattr(request.user, 'full_name', None) or request.user.username
        _notify_roles(
            ['stp_superintendent'],
            'Supervisor Escalation',
            f'{author} escalated an issue: {note}',
            notification_type='incident_critical',
            link_url='/summary',
        )
        return Response({'message': 'Escalation sent to superintendent.'}, status=status.HTTP_201_CREATED)