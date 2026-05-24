import datetime

from django.utils import timezone
from rest_framework import serializers
from .models import (
    RepairAttempt, Attachment, Inspection, InspectionEntry, 
    TreatmentLog, TreatmentParameter, Incident, User,
    Exhauster, ExhausterLicense, SludgeCollection, ConnectionReport, ConnectionApplication,
    SewerLineSection, PatrolRow, WeeklyLinePatrol, InletWorksDailyTask,
    DailyFlowRecord, FlowReading, DailyLabRecord,
    TreatmentPond, PondDailyLog, PondYearlyTask,
    Zone, SewerLine, Notification, LabComplianceFlag, TeamMembership, FieldMonthlyReport,
)
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Customizes the JWT payload to include user roles and details,
    allowing the React frontend to enforce Role-Based Access Control (RBAC).
    """
    def validate(self, attrs):
        username = attrs.get(self.username_field)
        if isinstance(username, str):
            normalized_username = username.strip()
            if normalized_username:
                try:
                    matched_username = User.objects.filter(
                        username__iexact=normalized_username
                    ).values_list('username', flat=True).first()
                    attrs[self.username_field] = matched_username or normalized_username
                except Exception:
                    # Fallback to provided username if DB lookup fails
                    attrs[self.username_field] = normalized_username

        return super().validate(attrs)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Add custom claims
        token['username'] = user.username
        token['role'] = user.role
        token['full_name'] = user.full_name
        token['company_id'] = user.company_id
        token['company_name'] = user.company.name if user.company else ''
        token['company_code'] = user.company.code if user.company else ''
        token['company_email'] = user.company.email if user.company else ''
        token['company_phone'] = user.company.phone if user.company else ''
        token['company_website'] = user.company.website if user.company else ''
        token['company_address'] = user.company.address if user.company else ''
        
        return token


# --- ATTACHMENT SERIALIZER ---

class AttachmentSerializer(serializers.ModelSerializer):
    uploaded_by = serializers.ReadOnlyField(source='uploaded_by.username')
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = ['id', 'file', 'file_url', 'content_type', 'object_id', 'uploaded_by', 'uploaded_at']
        read_only_fields = ['uploaded_at']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None


# --- INSPECTION SERIALIZERS ---

class InspectionEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = InspectionEntry
        fields = ['id', 'date', 'section_identifier', 'length_m', 'condition', 'remarks', 'action']


class InspectionSerializer(serializers.ModelSerializer):
    entries = InspectionEntrySerializer(many=True)
    inspector_name = serializers.ReadOnlyField(source='inspector.get_full_name')
    entry_count = serializers.IntegerField(source='entries.count', read_only=True)

    class Meta:
        model = Inspection
        fields = [
            'id', 'start_date', 'end_date', 'inspector', 'inspector_name',
            'notes', 'entries', 'entry_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def create(self, validated_data):
        entries_data = validated_data.pop('entries', [])
        inspection = Inspection.objects.create(**validated_data)
        
        for entry_data in entries_data:
            InspectionEntry.objects.create(inspection=inspection, **entry_data)
            # Future enhancement: If entry.condition == 'major', trigger a signal to auto-create an Incident here.
            
        return inspection

    def update(self, instance, validated_data):
        entries_data = validated_data.pop('entries', None)
        
        # Update inspection fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Handle entries update if provided
        if entries_data is not None:
            # Remove old entries and create new ones (simplified approach)
            instance.entries.all().delete()
            for entry_data in entries_data:
                InspectionEntry.objects.create(inspection=instance, **entry_data)

        return instance


# --- TREATMENT LOG SERIALIZERS ---

class TreatmentParameterSerializer(serializers.ModelSerializer):
    class Meta:
        model = TreatmentParameter
        fields = [
            'id', 'parameter', 'influent_value', 'influent_time',
            'effluent_value', 'effluent_time', 'removal_percent', 'remarks'
        ]
        read_only_fields = ['removal_percent']  # Computed server-side

    def validate(self, data):
        """Server-side domain validation"""
        param_name = data.get('parameter', '').lower()
        influent = data.get('influent_value')
        effluent = data.get('effluent_value')

        # pH Validation: Must be strictly between 0 and 14
        if param_name == 'ph':
            if influent is not None and not (0 <= influent <= 14):
                raise serializers.ValidationError({"influent_value": "pH must be between 0 and 14."})
            if effluent is not None and not (0 <= effluent <= 14):
                raise serializers.ValidationError({"effluent_value": "pH must be between 0 and 14."})
        
        # Temperature validation (if applicable)
        if param_name == 'temperature' or param_name == 'temp':
            if influent is not None and (influent < -10 or influent > 50):
                raise serializers.ValidationError({"influent_value": "Temperature seems unrealistic (-10°C to 50°C)."})
            if effluent is not None and (effluent < -10 or effluent > 50):
                raise serializers.ValidationError({"effluent_value": "Temperature seems unrealistic (-10°C to 50°C)."})
        
        return data


class TreatmentLogSerializer(serializers.ModelSerializer):
    parameters = TreatmentParameterSerializer(many=True)
    operator_name = serializers.ReadOnlyField(source='operator.get_full_name')
    reviewed_by_name = serializers.ReadOnlyField(source='reviewed_by.get_full_name')
    parameter_count = serializers.IntegerField(source='parameters.count', read_only=True)

    class Meta:
        model = TreatmentLog
        fields = [
            'id', 'report_date', 'operator', 'operator_name', 'shift',
            'operational_notes', 'alert', 'parameters', 'parameter_count',
            'review_status', 'supervisor_comment', 'correction_note',
            'reviewed_by', 'reviewed_by_name', 'reviewed_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'alert', 'reviewed_by', 'reviewed_by_name', 'reviewed_at',
            'created_at', 'updated_at',
        ]

    def create(self, validated_data):
        parameters_data = validated_data.pop('parameters', [])
        tlog = TreatmentLog.objects.create(**validated_data)
        
        has_alert = False
        alert_details = []

        for param_data in parameters_data:
            influent = param_data.get('influent_value')
            effluent = param_data.get('effluent_value')
            param_name = param_data.get('parameter', '').lower()

            # 1. Compute Removal Percentage if both values exist
            if influent is not None and effluent is not None and influent > 0:
                # Formula: ((influent_value - effluent_value) / influent_value) * 100
                removal = ((influent - effluent) / influent) * 100
                param_data['removal_percent'] = round(removal, 2)

            # 2. Check Regulatory Thresholds for Alerts
            # (Adjust these limits to KICOWASCO's specific regulatory limits)
            if param_name == 'ph':
                if effluent is not None and (effluent < 6.5 or effluent > 9.0):
                    has_alert = True
                    alert_details.append(f"pH {effluent} outside range (6.5-9.0)")
            elif param_name in ['bod', 'cod']:
                # Example: If effluent BOD/COD exceeds 30 mg/l
                if effluent is not None and effluent > 30.0:
                    has_alert = True
                    alert_details.append(f"{param_name.upper()} {effluent} > 30.0")
            elif param_name == 'tss':
                # Total Suspended Solids threshold
                if effluent is not None and effluent > 50.0:
                    has_alert = True
                    alert_details.append(f"TSS {effluent} > 50.0")
            elif param_name == 'turbidity':
                # Turbidity threshold (NTU)
                if effluent is not None and effluent > 5.0:
                    has_alert = True
                    alert_details.append(f"Turbidity {effluent} > 5.0 NTU")
            elif param_name == 'chlorine' or param_name == 'cl2':
                # Chlorine residual threshold (mg/L)
                if effluent is not None and (effluent < 0.2 or effluent > 4.0):
                    has_alert = True
                    alert_details.append(f"Chlorine {effluent} outside range (0.2-4.0)")

            TreatmentParameter.objects.create(tlog=tlog, **param_data)
        
        # If any parameter triggered an alert, update the parent log
        if has_alert:
            tlog.alert = True
            tlog.save()
            # Store alert details in operational notes if needed
            if alert_details:
                tlog.operational_notes = (tlog.operational_notes or '') + f"\nALERT: {', '.join(alert_details)}"
                tlog.save()
            
            # Future enhancement: Trigger an email or notification to the supervisor here

        return tlog

    def update(self, instance, validated_data):
        parameters_data = validated_data.pop('parameters', None)
        
        # Update treatment log fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Handle parameters update if provided
        if parameters_data is not None:
            # Remove old parameters and create new ones (simplified approach)
            instance.parameters.all().delete()
            for param_data in parameters_data:
                TreatmentParameter.objects.create(tlog=instance, **param_data)
            
            # Recalculate alert status
            has_alert = False
            for param in instance.parameters.all():
                if self._check_alert_threshold(param):
                    has_alert = True
                    break
            instance.alert = has_alert
            instance.save()

        return instance

    def _check_alert_threshold(self, param):
        """Helper method to check if a parameter triggers an alert"""
        param_name = param.parameter.lower()
        effluent = param.effluent_value
        
        if effluent is None:
            return False
            
        if param_name == 'ph':
            return effluent < 6.5 or effluent > 9.0
        elif param_name in ['bod', 'cod']:
            return effluent > 30.0
        elif param_name == 'tss':
            return effluent > 50.0
        elif param_name == 'turbidity':
            return effluent > 5.0
        elif param_name in ['chlorine', 'cl2']:
            return effluent < 0.2 or effluent > 4.0
        return False


# --- EXHAUSTER MANAGEMENT SERIALIZERS ---

class ExhausterLicenseSerializer(serializers.ModelSerializer):
    """
    Serializer for Exhauster licenses with date validation.
    """
    class Meta:
        model = ExhausterLicense
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

    def validate(self, data):
        """
        Ensure license dates are logically valid:
        - End date must be after start date
        - License cannot overlap with existing active licenses for the same exhauster
        """
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        exhauster = data.get('exhauster')

        # Rule 1: End date must be after start date
        if start_date and end_date and end_date <= start_date:
            raise serializers.ValidationError(
                {"end_date": "License end date must be after the start date."}
            )

        # Rule 2: Check for overlapping licenses (if this is a new license or updating)
        if exhauster and start_date and end_date:
            instance = self.instance
            overlapping = ExhausterLicense.objects.filter(
                exhauster=exhauster,
                start_date__lte=end_date,
                end_date__gte=start_date
            )
            if instance:
                overlapping = overlapping.exclude(pk=instance.pk)

            if overlapping.exists():
                raise serializers.ValidationError(
                    "This license overlaps with an existing license for this exhauster."
                )

        return data


class ExhausterSerializer(serializers.ModelSerializer):
    """
    Serializer for Exhauster vehicles with nested licenses.
    """
    licenses = ExhausterLicenseSerializer(many=True, read_only=True)
    current_license = serializers.SerializerMethodField()
    has_valid_license = serializers.SerializerMethodField()

    class Meta:
        model = Exhauster
        fields = [
            'id', 'reg_no', 'owner', 'capacity_m3',
            'contact', 'date_registered', 'status', 'licenses',
            'current_license', 'has_valid_license', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def validate_capacity_m3(self, value):
        if value <= 0:
            raise serializers.ValidationError("Capacity must be greater than zero.")
        return value

    def validate_reg_no(self, value):
        if value and len(value) < 3:
            raise serializers.ValidationError("Registration number must be at least 3 characters.")
        return value.upper()

    def get_current_license(self, obj):
        current = obj.licenses.filter(
            start_date__lte=timezone.now().date(),
            end_date__gte=timezone.now().date()
        ).first()
        if current:
            return ExhausterLicenseSerializer(current).data
        return None

    def get_has_valid_license(self, obj):
        today = timezone.now().date()
        return obj.licenses.filter(
            start_date__lte=today,
            end_date__gte=today,
            status='active'
        ).exists()


class ExhausterStatusSerializer(serializers.ModelSerializer):
    """
    Simplified serializer for updating only the status of an exhauster.
    """
    class Meta:
        model = Exhauster
        fields = ['id', 'status', 'updated_at']
        read_only_fields = ['updated_at']


LicenseSerializer = ExhausterLicenseSerializer


# --- SLUDGE COLLECTION SERIALIZERS ---

class SludgeCollectionSerializer(serializers.ModelSerializer):
    """
    Serializer for sludge collection manifests.
    """
    exhauster_reg_no = serializers.ReadOnlyField(source='exhauster.reg_no')
    received_by_name = serializers.ReadOnlyField(source='received_by.get_full_name')
    entered_by_name = serializers.ReadOnlyField(source='entered_by.get_full_name')
    rejected_by_name = serializers.ReadOnlyField(source='rejected_by.get_full_name')

    class Meta:
        model = SludgeCollection
        fields = '__all__'
        read_only_fields = [
            'created_at', 'updated_at',
            'received_by', 'received_at',
            'entered_by',
            'rejection_reason', 'manifest_status',
            'rejected_by', 'rejected_at',
        ]

    def validate_volume_m3(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Volume must be greater than zero.")
        return value


class SludgeCollectionSummarySerializer(serializers.Serializer):
    """
    Serializer for sludge collection summary statistics.
    """
    total_collections = serializers.IntegerField()
    total_volume = serializers.FloatField()
    average_volume = serializers.FloatField()
    by_exhauster = serializers.DictField(child=serializers.FloatField())
    by_site = serializers.DictField(child=serializers.FloatField())
    by_month = serializers.DictField(child=serializers.FloatField())


class RepairAttemptSerializer(serializers.ModelSerializer):
    attendant_name = serializers.ReadOnlyField(source='attendant.get_full_name')
    incident_details = serializers.SerializerMethodField()
    attachments = AttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = RepairAttempt
        fields = [
            'id', 'incident', 'incident_details', 'attempt_number',
            'work_performed', 'materials_used', 'attendant', 'attendant_name',
            'submitted_at', 'attachments',
        ]
        read_only_fields = ['attempt_number', 'submitted_at']

    def get_incident_details(self, obj):
        if obj.incident:
            return {
                'id': obj.incident.id,
                'location': obj.incident.location_text,
                'status': obj.incident.status
            }
        return None


# --- INCIDENT SERIALIZER ---

class IncidentSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.ReadOnlyField(source='assigned_to.get_full_name')
    created_by_name = serializers.ReadOnlyField(source='created_by.get_full_name')
    certified_by_name = serializers.ReadOnlyField(source='certified_by.get_full_name')
    zone_name = serializers.ReadOnlyField(source='zone.name')
    duplicate_of_number = serializers.ReadOnlyField(source='duplicate_of.incident_number')
    repair_attempts = RepairAttemptSerializer(many=True, read_only=True)
    attachments = AttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Incident
        fields = [
            'id', 'incident_number', 'reported_at', 'location_text', 'latitude', 'longitude',
            'assisting_crew', 'category', 'severity', 'reported_by_name',
            'system_suggested_severity', 'final_severity', 'override_reason',
            'reported_contact', 'description', 'status',
            'duplicate_of', 'duplicate_of_number', 'rejection_reason',
            'assigned_to', 'assigned_to_name', 'received_by', 'received_date',
            'foreman_signed_by', 'foreman_signature_image', 'created_by',
            'source_module', 'source_reference_id',
            'zone', 'zone_name', 'related_incident',
            'assigned_at', 'in_progress_at', 'resolved_at',
            'completed_at', 'certified_by', 'certified_by_name', 'certified_at',
            'assignment_instructions', 'revision_reason',
            'created_by_name', 'created_at', 'updated_at', 'repair_attempts', 'attachments',
        ]
        read_only_fields = [
            'incident_number', 'duplicate_of', 'duplicate_of_number',
            'rejection_reason', 'created_at', 'updated_at', 'zone_name', 'certified_by_name',
            'assigned_to_name', 'created_by_name',
        ]

    def validate(self, attrs):
        suggested = attrs.get('system_suggested_severity', getattr(self.instance, 'system_suggested_severity', None))
        final = attrs.get('final_severity', attrs.get('severity', getattr(self.instance, 'final_severity', None)))
        override_reason = (attrs.get('override_reason', getattr(self.instance, 'override_reason', '')) or '').strip()
        if final and suggested and final != suggested and not override_reason:
            raise serializers.ValidationError({'override_reason': 'Override reason is required when final severity differs from suggested severity.'})
        if final:
            attrs['severity'] = final
            attrs['final_severity'] = final
        elif 'severity' in attrs:
            attrs['final_severity'] = attrs['severity']
        return attrs


# --- USER SERIALIZER ---

class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField(source='get_full_name')
    company_name = serializers.ReadOnlyField(source='company.name')
    company_code = serializers.ReadOnlyField(source='company.code')
    assigned_tasks_count = serializers.IntegerField(read_only=True)
    assigned_zone_names = serializers.SerializerMethodField()
    supervisor_name = serializers.SerializerMethodField()
    supervisor_phone_number = serializers.SerializerMethodField()
    team_members = serializers.SerializerMethodField()

    def get_assigned_zone_names(self, obj):
        return [zone.name for zone in obj.assigned_zones.all()]

    def get_supervisor_name(self, obj):
        if obj.role != 'line_attendant':
            return None
        active_membership = obj.team_memberships.filter(assigned_to__isnull=True).select_related('supervisor').first()
        return active_membership.supervisor.full_name if active_membership and active_membership.supervisor else None

    def get_supervisor_phone_number(self, obj):
        if obj.role != 'line_attendant':
            return None
        active_membership = obj.team_memberships.filter(assigned_to__isnull=True).select_related('supervisor').first()
        return active_membership.supervisor.phone_number if active_membership and active_membership.supervisor else None

    def get_team_members(self, obj):
        if obj.role != 'line_supervisor':
            return []
        thirty_days_ago = timezone.now() - datetime.timedelta(days=30)
        members = []
        memberships = obj.supervised_attendants.filter(assigned_to__isnull=True).select_related('attendant', 'zone')
        for membership in memberships:
            attendant = membership.attendant
            active_count = Incident.objects.filter(assigned_to=attendant, status__in=['assigned', 'in_progress', 'revision_required']).count()
            resolved_incidents = Incident.objects.filter(
                assigned_to=attendant,
                assigned_at__isnull=False,
                completed_at__isnull=False,
                completed_at__gte=thirty_days_ago,
            )
            durations = [incident.resolution_time_minutes for incident in resolved_incidents if incident.resolution_time_minutes is not None]
            members.append({
                'id': attendant.id,
                'full_name': attendant.full_name,
                'assigned_zones': [z.name for z in attendant.assigned_zones.all()],
                'active_task_count': active_count,
                'avg_resolution_minutes_30d': int(sum(durations) / len(durations)) if durations else None,
                'membership_zone': membership.zone.name if membership.zone else None,
            })
        return members
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'phone_number', 'employee_id', 'first_name', 'last_name', 'full_name', 'role', 'company', 'company_name', 'company_code', 'assigned_tasks_count', 'assigned_zone_names', 'supervisor_name', 'supervisor_phone_number', 'team_members']
        read_only_fields = ['id', 'username', 'full_name', 'company_name', 'company_code', 'role', 'company']


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Extended user profile serializer with additional information.
    """
    full_name = serializers.ReadOnlyField(source='get_full_name')
    initials = serializers.SerializerMethodField()
    company_name = serializers.ReadOnlyField(source='company.name')
    company_code = serializers.ReadOnlyField(source='company.code')
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 
            'full_name', 'initials', 'role', 'company', 'company_name', 'company_code', 'date_joined', 'last_login'
        ]
        read_only_fields = ['date_joined', 'last_login']
    
    def get_initials(self, obj):
        first = obj.first_name[0] if obj.first_name else ''
        last = obj.last_name[0] if obj.last_name else ''
        return (first + last).upper() or obj.username[0].upper()


# --- SEWER CONNECTION SERIALIZERS ---

class ConnectionApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConnectionApplication
        exclude = ('report',)  # Will be linked automatically

class ConnectionReportSerializer(serializers.ModelSerializer):
    applications = ConnectionApplicationSerializer(many=True)

    class Meta:
        model = ConnectionReport
        fields = '__all__'
        read_only_fields = ('prepared_by', 'created_at', 'updated_at')

    def create(self, validated_data):
        # Extract the nested applications array
        applications_data = validated_data.pop('applications', [])
        
        # Assign the currently logged-in user
        request = self.context.get('request', None)
        if request and hasattr(request, "user"):
            validated_data['prepared_by'] = request.user
            
        # Create the parent report
        report = ConnectionReport.objects.create(**validated_data)
        
        # Create all the child applications
        for app_data in applications_data:
            ConnectionApplication.objects.create(report=report, **app_data)
            
        return report

# --- F201: WEEKLY LINE PATROLS ---

class SewerLineSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SewerLineSection
        fields = ['id', 'code', 'is_confirmed']


class PatrolRowSerializer(serializers.ModelSerializer):
    section_code = serializers.ReadOnlyField(source='sewer_line_section.code')
    section_is_confirmed = serializers.ReadOnlyField(source='sewer_line_section.is_confirmed')
    incident_id = serializers.ReadOnlyField(source='incident_created.id')
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = PatrolRow
        fields = [
            'id', 'time', 'sewer_line', 'sewer_line_section', 'section_code', 'section_is_confirmed',
            'sewer_line_ref_text', 'sewer_line_ref_manual', 'is_manual_entry', 'abnormality_observed', 'abnormality_details',
            'new_main_connections', 'new_branch_connections',
            'immediate_action_taken', 'further_action_required',
            'photo', 'photo_url',
            'incident_created', 'incident_id', 'created_at',
        ]
        read_only_fields = ['incident_created', 'incident_id', 'created_at', 'photo_url']

    def get_photo_url(self, obj):
        """Return absolute URL for photo if it exists."""
        request = self.context.get('request')
        if obj.photo and request:
            return request.build_absolute_uri(obj.photo.url)
        return None

    def update(self, instance, validated_data):
        if instance.incident_created_id:
            validated_data.pop('further_action_required', None)
        return super().update(instance, validated_data)


class WeeklyLinePatrolSerializer(serializers.ModelSerializer):
    attendant_name = serializers.ReadOnlyField(source='attendant.get_full_name')
    verified_by_name = serializers.ReadOnlyField(source='verified_by.get_full_name')
    zone_name = serializers.ReadOnlyField(source='zone.name')
    rows = PatrolRowSerializer(many=True)

    class Meta:
        model = WeeklyLinePatrol
        fields = [
            'id', 'date', 'week_number', 'zone', 'zone_name', 'attendant', 'attendant_name',
            'status', 'verified_by', 'verified_by_name', 'verified_at',
            'rows', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at', 'week_number', 'verified_by', 'verified_at']

    def create(self, validated_data):
        rows_data = validated_data.pop('rows', [])
        request = self.context.get('request', None)
        if request and hasattr(request, 'user') and 'attendant' not in validated_data:
            validated_data['attendant'] = request.user
        date = validated_data.get('date')
        if date and not validated_data.get('week_number'):
            validated_data['week_number'] = date.isocalendar()[1]
        patrol = WeeklyLinePatrol.objects.create(**validated_data)
        for row_data in rows_data:
            PatrolRow.objects.create(weekly_patrol=patrol, **row_data)
        return patrol

    def update(self, instance, validated_data):
        rows_data = validated_data.pop('rows', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if rows_data is not None:
            instance.rows.all().delete()
            for row_data in rows_data:
                PatrolRow.objects.create(weekly_patrol=instance, **row_data)
        return instance


# --- F203A: INLET WORKS DAILY TASKS ---

class InletWorksDailyTaskSerializer(serializers.ModelSerializer):
    attendant_name = serializers.ReadOnlyField(source='attendant.get_full_name')
    incident_number = serializers.ReadOnlyField(source='incident_created.incident_number')

    class Meta:
        model = InletWorksDailyTask
        fields = '__all__'
        read_only_fields = ['submitted_at', 'verified_by', 'verified_at', 'incident_created']

    def create(self, validated_data):
        request = self.context.get('request', None)
        if request and hasattr(request, 'user'):
            validated_data.setdefault('attendant', request.user)
            validated_data.setdefault('submitted_by', request.user)
        return super().create(validated_data)

    def validate(self, attrs):
        task_reason_map = {
            'raking_t1': 'raking_t1_reason',
            'raking_t2': 'raking_t2_reason',
            'raking_t3': 'raking_t3_reason',
            'screenings_burial': 'screenings_burial_reason',
            'grit_scooping': 'grit_scooping_reason',
            'grit_burial': 'grit_burial_reason',
        }
        errors = {}
        for task_field, reason_field in task_reason_map.items():
            task_value = attrs.get(task_field, getattr(self.instance, task_field, None) if self.instance else None)
            reason_value = attrs.get(reason_field, getattr(self.instance, reason_field, '') if self.instance else '')
            if task_value is False and not str(reason_value or '').strip():
                errors[reason_field] = 'This reason is required when the task is marked not performed.'
        if errors:
            raise serializers.ValidationError(errors)
        return attrs


# --- F203C: INLET WORKS FLOW MEASUREMENT ---

class FlowReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = FlowReading
        fields = ['id', 'time_slot', 'meter_1', 'meter_2']

class DailyFlowRecordSerializer(serializers.ModelSerializer):
    readings = FlowReadingSerializer(many=True)
    average_daily_flow = serializers.ReadOnlyField()
    operator_note = serializers.CharField(required=False, allow_blank=True)
    supervisor_note = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = DailyFlowRecord
        fields = [
            'id', 'date', 'remarks', 'readings', 'average_daily_flow',
            'submitted_at', 'operator_note', 'supervisor_note'
        ]
        read_only_fields = ['average_daily_flow', 'submitted_at']

    def create(self, validated_data):
        readings_data = validated_data.pop('readings', [])
        
        # Create the parent record
        flow_record = DailyFlowRecord.objects.create(**validated_data)
        
        # Add the logged in user to the M2M attendants list
        request = self.context.get('request', None)
        if request and hasattr(request, "user"):
            flow_record.attendants.add(request.user)

        # Create nested readings
        for reading_data in readings_data:
            FlowReading.objects.create(daily_record=flow_record, **reading_data)
            
        return flow_record

    def update(self, instance, validated_data):
        readings_data = validated_data.pop('readings', None)
        
        # Update parent fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Handle nested readings
        if readings_data is not None:
            instance.readings.all().delete()
            for reading_data in readings_data:
                FlowReading.objects.create(daily_record=instance, **reading_data)

        return instance


# --- F203B: DAILY LAB RECORDS ---

LAB_PARAM_FIELDS = [
    'inflow_volume_m3', 'inflow_ph', 'inflow_bod', 'inflow_cod', 'inflow_tss',
    'inflow_temperature', 'inflow_do', 'inflow_turbidity', 'inflow_conductivity',
    'inflow_nitrates', 'inflow_phosphates', 'inflow_tn', 'inflow_tp', 'inflow_fc',
    'effluent_volume_m3', 'effluent_ph', 'effluent_bod', 'effluent_cod', 'effluent_tss',
    'effluent_temperature', 'effluent_do', 'effluent_turbidity', 'effluent_conductivity',
    'effluent_nitrates', 'effluent_phosphates', 'effluent_tn', 'effluent_tp', 'effluent_fc',
    'effluent_ecoli', 'effluent_total_coliforms',
    'effluent_chlorine',
    'volume_treated_m3', 'sludge_volume_m3',
]


class DailyLabRecordSerializer(serializers.ModelSerializer):
    attendant_name = serializers.ReadOnlyField(source='attendant.get_full_name')
    verified_by_name = serializers.ReadOnlyField(source='verified_by.get_full_name')
    bod_removal_efficiency = serializers.ReadOnlyField()
    tss_removal_efficiency = serializers.ReadOnlyField()
    bod_efficiency_band = serializers.ReadOnlyField()
    tss_efficiency_band = serializers.ReadOnlyField()
    is_bod_exceedance = serializers.ReadOnlyField()
    is_tss_exceedance = serializers.ReadOnlyField()

    class Meta:
        model = DailyLabRecord
        fields = [
            'id', 'record_date', 'attendant', 'attendant_name', 'remarks',
            'status', 'verified_by', 'verified_by_name', 'verified_at',
            'retest_requested', 'retest_note',
            'bod_removal_efficiency', 'tss_removal_efficiency',
            'bod_efficiency_band', 'tss_efficiency_band',
            'is_bod_exceedance', 'is_tss_exceedance',
            'created_at', 'updated_at',
        ] + LAB_PARAM_FIELDS
        read_only_fields = [
            'status', 'verified_by', 'verified_by_name', 'verified_at',
            'retest_requested',
            'bod_removal_efficiency', 'tss_removal_efficiency',
            'is_bod_exceedance', 'is_tss_exceedance',
            'created_at', 'updated_at',
        ]

    def update(self, instance, validated_data):
        for field in LAB_PARAM_FIELDS:
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        for attr in ('attendant', 'remarks', 'record_date'):
            if attr in validated_data:
                setattr(instance, attr, validated_data[attr])
        instance.save()
        return instance


class LabComplianceFlagSerializer(serializers.ModelSerializer):
    lab_record_date = serializers.ReadOnlyField(source='lab_record.record_date')
    corrected_by_name = serializers.ReadOnlyField(source='corrected_by.get_full_name')
    acknowledged_by_name = serializers.ReadOnlyField(source='acknowledged_by.get_full_name')
    escalated_by_name = serializers.ReadOnlyField(source='escalated_by.get_full_name')

    class Meta:
        model = LabComplianceFlag
        fields = [
            'id', 'lab_record', 'lab_record_date',
            'parameter_key', 'measured_value', 'threshold_value', 'threshold_mode',
            'severity', 'status', 'notes',
            'corrective_action', 'corrective_action_at', 'corrected_by', 'corrected_by_name',
            'acknowledged_by', 'acknowledged_by_name', 'acknowledged_at',
            'escalated_by', 'escalated_by_name', 'escalated_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'corrected_by', 'corrected_by_name', 'corrective_action_at',
            'acknowledged_by', 'acknowledged_by_name', 'acknowledged_at',
            'escalated_by', 'escalated_by_name', 'escalated_at',
            'created_at', 'updated_at',
        ]


# --- ANAEROBIC POND OPERATIONS ---

class TreatmentPondSerializer(serializers.ModelSerializer):
    class Meta:
        model = TreatmentPond
        fields = ['id', 'code', 'name', 'capacity_m3', 'frequency', 'is_active']


class PondDailyLogSerializer(serializers.ModelSerializer):
    submitted_by_name = serializers.ReadOnlyField(source='submitted_by.get_full_name')
    cosigned_by_name = serializers.ReadOnlyField(source='cosigned_by.get_full_name')
    verified_by_name = serializers.ReadOnlyField(source='verified_by.get_full_name')
    pond_code = serializers.ReadOnlyField(source='pond.code')
    pond_frequency = serializers.ReadOnlyField(source='pond.frequency')
    incident_number = serializers.ReadOnlyField(source='incident_created.incident_number')

    class Meta:
        model = PondDailyLog
        fields = [
            'id', 'pond', 'pond_code', 'pond_frequency', 'log_date',
            'submitted_by', 'submitted_by_name',
            'ph', 'temperature', 'do_level',
            'surface_scum', 'odour_complaint', 'colour', 'remarks',
            'daily_inspection_done',
            'valves_hand_stops_ok', 'inspection_incidences', 'spillage_incidences',
            'new_mother_connections', 'new_child_connections', 'repairs_completed',
            'bod_incidences', 'exhauster_volume_m3', 'effluent_volume_m3',
            'yearly_desludging', 'yearly_rust_removal', 'yearly_painting',
            'yearly_grease_paint_valves', 'intermittent_grass_cutting', 'intermittent_floating_material',
            'status',
            'cosigned_by', 'cosigned_by_name', 'cosigned_at',
            'verified_by', 'verified_by_name', 'verified_at',
            'incident_created', 'incident_number',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'status', 'cosigned_by', 'cosigned_by_name', 'cosigned_at',
            'verified_by', 'verified_by_name', 'verified_at',
            'incident_created', 'incident_number',
            'created_at', 'updated_at',
        ]


class PondYearlyTaskSerializer(serializers.ModelSerializer):
    pond_code = serializers.ReadOnlyField(source='pond.code')
    assigned_name = serializers.ReadOnlyField(source='assigned_to.get_full_name')

    class Meta:
        model = PondYearlyTask
        fields = [
            'id', 'pond', 'pond_code', 'year', 'task_name', 'description',
            'due_date', 'status', 'assigned_to', 'assigned_name',
            'completed_at', 'notes', 'created_at',
        ]
        read_only_fields = ['created_at']


# --- ZONE SERIALIZER (Section 3.1) ---

class ZoneSerializer(serializers.ModelSerializer):
    """Serializer for Zone/drainage area model."""
    
    class Meta:
        model = Zone
        fields = ['id', 'name', 'zone_code', 'description', 'min_lat', 'max_lat', 'min_lon', 'max_lon', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


# --- SEWER LINE SERIALIZER (Section 3.2) ---

class SewerLineSerializer(serializers.ModelSerializer):
    """Serializer for SewerLine asset registry."""
    zone_name = serializers.ReadOnlyField(source='zone.name')
    
    class Meta:
        model = SewerLine
        fields = [
            'id', 'reference_code', 'zone', 'zone_name', 'description',
            'start_point', 'end_point', 'pipe_material', 'diameter_mm',
            'length_m', 'installation_date', 'patrol_frequency_per_month', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class TeamMembershipSerializer(serializers.ModelSerializer):
    supervisor_name = serializers.ReadOnlyField(source='supervisor.full_name')
    attendant_name = serializers.ReadOnlyField(source='attendant.full_name')
    zone_name = serializers.ReadOnlyField(source='zone.name')

    class Meta:
        model = TeamMembership
        fields = ['id', 'supervisor', 'supervisor_name', 'attendant', 'attendant_name', 'zone', 'zone_name', 'assigned_from', 'assigned_to', 'is_active']
        read_only_fields = ['assigned_from', 'is_active']


class FieldMonthlyReportSerializer(serializers.ModelSerializer):
    supervisor_name = serializers.ReadOnlyField(source='supervisor.full_name')
    acknowledged_by_name = serializers.ReadOnlyField(source='acknowledged_by.full_name')

    class Meta:
        model = FieldMonthlyReport
        fields = [
            'id', 'month', 'year', 'supervisor', 'supervisor_name', 'supervisor_notes',
            'status', 'submitted_at', 'acknowledged_by', 'acknowledged_by_name', 'acknowledged_at'
        ]


# --- NOTIFICATION SERIALIZER (Section 2) ---

class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for user notifications with read status tracking."""
    recipient_username = serializers.ReadOnlyField(source='recipient.username')
    incident_reference = serializers.ReadOnlyField(source='related_incident.incident_number')
    
    class Meta:
        model = Notification
        fields = [
            'id', 'recipient', 'recipient_username', 'title', 'message',
            'notification_type', 'is_read', 'link_url', 'related_incident',
            'incident_reference', 'created_at', 'read_at'
        ]
        read_only_fields = ['recipient', 'created_at']
    
    def update(self, instance, validated_data):
        """Handle marking notification as read."""
        if validated_data.get('is_read') and not instance.is_read:
            # Mark as read with timestamp
            instance.is_read = True
            instance.read_at = timezone.now()
        instance.save()
        return instance