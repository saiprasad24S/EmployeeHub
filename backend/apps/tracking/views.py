from __future__ import annotations

from datetime import datetime

from django.utils import timezone

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Employee
from apps.attendance.models import Session, Attendance
from apps.attendance.services import get_employee_presence_summary, log_location
from apps.common.permissions import IsEmployeeRole
from apps.tracking.models import LocationLog
from apps.tracking.serializers import LocationLogSerializer
from apps.tracking.services import get_active_session, get_latest_location, get_travel_history


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
        
        date_str = request.query_params.get("date")
        target_date = None
        if date_str:
            try:
                target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                pass
                
        history = get_travel_history(employee, target_date)
        last_known_location = _serialize_location(_get_latest_location_source(employee))
        presence = get_employee_presence_summary(employee)
        return Response({
            "employee_id": employee.employee_id,
            "employee_name": employee.name,
            "date": history["date"],
            "route": history["points"],
            "distance_covered_meters": history["distance"],
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
        from django.db.models import Subquery, OuterRef

        # 1. Get all active sessions in one query with employee data
        active_sessions = (
            Session.objects.filter(is_active=True)
            .select_related("employee")
        )

        if not active_sessions.exists():
            return Response([])

        employee_map = {}
        session_map = {}
        for session in active_sessions:
            emp = session.employee
            employee_map[emp.id] = emp
            session_map[emp.id] = session

        employee_ids = list(employee_map.keys())

        # 2. Batch-fetch latest location logs for all active employees
        latest_log_ids = (
            LocationLog.objects.filter(employee_id__in=employee_ids)
            .values("employee_id")
            .annotate(latest_id=Subquery(
                LocationLog.objects.filter(employee_id=OuterRef("employee_id"))
                .order_by("-timestamp")
                .values("id")[:1]
            ))
            .values_list("latest_id", flat=True)
        )
        location_logs = LocationLog.objects.filter(id__in=latest_log_ids)
        log_by_employee = {log.employee_id: log for log in location_logs}

        # 3. For employees without location logs, try latest attendance from their active session
        missing_ids = [eid for eid in employee_ids if eid not in log_by_employee]
        att_by_employee = {}
        if missing_ids:
            # Map missing employee ids to their active session ids
            missing_session_ids = {eid: session_map[eid].id for eid in missing_ids}
            # First try: attendance from the active session
            for eid in missing_ids:
                att = (
                    Attendance.objects.filter(
                        employee_id=eid,
                        session_id=missing_session_ids[eid],
                    )
                    .order_by("-timestamp")
                    .first()
                )
                if att:
                    att_by_employee[eid] = att
            # Second try: any attendance for employees still missing
            still_missing = [eid for eid in missing_ids if eid not in att_by_employee]
            if still_missing:
                latest_att_ids = (
                    Attendance.objects.filter(employee_id__in=still_missing)
                    .values("employee_id")
                    .annotate(latest_id=Subquery(
                        Attendance.objects.filter(employee_id=OuterRef("employee_id"))
                        .order_by("-timestamp")
                        .values("id")[:1]
                    ))
                    .values_list("latest_id", flat=True)
                )
                for att in Attendance.objects.filter(id__in=latest_att_ids):
                    att_by_employee[att.employee_id] = att

        # 4. Build results
        results = []
        for emp_id in employee_ids:
            emp = employee_map[emp_id]
            session = session_map[emp_id]

            source = log_by_employee.get(emp_id) or att_by_employee.get(emp_id)
            if source is None:
                continue

            lat = float(getattr(source, "latitude", 0))
            lon = float(getattr(source, "longitude", 0))
            if lat == 0 and lon == 0:
                continue

            login_time = session.login_time
            duration = max(int((timezone.now() - login_time).total_seconds()), 0) if login_time else 0

            results.append({
                "id": emp.id,
                "employee_id": emp.employee_id,
                "name": emp.name,
                "email": emp.email,
                "phone": emp.phone,
                "department": emp.department,
                "default_address": emp.default_address,
                "profile_photo": emp.profile_photo,
                "latitude": lat,
                "longitude": lon,
                "timestamp": getattr(source, "timestamp", None),
                "presence_status": "Present",
                "is_present": True,
                "check_in_time": login_time,
                "session_duration_seconds": duration,
            })
        return Response(results)
