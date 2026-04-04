# core/signals.py
import json
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models.signals import pre_save, post_save, post_delete
from django.dispatch import receiver
from django.forms.models import model_to_dict
from .models import AuditLog, Incident, Repair
from .middleware import get_current_user

# List of models we want to audit
AUDITABLE_MODELS = [Incident, Repair]

def get_model_state(instance):
    """Helper to convert a model instance to a dictionary for JSON storage."""
    # 1. Get the raw dictionary
    raw_dict = model_to_dict(instance, exclude=['supervisor_signature', 'foreman_signature_image'])
    
    # 2. Convert complex objects (like Datetimes and Decimals) to safe JSON strings
    safe_json_string = json.dumps(raw_dict, cls=DjangoJSONEncoder)
    
    # 3. Return it as a dict so the JSONField can store it properly
    return json.loads(safe_json_string)

for model in AUDITABLE_MODELS:
    @receiver(pre_save, sender=model)
    def capture_old_state(sender, instance, **kwargs):
        """Fired just before the model saves to the database."""
        if instance.pk:
            try:
                # Fetch the existing record from the DB to see what it looked like
                old_instance = sender.objects.get(pk=instance.pk)
                instance._old_state = get_model_state(old_instance)
            except sender.DoesNotExist:
                instance._old_state = None
        else:
            # It's a new record being created
            instance._old_state = None

    @receiver(post_save, sender=model)
    def log_save_action(sender, instance, created, **kwargs):
        """Fired just after the model saves to the database."""
        user = get_current_user()
        action = 'create' if created else 'update'
        
        metadata = {}
        if not created and hasattr(instance, '_old_state'):
            # Record the before/after values as required by the roadmap
            metadata = {
                'before': instance._old_state,
                'after': get_model_state(instance)
            }
        elif created:
            metadata = {'after': get_model_state(instance)}

        # Create the immutable AuditLog record
        AuditLog.objects.create(
            user=user if user and user.is_authenticated else None,
            action=action,
            entity=sender.__name__,
            entity_id=instance.pk,
            metadata=metadata
        )

    @receiver(post_delete, sender=model)
    def log_delete_action(sender, instance, **kwargs):
        """Fired just after a model is deleted."""
        user = get_current_user()
        
        AuditLog.objects.create(
            user=user if user and user.is_authenticated else None,
            action='delete',
            entity=sender.__name__,
            entity_id=instance.pk,
            metadata={'deleted_data': get_model_state(instance)}
        )