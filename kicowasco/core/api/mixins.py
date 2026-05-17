from rest_framework import status
from rest_framework.permissions import SAFE_METHODS
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response


class LockEnforcementMixin:
    lock_status_field = 'status'
    locked_values = {'verified'}
    lock_error_message = 'Record already verified and locked.'

    def _is_locked(self, obj):
        return getattr(obj, self.lock_status_field, None) in self.locked_values

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if self._is_locked(instance):
            return Response({'error': self.lock_error_message}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if self._is_locked(instance):
            return Response({'error': self.lock_error_message}, status=status.HTTP_400_BAD_REQUEST)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if self._is_locked(instance):
            return Response({'error': self.lock_error_message}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)


class ExecutiveReadOnlyMixin:
    executive_read_only_roles = {'admin', 'stp_superintendent'}
    executive_read_only_error = 'This role has audit/read-only access for operational records.'

    def initial(self, request, *args, **kwargs):
        if request.method not in SAFE_METHODS:
            user_role = getattr(request.user, 'role', '')
            if user_role in self.executive_read_only_roles:
                raise PermissionDenied(self.executive_read_only_error)
        return super().initial(request, *args, **kwargs)
