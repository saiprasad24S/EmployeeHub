from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.authentication import ClerkJWTAuthentication
from apps.accounts.models import Employee
from apps.accounts.serializers import EmployeeCreateSerializer, EmployeeSerializer
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
            employee = Employee.objects.get(id=principal.employee_id)
            return Response(
                {
                    "role": "EMPLOYEE",
                    "email": principal.email,
                    "employee": EmployeeSerializer(employee).data,
                    "requires_face_registration": not bool(employee.face_embedding),
                }
            )
        return Response({"detail": "Unable to resolve account role."}, status=status.HTTP_400_BAD_REQUEST)


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
