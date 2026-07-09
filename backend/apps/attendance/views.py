from __future__ import annotations

from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Employee
from apps.attendance.models import Attendance, Session
from apps.attendance.serializers import AttendanceSerializer
from apps.attendance.services import (
    end_session,
    get_active_assignment,
    record_attendance,
    start_session,
    upload_selfie,
    validate_geofence,
    validate_liveness,
    verify_face_against_employee,
)
from apps.common.permissions import IsEmployeeRole


class CheckInView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsEmployeeRole]

    def post(self, request):
        employee = Employee.objects.get(pk=request.user.employee_id)
        assignment = get_active_assignment(employee)
        if not assignment:
            return Response({"detail": "No active assignment found."}, status=status.HTTP_400_BAD_REQUEST)

        latitude = float(request.data["latitude"])
        longitude = float(request.data["longitude"])
        validate_geofence(assignment, latitude, longitude)

        selfie = request.FILES.get("selfie")
        if not selfie:
            return Response({"detail": "Selfie is required."}, status=status.HTTP_400_BAD_REQUEST)
        validate_liveness(selfie, request.data.get("liveness_score"))
        verify_face_against_employee(employee, selfie)
        photo_url = upload_selfie(selfie, folder="attendance")

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
        assignment.status = assignment.Status.ACTIVE
        assignment.save(update_fields=["status"])
        return Response(
            {"detail": "Check-in successful.", "attendance": AttendanceSerializer(attendance).data, "session_id": session.id},
            status=status.HTTP_201_CREATED,
        )


class CheckOutView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsEmployeeRole]

    def post(self, request):
        employee = Employee.objects.get(pk=request.user.employee_id)
        session = Session.objects.filter(employee=employee, is_active=True).first()
        if not session:
            return Response({"detail": "No active session."}, status=status.HTTP_400_BAD_REQUEST)

        selfie = request.FILES.get("selfie")
        if not selfie:
            return Response({"detail": "Selfie is required."}, status=status.HTTP_400_BAD_REQUEST)
        validate_liveness(selfie, request.data.get("liveness_score"))
        verify_face_against_employee(employee, selfie)
        photo_url = upload_selfie(selfie, folder="attendance")

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
        end_session(employee)
        return Response({"detail": "Check-out successful.", "attendance": AttendanceSerializer(attendance).data})


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
