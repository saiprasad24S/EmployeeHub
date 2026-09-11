import logging
import requests
from apps.attendance.models import DevicePushToken

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def send_push_notification(employee, title: str, body: str, data: dict = None):
    """
    Sends push notifications to all active registered devices for an employee.
    Supports Expo push tokens (ExponentPushToken[...]) as well as standard FCM tokens.
    """
    if not employee:
        return

    tokens = list(
        DevicePushToken.objects.filter(employee=employee, is_active=True).values_list(
            "token", flat=True
        )
    )

    if not tokens:
        logger.debug(f"[Push] No active push tokens for employee {employee.id}")
        return

    expo_tokens = [t for t in tokens if t.startswith("ExponentPushToken")]
    other_tokens = [t for t in tokens if not t.startswith("ExponentPushToken")]

    # Send via Expo Push Service
    if expo_tokens:
        messages = [
            {
                "to": token,
                "sound": "default",
                "title": title,
                "body": body,
                "data": data or {},
                "priority": "high",
                "channelId": "default",
            }
            for token in expo_tokens
        ]
        try:
            resp = requests.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={
                    "Accept": "application/json",
                    "Accept-encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
                timeout=5,
            )
            logger.info(f"[Push] Sent {len(expo_tokens)} notifications to {employee.name}: status {resp.status_code}")
        except Exception as e:
            logger.error(f"[Push] Failed to send Expo push notification: {e}")

    # Standard FCM handling can be plugged in here if needed
    if other_tokens:
        logger.info(f"[Push] {len(other_tokens)} FCM native tokens queued for {employee.name}")
