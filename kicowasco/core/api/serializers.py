from rest_framework import serializers
from django.contrib.auth import get_user_model
from core.models import (
    Incident, RepairAttempt, Inspection, InspectionEntry, TreatmentLog, TreatmentParameter,
    Exhauster, ExhausterLicense, SludgeCollection, ConnectionReport, ConnectionApplication,
    Attachment, Zone, SewerLine, Notification, TeamMembership, FieldMonthlyReport,
)
from core.serializers import (
    InspectionSerializer, InspectionEntrySerializer,
    TreatmentLogSerializer, TreatmentParameterSerializer,
    ExhausterSerializer, ExhausterLicenseSerializer, LicenseSerializer, SludgeCollectionSerializer,
    ConnectionReportSerializer, ConnectionApplicationSerializer,
    UserSerializer, IncidentSerializer, RepairAttemptSerializer,
    CustomTokenObtainPairSerializer, WeeklyLinePatrolSerializer,
    SewerLineSectionSerializer, PatrolRowSerializer,
    InletWorksDailyTaskSerializer, DailyFlowRecordSerializer, FlowReadingSerializer,
    DailyLabRecordSerializer,
    LabComplianceFlagSerializer,
    TreatmentPondSerializer, PondDailyLogSerializer, PondYearlyTaskSerializer,
    AttachmentSerializer, ZoneSerializer, SewerLineSerializer, NotificationSerializer,
    TeamMembershipSerializer, FieldMonthlyReportSerializer,
)

User = get_user_model()

# Re-export the serializers so they can be imported from api.serializers
__all__ = [
    'UserSerializer', 'IncidentSerializer', 'RepairAttemptSerializer',
    'InspectionSerializer', 'InspectionEntrySerializer',
    'TreatmentLogSerializer', 'TreatmentParameterSerializer',
    'ExhausterSerializer', 'ExhausterLicenseSerializer', 'LicenseSerializer', 'SludgeCollectionSerializer',
    'ConnectionReportSerializer', 'ConnectionApplicationSerializer',
    'CustomTokenObtainPairSerializer', 'WeeklyLinePatrolSerializer', 'SewerLineSectionSerializer', 'PatrolRowSerializer',
    'InletWorksDailyTaskSerializer', 'DailyFlowRecordSerializer', 'FlowReadingSerializer',
    'DailyLabRecordSerializer',
    'LabComplianceFlagSerializer',
    'TreatmentPondSerializer', 'PondDailyLogSerializer', 'PondYearlyTaskSerializer',
    'AttachmentSerializer', 'ZoneSerializer', 'SewerLineSerializer', 'NotificationSerializer',
    'TeamMembershipSerializer', 'FieldMonthlyReportSerializer',
]
