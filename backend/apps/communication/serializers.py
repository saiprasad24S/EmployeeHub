from collections import defaultdict
from rest_framework import serializers

from apps.accounts.models import Employee
from apps.communication.models import (
    Conversation,
    ConversationMember,
    Message,
    EmployeePresence,
    MessageAttachment,
    MessageReaction
)


class EmployeeSearchSerializer(serializers.ModelSerializer):
    is_online = serializers.SerializerMethodField()
    last_seen_at = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            "id",
            "employee_id",
            "name",
            "email",
            "phone",
            "department",
            "designation",
            "profile_photo",
            "is_online",
            "last_seen_at",
        ]

    def get_is_online(self, obj: Employee) -> bool:
        presence = getattr(obj, "presence", None)
        return presence.is_online if presence else False

    def get_last_seen_at(self, obj: Employee) -> str | None:
        presence = getattr(obj, "presence", None)
        if presence and presence.last_seen_at:
            return presence.last_seen_at.isoformat()
        return None


class MessageAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = MessageAttachment
        fields = ["id", "file_name", "file_url", "file_type", "file_size"]

    def get_file_url(self, obj: MessageAttachment) -> str:
        url = obj.file_url or ""
        if url.startswith("https://res.cloudinary.com") or url.startswith("http://res.cloudinary.com"):
            return url
        if "/media/" in url:
            idx = url.find("/media/")
            return url[idx:]
        return url


class MessageSerializer(serializers.ModelSerializer):
    conversation_id = serializers.IntegerField(source="conversation.id", read_only=True)
    sender_id = serializers.IntegerField(source="sender.id", read_only=True)
    sender_name = serializers.CharField(source="sender.name", read_only=True)
    sender_employee_id = serializers.CharField(source="sender.employee_id", read_only=True)
    sender_avatar = serializers.CharField(source="sender.profile_photo", read_only=True)
    is_self = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    content = serializers.SerializerMethodField()
    reactions = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id",
            "conversation_id",
            "sender_id",
            "sender_name",
            "sender_employee_id",
            "sender_avatar",
            "content",
            "message_type",
            "created_at",
            "edited_at",
            "is_deleted",
            "is_self",
            "status",
            "reactions",
            "attachments",
        ]

    def get_is_self(self, obj: Message) -> bool:
        request_employee = self.context.get("current_employee")
        if not request_employee:
            return False
        return obj.sender_id == request_employee.id

    def get_status(self, obj: Message) -> str:
        if obj.read_at:
            return "READ"
        if obj.delivered_at:
            return "DELIVERED"
        return "SENT"

    def get_content(self, obj: Message) -> str:
        if obj.is_deleted:
            return "This message was deleted."
        return obj.content

    def get_reactions(self, obj: Message) -> list:
        current_employee = self.context.get("current_employee")
        reaction_counts = defaultdict(int)
        user_reactions = set()
        for r in obj.reactions.all():
            reaction_counts[r.emoji] += 1
            if current_employee and r.employee_id == current_employee.id:
                user_reactions.add(r.emoji)
        return [
            {
                "emoji": emoji,
                "count": count,
                "reacted_by_self": emoji in user_reactions,
            }
            for emoji, count in reaction_counts.items()
        ]

    def get_attachments(self, obj: Message) -> list:
        return MessageAttachmentSerializer(obj.attachments.all(), many=True).data


class ConversationListSerializer(serializers.ModelSerializer):
    other_member = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            "id",
            "type",
            "group_name",
            "updated_at",
            "other_member",
            "last_message",
            "unread_count",
        ]

    def get_other_member(self, obj: Conversation) -> dict | None:
        current_employee = self.context.get("current_employee")
        if not current_employee:
            return None
        other_emp = obj.get_other_member(current_employee)
        if not other_emp:
            return None
        return EmployeeSearchSerializer(other_emp).data

    def get_last_message(self, obj: Conversation) -> dict | None:
        if hasattr(obj, "_prefetched_objects_cache") and "messages" in obj._prefetched_objects_cache:
            all_msgs = list(obj.messages.all())
            msg = all_msgs[-1] if all_msgs else None
        else:
            msg = obj.messages.order_by("-created_at").first()
        if not msg:
            return None
        current_employee = self.context.get("current_employee")
        is_self = current_employee and msg.sender_id == current_employee.id
        content = "This message was deleted." if msg.is_deleted else msg.content
        return {
            "id": msg.id,
            "content": content,
            "sender_name": msg.sender.name,
            "is_self": is_self,
            "created_at": msg.created_at.isoformat(),
            "status": "READ" if msg.read_at else ("DELIVERED" if msg.delivered_at else "SENT"),
        }

    def get_unread_count(self, obj: Conversation) -> int:
        current_employee = self.context.get("current_employee")
        if not current_employee:
            return 0
        if hasattr(obj, "_prefetched_objects_cache") and "members" in obj._prefetched_objects_cache and "messages" in obj._prefetched_objects_cache:
            current_member = next((m for m in obj.members.all() if m.employee_id == current_employee.id), None)
            if not current_member:
                return 0
            count = 0
            for m in obj.messages.all():
                if m.sender_id != current_employee.id and not m.read_at:
                    if not current_member.last_read_at or m.created_at > current_member.last_read_at:
                        count += 1
            return count
        member = obj.members.filter(employee=current_employee).first()
        if not member:
            return 0
        qs = obj.messages.exclude(sender=current_employee).filter(read_at__isnull=True)
        if member.last_read_at:
            qs = qs.filter(created_at__gt=member.last_read_at)
        return qs.count()


class GroupSerializer(serializers.ModelSerializer):
    members = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ["id", "type", "group_name", "updated_at", "members", "last_message", "unread_count"]

    def get_members(self, obj):
        if hasattr(obj, "_prefetched_objects_cache") and "members" in obj._prefetched_objects_cache:
            members = obj.members.all()
        else:
            members = obj.members.select_related('employee__presence').all()
        return [EmployeeSearchSerializer(m.employee).data for m in members]

    def get_last_message(self, obj):
        if hasattr(obj, "_prefetched_objects_cache") and "messages" in obj._prefetched_objects_cache:
            all_msgs = list(obj.messages.all())
            msg = all_msgs[-1] if all_msgs else None
        else:
            msg = obj.messages.order_by('-created_at').first()
        if not msg:
            return None
        current_employee = self.context.get('current_employee')
        is_self = current_employee and msg.sender_id == current_employee.id
        content = 'This message was deleted.' if msg.is_deleted else msg.content
        return {
            'id': msg.id,
            'content': content,
            'sender_name': msg.sender.name,
            'is_self': is_self,
            'created_at': msg.created_at.isoformat(),
        }

    def get_unread_count(self, obj):
        current_employee = self.context.get('current_employee')
        if not current_employee:
            return 0
        if hasattr(obj, "_prefetched_objects_cache") and "messages" in obj._prefetched_objects_cache:
            return sum(1 for m in obj.messages.all() if m.sender_id != current_employee.id and not m.read_at)
        return obj.messages.exclude(sender=current_employee).filter(read_at__isnull=True).count()
