from __future__ import annotations

from collections import OrderedDict
from datetime import date

from django.db.models import Sum
from django.utils import timezone

from apps.accounts.models import Employee
from apps.attendance.models import Session
from apps.attendance.services import get_employee_presence_summary
from apps.common.utils import distance_meters
from apps.tracking.models import LocationLog


def get_active_session(employee: Employee) -> Session | None:
    return Session.objects.filter(employee=employee, is_active=True).order_by("-login_time").first()


def get_latest_location(employee: Employee) -> LocationLog | None:
    return LocationLog.objects.filter(employee=employee).order_by("-timestamp").first()


def get_employee_route(employee: Employee, session: Session | None = None) -> list[dict]:
    from apps.attendance.models import Attendance
    
    target_session = session or get_active_session(employee)
    if not target_session:
        target_session = Session.objects.filter(employee=employee, login_time__date=timezone.localdate()).order_by("-login_time").first()
    
    points = []
    
    # Check for attendance records (check-in/check-out)
    attendances = Attendance.objects.filter(
        employee=employee,
        created_at__date=timezone.localdate()
    ).order_by("created_at")
    
    for att in attendances:
        if att.latitude is not None and att.longitude is not None:
            points.append({
                "latitude": float(att.latitude),
                "longitude": float(att.longitude),
                "timestamp": att.created_at,
                "type": att.attendance_type,
            })
            
    if target_session:
        logs = LocationLog.objects.filter(employee=employee, session=target_session).order_by("timestamp")
        for log in logs:
            points.append({
                "latitude": float(log.latitude),
                "longitude": float(log.longitude),
                "timestamp": log.timestamp,
                "accuracy": log.accuracy,
                "speed": log.speed,
                "battery_percentage": log.battery_percentage,
            })
            
    # Sort points by timestamp
    points.sort(key=lambda p: p["timestamp"])
    return points


def get_today_distance(employee: Employee, session: Session | None = None, target_date: date | None = None) -> float:
    active_session = session or get_active_session(employee)
    if not active_session:
        return 0.0
    target_date = target_date or timezone.localdate()
    logs = list(
        LocationLog.objects.filter(
            employee=employee,
            session=active_session,
            timestamp__date=target_date,
        ).order_by("timestamp")
    )
    if len(logs) < 2:
        return 0.0
    total = 0.0
    for previous, current in zip(logs, logs[1:]):
        total += distance_meters(float(previous.latitude), float(previous.longitude), float(current.latitude), float(current.longitude))
    return total


def get_travel_history(employee: Employee, history_date: date | None = None) -> dict:
    active_session = get_active_session(employee)
    if history_date:
        logs = LocationLog.objects.filter(employee=employee, timestamp__date=history_date).order_by("timestamp")
        route = [
            {
                "latitude": float(log.latitude),
                "longitude": float(log.longitude),
                "timestamp": log.timestamp,
                "accuracy": log.accuracy,
                "speed": log.speed,
                "battery_percentage": log.battery_percentage,
            }
            for log in logs
        ]
        distance = 0.0
        if len(logs) >= 2:
            for previous, current in zip(logs, logs[1:]):
                distance += distance_meters(float(previous.latitude), float(previous.longitude), float(current.latitude), float(current.longitude))
        return {
            "points": route,
            "distance": distance,
            "count": logs.count(),
        }

    session_logs = LocationLog.objects.filter(employee=employee, session=active_session).order_by("timestamp") if active_session else []
    route = get_employee_route(employee, active_session)
    return {
        "points": route,
        "distance": get_today_distance(employee, active_session),
        "count": len(session_logs),
    }
