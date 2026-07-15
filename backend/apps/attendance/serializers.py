from rest_framework import serializers

from apps.attendance.models import Attendance, Session
from apps.attendance.services import get_employee_presence_summary


class SessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Session
        fields = ["id", "employee", "login_time", "logout_time", "is_active", "created_at"]


class AttendanceSerializer(serializers.ModelSerializer):
    employee_employee_id = serializers.CharField(source="employee.employee_id", read_only=True)
    employee_name = serializers.CharField(source="employee.name", read_only=True)
    assignment_patient_name = serializers.CharField(source="assignment.patient_name", read_only=True)
    photo_url = serializers.SerializerMethodField()
    session_login_time = serializers.DateTimeField(source="session.login_time", read_only=True)
    session_logout_time = serializers.DateTimeField(source="session.logout_time", read_only=True)
    session_is_active = serializers.BooleanField(source="session.is_active", read_only=True)
    presence_status = serializers.SerializerMethodField()
    presence_is_active = serializers.SerializerMethodField()
    presence_check_in_time = serializers.SerializerMethodField()
    presence_session_duration_seconds = serializers.SerializerMethodField()

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
            "session_login_time",
            "session_logout_time",
            "session_is_active",
            "presence_status",
            "presence_is_active",
            "presence_check_in_time",
            "presence_session_duration_seconds",
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

    def get_presence_status(self, obj: Attendance) -> str:
        return get_employee_presence_summary(obj.employee)['status']

    def get_presence_is_active(self, obj: Attendance) -> bool:
        return get_employee_presence_summary(obj.employee)['is_present']

    def get_presence_check_in_time(self, obj: Attendance):
        return get_employee_presence_summary(obj.employee)['check_in_time']

    def get_presence_session_duration_seconds(self, obj: Attendance) -> int:
        return get_employee_presence_summary(obj.employee)['session_duration_seconds']
