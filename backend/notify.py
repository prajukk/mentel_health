"""In-app notifications with Resend email delivery."""

from __future__ import annotations

import os
from pathlib import Path

import requests
from dotenv import load_dotenv

from backend.models import Notification, User

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def create_notification(db, user_id: int, kind: str, title: str, message: str, channel: str = "in_app"):
    row = Notification(user_id=user_id, kind=kind, title=title, message=message, channel=channel)
    db.add(row)
    db.flush()
    return row


def _send_via_resend(to_email: str, subject: str, body: str) -> tuple[bool, str]:
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    sender = os.getenv("RESEND_FROM", "").strip() or "Mental Health Care <onboarding@resend.dev>"
    if not api_key:
        return False, "RESEND_API_KEY is not set."
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
        if response.ok:
            return True, "sent_via_resend"
        detail = ""
        try:
            detail = response.json().get("message") or response.text
        except Exception:
            detail = response.text
        return False, f"Resend {response.status_code}: {detail}"
    except Exception as exc:
        return False, f"Resend request failed: {exc}"


def try_send_email(to_email: str, subject: str, body: str) -> tuple[bool, str]:
    """Send email with Resend only. Returns (ok, detail)."""
    if not to_email:
        return False, "No recipient email on the account."

    ok, detail = _send_via_resend(to_email, subject, body)
    if ok:
        return True, detail

    if "You can only send testing emails" in detail or "verify a domain" in detail:
        return (
            False,
            "Resend test mode can only email the Resend account owner. "
            "Verify a domain at resend.com/domains to email any patient.",
        )
    return False, detail


def notify_user(db, user: User, kind: str, title: str, message: str) -> dict:
    """Always create in-app; also try email when Resend is configured."""
    create_notification(db, user.id, kind, title, message, channel="in_app")
    sent, detail = try_send_email(user.email, title, message)
    if sent:
        create_notification(db, user.id, kind, title, message, channel="email")
    return {
        "email_sent": sent,
        "email_to": user.email,
        "email_detail": detail,
    }
