import cloudinary.uploader
from rest_framework import status, viewsets
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.core.exceptions import ValidationError

from apps.accounts.authentication import ClerkJWTAuthentication
from apps.accounts.models import Employee
from apps.accounts.serializers import EmployeeCreateSerializer, EmployeeSerializer
from apps.attendance.services import get_employee_presence_summary
from apps.attendance.models import Session
from apps.attendance.services import end_session, upload_profile_photo
from apps.common.permissions import IsAdminRole
from apps.vision.services import FaceRecognitionService

face_service = FaceRecognitionService()


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
            active_session = Session.objects.filter(employee=employee, is_active=True).exists()
            presence_summary = get_employee_presence_summary(employee)
            return Response(
                {
                    "role": "EMPLOYEE",
                    "email": principal.email,
                    "employee": EmployeeSerializer(employee).data,
                    "requires_face_registration": not bool(employee.face_embedding),
                    "active_session": active_session,
                    "session_summary": {
                        "active_session": active_session,
                        "check_in_time": presence_summary.get("check_in_time"),
                        "check_out_time": presence_summary.get("check_out_time"),
                        "session_duration_seconds": presence_summary.get("session_duration_seconds"),
                        "is_present": presence_summary.get("is_present"),
                        "status": presence_summary.get("status"),
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
    permission_classes = [IsAdminRole]
    filterset_fields = ["department", "designation", "is_active"]
    search_fields = ["employee_id", "name", "email"]

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return EmployeeCreateSerializer
        return super().get_serializer_class()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        employee = serializer.save()
        if request.FILES.get("profile_photo_file"):
            photo_file = request.FILES["profile_photo_file"]
            photo_file.seek(0)
            try:
                employee.face_embedding = face_service.generate_embedding(photo_file)
            except Exception:
                employee.face_embedding = None
            photo_file.seek(0)
            upload_result = upload_profile_photo(
                photo_file,
                employee_id=employee.employee_id,
                employee_name=employee.name,
            )
            employee.profile_photo = upload_result["url"]
            employee.profile_photo_public_id = upload_result["public_id"]
            employee.save(update_fields=["profile_photo", "profile_photo_public_id", "face_embedding"])
        return Response(EmployeeSerializer(employee, context={"request": request}).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        employee = serializer.save()
        if request.FILES.get("profile_photo_file"):
            photo_file = request.FILES["profile_photo_file"]
            photo_file.seek(0)
            try:
                employee.face_embedding = face_service.generate_embedding(photo_file)
            except Exception:
                employee.face_embedding = None
            photo_file.seek(0)
            upload_result = upload_profile_photo(
                photo_file,
                employee_id=employee.employee_id,
                employee_name=employee.name,
            )
            employee.profile_photo = upload_result["url"]
            employee.profile_photo_public_id = upload_result["public_id"]
            employee.save(update_fields=["profile_photo", "profile_photo_public_id", "face_embedding"])
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
