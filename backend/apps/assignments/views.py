from rest_framework import viewsets

from apps.assignments.models import Assignment
from apps.assignments.serializers import AssignmentSerializer
from apps.common.permissions import IsAdminRole


class AssignmentViewSet(viewsets.ModelViewSet):
    queryset = Assignment.objects.select_related("employee").all()
    serializer_class = AssignmentSerializer
    permission_classes = [IsAdminRole]
    filterset_fields = ["employee", "status", "visit_date"]
    search_fields = ["patient_name", "patient_address", "employee__employee_id", "employee__name"]

    def perform_create(self, serializer):
        serializer.save()
