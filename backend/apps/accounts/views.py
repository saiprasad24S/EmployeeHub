import logging
logger = logging.getLogger(__name__)
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView



from django.db.models import Q
from django.utils import timezone

from apps.accounts.authentication import ClerkJWTAuthentication
from apps.accounts.models import Employee, SalaryCheckItem
from apps.accounts.serializers import EmployeeCreateSerializer, EmployeeSerializer, SalaryCheckItemSerializer
from apps.assignments.models import Assignment
from apps.attendance.models import Session
from apps.attendance.services import get_employee_presence_summary, end_session, upload_profile_photo
from apps.common.permissions import IsAdminRole
from apps.vision.services import FaceService

vision_service = FaceService()


class AuthLoginView(APIView):
    authentication_classes = [ClerkJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        principal = request.user
        if getattr(principal, "role", None) == "ADMIN":
            return Response(
                {
                    "role": "ADMIN",
                    "email": principal.email,
                    "admin_id": principal.admin_id,
                    "redirect_to": "/admin",
                }
            )
        if getattr(principal, "role", None) == "EMPLOYEE":
            employee = Employee.objects.filter(pk=principal.employee_id).first()
            if not employee:
                return Response({"detail": "Employee profile not found."}, status=status.HTTP_404_NOT_FOUND)
            if not employee.is_active:
                return Response(
                    {"detail": "Account Inactive: Your employee profile has been deactivated. You no longer have access to the employee portal."},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            from django.utils import timezone
            today = timezone.localdate()
            # Auto-close any stale active sessions from previous dates
            Session.objects.filter(employee=employee, is_active=True, login_time__date__lt=today).update(is_active=False)

            presence_summary = get_employee_presence_summary(employee)
            active_session = bool(
                presence_summary.get("session")
                and presence_summary.get("status") == "Present"
                and getattr(presence_summary.get("session"), "is_active", False)
            )
            return Response(
                {
                    "role": "EMPLOYEE",
                    "email": principal.email,
                    "employee": EmployeeSerializer(employee).data,
                    "requires_face_registration": not bool(employee.face_embedding or employee.profile_photo),
                    "active_session": active_session,
                    "session_summary": {
                        "active_session": active_session,
                        "check_in_time": presence_summary.get("check_in_time"),
                        "check_out_time": presence_summary.get("check_out_time"),
                        "session_duration_seconds": presence_summary.get("session_duration_seconds"),
                        "is_present": presence_summary.get("is_present", False),
                        "status": presence_summary.get("status", "Absent"),
                    },
                }
            )
        return Response({"detail": "Only registered employees and admins can access the dashboard."}, status=status.HTTP_403_FORBIDDEN)


class AuthLogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if getattr(request.user, "role", None) == "EMPLOYEE" and getattr(request.user, "employee_id", None):
            employee = Employee.objects.filter(pk=request.user.employee_id).first()
            if employee:
                try:
                    end_session(employee)
                except Exception:
                    pass
        return Response({"detail": "Logged out."})


class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.all().defer("face_embedding").order_by("employee_id")
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = None
    filterset_fields = ["department", "designation", "is_active"]
    search_fields = ["employee_id", "name", "email"]

    def get_permissions(self):
        if self.action in {"create", "destroy"}:
            return [IsAdminRole()]
        return [IsAuthenticated()]

    def list(self, request, *args, **kwargs):
        from datetime import time as dt_time, datetime as dt_datetime
        from django.db.models import Max, Case, When, Value, BooleanField
        from apps.attendance.models import Attendance

        queryset = (
            self.filter_queryset(self.get_queryset())
            .annotate(
                has_face_embedding=Case(
                    When(face_embedding__isnull=False, then=Value(True)),
                    default=Value(False),
                    output_field=BooleanField(),
                )
            )
            .defer("face_embedding")
        )
        employees = list(queryset)
        if employees:
            today = timezone.localdate()
            tz = timezone.get_current_timezone()
            start_dt = timezone.make_aware(dt_datetime.combine(today, dt_time.min), tz)
            end_dt = timezone.make_aware(dt_datetime.combine(today, dt_time.max), tz)
            emp_ids = [e.id for e in employees]

            # 1. Bulk-fetch today's sessions in a single index-accelerated query
            sessions = (
                Session.objects.filter(employee_id__in=emp_ids, login_time__range=(start_dt, end_dt))
                .order_by("-login_time")
            )
            sessions_by_emp = {}
            for s in sessions:
                if s.employee_id not in sessions_by_emp:
                    sessions_by_emp[s.employee_id] = s

            # Pre-compute presence summary on each employee
            now = timezone.now()
            for emp in employees:
                session = sessions_by_emp.get(emp.id)
                if not session:
                    emp._cached_presence_summary = {
                        "is_present": False,
                        "status": "Absent",
                        "check_in_time": None,
                        "check_out_time": None,
                        "session_duration_seconds": 0,
                        "session": None,
                    }
                elif session.is_active or not session.logout_time:
                    dur = max(int((now - session.login_time).total_seconds()), 0) if session.login_time else 0
                    emp._cached_presence_summary = {
                        "is_present": True,
                        "status": "Present",
                        "check_in_time": session.login_time,
                        "check_out_time": None,
                        "session_duration_seconds": dur,
                        "session": session,
                    }
                else:
                    logout = session.logout_time or session.login_time
                    dur = max(int((logout - session.login_time).total_seconds()), 0) if session.login_time else 0
                    emp._cached_presence_summary = {
                        "is_present": True,
                        "status": "Checked Out",
                        "check_in_time": session.login_time,
                        "check_out_time": logout,
                        "session_duration_seconds": dur,
                        "session": session,
                    }

            # 2. Bulk-fetch today's active assignments in a single query
            assignments = (
                Assignment.objects.filter(employee_id__in=emp_ids, visit_date=today)
                .exclude(status=Assignment.Status.CANCELLED)
                .order_by("-created_at")
            )
            assign_by_emp = {}
            for a in assignments:
                if a.employee_id not in assign_by_emp:
                    assign_by_emp[a.employee_id] = a
            for emp in employees:
                emp._cached_active_assignment = assign_by_emp.get(emp.id)

            # 3. Bulk-fetch latest check-in photos for employees without direct profile_photo
            emps_needing_photo = [
                e.id for e in employees
                if not (e.profile_photo and str(e.profile_photo).startswith("http"))
            ]
            if emps_needing_photo:
                latest_photo_ids = (
                    Attendance.objects.filter(
                        employee_id__in=emps_needing_photo,
                        attendance_type=Attendance.AttendanceType.CHECK_IN,
                    )
                    .exclude(photo_url="")
                    .values("employee_id")
                    .annotate(max_id=Max("id"))
                    .values_list("max_id", flat=True)
                )
                photo_records = Attendance.objects.filter(id__in=list(latest_photo_ids)).only("employee_id", "photo_url")
                photo_map = {att.employee_id: att.photo_url for att in photo_records}
                for emp in employees:
                    emp._cached_profile_photo = photo_map.get(emp.id, "")
            else:
                for emp in employees:
                    emp._cached_profile_photo = emp.profile_photo or ""

        serializer = self.get_serializer(employees, many=True)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        remark = request.query_params.get("remark") or request.data.get("remark") or "No remark provided"
        print(f"[EMPLOYEE DELETED] ID: {instance.employee_id}, Name: {instance.name}, Remark: {remark}")
        self.perform_destroy(instance)
        return Response({"detail": f"Employee {instance.name} deleted successfully.", "remark": remark}, status=status.HTTP_200_OK)

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return EmployeeCreateSerializer
        return super().get_serializer_class()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        employee = serializer.save()
        try:
            SalaryCheckItem.objects.get_or_create(
                employee=employee,
                defaults={"is_custom": False, "salary": 0.00, "is_paid": False, "is_hidden": False}
            )
        except Exception as e:
            logger.warning(f"Failed to auto-create SalaryCheckItem for employee {employee.id}: {e}")
        if employee.default_address and (employee.default_latitude is None or employee.default_longitude is None):
            from apps.attendance.services import ensure_default_coordinates
            ensure_default_coordinates(employee)
        elif employee.default_latitude is not None and employee.default_longitude is not None and not employee.default_address:
            from apps.attendance.services import ensure_default_address
            ensure_default_address(employee)
        if request.FILES.get("profile_photo_file"):
            photo_file = request.FILES["profile_photo_file"]
            photo_file.seek(0)
            try:
                vision_service.register_face(employee, photo_file)
            except Exception:
                pass
            photo_file.seek(0)
            upload_result = upload_profile_photo(
                photo_file,
                employee_id=employee.employee_id,
                employee_name=employee.name,
            )
            employee.profile_photo = upload_result["url"]
            employee.profile_photo_public_id = upload_result["public_id"]
            employee.save(update_fields=["profile_photo", "profile_photo_public_id"])
        return Response(EmployeeSerializer(employee, context={"request": request}).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", True)
        instance = self.get_object()

        old_address = (instance.default_address or "").strip()
        new_address = (request.data.get("default_address") or "").strip()
        address_changed = bool(new_address and new_address != old_address)

        req_lat = request.data.get("default_latitude")
        req_lon = request.data.get("default_longitude")
        old_lat = str(instance.default_latitude or "")
        old_lon = str(instance.default_longitude or "")
        coords_manually_changed = bool(
            (req_lat not in (None, "") and str(req_lat) != old_lat) or
            (req_lon not in (None, "") and str(req_lon) != old_lon)
        )

        prev_lat = instance.default_latitude
        prev_lon = instance.default_longitude

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        employee = serializer.save()

        # If employee was marked inactive, end any active sessions immediately
        if not employee.is_active:
            try:
                from apps.attendance.services import end_session
                end_session(employee)
            except Exception:
                pass
            Session.objects.filter(employee=employee, is_active=True).update(is_active=False)

        # Automatically re-geocode if address changed and user didn't manually type new coordinates
        if address_changed and not coords_manually_changed:
            from apps.attendance.services import ensure_default_coordinates
            try:
                geocoded = ensure_default_coordinates(employee, force=True)
                if not geocoded and prev_lat is not None and prev_lon is not None:
                    employee.default_latitude = prev_lat
                    employee.default_longitude = prev_lon
                    employee.save(update_fields=["default_latitude", "default_longitude"])
            except Exception as e:
                logger.warning(f"Failed to auto-geocode on employee update: {e}")
        elif employee.default_address and (employee.default_latitude is None or employee.default_longitude is None):
            from apps.attendance.services import ensure_default_coordinates
            try:
                ensure_default_coordinates(employee, force=False)
            except Exception as e:
                logger.warning(f"Failed to ensure coordinates: {e}")
        elif employee.default_latitude is not None and employee.default_longitude is not None and not employee.default_address:
            from apps.attendance.services import ensure_default_address
            try:
                ensure_default_address(employee)
            except Exception as e:
                logger.warning(f"Failed to ensure address: {e}")
        
        photo_file = request.FILES.get("profile_photo_file") or request.data.get("profile_photo_file")
        if photo_file and hasattr(photo_file, "read"):
            photo_file.seek(0)
            try:
                vision_service.register_face(employee, photo_file)
            except Exception:
                pass
            photo_file.seek(0)
            upload_result = upload_profile_photo(
                photo_file,
                employee_id=employee.employee_id,
                employee_name=employee.name,
            )
            employee.profile_photo = upload_result["url"]
            employee.profile_photo_public_id = upload_result["public_id"]
            employee.updated_at = timezone.now()
            employee.save(update_fields=["profile_photo", "profile_photo_public_id", "updated_at"])
        return Response(EmployeeSerializer(employee, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="upload-photo")
    def upload_photo(self, request, pk=None):
        employee = self.get_object()
        photo_file = request.FILES.get("profile_photo_file") or request.data.get("profile_photo_file")
        if not photo_file or not hasattr(photo_file, "read"):
            return Response({"detail": "No valid profile_photo_file provided."}, status=status.HTTP_400_BAD_REQUEST)
        photo_file.seek(0)
        try:
            vision_service.register_face(employee, photo_file)
        except Exception:
            pass
        photo_file.seek(0)
        upload_result = upload_profile_photo(
            photo_file,
            employee_id=employee.employee_id,
            employee_name=employee.name,
        )
        employee.profile_photo = upload_result["url"]
        employee.profile_photo_public_id = upload_result["public_id"]
        employee.updated_at = timezone.now()
        employee.save(update_fields=["profile_photo", "profile_photo_public_id", "updated_at"])
        return Response(EmployeeSerializer(employee, context={"request": request}).data)


class CurrentEmployeeView(APIView):
    def get(self, request):
        if getattr(request.user, "role", None) == "ADMIN":
            employee = Employee.objects.filter(pk=request.query_params.get("employee_id")).first()
        else:
            employee = Employee.objects.filter(pk=getattr(request.user, "employee_id", None)).first()
        if not employee:
            return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(EmployeeSerializer(employee).data)


class UploadProfilePhotoView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        employee = Employee.objects.filter(pk=pk).first()
        if not employee:
            return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

        photo_file = request.FILES.get("profile_photo_file")
        if not photo_file:
            return Response({"detail": "No photo file provided."}, status=status.HTTP_400_BAD_REQUEST)

        upload_result = upload_profile_photo(
            photo_file,
            employee_id=employee.employee_id,
            employee_name=employee.name,
        )
        employee.profile_photo = upload_result["url"]
        employee.profile_photo_public_id = upload_result["public_id"]
        employee.save(update_fields=["profile_photo", "profile_photo_public_id"])
        return Response({"detail": "Profile photo updated.", "profile_photo": employee.profile_photo})


class SalaryCheckViewSet(viewsets.ModelViewSet):
    queryset = SalaryCheckItem.objects.all()
    serializer_class = SalaryCheckItemSerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        # 1. Sync active employees into SalaryCheckItem:
        # Every Employee with is_active=True gets a SalaryCheckItem if not already present
        active_employees = Employee.objects.filter(is_active=True)
        existing_emp_ids = set(
            SalaryCheckItem.objects.filter(employee__isnull=False).values_list("employee_id", flat=True)
        )
        new_items = []
        for emp in active_employees:
            if emp.id not in existing_emp_ids:
                new_items.append(
                    SalaryCheckItem(
                        employee=emp,
                        is_custom=False,
                        salary=0.00,
                        is_paid=False,
                        is_hidden=False,
                    )
                )
        if new_items:
            SalaryCheckItem.objects.bulk_create(new_items)

        # 2. Return all items where either is_custom=True OR employee.is_active=True, excluding hidden
        # Former/inactive employees and manually removed employees are excluded from Salary Check
        items = SalaryCheckItem.objects.filter(
            (Q(is_custom=True) | Q(employee__is_active=True)) & Q(is_hidden=False)
        ).select_related("employee").order_by("-is_custom", "employee__employee_id", "id")

        serializer = self.get_serializer(items, many=True)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        item = self.get_object()
        if item.is_custom:
            item.delete()
        else:
            item.is_hidden = True
            item.save(update_fields=["is_hidden"])
        return Response({"detail": "Removed from Salary Check."}, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        name = (request.data.get("name") or request.data.get("custom_name") or "").strip()
        if not name:
            return Response({"detail": "Name is required."}, status=status.HTTP_400_BAD_REQUEST)

        emp_id = (request.data.get("emp_id") or request.data.get("custom_emp_id") or "").strip()
        if not emp_id:
            count = SalaryCheckItem.objects.filter(is_custom=True).count() + 1
            emp_id = f"VEND-{count:03d}"

        phone = (request.data.get("contact_no") or request.data.get("custom_phone") or request.data.get("phone") or "").strip()
        pic = (request.data.get("pic") or request.data.get("custom_pic") or "").strip()
        salary = request.data.get("salary") or 0.00

        item = SalaryCheckItem.objects.create(
            is_custom=True,
            custom_name=name,
            custom_emp_id=emp_id,
            custom_phone=phone,
            custom_pic=pic,
            salary=salary,
            is_paid=False,
        )
        return Response(self.get_serializer(item).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        item = self.get_object()
        if "salary" in request.data:
            try:
                item.salary = float(request.data["salary"])
            except (ValueError, TypeError):
                pass
        if "is_paid" in request.data:
            val = request.data["is_paid"]
            if isinstance(val, str):
                val = val.lower() in ("true", "1", "yes")
            item.is_paid = bool(val)
            item.paid_at = timezone.now() if item.is_paid else None

        if "is_hidden" in request.data:
            val = request.data["is_hidden"]
            if isinstance(val, str):
                val = val.lower() in ("true", "1", "yes")
            item.is_hidden = bool(val)

        if item.is_custom:
            if "name" in request.data:
                item.custom_name = request.data["name"]
            if "emp_id" in request.data:
                item.custom_emp_id = request.data["emp_id"]
            if "contact_no" in request.data:
                item.custom_phone = request.data["contact_no"]
            if "pic" in request.data:
                item.custom_pic = request.data["pic"]

        item.save()
        return Response(self.get_serializer(item).data)

    def update(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)

    @action(detail=False, methods=["post"], url_path="reset")
    def reset(self, request):
        SalaryCheckItem.objects.all().update(is_paid=False, paid_at=None)
        return Response({"detail": "All salary payment statuses have been reset to default (Unpaid).", "status": "ok"})

