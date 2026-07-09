from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.accounts.views import CurrentEmployeeView, EmployeeViewSet

router = DefaultRouter()
router.register(r"", EmployeeViewSet, basename="employees")

urlpatterns = [
    path("", include(router.urls)),
    path("current/<int:employee_id>/", CurrentEmployeeView.as_view(), name="employee-current"),
]
