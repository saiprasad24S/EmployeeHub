from django.urls import path

from apps.attendance.views import AttendanceExportView, AttendanceListView, CheckInView, CheckOutView, ManualAttendanceEditView

urlpatterns = [
    path("checkin", CheckInView.as_view(), name="checkin"),
    path("checkout", CheckOutView.as_view(), name="checkout"),
    path("export", AttendanceExportView.as_view(), name="attendance-export"),
    path("manual-edit", ManualAttendanceEditView.as_view(), name="manual-edit"),
    path("", AttendanceListView.as_view(), name="attendance-list"),
]
