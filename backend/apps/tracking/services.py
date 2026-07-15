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
    active_session = session or get_active_session(employee)
    if not active_session:
        return []
    logs = LocationLog.objects.filter(employee=employee, session=active_session).order_by("timestamp")
    return [
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


def get_today_distance(employee: Employee, session: Session | None = None) -> float:
    active_session = session or get_active_session(employee)
    if not active_session:
        return 0.0
    logs = list(LocationLog.objects.filter(employee=employee, session=active_session).order_by("timestamp"))
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
