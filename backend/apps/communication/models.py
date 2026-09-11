from datetime import timedelta
from django.db import models
from django.utils import timezone

from apps.accounts.models import Employee


class Conversation(models.Model):
    class ConversationType(models.TextChoices):
        DIRECT = "DIRECT", "Direct Message"
        GROUP = "GROUP", "Group Chat"

    type = models.CharField(
        max_length=20,
        choices=ConversationType.choices,
        default=ConversationType.DIRECT,
        db_index=True,
    )
    group_name = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        return f"Conversation #{self.pk} ({self.type})"

    def get_other_member(self, current_employee: Employee) -> Employee | None:
        """For DIRECT conversations, returns the other participating employee."""
        if hasattr(self, "_prefetched_objects_cache") and "members" in self._prefetched_objects_cache:
            for m in self.members.all():
                if m.employee_id != current_employee.id:
                    return m.employee
            return None
        member = (
            self.members.select_related("employee")
            .exclude(employee=current_employee)
            .first()
        )
        return member.employee if member else None


class ConversationMember(models.Model):
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="members",
    )
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="conversation_memberships",
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    last_read_at = models.DateTimeField(null=True, blank=True)
    last_read_message = models.ForeignKey(
        "Message",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        unique_together = ("conversation", "employee")
        indexes = [
            models.Index(fields=["employee", "conversation"]),
        ]

    def __str__(self) -> str:
        return f"{self.employee.name} in Conversation #{self.conversation_id}"


class Message(models.Model):
    class MessageType(models.TextChoices):
        TEXT = "TEXT", "Text"
        IMAGE = "IMAGE", "Image"
        DOCUMENT = "DOCUMENT", "Document"

    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    sender = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="sent_messages",
    )
    content = models.TextField()
    message_type = models.CharField(
        max_length=20,
        choices=MessageType.choices,
        default=MessageType.TEXT,
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    edited_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["conversation", "created_at"]),
            models.Index(fields=["sender", "created_at"]),
        ]

    def __str__(self) -> str:
        snippet = (self.content[:30] + "...") if len(self.content) > 30 else self.content
        return f"Msg #{self.pk} from {self.sender.employee_id}: {snippet}"

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    @property
    def is_read(self) -> bool:
        return self.read_at is not None

    @property
    def is_delivered(self) -> bool:
        return self.delivered_at is not None or self.read_at is not None


class MessageAttachment(models.Model):
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    file_name = models.CharField(max_length=255)
    file_url = models.URLField(max_length=1000)
    file_type = models.CharField(max_length=100, blank=True)
    file_size = models.PositiveIntegerField(default=0)
    storage_key = models.CharField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"Attachment {self.file_name} for Msg #{self.message_id}"


class MessageReaction(models.Model):
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name="reactions",
    )
    employee = models.ForeignKey(
        'accounts.Employee',
        on_delete=models.CASCADE,
        related_name="message_reactions",
    )
    emoji = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("message", "employee")

    def __str__(self):
        return f"{self.employee.name} reacted {self.emoji} to Msg #{self.message_id}"


class EmployeePresence(models.Model):
    employee = models.OneToOneField(
        Employee,
        on_delete=models.CASCADE,
        related_name="presence",
    )
    last_seen_at = models.DateTimeField(auto_now=True)
    is_typing_conversation = models.ForeignKey(
        Conversation,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    typing_timestamp = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"Presence for {self.employee.employee_id}"

    @property
    def is_online(self) -> bool:
        if not self.last_seen_at:
            return False
        return (timezone.now() - self.last_seen_at) <= timedelta(seconds=120)

    @property
    def is_typing(self) -> bool:
        if not self.typing_timestamp:
            return False
        return (timezone.now() - self.typing_timestamp) <= timedelta(seconds=5)
