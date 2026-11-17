from __future__ import annotations

import hashlib
import secrets
from datetime import datetime

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from backend.db import get_db
from backend.models import CareSession, User


def hash_password(salt: str, password: str) -> str:
    data = f"{salt}:{password}".encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def make_salt() -> str:
    return secrets.token_hex(16)


def make_token() -> str:
    return secrets.token_hex(32)


def create_session(db: Session, user: User) -> str:
    token = make_token()
    db.add(CareSession(token=token, user_id=user.id, created_at=datetime.utcnow()))
    db.commit()
    return token


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Sign in required for care features.")
    token = authorization.split(" ", 1)[1].strip()
    session = db.query(CareSession).filter(CareSession.token == token).first()
    if not session:
        raise HTTPException(status_code=401, detail="Session expired. Sign in again.")
    user = db.get(User, session.user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Account not found.")
    return user


def require_role(user: User, *roles: str):
    if user.role not in roles:
        raise HTTPException(status_code=403, detail="You do not have permission for this action.")
