from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

# Health check endpoint
def health_check(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    # Health check route
    path('health/', health_check),

    path('admin/', admin.site.urls),
    
    # JWT Authentication Endpoints
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Core Application API Endpoints
    path('api/', include('core.api.urls')),
]