from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.accounts.models import Employee
from apps.common.utils import AuthenticatedPrincipal
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
