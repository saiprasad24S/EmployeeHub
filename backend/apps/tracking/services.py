from __future__ import annotations

from collections import OrderedDict
from datetime import date

from django.db.models import Sum
from django.utils import timezone

from apps.accounts.models import Employee
from apps.attendance.models import Session
from apps.common.utils import distance_meters
from apps.tracking.models import LocationLog


def get_latest_location(employee: Employee) -> LocationLog | None:
    return LocationLog.objects.filter(employee=employee).order_by("-timestamp").first()


def get_employee_route(employee: Employee) -> list[dict]:
    today = timezone.localdate()
    logs = LocationLog.objects.filter(employee=employee, timestamp__date=today).order_by("timestamp")
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


def get_today_distance(employee: Employee) -> float:
    logs = list(LocationLog.objects.filter(employee=employee, timestamp__date=timezone.localdate()).order_by("timestamp"))
    if len(logs) < 2:
        return 0.0
    total = 0.0
    for previous, current in zip(logs, logs[1:]):
        total += distance_meters(float(previous.latitude), float(previous.longitude), float(current.latitude), float(current.longitude))
    return total


def get_travel_history(employee: Employee, history_date: date | None = None) -> dict:
    if history_date:
        logs = LocationLog.objects.filter(employee=employee, timestamp__date=history_date).order_by("timestamp")
    else:
        logs = LocationLog.objects.filter(employee=employee).order_by("timestamp")
    route = get_employee_route(employee)
    return {
        "points": route,
        "distance": get_today_distance(employee),
        "count": logs.count(),
    }
