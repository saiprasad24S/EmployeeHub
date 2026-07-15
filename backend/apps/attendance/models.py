from django.db import models
from django.db.models.signals import post_delete, pre_save
from django.dispatch import receiver

from apps.accounts.models import Employee
from apps.assignments.models import Assignment
from apps.common.cloudinary_service import delete_image_from_url


class Session(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="sessions")
    login_time = models.DateTimeField(auto_now_add=True)
    logout_time = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-login_time"]

    def __str__(self) -> str:
        return f"Session #{self.pk} - {self.employee.employee_id}"


class Attendance(models.Model):
    class AttendanceType(models.TextChoices):
        CHECK_IN = "CHECK_IN", "Check In"
        CHECK_OUT = "CHECK_OUT", "Check Out"

    class Status(models.TextChoices):
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        PENDING = "PENDING", "Pending"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="attendance_records")
    assignment = models.ForeignKey(Assignment, on_delete=models.SET_NULL, null=True, blank=True, related_name="attendance_records")
    session = models.ForeignKey(Session, on_delete=models.SET_NULL, null=True, blank=True, related_name="attendance_records")
    attendance_type = models.CharField(max_length=20, choices=AttendanceType.choices)
    photo_url = models.URLField(blank=True)
    photo_public_id = models.CharField(max_length=500, blank=True, default="")
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)
    address = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.APPROVED)
    remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["employee", "timestamp"]),
            models.Index(fields=["attendance_type"]),
        ]

    def __str__(self) -> str:
        return f"{self.employee.employee_id} {self.attendance_type}"


class PatientVisit(models.Model):
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name="patient_visits")
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="patient_visits")
    patient_name = models.CharField(max_length=160)
    photo_url = models.URLField(blank=True)
    photo_public_id = models.CharField(max_length=500, blank=True, default="")
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)
    visit_time = models.DateTimeField(auto_now_add=True)
    remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-visit_time"]


@receiver(post_delete, sender=Attendance)
def delete_attendance_photo(sender, instance, **kwargs):
    if instance.photo_public_id:
        delete_image_from_url(instance.photo_url)


@receiver(post_delete, sender=PatientVisit)
def delete_patient_visit_photo(sender, instance, **kwargs):
    if instance.photo_public_id:
        delete_image_from_url(instance.photo_url)


class Notification(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=160)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class ActivityLog(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="activity_logs")
    action = models.CharField(max_length=160)
    details = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
