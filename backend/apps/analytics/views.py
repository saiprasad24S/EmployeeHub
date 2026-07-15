from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Employee
from apps.assignments.models import Assignment
from apps.attendance.models import Attendance, Session
from apps.attendance.services import get_employee_presence_summary
from apps.common.permissions import IsAdminRole
from apps.tracking.services import get_today_distance


class DashboardMetricsView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        today = timezone.localdate()
        active_sessions = Session.objects.filter(is_active=True).select_related("employee")
        active_session_employee_ids = [session.employee_id for session in active_sessions]
        completed_visits = Attendance.objects.filter(attendance_type=Attendance.AttendanceType.CHECK_OUT, timestamp__date=today).count()
        total_employees = Employee.objects.filter(is_active=True).count()
        pending_visits = Assignment.objects.filter(visit_date=today, status=Assignment.Status.PENDING).count()
        present_employee_ids = set()
        for employee in Employee.objects.filter(is_active=True):
            summary = get_employee_presence_summary(employee, reference_time=timezone.now())
            if summary['is_present']:
                present_employee_ids.add(employee.id)

        distance = 0.0
        if request.query_params.get("employee_id"):
            employee = Employee.objects.filter(employee_id=request.query_params["employee_id"]).first()
            if employee:
                distance = get_today_distance(employee)
        return Response(
            {
                "total_employees": total_employees,
                "present_employees": len(present_employee_ids),
                "absent_employees": max(total_employees - len(present_employee_ids), 0),
                "employees_in_field": len(active_session_employee_ids),
                "completed_visits": completed_visits,
                "pending_visits": pending_visits,
                "distance_covered_today_meters": distance,
            }
        )
