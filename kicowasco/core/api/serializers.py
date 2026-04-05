from rest_framework import serializers
from django.contrib.auth import get_user_model
from core.models import (
    Incident, Repair, Inspection, InspectionEntry, TreatmentLog, TreatmentParameter,
    Exhauster, License, SludgeCollection, ConnectionReport, ConnectionApplication
)
from core.serializers import (
    InspectionSerializer, InspectionEntrySerializer,
    TreatmentLogSerializer, TreatmentParameterSerializer,
    ExhausterSerializer, LicenseSerializer, SludgeCollectionSerializer,
    ConnectionReportSerializer, ConnectionApplicationSerializer,
    UserSerializer, IncidentSerializer, RepairSerializer
)

User = get_user_model()

# Re-export the serializers so they can be imported from api.serializers
__all__ = [
    'UserSerializer', 'IncidentSerializer', 'RepairSerializer',
    'InspectionSerializer', 'InspectionEntrySerializer',
    'TreatmentLogSerializer', 'TreatmentParameterSerializer',
    'ExhausterSerializer', 'LicenseSerializer', 'SludgeCollectionSerializer',
    'ConnectionReportSerializer', 'ConnectionApplicationSerializer'
]