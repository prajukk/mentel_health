"""In-app notifications with optional Resend email (fallback-safe)."""

from __future__ import annotations

import os

import requests

from backend.models import Notification, User


def create_notification(db, user_id: int, kind: str, title: str, message: str, channel: str = "in_app"):
    row = Notification(user_id=user_id, kind=kind, title=title, message=message, channel=channel)
    db.add(row)
    db.flush()
    return row


def try_send_email(to_email: str, subject: str, body: str) -> bool:
    """Send via Resend when RESEND_API_KEY is set. Returns False if not configured."""
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    sender = os.getenv("RESEND_FROM", "").strip() or "Mental Health Care <onboarding@resend.dev>"
    if not api_key or not to_email:
        return False
    try:
        response = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": sender,
                "to": [to_email],
                "subject": subject,
                "text": body,
            },
            timeout=12,
        )
        return response.ok
    except Exception:
        return False


def notify_user(db, user: User, kind: str, title: str, message: str):
    """Always create in-app; also try Resend email when configured."""
    create_notification(db, user.id, kind, title, message, channel="in_app")
    if try_send_email(user.email, title, message):
        create_notification(db, user.id, kind, title, message, channel="email")
