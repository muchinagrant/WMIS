from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from core.models import Incident, Repair
from .serializers import IncidentSerializer, RepairSerializer

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