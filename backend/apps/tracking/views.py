from __future__ import annotations

from datetime import datetime

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.utils import timezone
from apps.accounts.models import Employee
from apps.attendance.models import Session, Attendance
from apps.attendance.services import end_session, get_employee_presence_summary, log_location, start_session
from apps.common.permissions import IsAdminRole, IsEmployeeRole
from apps.tracking.models import LocationLog
from apps.tracking.serializers import LocationLogSerializer
from apps.tracking.services import get_active_session, get_employee_route, get_latest_location, get_today_distance, get_travel_history


def _serialize_location(source: object | None) -> dict | None:
    if not source:
        return None
    return {
        "latitude": float(getattr(source, "latitude")),
        "longitude": float(getattr(source, "longitude")),
        "timestamp": getattr(source, "timestamp", None),
        "accuracy": getattr(source, "accuracy", None),
        "speed": getattr(source, "speed", None),
        "battery_percentage": getattr(source, "battery_percentage", None),
    }


def _get_latest_location_source(employee: Employee) -> object | None:
    active_session = get_active_session(employee)
    if active_session is not None:
        log = LocationLog.objects.filter(employee=employee, session=active_session).order_by("-timestamp").first()
        if log is not None:
            return log
        attendance = (
            Attendance.objects.filter(employee=employee, session=active_session)
            .order_by("-timestamp")
            .first()
        )
        if attendance is not None:
            return attendance

    log = get_latest_location(employee)
    if log is not None:
        return log
    return (
        Attendance.objects.filter(employee=employee)
        .order_by("-timestamp")
        .first()
    )


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
        source = _get_latest_location_source(employee)
        if not source:
            return Response({"detail": "No location data."}, status=status.HTTP_404_NOT_FOUND)
        return Response(_serialize_location(source))


class EmployeeRouteView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, employee_id: int):
        if getattr(request.user, "role", None) == "EMPLOYEE" and request.user.employee_id != employee_id:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        employee = _resolve_employee(employee_id)
        if not employee:
            return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)
        active_session = get_active_session(employee)
        route = get_employee_route(employee, active_session)
        last_known_location = _serialize_location(_get_latest_location_source(employee))
        presence = get_employee_presence_summary(employee)
        return Response({
            "employee_id": employee.employee_id,
            "route": route,
            "distance_covered_meters": get_today_distance(employee, active_session),
            "last_known_location": last_known_location,
            "presence_status": presence['status'],
            "is_present": presence['is_present'],
            "check_in_time": presence['check_in_time'],
            "session_duration_seconds": presence['session_duration_seconds'],
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
        active_sessions = Session.objects.filter(is_active=True).select_related("employee")

        results = []
        for session in active_sessions:
            employee = session.employee
            source = _get_latest_location_source(employee)
            if source is None:
                continue
            presence = get_employee_presence_summary(employee)
            results.append({
                "id": employee.id,
                "employee_id": employee.employee_id,
                "name": employee.name,
                "email": employee.email,
                "phone": employee.phone,
                "department": employee.department,
                "default_address": employee.default_address,
                "profile_photo": employee.profile_photo,
                "latitude": float(getattr(source, "latitude")),
                "longitude": float(getattr(source, "longitude")),
                "timestamp": getattr(source, "timestamp", None),
                "presence_status": presence['status'],
                "is_present": presence['is_present'],
                "check_in_time": presence['check_in_time'],
                "session_duration_seconds": presence['session_duration_seconds'],
            })
        return Response(results)
