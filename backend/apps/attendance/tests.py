from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.accounts.models import Employee
from apps.assignments.models import Assignment
from apps.attendance.services import validate_geofence


class GeofenceTests(TestCase):
    def setUp(self):
        self.employee = Employee.objects.create(
            employee_id="EMP001",
            name="Test Employee",
            email="employee@example.com",
            department="Field",
            designation="Nurse",
        )
        self.assignment = Assignment.objects.create(
            employee=self.employee,
            patient_name="Patient One",
            patient_address="Test Address",
            latitude=12.9716,
            longitude=77.5946,
            radius=150,
            visit_date=timezone.localdate(),
            status=Assignment.Status.ACTIVE,
        )

    def test_validate_geofence_allows_nearby_location(self):
        validate_geofence(self.assignment, 12.9720, 77.5950)

    def test_validate_geofence_rejects_far_location(self):
        with self.assertRaises(ValidationError):
            validate_geofence(self.assignment, 13.1000, 77.8000)
