from rest_framework import serializers

from apps.accounts.models import Admin, Employee


class EmployeeSerializer(serializers.ModelSerializer):
    is_face_registered = serializers.SerializerMethodField()

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
            "face_embedding",
            "device_id",
            "is_active",
            "is_face_registered",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["face_embedding", "created_at", "updated_at"]

    def get_is_face_registered(self, obj: Employee) -> bool:
        return bool(obj.face_embedding)


class EmployeeCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = ["employee_id", "name", "email", "phone", "department", "designation", "profile_photo", "device_id", "is_active"]


class AdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Admin
        fields = ["id", "name", "email", "role", "created_at"]
