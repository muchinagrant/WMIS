from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from rest_framework_simplejwt.views import (
    TokenRefreshView,
)
from core.api.views import CustomTokenObtainPairView
from axes.utils import reset
from django.db import connection

# Health check endpoint
def health_check(request):
    return JsonResponse({"status": "ok"})


def emergency_reset(request):
    # 1. Clear all Axes login locks
    try:
        count = reset()
    except Exception:
        count = None

    # 2. Check which database we are actually connected to
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT current_database();")
            db_name = cursor.fetchone()[0]
    except Exception:
        db_name = None

    return JsonResponse({
        "message": "Axes locks cleared!",
        "locks_removed": count,
        "connected_to_db": db_name,
        "status": "Ready for login with kicowasco123"
    })


urlpatterns = [
    # Health check route
    path('health/', health_check),
    path('emergency-reset/', emergency_reset),

    path('admin/', admin.site.urls),
    
    # JWT Authentication Endpoints
    path('api/auth/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Core Application API Endpoints
    path('api/', include('core.api.urls')),
]