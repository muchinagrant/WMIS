from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.decorators import action
from core.models import (
    Incident, Repair, Inspection, TreatmentLog, Exhauster, 
    License, SludgeCollection, ConnectionReport
)
from .serializers import (
    IncidentSerializer, RepairSerializer, InspectionSerializer,
    TreatmentLogSerializer, ExhausterSerializer, LicenseSerializer,
    SludgeCollectionSerializer, ConnectionReportSerializer
)

class IncidentViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows Incidents to be viewed, created, or edited.
    Automatically provides `list`, `create`, `retrieve`, `update` and `destroy` actions.
    """
    queryset = Incident.objects.all().order_by('-reported_at')
    serializer_class = IncidentSerializer
    
    # This ensures only logged-in users can access these endpoints
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        """
        Overrides the default save behavior to inject the current user
        as the creator of the incident.
        """
        serializer.save(created_by=self.request.user)


class RepairViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows Repairs to be viewed, created, or edited.
    """
    queryset = Repair.objects.all().order_by('-created_at')
    serializer_class = RepairSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)  # Necessary for image uploads

    def perform_create(self, serializer):
        """
        Overrides the default save behavior to inject the current user
        as the technician of the repair.
        """
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


class SummaryViewSet(APIView):
    """
    API endpoint for monthly summary reports.
    Provides aggregated data for presentation purposes.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Get monthly summary data based on year and month query parameters.
        """
        year = request.query_params.get('year')
        month = request.query_params.get('month')

        if not year or not month:
            return Response(
                {"error": "Both 'year' and 'month' query parameters are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Mock data for presentation - in a real app, this would aggregate from actual models
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
                "avg_bod_removal_percent": 85.5,
                "avg_tss_removal_percent": 92.3,
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
                "month_name": "March",  # Would be calculated based on month number
            }
        }

        return Response(mock_data)

    def post(self, request):
        """
        Generate and return a PDF report (mock implementation).
        """
        # In a real implementation, this would generate an actual PDF
        # For now, just return success
        return Response({
            "message": "Report generated successfully",
            "download_url": "/api/monthly-summary/download/mock-report.pdf"
        })