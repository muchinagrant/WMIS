from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    IncidentViewSet, RepairViewSet, InspectionViewSet,
    TreatmentLogViewSet, ExhausterViewSet, ExhausterLicenseViewSet, LicenseViewSet,
    SludgeCollectionViewSet, ConnectionReportViewSet, SummaryViewSet,
    CustomTokenObtainPairView,
    SewerLineSectionViewSet, PatrolRowViewSet, WeeklyLinePatrolViewSet,
    InletWorksDailyTaskViewSet, DailyLabRecordViewSet, DailyFlowRecordViewSet,
    TreatmentPondViewSet, PondDailyLogViewSet, PondYearlyTaskViewSet,
    LabComplianceFlagViewSet,
    UserViewSet,
    AttachmentViewSet,
    ZoneViewSet, SewerLineViewSet, NotificationViewSet,
    TeamMembershipViewSet, FieldMonthlyReportViewSet,
)

# Create a router and register our viewsets with it.
router = DefaultRouter()
router.register(r'incidents', IncidentViewSet, basename='incident')
router.register(r'repairs', RepairViewSet, basename='repair')
router.register(r'inspections', InspectionViewSet, basename='inspection')
router.register(r'treatment-logs', TreatmentLogViewSet, basename='treatmentlog')
router.register(r'exhausters', ExhausterViewSet, basename='exhauster')
router.register(r'licenses', LicenseViewSet, basename='license')
router.register(r'sludge', SludgeCollectionViewSet, basename='sludgecollection')
router.register(r'connections', ConnectionReportViewSet, basename='connection')
router.register(r'users', UserViewSet, basename='user')
router.register(r'attachments', AttachmentViewSet, basename='attachment')
router.register(r'zones', ZoneViewSet, basename='zone')
router.register(r'sewer-lines', SewerLineViewSet, basename='sewerline')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'team-memberships', TeamMembershipViewSet, basename='teammembership')
router.register(r'field-monthly-report', FieldMonthlyReportViewSet, basename='fieldmonthlyreport')

# Registering the new operational templates
router.register(r'sewer-line-sections', SewerLineSectionViewSet, basename='sewerlinesection')
router.register(r'patrol-rows', PatrolRowViewSet, basename='patrolrow')
router.register(r'patrols', WeeklyLinePatrolViewSet, basename='weeklypatrol')
router.register(r'f203a', InletWorksDailyTaskViewSet, basename='inletdailytask')
router.register(r'lab-records', DailyLabRecordViewSet, basename='dailylabrecord')
router.register(r'flow-records', DailyFlowRecordViewSet, basename='dailyflowrecord')
router.register(r'ponds', TreatmentPondViewSet, basename='treatmentpond')
router.register(r'pond-logs', PondDailyLogViewSet, basename='ponddailylog')
router.register(r'pond-tasks', PondYearlyTaskViewSet, basename='pondyearlytask')
router.register(r'lab-flags', LabComplianceFlagViewSet, basename='labcomplianceflag')

# Custom routes for summary and authentication endpoints
custom_patterns = [
    # Intercepting the token generation to inject user roles
    path('auth/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('summary/', SummaryViewSet.as_view(), name='summary'),
    path('summary/lock_month/', SummaryViewSet.as_view(), name='summary_lock_month'),
    path('summary/draft_notes/', SummaryViewSet.as_view(), name='summary_draft_notes'),
]

urlpatterns = [
    path('', include(router.urls)),
    path('', include(custom_patterns)),
]