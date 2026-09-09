from django.urls import path
from apps.leaves.views import (
    LeaveApplyOrListView,
    MyLeavesListView,
    MyLeaveSummaryView,
    LeaveDetailView,
    AdminLeaveListView,
    AdminLeaveApproveView,
    AdminLeaveRejectView,
)

urlpatterns = [
    path("", LeaveApplyOrListView.as_view(), name="leave-apply-list"),
    path("my/", MyLeavesListView.as_view(), name="leave-my-list"),
    path("my/summary/", MyLeaveSummaryView.as_view(), name="leave-my-summary"),
    path("<int:pk>/", LeaveDetailView.as_view(), name="leave-detail"),
    path("admin/", AdminLeaveListView.as_view(), name="leave-admin-list"),
    path("<int:pk>/approve/", AdminLeaveApproveView.as_view(), name="leave-admin-approve"),
    path("<int:pk>/reject/", AdminLeaveRejectView.as_view(), name="leave-admin-reject"),
    path("admin/<int:pk>/approve/", AdminLeaveApproveView.as_view(), name="leave-admin-approve-alt"),
    path("admin/<int:pk>/reject/", AdminLeaveRejectView.as_view(), name="leave-admin-reject-alt"),
]
