from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver

from apps.common.cloudinary_service import delete_image_from_url


class Admin(models.Model):
    class Role(models.TextChoices):
        SUPER_ADMIN = "SUPER_ADMIN", "Super Admin"
        ADMIN = "ADMIN", "Admin"

    name = models.CharField(max_length=120)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.ADMIN)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.email})"


class Employee(models.Model):
    employee_id = models.CharField(max_length=40, unique=True)
    name = models.CharField(max_length=120)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=30, blank=True)
    department = models.CharField(max_length=120, blank=True)
    designation = models.CharField(max_length=120, blank=True)
    profile_photo = models.URLField(blank=True)
    profile_photo_public_id = models.CharField(max_length=500, blank=True, default="")
    face_embedding = models.JSONField(null=True, blank=True)
    device_id = models.CharField(max_length=128, unique=True, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    default_address = models.TextField(blank=True, default="")
    default_latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    default_longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    default_radius = models.PositiveIntegerField(default=100)
    shift_name = models.CharField(max_length=80, default="General Shift")
    shift_start_time = models.TimeField(default="09:00:00")
    shift_end_time = models.TimeField(default="18:00:00")
    weekly_off_days = models.CharField(max_length=120, default="Sunday", help_text="Comma separated off days e.g. Sunday or Monday,Sunday")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["employee_id"]

    def __str__(self) -> str:
        return f"{self.employee_id} - {self.name}"

    def get_weekly_off_days_list(self) -> list[str]:
        if not self.weekly_off_days:
            return ["Sunday"]
        return [d.strip().title() for d in self.weekly_off_days.split(",") if d.strip()]

    def is_weekly_off(self, target_date=None) -> bool:
        from django.utils import timezone
        if target_date is None:
            target_date = timezone.localdate()
        day_name = target_date.strftime("%A")
        return day_name in self.get_weekly_off_days_list()


@receiver(pre_save, sender=Employee)
def delete_previous_profile_image(sender, instance, **kwargs):
    if not instance.pk:
        return
    previous = Employee.objects.filter(pk=instance.pk).only("profile_photo", "profile_photo_public_id").first()
    if not previous:
        return
    if previous.profile_photo and previous.profile_photo != instance.profile_photo and previous.profile_photo_public_id:
        delete_image_from_url(previous.profile_photo)
