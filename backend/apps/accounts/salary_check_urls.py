from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.accounts.views import SalaryCheckViewSet

router = DefaultRouter()
router.register(r"", SalaryCheckViewSet, basename="salary-check")

urlpatterns = [
    path("", include(router.urls)),
]
