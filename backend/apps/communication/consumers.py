import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from apps.communication.models import Conversation, Message, MessageReaction, EmployeePresence
from apps.communication.serializers import MessageSerializer
from apps.attendance.models import Notification
from apps.common.push import send_push_notification

logger = logging.getLogger(__name__)


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.conversation_id = self.scope["url_route"]["kwargs"]["conversation_id"]
        self.room_group_name = f"chat_{self.conversation_id}"
        self.employee = self.scope.get("employee")

        if not self.employee:
            logger.warning(f"[WS] Connection rejected: unauthenticated for convo {self.conversation_id}")
            await self.close(code=4001)
            return

        is_member = await self.check_membership(self.conversation_id, self.employee.id)
        if not is_member:
            logger.warning(f"[WS] Connection rejected: not a member of convo {self.conversation_id}")
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        logger.info(f"[WS] Employee {self.employee.name} connected to {self.room_group_name}")

    async def disconnect(self, close_code):
        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except Exception:
            return

        action = data.get("action")

        if action == "send_message":
            content = data.get("content", "").strip()
            if not content:
                return

            saved_msg = await self.save_message(self.conversation_id, self.employee.id, content)
            if saved_msg:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "chat_message",
                        "message": saved_msg,
                    },
                )
        elif action == "typing":
            is_typing = bool(data.get("is_typing", False))
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "typing_status",
                    "employee_id": self.employee.id,
                    "name": self.employee.name,
                    "is_typing": is_typing,
                },
            )
        elif action == "mark_read":
            await self.mark_messages_read(self.conversation_id, self.employee.id)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "read_receipt",
                    "employee_id": self.employee.id,
                    "conversation_id": self.conversation_id,
                },
            )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            "type": "new_message",
            "message": event["message"],
        }))

    async def typing_status(self, event):
        if event["employee_id"] != self.employee.id:
            await self.send(text_data=json.dumps({
                "type": "typing",
                "employee_id": event["employee_id"],
                "name": event["name"],
                "is_typing": event["is_typing"],
            }))

    async def read_receipt(self, event):
        await self.send(text_data=json.dumps({
            "type": "read_receipt",
            "employee_id": event["employee_id"],
            "conversation_id": event["conversation_id"],
        }))

    @database_sync_to_async
    def check_membership(self, conversation_id, employee_id):
        return Conversation.objects.filter(
            id=conversation_id,
            members__employee_id=employee_id,
        ).exists()

    @database_sync_to_async
    def save_message(self, conversation_id, employee_id, content):
        conversation = Conversation.objects.filter(id=conversation_id).first()
        if not conversation:
            return None

        msg = Message.objects.create(
            conversation=conversation,
            sender_id=employee_id,
            content=content,
            message_type=Message.MessageType.TEXT,
        )
        Conversation.objects.filter(id=conversation_id).update(updated_at=timezone.now())

        # Push & in-app notification to counterparty
        recipient = conversation.get_other_member(msg.sender)
        if recipient:
            snippet = (content[:80] + "...") if len(content) > 80 else content
            Notification.objects.create(
                employee=recipient,
                title=f"{msg.sender.name}",
                message=snippet,
                notification_type=Notification.NotificationType.GENERAL,
                reference_id=conversation.id,
            )
            send_push_notification(
                recipient,
                title=f"{msg.sender.name}",
                body=snippet,
                data={"type": "CHAT_MESSAGE", "conversation_id": conversation.id},
            )

        serializer = MessageSerializer(msg, context={"current_employee": msg.sender})
        return serializer.data

    @database_sync_to_async
    def mark_messages_read(self, conversation_id, employee_id):
        Message.objects.filter(
            conversation_id=conversation_id,
            read_at__isnull=True,
        ).exclude(sender_id=employee_id).update(read_at=timezone.now(), delivered_at=timezone.now())
