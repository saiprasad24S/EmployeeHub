from rest_framework.permissions import BasePermission


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        return getattr(request.user, "role", None) == "ADMIN"


class IsEmployeeRole(BasePermission):
    def has_permission(self, request, view):
        if getattr(request.user, "role", None) != "EMPLOYEE":
            return False
        emp_id = getattr(request.user, "employee_id", None)
        if emp_id:
            from apps.accounts.models import Employee
            return Employee.objects.filter(pk=emp_id, is_active=True).exists()
        return False


class IsSelfOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        if getattr(request.user, "role", None) == "ADMIN":
            return True
        return getattr(request.user, "employee_id", None) == getattr(obj, "id", None)
