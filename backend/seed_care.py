"""Seed admin + 3 psychiatry doctors + sample availability."""

from __future__ import annotations

from datetime import date, timedelta

from backend.care_security import hash_password, make_salt
from backend.db import Base, ENGINE, SessionLocal
from backend.models import AvailabilitySlot, DoctorProfile, PatientProfile, User


def ensure_user(db, email, name, role, password, phone=""):
    user = db.query(User).filter(User.email == email).first()
    if user:
        return user
    salt = make_salt()
    user = User(
        email=email,
        name=name,
        role=role,
        salt=salt,
        password_hash=hash_password(salt, password),
        phone=phone,
        whatsapp=phone,
    )
    db.add(user)
    db.flush()
    return user


def add_slots(db, doctor: DoctorProfile, days=10):
    existing = db.query(AvailabilitySlot).filter(AvailabilitySlot.doctor_id == doctor.id).count()
    if existing > 0:
        return
    times = ["09:00", "10:30", "14:00", "16:00"]
    start = date.today() + timedelta(days=1)
    for offset in range(days):
        day = start + timedelta(days=offset)
        if day.weekday() >= 5:
            continue
        for start_time in times:
            hour, minute = map(int, start_time.split(":"))
            end_hour = hour + 1
            end_time = f"{end_hour:02d}:{minute:02d}"
            db.add(
                AvailabilitySlot(
                    doctor_id=doctor.id,
                    slot_date=day.isoformat(),
                    start_time=start_time,
                    end_time=end_time,
                    is_booked=False,
                )
            )


def seed_care():
    Base.metadata.create_all(bind=ENGINE)
    db = SessionLocal()
    try:
        ensure_user(db, "admin@care.local", "Care Admin", "admin", "admin123", "+91 90000 00001")

        doctors = [
            (
                "dr.meera@care.local",
                "Dr. Meera Sharma",
                "MH-PSY-1001",
                "National Medical Commission",
                12,
                800.0,
                "Psychiatry consultant focusing on anxiety, stress, and mood support.",
                "+91 90000 01001",
            ),
            (
                "dr.arjun@care.local",
                "Dr. Arjun Nair",
                "MH-PSY-1002",
                "National Medical Commission",
                8,
                650.0,
                "Specialist in adolescent and young-adult mental health.",
                "+91 90000 01002",
            ),
            (
                "dr.leena@care.local",
                "Dr. Leena Kapoor",
                "MH-PSY-1003",
                "State Medical Council",
                15,
                950.0,
                "Senior psychiatrist with experience in depression and sleep-related strain.",
                "+91 90000 01003",
            ),
        ]
        for email, name, license_no, authority, years, fee, bio, phone in doctors:
            user = ensure_user(db, email, name, "doctor", "doctor123", phone)
            if not user.doctor_profile:
                profile = DoctorProfile(
                    user_id=user.id,
                    license_number=license_no,
                    license_authority=authority,
                    license_expiry=(date.today() + timedelta(days=800)).isoformat(),
                    specialty="Psychiatry",
                    experience_years=years,
                    bio=bio,
                    consult_fee=fee,
                    license_status="approved",
                    meeting_provider_default="google_meet",
                )
                db.add(profile)
                db.flush()
                add_slots(db, profile)
            else:
                add_slots(db, user.doctor_profile)

        patient = ensure_user(db, "patient@care.local", "Demo Patient", "patient", "patient123", "+91 90000 02001")
        if not patient.patient_profile:
            db.add(PatientProfile(user_id=patient.id, approval_status="approved"))

        pending = ensure_user(db, "pending.patient@care.local", "Pending Patient", "patient", "patient123", "+91 90000 02002")
        if not pending.patient_profile:
            db.add(PatientProfile(user_id=pending.id, approval_status="pending"))

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_care()
    print("Care DB seeded: admin@care.local / admin123, 3 doctors, demo patients.")
