from rest_framework.permissions import BasePermission, SAFE_METHODS

class IsSuperintendent(BasePermission):
    """Grade 3 Executive Access"""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and getattr(request.user, 'role', '') == 'superintendent')

class IsSupervisor(BasePermission):
    """
    Grade 4 Supervisor Access.
    Note: We allow Superintendents and Admins to also pass Supervisor checks (hierarchical authority).
    """
    def has_permission(self, request, view):
        role = getattr(request.user, 'role', '')
        return bool(request.user and request.user.is_authenticated and role in ['supervisor', 'superintendent', 'admin'])

class IsOperatorOrLabTech(BasePermission):
    """Grade 4/5 Plant and Lab Staff Access"""
    def has_permission(self, request, view):
        role = getattr(request.user, 'role', '')
        return bool(request.user and request.user.is_authenticated and role in ['operator', 'lab_tech'])

class IsAttendant(BasePermission):
    """Grade 6 Field Staff Access"""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and getattr(request.user, 'role', '') == 'attendant')

class IsSupervisorOrReadOnly(BasePermission):
    """Allows supervisors to perform any action, others only read."""
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return request.user and request.user.is_authenticated
        
        role = getattr(request.user, 'role', '')
        return bool(request.user and request.user.is_authenticated and role in ['supervisor', 'superintendent', 'admin'])
