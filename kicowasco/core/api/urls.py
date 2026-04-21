from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    IncidentViewSet, RepairViewSet, InspectionViewSet, 
    TreatmentLogViewSet, ExhausterViewSet, LicenseViewSet, 
    SludgeCollectionViewSet, ConnectionReportViewSet, SummaryViewSet,
    CustomTokenObtainPairView, WeeklyLinePatrolViewSet, 
    InletWorksDailyTaskViewSet, DailyFlowRecordViewSet, UserViewSet,
    AttachmentViewSet, MaterialViewSet  # NEW
)

# Create a router and register our viewsets with it.
router = DefaultRouter()
router.register(r'incidents', IncidentViewSet, basename='incident')
router.register(r'repairs', RepairViewSet, basename='repair')
router.register(r'inspections', InspectionViewSet, basename='inspection')
router.register(r'treatment-logs', TreatmentLogViewSet, basename='treatmentlog')
router.register(r'exhausters', ExhausterViewSet, basename='exhauster')
router.register(r'licenses', LicenseViewSet, basename='license')
router.register(r'sludge-collections', SludgeCollectionViewSet, basename='sludgecollection')
router.register(r'connections', ConnectionReportViewSet, basename='connection')
router.register(r'users', UserViewSet, basename='user')
router.register(r'materials', MaterialViewSet, basename='material')  # NEW
router.register(r'attachments', AttachmentViewSet, basename='attachment')

# Registering the new operational templates
router.register(r'weekly-patrols', WeeklyLinePatrolViewSet, basename='weeklypatrol')
router.register(r'inlet-daily-tasks', InletWorksDailyTaskViewSet, basename='inletdailytask')
router.register(r'daily-flow-records', DailyFlowRecordViewSet, basename='dailyflowrecord')

# Custom routes for summary and authentication endpoints
custom_patterns = [
    # Intercepting the token generation to inject user roles
    path('auth/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('monthly-summary/', SummaryViewSet.as_view(), name='monthly-summary'),
]

urlpatterns = [
    path('', include(router.urls)),
    path('', include(custom_patterns)),
]