from django.test import TestCase

from apps.accounts.models import Employee
from apps.accounts.serializers import EmployeeSerializer
from apps.common.utils import AuthenticatedPrincipal


class AccountSerializerTests(TestCase):
    def test_authenticated_principal_exposes_role(self):
        principal = AuthenticatedPrincipal(email="employee@example.com", role="EMPLOYEE", employee_id=5)
        self.assertTrue(principal.is_authenticated)
        self.assertEqual(principal.role, "EMPLOYEE")

    def test_employee_serializer_handles_face_registration_flag(self):
        employee = Employee.objects.create(
            employee_id="EMP001",
            name="Test",
            email="test@example.com",
            department="Field",
            designation="Nurse",
            face_embedding=[[0.1, 0.2]],
        )
        serializer = EmployeeSerializer(employee)
        self.assertTrue(serializer.data["is_face_registered"])
