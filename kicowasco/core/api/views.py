from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.models import Sum, Avg, Count, Q
from django.http import HttpResponse
import calendar
import csv
import datetime

from core.models import (
    Incident, Repair, Inspection, TreatmentLog, Exhauster,
    ExhausterLicense, SludgeCollection, ConnectionReport, Attachment,
    SewerLineSection, PatrolRow, WeeklyLinePatrol,
    InletWorksDailyTask, DailyFlowRecord, TreatmentParameter, DailyLabRecord,
    MonthlySummarySnapshot, TreatmentPond, PondDailyLog, PondYearlyTask,
)
from core.permissions import IsLineSupervisorOrAbove, IsSTPOperatorOrAbove, IsSTPSupervisorOrAbove, IsSTPSuperintendent
from core.api.mixins import LockEnforcementMixin
from .serializers import (
    IncidentSerializer, RepairSerializer, InspectionSerializer,
    TreatmentLogSerializer, ExhausterSerializer, ExhausterLicenseSerializer,
    SludgeCollectionSerializer, ConnectionReportSerializer,
    CustomTokenObtainPairSerializer,
    SewerLineSectionSerializer, PatrolRowSerializer, WeeklyLinePatrolSerializer,
    InletWorksDailyTaskSerializer, DailyFlowRecordSerializer,
    DailyLabRecordSerializer, AttachmentSerializer, UserSerializer,
    TreatmentPondSerializer, PondDailyLogSerializer, PondYearlyTaskSerializer,
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

class IncidentViewSet(viewsets.ModelViewSet):
    queryset = Incident.objects.all().order_by('-reported_at')
    serializer_class = IncidentSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

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
            
            # UPGRADED: Advance state machine AND automate the SLA timer
            incident.assigned_to = technician
            incident.assisting_crew = assisting_crew
            incident.status = 'assigned'
            incident.assigned_at = timezone.now()  # <-- AUTOMATED TIMESTAMP
            incident.save()
            
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
                
            elif new_status in ['resolved', 'closed']:
                return Response({
                    'error': 'Line attendants cannot directly resolve incidents. You must submit for certification.'
                }, status=status.HTTP_403_FORBIDDEN)
            # Handle exception states for plumbers (e.g., waiting for parts)
            elif new_status not in ['on_hold_materials', 'on_hold_equipment', 'pending_certification']:
                return Response({'error': 'Invalid status transition for your role.'}, status=status.HTTP_403_FORBIDDEN)

        # --- RULE 2: Grade 4 Supervisors override authority ---
        
        incident.status = new_status
        incident.save()
        serializer = self.get_serializer(incident)
        return Response(serializer.data, status=status.HTTP_200_OK)

class RepairViewSet(LockEnforcementMixin, viewsets.ModelViewSet):
    queryset = Repair.objects.all().order_by('-created_at')
    serializer_class = RepairSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)
    locked_values = {'certified'}
    lock_error_message = 'Repair already certified and locked. Use reopen to make further changes.'

    def perform_create(self, serializer):
        serializer.save(technician=self.request.user)

    @action(detail=True, methods=['patch'])
    def start(self, request, pk=None):
        repair = self.get_object()
        if repair.status not in ('created', 'reopened'):
            return Response(
                {'error': f'Cannot start a repair with status "{repair.status}".'},
                status=status.HTTP_400_BAD_REQUEST
            )
        repair.status = 'started'
        repair.started_at = timezone.now()
        repair.save()
        return Response(self.get_serializer(repair).data)

    @action(detail=True, methods=['patch'])
    def complete(self, request, pk=None):
        repair = self.get_object()
        if repair.status not in ('started', 'reopened'):
            return Response(
                {'error': f'Cannot complete a repair with status "{repair.status}".'},
                status=status.HTTP_400_BAD_REQUEST
            )
        repair.status = 'completed'
        repair.completed_at = timezone.now()
        repair.save()
        return Response(self.get_serializer(repair).data)

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsLineSupervisorOrAbove])
    def certify(self, request, pk=None):
        repair = self.get_object()
        if repair.status == 'certified':
            return Response({'error': 'This repair has already been certified.'}, status=status.HTTP_400_BAD_REQUEST)
        signature = request.FILES.get('supervisor_signature')
        if not signature:
            return Response({'error': 'Supervisor signature is required to certify a repair.'}, status=status.HTTP_400_BAD_REQUEST)
        repair.status = 'certified'
        repair.supervisor = request.user
        repair.certified_by = request.user
        repair.supervisor_signature = signature
        repair.certified_at = timezone.now()
        repair.save()
        if repair.incident:
            repair.incident.status = 'resolved'
            repair.incident.resolved_at = timezone.now()
            repair.incident.save()
        return Response(self.get_serializer(repair).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsLineSupervisorOrAbove])
    def reopen(self, request, pk=None):
        repair = self.get_object()
        if repair.status not in ('certified', 'completed'):
            return Response(
                {'error': 'Only certified or completed repairs can be reopened.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        repair.status = 'reopened'
        repair.follow_up_required = True
        repair.certified_at = None
        repair.certified_by = None
        repair.save()
        if repair.incident:
            repair.incident.status = 'in_progress'
            repair.incident.resolved_at = None
            repair.incident.save()
        return Response(self.get_serializer(repair).data)

class InspectionViewSet(viewsets.ModelViewSet):
    queryset = Inspection.objects.all().order_by('-start_date')
    serializer_class = InspectionSerializer
    permission_classes = [IsAuthenticated]

class TreatmentLogViewSet(viewsets.ModelViewSet):
    queryset = TreatmentLog.objects.all().order_by('-report_date')
    serializer_class = TreatmentLogSerializer
    permission_classes = [IsAuthenticated]

class ExhausterViewSet(viewsets.ModelViewSet):
    queryset = Exhauster.objects.all().order_by('reg_no')
    serializer_class = ExhausterSerializer
    permission_classes = [IsAuthenticated]

class ExhausterLicenseViewSet(viewsets.ModelViewSet):
    queryset = ExhausterLicense.objects.all().order_by('-end_date')
    serializer_class = ExhausterLicenseSerializer
    permission_classes = [IsAuthenticated]


LicenseViewSet = ExhausterLicenseViewSet


class SludgeCollectionViewSet(viewsets.ModelViewSet):
    queryset = SludgeCollection.objects.all().order_by('-collection_date')
    serializer_class = SludgeCollectionSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsSTPOperatorOrAbove])
    def receive(self, request, pk=None):
        manifest = self.get_object()
        if manifest.manifest_status != 'pending':
            return Response(
                {'error': 'Only pending manifests can be received.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        manifest.manifest_status = 'received'
        manifest.received_by = request.user
        manifest.received_at = timezone.now()
        manifest.save()
        serializer = self.get_serializer(manifest)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsSTPSupervisorOrAbove])
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
        manifest.save()
        serializer = self.get_serializer(manifest)
        return Response(serializer.data)

class ConnectionReportViewSet(viewsets.ModelViewSet):
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


class PatrolRowViewSet(viewsets.ModelViewSet):
    """
    Endpoint for individual F201 patrol row entries with escalation support.
    """
    queryset = PatrolRow.objects.all().order_by('weekly_patrol__date', 'time')
    serializer_class = PatrolRowSerializer
    permission_classes = [IsAuthenticated]

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


class WeeklyLinePatrolViewSet(viewsets.ModelViewSet):
    """
    [cite_start]Endpoint for F201 Sewer Lines Weekly Tasks Record Sheet. [cite: 205]
    """
    queryset = WeeklyLinePatrol.objects.all().order_by('-date')
    serializer_class = WeeklyLinePatrolSerializer
    permission_classes = [IsAuthenticated]

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

class InletWorksDailyTaskViewSet(LockEnforcementMixin, viewsets.ModelViewSet):
    """
    [cite_start]Endpoint for F203A Inlet Works Screens & Grit Removal. [cite: 218]
    """
    queryset = InletWorksDailyTask.objects.all().order_by('-date')
    serializer_class = InletWorksDailyTaskSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsSTPSupervisorOrAbove])
    def verify(self, request, pk=None):
        task = self.get_object()

        if task.status == 'verified':
            return Response({'error': 'Record already verified and locked.'}, status=status.HTTP_400_BAD_REQUEST)

        task.status = 'verified'
        task.verified_by = request.user
        task.verified_at = timezone.now()
        task.save()

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


class DailyLabRecordViewSet(LockEnforcementMixin, viewsets.ModelViewSet):
    """
    F203B: Daily Lab Record with partial-entry support (PATCH preserves nulls)
    and supervisor verification workflow.
    """
    serializer_class = DailyLabRecordSerializer
    permission_classes = [IsAuthenticated]
    locked_values = {'verified'}
    lock_error_message = 'Lab record already verified and locked.'

    def get_queryset(self):
        qs = DailyLabRecord.objects.all()
        year = self.request.query_params.get('year')
        month = self.request.query_params.get('month')
        if year:
            qs = qs.filter(record_date__year=year)
        if month:
            qs = qs.filter(record_date__month=month)
        return qs.order_by('record_date')

    def perform_create(self, serializer):
        serializer.save(attendant=self.request.user)

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsSTPSupervisorOrAbove])
    def verify(self, request, pk=None):
        record = self.get_object()
        if record.status == 'verified':
            return Response({'error': 'Record already verified and locked.'}, status=status.HTTP_400_BAD_REQUEST)
        record.status = 'verified'
        record.verified_by = request.user
        record.verified_at = timezone.now()
        record.save()
        return Response(self.get_serializer(record).data)


class DailyFlowRecordViewSet(viewsets.ModelViewSet):
    """
    [cite_start]Endpoint for F203C Inlet Works Flow Measurement Task Record. [cite: 190]
    """
    queryset = DailyFlowRecord.objects.all().order_by('-date')
    serializer_class = DailyFlowRecordSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsSTPSupervisorOrAbove])
    def verify(self, request, pk=None):
        record = self.get_object()

        if record.status == 'verified':
            return Response({'error': 'Record already verified and locked.'}, status=status.HTTP_400_BAD_REQUEST)

        record.status = 'verified'
        record.verified_by = request.user
        record.verified_at = timezone.now()
        record.save()

        serializer = self.get_serializer(record)
        return Response(serializer.data)


# --- USER VIEWSET ---

class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for retrieving user data (read-only).
    Used by the dispatch dashboard to list available field staff for assignment.
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]


# --- ATTACHMENT VIEWSET ---

class AttachmentViewSet(viewsets.ModelViewSet):
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


class PondDailyLogViewSet(LockEnforcementMixin, viewsets.ModelViewSet):
    """
    Daily pond observation log with 3-level sign-off:
      submitted → cosigned_op → verified
    """
    serializer_class = PondDailyLogSerializer
    permission_classes = [IsAuthenticated]
    locked_values = {'verified'}
    lock_error_message = 'Pond log already verified and locked.'

    def get_queryset(self):
        qs = PondDailyLog.objects.select_related('pond', 'submitted_by', 'cosigned_by', 'verified_by').all()
        year  = self.request.query_params.get('year')
        month = self.request.query_params.get('month')
        pond  = self.request.query_params.get('pond')
        if year:  qs = qs.filter(log_date__year=year)
        if month: qs = qs.filter(log_date__month=month)
        if pond:  qs = qs.filter(pond__code=pond)
        return qs.order_by('log_date', 'pond__code')

    def perform_create(self, serializer):
        serializer.save(submitted_by=self.request.user)

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsSTPOperatorOrAbove])
    def cosign(self, request, pk=None):
        log = self.get_object()
        if log.status != 'submitted':
            return Response(
                {'error': f'Cannot cosign a log with status "{log.status}".'},
                status=status.HTTP_400_BAD_REQUEST
            )
        log.status = 'cosigned_op'
        log.cosigned_by = request.user
        log.cosigned_at = timezone.now()
        log.save()
        return Response(self.get_serializer(log).data)

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsSTPSupervisorOrAbove])
    def verify(self, request, pk=None):
        log = self.get_object()
        if log.status == 'verified':
            return Response({'error': 'Log already verified.'}, status=status.HTTP_400_BAD_REQUEST)
        if log.status != 'cosigned_op':
            return Response(
                {'error': 'Log must be co-signed by an operator before supervisor verification.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        log.status = 'verified'
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


class PondYearlyTaskViewSet(viewsets.ModelViewSet):
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

    def _aggregate_month(self, year, month):
        """Live aggregation of all metrics for the given year/month."""
        month_name = calendar.month_name[month]

        incidents = Incident.objects.filter(reported_at__year=year, reported_at__month=month)
        patrol_rows = PatrolRow.objects.filter(weekly_patrol__date__year=year, weekly_patrol__date__month=month)
        new_mother = patrol_rows.aggregate(Sum('new_mother_connections'))['new_mother_connections__sum'] or 0
        new_child = patrol_rows.aggregate(Sum('new_child_connections'))['new_child_connections__sum'] or 0
        repairs_completed = Repair.objects.filter(completion_date__year=year, completion_date__month=month).count()

        lab_qs = DailyLabRecord.objects.filter(record_date__year=year, record_date__month=month)
        bod_exceedance_days = sum(1 for r in lab_qs if r.is_bod_exceedance)
        tss_exceedance_days = sum(1 for r in lab_qs if r.is_tss_exceedance)
        bod_vals = [r.bod_removal_efficiency for r in lab_qs if r.bod_removal_efficiency is not None]
        tss_vals = [r.tss_removal_efficiency for r in lab_qs if r.tss_removal_efficiency is not None]
        avg_bod = round(sum(bod_vals) / len(bod_vals), 1) if bod_vals else None
        avg_tss = round(sum(tss_vals) / len(tss_vals), 1) if tss_vals else None

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
                "new_connections": new_mother + new_child,
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
                "received_count": collections.filter(manifest_status='received').count(),
                "rejected_count": collections.filter(manifest_status='rejected').count(),
                "pending_count": collections.filter(manifest_status='pending').count(),
                "active_exhausters": Exhauster.objects.filter(status='active').count(),
            },
            "period": {
                "year": year,
                "month": month,
                "month_name": month_name,
            },
        }

    def get(self, request):
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
            export_format = request.query_params.get('export', 'json').lower()
            if export_format != 'csv':
                return Response(data)
        except MonthlySummarySnapshot.DoesNotExist:
            pass

        real_data = self._aggregate_month(year, month)
        real_data['is_locked'] = False

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

    def post(self, request):
        """Lock a month's summary into an immutable snapshot (superintendent only)."""
        if not IsSTPSuperintendent().has_permission(request, self):
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

        snapshot_data = self._aggregate_month(year, month)
        snap.is_locked    = True
        snap.locked_by    = request.user
        snap.locked_at    = timezone.now()
        snap.snapshot_data = snapshot_data
        snap.save()

        return Response({
            'message': f'{calendar.month_name[month]} {year} summary locked successfully.',
            'locked_at': snap.locked_at.isoformat(),
            'locked_by': request.user.get_full_name(),
        }, status=status.HTTP_200_OK)