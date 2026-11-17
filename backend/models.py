from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    role: Mapped[str] = mapped_column(String(20), index=True)  # admin | doctor | patient
    salt: Mapped[str] = mapped_column(String(64))
    password_hash: Mapped[str] = mapped_column(String(64))
    phone: Mapped[str] = mapped_column(String(40), default="")
    whatsapp: Mapped[str] = mapped_column(String(40), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    doctor_profile: Mapped["DoctorProfile | None"] = relationship(back_populates="user", uselist=False)
    patient_profile: Mapped["PatientProfile | None"] = relationship(
        back_populates="user",
        uselist=False,
        foreign_keys="PatientProfile.user_id",
    )
    sessions: Mapped[list["CareSession"]] = relationship(back_populates="user")
    notifications: Mapped[list["Notification"]] = relationship(back_populates="user")


class CareSession(Base):
    __tablename__ = "care_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="sessions")


class DoctorProfile(Base):
    __tablename__ = "doctor_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    license_number: Mapped[str] = mapped_column(String(80), default="")
    license_authority: Mapped[str] = mapped_column(String(120), default="")
    license_expiry: Mapped[str] = mapped_column(String(40), default="")
    specialty: Mapped[str] = mapped_column(String(80), default="Psychiatry")
    experience_years: Mapped[int] = mapped_column(Integer, default=0)
    bio: Mapped[str] = mapped_column(Text, default="")
    consult_fee: Mapped[float] = mapped_column(Float, default=500.0)
    license_status: Mapped[str] = mapped_column(String(20), default="pending")  # pending|approved|rejected
    license_note: Mapped[str] = mapped_column(Text, default="")
    meeting_provider_default: Mapped[str] = mapped_column(String(20), default="google_meet")

    user: Mapped[User] = relationship(back_populates="doctor_profile")
    slots: Mapped[list["AvailabilitySlot"]] = relationship(back_populates="doctor")
    consultations: Mapped[list["Consultation"]] = relationship(back_populates="doctor")


class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    approval_status: Mapped[str] = mapped_column(String(20), default="pending")  # pending|approved|rejected
    approved_by_admin_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    approval_note: Mapped[str] = mapped_column(Text, default="")

    user: Mapped[User] = relationship(
        back_populates="patient_profile",
        foreign_keys=[user_id],
    )
    consultations: Mapped[list["Consultation"]] = relationship(back_populates="patient")


class AvailabilitySlot(Base):
    __tablename__ = "availability_slots"
    __table_args__ = (UniqueConstraint("doctor_id", "slot_date", "start_time", name="uq_doctor_slot"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctor_profiles.id"))
    slot_date: Mapped[str] = mapped_column(String(20))  # YYYY-MM-DD
    start_time: Mapped[str] = mapped_column(String(10))  # HH:MM
    end_time: Mapped[str] = mapped_column(String(10), default="")
    is_booked: Mapped[bool] = mapped_column(Boolean, default=False)

    doctor: Mapped[DoctorProfile] = relationship(back_populates="slots")


class Consultation(Base):
    __tablename__ = "consultations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patient_profiles.id"))
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctor_profiles.id"))
    slot_id: Mapped[int | None] = mapped_column(ForeignKey("availability_slots.id"), nullable=True)
    visit_number: Mapped[int] = mapped_column(Integer, default=1)
    slot_date: Mapped[str] = mapped_column(String(20))
    start_time: Mapped[str] = mapped_column(String(10))
    fee: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[str] = mapped_column(String(20), default="scheduled")  # scheduled|completed|cancelled
    meeting_provider: Mapped[str] = mapped_column(String(20), default="google_meet")
    meeting_url: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    patient: Mapped[PatientProfile] = relationship(back_populates="consultations")
    doctor: Mapped[DoctorProfile] = relationship(back_populates="consultations")
    report: Mapped["ConsultationReport | None"] = relationship(back_populates="consultation", uselist=False)


class ConsultationReport(Base):
    __tablename__ = "consultation_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    consultation_id: Mapped[int] = mapped_column(ForeignKey("consultations.id"), unique=True)
    summary: Mapped[str] = mapped_column(Text, default="")
    diet: Mapped[str] = mapped_column(Text, default="")
    lifestyle: Mapped[str] = mapped_column(Text, default="")
    recommendations: Mapped[str] = mapped_column(Text, default="")
    recovery_score: Mapped[float] = mapped_column(Float, default=50)
    next_follow_up: Mapped[str] = mapped_column(String(40), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    consultation: Mapped[Consultation] = relationship(back_populates="report")


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(40), default="info")
    title: Mapped[str] = mapped_column(String(160), default="")
    message: Mapped[str] = mapped_column(Text, default="")
    channel: Mapped[str] = mapped_column(String(20), default="in_app")  # in_app|email
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    read: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped[User] = relationship(back_populates="notifications")


class AdminAction(Base):
    __tablename__ = "admin_actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    admin_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(80))
    target_type: Mapped[str] = mapped_column(String(40))
    target_id: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
