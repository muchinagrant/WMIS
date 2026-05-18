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
        ('stp_attendant', 'STP Attendant (Grade 6)'),
        ('line_supervisor', 'Line Supervisor (Grade 4)'),
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
    # FCM token for push notifications
    fcm_token = models.TextField(blank=True, null=True, help_text="Firebase Cloud Messaging token for push notifications")
    phone_number = models.CharField(max_length=20, blank=True, help_text="User's phone number for notifications")
    
    # Assigned zones/areas for line_attendant
    assigned_zones = models.ManyToManyField('Zone', blank=True, related_name='assigned_attendants', help_text="Zones assigned to this line attendant")

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
    
    # Zone assignment (Section 3.1)
    zone = models.ForeignKey(
        'Zone',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='incidents',
        help_text="Zone/drainage area where the incident occurred"
    )
    
    # Related incident linkage (Section 3.4)
    related_incident = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='linked_incidents',
        help_text="Link to a previous incident at the same or related location"
    )
    
    # Assignment metadata (Section 3.5)
    completed_at = models.DateTimeField(null=True, blank=True, help_text="When the incident repair was completed")
    certified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='certified_incidents',
        help_text="Supervisor who certified the repair"
    )
    certified_at = models.DateTimeField(null=True, blank=True, help_text="When the repair was certified")
    
    # Assignment instructions (Section 6.3)
    assignment_instructions = models.TextField(blank=True, help_text="Additional notes from supervisor during assignment")

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
    
    @property
    def resolution_time_minutes(self):
        """Calculate resolution time in minutes (Section 3.5)."""
        if self.assigned_at and self.completed_at:
            delta = self.completed_at - self.assigned_at
            return int(delta.total_seconds() / 60)
        return None


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
        ('approved', 'Approved'),
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
    entered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='collections_entered',
        help_text='Authenticated user who entered the driver/origin section.'
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
    rejected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='collections_rejected'
    )
    rejected_at = models.DateTimeField(null=True, blank=True)

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
    review_status = models.CharField(
        max_length=30,
        choices=[
            ('pending_review', 'Pending Supervisor Review'),
            ('correction_requested', 'Correction Requested'),
            ('supervisor_approved', 'Supervisor Approved'),
        ],
        default='pending_review',
    )
    supervisor_comment = models.TextField(blank=True)
    correction_note = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='treatment_logs_reviewed',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
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
    """Model for F201 Weekly Line Patrol with zone-based organization (Section 5)."""
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('submitted', 'Submitted'),
        ('verified', 'Verified'),
    ]
    
    date = models.DateField()
    week_number = models.PositiveSmallIntegerField(default=0)
    zone = models.ForeignKey(
        'Zone',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='patrols',
        help_text="Zone/drainage area for this patrol"
    )
    attendant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='patrols')
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft',
        help_text="draft=not notified, submitted=supervisor notified, verified=supervisor reviewed"
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
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date']
        indexes = [
            models.Index(fields=['zone', 'status']),
            models.Index(fields=['attendant', '-date']),
        ]

    def __str__(self):
        zone_name = self.zone.name if self.zone else "Unknown Zone"
        return f"Patrol {self.date} — {zone_name}"


class PatrolRow(models.Model):
    """Individual patrol row within a weekly patrol log (Section 5)."""
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
    abnormality_details = models.TextField(blank=True, help_text="Specify if 'Other' or add details (Section 5.4)")
    new_main_connections = models.PositiveIntegerField(default=0, help_text="New main connection found (Section 5.2)")
    new_branch_connections = models.PositiveIntegerField(default=0, help_text="New branch connection found (Section 5.2)")
    immediate_action_taken = models.TextField(blank=True)
    further_action_required = models.TextField(blank=True, help_text="Actions needed (Section 5.4 - hidden if empty)")
    photo = models.ImageField(
        upload_to='patrol_photos/',
        null=True,
        blank=True,
        help_text="Optional photo attachment per row (Section 5.6)"
    )
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

    raking_t1_reason = models.TextField(blank=True)
    raking_t2_reason = models.TextField(blank=True)
    raking_t3_reason = models.TextField(blank=True)
    screenings_burial_reason = models.TextField(blank=True)
    grit_scooping_reason = models.TextField(blank=True)
    grit_burial_reason = models.TextField(blank=True)
    
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
        choices=[
            ('draft', 'Draft'),
            ('pending_operator', 'Pending Operator Co-sign'),
            ('returned', 'Returned for Correction'),
            ('fully_signed', 'Fully Signed')
        ],
        default='draft'
    )
    correction_note = models.TextField(blank=True)
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
    operator_note = models.TextField(blank=True)
    supervisor_note = models.TextField(blank=True)

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
    inflow_volume_m3 = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    inflow_tss = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='mg/L — D')
    inflow_bod = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='mg/L — 2W')
    inflow_cod = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='mg/L — W')
    inflow_do = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True, help_text='Dissolved Oxygen mg/L')
    inflow_turbidity = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='NTU')
    inflow_conductivity = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text='uS/cm')
    inflow_nitrates = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='Nitrates mg/L')
    inflow_phosphates = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='Phosphates mg/L')
    inflow_tn = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='Total Nitrogen mg/L — M')
    inflow_tp = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='Total Phosphorus mg/L — M')
    inflow_fc = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, help_text='Fecal Coliforms CFU/100mL — W')

    # Effluent (Outflow) Parameters — same frequencies as inflow
    effluent_ph = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    effluent_temperature = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    effluent_volume_m3 = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    effluent_tss = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='mg/L — D')
    effluent_bod = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='mg/L — 2W')
    effluent_cod = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='mg/L — W')
    effluent_conductivity = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text='uS/cm')
    effluent_nitrates = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='Nitrates mg/L')
    effluent_phosphates = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='Phosphates mg/L')
    effluent_tn = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='Total Nitrogen mg/L — M')
    effluent_tp = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='Total Phosphorus mg/L — M')
    effluent_fc = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, help_text='Fecal Coliforms MPN/100mL — W')
    effluent_ecoli = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, help_text='E.coli CFU/100mL')
    effluent_total_coliforms = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, help_text='Total Coliforms MPN/100mL')
    effluent_turbidity = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='NTU — D')
    effluent_chlorine = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True, help_text='mg/L — D')
    effluent_do = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True, help_text='Dissolved Oxygen mg/L — D')

    # Volume / Operations
    volume_treated_m3 = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    sludge_volume_m3 = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)

    # Notes
    remarks = models.TextField(blank=True)

    bod_removal_efficiency = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    tss_removal_efficiency = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)

    # Verification
    status = models.CharField(
        max_length=20,
        choices=[
            ('draft', 'Draft'),
            ('pending_operator', 'Pending Operator Co-sign'),
            ('returned', 'Returned for Correction'),
            ('fully_signed', 'Fully Signed')
        ],
        default='draft'
    )
    correction_note = models.TextField(blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_lab_records'
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    retest_requested = models.BooleanField(default=False)
    retest_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-record_date']
        indexes = [
            models.Index(fields=['record_date']),
            models.Index(fields=['status']),
        ]

    def _calculate_efficiency(self, influent, effluent):
        if influent is None or effluent is None:
            return None
        if float(influent) <= 0:
            return None
        return round(float((influent - effluent) / influent * 100), 2)

    def _apply_efficiency_calculations(self):
        self.bod_removal_efficiency = self._calculate_efficiency(self.inflow_bod, self.effluent_bod)
        self.tss_removal_efficiency = self._calculate_efficiency(self.inflow_tss, self.effluent_tss)

    @property
    def bod_efficiency_band(self):
        if self.bod_removal_efficiency is None:
            return None
        from django.conf import settings as _s
        val = float(self.bod_removal_efficiency)
        if val < _s.BOD_REMOVAL_RED_THRESHOLD:
            return 'red'
        if val < _s.BOD_REMOVAL_AMBER_THRESHOLD:
            return 'amber'
        return 'green'

    @property
    def tss_efficiency_band(self):
        if self.tss_removal_efficiency is None:
            return None
        from django.conf import settings as _s
        val = float(self.tss_removal_efficiency)
        if val < _s.TSS_REMOVAL_RED_THRESHOLD:
            return 'red'
        if val < _s.TSS_REMOVAL_AMBER_THRESHOLD:
            return 'amber'
        return 'green'

    def effluent_limit_breaches(self):
        from django.conf import settings as _s
        breaches = []
        if self.effluent_bod is not None and float(self.effluent_bod) > _s.NEMA_BOD_DISCHARGE_LIMIT_MG_L:
            breaches.append(('effluent_bod', float(self.effluent_bod), _s.NEMA_BOD_DISCHARGE_LIMIT_MG_L, 'max'))
        if self.effluent_tss is not None and float(self.effluent_tss) > _s.NEMA_TSS_DISCHARGE_LIMIT_MG_L:
            breaches.append(('effluent_tss', float(self.effluent_tss), _s.NEMA_TSS_DISCHARGE_LIMIT_MG_L, 'max'))
        if self.effluent_turbidity is not None and float(self.effluent_turbidity) > _s.NEMA_TURBIDITY_LIMIT_NTU:
            breaches.append(('effluent_turbidity', float(self.effluent_turbidity), _s.NEMA_TURBIDITY_LIMIT_NTU, 'max'))
        if self.effluent_ph is not None and float(self.effluent_ph) < _s.EFFLUENT_PH_MIN:
            breaches.append(('effluent_ph', float(self.effluent_ph), _s.EFFLUENT_PH_MIN, 'min'))
        if self.effluent_ph is not None and float(self.effluent_ph) > _s.EFFLUENT_PH_MAX:
            breaches.append(('effluent_ph', float(self.effluent_ph), _s.EFFLUENT_PH_MAX, 'max'))
        if self.effluent_do is not None and float(self.effluent_do) < _s.EFFLUENT_DO_MIN_MG_L:
            breaches.append(('effluent_do', float(self.effluent_do), _s.EFFLUENT_DO_MIN_MG_L, 'min'))
        if self.effluent_fc is not None and float(self.effluent_fc) > _s.EFFLUENT_FECAL_COLIFORMS_LIMIT_MPN_100ML:
            breaches.append(('effluent_fc', float(self.effluent_fc), _s.EFFLUENT_FECAL_COLIFORMS_LIMIT_MPN_100ML, 'max'))
        if self.effluent_ecoli is not None and float(self.effluent_ecoli) > _s.EFFLUENT_ECOLI_LIMIT_CFU_100ML:
            breaches.append(('effluent_ecoli', float(self.effluent_ecoli), _s.EFFLUENT_ECOLI_LIMIT_CFU_100ML, 'max'))
        if self.effluent_total_coliforms is not None and float(self.effluent_total_coliforms) > _s.EFFLUENT_TOTAL_COLIFORMS_LIMIT_MPN_100ML:
            breaches.append(('effluent_total_coliforms', float(self.effluent_total_coliforms), _s.EFFLUENT_TOTAL_COLIFORMS_LIMIT_MPN_100ML, 'max'))
        return breaches

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

    def save(self, *args, **kwargs):
        self._apply_efficiency_calculations()
        super().save(*args, **kwargs)

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
    supervisor_draft_notes = models.TextField(
        blank=True,
        help_text='Plant-level notes compiled by STP Supervisor before superintendent lock.',
    )
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
    FREQUENCY_CHOICES = [
        ('daily', 'Daily'),
        ('twice_weekly', 'Twice Weekly (Mon/Wed/Fri)'),
        ('weekly', 'Weekly (Friday)'),
        ('monthly', 'Monthly'),
    ]
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100)
    capacity_m3 = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES, default='daily')
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
        ('draft', 'Draft'),
        ('pending_second_sign', 'Pending Second Sign'),
        ('pending_supervisor', 'Pending Supervisor Sign'),
        ('fully_signed', 'Fully Signed'),
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

    YN_CHOICES = [('Y', 'Yes'), ('N', 'No')]
    daily_inspection_done = models.BooleanField(default=False, help_text='Inspect ponds and record abnormalities')
    valves_hand_stops_ok = models.BooleanField(null=True, blank=True)
    inspection_incidences = models.PositiveSmallIntegerField(null=True, blank=True)
    spillage_incidences = models.PositiveSmallIntegerField(null=True, blank=True)
    new_mother_connections = models.PositiveSmallIntegerField(null=True, blank=True)
    new_child_connections = models.PositiveSmallIntegerField(null=True, blank=True)
    repairs_completed = models.PositiveSmallIntegerField(null=True, blank=True)
    bod_incidences = models.PositiveSmallIntegerField(null=True, blank=True)
    exhauster_volume_m3 = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    effluent_volume_m3 = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    yearly_desludging = models.CharField(max_length=1, choices=YN_CHOICES, blank=True)
    yearly_rust_removal = models.CharField(max_length=1, choices=YN_CHOICES, blank=True)
    yearly_painting = models.CharField(max_length=1, choices=YN_CHOICES, blank=True)
    yearly_grease_paint_valves = models.CharField(max_length=1, choices=YN_CHOICES, blank=True)
    intermittent_grass_cutting = models.CharField(max_length=1, choices=YN_CHOICES, blank=True)
    intermittent_floating_material = models.CharField(max_length=1, choices=YN_CHOICES, blank=True)

    # Sign-off chain
    status = models.CharField(max_length=20, choices=POND_LOG_STATUS, default='draft')

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


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 3 & 2 BACKEND ADDITIONS: 'Zone', SewerLine, Notification Models
# ─────────────────────────────────────────────────────────────────────────────

# --- ZONE / DRAINAGE AREA MODEL ---
class Zone(models.Model):
    """Zone or drainage area for organizing sewer lines and incident management."""
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return self.name


# --- SEWER LINE ASSET REGISTRY ---
class SewerLine(models.Model):
    """Registry of sewer lines/pipes in the system."""
    MATERIAL_CHOICES = [
        ('pvc', 'PVC'),
        ('ac', 'Asbestos Cement (AC)'),
        ('hdpe', 'HDPE'),
        ('ductile_iron', 'Ductile Iron'),
        ('concrete', 'Concrete'),
        ('earthenware', 'Earthenware'),
        ('other', 'Other'),
    ]

    reference_code = models.CharField(max_length=50, unique=True, help_text="e.g., SL-104")
    zone = models.ForeignKey('Zone', on_delete=models.PROTECT, related_name='sewer_lines')
    description = models.TextField(blank=True)
    start_point = models.CharField(max_length=255, blank=True, help_text="Starting manhole or location")
    end_point = models.CharField(max_length=255, blank=True, help_text="Ending manhole or location")
    pipe_material = models.CharField(max_length=50, choices=MATERIAL_CHOICES, blank=True)
    diameter_mm = models.PositiveIntegerField(null=True, blank=True, help_text="Pipe diameter in millimeters")
    length_m = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Length in meters")
    installation_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['zone', 'reference_code']
        indexes = [
            models.Index(fields=['zone', 'is_active']),
            models.Index(fields=['reference_code']),
        ]

    def __str__(self):
        return f"{self.reference_code} — {self.description or self.zone.name}"


# --- NOTIFICATION MODEL ---
class Notification(models.Model):
    """Model to store in-app notifications for users."""
    NOTIFICATION_TYPES = [
        ('general', 'General'),
        ('task_assigned', 'Task Assigned'),
        ('task_completed', 'Task Completed'),
        ('incident_critical', 'Critical Incident'),
        ('patrol_submitted', 'Patrol Log Submitted'),
        ('approval', 'Approval Request'),
        ('system', 'System Alert'),
    ]

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(
        max_length=50,
        choices=NOTIFICATION_TYPES,
        default='general'
    )
    is_read = models.BooleanField(default=False)
    link_url = models.CharField(max_length=500, blank=True, help_text="URL to navigate to when clicked")
    related_incident = models.ForeignKey(
        Incident,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['recipient', '-created_at']),
        ]

    def __str__(self):
        return f"Notification for {self.recipient.username}: {self.title}"
    
    def mark_as_read(self):
        """Mark this notification as read."""
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])


class LabComplianceFlag(models.Model):
    SEVERITY_CHOICES = [
        ('amber', 'Amber'),
        ('red', 'Red'),
    ]
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('resolved', 'Resolved'),
        ('acknowledged', 'Acknowledged'),
        ('escalated', 'Escalated to Superintendent'),
    ]

    lab_record = models.ForeignKey(DailyLabRecord, on_delete=models.CASCADE, related_name='compliance_flags')
    parameter_key = models.CharField(max_length=80)
    measured_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    threshold_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    threshold_mode = models.CharField(max_length=8, choices=[('min', 'Min'), ('max', 'Max')], default='max')
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    notes = models.TextField(blank=True)

    corrective_action = models.TextField(blank=True)
    corrective_action_at = models.DateTimeField(null=True, blank=True)
    corrected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_lab_flags'
    )
    acknowledged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='acknowledged_lab_flags'
    )
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    escalated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='escalated_lab_flags'
    )
    escalated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['severity', 'status']),
            models.Index(fields=['parameter_key']),
        ]

    def __str__(self):
        return f"Flag {self.parameter_key} ({self.severity}) on {self.lab_record.record_date}"
