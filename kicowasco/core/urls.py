from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    # Phase 1-3 Views
    UserViewSet,
    IncidentViewSet,
    RepairViewSet,
    AttachmentViewSet,
    
    # Phase 4 Views
    InspectionViewSet,
    TreatmentLogViewSet,
    
    # Phase 5 Views
    ExhausterViewSet,
    LicenseViewSet,
    SludgeCollectionViewSet,
    
    # Summary View
    MonthlySummaryView,  # Import the new view
)

# Initialize the router
router = DefaultRouter()

# ============================================
# Phase 1-3 Routes (Core Incident Management)
# ============================================
router.register(r'users', UserViewSet, basename='user')
router.register(r'incidents', IncidentViewSet, basename='incident')
router.register(r'repairs', RepairViewSet, basename='repair')
router.register(r'attachments', AttachmentViewSet, basename='attachment')

# ============================================
# Phase 4 Routes (Treatment & Inspection)
# ============================================
router.register(r'inspections', InspectionViewSet, basename='inspection')
router.register(r'treatment-logs', TreatmentLogViewSet, basename='treatmentlog')

# ============================================
# Phase 5 Routes (Exhauster Management)
# ============================================
router.register(r'exhausters', ExhausterViewSet, basename='exhauster')
router.register(r'licenses', LicenseViewSet, basename='license')
router.register(r'sludge-collections', SludgeCollectionViewSet, basename='sludgecollection')

# The API URLs are now determined automatically by the router.
urlpatterns = [
    path('', include(router.urls)),
    # Add the custom endpoint for the summary dashboard
    # This will be accessible at: /api/summaries/monthly/?year=2024&month=3
    # For CSV export: /api/summaries/monthly/?year=2024&month=3&export=csv
    path('summaries/monthly/', MonthlySummaryView.as_view(), name='monthly-summary'),
]

# Optional: Add a simple API root view if needed
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.urls import reverse

@api_view(['GET'])
def api_root(request):
    """API root endpoint with links to all available resources"""
    return Response({
        'users': reverse('user-list', request=request),
        'incidents': reverse('incident-list', request=request),
        'repairs': reverse('repair-list', request=request),
        'attachments': reverse('attachment-list', request=request),
        'inspections': reverse('inspection-list', request=request),
        'treatment-logs': reverse('treatmentlog-list', request=request),
        'exhausters': reverse('exhauster-list', request=request),
        'licenses': reverse('license-list', request=request),
        'sludge-collections': reverse('sludgecollection-list', request=request),
        'monthly-summary': reverse('monthly-summary', request=request),  # Added to root endpoint
    })

# Add the root endpoint to urlpatterns
urlpatterns += [
    path('', api_root, name='api-root'),
]