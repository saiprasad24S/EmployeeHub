from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Employee
from apps.assignments.models import Assignment
from apps.attendance.models import Attendance, Session
from apps.common.permissions import IsAdminRole
from apps.tracking.services import get_today_distance


class DashboardMetricsView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        today = timezone.localdate()
        present_employee_ids = Attendance.objects.filter(attendance_type=Attendance.AttendanceType.CHECK_IN, timestamp__date=today).values_list("employee_id", flat=True)
        completed_visits = Attendance.objects.filter(attendance_type=Attendance.AttendanceType.CHECK_OUT, timestamp__date=today).count()
        active_sessions = Session.objects.filter(is_active=True).count()
        total_employees = Employee.objects.filter(is_active=True).count()
        pending_visits = Assignment.objects.filter(visit_date=today, status=Assignment.Status.PENDING).count()
        distance = 0.0
        if request.query_params.get("employee_id"):
            employee = Employee.objects.filter(employee_id=request.query_params["employee_id"]).first()
            if employee:
                distance = get_today_distance(employee)
        return Response(
            {
                "present_employees": len(set(present_employee_ids)),
                "absent_employees": max(total_employees - len(set(present_employee_ids)), 0),
                "employees_in_field": active_sessions,
                "completed_visits": completed_visits,
                "pending_visits": pending_visits,
                "distance_covered_today_meters": distance,
            }
        )
