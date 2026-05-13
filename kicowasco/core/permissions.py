from rest_framework.permissions import BasePermission


class IsSTPOperatorOrAbove(BasePermission):
    allowed = ['stp_operator', 'stp_supervisor', 'stp_superintendent', 'admin']

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'role', '') in self.allowed
        )


class IsSTPSupervisorOrAbove(BasePermission):
    allowed = ['stp_supervisor', 'stp_superintendent', 'admin']

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'role', '') in self.allowed
        )


class IsSTPSuperintendent(BasePermission):
    allowed = ['stp_superintendent', 'admin']

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'role', '') in self.allowed
        )


class IsLineSupervisorOrAbove(BasePermission):
    # sewer_line_officer included for read contexts; frontend suppresses action buttons.
    allowed = ['line_supervisor', 'sewer_line_officer', 'stp_superintendent', 'admin']

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'role', '') in self.allowed
        )
