from django.urls import path

from apps.attendance.views import AttendanceListView, CheckInView, CheckOutView

urlpatterns = [
    path("checkin", CheckInView.as_view(), name="checkin"),
    path("checkout", CheckOutView.as_view(), name="checkout"),
    path("", AttendanceListView.as_view(), name="attendance-list"),
]
