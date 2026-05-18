from rest_framework import status
from rest_framework.permissions import SAFE_METHODS
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
import datetime

from core.models import MonthlySummarySnapshot


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


class MonthLockEnforcementMixin:
    """
    Enforce a global month-lock: if a MonthlySummarySnapshot exists with
    is_locked=True for the year/month of the record being created/updated/deleted
    then reject the operation with HTTP 403.
    """
    date_field_candidates = ('record_date', 'date', 'report_date', 'collection_date', 'reported_at', 'log_date', 'entry_date')

    def _parse_date_from_payload(self, payload):
        # payload may be a dict-like (request.data)
        for key in self.date_field_candidates:
            val = payload.get(key)
            if val:
                try:
                    if isinstance(val, datetime.date):
                        return val
                    # Expect ISO format date string
                    return datetime.date.fromisoformat(val)
                except Exception:
                    continue
        # support explicit year/month pairs
        year = payload.get('year')
        month = payload.get('month')
        if year and month:
            try:
                return datetime.date(int(year), int(month), 1)
            except Exception:
                return None
        return None

    def _parse_date_from_instance(self, instance):
        for key in self.date_field_candidates:
            val = getattr(instance, key, None)
            if val and isinstance(val, (datetime.date,)):
                return val
        # fallback common attribute names
        for attr in ('record_date', 'date', 'report_date', 'collection_date'):
            val = getattr(instance, attr, None)
            if isinstance(val, datetime.date):
                return val
        return None

    def _is_month_locked(self, date_obj):
        if not date_obj:
            return False
        year = date_obj.year
        month = date_obj.month
        return MonthlySummarySnapshot.objects.filter(year=year, month=month, is_locked=True).exists()

    def create(self, request, *args, **kwargs):
        if request.method not in ('GET', 'HEAD', 'OPTIONS'):
            date_obj = self._parse_date_from_payload(request.data or {})
            if date_obj and self._is_month_locked(date_obj):
                return Response({'error': f'Month {date_obj.year}-{str(date_obj.month).zfill(2)} is locked. No modifications allowed.'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        date_obj = self._parse_date_from_instance(instance)
        # allow update if date not determinable
        if date_obj and self._is_month_locked(date_obj):
            return Response({'error': f'Month {date_obj.year}-{str(date_obj.month).zfill(2)} is locked. No modifications allowed.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        date_obj = self._parse_date_from_instance(instance)
        if date_obj and self._is_month_locked(date_obj):
            return Response({'error': f'Month {date_obj.year}-{str(date_obj.month).zfill(2)} is locked. No modifications allowed.'}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        date_obj = self._parse_date_from_instance(instance)
        if date_obj and self._is_month_locked(date_obj):
            return Response({'error': f'Month {date_obj.year}-{str(date_obj.month).zfill(2)} is locked. No modifications allowed.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)
