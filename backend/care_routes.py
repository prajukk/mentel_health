from __future__ import annotations

from datetime import datetime
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from backend.care_security import (
    create_session,
    get_current_user,
    hash_password,
    make_salt,
    require_role,
)
from backend.db import get_db
from backend.models import (
    AdminAction,
    AvailabilitySlot,
    Consultation,
    ConsultationReport,
    DoctorProfile,
    Notification,
    PatientProfile,
    User,
)
from backend.notify import notify_user
router = APIRouter(prefix="/care", tags=["care"])


class RegisterBody(BaseModel):
    email: str
    password: str = Field(min_length=4)
    name: str = ""
    role: str = "patient"  # patient | doctor
    phone: str = ""
    whatsapp: str = ""
    license_number: str = ""
    license_authority: str = ""
    specialty: str = "Psychiatry"
    experience_years: int = 0
    bio: str = ""
    consult_fee: float = 500


class LoginBody(BaseModel):
    email: str
    password: str


class ApprovalBody(BaseModel):
    status: str  # approved | rejected
    note: str = ""


class SlotBody(BaseModel):
    slot_date: str
    start_time: str
    end_time: str = ""


class BookBody(BaseModel):
    doctor_id: int
    slot_id: int
    meeting_provider: str = "google_meet"  # google_meet | zoom


class MeetingBody(BaseModel):
    meeting_provider: str = "google_meet"
    meeting_url: str = ""


class ReportBody(BaseModel):
    summary: str = ""
    diet: str = ""
    lifestyle: str = ""
    recommendations: str = ""
    recovery_score: float = 50
    next_follow_up: str = ""


def user_payload(user: User) -> dict:
    payload = {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "phone": user.phone,
        "whatsapp": user.whatsapp,
    }
    if user.role == "doctor" and user.doctor_profile:
        d = user.doctor_profile
        payload["doctor"] = {
            "id": d.id,
            "license_number": d.license_number,
            "license_authority": d.license_authority,
            "license_expiry": d.license_expiry,
            "specialty": d.specialty,
            "experience_years": d.experience_years,
            "bio": d.bio,
            "consult_fee": d.consult_fee,
            "license_status": d.license_status,
            "license_note": d.license_note,
            "meeting_provider_default": d.meeting_provider_default,
        }
    if user.role == "patient" and user.patient_profile:
        p = user.patient_profile
        payload["patient"] = {
            "id": p.id,
            "approval_status": p.approval_status,
            "approval_note": p.approval_note,
            "approved_at": p.approved_at.isoformat() if p.approved_at else None,
        }
    return payload


def meeting_link(provider: str, doctor_name: str, when: str) -> str:
    label = quote(f"Psychiatry consult with {doctor_name} ({when})")
    if provider == "zoom":
        return f"https://zoom.us/j/placeholder?pwd=care&topic={label}"
    return f"https://meet.google.com/new?hs=122&authuser=0&ijlm={label}"


def consultation_payload(row: Consultation) -> dict:
    doctor_user = row.doctor.user
    patient_user = row.patient.user
    report = None
    if row.report:
        report = {
            "summary": row.report.summary,
            "diet": row.report.diet,
            "lifestyle": row.report.lifestyle,
            "recommendations": row.report.recommendations,
            "recovery_score": row.report.recovery_score,
            "next_follow_up": row.report.next_follow_up,
            "created_at": row.report.created_at.isoformat(),
        }
    return {
        "id": row.id,
        "visit_number": row.visit_number,
        "slot_date": row.slot_date,
        "start_time": row.start_time,
        "fee": row.fee,
        "status": row.status,
        "meeting_provider": row.meeting_provider,
        "meeting_url": row.meeting_url,
        "doctor": {
            "id": row.doctor.id,
            "name": doctor_user.name,
            "specialty": row.doctor.specialty,
            "experience_years": row.doctor.experience_years,
            "consult_fee": row.doctor.consult_fee,
        },
        "patient": {
            "id": row.patient.id,
            "name": patient_user.name,
            "email": patient_user.email,
        },
        "report": report,
        "created_at": row.created_at.isoformat(),
    }


@router.post("/auth/register")
def register(body: RegisterBody, db: Session = Depends(get_db)):
    role = body.role.strip().lower()
    if role not in {"patient", "doctor"}:
        raise HTTPException(status_code=400, detail="Role must be patient or doctor.")
    email = body.email.lower().strip()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Enter a valid email.")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="That email is already registered.")
    salt = make_salt()
    user = User(
        email=email,
        name=(body.name or email.split("@")[0]).strip(),
        role=role,
        salt=salt,
        password_hash=hash_password(salt, body.password),
        phone=body.phone.strip(),
        whatsapp=(body.whatsapp or body.phone).strip(),
    )
    db.add(user)
    db.flush()
    if role == "patient":
        db.add(PatientProfile(user_id=user.id, approval_status="pending"))
    else:
        if body.specialty.strip().lower() not in {"psychiatry", "psychiatrist"}:
            raise HTTPException(status_code=400, detail="Doctors listed for consult must specialize in Psychiatry.")
        db.add(
            DoctorProfile(
                user_id=user.id,
                license_number=body.license_number.strip(),
                license_authority=body.license_authority.strip(),
                specialty="Psychiatry",
                experience_years=max(0, body.experience_years),
                bio=body.bio.strip(),
                consult_fee=float(body.consult_fee or 500),
                license_status="pending",
            )
        )
    db.commit()
    db.refresh(user)
    token = create_session(db, user)
    return {"token": token, "user": user_payload(user)}


@router.post("/auth/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    user = db.query(User).options(
        joinedload(User.doctor_profile),
        joinedload(User.patient_profile),
    ).filter(User.email == email).first()
    if not user or user.password_hash != hash_password(user.salt, body.password):
        raise HTTPException(status_code=401, detail="Email or password does not match.")
    token = create_session(db, user)
    return {"token": token, "user": user_payload(user)}


@router.get("/me")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).options(
        joinedload(User.doctor_profile),
        joinedload(User.patient_profile),
    ).filter(User.id == user.id).first()
    return user_payload(user)


@router.get("/notifications")
def list_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": row.id,
            "kind": row.kind,
            "title": row.title,
            "message": row.message,
            "channel": row.channel,
            "read": row.read,
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]


def _doctor_card(d: DoctorProfile) -> dict:
    return {
        "id": d.id,
        "name": d.user.name,
        "email": d.user.email,
        "license_number": d.license_number,
        "license_authority": d.license_authority,
        "license_expiry": d.license_expiry,
        "specialty": d.specialty,
        "experience_years": d.experience_years,
        "consult_fee": d.consult_fee,
        "license_status": d.license_status,
        "license_note": d.license_note,
        "bio": d.bio,
    }


def _patient_card(p: PatientProfile) -> dict:
    return {
        "id": p.id,
        "name": p.user.name,
        "email": p.user.email,
        "phone": p.user.phone,
        "approval_status": p.approval_status,
        "approval_note": p.approval_note,
        "approved_at": p.approved_at.isoformat() if p.approved_at else None,
    }


@router.get("/admin/overview")
def admin_overview(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(user, "admin")
    all_doctors = (
        db.query(DoctorProfile)
        .options(joinedload(DoctorProfile.user))
        .order_by(DoctorProfile.license_status.desc(), DoctorProfile.id.asc())
        .all()
    )
    all_patients = (
        db.query(PatientProfile)
        .options(joinedload(PatientProfile.user))
        .order_by(PatientProfile.approval_status.desc(), PatientProfile.id.asc())
        .all()
    )
    pending_doctors = [d for d in all_doctors if d.license_status == "pending"]
    pending_patients = [p for p in all_patients if p.approval_status == "pending"]
    consultations = (
        db.query(Consultation)
        .options(
            joinedload(Consultation.doctor).joinedload(DoctorProfile.user),
            joinedload(Consultation.patient).joinedload(PatientProfile.user),
            joinedload(Consultation.report),
        )
        .order_by(Consultation.created_at.desc())
        .limit(30)
        .all()
    )
    return {
        "pending_doctors": [_doctor_card(d) for d in pending_doctors],
        "pending_patients": [_patient_card(p) for p in pending_patients],
        "all_doctors": [_doctor_card(d) for d in all_doctors],
        "all_patients": [_patient_card(p) for p in all_patients],
        "consultations": [consultation_payload(c) for c in consultations],
        "counts": {
            "doctors_approved": sum(1 for d in all_doctors if d.license_status == "approved"),
            "doctors_pending": len(pending_doctors),
            "patients_approved": sum(1 for p in all_patients if p.approval_status == "approved"),
            "patients_pending": len(pending_patients),
            "consultations": db.query(Consultation).count(),
        },
    }


@router.post("/admin/doctors/{doctor_id}/license")
def admin_doctor_license(
    doctor_id: int,
    body: ApprovalBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_role(user, "admin")
    if body.status not in {"approved", "rejected"}:
        raise HTTPException(status_code=400, detail="Status must be approved or rejected.")
    doctor = db.query(DoctorProfile).options(joinedload(DoctorProfile.user)).filter(DoctorProfile.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found.")
    doctor.license_status = body.status
    doctor.license_note = body.note
    db.add(
        AdminAction(
            admin_id=user.id,
            action=f"doctor_license_{body.status}",
            target_type="doctor",
            target_id=doctor.id,
            reason=body.note,
        )
    )
    notify_user(
        db,
        doctor.user,
        "license",
        f"License {body.status} by Admin",
        body.note or f"Your psychiatry license was {body.status} by the admin.",
    )
    db.commit()
    return {"ok": True, "license_status": doctor.license_status}


@router.post("/admin/patients/{patient_id}/approval")
def admin_patient_approval(
    patient_id: int,
    body: ApprovalBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_role(user, "admin")
    if body.status not in {"approved", "rejected"}:
        raise HTTPException(status_code=400, detail="Status must be approved or rejected.")
    patient = (
        db.query(PatientProfile)
        .options(joinedload(PatientProfile.user))
        .filter(PatientProfile.id == patient_id)
        .first()
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")
    patient.approval_status = body.status
    patient.approval_note = body.note
    patient.approved_by_admin_id = user.id
    patient.approved_at = datetime.utcnow()
    db.add(
        AdminAction(
            admin_id=user.id,
            action=f"patient_{body.status}",
            target_type="patient",
            target_id=patient.id,
            reason=body.note,
        )
    )
    # Approval must come from admin only — this endpoint is admin-gated.
    notify_user(
        db,
        patient.user,
        "approval",
        f"Consultation access {body.status} by Admin",
        body.note
        or (
            "Admin approved your consultation access. You can now book psychiatry doctors."
            if body.status == "approved"
            else "Admin rejected consultation access for now."
        ),
    )
    db.commit()
    return {"ok": True, "approval_status": patient.approval_status}


@router.get("/doctors")
def list_doctors(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(user, "patient", "admin")
    rows = (
        db.query(DoctorProfile)
        .options(joinedload(DoctorProfile.user))
        .filter(DoctorProfile.license_status == "approved", DoctorProfile.specialty == "Psychiatry")
        .all()
    )
    return [
        {
            "id": d.id,
            "name": d.user.name,
            "email": d.user.email,
            "specialty": d.specialty,
            "experience_years": d.experience_years,
            "bio": d.bio,
            "consult_fee": d.consult_fee,
            "meeting_provider_default": d.meeting_provider_default,
        }
        for d in rows
    ]


@router.get("/doctors/{doctor_id}/slots")
def doctor_slots(doctor_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(user, "patient", "doctor", "admin")
    slots = (
        db.query(AvailabilitySlot)
        .filter(
            AvailabilitySlot.doctor_id == doctor_id,
            AvailabilitySlot.is_booked.is_(False),
            AvailabilitySlot.slot_date >= date_today(),
        )
        .order_by(AvailabilitySlot.slot_date, AvailabilitySlot.start_time)
        .all()
    )
    return [
        {
            "id": s.id,
            "slot_date": s.slot_date,
            "start_time": s.start_time,
            "end_time": s.end_time,
        }
        for s in slots
    ]


def date_today() -> str:
    return datetime.utcnow().date().isoformat()


@router.post("/doctor/slots")
def add_slot(body: SlotBody, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(user, "doctor")
    doctor = db.query(DoctorProfile).filter(DoctorProfile.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=400, detail="Doctor profile missing.")
    if doctor.license_status != "approved":
        raise HTTPException(status_code=403, detail="License must be approved by Admin before adding slots.")
    slot_date = body.slot_date.strip()
    start_time = body.start_time.strip()
    if not slot_date or not start_time:
        raise HTTPException(status_code=400, detail="Date and start time are required.")
    if slot_date < date_today():
        raise HTTPException(status_code=400, detail="Availability must be today or a future date.")
    existing = (
        db.query(AvailabilitySlot)
        .filter(
            AvailabilitySlot.doctor_id == doctor.id,
            AvailabilitySlot.slot_date == slot_date,
            AvailabilitySlot.start_time == start_time,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"You already have a slot on {slot_date} at {start_time}. Pick another time.",
        )
    slot = AvailabilitySlot(
        doctor_id=doctor.id,
        slot_date=slot_date,
        start_time=start_time,
        end_time=(body.end_time or start_time).strip(),
        is_booked=False,
    )
    db.add(slot)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"You already have a slot on {slot_date} at {start_time}. Pick another time.",
        )
    db.refresh(slot)
    return {"id": slot.id, "slot_date": slot.slot_date, "start_time": slot.start_time, "end_time": slot.end_time}


@router.get("/doctor/slots")
def my_slots(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(user, "doctor")
    doctor = db.query(DoctorProfile).filter(DoctorProfile.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=400, detail="Doctor profile missing.")
    slots = (
        db.query(AvailabilitySlot)
        .filter(AvailabilitySlot.doctor_id == doctor.id, AvailabilitySlot.slot_date >= date_today())
        .order_by(AvailabilitySlot.slot_date, AvailabilitySlot.start_time)
        .all()
    )
    return [
        {
            "id": s.id,
            "slot_date": s.slot_date,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "is_booked": s.is_booked,
        }
        for s in slots
    ]


@router.get("/doctor/consultations")
def doctor_consultations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(user, "doctor")
    doctor = db.query(DoctorProfile).filter(DoctorProfile.user_id == user.id).first()
    rows = (
        db.query(Consultation)
        .options(
            joinedload(Consultation.patient).joinedload(PatientProfile.user),
            joinedload(Consultation.doctor).joinedload(DoctorProfile.user),
            joinedload(Consultation.report),
        )
        .filter(Consultation.doctor_id == doctor.id)
        .order_by(Consultation.slot_date.desc(), Consultation.start_time.desc())
        .all()
    )
    return [consultation_payload(c) for c in rows]


@router.post("/consultations/{consultation_id}/cancel")
def cancel_consultation(
    consultation_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_role(user, "patient", "doctor", "admin")
    row = (
        db.query(Consultation)
        .options(
            joinedload(Consultation.doctor).joinedload(DoctorProfile.user),
            joinedload(Consultation.patient).joinedload(PatientProfile.user),
            joinedload(Consultation.report),
        )
        .filter(Consultation.id == consultation_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Consultation not found.")
    if row.status == "completed":
        raise HTTPException(status_code=400, detail="Completed visits cannot be cancelled.")
    if user.role == "patient" and row.patient.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your consultation.")
    if user.role == "doctor" and row.doctor.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your consultation.")
    row.status = "cancelled"
    if row.slot_id:
        slot = db.get(AvailabilitySlot, row.slot_id)
        if slot:
            slot.is_booked = False
    notify_user(
        db,
        row.patient.user,
        "booking",
        "Consultation cancelled",
        f"Your consult on {row.slot_date} at {row.start_time} with {row.doctor.user.name} was cancelled.",
    )
    notify_user(
        db,
        row.doctor.user,
        "booking",
        "Consultation cancelled",
        f"Consult with {row.patient.user.name} on {row.slot_date} at {row.start_time} was cancelled.",
    )
    db.commit()
    return consultation_payload(row)


@router.post("/consultations/book")
def book_consultation(body: BookBody, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(user, "patient")
    patient = db.query(PatientProfile).options(joinedload(PatientProfile.user)).filter(PatientProfile.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=400, detail="Patient profile missing.")
    if patient.approval_status != "approved":
        raise HTTPException(
            status_code=403,
            detail="Admin approval is required before booking. Only Admin can approve patients.",
        )
    doctor = (
        db.query(DoctorProfile)
        .options(joinedload(DoctorProfile.user))
        .filter(DoctorProfile.id == body.doctor_id, DoctorProfile.license_status == "approved")
        .first()
    )
    if not doctor:
        raise HTTPException(status_code=404, detail="Approved psychiatry doctor not found.")
    slot = (
        db.query(AvailabilitySlot)
        .filter(
            AvailabilitySlot.id == body.slot_id,
            AvailabilitySlot.doctor_id == doctor.id,
            AvailabilitySlot.is_booked.is_(False),
        )
        .first()
    )
    if not slot:
        raise HTTPException(status_code=400, detail="That slot is unavailable.")

    prior = (
        db.query(Consultation)
        .filter(Consultation.patient_id == patient.id, Consultation.doctor_id == doctor.id)
        .count()
    )
    provider = body.meeting_provider if body.meeting_provider in {"google_meet", "zoom"} else "google_meet"
    when = f"{slot.slot_date} {slot.start_time}"
    url = meeting_link(provider, doctor.user.name, when)
    consult = Consultation(
        patient_id=patient.id,
        doctor_id=doctor.id,
        slot_id=slot.id,
        visit_number=prior + 1,
        slot_date=slot.slot_date,
        start_time=slot.start_time,
        fee=doctor.consult_fee,
        status="scheduled",
        meeting_provider=provider,
        meeting_url=url,
    )
    slot.is_booked = True
    db.add(consult)
    db.flush()

    message = (
        f"Consultation booked with {doctor.user.name} (Psychiatry, {doctor.experience_years} yrs).\n"
        f"Date: {slot.slot_date}\nTime: {slot.start_time}\nFee: ₹{doctor.consult_fee:.0f}\n"
        f"Join via {provider.replace('_', ' ')}: {url}\n"
        f"Visit number: {consult.visit_number}"
    )
    notify_user(db, patient.user, "booking", "Consultation confirmed", message)
    notify_user(
        db,
        doctor.user,
        "booking",
        "New consultation booked",
        f"{patient.user.name} booked {slot.slot_date} at {slot.start_time}. Fee ₹{doctor.consult_fee:.0f}.",
    )
    db.commit()
    db.refresh(consult)
    consult = (
        db.query(Consultation)
        .options(
            joinedload(Consultation.doctor).joinedload(DoctorProfile.user),
            joinedload(Consultation.patient).joinedload(PatientProfile.user),
            joinedload(Consultation.report),
        )
        .filter(Consultation.id == consult.id)
        .first()
    )
    return consultation_payload(consult)


@router.patch("/consultations/{consultation_id}/meeting")
def update_meeting(
    consultation_id: int,
    body: MeetingBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_role(user, "doctor", "admin")
    row = (
        db.query(Consultation)
        .options(
            joinedload(Consultation.doctor).joinedload(DoctorProfile.user),
            joinedload(Consultation.patient).joinedload(PatientProfile.user),
            joinedload(Consultation.report),
        )
        .filter(Consultation.id == consultation_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Consultation not found.")
    if user.role == "doctor" and row.doctor.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your consultation.")
    if body.meeting_provider in {"google_meet", "zoom"}:
        row.meeting_provider = body.meeting_provider
    if body.meeting_url.strip():
        row.meeting_url = body.meeting_url.strip()
    elif not row.meeting_url:
        row.meeting_url = meeting_link(row.meeting_provider, row.doctor.user.name, f"{row.slot_date} {row.start_time}")
    notify_user(
        db,
        row.patient.user,
        "meeting",
        "Meeting link updated",
        f"Your consult on {row.slot_date} {row.start_time} link: {row.meeting_url}",
    )
    db.commit()
    return consultation_payload(row)


@router.post("/consultations/{consultation_id}/report")
def write_report(
    consultation_id: int,
    body: ReportBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_role(user, "doctor")
    row = (
        db.query(Consultation)
        .options(
            joinedload(Consultation.doctor),
            joinedload(Consultation.patient).joinedload(PatientProfile.user),
            joinedload(Consultation.report),
        )
        .filter(Consultation.id == consultation_id)
        .first()
    )
    if not row or row.doctor.user_id != user.id:
        raise HTTPException(status_code=404, detail="Consultation not found.")
    if row.report:
        report = row.report
        report.summary = body.summary
        report.diet = body.diet
        report.lifestyle = body.lifestyle
        report.recommendations = body.recommendations
        report.recovery_score = body.recovery_score
        report.next_follow_up = body.next_follow_up
    else:
        report = ConsultationReport(
            consultation_id=row.id,
            summary=body.summary,
            diet=body.diet,
            lifestyle=body.lifestyle,
            recommendations=body.recommendations,
            recovery_score=body.recovery_score,
            next_follow_up=body.next_follow_up,
        )
        db.add(report)
    row.status = "completed"
    notify_user(
        db,
        row.patient.user,
        "report",
        "Consultation report ready",
        f"Visit {row.visit_number} report is available, including diet and lifestyle guidance. Recovery score: {body.recovery_score}.",
    )
    db.commit()
    row = (
        db.query(Consultation)
        .options(
            joinedload(Consultation.doctor).joinedload(DoctorProfile.user),
            joinedload(Consultation.patient).joinedload(PatientProfile.user),
            joinedload(Consultation.report),
        )
        .filter(Consultation.id == consultation_id)
        .first()
    )
    return consultation_payload(row)


@router.get("/patient/consultations")
def patient_consultations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(user, "patient")
    patient = db.query(PatientProfile).filter(PatientProfile.user_id == user.id).first()
    rows = (
        db.query(Consultation)
        .options(
            joinedload(Consultation.doctor).joinedload(DoctorProfile.user),
            joinedload(Consultation.patient).joinedload(PatientProfile.user),
            joinedload(Consultation.report),
        )
        .filter(Consultation.patient_id == patient.id)
        .order_by(Consultation.slot_date.asc(), Consultation.start_time.asc())
        .all()
    )
    return [consultation_payload(c) for c in rows]


@router.get("/patient/recovery")
def patient_recovery(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(user, "patient")
    patient = db.query(PatientProfile).filter(PatientProfile.user_id == user.id).first()
    rows = (
        db.query(Consultation)
        .options(joinedload(Consultation.report), joinedload(Consultation.doctor).joinedload(DoctorProfile.user))
        .filter(Consultation.patient_id == patient.id, Consultation.status == "completed")
        .order_by(Consultation.visit_number.asc())
        .all()
    )
    points = []
    for row in rows:
        if not row.report:
            continue
        points.append(
            {
                "visit_number": row.visit_number,
                "slot_date": row.slot_date,
                "doctor": row.doctor.user.name,
                "recovery_score": row.report.recovery_score,
                "fee": row.fee,
            }
        )
    trend = "stable"
    if len(points) >= 2:
        delta = points[-1]["recovery_score"] - points[0]["recovery_score"]
        if delta >= 8:
            trend = "improving"
        elif delta <= -8:
            trend = "needs_attention"
    return {"points": points, "trend": trend}
