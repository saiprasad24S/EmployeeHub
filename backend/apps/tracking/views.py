from __future__ import annotations

from datetime import datetime

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.utils import timezone
from apps.accounts.models import Employee
from apps.attendance.models import Session, Attendance
from apps.attendance.services import end_session, log_location, start_session
from apps.common.permissions import IsAdminRole, IsEmployeeRole
from apps.tracking.models import LocationLog
from apps.tracking.serializers import LocationLogSerializer
from apps.tracking.services import get_employee_route, get_latest_location, get_today_distance, get_travel_history


def _serialize_location(log: LocationLog | None) -> dict | None:
    if not log:
        return None
    return {
        "latitude": float(log.latitude),
        "longitude": float(log.longitude),
        "timestamp": log.timestamp,
        "accuracy": log.accuracy,
        "speed": log.speed,
        "battery_percentage": log.battery_percentage,
    }


def _resolve_employee(employee_id: int | str | None) -> Employee | None:
    if employee_id in (None, ""):
        return None
    try:
        pk = int(employee_id)
    except (TypeError, ValueError):
        pk = None
    if pk is not None:
        employee = Employee.objects.filter(pk=pk).first()
        if employee:
            return employee
    return Employee.objects.filter(employee_id=str(employee_id)).first()


class LocationUpdateView(APIView):
    permission_classes = [IsEmployeeRole]

    def post(self, request):
        employee = Employee.objects.get(pk=request.user.employee_id)
        session = Session.objects.filter(employee=employee, is_active=True).first()
        if not session:
            return Response({"detail": "No active session."}, status=status.HTTP_400_BAD_REQUEST)
        log = log_location(
            session=session,
            employee=employee,
            latitude=float(request.data["latitude"]),
            longitude=float(request.data["longitude"]),
            accuracy=float(request.data["accuracy"]) if request.data.get("accuracy") is not None else None,
            speed=float(request.data["speed"]) if request.data.get("speed") is not None else None,
            battery_percentage=int(request.data["battery_percentage"]) if request.data.get("battery_percentage") is not None else None,
            is_mock=str(request.data.get("is_mock", "false")).lower() == "true",
        )
        return Response(LocationLogSerializer(log).data, status=status.HTTP_201_CREATED)


class EmployeeCurrentLocationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, employee_id: int):
        if getattr(request.user, "role", None) == "EMPLOYEE" and request.user.employee_id != employee_id:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        employee = Employee.objects.filter(pk=employee_id).first()
        if not employee:
            return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)
        log = get_latest_location(employee)
        if not log:
            return Response({"detail": "No location data."}, status=status.HTTP_404_NOT_FOUND)
        return Response(LocationLogSerializer(log).data)


class EmployeeRouteView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, employee_id: int):
        if getattr(request.user, "role", None) == "EMPLOYEE" and request.user.employee_id != employee_id:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        employee = _resolve_employee(employee_id)
        if not employee:
            return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)
        route = get_employee_route(employee)
        last_known_location = _serialize_location(get_latest_location(employee))
        return Response({
            "employee_id": employee.employee_id,
            "route": route,
            "distance_covered_meters": get_today_distance(employee),
            "last_known_location": last_known_location,
        })


class EmployeeTravelHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, employee_id: int):
        if getattr(request.user, "role", None) == "EMPLOYEE" and request.user.employee_id != employee_id:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        employee = _resolve_employee(employee_id)
        if not employee:
            return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)
        travel_date = request.query_params.get("date")
        parsed_date = None
        if travel_date:
            parsed_date = datetime.strptime(travel_date, "%Y-%m-%d").date()
        return Response(get_travel_history(employee, parsed_date))


class AllPresentEmployeesLocationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        present_employee_ids = Attendance.objects.filter(
            attendance_type=Attendance.AttendanceType.CHECK_IN,
            timestamp__date=today
        ).values_list("employee_id", flat=True)

        results = []
        for emp_id in set(present_employee_ids):
            employee = Employee.objects.filter(pk=emp_id).first()
            if employee:
                log = get_latest_location(employee)
                if log:
                    results.append({
                        "id": employee.id,
                        "employee_id": employee.employee_id,
                        "name": employee.name,
                        "email": employee.email,
                        "department": employee.department,
                        "default_address": employee.default_address,
                        "profile_photo": employee.profile_photo,
                        "latitude": float(log.latitude),
                        "longitude": float(log.longitude),
                        "timestamp": log.timestamp,
                    })
        return Response(results)
