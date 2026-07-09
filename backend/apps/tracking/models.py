from django.db import models

from apps.accounts.models import Employee
from apps.attendance.models import Session


class LocationLog(models.Model):
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name="location_logs")
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="location_logs")
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)
    accuracy = models.FloatField(null=True, blank=True)
    speed = models.FloatField(null=True, blank=True)
    battery_percentage = models.PositiveSmallIntegerField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["timestamp"]
        indexes = [
            models.Index(fields=["employee", "timestamp"]),
            models.Index(fields=["session", "timestamp"]),
        ]

    def __str__(self) -> str:
        return f"{self.employee.employee_id} @ {self.timestamp.isoformat()}"
