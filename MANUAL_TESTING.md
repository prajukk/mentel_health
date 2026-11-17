# Manual testing flow

**URLs:** http://127.0.0.1:5173 · http://127.0.0.1:8000/docs

## Demo logins

Pick the role tab on the login screen first.

| Role | Email | Password |
|------|--------|----------|
| Admin | `admin@care.local` | `admin123` |
| Doctor | `dr.meera@care.local` (also `dr.arjun@care.local`, `dr.leena@care.local`) | `doctor123` |
| Patient | `patient@care.local` | `patient123` |

---

## 0. Start servers

```powershell
cd d:\odee\mentalhealth\mentel_health
.\.venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 --reload
```

```powershell
cd d:\odee\mentalhealth\mentel_health\frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

Optional seed (if care DB is empty):

```powershell
cd d:\odee\mentalhealth\mentel_health
.\.venv\Scripts\python.exe -m backend.seed_care
```

---

## 1. Patient – screening (existing flow)

1. Role **Patient** → sign in as `patient@care.local`
2. **Home** loads → **New check-in**
3. Journal (type a short stress note) → **Next: Behavior**
4. Fill sleep / energy / company / routine → **Skip optional & see result**
5. Confirm **Result** page (risk flag, tip, writing/behavior notes)
6. **History** shows the new entry; open it
7. **Evaluation** loads F1 / missing-data charts

---

## 2. Patient – consultation

1. Open **Consult**
2. Confirm **Approval status: approved** and at least **3** psychiatry doctors
3. Pick a doctor → wait for slots → choose date/time + Meet or Zoom → **Confirm booking**
4. Check success banner, consultation list (**scheduled**), Join link, **Cancel booking**
5. Check **Recovery** trend and any diet/lifestyle **reports**
6. Check **Notifications** (`in_app`; `email` if Resend is configured)

---

## 3. Doctor

1. Sign out → role **Doctor** → `dr.meera@care.local` / `doctor123`
2. Confirm specialty, fee, license **approved**
3. **Add availability** (date + time → Save slot)
4. Open a **scheduled** consult → optional Update meeting link
5. **Write report** (summary, diet, lifestyle, recovery score, next follow-up)
6. Sign out; as patient, confirm report + recovery update on **Consult**

---

## 4. Admin

1. Role **Admin** → `admin@care.local` / `admin123`
2. Overview: approved doctors (≥3), patients, consultation count
3. **Pending licenses / patients** – approve or reject if any appear
4. Confirm doctor list + patient list show license/approval status
5. Confirm recent consultations appear

---

## 5. Approval gate (optional)

1. Create a new **Patient** account (or use a fresh email)
2. As that user, open **Consult** → booking should stay locked until admin approval
3. As **Admin**, approve the patient
4. As patient again → booking works

---

## 6. Resend email (optional)

1. Set `RESEND_API_KEY` and `RESEND_FROM` in `.env`, then restart the API
2. With `onboarding@resend.dev`, only your Resend account email can receive mail
3. Book a consult → check inbox (and spam) for confirmation

To email real patients, verify a domain at [resend.com/domains](https://resend.com/domains) and set `RESEND_FROM` to an address on that domain.

---

## Quick pass / fail checklist

- [ ] Check-in → result → history
- [ ] Evaluation charts
- [ ] Patient sees 3 doctors, books Meet/Zoom, cancels
- [ ] Doctor slots + report with diet/lifestyle
- [ ] Admin approvals + counts
- [ ] Unapproved patient cannot book
- [ ] Header stays one row (no orphaned Profile)
- [ ] Resend email notification (if configured)
