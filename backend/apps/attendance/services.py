from __future__ import annotations

from datetime import date, datetime, timedelta
from io import BytesIO
from typing import Any

import requests
import cloudinary.uploader
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from openpyxl import Workbook
from PIL import Image, ImageDraw, ImageFont
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


def geocode_address(address: str) -> tuple[float, float] | None:
    if not address:
        return None
    try:
        response = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": address, "format": "jsonv2", "limit": 1},
            headers={"User-Agent": "EmployeeHub/1.0"},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        if not data:
            return None
        return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception:
        return None


def ensure_default_coordinates(employee: Employee) -> bool:
    if employee.default_latitude is not None and employee.default_longitude is not None:
        return True
    if not employee.default_address:
        return False
    coords = geocode_address(employee.default_address)
    if not coords:
        return False
    employee.default_latitude, employee.default_longitude = coords
    employee.save(update_fields=["default_latitude", "default_longitude"])
    return True


def validate_geofence(assignment: Assignment, latitude: float, longitude: float, accuracy: float | None = None) -> None:
    radius = assignment.radius or settings.DEFAULT_GEOFENCE_RADIUS_METERS
    distance = distance_meters(float(latitude), float(longitude), float(assignment.latitude), float(assignment.longitude))
    buffer = max(10.0, (accuracy or 0) * 1.5)
    if distance > radius + buffer:
        raise ValidationError({"detail": f"Geofence Verification Failed: You are outside the patient's scheduled range by {round(distance - radius, 2)} meters. Attendance was not marked."})


def annotate_image(image_file, *, timestamp: str | None = None, location: str | None = None):
    image_file.seek(0)
    img = Image.open(image_file).convert('RGBA')
    draw = ImageDraw.Draw(img)
    font = ImageFont.load_default()

    width, height = img.size
    margin = 24
    box_height = 86
    draw.rectangle([(0, height - box_height), (width, height)], fill=(0, 0, 0, 180))

    label = timestamp or datetime.now().strftime('%Y-%m-%d %H:%M')
    location_text = location or 'Location: unavailable'
    lines = [f'Captured: {label}', location_text]
    for index, line in enumerate(lines):
        draw.text((margin, height - box_height + 22 + index * 28), line, fill='white', font=font)

    rgb_img = img.convert('RGB')
    buffer = BytesIO()
    rgb_img.save(buffer, format='JPEG', quality=95)
    buffer.seek(0)
    return buffer


def upload_selfie(image_file, folder: str, *, timestamp: str | None = None, location: str | None = None) -> str:
    from django.core.files.storage import default_storage
    import uuid
    import os

    ext = os.path.splitext(getattr(image_file, "name", ".jpg"))[1] or ".jpg"
    image_file.seek(0)
    annotated_buffer = annotate_image(image_file, timestamp=timestamp, location=location)
    if annotated_buffer is None:
        annotated_buffer = BytesIO(image_file.read())

    annotated_name = f"{folder}/{uuid.uuid4()}{ext}"
    annotated_file = SimpleUploadedFile(
        getattr(image_file, 'name', 'selfie.jpg'),
        annotated_buffer.getvalue(),
        content_type='image/jpeg',
    )
    saved_name = default_storage.save(annotated_name, annotated_file)
    return default_storage.url(saved_name)


def get_employee_presence_summary(employee: Employee, *, reference_time: datetime | None = None) -> dict[str, Any]:
    reference_time = reference_time or timezone.now()
    session = Session.objects.filter(employee=employee, is_active=True).order_by('-login_time').first()
    if not session:
        session = Session.objects.filter(employee=employee).order_by('-login_time').first()
    if not session:
        return {
            'is_present': False,
            'status': 'Absent',
            'check_in_time': None,
            'check_out_time': None,
            'session_duration_seconds': 0,
            'session': None,
        }

    if session.is_active:
        duration_seconds = max(int((reference_time - session.login_time).total_seconds()), 0)
        return {
            'is_present': True,
            'status': 'Present',
            'check_in_time': session.login_time,
            'check_out_time': None,
            'session_duration_seconds': duration_seconds,
            'session': session,
        }

    logout_time = session.logout_time or session.login_time
    duration_seconds = max(int((logout_time - session.login_time).total_seconds()), 0)
    return {
        'is_present': False,
        'status': 'Absent',
        'check_in_time': session.login_time,
        'check_out_time': logout_time,
        'session_duration_seconds': duration_seconds,
        'session': session,
    }


def get_session_for_date(employee: Employee, target_date: date) -> Session | None:
    return (
        Session.objects.filter(employee=employee, login_time__date__lte=target_date)
        .filter(Q(logout_time__isnull=True) | Q(logout_time__date__gte=target_date))
        .order_by('-login_time')
        .first()
    )


def generate_attendance_export(start_date: date, end_date: date) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = 'Attendance'
    headers = [
        'SNo', 'Date', 'Emp ID', 'Name', 'Email', 'Phone Number', 'Login Time', 'Logout Time', 'Total Hours',
        'Days Present', 'Days Absent'
    ]
    sheet.append(headers)

    employees = Employee.objects.all().order_by('employee_id')
    current_date = start_date
    while current_date <= end_date:
        for index, employee in enumerate(employees, start=1):
            session = get_session_for_date(employee, current_date)
            if not session:
                sheet.append([
                    index,
                    current_date.strftime('%Y-%m-%d'),
                    employee.employee_id,
                    employee.name,
                    employee.email,
                    employee.phone,
                    '',
                    '',
                    '',
                    '0',
                    '1',
                ])
                continue

            login_time = session.login_time
            logout_time = session.logout_time or ''
            total_hours = ''
            if logout_time:
                delta = logout_time - login_time
                total_hours = f"{int(delta.total_seconds() // 3600)}:{int((delta.total_seconds() % 3600) // 60):02d}"
            sheet.append([
                index,
                current_date.strftime('%Y-%m-%d'),
                employee.employee_id,
                employee.name,
                employee.email,
                employee.phone,
                login_time.strftime('%H:%M:%S') if login_time else '',
                logout_time.strftime('%H:%M:%S') if logout_time else '',
                total_hours,
                '1',
                '0',
            ])
        current_date += timedelta(days=1)

    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


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
