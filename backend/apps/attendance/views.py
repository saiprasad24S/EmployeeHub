from __future__ import annotations

import calendar
from datetime import date, datetime, time, timedelta
from django.db import transaction
from django.http import HttpResponse
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
import traceback

from apps.accounts.models import Employee
from apps.attendance.models import Attendance, Session
from apps.attendance.serializers import AttendanceSerializer
from apps.attendance.services import (
    GeofenceValidationError,
    end_session,
    generate_attendance_export,
    get_active_assignment,
    log_location,
    record_attendance,
    start_session,
    upload_selfie,
    validate_geofence,
)
from apps.common.permissions import IsEmployeeRole


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
                validate_geofence(employee, assignment, latitude, longitude, accuracy)

                selfie = request.FILES.get("selfie")
                if not selfie:
                    return Response({"detail": "Selfie is required."}, status=status.HTTP_400_BAD_REQUEST)
                if str(request.data.get("face_match", "")).lower() not in {"1", "true", "yes", "on"}:
                    return Response({"detail": "Face match not confirmed on the client."}, status=status.HTTP_400_BAD_REQUEST)
                location_text = request.data.get("address") or request.data.get("location") or f"Lat: {latitude:.4f}, Lon: {longitude:.4f}"
                upload_result = upload_selfie(
                    selfie,
                    folder="attendance",
                    employee=employee,
                    timestamp=request.data.get("timestamp") or None,
                    location=location_text,
                )
                photo_url = upload_result["url"]
                photo_public_id = upload_result["public_id"]

                session = start_session(employee)
                attendance = record_attendance(
                    employee=employee,
                    assignment=assignment,
                    session=session,
                    attendance_type=Attendance.AttendanceType.CHECK_IN,
                    photo_url=photo_url,
                    photo_public_id=photo_public_id,
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
        except GeofenceValidationError as exc:
            return Response(
                {"detail": exc.message, "status": "failed"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except ValidationError as exc:
            print("[CHECKIN ERROR]", exc)
            return Response({"detail": str(exc.detail if hasattr(exc, "detail") else exc), "status": "failed"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            print("[CHECKIN ERROR]", traceback.format_exc())
            return Response({"detail": str(exc), "status": "failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
                if str(request.data.get("face_match", "")).lower() not in {"1", "true", "yes", "on"}:
                    return Response({"detail": "Face match not confirmed on the client."}, status=status.HTTP_400_BAD_REQUEST)
                latitude = float(request.data["latitude"])
                longitude = float(request.data["longitude"])
                accuracy = float(request.data.get("accuracy") or 0)
                assignment = get_active_assignment(employee)
                validate_geofence(employee, assignment, latitude, longitude, accuracy)
                location_text = request.data.get("address") or request.data.get("location") or f"Lat: {latitude:.4f}, Lon: {longitude:.4f}"
                upload_result = upload_selfie(
                    selfie,
                    folder="attendance",
                    employee=employee,
                    timestamp=request.data.get("timestamp") or None,
                    location=location_text,
                )
                photo_url = upload_result["url"]
                photo_public_id = upload_result["public_id"]
                attendance = record_attendance(
                    employee=employee,
                    assignment=get_active_assignment(employee),
                    session=session,
                    attendance_type=Attendance.AttendanceType.CHECK_OUT,
                    photo_url=photo_url,
                    photo_public_id=photo_public_id,
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
        except GeofenceValidationError as exc:
            return Response(
                {"success": False, "status": "failed", "message": "Attendance not marked."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except ValidationError as exc:
            print("[CHECKOUT ERROR]", exc)
            return Response({"success": False, "status": "failed", "message": "Attendance not marked."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            print("[CHECKOUT ERROR]", traceback.format_exc())
            return Response({"success": False, "status": "failed", "message": "Attendance not marked."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AttendanceListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Attendance.objects.select_related("employee", "assignment", "session").all()
        if getattr(request.user, "role", None) == "EMPLOYEE":
            queryset = queryset.filter(employee_id=request.user.employee_id)
        employee_id = request.query_params.get("employee_id")
        if employee_id:
            if str(employee_id).isdigit():
                queryset = queryset.filter(Q(employee__employee_id=employee_id) | Q(employee__id=int(employee_id)))
            else:
                queryset = queryset.filter(employee__employee_id=employee_id)
        return Response(AttendanceSerializer(queryset, many=True).data)


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
        response["Access-Control-Expose-Headers"] = "Content-Disposition"
        return response


class ManualAttendanceEditView(APIView):
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from datetime import date, datetime, time, timedelta
        from django.utils import timezone

        employee_ids = request.data.get("employee_ids") or []
        if isinstance(employee_ids, (int, str)):
            employee_ids = [employee_ids]

        dates = request.data.get("dates") or []
        single_date = request.data.get("date")
        if single_date and single_date not in dates:
            dates.append(single_date)

        start_date = request.data.get("start_date")
        end_date = request.data.get("end_date")
        if start_date and end_date:
            try:
                s_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                e_date = datetime.strptime(end_date, "%Y-%m-%d").date()
                curr = s_date
                while curr <= e_date:
                    d_str = curr.strftime("%Y-%m-%d")
                    if d_str not in dates:
                        dates.append(d_str)
                    curr += timedelta(days=1)
            except ValueError:
                pass

        if not employee_ids:
            return Response({"detail": "Please select at least one candidate."}, status=status.HTTP_400_BAD_REQUEST)

        if not dates:
            return Response({"detail": "Please select at least one date or date range."}, status=status.HTTP_400_BAD_REQUEST)

        status_str = (request.data.get("status") or "PRESENT").upper()
        time_from_str = request.data.get("time_from") or "09:00"
        time_to_str = request.data.get("time_to") or "18:00"
        remarks = request.data.get("remarks") or "Admin manual update"

        employees = Employee.objects.filter(id__in=employee_ids)
        if not employees.exists():
            employees = Employee.objects.filter(employee_id__in=employee_ids)

        if not employees.exists():
            return Response({"detail": "No matching employees found."}, status=status.HTTP_400_BAD_REQUEST)

        updated_count = 0
        now_date = timezone.now().date()

        for emp in employees:
            for d_str in dates:
                try:
                    target_date = datetime.strptime(d_str, "%Y-%m-%d").date()
                except ValueError:
                    continue

                if status_str == "ABSENT":
                    Attendance.objects.filter(employee=emp, session__login_time__date=target_date).delete()
                    Attendance.objects.filter(employee=emp, timestamp__date=target_date).delete()
                    Attendance.objects.filter(employee=emp, created_at__date=target_date).delete()
                    Session.objects.filter(employee=emp, login_time__date=target_date).delete()
                    updated_count += 1
                else:  # PRESENT
                    try:
                        tf_clean = time_from_str.split()[0]
                        tf_parts = [int(p) for p in tf_clean.split(":")[:2]]
                        t_from = time(tf_parts[0], tf_parts[1])
                    except Exception:
                        t_from = time(9, 0)

                    try:
                        tt_clean = time_to_str.split()[0]
                        tt_parts = [int(p) for p in tt_clean.split(":")[:2]]
                        t_to = time(tt_parts[0], tt_parts[1])
                    except Exception:
                        t_to = time(18, 0)

                    naive_in = datetime.combine(target_date, t_from)
                    naive_out = datetime.combine(target_date, t_to)

                    login_dt = timezone.make_aware(naive_in) if timezone.is_naive(naive_in) else naive_in
                    logout_dt = timezone.make_aware(naive_out) if timezone.is_naive(naive_out) else naive_out

                    session = Session.objects.filter(employee=emp, login_time__date=target_date).order_by("-login_time").first()
                    is_active_session = target_date == now_date and not time_to_str

                    if not session:
                        session = Session.objects.create(employee=emp, is_active=is_active_session)

                    Session.objects.filter(pk=session.pk).update(
                        login_time=login_dt,
                        logout_time=logout_dt if not is_active_session else None,
                        is_active=is_active_session,
                    )

                    att, _ = Attendance.objects.get_or_create(
                        employee=emp,
                        session=session,
                        attendance_type=Attendance.AttendanceType.CHECK_IN,
                        defaults={
                            "latitude": emp.default_latitude or 17.4435,
                            "longitude": emp.default_longitude or 78.3772,
                            "address": emp.default_address or "Manual Entry by Admin",
                            "status": Attendance.Status.APPROVED,
                            "remarks": remarks,
                        },
                    )
                    Attendance.objects.filter(pk=att.pk).update(
                        timestamp=login_dt,
                        created_at=login_dt,
                        status=Attendance.Status.APPROVED,
                        remarks=remarks,
                    )
                    updated_count += 1

        return Response({
            "detail": f"Successfully updated attendance for {len(employees)} candidate(s) across {len(dates)} date(s).",
            "updated_count": updated_count,
        })


class EmployeeMonthAttendanceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee_id = request.query_params.get("employee_id")
        year_str = request.query_params.get("year")
        month_str = request.query_params.get("month")

        if not employee_id:
            return Response({"detail": "employee_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        now = datetime.now()
        year = int(year_str) if year_str and year_str.isdigit() else now.year
        month = int(month_str) if month_str and month_str.isdigit() else now.month

        employee = Employee.objects.filter(employee_id=employee_id).first()
        if not employee:
            try:
                employee = Employee.objects.filter(pk=int(employee_id)).first()
            except (ValueError, TypeError):
                pass
        if not employee:
            return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

        num_days = calendar.monthrange(year, month)[1]
        start_date = date(year, month, 1)
        end_date = date(year, month, num_days)

        sessions = list(Session.objects.filter(employee=employee, login_time__date__range=(start_date, end_date)).order_by("login_time"))
        attendances = list(Attendance.objects.filter(employee=employee, timestamp__date__range=(start_date, end_date)).order_by("timestamp"))

        days_data = []
        present_count = 0
        unmarked_count = 0

        for d in range(1, num_days + 1):
            curr_date = date(year, month, d)
            date_str = curr_date.strftime("%Y-%m-%d")
            day_name = curr_date.strftime("%a")

            session = next(
                (s for s in sessions if s.login_time and timezone.localtime(s.login_time).date() == curr_date),
                None
            )
            attendance_rec = next(
                (a for a in attendances if a.timestamp and timezone.localtime(a.timestamp).date() == curr_date),
                None
            )

            if not session and not attendance_rec:
                days_data.append({
                    "date": date_str,
                    "day_number": d,
                    "day_name": day_name,
                    "status": "UNMARKED",
                    "check_in": None,
                    "check_out": None,
                    "total_hours": None,
                })
                unmarked_count += 1
            else:
                present_count += 1
                login_time = session.login_time if session else attendance_rec.timestamp
                logout_time = session.logout_time if session else None

                check_in_str = timezone.localtime(login_time).strftime("%I:%M %p") if login_time else None
                check_out_str = timezone.localtime(logout_time).strftime("%I:%M %p") if logout_time else (
                    "Active" if session and session.is_active else None
                )

                hours_str = "Present"
                if session and session.is_active:
                    diff = timezone.now() - login_time
                    h = int(diff.total_seconds() // 3600)
                    m = int((diff.total_seconds() % 3600) // 60)
                    hours_str = f"{h}h {m}m"
                elif logout_time:
                    diff = logout_time - login_time
                    h = int(diff.total_seconds() // 3600)
                    m = int((diff.total_seconds() % 3600) // 60)
                    hours_str = f"{h}h {m}m"

                days_data.append({
                    "date": date_str,
                    "day_number": d,
                    "day_name": day_name,
                    "status": "PRESENT",
                    "check_in": check_in_str,
                    "check_out": check_out_str,
                    "total_hours": hours_str,
                })

        js_starting_day = (start_date.weekday() + 1) % 7
        return Response({
            "employee_id": employee.employee_id,
            "employee_name": employee.name,
            "profile_photo": employee.profile_photo,
            "year": year,
            "month": month,
            "month_name": date(year, month, 1).strftime("%B %Y"),
            "starting_day_of_week": js_starting_day,
            "total_days": num_days,
            "present_count": present_count,
            "unmarked_count": unmarked_count,
            "days": days_data,
        })


