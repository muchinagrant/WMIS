from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from core.models import (
    Incident, Repair, Inspection, TreatmentLog, Exhauster, 
    License, SludgeCollection, ConnectionReport,
    WeeklyLinePatrol, InletWorksDailyTask, DailyFlowRecord
)
from .serializers import (
    IncidentSerializer, RepairSerializer, InspectionSerializer,
    TreatmentLogSerializer, ExhausterSerializer, LicenseSerializer,
    SludgeCollectionSerializer, ConnectionReportSerializer,
    CustomTokenObtainPairSerializer, WeeklyLinePatrolSerializer,
    InletWorksDailyTaskSerializer, DailyFlowRecordSerializer
)

# --- CUSTOM AUTHENTICATION VIEW ---
class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Overrides the default token view to use our custom serializer,
    which injects the user's role into the JWT payload for frontend RBAC.
    """
    serializer_class = CustomTokenObtainPairSerializer


# --- EXISTING VIEWSETS ---

class IncidentViewSet(viewsets.ModelViewSet):
    queryset = Incident.objects.all().order_by('-reported_at')
    serializer_class = IncidentSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class RepairViewSet(viewsets.ModelViewSet):
    queryset = Repair.objects.all().order_by('-created_at')
    serializer_class = RepairSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def perform_create(self, serializer):
        serializer.save(technician=self.request.user)

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

        # Mock data retained as per original implementation
        mock_data = {
            "collection": {
                "inspection_incidences": 12,
                "spillage_incidences": 3,
                "repairs_completed": 8,
                "new_connections": 15,
                "total_incidents": 15,
                "resolved_incidents": 11,
            },
            "treatment": {
                "total_influent": 45000,
                "total_effluent": 42000,
                "avg_bod_removal": 85.5,
                "avg_tss_removal": 92.3,
                "days_with_alerts": 2,
            },
            "sludge": {
                "total_volume_m3": 1250,
                "breakdown": {
                    "residential": 650,
                    "institutional": 350,
                    "commercial": 250,
                },
                "collections_count": 25,
                "active_exhausters": 8,
            },
            "period": {
                "year": int(year),
                "month": int(month),
                "month_name": "March",
            }
        }
        return Response(mock_data)

    def post(self, request):
        return Response({
            "message": "Report generated successfully",
            "download_url": "/api/monthly-summary/download/mock-report.pdf"
        })