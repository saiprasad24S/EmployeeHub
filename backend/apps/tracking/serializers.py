from rest_framework import serializers

from apps.tracking.models import LocationLog


class LocationLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = LocationLog
        fields = [
            "id",
            "session",
            "employee",
            "latitude",
            "longitude",
            "accuracy",
            "speed",
            "battery_percentage",
            "timestamp",
            "created_at",
        ]
