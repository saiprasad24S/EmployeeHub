import logging
import threading
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone

logger = logging.getLogger(__name__)


def is_admin_recipient(recipient) -> bool:
    """
    Checks if a recipient Employee represents the Administrative persona.
    """
    if not recipient:
        return False
    emp_id = (getattr(recipient, "employee_id", "") or "").strip().upper()
    if emp_id in ["ADMIN", "ADM-001"]:
        return True
    name = (getattr(recipient, "name", "") or "").strip().lower()
    if name in ["admin", "administrator"]:
        return True
    dept = (getattr(recipient, "department", "") or "").strip().lower()
    if dept == "administration":
        return True
    return False


def get_admin_recipient_emails() -> list[str]:
    """
    Fetches all active administrator email addresses from the database and defaults.
    """
    from apps.accounts.models import Admin

    emails = set()
    try:
        db_admins = Admin.objects.exclude(email__isnull=True).exclude(email="")
        for a in db_admins:
            clean = a.email.strip().lower()
            if clean and "@" in clean:
                emails.add(clean)
    except Exception as err:
        logger.warning("Failed to fetch Admin emails from DB: %s", err)

    # Known Skandan administrative fallback emails
    fallback_emails = [
        "skandanhomecarre@gmail.com",
        "skandanhomecare@gmail.com",
        "admin@skandan.com",
    ]
    for fb in fallback_emails:
        emails.add(fb.strip().lower())

    return sorted(list(emails))


def _dispatch_email_thread(sender_name: str, sender_id: str, sender_dept: str, content: str, admin_emails: list[str]):
    """
    Worker function executed in background thread to deliver the email.
    """
    try:
        now_str = timezone.now().strftime("%d %b %Y, %I:%M %p IST")
        subject = f"[EmployeeHub Chat] New message from {sender_name} ({sender_id})"

        text_body = (
            f"You received a new message from an employee in EmployeeHub Chat:\n\n"
            f"From: {sender_name} ({sender_id})\n"
            f"Department: {sender_dept}\n"
            f"Time: {now_str}\n\n"
            f"Message Content:\n"
            f"----------------------------------------\n"
            f"{content}\n"
            f"----------------------------------------\n\n"
            f"To view the conversation and reply directly in the chat, log in to EmployeeHub Admin:\n"
            f"https://www.skandanhomecarrecclinic.com/chat\n"
        )

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F5F5F7; margin: 0; padding: 20px; }}
            .card {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #EDEBE9; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }}
            .header {{ background: #5B5FC7; color: #ffffff; padding: 22px 26px; }}
            .header h1 {{ margin: 0; font-size: 20px; font-weight: 700; }}
            .header p {{ margin: 4px 0 0 0; font-size: 13px; opacity: 0.9; }}
            .content {{ padding: 26px; }}
            .info-box {{ background: #F5F5F7; border-left: 4px solid #5B5FC7; border-radius: 6px; padding: 14px 18px; margin: 18px 0; }}
            .info-row {{ margin-bottom: 6px; font-size: 14px; color: #242424; }}
            .info-row strong {{ color: #616161; width: 110px; display: inline-block; }}
            .msg-box {{ background: #FFFFFF; border: 1px solid #E1DFDD; border-radius: 8px; padding: 14px 18px; font-size: 15px; color: #242424; line-height: 1.5; white-space: pre-wrap; margin: 14px 0; }}
            .btn-wrap {{ text-align: center; margin: 26px 0 10px 0; }}
            .btn {{ background: #5B5FC7; color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block; }}
            .footer {{ background: #F5F5F7; border-top: 1px solid #EDEBE9; padding: 14px 20px; text-align: center; font-size: 12px; color: #8A8886; }}
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h1>Microsoft Teams • Message from Employee</h1>
              <p>EmployeeHub Internal Workplace Communication</p>
            </div>
            <div class="content">
              <p style="margin-top: 0; font-size: 15px; color: #242424;">
                An employee has sent a direct message to <strong>Admin</strong> in the communication module:
              </p>

              <div class="info-box">
                <div class="info-row"><strong>Employee:</strong> {sender_name}</div>
                <div class="info-row"><strong>Employee ID:</strong> <span style="font-family: monospace; font-weight: 700; color: #5B5FC7;">{sender_id}</span></div>
                <div class="info-row"><strong>Department:</strong> {sender_dept}</div>
                <div class="info-row"><strong>Sent Time:</strong> {now_str}</div>
              </div>

              <p style="font-size: 13px; font-weight: 700; color: #616161; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px;">Message Content:</p>
              <div class="msg-box">"{content}"</div>

              <div class="btn-wrap">
                <a href="https://www.skandanhomecarrecclinic.com/chat" class="btn">
                  Open Admin Chat in EmployeeHub
                </a>
              </div>
            </div>
            <div class="footer">
              Skandan Home Carre & Clinic LLP • Automated Communication System
            </div>
          </div>
        </body>
        </html>
        """

        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "Skandan EmployeeHub <skandanhomecarre@gmail.com>")

        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=from_email,
            to=admin_emails,
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send(fail_silently=False)

        logger.info(
            "Admin chat email notification sent successfully to %s for sender %s (%s)",
            admin_emails,
            sender_name,
            sender_id,
        )
    except Exception as err:
        logger.warning(
            "Failed to send Admin chat email notification to %s: %s",
            admin_emails,
            err,
        )


def send_admin_chat_notification_async(sender, recipient, content: str):
    """
    Dispatches email notification to admin emails if the message recipient is Admin.
    Always runs in a background thread to prevent latency in message delivery.
    """
    if not is_admin_recipient(recipient):
        return

    admin_emails = get_admin_recipient_emails()
    if not admin_emails:
        logger.warning("No admin emails found to notify for chat message.")
        return

    sender_name = getattr(sender, "name", "Employee")
    sender_id = getattr(sender, "employee_id", "EMP")
    sender_dept = getattr(sender, "department", "General") or "General"

    thread = threading.Thread(
        target=_dispatch_email_thread,
        args=(sender_name, sender_id, sender_dept, content, admin_emails),
        daemon=True,
    )
    thread.start()
