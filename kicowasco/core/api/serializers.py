from rest_framework import serializers
from django.contrib.auth import get_user_model
from core.models import Incident

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for the Custom User model, exposing necessary fields
    including the custom RBAC 'role' field.
    """
    class Meta:
        model = User
        fields = ('id', 'username', 'first_name', 'last_name', 'email', 'role')
        read_only_fields = ('id',)


class IncidentSerializer(serializers.ModelSerializer):
    """
    Serializer for the Incident model.
    Handles the conversion of Incident instances to JSON and validates incoming data.
    """
    # We can nest the UserSerializer to show details of the reported/assigned users 
    # instead of just their primary key IDs when reading data.
    reported_by_name = serializers.CharField(max_length=200)
    
    class Meta:
        model = Incident
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')

    def create(self, validated_data):
        """
        Automatically assign the user who created the incident 
        from the request context if needed.
        """
        request = self.context.get('request', None)
        if request and hasattr(request, "user"):
            validated_data['created_by'] = request.user
        return super().create(validated_data)