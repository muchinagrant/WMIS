from rest_framework import serializers
from .models import (
    Repair, Attachment, Inspection, InspectionEntry, 
    TreatmentLog, TreatmentParameter, Incident, User,
    Exhauster, License, SludgeCollection
)


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
    parameter_count = serializers.IntegerField(source='parameters.count', read_only=True)

    class Meta:
        model = TreatmentLog
        fields = [
            'id', 'report_date', 'operator', 'operator_name', 'shift',
            'operational_notes', 'alert', 'parameters', 'parameter_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['alert', 'created_at', 'updated_at']  # Computed server-side

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

class LicenseSerializer(serializers.ModelSerializer):
    """
    Serializer for Exhauster licenses with date validation.
    """
    is_active = serializers.BooleanField(read_only=True)
    days_until_expiry = serializers.IntegerField(read_only=True)

    class Meta:
        model = License
        fields = [
            'id', 'exhauster', 'license_number', 'start_date', 'end_date',
            'is_active', 'days_until_expiry', 'created_at', 'updated_at'
        ]
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
            overlapping = License.objects.filter(
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
    Serializer for Exhauster vehicles with nested licenses and business validation.
    """
    # Read-only nested licenses so the frontend can easily see if an exhauster is currently licensed
    licenses = LicenseSerializer(many=True, read_only=True)
    current_license = serializers.SerializerMethodField()
    owner_name = serializers.ReadOnlyField(source='owner.get_full_name')
    
    class Meta:
        model = Exhauster
        fields = [
            'id', 'reg_no', 'owner', 'owner_name', 'capacity_m3', 
            'contact', 'date_registered', 'status', 'licenses', 
            'current_license', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def validate_capacity_m3(self, value):
        """Ensure capacity is positive and within reasonable range"""
        if value <= 0:
            raise serializers.ValidationError("Capacity must be greater than zero.")
        if value > 100:  # Sanity check: 100m³ is very large for an exhauster
            raise serializers.ValidationError(
                "Capacity seems unusually high. Please verify."
            )
        return value
    
    def validate_reg_no(self, value):
        """Validate registration number format (example: Kxx xxxx)"""
        if value and len(value) < 3:
            raise serializers.ValidationError(
                "Registration number must be at least 3 characters."
            )
        # Add more specific validation based on your country's format
        return value.upper()
    
    def get_current_license(self, obj):
        """Get the currently active license for this exhauster"""
        current = obj.licenses.filter(
            start_date__lte=obj.get_current_date(),
            end_date__gte=obj.get_current_date()
        ).first()
        if current:
            return LicenseSerializer(current).data
        return None


class ExhausterStatusSerializer(serializers.ModelSerializer):
    """
    Simplified serializer for updating only the status of an exhauster.
    """
    class Meta:
        model = Exhauster
        fields = ['id', 'status', 'updated_at']
        read_only_fields = ['updated_at']


# --- SLUDGE COLLECTION SERIALIZERS ---

class SludgeCollectionSerializer(serializers.ModelSerializer):
    """
    Serializer for sludge collection manifests with volume validation.
    """
    exhauster_reg_no = serializers.ReadOnlyField(source='exhauster.reg_no')
    driver_name = serializers.ReadOnlyField(source='driver.get_full_name')
    site_name = serializers.ReadOnlyField(source='site.name')
    
    class Meta:
        model = SludgeCollection
        fields = [
            'id', 'exhauster', 'exhauster_reg_no', 'driver', 'driver_name',
            'site', 'site_name', 'collection_date', 'volume_m3',
            'discharge_point', 'manifest_number', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def validate_volume_m3(self, value):
        """Ensure volume is positive"""
        if value is not None and value <= 0:
            raise serializers.ValidationError("Volume must be greater than zero.")
        return value

    def validate(self, data):
        """
        Server-side domain validation for sludge manifests:
        - Volume must be positive
        - Volume shouldn't exceed exhauster capacity by too much (data entry check)
        """
        volume = data.get('volume_m3')
        exhauster = data.get('exhauster')

        # Rule 1: Volume must be positive (already handled by validate_volume_m3)
        
        # Rule 2: Volume shouldn't strictly exceed the registered exhauster's capacity 
        # by a massive margin to prevent data entry errors.
        if volume and exhauster:
            # Allowing a 50% buffer for compression/estimation errors
            if volume > (exhauster.capacity_m3 * 1.5):
                raise serializers.ValidationError({
                    "volume_m3": (
                        f"Reported volume ({volume}m³) suspiciously exceeds "
                        f"exhauster capacity ({exhauster.capacity_m3}m³). "
                        f"Maximum allowed with buffer is {exhauster.capacity_m3 * 1.5}m³."
                    )
                })
            
            # Optional: Warning if volume is too low (possible partial load)
            if volume < (exhauster.capacity_m3 * 0.1):
                # This could be a warning instead of an error
                data['_partial_load_warning'] = True

        # Rule 3: Check if exhauster has valid license for collection date
        collection_date = data.get('collection_date')
        if exhauster and collection_date:
            has_valid_license = exhauster.licenses.filter(
                start_date__lte=collection_date,
                end_date__gte=collection_date
            ).exists()
            
            if not has_valid_license:
                raise serializers.ValidationError(
                    f"Exhauster {exhauster.reg_no} does not have a valid license "
                    f"for the collection date {collection_date}."
                )

        return data


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


# --- REPAIR SERIALIZERS ---

class RepairSerializer(serializers.ModelSerializer):
    technician_name = serializers.ReadOnlyField(source='technician.get_full_name')
    supervisor_name = serializers.ReadOnlyField(source='supervisor.get_full_name')
    incident_details = serializers.SerializerMethodField()
    attachments = AttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Repair
        fields = [
            'id', 'incident', 'incident_details', 'completion_date', 'location',
            'description_of_work', 'materials_used', 'technician',
            'technician_name', 'supervisor', 'supervisor_name',
            'supervisor_signature', 'certified_at', 'created_at', 'updated_at',
            'attachments'
        ]
        # These fields should only be set via the specialized 'certify' endpoint
        read_only_fields = ['supervisor', 'supervisor_signature', 'certified_at', 'created_at', 'updated_at']

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
    repairs = RepairSerializer(many=True, read_only=True)
    attachments = AttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Incident
        fields = [
            'id', 'reported_at', 'location_text', 'reported_by_name',
            'reported_contact', 'description', 'status', 'assigned_to',
            'assigned_to_name', 'received_by', 'received_date',
            'foreman_signed_by', 'foreman_signature_image', 'created_by',
            'created_by_name', 'created_at', 'updated_at', 'repairs',
            'attachments'
        ]
        read_only_fields = ['created_at', 'updated_at']


# --- USER SERIALIZER ---

class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField(source='get_full_name')
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'full_name', 'role']


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Extended user profile serializer with additional information.
    """
    full_name = serializers.ReadOnlyField(source='get_full_name')
    initials = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 
            'full_name', 'initials', 'role', 'date_joined', 'last_login'
        ]
        read_only_fields = ['date_joined', 'last_login']
    
    def get_initials(self, obj):
        first = obj.first_name[0] if obj.first_name else ''
        last = obj.last_name[0] if obj.last_name else ''
        return (first + last).upper() or obj.username[0].upper()