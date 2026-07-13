from rest_framework import serializers

from apps.accounts.models import Admin, Employee


class EmployeeSerializer(serializers.ModelSerializer):
    is_face_registered = serializers.SerializerMethodField()
    profile_photo = serializers.SerializerMethodField()

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
            "default_address",
            "default_latitude",
            "default_longitude",
            "default_radius",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["face_embedding", "created_at", "updated_at"]

    def get_is_face_registered(self, obj: Employee) -> bool:
        return bool(obj.face_embedding)

    def get_profile_photo(self, obj: Employee) -> str:
        if not obj.profile_photo:
            return ""
        if obj.profile_photo.startswith("/"):
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.profile_photo)
            return f"http://localhost:8000{obj.profile_photo}"
        return obj.profile_photo


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
