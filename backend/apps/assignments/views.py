from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils import timezone

from apps.assignments.models import Assignment
from apps.assignments.serializers import AssignmentSerializer
from apps.common.permissions import IsAdminRole, IsEmployeeRole
from apps.accounts.models import Employee


class AssignmentViewSet(viewsets.ModelViewSet):
    queryset = Assignment.objects.select_related("employee").all()
    serializer_class = AssignmentSerializer
    permission_classes = [IsAdminRole]
    filterset_fields = ["employee", "status", "visit_date"]
    search_fields = ["patient_name", "patient_address", "employee__employee_id", "employee__name"]

    def perform_create(self, serializer):
        serializer.save()


class MyTodayAssignmentView(APIView):
    permission_classes = [IsEmployeeRole]

    def get(self, request):
        employee = Employee.objects.filter(pk=getattr(request.user, "employee_id", None)).first()
        if not employee:
            return Response({"detail": "Employee profile not found."}, status=404)
        today = timezone.localdate()
        assignment = Assignment.objects.filter(employee=employee, visit_date=today).exclude(status=Assignment.Status.CANCELLED).first()
        if not assignment:
            return Response({"detail": "No assignment scheduled for today."}, status=404)
        return Response(AssignmentSerializer(assignment).data)
