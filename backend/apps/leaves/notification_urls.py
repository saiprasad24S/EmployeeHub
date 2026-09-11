from django.urls import path
from apps.leaves.views import (
    NotificationListView,
    NotificationMarkReadView,
    NotificationMarkAllReadView,
    DevicePushTokenRegisterView,
    DevicePushTokenUnregisterView,
)

urlpatterns = [
    path("", NotificationListView.as_view(), name="notification-list"),
    path("<int:pk>/read/", NotificationMarkReadView.as_view(), name="notification-mark-read"),
    path("read-all/", NotificationMarkAllReadView.as_view(), name="notification-mark-all-read"),
    path("device/register/", DevicePushTokenRegisterView.as_view(), name="push-token-register"),
    path("device/unregister/", DevicePushTokenUnregisterView.as_view(), name="push-token-unregister"),
]
