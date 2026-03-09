from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings


class User(AbstractUser):
    """
    Custom User model extending Django's built-in AbstractUser.
    This allows us to implement Role-Based Access Control (RBAC) for the system.
    """
    ROLE_CHOICES = [
        ('technician', 'Technician'),
        ('operator', 'Operator'),
        ('inspector', 'Inspector'),
        ('driver', 'Driver'),
        ('supervisor', 'Supervisor'),
        ('admin', 'Admin'),
    ]

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='technician')

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"


# --- NEW EXHAUSTER MANAGEMENT MODELS ---

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


class License(models.Model):
    """
    Operating permits/licenses tied to exhauster vehicles.
    """
    STATUS_CHOICES = [
        ('valid', 'Valid'),
        ('expired', 'Expired'),
        ('suspended', 'Suspended'),
        ('pending', 'Pending Renewal')
    ]
    
    exhauster = models.ForeignKey(
        Exhauster, 
        on_delete=models.CASCADE, 
        related_name='licenses'
    )
    license_no = models.CharField(max_length=100, blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='valid')
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
        ('completed', 'Completed')
    ]
    
    # Collection details
    collection_date = models.DateField()
    source_type = models.CharField(max_length=50, choices=SOURCE_CHOICES)
    source_name = models.CharField(max_length=255, blank=True, help_text="Name of establishment/residence")
    area_ward = models.CharField(max_length=200, blank=True, help_text="Location/Ward")
    toilets_present = models.BooleanField(default=False, help_text="Whether toilets were present at source")
    
    # Waste details
    volume_m3 = models.DecimalField(max_digits=8, decimal_places=3, help_text="Volume collected in cubic meters")
    users = models.PositiveIntegerField(null=True, blank=True, help_text="Number of users served")
    last_emptied = models.DateField(null=True, blank=True, help_text="Date of last emptying (if known)")
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
    receiving_officer = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='collections_received'
    )
    receiving_notes = models.TextField(blank=True, help_text="Notes from receiving officer")
    
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


# --- EXISTING INSPECTION MODELS (unchanged below this line) ---

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


# --- EXISTING TREATMENT LOG MODELS (unchanged) ---

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


# --- EXISTING INCIDENT MANAGEMENT MODELS (unchanged) ---

class Incident(models.Model):
    """
    Model to capture field incidents (blockages, spills, odors)
    and create an auditable tracking record.
    """
    INCIDENT_STATUS = [
        ('new', 'New'),
        ('assigned', 'Assigned'),
        ('in_progress', 'In Progress'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
    ]

    # Core Incident Data
    reported_at = models.DateTimeField()
    location_text = models.CharField(max_length=255, blank=True)

    reported_by_name = models.CharField(max_length=200)
    reported_contact = models.CharField(max_length=100, blank=True)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=INCIDENT_STATUS, default='new')

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

    def __str__(self):
        return f"Incident #{self.id} - {self.location_text} ({self.get_status_display()})"


# --- EXISTING REPAIR MANAGEMENT MODELS (unchanged) ---

class Repair(models.Model):
    """
    Model for repair completion certificates linked to incidents.
    """
    incident = models.ForeignKey(
        Incident,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='repairs'
    )
    completion_date = models.DateField()
    location = models.CharField(max_length=255)
    description_of_work = models.TextField()
    materials_used = models.TextField(blank=True)
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
    certified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-completion_date', '-created_at']

    def __str__(self):
        return f"Repair #{self.id} - {self.location} ({self.completion_date})"


# --- EXISTING SUPPORTING MODELS (unchanged) ---

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