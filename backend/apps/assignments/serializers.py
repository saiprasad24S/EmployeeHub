from rest_framework import serializers

from apps.assignments.models import Assignment


class AssignmentSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.name", read_only=True)
    employee_employee_id = serializers.CharField(source="employee.employee_id", read_only=True)

    class Meta:
        model = Assignment
        fields = [
            "id",
            "employee",
            "employee_name",
            "employee_employee_id",
            "patient_name",
            "patient_address",
            "latitude",
            "longitude",
            "radius",
            "visit_date",
            "status",
            "created_at",
        ]
