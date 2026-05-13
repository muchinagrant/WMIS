from rest_framework import serializers
from django.contrib.auth import get_user_model
from core.models import (
    Incident, Repair, Inspection, InspectionEntry, TreatmentLog, TreatmentParameter,
    Exhauster, ExhausterLicense, SludgeCollection, ConnectionReport, ConnectionApplication,
    Attachment,
)
from core.serializers import (
    InspectionSerializer, InspectionEntrySerializer,
    TreatmentLogSerializer, TreatmentParameterSerializer,
    ExhausterSerializer, ExhausterLicenseSerializer, LicenseSerializer, SludgeCollectionSerializer,
    ConnectionReportSerializer, ConnectionApplicationSerializer,
    UserSerializer, IncidentSerializer, RepairSerializer,
    CustomTokenObtainPairSerializer, WeeklyLinePatrolSerializer,
    SewerLineSectionSerializer, PatrolRowSerializer,
    InletWorksDailyTaskSerializer, DailyFlowRecordSerializer, FlowReadingSerializer,
    DailyLabRecordSerializer,
    TreatmentPondSerializer, PondDailyLogSerializer, PondYearlyTaskSerializer,
    AttachmentSerializer,
)

User = get_user_model()

# Re-export the serializers so they can be imported from api.serializers
__all__ = [
    'UserSerializer', 'IncidentSerializer', 'RepairSerializer',
    'InspectionSerializer', 'InspectionEntrySerializer',
    'TreatmentLogSerializer', 'TreatmentParameterSerializer',
    'ExhausterSerializer', 'ExhausterLicenseSerializer', 'LicenseSerializer', 'SludgeCollectionSerializer',
    'ConnectionReportSerializer', 'ConnectionApplicationSerializer',
    'CustomTokenObtainPairSerializer', 'WeeklyLinePatrolSerializer', 'SewerLineSectionSerializer', 'PatrolRowSerializer',
    'InletWorksDailyTaskSerializer', 'DailyFlowRecordSerializer', 'FlowReadingSerializer',
    'DailyLabRecordSerializer',
    'TreatmentPondSerializer', 'PondDailyLogSerializer', 'PondYearlyTaskSerializer',
    'AttachmentSerializer',
]
