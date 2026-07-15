from django.urls import path

from apps.tracking.views import EmployeeCurrentLocationView, EmployeeRouteView, EmployeeTravelHistoryView, LocationUpdateView, AllPresentEmployeesLocationView

urlpatterns = [
    path("update", LocationUpdateView.as_view(), name="location-update"),
    path("employee/current-location/<str:employee_id>", EmployeeCurrentLocationView.as_view(), name="employee-current-location"),
    path("employee/route/<str:employee_id>", EmployeeRouteView.as_view(), name="employee-route"),
    path("employee/travel-history/<str:employee_id>", EmployeeTravelHistoryView.as_view(), name="employee-travel-history"),
    path("all-present-locations", AllPresentEmployeesLocationView.as_view(), name="all-present-locations"),
]
