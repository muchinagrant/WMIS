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
import calendar

from core.models import (
    Incident, Repair, Inspection, TreatmentLog, Exhauster, 
    License, SludgeCollection, ConnectionReport, Attachment,
    WeeklyLinePatrol, InletWorksDailyTask, DailyFlowRecord,
    TreatmentParameter,
)
from core.permissions import IsSupervisor
from .serializers import (
    IncidentSerializer, RepairSerializer, InspectionSerializer,
    TreatmentLogSerializer, ExhausterSerializer, LicenseSerializer,
    SludgeCollectionSerializer, ConnectionReportSerializer,
    CustomTokenObtainPairSerializer, WeeklyLinePatrolSerializer,
    InletWorksDailyTaskSerializer, DailyFlowRecordSerializer,
    AttachmentSerializer, UserSerializer
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
        # Auto-assign the creator when a new incident is logged
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsSupervisor])
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
        
        # --- RULE 1: Grade 6 Attendants ---
        if user_role == 'attendant':
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
                    'error': 'Attendants cannot directly resolve incidents. You must submit for certification.'
                }, status=status.HTTP_403_FORBIDDEN)
            # Handle exception states for plumbers (e.g., waiting for parts)
            elif new_status not in ['on_hold_materials', 'on_hold_equipment', 'pending_certification']:
                return Response({'error': 'Invalid status transition for your role.'}, status=status.HTTP_403_FORBIDDEN)

        # --- RULE 2: Grade 4 Supervisors override authority ---
        
        incident.status = new_status
        incident.save()
        serializer = self.get_serializer(incident)
        return Response(serializer.data, status=status.HTTP_200_OK)

class RepairViewSet(viewsets.ModelViewSet):
    queryset = Repair.objects.all().order_by('-created_at')
    serializer_class = RepairSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def create(self, request, *args, **kwargs):
        # Removed atomic inventory transaction since materials are now manually logged.
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(technician=self.request.user)

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsSupervisor])
    def certify(self, request, pk=None):
        """
        Supervisor-only endpoint to digitally sign and certify a repair,
        which also automatically closes the linked incident.
        """
        repair = self.get_object()
        
        if repair.certified_at:
            return Response(
                {'error': 'This repair has already been certified.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        signature = request.FILES.get('supervisor_signature')
        if not signature:
            return Response(
                {'error': 'Supervisor signature is required to certify a repair.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Update the Repair record
        repair.supervisor = request.user
        repair.supervisor_signature = signature
        repair.certified_at = timezone.now()
        repair.save()
        
        # UPGRADED: Advance State Machine AND close the SLA timer
        if repair.incident:
            repair.incident.status = 'resolved'
            repair.incident.resolved_at = timezone.now()  # <-- FINAL AUTOMATED TIMESTAMP
            repair.incident.save()
        
        serializer = self.get_serializer(repair)
        return Response(serializer.data, status=status.HTTP_200_OK)

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

class LicenseViewSet(viewsets.ModelViewSet):
    queryset = License.objects.all().order_by('-end_date')
    serializer_class = LicenseSerializer
    permission_classes = [IsAuthenticated]

class SludgeCollectionViewSet(viewsets.ModelViewSet):
    queryset = SludgeCollection.objects.all().order_by('-collection_date')
    serializer_class = SludgeCollectionSerializer
    permission_classes = [IsAuthenticated]

class ConnectionReportViewSet(viewsets.ModelViewSet):
    queryset = ConnectionReport.objects.all().order_by('-start_date')
    serializer_class = ConnectionReportSerializer
    permission_classes = [IsAuthenticated]


# --- NEW OPERATIONAL VIEWSETS ---

class WeeklyLinePatrolViewSet(viewsets.ModelViewSet):
    """
    [cite_start]Endpoint for F201 Sewer Lines Weekly Tasks Record Sheet. [cite: 205]
    """
    queryset = WeeklyLinePatrol.objects.all().order_by('-date', '-time')
    serializer_class = WeeklyLinePatrolSerializer
    permission_classes = [IsAuthenticated]

class InletWorksDailyTaskViewSet(viewsets.ModelViewSet):
    """
    [cite_start]Endpoint for F203A Inlet Works Screens & Grit Removal. [cite: 218]
    """
    queryset = InletWorksDailyTask.objects.all().order_by('-date')
    serializer_class = InletWorksDailyTaskSerializer
    permission_classes = [IsAuthenticated]

class DailyFlowRecordViewSet(viewsets.ModelViewSet):
    """
    [cite_start]Endpoint for F203C Inlet Works Flow Measurement Task Record. [cite: 190]
    """
    queryset = DailyFlowRecord.objects.all().order_by('-date')
    serializer_class = DailyFlowRecordSerializer
    permission_classes = [IsAuthenticated]


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


# --- SUMMARY VIEWSET ---

class SummaryViewSet(APIView):
    permission_classes = [IsAuthenticated]

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
        month_name = calendar.month_name[month]

        # 1. Collection & Incidents Metrics
        incidents = Incident.objects.filter(reported_at__year=year, reported_at__month=month)
        patrols = WeeklyLinePatrol.objects.filter(date__year=year, date__month=month)

        total_incidents = incidents.count()
        resolved_incidents = incidents.filter(status__in=['resolved', 'closed']).count()
        repairs_completed = Repair.objects.filter(completion_date__year=year, completion_date__month=month).count()

        # Aggregate new connections found during F201 patrols
        new_mother = patrols.aggregate(Sum('new_mother_accounts'))['new_mother_accounts__sum'] or 0
        new_child = patrols.aggregate(Sum('new_child_accounts'))['new_child_accounts__sum'] or 0

        # 2. Treatment Plant Metrics (F203)
        t_logs = TreatmentLog.objects.filter(report_date__year=year, report_date__month=month)
        t_params = TreatmentParameter.objects.filter(tlog__in=t_logs)

        # Average Removal Efficiencies
        bod_avg = t_params.filter(parameter__icontains='BOD').aggregate(Avg('removal_percent'))['removal_percent__avg'] or 0
        tss_avg = t_params.filter(parameter__icontains='TSS').aggregate(Avg('removal_percent'))['removal_percent__avg'] or 0

        # 3. Sludge Management Metrics
        collections = SludgeCollection.objects.filter(collection_date__year=year, collection_date__month=month)
        total_volume = collections.aggregate(Sum('volume_m3'))['volume_m3__sum'] or 0

        res_vol = collections.filter(source_type='residential').aggregate(Sum('volume_m3'))['volume_m3__sum'] or 0
        inst_vol = collections.filter(source_type='institutional').aggregate(Sum('volume_m3'))['volume_m3__sum'] or 0
        com_vol = collections.filter(source_type='commercial').aggregate(Sum('volume_m3'))['volume_m3__sum'] or 0

        # Construct the real data payload
        real_data = {
            "collection": {
                "total_incidents": total_incidents,
                "resolved_incidents": resolved_incidents,
                "repairs_completed": repairs_completed,
                "new_connections": new_mother + new_child,
                "spillage_incidences": incidents.filter(category='spillage').count(),
            },
            "treatment": {
                "avg_bod_removal": round(bod_avg, 2),
                "avg_tss_removal": round(tss_avg, 2),
                "days_with_alerts": t_logs.filter(alert=True).count(),
            },
            "sludge": {
                "total_volume_m3": float(total_volume),
                "breakdown": {
                    "residential": float(res_vol),
                    "institutional": float(inst_vol),
                    "commercial": float(com_vol),
                },
                "collections_count": collections.count(),
                "active_exhausters": Exhauster.objects.filter(status='active').count(),
            },
            "period": {
                "year": year,
                "month": month,
                "month_name": month_name,
            }
        }
        return Response(real_data)

    def post(self, request):
        return Response({
            "message": "Report generated successfully",
            "download_url": "/api/monthly-summary/download/mock-report.pdf"
        })