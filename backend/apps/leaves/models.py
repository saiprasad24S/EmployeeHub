from django.db import models
from apps.accounts.models import Admin, Employee


class Leave(models.Model):
    class LeaveType(models.TextChoices):
        CASUAL = "CASUAL", "Casual Leave"
        SICK = "SICK", "Sick Leave"
        MATERNITY_PATERNITY = "MATERNITY_PATERNITY", "Maternity / Paternity Leave"
        BEREAVEMENT = "BEREAVEMENT", "Bereavement Leave"
        UNPAID = "UNPAID", "Unpaid Leave"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="leaves",
    )
    leave_type = models.CharField(
        max_length=30,
        choices=LeaveType.choices,
        default=LeaveType.CASUAL,
    )
    start_date = models.DateField()
    end_date = models.DateField()
    total_days = models.PositiveIntegerField()
    reason = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    rejection_reason = models.TextField(blank=True, default="")
    applied_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        Admin,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_leaves",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-applied_at"]

    def __str__(self) -> str:
        return f"Leave {self.id}: {self.employee.employee_id} ({self.leave_type}) - {self.status}"
