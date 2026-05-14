from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.utils import timezone


class Company(models.Model):
    """Simple organization profile for branding and user association."""
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=255)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    website = models.CharField(max_length=255, blank=True)
    address = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class User(AbstractUser):
    # Aligned with the Organogram Grades
    ROLE_CHOICES = [
        ('stp_superintendent', 'STP Superintendent (Grade 3)'),
        ('stp_supervisor', 'STP Supervisor (Grade 4)'),
        ('lab_tech', 'Lab Technologist (Grade 4)'),
        ('stp_operator', 'STP Operator (Grade 5)'),
        ('line_supervisor', 'Line Supervisor (Grade 4)'),
        ('sewer_line_officer', 'Sewer Line Officer'),
        ('line_attendant', 'Line Attendant / Plumber (Grade 6)'),
        ('admin', 'System Admin'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='line_attendant')
    company = models.ForeignKey(
        Company,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users'
    )

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"

    @property
    def full_name(self):
        """Standardizes name access for JWT and Frontend"""
        name = f"{self.first_name} {self.last_name}".strip()
        return name if name else self.username

# --- INCIDENT MANAGEMENT MODELS  ---
class Incident(models.Model):
    """
    Model to capture field incidents (blockages, spills, odors)
    and create an auditable tracking record.
    """
    # UPGRADED: Added exception states for field realities
    INCIDENT_STATUS = [
        ('new', 'New'),
        ('assigned', 'Assigned'),
        ('in_progress', 'In Progress'),
        ('on_hold_materials', 'On Hold - Awaiting Materials'),
        ('on_hold_equipment', 'On Hold - Requires Equipment/Excavator'),
        ('pending_certification', 'Pending Certification'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
        ('rejected', 'Rejected'),
        ('duplicate', 'Duplicate'),
        ('deferred', 'Deferred'),
    ]

    CATEGORY_CHOICES = [
        ('blockage', 'Blockage'),
        ('burst', 'Burst Pipe'),
        ('spillage', 'Sewer Spillage'),
        ('odor', 'Foul Odor'),
        ('missing_cover', 'Missing Manhole Cover'),
        ('illegal_connection', 'Illegal Connection'),
        ('other', 'Other'),
    ]

    SEVERITY_CHOICES = [
        ('high', 'High (Emergency/Critical)'),
        ('medium', 'Medium (Urgent/Operational)'),
        ('low', 'Low (Routine/Minor)'),
    ]

    # Unique identifier
    incident_number = models.CharField(max_length=20, unique=True, blank=True)

    # Duplicate linkage
    duplicate_of = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='duplicates'
    )
    rejection_reason = models.TextField(blank=True)

    # Core Incident Data
    reported_at = models.DateTimeField()
    source_module = models.CharField(max_length=50, blank=True)
    source_reference_id = models.PositiveIntegerField(null=True, blank=True)
    
    # NEW: SLA Timestamps to track Time-to-Resolution (TTR)
    assigned_at = models.DateTimeField(null=True, blank=True)
    in_progress_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    # Upgraded Location Data
    location_text = models.CharField(max_length=255, blank=True, help_text="Landmarks or physical description")
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    assisting_crew = models.CharField(max_length=255, blank=True, help_text="Names of other technicians assisting the lead")

    # Upgraded Classification
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='other')
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='low')
    
    reported_by_name = models.CharField(max_length=200)
    reported_contact = models.CharField(max_length=100, blank=True)
    description = models.TextField(help_text="Additional details about the incident")
    status = models.CharField(max_length=30, choices=INCIDENT_STATUS, default='new')

    # Relationships & Audit Trail
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_incidents'
    )
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='received_incidents'
    )
    received_date = models.DateField(null=True, blank=True)

    # Signatures
    foreman_signed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='foreman_signatures'
    )
    foreman_signature_image = models.ImageField(upload_to='signatures/', null=True, blank=True)

    # Metadata
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='incidents_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-reported_at', '-created_at']

    def save(self, *args, **kwargs):
        if not self.incident_number:
            year = (self.reported_at.year if self.reported_at else timezone.now().year)
            prefix = f'INC-{year}-'
            last = Incident.objects.filter(
                incident_number__startswith=prefix
            ).order_by('incident_number').last()
            seq = 1
            if last and last.incident_number:
                try:
                    seq = int(last.incident_number[len(prefix):]) + 1
                except (ValueError, IndexError):
                    seq = Incident.objects.filter(incident_number__startswith=prefix).count() + 1
            self.incident_number = f'{prefix}{seq:04d}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.incident_number} - {self.get_category_display()} ({self.get_severity_display()})"


# --- REPAIR MANAGEMENT MODELS ---
class Repair(models.Model):
    """
    Model for repair completion certificates linked to incidents.
    Acts as the worker's manual log of what was fixed.
    """
    REPAIR_STATUS = [
        ('created', 'Created'),
        ('started', 'Started'),
        ('completed', 'Completed'),
        ('certified', 'Certified'),
        ('reopened', 'Reopened'),
    ]

    incident = models.ForeignKey(
        Incident,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='repairs'
    )
    completion_date = models.DateField()
    location = models.CharField(max_length=255)

    REPAIR_TYPES = [
        ('rodding', 'Rodding / Unblocking'),
        ('jetting', 'High-Pressure Jetting'),
        ('pipe_replacement', 'Pipe Replacement'),
        ('manhole_repair', 'Manhole / Cover Repair'),
        ('other', 'Other')
    ]
    repair_type = models.CharField(max_length=50, choices=REPAIR_TYPES, default='other')
    scope_of_work = models.TextField(help_text="Describe the exact work performed")
    materials_used = models.TextField(blank=True, help_text="Manually list materials used (e.g., 2 PVC pipes, 1 bag cement)")
    technician = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='repairs_technician'
    )
    supervisor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='repairs_supervisor'
    )
    supervisor_signature = models.ImageField(upload_to='signatures/', null=True, blank=True)

    # State machine
    status = models.CharField(max_length=20, choices=REPAIR_STATUS, default='created')
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    certified_at = models.DateTimeField(null=True, blank=True)
    certified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='repairs_certified'
    )
    follow_up_required = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-completion_date', '-created_at']

    def __str__(self):
        return f"Repair #{self.id} - {self.location} ({self.completion_date})"


# --- INSPECTION MODELS ---
class Inspection(models.Model):
    """
    Model to track infrastructure inspection periods and assignments.
    """
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    inspector = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True,
        related_name='inspections'
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Inspection #{self.id} - {self.start_date} (Inspector: {self.inspector})"
class InspectionEntry(models.Model):
    """
    Individual entries within an inspection, documenting specific sections and conditions.
    """
    CONDITION_CHOICES = [
        ('good', 'Good'),
        ('minor', 'Minor Issues'),
        ('major', 'Major Defect')
    ]

    inspection = models.ForeignKey(
        Inspection, 
        on_delete=models.CASCADE, 
        related_name='entries'
    )
    date = models.DateField()
    section_identifier = models.CharField(max_length=200, help_text="Location or section being inspected")
    length_m = models.DecimalField(
        max_digits=8, 
        decimal_places=2, 
        null=True, 
        blank=True,
        help_text="Length of section in meters"
    )
    condition = models.CharField(max_length=20, choices=CONDITION_CHOICES)
    remarks = models.TextField(blank=True)
    action = models.TextField(blank=True, help_text="Recommended or taken actions")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Entry for {self.section_identifier} - {self.get_condition_display()}"

# ---  SUPPORTING MODELS  ---
class Attachment(models.Model):
    """
    Generic attachment model for storing files related to any entity.
    """
    file = models.FileField(upload_to='attachments/')
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='attachments'
    )
    content_type = models.CharField(max_length=50, help_text="e.g., 'incident', 'repair', 'inspection'")
    object_id = models.PositiveIntegerField()
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
        ]

    def __str__(self):
        return f"Attachment for {self.content_type} #{self.object_id}"
class AuditLog(models.Model):

    """
    Comprehensive audit trail for all system actions.
    """
    ACTION_CHOICES = [
        ('create', 'Create'),
        ('update', 'Update'),
        ('delete', 'Delete'),
        ('submit', 'Submit'),
        ('approve', 'Approve'),
        ('reject', 'Reject'),
        ('certify', 'Certify'),
        ('view', 'View'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='audit_logs'
    )
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    entity = models.CharField(max_length=100, help_text="e.g., incidents, repairs, treatmentlog, inspection")
    entity_id = models.PositiveIntegerField()
    timestamp = models.DateTimeField(auto_now_add=True)
    metadata = models.JSONField(
        null=True, 
        blank=True,
        help_text="Stores before/after values, IP address, user agent, etc."
    )

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['entity', 'entity_id']),
            models.Index(fields=['user', 'timestamp']),
        ]

    def __str__(self):
        return f"{self.user} {self.action} {self.entity}#{self.entity_id} at {self.timestamp}"
    
    # --- EXHAUSTER MANAGEMENT MODELS ---


class Exhauster(models.Model):
    """
    Model to track exhauster trucks/vehicles used for sludge collection.
    """
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('suspended', 'Suspended')
    ]
    
    reg_no = models.CharField(max_length=50, unique=True, help_text="Unique registration number")
    owner = models.CharField(max_length=200, help_text="Owner name or company")
    capacity_m3 = models.DecimalField(max_digits=6, decimal_places=2, help_text="Capacity in cubic meters")
    contact = models.CharField(max_length=100, blank=True, help_text="Contact information")
    date_registered = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['reg_no']
        indexes = [
            models.Index(fields=['reg_no']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.reg_no} - {self.owner}"
class ExhausterLicense(models.Model):
    """
    Operating permits/licenses tied to exhauster vehicles.
    """
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('expired', 'Expired'),
        ('revoked', 'Revoked'),
    ]

    exhauster = models.ForeignKey(
        Exhauster,
        on_delete=models.CASCADE,
        related_name='licenses'
    )
    license_no = models.CharField(max_length=100, blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    fee_paid = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-end_date']
        indexes = [
            models.Index(fields=['exhauster', 'status']),
            models.Index(fields=['license_no']),
        ]

    def __str__(self):
        return f"License {self.license_no} for {self.exhauster.reg_no}"
class SludgeCollection(models.Model):
    """
    Model for sludge collection manifests tracking waste movement from source to disposal.
    """
    SOURCE_CHOICES = [
        ('residential', 'Residential'),
        ('institutional', 'Institutional'),
        ('commercial', 'Commercial/Industrial')
    ]
    
    MANIFEST_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('received', 'Received'),
        ('rejected', 'Rejected'),
    ]

    # Collection details
    collection_date = models.DateField()
    source_type = models.CharField(max_length=50, choices=SOURCE_CHOICES)
    source_name = models.CharField(max_length=255, blank=True, help_text="Name of establishment/residence")
    area_ward = models.CharField(max_length=200, blank=True, help_text="Location/Ward")
    toilets_present = models.BooleanField(default=False, help_text="Whether toilets were present at source")
    driver_name = models.CharField(max_length=200, blank=True, help_text="Name of the exhauster driver")

    # Waste details
    volume_m3 = models.DecimalField(max_digits=8, decimal_places=3, help_text="Volume collected in cubic meters")
    number_of_users = models.PositiveIntegerField(null=True, blank=True, help_text="Number of users served")
    last_emptying_date = models.DateField(null=True, blank=True, help_text="Date of last emptying (if known)")
    waste_description = models.TextField(blank=True, help_text="Description of waste characteristics")

    # Chain of custody
    exhauster = models.ForeignKey(
        Exhauster,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='collections'
    )
    exhauster_driver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='collections_driven'
    )
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='collections_received'
    )
    received_at = models.DateTimeField(null=True, blank=True)
    receiving_notes = models.TextField(blank=True, help_text="Notes from receiving officer")
    rejection_reason = models.TextField(blank=True)

    # Status and tracking
    manifest_status = models.CharField(
        max_length=20,
        choices=MANIFEST_STATUS_CHOICES,
        default='pending'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-collection_date', '-created_at']
        indexes = [
            models.Index(fields=['collection_date']),
            models.Index(fields=['manifest_status']),
            models.Index(fields=['exhauster', 'collection_date']),
        ]

    def __str__(self):
        return f"Collection #{self.id} - {self.source_name} ({self.volume_m3}m³)"

# --- TREATMENT LOG MODELS ---
class TreatmentLog(models.Model):
    """
    Daily treatment plant operational log with parameters and alerts.
    """
    report_date = models.DateField()
    operator = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True,
        related_name='treatment_logs'
    )
    shift = models.CharField(max_length=50, blank=True)
    operational_notes = models.TextField(blank=True)
    alert = models.BooleanField(
        default=False, 
        help_text="Flagged if parameters exceed regulatory thresholds"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-report_date', '-created_at']

    def __str__(self):
        return f"Treatment Log #{self.id} - {self.report_date} ({'ALERT' if self.alert else 'Normal'})"
class TreatmentParameter(models.Model):
    """
    Individual parameters measured during treatment log entries.
    """
    tlog = models.ForeignKey(
        TreatmentLog, 
        on_delete=models.CASCADE, 
        related_name='parameters'
    )
    parameter = models.CharField(
        max_length=100,
        help_text="e.g., Flow Rate, pH, BOD, TSS, etc."
    )
    influent_value = models.DecimalField(
        max_digits=10, 
        decimal_places=3, 
        null=True, 
        blank=True
    )
    influent_time = models.TimeField(null=True, blank=True)
    effluent_value = models.DecimalField(
        max_digits=10, 
        decimal_places=3, 
        null=True, 
        blank=True
    )
    effluent_time = models.TimeField(null=True, blank=True)
    removal_percent = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        null=True, 
        blank=True,
        help_text="Calculated efficiency: (influent - effluent)/influent * 100"
    )
    remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['parameter']

    def __str__(self):
        return f"{self.parameter} - {self.removal_percent}% removal"

    def save(self, *args, **kwargs):
        """
        Auto-calculate removal_percent if both influent and effluent values exist.
        """
        if self.influent_value and self.effluent_value and self.influent_value != 0:
            self.removal_percent = (
                (self.influent_value - self.effluent_value) / self.influent_value * 100
            )
        super().save(*args, **kwargs)


# --- NEW SEWER CONNECTION MODELS ---

class ConnectionReport(models.Model):
    """
    Parent model to group connection applications by ward and reporting period.
    """
    WARD_CHOICES = [
        ('kerugoya', 'Kerugoya'),
        ('kutus', 'Kutus'),
        ('sagana', 'Sagana'),
    ]

    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    
    prepared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='prepared_connection_reports'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-start_date']

    def __str__(self):
        return f"Connection Report ({self.start_date})"


class ConnectionApplication(models.Model):
    """
    Child model for individual connection applications within a report.
    """
    CONNECTION_TYPES = [
        ('residential', 'Residential'),
        ('commercial', 'Commercial'),
        ('institutional', 'Institutional'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('completed', 'Completed'),
    ]

    WARD_CHOICES = [
        ('kerugoya', 'Kerugoya'),
        ('kutus', 'Kutus'),
        ('sagana', 'Sagana'),
    ]

    report = models.ForeignKey(
        ConnectionReport, 
        on_delete=models.CASCADE, 
        related_name='applications'
    )
    ward = models.CharField(max_length=50, choices=WARD_CHOICES, blank=True)
    application_date = models.DateField()
    applicant_name = models.CharField(max_length=255)
    id_no = models.CharField(max_length=100, help_text="ID or Passport Number")
    location = models.CharField(max_length=255)
    connection_type = models.CharField(max_length=50, choices=CONNECTION_TYPES, default='residential')
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='pending')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.applicant_name} - {self.get_connection_type_display()}"


# --- NEW: F201 WEEKLY LINE PATROLS ---

class SewerLineSection(models.Model):
    code = models.CharField(max_length=50, unique=True)
    is_confirmed = models.BooleanField(default=False)

    def __str__(self):
        return self.code


class WeeklyLinePatrol(models.Model):
    date = models.DateField()
    week_number = models.PositiveSmallIntegerField(default=0)
    drainage_area = models.CharField(max_length=200)
    attendant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='patrols')
    status = models.CharField(
        max_length=20,
        choices=[('submitted', 'Submitted'), ('verified', 'Verified')],
        default='submitted'
    )
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_patrols'
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"Patrol {self.date} — {self.drainage_area}"


class PatrolRow(models.Model):
    ABNORMALITY_CHOICES = [
        ('none', 'None'),
        ('erosion', 'Erosion along lines'),
        ('missing_cover', 'Broken/Missing Manhole Cover'),
        ('blockage', 'Blockage'),
        ('overflow', 'Overflow/Spillage'),
        ('other', 'Other (Specify in remarks)')
    ]

    weekly_patrol = models.ForeignKey(WeeklyLinePatrol, on_delete=models.CASCADE, related_name='rows')
    time = models.TimeField()
    sewer_line_section = models.ForeignKey(SewerLineSection, on_delete=models.PROTECT, related_name='patrol_rows')
    sewer_line_ref_text = models.CharField(max_length=100)
    abnormality_observed = models.CharField(max_length=50, choices=ABNORMALITY_CHOICES, default='none')
    abnormality_details = models.TextField(blank=True, help_text="Specify if 'Other' or add details")
    new_mother_connections = models.PositiveIntegerField(default=0)
    new_child_connections = models.PositiveIntegerField(default=0)
    immediate_action_taken = models.TextField(blank=True)
    further_action_required = models.TextField(blank=True)
    incident_created = models.ForeignKey(
        'Incident',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='patrol_rows'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['time', 'id']

    def __str__(self):
        return f"Row {self.id} — {self.sewer_line_section.code} at {self.time}"


# --- NEW: F203A INLET WORKS (SCREENS & GRIT) ---
class InletWorksDailyTask(models.Model):
    date = models.DateField()
    attendant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='inlet_tasks')
    
    # Raking Screenings (T1, T2, T3 represents time shifts)
    raking_t1 = models.BooleanField(default=False)
    raking_t2 = models.BooleanField(default=False)
    raking_t3 = models.BooleanField(default=False)

    t1_grit_buried = models.BooleanField(default=False)
    t2_screenings_buried = models.BooleanField(default=False)
    shift_notes = models.TextField(blank=True)
    
    screenings_burial = models.BooleanField(default=False)
    grit_scooping = models.BooleanField(default=False)
    grit_burial = models.BooleanField(default=False)
    
    abnormalities = models.TextField(blank=True)
    operator_signature = models.ImageField(upload_to='signatures/inlet/', null=True, blank=True)

    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='submitted_inlet_tasks'
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=[('submitted', 'Submitted'), ('verified', 'Verified')],
        default='submitted'
    )
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_inlet_tasks'
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    incident_created = models.ForeignKey(
        'Incident',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='f203a_tasks'
    )


# --- NEW: F203C INLET WORKS (FLOW MEASUREMENT) ---
class DailyFlowRecord(models.Model):
    date = models.DateField(unique=True)
    attendants = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='flow_records')
    remarks = models.TextField(blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=[('submitted', 'Submitted'), ('verified', 'Verified')],
        default='submitted'
    )
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_flow_records'
    )
    verified_at = models.DateTimeField(null=True, blank=True)

    @property
    def average_daily_flow(self):
        """
        Q5 assumed: rate meters (m3/hr).
        Formula: arithmetic mean of per-slot averages * 24 = daily volume (m3).
        """
        readings = self.readings.all()
        if not readings:
            return None

        slot_avgs = []
        for reading in readings:
            vals = [v for v in [reading.meter_1, reading.meter_2] if v is not None]
            if vals:
                slot_avgs.append(sum(vals) / len(vals))

        if not slot_avgs:
            return None

        return round((sum(slot_avgs) / len(slot_avgs)) * 24, 3)

class FlowReading(models.Model):
    TIME_CHOICES = [
        ('09:00', '9:00 AM'),
        ('12:00', '12:00 PM'),
        ('15:00', '3:00 PM'),
        ('18:00', '6:00 PM'),
    ]
    daily_record = models.ForeignKey(DailyFlowRecord, on_delete=models.CASCADE, related_name='readings')
    time_slot = models.CharField(max_length=10, choices=TIME_CHOICES)
    meter_1 = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    meter_2 = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        unique_together = ('daily_record', 'time_slot')


# --- NEW: F203B DAILY LAB RECORDS ---
class DailyLabRecord(models.Model):
    """
    Daily laboratory analysis results for the treatment plant.
    Supports partial entry — fields are nullable to allow progressive fill-in.
    Frequency guide: D=daily, 2W=twice weekly, W=weekly, M=monthly
    """
    record_date = models.DateField(unique=True)
    attendant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='lab_records'
    )

    # Influent (Inflow) Parameters — D
    inflow_ph = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    inflow_temperature = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    inflow_tss = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='mg/L — D')
    inflow_bod = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='mg/L — 2W')
    inflow_cod = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='mg/L — W')
    inflow_tn = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='Total Nitrogen mg/L — M')
    inflow_tp = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='Total Phosphorus mg/L — M')
    inflow_fc = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, help_text='Fecal Coliforms CFU/100mL — W')

    # Effluent (Outflow) Parameters — same frequencies as inflow
    effluent_ph = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    effluent_temperature = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    effluent_tss = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='mg/L — D')
    effluent_bod = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='mg/L — 2W')
    effluent_cod = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='mg/L — W')
    effluent_tn = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='Total Nitrogen mg/L — M')
    effluent_tp = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='Total Phosphorus mg/L — M')
    effluent_fc = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, help_text='Fecal Coliforms CFU/100mL — W')
    effluent_turbidity = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='NTU — D')
    effluent_chlorine = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True, help_text='mg/L — D')
    effluent_do = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True, help_text='Dissolved Oxygen mg/L — D')

    # Volume / Operations
    volume_treated_m3 = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    sludge_volume_m3 = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)

    # Notes
    remarks = models.TextField(blank=True)

    # Verification
    status = models.CharField(
        max_length=20,
        choices=[('submitted', 'Submitted'), ('verified', 'Verified')],
        default='submitted'
    )
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_lab_records'
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-record_date']
        indexes = [
            models.Index(fields=['record_date']),
            models.Index(fields=['status']),
        ]

    @property
    def bod_removal_efficiency(self):
        if self.inflow_bod and self.effluent_bod and self.inflow_bod > 0:
            return round(float((self.inflow_bod - self.effluent_bod) / self.inflow_bod * 100), 1)
        return None

    @property
    def tss_removal_efficiency(self):
        if self.inflow_tss and self.effluent_tss and self.inflow_tss > 0:
            return round(float((self.inflow_tss - self.effluent_tss) / self.inflow_tss * 100), 1)
        return None

    @property
    def is_bod_exceedance(self):
        if self.effluent_bod is not None:
            from django.conf import settings as _s
            return float(self.effluent_bod) > _s.NEMA_BOD_DISCHARGE_LIMIT_MG_L
        return None

    @property
    def is_tss_exceedance(self):
        if self.effluent_tss is not None:
            from django.conf import settings as _s
            return float(self.effluent_tss) > _s.NEMA_TSS_DISCHARGE_LIMIT_MG_L
        return None

    def __str__(self):
        return f"Lab Record {self.record_date}"


# --- MONTHLY SUMMARY SNAPSHOT LOCK ---
class MonthlySummarySnapshot(models.Model):
    """
    Once locked by the STP Superintendent, the summary is frozen.
    The SummaryViewSet serves snapshot_data instead of live aggregation.
    """
    year = models.PositiveSmallIntegerField()
    month = models.PositiveSmallIntegerField()
    is_locked = models.BooleanField(default=False)
    locked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='locked_snapshots'
    )
    locked_at = models.DateTimeField(null=True, blank=True)
    snapshot_data = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('year', 'month')
        ordering = ['-year', '-month']

    def __str__(self):
        return f"Snapshot {self.year}-{str(self.month).zfill(2)} ({'LOCKED' if self.is_locked else 'open'})"


# --- ANAEROBIC POND OPERATIONS ---

class TreatmentPond(models.Model):
    """Lookup table for anaerobic ponds at the STP site."""
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100)
    capacity_m3 = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['code']

    def __str__(self):
        return f"{self.code} — {self.name}"


class PondDailyLog(models.Model):
    """
    Daily operational log per pond with 3-level sign-off:
      submitted → cosigned_op → verified
    """
    POND_LOG_STATUS = [
        ('submitted', 'Submitted'),
        ('cosigned_op', 'Co-signed by Operator'),
        ('verified', 'Verified by Supervisor'),
    ]

    pond = models.ForeignKey(TreatmentPond, on_delete=models.PROTECT, related_name='daily_logs')
    log_date = models.DateField()
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='pond_logs_submitted'
    )

    # Observations
    ph = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    temperature = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    do_level = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True, help_text='Dissolved Oxygen mg/L')
    surface_scum = models.BooleanField(default=False)
    odour_complaint = models.BooleanField(default=False)
    colour = models.CharField(max_length=50, blank=True)
    remarks = models.TextField(blank=True)

    # Sign-off chain
    status = models.CharField(max_length=20, choices=POND_LOG_STATUS, default='submitted')

    cosigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='pond_logs_cosigned'
    )
    cosigned_at = models.DateTimeField(null=True, blank=True)

    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='pond_logs_verified'
    )
    verified_at = models.DateTimeField(null=True, blank=True)

    # Escalation bridge
    incident_created = models.ForeignKey(
        'Incident', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='pond_logs'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-log_date', 'pond__code']
        unique_together = ('pond', 'log_date')
        indexes = [
            models.Index(fields=['log_date']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"Pond Log {self.pond.code} — {self.log_date}"


class PondYearlyTask(models.Model):
    """Annual maintenance tasks associated with a pond."""
    TASK_STATUS = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('deferred', 'Deferred'),
    ]

    pond = models.ForeignKey(TreatmentPond, on_delete=models.PROTECT, related_name='yearly_tasks')
    year = models.PositiveSmallIntegerField()
    task_name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=TASK_STATUS, default='pending')
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='pond_yearly_tasks'
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['year', 'pond__code', 'due_date']

    def __str__(self):
        return f"{self.pond.code} — {self.task_name} ({self.year})"
