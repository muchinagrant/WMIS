from rest_framework.permissions import BasePermission, SAFE_METHODS

class IsSupervisor(BasePermission):
    """
    Allows access only to users with the 'supervisor' role.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            getattr(request.user, 'role', '') == 'supervisor'
        )


class IsInspector(BasePermission):
    """
    Allows access only to users with the 'inspector' role.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            getattr(request.user, 'role', '') == 'inspector'
        )


class IsOperator(BasePermission):
    """
    Allows access only to users with the 'operator' role.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            getattr(request.user, 'role', '') == 'operator'
        )


class IsTechnician(BasePermission):
    """
    Allows access only to users with the 'technician' role.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            getattr(request.user, 'role', '') == 'technician'
        )


class IsAdmin(BasePermission):
    """
    Allows access only to users with the 'admin' role.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            getattr(request.user, 'role', '') == 'admin'
        )


class IsOwnerOrReadOnly(BasePermission):
    """
    Custom permission to only allow owners of an object to edit it.
    Assumes the model instance has a field named 'created_by', 'technician', 
    'operator', or 'inspector' that contains the user.
    """
    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any authenticated request
        if request.method in SAFE_METHODS:
            return True

        # Write permissions are only allowed to the owner
        # Check different possible owner fields
        if hasattr(obj, 'created_by') and obj.created_by == request.user:
            return True
        if hasattr(obj, 'technician') and obj.technician == request.user:
            return True
        if hasattr(obj, 'operator') and obj.operator == request.user:
            return True
        if hasattr(obj, 'inspector') and obj.inspector == request.user:
            return True
        if hasattr(obj, 'user') and obj.user == request.user:
            return True
            
        return False


class IsSupervisorOrReadOnly(BasePermission):
    """
    Allows supervisors to perform any action, others only read.
    """
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return request.user and request.user.is_authenticated
        
        return bool(
            request.user and 
            request.user.is_authenticated and 
            getattr(request.user, 'role', '') == 'supervisor'
        )


class CanCertifyRepair(BasePermission):
    """
    Only supervisors can certify repairs, and only if they are not the technician.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            getattr(request.user, 'role', '') == 'supervisor'
        )
    
    def has_object_permission(self, request, view, obj):
        # Supervisors cannot certify their own repairs
        if hasattr(obj, 'technician') and obj.technician == request.user:
            return False
        return True