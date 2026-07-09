from django.urls import path

from apps.tracking.views import EmployeeCurrentLocationView, EmployeeRouteView, EmployeeTravelHistoryView, LocationUpdateView

urlpatterns = [
    path("update", LocationUpdateView.as_view(), name="location-update"),
    path("employee/current-location/<int:employee_id>", EmployeeCurrentLocationView.as_view(), name="employee-current-location"),
    path("employee/route/<int:employee_id>", EmployeeRouteView.as_view(), name="employee-route"),
    path("employee/travel-history/<int:employee_id>", EmployeeTravelHistoryView.as_view(), name="employee-travel-history"),
]
