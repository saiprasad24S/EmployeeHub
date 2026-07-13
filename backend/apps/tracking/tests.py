from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.accounts.models import Employee
from apps.attendance.models import Session
from apps.common.utils import AuthenticatedPrincipal
from apps.tracking.models import LocationLog
from apps.tracking.views import EmployeeRouteView


class TrackingRouteTests(TestCase):
    def test_route_view_accepts_employee_code_in_url(self):
        employee = Employee.objects.create(
            employee_id="EMP101",
            name="Test Employee",
            email="employee@example.com",
            department="Nursing",
            designation="Nurse",
        )

        factory = APIRequestFactory()
        request = factory.get(f"/api/location/employee/route/{employee.employee_id}")
        force_authenticate(request, user=AuthenticatedPrincipal(email="admin@example.com", role="ADMIN"))

        response = EmployeeRouteView.as_view()(request, employee_id=employee.employee_id)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["employee_id"], employee.employee_id)

    def test_route_view_returns_last_known_location(self):
        employee = Employee.objects.create(
            employee_id="EMP102",
            name="Tracked Employee",
            email="tracked@example.com",
            department="Nursing",
            designation="Nurse",
        )
        session = Session.objects.create(employee=employee, is_active=False)
        LocationLog.objects.create(
            session=session,
            employee=employee,
            latitude=12.9716,
            longitude=77.5946,
            accuracy=6.0,
        )

        factory = APIRequestFactory()
        request = factory.get(f"/api/location/employee/route/{employee.id}")
        force_authenticate(request, user=AuthenticatedPrincipal(email="admin@example.com", role="ADMIN"))

        response = EmployeeRouteView.as_view()(request, employee_id=employee.id)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["last_known_location"]["latitude"], 12.9716)
        self.assertEqual(response.data["last_known_location"]["longitude"], 77.5946)
