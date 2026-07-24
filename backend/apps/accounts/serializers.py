from rest_framework import serializers

from apps.accounts.models import Admin, Employee
from apps.attendance.models import Session
from apps.attendance.services import get_employee_presence_summary


class EmployeeSerializer(serializers.ModelSerializer):
    is_face_registered = serializers.SerializerMethodField()
    profile_photo = serializers.SerializerMethodField()

    is_present = serializers.SerializerMethodField()
    presence_status = serializers.SerializerMethodField()
    session_login_time = serializers.SerializerMethodField()
    session_logout_time = serializers.SerializerMethodField()
    session_duration_seconds = serializers.SerializerMethodField()
    active_session = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            "id",
            "employee_id",
            "name",
            "email",
            "phone",
            "department",
            "designation",
            "profile_photo",
            "device_id",
            "is_active",
            "is_face_registered",
            "default_address",
            "default_latitude",
            "default_longitude",
            "default_radius",
            "is_present",
            "presence_status",
            "session_login_time",
            "session_logout_time",
            "session_duration_seconds",
            "active_session",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["face_embedding", "created_at", "updated_at"]

    def get_is_face_registered(self, obj: Employee) -> bool:
        return bool(obj.face_embedding or obj.profile_photo)

    def get_is_present(self, obj: Employee) -> bool:
        return get_employee_presence_summary(obj).get("is_present", False)

    def get_presence_status(self, obj: Employee) -> str:
        return get_employee_presence_summary(obj).get("status", "Absent")

    def get_session_login_time(self, obj: Employee):
        return get_employee_presence_summary(obj).get("check_in_time")

    def get_session_logout_time(self, obj: Employee):
        return get_employee_presence_summary(obj).get("check_out_time")

    def get_session_duration_seconds(self, obj: Employee):
        return get_employee_presence_summary(obj).get("session_duration_seconds", 0)

    def get_active_session(self, obj: Employee) -> bool:
        return bool(Session.objects.filter(employee=obj, is_active=True).exists())

    def get_profile_photo(self, obj: Employee) -> str:
        if not obj.profile_photo:
            return ""
        return obj.profile_photo if obj.profile_photo.startswith("http") else ""


class EmployeeCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = [
            "employee_id",
            "name",
            "email",
            "phone",
            "department",
            "designation",
            "profile_photo",
            "device_id",
            "is_active",
            "default_address",
            "default_latitude",
            "default_longitude",
            "default_radius",
        ]


class AdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Admin
        fields = ["id", "name", "email", "role", "created_at"]
