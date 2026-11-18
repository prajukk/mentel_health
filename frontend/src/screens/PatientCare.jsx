import { useEffect, useMemo, useState } from "react"
import {
  careBook,
  careCancelConsultation,
  careDoctorSlots,
  careListDoctors,
  careMe,
  careNotifications,
  carePatientConsultations,
  carePatientRecovery,
} from "../careApi.js"
import Header from "../components/Header.jsx"

export default function PatientCare({
  account,
  careUser,
  onHome,
  onNewCheckIn,
  onHistory,
  onEvaluation,
  onProfile,
  onSignOut,
  onCareHome,
  onCareUserChange,
  historyCount = 0,
}) {
  const [doctors, setDoctors] = useState([])
  const [slots, setSlots] = useState([])
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState("")
  const [provider, setProvider] = useState("google_meet")
  const [consults, setConsults] = useState([])
  const [recovery, setRecovery] = useState({ points: [], trend: "stable" })
  const [notes, setNotes] = useState([])
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [profile, setProfile] = useState(careUser)
  const [loadingPage, setLoadingPage] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const approved = profile?.patient?.approval_status === "approved"

  async function load() {
    setLoadingPage(true)
    try {
      const me = await careMe()
      setProfile(me)
      onCareUserChange?.(me)
      const isApproved = me?.patient?.approval_status === "approved"
      const [c, r, n] = await Promise.all([carePatientConsultations(), carePatientRecovery(), careNotifications()])
      setConsults(c)
      setRecovery(r)
      setNotes(n.slice(0, 8))
      if (isApproved) {
        const list = await careListDoctors()
        setDoctors(list)
      } else {
        setDoctors([])
      }
      setError("")
    } catch (reason) {
      setError(reason.message)
    } finally {
      setLoadingPage(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function pickDoctor(doctor) {
    setSelectedDoctor(doctor)
    setSelectedSlot("")
    setSlots([])
    setLoadingSlots(true)
    try {
      setSlots(await careDoctorSlots(doctor.id))
      setError("")
    } catch (reason) {
      setError(reason.message)
    } finally {
      setLoadingSlots(false)
    }
  }

  async function book() {
    if (!selectedDoctor || !selectedSlot) return
    try {
      const booked = await careBook({
        doctor_id: selectedDoctor.id,
        slot_id: Number(selectedSlot),
        meeting_provider: provider,
      })
      const emailNote = booked.email_sent
        ? `Confirmation emailed to ${booked.email_to}.`
        : `Saved in-app only — email not delivered${booked.email_to ? ` to ${booked.email_to}` : ""}${
            booked.email_detail ? `: ${booked.email_detail}` : "."
          }`
      setMessage(
        `Booked visit ${booked.visit_number} with ${booked.doctor.name} on ${booked.slot_date} at ${booked.start_time}. Fee ₹${booked.fee}. ${emailNote}`,
      )
      setSelectedSlot("")
      await load()
      if (selectedDoctor) setSlots(await careDoctorSlots(selectedDoctor.id))
    } catch (reason) {
      setError(reason.message)
    }
  }

  const reportCards = useMemo(() => consults.filter((c) => c.report), [consults])

  return (
    <section className="page">
      <Header
        currentView="patient"
        account={account}
        careRole={careUser?.role}
        onHome={onHome}
        onNewCheckIn={onNewCheckIn}
        onHistory={onHistory}
        onEvaluation={onEvaluation}
        onProfile={onProfile}
        onSignOut={onSignOut}
        onCare={onCareHome}
        historyCount={historyCount}
      />
      <div className="mx-auto mt-8 max-w-5xl space-y-8">
        <div>
          <p className="eyebrow">Patient consultation</p>
          <h1 className="mt-2 font-display text-4xl">Psychiatry doctors</h1>
          <p className="mt-3 max-w-2xl text-muted">
            Screening check-ins stay available on Home. Consultation booking unlocks only after Admin approval.
          </p>
          <p className="mt-2 text-sm">
            Approval status:{" "}
            <span className="font-medium capitalize text-ink">{profile?.patient?.approval_status || "pending"}</span>
          </p>
        </div>

        {!approved && (
          <div className="rounded-xl border border-moderate/30 bg-[#FFF8ED] p-4 text-sm text-moderate">
            Waiting for Admin approval. Only Admin can approve patient consultation access — not doctors or other users.
            Your request is already visible in the Admin module. Screening check-ins on Home still work meanwhile.
            <button type="button" onClick={load} className="ml-2 underline">
              Refresh status
            </button>
          </div>
        )}

        {error && <p className="rounded-xl border border-high/30 bg-[#FFF5F4] p-3 text-sm text-high">{error}</p>}
        {message && <p className="rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm text-accent">{message}</p>}

        {approved && (
          <div className="rounded-[22px] border border-line bg-card p-5">
            <h2 className="font-display text-2xl">Find a doctor (min. 3 psychiatry specialists)</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {doctors.map((doctor) => (
                <button
                  key={doctor.id}
                  type="button"
                  onClick={() => pickDoctor(doctor)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selectedDoctor?.id === doctor.id ? "border-accent bg-accent/5" : "border-line bg-paper/50 hover:border-accent/40"
                  }`}
                >
                  <p className="font-medium text-ink">{doctor.name}</p>
                  <p className="mt-1 text-xs text-muted">
                    {doctor.specialty} · {doctor.experience_years} yrs experience
                  </p>
                  <p className="mt-2 text-sm text-ink">Consult fee ₹{doctor.consult_fee}</p>
                  <p className="mt-2 text-xs text-muted line-clamp-3">{doctor.bio}</p>
                </button>
              ))}
            </div>

            {selectedDoctor && (
              <div className="mt-6 rounded-2xl border border-line bg-paper/40 p-4">
                <p className="font-medium">Book {selectedDoctor.name}</p>
                {loadingSlots ? (
                  <p className="mt-3 text-sm text-muted">Loading available date and time slots…</p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-3">
                    <select
                      value={selectedSlot}
                      onChange={(e) => setSelectedSlot(e.target.value)}
                      className="rounded-2xl border border-line bg-card px-3 py-2 text-sm"
                    >
                      <option value="">{slots.length ? "Select date & time" : "No open slots"}</option>
                      {slots.map((slot) => (
                        <option key={slot.id} value={slot.id}>
                          {slot.slot_date} · {slot.start_time}
                        </option>
                      ))}
                    </select>
                    <select value={provider} onChange={(e) => setProvider(e.target.value)} className="rounded-2xl border border-line bg-card px-3 py-2 text-sm">
                      <option value="google_meet">Google Meet</option>
                      <option value="zoom">Zoom</option>
                    </select>
                    <button
                      type="button"
                      onClick={book}
                      disabled={!selectedSlot}
                      className="rounded-full bg-accent px-5 py-2 text-sm text-white disabled:opacity-50"
                    >
                      Confirm booking (₹{selectedDoctor.consult_fee})
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {loadingPage && <p className="text-sm text-muted">Loading consultation data…</p>}

        <div className="rounded-[22px] border border-line bg-card p-5">
          <h2 className="font-display text-2xl">Recovery across visits</h2>
          <p className="mt-2 text-sm text-muted">
            Trend: <span className="capitalize text-ink">{recovery.trend.replace("_", " ")}</span>
          </p>
          <RecoveryChart points={recovery.points || []} />
        </div>

        <div className="rounded-[22px] border border-line bg-card p-5">
          <h2 className="font-display text-2xl">My consultations</h2>
          <ul className="mt-4 space-y-3">
            {consults.map((row) => (
              <li key={row.id} className="rounded-2xl border border-line bg-paper/50 p-4">
                <p className="font-medium text-ink">
                  Visit {row.visit_number} · {row.doctor.name} · {row.slot_date} {row.start_time}
                </p>
                <p className="text-sm text-muted">
                  Fee ₹{row.fee} · {row.status} · {row.meeting_provider.replace("_", " ")}
                </p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {row.meeting_url && row.status === "scheduled" && (
                    <a href={row.meeting_url} target="_blank" rel="noreferrer" className="text-sm text-accent hover:underline">
                      Join via {row.meeting_provider.replace("_", " ")}
                    </a>
                  )}
                  {row.status === "scheduled" && (
                    <button
                      type="button"
                      className="text-sm text-muted hover:text-high"
                      onClick={async () => {
                        try {
                          await careCancelConsultation(row.id)
                          await load()
                        } catch (reason) {
                          setError(reason.message)
                        }
                      }}
                    >
                      Cancel booking
                    </button>
                  )}
                </div>
              </li>
            ))}
            {!consults.length && <p className="text-sm text-muted">No consultations yet.</p>}
          </ul>
        </div>

        <div className="rounded-[22px] border border-line bg-card p-5">
          <h2 className="font-display text-2xl">Consultation reports</h2>
          <ul className="mt-4 space-y-4">
            {reportCards.map((row) => (
              <li key={row.id} className="rounded-2xl border border-line bg-paper/50 p-4">
                <p className="font-medium">
                  Visit {row.visit_number} · Recovery {row.report.recovery_score}
                </p>
                <p className="mt-2 text-sm text-muted">{row.report.summary}</p>
                <p className="mt-3 text-sm">
                  <span className="font-medium text-ink">Diet:</span> {row.report.diet || "—"}
                </p>
                <p className="mt-1 text-sm">
                  <span className="font-medium text-ink">Lifestyle:</span> {row.report.lifestyle || "—"}
                </p>
                <p className="mt-1 text-sm text-muted">Next follow-up: {row.report.next_follow_up || "—"}</p>
              </li>
            ))}
            {!reportCards.length && <p className="text-sm text-muted">Reports appear after the doctor completes a visit.</p>}
          </ul>
        </div>

        <div className="rounded-[22px] border border-line bg-card p-5">
          <h2 className="font-display text-2xl">Notifications</h2>
          <ul className="mt-3 space-y-2">
            {notes.map((note) => (
              <li key={`${note.id}-${note.channel}`} className="rounded-xl border border-line bg-paper/40 px-3 py-2 text-sm">
                <span className="font-medium">{note.title}</span>
                <span className="text-muted"> · {note.channel}</span>
                <p className="mt-1 text-muted whitespace-pre-wrap">{note.message}</p>
              </li>
            ))}
            {!notes.length && <p className="text-sm text-muted">No notifications yet.</p>}
          </ul>
        </div>
      </div>
    </section>
  )
}

function RecoveryChart({ points }) {
  if (!points.length) {
    return <p className="mt-4 text-sm text-muted">Complete 2–3 consultations to see recovery progress.</p>
  }
  const width = 640
  const height = 220
  const pad = { left: 40, right: 20, top: 24, bottom: 40 }
  const scores = points.map((p) => Number(p.recovery_score) || 0)
  const low = Math.max(0, Math.min(...scores) - 5)
  const high = Math.min(100, Math.max(...scores) + 5)
  const span = high - low || 1
  const coords = points.map((point, index) => {
    const x = pad.left + (index / Math.max(points.length - 1, 1)) * (width - pad.left - pad.right)
    const y = pad.top + ((high - point.recovery_score) / span) * (height - pad.top - pad.bottom)
    return { ...point, x, y }
  })
  const path = coords.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 w-full" role="img" aria-label="Recovery score by visit">
      <line x1={pad.left} x2={pad.left} y1={pad.top} y2={height - pad.bottom} stroke="#E6DCCB" />
      <line x1={pad.left} x2={width - pad.right} y1={height - pad.bottom} y2={height - pad.bottom} stroke="#E6DCCB" />
      <path d={path} fill="none" stroke="#0E6B67" strokeWidth="2.5" />
      {coords.map((point) => (
        <g key={point.visit_number}>
          <circle cx={point.x} cy={point.y} r="4.5" fill="#0E6B67" />
          <text x={point.x} y={point.y - 10} textAnchor="middle" fontSize="11" fill="#1F1A17">
            {point.recovery_score}
          </text>
          <text x={point.x} y={height - 16} textAnchor="middle" fontSize="11" fill="#6B625A">
            Visit {point.visit_number}
          </text>
        </g>
      ))}
    </svg>
  )
}
