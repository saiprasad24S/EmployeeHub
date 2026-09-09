from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import Employee
from apps.attendance.models import Notification
from apps.leaves.models import Leave


class LeaveApplySerializer(serializers.ModelSerializer):
    class Meta:
        model = Leave
        fields = [
            "leave_type",
            "start_date",
            "end_date",
            "reason",
        ]

    def validate(self, attrs):
        start_date = attrs.get("start_date")
        end_date = attrs.get("end_date")
        reason = attrs.get("reason", "").strip()

        if not start_date or not end_date:
            raise serializers.ValidationError("Start date and End date are required.")

        today = timezone.localdate()
        if start_date < today:
            raise serializers.ValidationError("Leave start date cannot be in the past.")

        if end_date < start_date:
            raise serializers.ValidationError("End date cannot be before start date.")

        if not reason:
            raise serializers.ValidationError("Reason for leave is required.")

        employee = self.context.get("employee")
        if not employee:
            raise serializers.ValidationError("Authenticated employee not found.")

        # Overlap check against PENDING or APPROVED leaves
        existing_overlap = Leave.objects.filter(
            employee=employee,
            status__in=[Leave.Status.PENDING, Leave.Status.APPROVED],
        ).filter(
            start_date__lte=end_date,
            end_date__gte=start_date,
        )

        # Exclude self if updating
        if self.instance:
            existing_overlap = existing_overlap.exclude(pk=self.instance.pk)

        if existing_overlap.exists():
            raise serializers.ValidationError(
                "You already have a leave request covering part of this date range."
            )

        return attrs

    def create(self, validated_data):
        employee = self.context["employee"]
        start_date = validated_data["start_date"]
        end_date = validated_data["end_date"]
        total_days = (end_date - start_date).days + 1

        leave = Leave.objects.create(
            employee=employee,
            leave_type=validated_data.get("leave_type", Leave.LeaveType.CASUAL),
            start_date=start_date,
            end_date=end_date,
            total_days=total_days,
            reason=validated_data["reason"].strip(),
            status=Leave.Status.PENDING,
        )

        # Notify employee of submitted leave request
        start_str = start_date.strftime("%d %b %Y")
        end_str = end_date.strftime("%d %b %Y")
        day_text = f"{total_days} {'day' if total_days == 1 else 'days'}"
        Notification.objects.create(
            employee=employee,
            title="Leave Request Submitted",
            message=f"Your {leave.get_leave_type_display()} request from {start_str} to {end_str} ({day_text}) has been submitted for approval.",
            notification_type=Notification.NotificationType.GENERAL,
            reference_id=leave.id,
        )

        return leave


class LeaveDetailSerializer(serializers.ModelSerializer):
    employee_id = serializers.CharField(source="employee.employee_id", read_only=True)
    employee_name = serializers.CharField(source="employee.name", read_only=True)
    employee_email = serializers.CharField(source="employee.email", read_only=True)
    department = serializers.CharField(source="employee.department", read_only=True)
    designation = serializers.CharField(source="employee.designation", read_only=True)
    leave_type_display = serializers.CharField(source="get_leave_type_display", read_only=True)
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Leave
        fields = [
            "id",
            "employee",
            "employee_id",
            "employee_name",
            "employee_email",
            "department",
            "designation",
            "leave_type",
            "leave_type_display",
            "start_date",
            "end_date",
            "total_days",
            "reason",
            "status",
            "rejection_reason",
            "applied_at",
            "reviewed_at",
            "reviewed_by",
            "reviewed_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_reviewed_by_name(self, obj: Leave) -> str | None:
        if obj.reviewed_by:
            return obj.reviewed_by.name
        return None


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "title",
            "message",
            "notification_type",
            "reference_id",
            "is_read",
            "created_at",
        ]
        read_only_fields = ["id", "title", "message", "notification_type", "reference_id", "created_at"]
