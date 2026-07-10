from rest_framework import serializers

from apps.attendance.models import Attendance, Session


class SessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Session
        fields = ["id", "employee", "login_time", "logout_time", "is_active", "created_at"]


class AttendanceSerializer(serializers.ModelSerializer):
    employee_employee_id = serializers.CharField(source="employee.employee_id", read_only=True)
    employee_name = serializers.CharField(source="employee.name", read_only=True)
    assignment_patient_name = serializers.CharField(source="assignment.patient_name", read_only=True)
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = Attendance
        fields = [
            "id",
            "employee",
            "employee_employee_id",
            "employee_name",
            "assignment",
            "assignment_patient_name",
            "session",
            "attendance_type",
            "photo_url",
            "latitude",
            "longitude",
            "address",
            "timestamp",
            "status",
            "remarks",
            "created_at",
        ]
        read_only_fields = ["timestamp"]

    def get_photo_url(self, obj: Attendance) -> str:
        if not obj.photo_url:
            return ""
        if obj.photo_url.startswith("/"):
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.photo_url)
            return f"http://localhost:8000{obj.photo_url}"
        return obj.photo_url
