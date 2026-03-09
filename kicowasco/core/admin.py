from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Incident

# Register the Custom User using Django's built-in UserAdmin
admin.site.register(User, UserAdmin)

@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ('id', 'location_text', 'status', 'reported_at', 'assigned_to')
    list_filter = ('status', 'reported_at')
    search_fields = ('location_text', 'description', 'reported_by_name')