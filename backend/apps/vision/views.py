from __future__ import annotations

from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Employee
from apps.common.permissions import IsEmployeeRole
from apps.vision.serializers import FaceRegisterSerializer, FaceVerifySerializer
from apps.vision.services import FaceRecognitionService, LivenessService

face_service = FaceRecognitionService()
liveness_service = LivenessService()


class FaceRegisterView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsEmployeeRole]

    def post(self, request):
        serializer = FaceRegisterSerializer(data={"selfies": request.FILES.getlist("selfies")})
        serializer.is_valid(raise_exception=True)
        employee = Employee.objects.get(pk=request.user.employee_id)
        embeddings = [face_service.generate_embedding(file_obj) for file_obj in serializer.validated_data["selfies"]]
        employee.face_embedding = embeddings
        employee.save(update_fields=["face_embedding"])
        return Response({"detail": "Face registered.", "embedding_count": len(embeddings)}, status=status.HTTP_201_CREATED)


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
        # Generate embedding on the fly if profile_photo exists but face_embedding is empty
        if not employee.face_embedding and employee.profile_photo:
            try:
                import requests
                res = requests.get(employee.profile_photo, timeout=10)
                res.raise_for_status()
                emb = face_service.generate_embedding(res.content)
                employee.face_embedding = [emb]
                employee.save(update_fields=["face_embedding"])
            except Exception as exc:
                return Response({"detail": f"Failed to extract face embedding from profile photo: {exc}"}, status=status.HTTP_400_BAD_REQUEST)

        if not employee.face_embedding:
            return Response({"detail": "Face not registered."}, status=status.HTTP_400_BAD_REQUEST)

        if not liveness_service.is_live(serializer.validated_data["selfie"], request.data.get("liveness_score")):
            return Response({"detail": "Liveness check failed."}, status=status.HTTP_400_BAD_REQUEST)
        incoming = face_service.generate_embedding(serializer.validated_data["selfie"])
        score = face_service.compare_with_store(incoming, employee.face_embedding)
        return Response({"match": score >= face_service.similarity_threshold, "similarity_score": score})
