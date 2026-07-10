from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.assignments.views import AssignmentViewSet, MyTodayAssignmentView

router = DefaultRouter()
router.register(r"", AssignmentViewSet, basename="assignments")

urlpatterns = [
    path("my-today/", MyTodayAssignmentView.as_view(), name="my-today-assignment"),
    path("", include(router.urls)),
]
