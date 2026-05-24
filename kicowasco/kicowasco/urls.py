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
    except Exception as e:
        count = f"Error: {str(e)}"

    # 2. Check which database we are actually connected to
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT current_database();")
            db_name = cursor.fetchone()[0]
    except Exception as e:
        db_name = f"Error: {str(e)}"

    # 3. Close and reopen database connection to clear any stuck connections
    try:
        connection.close_if_unusable_or_obsolete()
        db_reset = "Connection reset"
    except Exception as e:
        db_reset = f"Error: {str(e)}"

    return JsonResponse({
        "message": "Emergency reset completed",
        "axes_locks_removed": count,
        "connected_to_db": db_name,
        "db_connection_reset": db_reset,
        "status": "Ready for login"
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