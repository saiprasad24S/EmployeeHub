from rest_framework import status, viewsets
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView



from django.utils import timezone

from apps.accounts.authentication import ClerkJWTAuthentication
from apps.accounts.models import Employee
from apps.accounts.serializers import EmployeeCreateSerializer, EmployeeSerializer
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
    queryset = Employee.objects.all().order_by("employee_id")
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    pagination_class = None
    filterset_fields = ["department", "designation", "is_active"]
    search_fields = ["employee_id", "name", "email"]

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [IsAdminRole()]
        return [IsAuthenticated()]

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        employees = list(queryset)
        if employees:
            today = timezone.localdate()
            emp_ids = [e.id for e in employees]

            # 1. Bulk-fetch today's sessions in a single query
            sessions = (
                Session.objects.filter(employee_id__in=emp_ids, login_time__date=today)
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
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        employee = serializer.save()
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
