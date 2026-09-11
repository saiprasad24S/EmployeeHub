from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.conf import settings
from django.core.files.storage import default_storage
import os
import logging
import cloudinary.uploader
from apps.common.cloudinary_service import initialize_cloudinary

logger = logging.getLogger(__name__)

from apps.accounts.models import Admin, Employee
from apps.attendance.models import Notification
from apps.communication.models import (
    Conversation,
    ConversationMember,
    EmployeePresence,
    Message,
    MessageReaction,
    MessageAttachment,
)
from apps.communication.serializers import (
    ConversationListSerializer,
    EmployeeSearchSerializer,
    MessageSerializer,
    GroupSerializer,
)
from apps.communication.email_service import send_admin_chat_notification_async
from apps.common.push import send_push_notification


def _get_or_create_authenticated_employee(request) -> Employee | None:
    """
    Resolves the authenticated principal to an Employee instance.
    If the user is an Admin, the central Administrative employee persona ('ADMIN')
    is returned so all administrators can monitor and respond to employee conversations.
    """
    if hasattr(request, "_cached_employee"):
        return request._cached_employee

    role = getattr(request.user, "role", None)
    email = getattr(request.user, "email", None)

    # 1. Check if user is an Administrator
    is_admin = (role == "ADMIN") or (
        email and Admin.objects.filter(email__iexact=email).exists()
    )
    emp = None
    if is_admin:
        emp, _ = Employee.objects.get_or_create(
            employee_id="ADMIN",
            defaults={
                "name": "Admin",
                "email": email or "admin@skandan.com",
                "department": "Administration",
                "designation": "Administrator",
                "is_active": True,
            },
        )
    else:
        # 2. Check by employee_id
        employee_id = getattr(request.user, "employee_id", None)
        if employee_id:
            emp = Employee.objects.filter(pk=employee_id, is_active=True).first()
        # 3. Check by email
        elif email:
            emp = Employee.objects.filter(email__iexact=email, is_active=True).first()

    if emp:
        # Throttle presence updates to once every 60s to prevent MySQL lock contention on polling
        now = timezone.now()
        presence = getattr(emp, "presence", None)
        if not presence:
            presence = EmployeePresence.objects.filter(employee=emp).first()
        if not presence:
            EmployeePresence.objects.create(employee=emp, last_seen_at=now)
        elif not presence.last_seen_at or (now - presence.last_seen_at).total_seconds() > 60:
            EmployeePresence.objects.filter(pk=presence.pk).update(last_seen_at=now)

    request._cached_employee = emp
    return emp


class EmployeeSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        current_employee = _get_or_create_authenticated_employee(request)
        if not current_employee:
            return Response(
                {"detail": "Authenticated employee profile not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        q = request.query_params.get("q", "").strip()
        limit = min(int(request.query_params.get("limit", 100)), 200)
        queryset = (
            Employee.objects.filter(is_active=True)
            .exclude(pk=current_employee.pk)
            .select_related("presence")
        )

        if q:
            queryset = queryset.filter(
                Q(name__icontains=q)
                | Q(employee_id__icontains=q)
                | Q(department__icontains=q)
                | Q(designation__icontains=q)
            )
            results = list(queryset[:limit])
        else:
            # Pin Admin at the very top of directory results for employees
            admin_emp = queryset.filter(employee_id="ADMIN").first()
            others = list(queryset.exclude(employee_id="ADMIN")[: limit - 1])
            if admin_emp:
                results = [admin_emp] + others
            else:
                results = list(queryset[:limit])

        serializer = EmployeeSearchSerializer(results, many=True)
        return Response(serializer.data)


class ConversationListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        current_employee = _get_or_create_authenticated_employee(request)
        if not current_employee:
            return Response(
                {"detail": "Authenticated employee profile not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        conversations = (
            Conversation.objects.filter(members__employee=current_employee)
            .prefetch_related(
                "members__employee__presence",
                "messages__sender",
            )
            .order_by("-updated_at")
        )

        serializer = ConversationListSerializer(
            conversations,
            many=True,
            context={"current_employee": current_employee},
        )
        return Response(serializer.data)

    def post(self, request):
        current_employee = _get_or_create_authenticated_employee(request)
        if not current_employee:
            return Response(
                {"detail": "Authenticated employee profile not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        target_input = request.data.get("target_employee_id")
        if not target_input:
            return Response(
                {"detail": "target_employee_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Resolve target employee by PK or employee_id string
        target_employee = None
        if str(target_input).isdigit():
            target_employee = Employee.objects.filter(
                pk=int(target_input), is_active=True
            ).first()
        if not target_employee:
            target_employee = Employee.objects.filter(
                employee_id__iexact=str(target_input).strip(), is_active=True
            ).first()

        if not target_employee:
            return Response(
                {"detail": "Target employee not found or is inactive."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if target_employee.pk == current_employee.pk:
            return Response(
                {"detail": "Cannot start a conversation with yourself."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Duplicate Prevention: Check if direct conversation already exists
        existing_conv = (
            Conversation.objects.filter(
                type=Conversation.ConversationType.DIRECT,
                members__employee=current_employee,
            )
            .filter(members__employee=target_employee)
            .first()
        )

        if existing_conv:
            serializer = ConversationListSerializer(
                existing_conv, context={"current_employee": current_employee}
            )
            return Response(serializer.data, status=status.HTTP_200_OK)

        with transaction.atomic():
            conversation = Conversation.objects.create(
                type=Conversation.ConversationType.DIRECT
            )
            ConversationMember.objects.create(
                conversation=conversation, employee=current_employee
            )
            ConversationMember.objects.create(
                conversation=conversation, employee=target_employee
            )

        serializer = ConversationListSerializer(
            conversation, context={"current_employee": current_employee}
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ConversationMessageListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, conversation_id: int):
        current_employee = _get_or_create_authenticated_employee(request)
        if not current_employee:
            return Response(
                {"detail": "Authenticated employee profile not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        conversation = Conversation.objects.filter(pk=conversation_id).first()
        if not conversation:
            return Response(
                {"detail": "Conversation not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Authorization: Only conversation members can access
        if not conversation.members.filter(employee=current_employee).exists():
            return Response(
                {"detail": "Access denied: You are not a member of this conversation."},
                status=status.HTTP_403_FORBIDDEN,
            )

        limit = min(int(request.query_params.get("limit", 100)), 200)
        # Fetch the most recent messages for this conversation
        messages = list(
            conversation.messages.select_related("sender", "sender__presence")
            .prefetch_related("reactions", "attachments")
            .order_by("-created_at")[:limit]
        )
        messages.reverse()

        # Mark delivered for any incoming messages in this batch without extra DB query
        undelivered_ids = [
            m.id for m in messages if m.sender_id != current_employee.id and not m.delivered_at
        ]
        if undelivered_ids:
            Message.objects.filter(id__in=undelivered_ids).update(delivered_at=timezone.now())

        serializer = MessageSerializer(
            messages,
            many=True,
            context={"current_employee": current_employee},
        )
        return Response(serializer.data)

    def post(self, request, conversation_id: int):
        current_employee = _get_or_create_authenticated_employee(request)
        if not current_employee:
            return Response(
                {"detail": "Authenticated employee profile not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        conversation = Conversation.objects.filter(pk=conversation_id).first()
        if not conversation:
            return Response(
                {"detail": "Conversation not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Authorization: Only conversation members can send messages
        if not conversation.members.filter(employee=current_employee).exists():
            return Response(
                {"detail": "Access denied: You are not a member of this conversation."},
                status=status.HTTP_403_FORBIDDEN,
            )

        content = request.data.get("content", "").strip()
        attached_file = request.FILES.get('file')

        if not content and not attached_file:
            return Response(
                {"detail": "Message content or file cannot be empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            message = Message.objects.create(
                conversation=conversation,
                sender=current_employee,
                content=content,
                message_type=Message.MessageType.TEXT,
            )
            
            if attached_file:
                content_type = attached_file.content_type or ''
                is_image = content_type.startswith('image/')
                message.message_type = Message.MessageType.IMAGE if is_image else Message.MessageType.DOCUMENT
                message.save(update_fields=['message_type'])

                file_url = ""
                storage_key = ""
                try:
                    initialize_cloudinary()
                    res = cloudinary.uploader.upload(
                        attached_file,
                        folder=f"skandan/chat/{current_employee.employee_id}",
                        resource_type="auto",
                    )
                    file_url = res.get("secure_url") or res.get("url") or ""
                    storage_key = res.get("public_id") or ""
                except Exception as c_err:
                    logger.warning(f"Cloudinary upload fallback to local storage: {c_err}")

                if not file_url:
                    file_dir = 'chat_attachments'
                    file_path = default_storage.save(
                        f"{file_dir}/{attached_file.name}",
                        attached_file
                    )
                    normalized_path = file_path.replace("\\", "/")
                    file_url = f"{settings.MEDIA_URL.rstrip('/')}/{normalized_path.lstrip('/')}"
                    storage_key = file_path

                MessageAttachment.objects.create(
                    message=message,
                    file_name=attached_file.name,
                    file_url=file_url,
                    file_type=content_type,
                    file_size=attached_file.size,
                    storage_key=storage_key,
                )

            # Update conversation timestamp
            Conversation.objects.filter(pk=conversation.pk).update(
                updated_at=timezone.now()
            )

            # Check if recipient is currently viewing/online or notify
            recipient = conversation.get_other_member(current_employee)
            if recipient:
                snippet = (content[:80] + "...") if len(content) > 80 else content
                if not content and attached_file:
                    snippet = f"Sent a file: {attached_file.name}"
                    
                Notification.objects.create(
                    employee=recipient,
                    title=f"New Message from {current_employee.name}",
                    message=snippet,
                    notification_type=Notification.NotificationType.GENERAL,
                    reference_id=conversation.id,
                )
                send_push_notification(
                    recipient,
                    title=f"{current_employee.name}",
                    body=snippet,
                    data={"type": "CHAT_MESSAGE", "conversation_id": conversation.id},
                )
                # Dispatch email notification to admin emails if message is sent to Admin
                send_admin_chat_notification_async(current_employee, recipient, content)

        serializer = MessageSerializer(
            message, context={"current_employee": current_employee}
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ConversationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, conversation_id: int):
        current_employee = _get_or_create_authenticated_employee(request)
        if not current_employee:
            return Response(
                {"detail": "Authenticated employee profile not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        conversation = Conversation.objects.filter(pk=conversation_id).first()
        if not conversation:
            return Response(
                {"detail": "Conversation not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not conversation.members.filter(employee=current_employee).exists():
            return Response(
                {"detail": "Access denied."},
                status=status.HTTP_403_FORBIDDEN,
            )

        now = timezone.now()
        # Mark all incoming messages as read and delivered
        conversation.messages.exclude(sender=current_employee).filter(
            read_at__isnull=True
        ).update(read_at=now, delivered_at=now)

        conversation.members.filter(employee=current_employee).update(
            last_read_at=now
        )

        return Response({"status": "ok", "read_at": now.isoformat()})


class MessageDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, message_id: int):
        current_employee = _get_or_create_authenticated_employee(request)
        if not current_employee:
            return Response(
                {"detail": "Authenticated employee profile not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        message = Message.objects.filter(pk=message_id).first()
        if not message:
            return Response(
                {"detail": "Message not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Security: Only sender can delete their own message
        if message.sender_id != current_employee.pk:
            return Response(
                {"detail": "Access denied: You can only delete your own messages."},
                status=status.HTTP_403_FORBIDDEN,
            )

        message.deleted_at = timezone.now()
        message.save(update_fields=["deleted_at"])
        return Response({"status": "deleted", "message_id": message.pk})


class TypingStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, conversation_id: int):
        current_employee = _get_or_create_authenticated_employee(request)
        if not current_employee:
            return Response({"is_typing": False})

        conversation = Conversation.objects.filter(pk=conversation_id).first()
        if not conversation or not conversation.members.filter(employee=current_employee).exists():
            return Response({"is_typing": False})

        other_emp = conversation.get_other_member(current_employee)
        if not other_emp:
            return Response({"is_typing": False})

        presence = getattr(other_emp, "presence", None)
        if presence and presence.is_typing and presence.is_typing_conversation_id == conversation_id:
            return Response({
                "is_typing": True,
                "typing_user_name": other_emp.name,
            })

        return Response({"is_typing": False})

    def post(self, request, conversation_id: int):
        current_employee = _get_or_create_authenticated_employee(request)
        if not current_employee:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        conversation = Conversation.objects.filter(pk=conversation_id).first()
        if not conversation or not conversation.members.filter(employee=current_employee).exists():
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        is_typing = bool(request.data.get("is_typing", True))
        EmployeePresence.objects.update_or_create(
            employee=current_employee,
            defaults={
                "is_typing_conversation": conversation if is_typing else None,
                "typing_timestamp": timezone.now() if is_typing else None,
                "last_seen_at": timezone.now(),
            },
        )
        return Response({"status": "ok"})


class PresenceHeartbeatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current_employee = _get_or_create_authenticated_employee(request)
        if not current_employee:
            return Response({"status": "unregistered"})

        EmployeePresence.objects.update_or_create(
            employee=current_employee,
            defaults={"last_seen_at": timezone.now()},
        )
        return Response({"status": "online"})


class UnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        current_employee = _get_or_create_authenticated_employee(request)
        if not current_employee:
            return Response({"unread_count": 0})

        # Count all unread incoming messages across user's conversations
        unread_count = (
            Message.objects.filter(
                conversation__members__employee=current_employee,
            )
            .exclude(sender=current_employee)
            .filter(read_at__isnull=True)
            .count()
        )
        return Response({"unread_count": unread_count})


class CommunicationOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        total_employees = Employee.objects.filter(is_active=True).count()
        active_conversations = Conversation.objects.count()
        today = timezone.localdate()
        messages_today = Message.objects.filter(created_at__date=today).count()
        unread_messages = Message.objects.filter(read_at__isnull=True).count()

        return Response({
            "total_employees": total_employees,
            "active_conversations": active_conversations,
            "messages_today": messages_today,
            "unread_messages": unread_messages,
        })

class MessageReactionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, message_id: int):
        """Toggle a reaction on a message."""
        current_employee = _get_or_create_authenticated_employee(request)
        if not current_employee:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        message = Message.objects.filter(pk=message_id).first()
        if not message:
            return Response({"detail": "Message not found."}, status=status.HTTP_404_NOT_FOUND)

        # Check membership
        if not message.conversation.members.filter(employee=current_employee).exists():
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        emoji = request.data.get("emoji", "").strip()
        if not emoji:
            return Response({"detail": "emoji is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Enforce one reaction per person per message (Teams behavior)
        existing = MessageReaction.objects.filter(
            message=message, employee=current_employee
        ).first()

        if existing:
            if existing.emoji == emoji:
                existing.delete()
                return Response({"status": "removed", "emoji": emoji})
            else:
                existing.emoji = emoji
                existing.save(update_fields=["emoji"])
                return Response({"status": "updated", "emoji": emoji})
        else:
            MessageReaction.objects.create(
                message=message, employee=current_employee, emoji=emoji
            )
            return Response({"status": "added", "emoji": emoji}, status=status.HTTP_201_CREATED)


class GroupListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """List all groups the user belongs to."""
        current_employee = _get_or_create_authenticated_employee(request)
        if not current_employee:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        groups = (
            Conversation.objects.filter(
                type=Conversation.ConversationType.GROUP,
                members__employee=current_employee,
            )
            .prefetch_related('members__employee__presence', 'messages__sender')
            .order_by('-updated_at')
        )
        serializer = GroupSerializer(groups, many=True, context={'current_employee': current_employee})
        return Response(serializer.data)

    def post(self, request):
        """Create a new group (admin only)."""
        current_employee = _get_or_create_authenticated_employee(request)
        if not current_employee:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        # Only admin can create groups
        if current_employee.employee_id != 'ADMIN':
            return Response({"detail": "Only admin can create groups."}, status=status.HTTP_403_FORBIDDEN)

        group_name = request.data.get('group_name', '').strip()
        if not group_name:
            return Response({"detail": "group_name is required."}, status=status.HTTP_400_BAD_REQUEST)

        member_ids = request.data.get('member_ids', [])
        if not member_ids:
            return Response({"detail": "member_ids list is required."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            conversation = Conversation.objects.create(
                type=Conversation.ConversationType.GROUP,
                group_name=group_name,
            )
            # Add admin as member
            ConversationMember.objects.create(
                conversation=conversation, employee=current_employee
            )
            # Add specified members
            for mid in member_ids:
                emp = Employee.objects.filter(pk=mid, is_active=True).first()
                if emp and emp.pk != current_employee.pk:
                    ConversationMember.objects.create(
                        conversation=conversation, employee=emp
                    )

        serializer = GroupSerializer(conversation, context={'current_employee': current_employee})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class GroupDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, group_id: int):
        current_employee = _get_or_create_authenticated_employee(request)
        if not current_employee:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        group = Conversation.objects.filter(
            pk=group_id, type=Conversation.ConversationType.GROUP
        ).first()
        if not group:
            return Response({"detail": "Group not found."}, status=status.HTTP_404_NOT_FOUND)

        if not group.members.filter(employee=current_employee).exists():
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        serializer = GroupSerializer(group, context={'current_employee': current_employee})
        return Response(serializer.data)

    def put(self, request, group_id: int):
        """Update group (admin only): rename, add/remove members."""
        current_employee = _get_or_create_authenticated_employee(request)
        if not current_employee:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if current_employee.employee_id != 'ADMIN':
            return Response({"detail": "Only admin can modify groups."}, status=status.HTTP_403_FORBIDDEN)

        group = Conversation.objects.filter(
            pk=group_id, type=Conversation.ConversationType.GROUP
        ).first()
        if not group:
            return Response({"detail": "Group not found."}, status=status.HTTP_404_NOT_FOUND)

        new_name = request.data.get('group_name')
        if new_name:
            group.group_name = new_name.strip()
            group.save(update_fields=['group_name'])

        add_members = request.data.get('add_member_ids', [])
        for mid in add_members:
            emp = Employee.objects.filter(pk=mid, is_active=True).first()
            if emp:
                ConversationMember.objects.get_or_create(
                    conversation=group, employee=emp
                )

        remove_members = request.data.get('remove_member_ids', [])
        for mid in remove_members:
            ConversationMember.objects.filter(
                conversation=group, employee_id=mid
            ).delete()

        serializer = GroupSerializer(group, context={'current_employee': current_employee})
        return Response(serializer.data)
