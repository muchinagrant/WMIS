from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    IncidentViewSet, RepairViewSet, InspectionViewSet, 
    TreatmentLogViewSet, ExhausterViewSet, LicenseViewSet, 
    SludgeCollectionViewSet, ConnectionReportViewSet
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

# The API URLs are now determined automatically by the router.
urlpatterns = [
    path('', include(router.urls)),
]