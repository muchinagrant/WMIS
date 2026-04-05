from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    User, Incident, Repair, Inspection, InspectionEntry,
    TreatmentLog, TreatmentParameter, Exhauster, License,
    SludgeCollection, ConnectionReport, ConnectionApplication
)

# --- 1. USER MANAGEMENT ---
@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'role', 'is_staff')
    fieldsets = UserAdmin.fieldsets + (
        ('Role Information', {'fields': ('role',)}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Role Information', {'fields': ('role',)}),
    )

# --- 2. INCIDENT & REPAIR MANAGEMENT ---
@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ('id', 'reported_at', 'location_text', 'status', 'assigned_to')
    list_filter = ('status', 'reported_at')
    search_fields = ('location_text', 'description', 'reported_by_name')

@admin.register(Repair)
class RepairAdmin(admin.ModelAdmin):
    list_display = ('id', 'location', 'completion_date', 'technician', 'supervisor')
    list_filter = ('completion_date',)
    search_fields = ('location', 'description_of_work')

# --- 3. INFRASTRUCTURE INSPECTION ---
class InspectionEntryInline(admin.TabularInline):
    model = InspectionEntry
    extra = 1

@admin.register(Inspection)
class InspectionAdmin(admin.ModelAdmin):
    list_display = ('id', 'start_date', 'inspector', 'created_at')
    inlines = [InspectionEntryInline]

# --- 4. TREATMENT PLANT LOGS ---
class TreatmentParameterInline(admin.TabularInline):
    model = TreatmentParameter
    extra = 1

@admin.register(TreatmentLog)
class TreatmentLogAdmin(admin.ModelAdmin):
    list_display = ('report_date', 'operator', 'shift', 'alert')
    list_filter = ('report_date', 'shift', 'alert')
    inlines = [TreatmentParameterInline]

# --- 5. SLUDGE & EXHAUSTER MANAGEMENT ---
@admin.register(Exhauster)
class ExhausterAdmin(admin.ModelAdmin):
    list_display = ('reg_no', 'owner', 'capacity_m3', 'status')
    list_filter = ('status',)
    search_fields = ('reg_no', 'owner')

@admin.register(License)
class LicenseAdmin(admin.ModelAdmin):
    list_display = ('license_no', 'exhauster', 'start_date', 'end_date', 'status')
    list_filter = ('status', 'end_date')

@admin.register(SludgeCollection)
class SludgeCollectionAdmin(admin.ModelAdmin):
    list_display = ('collection_date', 'source_name', 'volume_m3', 'exhauster', 'manifest_status')
    list_filter = ('collection_date', 'manifest_status', 'source_type')
    search_fields = ('source_name', 'area_ward')

# --- 6. SEWER CONNECTIONS ---
class ConnectionApplicationInline(admin.TabularInline):
    model = ConnectionApplication
    extra = 1

@admin.register(ConnectionReport)
class ConnectionReportAdmin(admin.ModelAdmin):
    list_display = ('ward', 'start_date', 'prepared_by')
    list_filter = ('ward', 'start_date')
    inlines = [ConnectionApplicationInline]