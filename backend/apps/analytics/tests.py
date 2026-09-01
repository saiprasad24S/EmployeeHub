from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.accounts.authentication import AuthenticatedPrincipal
from apps.accounts.models import Employee
from apps.analytics.views import DashboardMetricsView
from apps.attendance.models import Session


class DashboardMetricsViewTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.employee1 = Employee.objects.create(
            employee_id="EMP-TEST-001",
            name="Alice Walker",
            email="alice@example.com",
            phone="+919876543210",
            department="Operations",
            designation="Manager",
            is_active=True,
        )
        self.employee2 = Employee.objects.create(
            employee_id="EMP-TEST-002",
            name="Bob Smith",
            email="bob@example.com",
            phone="+919876543211",
            department="Nursing",
            designation="Nurse",
            is_active=True,
        )

    def test_dashboard_metrics_returns_correct_counts(self):
        Session.objects.create(
            employee=self.employee1,
            login_time=timezone.now(),
            is_active=True,
        )

        request = self.factory.get("/api/dashboard/metrics")
        force_authenticate(
            request,
            user=AuthenticatedPrincipal(email="admin@example.com", role="ADMIN"),
        )
        response = DashboardMetricsView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total_employees"], 2)
        self.assertEqual(response.data["present_employees"], 1)
        self.assertEqual(response.data["absent_employees"], 1)
        self.assertEqual(response.data["employees_in_field"], 1)
