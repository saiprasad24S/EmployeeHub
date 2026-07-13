import cloudinary.uploader
from rest_framework import status, viewsets
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.authentication import ClerkJWTAuthentication
from apps.accounts.models import Employee
from apps.accounts.serializers import EmployeeCreateSerializer, EmployeeSerializer
from apps.attendance.services import upload_selfie
from apps.common.permissions import IsAdminRole


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
            return Response(
                {
                    "role": "EMPLOYEE",
                    "email": principal.email,
                    "employee": EmployeeSerializer(employee).data,
                    "requires_face_registration": not bool(employee.face_embedding),
                }
            )
        return Response({"detail": "Only registered employees and admins can access the dashboard."}, status=status.HTTP_403_FORBIDDEN)


class AuthLogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
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

        employee.profile_photo = upload_selfie(
            photo_file,
            folder="profile_photos",
            timestamp=request.data.get("timestamp") or None,
            location=request.data.get("location") or None,
        )
        employee.save(update_fields=["profile_photo"])
        return Response({"detail": "Profile photo updated.", "profile_photo": employee.profile_photo})
