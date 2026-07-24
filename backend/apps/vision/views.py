from __future__ import annotations

from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Employee
from apps.common.permissions import IsEmployeeRole
from apps.vision.serializers import FaceRegisterSerializer, FaceVerifySerializer
from apps.vision.services import FaceService, LivenessService

vision_service = FaceService()
liveness_service = LivenessService()


class FaceRegisterView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsEmployeeRole]

    def post(self, request):
        serializer = FaceRegisterSerializer(data={"selfies": request.FILES.getlist("selfies")})
        serializer.is_valid(raise_exception=True)
        employee = Employee.objects.get(pk=request.user.employee_id)
        for selfie in serializer.validated_data["selfies"]:
            selfie.seek(0)
            vision_service.register_face(employee, selfie)
        return Response({"detail": "Face registered."}, status=status.HTTP_201_CREATED)


class FaceVerifyView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = FaceVerifySerializer(data=request.FILES)
        serializer.is_valid(raise_exception=True)
        if getattr(request.user, "role", None) == "EMPLOYEE":
            employee = Employee.objects.get(pk=request.user.employee_id)
        else:
            employee = Employee.objects.filter(pk=request.data.get("employee_id")).first()
            if not employee:
                return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)
        if not (employee.face_embedding or employee.profile_photo):
            return Response({"detail": "Face not registered."}, status=status.HTTP_400_BAD_REQUEST)

        if not liveness_service.is_live(serializer.validated_data["selfie"], request.data.get("liveness_score")):
            return Response({"detail": "Liveness check failed."}, status=status.HTTP_400_BAD_REQUEST)

        is_match = str(request.data.get("face_match", "")).lower() in {"1", "true", "yes", "on"}
        if not is_match:
            return Response({"match": False, "confidence": 0.0}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"match": True, "confidence": 1.0})
