from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.assignments.views import AssignmentViewSet

router = DefaultRouter()
router.register(r"", AssignmentViewSet, basename="assignments")

urlpatterns = [path("", include(router.urls))]
