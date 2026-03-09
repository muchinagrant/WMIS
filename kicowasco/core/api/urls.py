from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import IncidentViewSet

# Create a router and register our viewsets with it.
router = DefaultRouter()
router.register(r'incidents', IncidentViewSet, basename='incident')

# The API URLs are now determined automatically by the router.
urlpatterns = [
    path('', include(router.urls)),
]