from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Admin, Employee
from apps.attendance.models import Notification
from apps.common.permissions import IsAdminRole, IsEmployeeRole
from apps.leaves.models import Leave
from apps.leaves.serializers import (
    LeaveApplySerializer,
    LeaveDetailSerializer,
    NotificationSerializer,
)


def _get_authenticated_employee(request) -> Employee | None:
    employee_id = getattr(request.user, "employee_id", None)
    if employee_id:
        return Employee.objects.filter(pk=employee_id).first()
    # Fallback by email if role is employee
    email = getattr(request.user, "email", None)
    if email:
        return Employee.objects.filter(email=email).first()
    return None


class LeaveApplyOrListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """If admin, route to admin list; if employee, route to my leaves."""
        if getattr(request.user, "role", None) == "ADMIN":
            return AdminLeaveListView().get(request)

        employee = _get_authenticated_employee(request)
        if not employee:
            return Response({"detail": "Employee profile not found."}, status=status.HTTP_404_NOT_FOUND)

        queryset = Leave.objects.filter(employee=employee).order_by("-applied_at")
        status_param = request.query_params.get("status")
        if status_param and status_param.upper() != "ALL":
            queryset = queryset.filter(status=status_param.upper())

        serializer = LeaveDetailSerializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request):
        """Employee submits a new leave request."""
        employee = _get_authenticated_employee(request)
        if not employee:
            return Response(
                {"detail": "Only registered employees can submit leave requests."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = LeaveApplySerializer(
            data=request.data,
            context={"employee": employee, "request": request},
        )
        serializer.is_valid(raise_exception=True)
        leave = serializer.save()

        return Response(
            LeaveDetailSerializer(leave).data,
            status=status.HTTP_201_CREATED,
        )


class MyLeavesListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee = _get_authenticated_employee(request)
        if not employee:
            return Response({"detail": "Employee profile not found."}, status=status.HTTP_404_NOT_FOUND)

        queryset = Leave.objects.filter(employee=employee).order_by("-applied_at")
        status_param = request.query_params.get("status")
        if status_param and status_param.upper() != "ALL":
            queryset = queryset.filter(status=status_param.upper())

        serializer = LeaveDetailSerializer(queryset, many=True)
        return Response(serializer.data)


class MyLeaveSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee = _get_authenticated_employee(request)
        if not employee:
            return Response({"detail": "Employee profile not found."}, status=status.HTTP_404_NOT_FOUND)

        leaves = Leave.objects.filter(employee=employee)
        pending = leaves.filter(status=Leave.Status.PENDING).count()
        approved = leaves.filter(status=Leave.Status.APPROVED).count()
        rejected = leaves.filter(status=Leave.Status.REJECTED).count()

        return Response(
            {
                "pending": pending,
                "approved": approved,
                "rejected": rejected,
                "total": leaves.count(),
            }
        )


class LeaveDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int):
        leave = Leave.objects.filter(pk=pk).first()
        if not leave:
            return Response({"detail": "Leave request not found."}, status=status.HTTP_404_NOT_FOUND)

        is_admin = getattr(request.user, "role", None) == "ADMIN"
        is_owner = getattr(request.user, "employee_id", None) == leave.employee_id
        if not (is_admin or is_owner):
            return Response({"detail": "You do not have permission to view this leave request."}, status=status.HTTP_403_FORBIDDEN)

        return Response(LeaveDetailSerializer(leave).data)


class AdminLeaveListView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        queryset = Leave.objects.select_related("employee", "reviewed_by").all().order_by("-applied_at")

        # Status filter
        status_param = request.query_params.get("status")
        if status_param and status_param.upper() != "ALL":
            queryset = queryset.filter(status=status_param.upper())

        # Department filter
        dept = request.query_params.get("department")
        if dept:
            queryset = queryset.filter(employee__department__iexact=dept.strip())

        # Leave type filter
        ltype = request.query_params.get("leave_type")
        if ltype:
            queryset = queryset.filter(leave_type=ltype.strip().upper())

        # Employee filter
        emp_filter = request.query_params.get("employee") or request.query_params.get("employee_id")
        if emp_filter:
            if str(emp_filter).isdigit():
                queryset = queryset.filter(employee__id=int(emp_filter))
            else:
                queryset = queryset.filter(employee__employee_id__iexact=emp_filter.strip())

        # Date range filter
        start_date = request.query_params.get("start_date")
        if start_date:
            queryset = queryset.filter(start_date__gte=start_date)
        end_date = request.query_params.get("end_date")
        if end_date:
            queryset = queryset.filter(end_date__lte=end_date)

        # Search query
        q = request.query_params.get("q") or request.query_params.get("search")
        if q:
            q_clean = q.strip()
            queryset = queryset.filter(
                Q(employee__name__icontains=q_clean)
                | Q(employee__employee_id__icontains=q_clean)
                | Q(reason__icontains=q_clean)
            )

        # Summary counts for admin via a single database aggregation
        from django.db.models import Count
        agg = Leave.objects.aggregate(
            total=Count("id"),
            pending=Count("id", filter=Q(status=Leave.Status.PENDING)),
            approved=Count("id", filter=Q(status=Leave.Status.APPROVED)),
            rejected=Count("id", filter=Q(status=Leave.Status.REJECTED)),
        )
        summary = {
            "total": agg["total"] or 0,
            "pending": agg["pending"] or 0,
            "approved": agg["approved"] or 0,
            "rejected": agg["rejected"] or 0,
        }

        serializer = LeaveDetailSerializer(queryset, many=True)
        return Response(
            {
                "summary": summary,
                "results": serializer.data,
            }
        )


class AdminLeaveApproveView(APIView):
    permission_classes = [IsAdminRole]

    def patch(self, request, pk: int):
        leave = Leave.objects.select_related("employee").filter(pk=pk).first()
        if not leave:
            return Response({"detail": "Leave request not found."}, status=status.HTTP_404_NOT_FOUND)

        if leave.status != Leave.Status.PENDING:
            return Response(
                {"detail": f"Leave request has already been {leave.status.lower()}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        admin = None
        admin_email = getattr(request.user, "email", None)
        if admin_email:
            admin = Admin.objects.filter(email=admin_email).first()

        with transaction.atomic():
            leave.status = Leave.Status.APPROVED
            leave.reviewed_at = timezone.now()
            leave.reviewed_by = admin
            leave.rejection_reason = ""
            leave.save()

            # Create Notification
            start_str = leave.start_date.strftime("%d %b %Y")
            end_str = leave.end_date.strftime("%d %b %Y")
            Notification.objects.create(
                employee=leave.employee,
                title="Leave Approved",
                message=f"Your leave request from {start_str} to {end_str} has been approved.",
                notification_type=Notification.NotificationType.LEAVE_APPROVED,
                reference_id=leave.id,
            )

        return Response(
            LeaveDetailSerializer(leave).data,
            status=status.HTTP_200_OK,
        )


class AdminLeaveRejectView(APIView):
    permission_classes = [IsAdminRole]

    def patch(self, request, pk: int):
        leave = Leave.objects.select_related("employee").filter(pk=pk).first()
        if not leave:
            return Response({"detail": "Leave request not found."}, status=status.HTTP_404_NOT_FOUND)

        if leave.status != Leave.Status.PENDING:
            return Response(
                {"detail": f"Leave request has already been {leave.status.lower()}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rejection_reason = request.data.get("rejection_reason", "").strip()

        admin = None
        admin_email = getattr(request.user, "email", None)
        if admin_email:
            admin = Admin.objects.filter(email=admin_email).first()

        with transaction.atomic():
            leave.status = Leave.Status.REJECTED
            leave.rejection_reason = rejection_reason
            leave.reviewed_at = timezone.now()
            leave.reviewed_by = admin
            leave.save()

            # Create Notification
            start_str = leave.start_date.strftime("%d %b %Y")
            end_str = leave.end_date.strftime("%d %b %Y")
            reason_part = f" Reason: {rejection_reason}" if rejection_reason else ""
            Notification.objects.create(
                employee=leave.employee,
                title="Leave Request Rejected",
                message=f"Your leave request from {start_str} to {end_str} was rejected.{reason_part}",
                notification_type=Notification.NotificationType.LEAVE_REJECTED,
                reference_id=leave.id,
            )

        return Response(
            LeaveDetailSerializer(leave).data,
            status=status.HTTP_200_OK,
        )


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee = _get_authenticated_employee(request)
        if not employee:
            return Response({"unread_count": 0, "results": []})

        notifications = Notification.objects.filter(employee=employee).order_by("-created_at")[:50]
        unread_count = Notification.objects.filter(employee=employee, is_read=False).count()
        serializer = NotificationSerializer(notifications, many=True)
        return Response(
            {
                "unread_count": unread_count,
                "results": serializer.data,
            }
        )


class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk: int):
        employee = _get_authenticated_employee(request)
        if not employee:
            return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

        updated = Notification.objects.filter(pk=pk, employee=employee).update(is_read=True)
        if not updated:
            return Response({"detail": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response({"id": pk, "is_read": True})


class NotificationMarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        employee = _get_authenticated_employee(request)
        if not employee:
            return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

        Notification.objects.filter(employee=employee, is_read=False).update(is_read=True)
        return Response({"detail": "All notifications marked as read."})
