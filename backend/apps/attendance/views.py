from __future__ import annotations

from django.db import transaction
from django.http import HttpResponse
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
import traceback

from apps.accounts.models import Employee
from apps.attendance.models import Attendance, Session
from apps.attendance.serializers import AttendanceSerializer
from apps.attendance.services import (
    end_session,
    ensure_default_coordinates,
    generate_attendance_export,
    get_active_assignment,
    log_location,
    record_attendance,
    start_session,
    upload_selfie,
    validate_geofence,
    validate_liveness,
    verify_face_against_employee,
)
from apps.common.permissions import IsEmployeeRole
from apps.common.utils import distance_meters


class CheckInView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsEmployeeRole]

    def post(self, request):
        try:
            with transaction.atomic():
                employee = Employee.objects.get(pk=request.user.employee_id)
                assignment = get_active_assignment(employee)

                latitude = float(request.data["latitude"])
                longitude = float(request.data["longitude"])

                accuracy = float(request.data.get('accuracy') or 0)
                if assignment:
                    validate_geofence(assignment, latitude, longitude, accuracy)
                else:
                    if employee.default_latitude is None or employee.default_longitude is None:
                        if not employee.default_address or not ensure_default_coordinates(employee):
                            return Response({"detail": "No active assignment found and no default location set for employee."}, status=status.HTTP_400_BAD_REQUEST)

                    radius = employee.default_radius or 100
                    distance = distance_meters(
                        float(latitude),
                        float(longitude),
                        float(employee.default_latitude),
                        float(employee.default_longitude),
                    )
                    buffer = max(10.0, accuracy * 1.5)
                    if distance > radius + buffer:
                        raise ValidationError({"detail": f"Geofence Verification Failed: You are outside your default work range by {round(distance - radius, 2)} meters. Attendance was not marked."})

                selfie = request.FILES.get("selfie")
                if not selfie:
                    return Response({"detail": "Selfie is required."}, status=status.HTTP_400_BAD_REQUEST)
                validate_liveness(selfie, request.data.get("liveness_score"))
                verify_face_against_employee(employee, selfie)
                photo_url = upload_selfie(
                    selfie,
                    folder="attendance",
                    timestamp=request.data.get("timestamp") or None,
                    location=request.data.get("location") or None,
                )

                session = start_session(employee)
                attendance = record_attendance(
                    employee=employee,
                    assignment=assignment,
                    session=session,
                    attendance_type=Attendance.AttendanceType.CHECK_IN,
                    photo_url=photo_url,
                    latitude=latitude,
                    longitude=longitude,
                    address=request.data.get("address", ""),
                    status=Attendance.Status.APPROVED,
                )
                if assignment:
                    assignment.status = assignment.Status.ACTIVE
                    assignment.save(update_fields=["status"])
                log_location(
                    session=session,
                    employee=employee,
                    latitude=latitude,
                    longitude=longitude,
                    accuracy=1.0,
                    is_mock=False,
                )
                return Response(
                    {"detail": "Check-in successful.", "attendance": AttendanceSerializer(attendance).data, "session_id": session.id},
                    status=status.HTTP_201_CREATED,
                )
        except ValidationError as exc:
            print("[CHECKIN ERROR]", exc)
            return Response({"detail": exc.detail if hasattr(exc, 'detail') else str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            print("[CHECKIN ERROR]", traceback.format_exc())
            return Response({"detail": str(exc) or "Attendance check-in failed."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CheckOutView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsEmployeeRole]

    def post(self, request):
        try:
            with transaction.atomic():
                employee = Employee.objects.get(pk=request.user.employee_id)
                session = Session.objects.filter(employee=employee, is_active=True).first()
                if not session:
                    return Response({"detail": "No active session."}, status=status.HTTP_400_BAD_REQUEST)

                selfie = request.FILES.get("selfie")
                if not selfie:
                    return Response({"detail": "Selfie is required."}, status=status.HTTP_400_BAD_REQUEST)
                validate_liveness(selfie, request.data.get("liveness_score"))
                verify_face_against_employee(employee, selfie)
                photo_url = upload_selfie(
                    selfie,
                    folder="attendance",
                    timestamp=request.data.get("timestamp") or None,
                    location=request.data.get("location") or None,
                )

                latitude = float(request.data["latitude"])
                longitude = float(request.data["longitude"])
                attendance = record_attendance(
                    employee=employee,
                    assignment=get_active_assignment(employee),
                    session=session,
                    attendance_type=Attendance.AttendanceType.CHECK_OUT,
                    photo_url=photo_url,
                    latitude=latitude,
                    longitude=longitude,
                    address=request.data.get("address", ""),
                    status=Attendance.Status.APPROVED,
                )
                log_location(
                    session=session,
                    employee=employee,
                    latitude=latitude,
                    longitude=longitude,
                    accuracy=1.0,
                    is_mock=False,
                )
                end_session(employee)
                return Response({"detail": "Check-out successful.", "attendance": AttendanceSerializer(attendance).data})
        except ValidationError as exc:
            print("[CHECKOUT ERROR]", exc)
            return Response({"detail": exc.detail if hasattr(exc, 'detail') else str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            print("[CHECKOUT ERROR]", traceback.format_exc())
            return Response({"detail": str(exc) or "Attendance check-out failed."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AttendanceListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Attendance.objects.select_related("employee", "assignment", "session").all()
        if getattr(request.user, "role", None) == "EMPLOYEE":
            queryset = queryset.filter(employee_id=request.user.employee_id)
        employee_id = request.query_params.get("employee_id")
        if employee_id:
            queryset = queryset.filter(employee__employee_id=employee_id)
        return Response(AttendanceSerializer(queryset[:200], many=True).data)


class AttendanceExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")
        if not start_date or not end_date:
            return Response({"detail": "Both start_date and end_date are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            start = datetime.strptime(start_date, "%Y-%m-%d").date()
            end = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            return Response({"detail": "Dates must be in YYYY-MM-DD format."}, status=status.HTTP_400_BAD_REQUEST)

        workbook_bytes = generate_attendance_export(start, end)
        response = HttpResponse(workbook_bytes, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        response["Content-Disposition"] = f"attachment; filename=attendance_{start}_{end}.xlsx"
        return response
