from __future__ import annotations

from datetime import datetime
from io import BytesIO

import cloudinary.uploader
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.accounts.models import Employee
from apps.assignments.models import Assignment
from apps.attendance.models import Attendance, Session
from apps.common.utils import distance_meters
from apps.tracking.models import LocationLog
from apps.vision.services import FaceRecognitionService, LivenessService


face_service = FaceRecognitionService()
liveness_service = LivenessService()


def get_active_assignment(employee: Employee) -> Assignment | None:
    today = timezone.localdate()
    return (
        Assignment.objects.filter(employee=employee, visit_date=today)
        .exclude(status=Assignment.Status.CANCELLED)
        .order_by("-created_at")
        .first()
    )


def validate_geofence(assignment: Assignment, latitude: float, longitude: float) -> None:
    radius = assignment.radius or settings.DEFAULT_GEOFENCE_RADIUS_METERS
    distance = distance_meters(float(latitude), float(longitude), float(assignment.latitude), float(assignment.longitude))
    if distance > radius:
        raise ValidationError({"detail": f"Outside geofence radius by {round(distance - radius, 2)} meters."})


def upload_selfie(image_file, folder: str) -> str:
    result = cloudinary.uploader.upload(image_file, folder=folder, resource_type="image")
    return result["secure_url"]


@transaction.atomic
def start_session(employee: Employee) -> Session:
    active_session = Session.objects.select_for_update().filter(employee=employee, is_active=True).first()
    if active_session:
        return active_session
    return Session.objects.create(employee=employee, is_active=True)


@transaction.atomic
def end_session(employee: Employee) -> Session:
    session = Session.objects.select_for_update().filter(employee=employee, is_active=True).first()
    if not session:
        raise ValidationError({"detail": "No active session found."})
    session.is_active = False
    session.logout_time = timezone.now()
    session.save(update_fields=["is_active", "logout_time"])
    return session


def record_attendance(
    *,
    employee: Employee,
    assignment: Assignment | None,
    session: Session | None,
    attendance_type: str,
    photo_url: str,
    latitude: float,
    longitude: float,
    address: str,
    status: str,
    remarks: str = "",
) -> Attendance:
    return Attendance.objects.create(
        employee=employee,
        assignment=assignment,
        session=session,
        attendance_type=attendance_type,
        photo_url=photo_url,
        latitude=latitude,
        longitude=longitude,
        address=address,
        status=status,
        remarks=remarks,
    )


def validate_liveness(image_file, liveness_score: float | None = None) -> None:
    if not liveness_service.is_live(image_file=image_file, liveness_score=liveness_score):
        raise ValidationError({"detail": "Liveness check failed."})


def verify_face_against_employee(employee: Employee, image_file) -> float:
    if not employee.face_embedding:
        raise ValidationError({"detail": "Face not registered."})

    incoming_embedding = face_service.generate_embedding(image_file)
    score = face_service.compare_with_store(incoming_embedding, employee.face_embedding)
    if score < face_service.similarity_threshold:
        raise ValidationError({"detail": "Face verification failed."})
    return score


def log_location(
    *,
    session: Session,
    employee: Employee,
    latitude: float,
    longitude: float,
    accuracy: float | None = None,
    speed: float | None = None,
    battery_percentage: int | None = None,
    is_mock: bool = False,
    client_timestamp: datetime | None = None,
) -> LocationLog:
    if is_mock:
        raise ValidationError({"detail": "Mock location detected."})
    if client_timestamp:
        skew = abs((timezone.now() - client_timestamp).total_seconds())
        if skew > 300:
            raise ValidationError({"detail": "Timestamp skew is too large."})
    return LocationLog.objects.create(
        session=session,
        employee=employee,
        latitude=latitude,
        longitude=longitude,
        accuracy=accuracy,
        speed=speed,
        battery_percentage=battery_percentage,
    )
