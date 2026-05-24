from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    User, Incident, RepairAttempt, Inspection, InspectionEntry,
    TreatmentLog, TreatmentParameter, Exhauster, ExhausterLicense,
    SludgeCollection, ConnectionReport, ConnectionApplication, DailyLabRecord,
    TreatmentPond, PondDailyLog, PondYearlyTask,
    Company,
)

# --- 1. USER MANAGEMENT ---
@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'role', 'company', 'is_staff')
    fieldsets = UserAdmin.fieldsets + (
        ('Role Information', {'fields': ('role', 'company')}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Role Information', {'fields': ('role', 'company')}),
    )


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'email', 'phone', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('code', 'name', 'email')

# --- 2. INCIDENT & REPAIR MANAGEMENT ---
@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ('id', 'reported_at', 'location_text', 'status', 'assigned_to')
    list_filter = ('status', 'reported_at')
    search_fields = ('location_text', 'description', 'reported_by_name')

@admin.register(RepairAttempt)
class RepairAttemptAdmin(admin.ModelAdmin):
    list_display = ('id', 'incident', 'attempt_number', 'attendant', 'submitted_at')
    list_filter = ('submitted_at',)
    search_fields = ('incident__incident_number', 'work_performed', 'materials_used')

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

@admin.register(ExhausterLicense)
class ExhausterLicenseAdmin(admin.ModelAdmin):
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
    list_display = ('start_date', 'prepared_by')
    list_filter = ('start_date',)
    inlines = [ConnectionApplicationInline]

@admin.register(DailyLabRecord)
class DailyLabRecordAdmin(admin.ModelAdmin):
    list_display = ('record_date', 'attendant', 'status', 'effluent_bod', 'effluent_tss', 'verified_by')
    list_filter = ('status', 'record_date')
    search_fields = ('record_date',)

@admin.register(TreatmentPond)
class TreatmentPondAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'capacity_m3', 'is_active')

@admin.register(PondDailyLog)
class PondDailyLogAdmin(admin.ModelAdmin):
    list_display = ('pond', 'log_date', 'status', 'submitted_by', 'ph', 'do_level')
    list_filter = ('status', 'log_date', 'pond')
    search_fields = ('pond__code',)

@admin.register(PondYearlyTask)
class PondYearlyTaskAdmin(admin.ModelAdmin):
    list_display = ('pond', 'year', 'task_name', 'status', 'due_date', 'assigned_to')
    list_filter = ('status', 'year', 'pond')