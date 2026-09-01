from datetime import time as dt_time, datetime as dt_datetime

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
        now = timezone.now()
        today = timezone.localdate()
        tz = timezone.get_current_timezone()

        # Efficient: single COUNT query
        total_employees = Employee.objects.filter(is_active=True).count()

        # Efficient: single query — employees with a session today are "present"
        present_count = (
            Session.objects.filter(
                login_time__date=today,
                employee__is_active=True,
            )
            .values("employee_id")
            .distinct()
            .count()
        )

        # Efficient: single COUNT query
        employees_in_field = (
            Session.objects.filter(is_active=True)
            .values("employee_id")
            .distinct()
            .count()
        )

        # Efficient: use datetime range to hit indexes instead of DATE() function
        start_dt = timezone.make_aware(dt_datetime.combine(today, dt_time.min), tz)
        end_dt = timezone.make_aware(dt_datetime.combine(today, dt_time.max), tz)
        completed_visits = Attendance.objects.filter(
            attendance_type=Attendance.AttendanceType.CHECK_OUT,
            timestamp__range=(start_dt, end_dt),
        ).count()

        pending_visits = Assignment.objects.filter(
            visit_date=today, status=Assignment.Status.PENDING
        ).count()

        distance = 0.0
        if request.query_params.get("employee_id"):
            employee = Employee.objects.filter(
                employee_id=request.query_params["employee_id"]
            ).first()
            if employee:
                distance = get_today_distance(employee)

        return Response(
            {
                "total_employees": total_employees,
                "present_employees": present_count,
                "absent_employees": max(total_employees - present_count, 0),
                "employees_in_field": employees_in_field,
                "completed_visits": completed_visits,
                "pending_visits": pending_visits,
                "distance_covered_today_meters": distance,
            }
        )
