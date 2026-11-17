import { useEffect, useState } from "react"
import {
  careAddSlot,
  careCancelConsultation,
  careDoctorConsultations,
  careMySlots,
  careUpdateMeeting,
  careWriteReport,
} from "../careApi.js"
import Header from "../components/Header.jsx"

const emptyReport = {
  summary: "",
  diet: "",
  lifestyle: "",
  recommendations: "",
  recovery_score: 60,
  next_follow_up: "",
}

export default function DoctorCare({
  account,
  careUser,
  onHome,
  onNewCheckIn,
  onHistory,
  onEvaluation,
  onProfile,
  onSignOut,
  onCareHome,
  historyCount = 0,
}) {
  const [rows, setRows] = useState([])
  const [mySlots, setMySlots] = useState([])
  const [error, setError] = useState("")
  const [slotDate, setSlotDate] = useState("")
  const [slotTime, setSlotTime] = useState("10:00")
  const [activeId, setActiveId] = useState(null)
  const [report, setReport] = useState(emptyReport)
  const [meetingUrl, setMeetingUrl] = useState("")
  const [meetingProvider, setMeetingProvider] = useState("google_meet")

  async function load() {
    try {
      const [consults, slots] = await Promise.all([careDoctorConsultations(), careMySlots()])
      setRows(consults)
      setMySlots(slots)
      setError("")
    } catch (reason) {
      setError(reason.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function addSlot(event) {
    event.preventDefault()
    try {
      await careAddSlot({ slot_date: slotDate, start_time: slotTime, end_time: slotTime })
      setError("")
      await load()
    } catch (reason) {
      setError(reason.message)
    }
  }

  async function saveMeeting(id) {
    try {
      await careUpdateMeeting(id, { meeting_provider: meetingProvider, meeting_url: meetingUrl })
      setMeetingUrl("")
      await load()
    } catch (reason) {
      setError(reason.message)
    }
  }

  async function cancelVisit(id) {
    try {
      await careCancelConsultation(id)
      await load()
    } catch (reason) {
      setError(reason.message)
    }
  }

  async function submitReport(id) {
    try {
      await careWriteReport(id, report)
      setActiveId(null)
      setReport(emptyReport)
      await load()
    } catch (reason) {
      setError(reason.message)
    }
  }

  const license = careUser?.doctor?.license_status || "pending"

  return (
    <section className="page">
      <Header
        currentView="doctor"
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
          <p className="eyebrow">Doctor module</p>
          <h1 className="mt-2 font-display text-4xl">{careUser?.name || "Doctor"}</h1>
          <p className="mt-3 text-muted">
            Specialty: Psychiatry · Experience: {careUser?.doctor?.experience_years ?? "—"} yrs · Fee: ₹
            {careUser?.doctor?.consult_fee ?? "—"} · License: <span className="capitalize">{license}</span>
          </p>
          {license !== "approved" && (
            <p className="mt-2 rounded-xl border border-moderate/30 bg-[#FFF8ED] p-3 text-sm text-moderate">
              Waiting for Admin license approval. You cannot accept bookings until approved.
            </p>
          )}
        </div>

        {error && <p className="rounded-xl border border-high/30 bg-[#FFF5F4] p-3 text-sm text-high">{error}</p>}

        <form onSubmit={addSlot} className="rounded-[22px] border border-line bg-card p-5">
          <h2 className="font-display text-2xl">Add availability</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <input type="date" required value={slotDate} onChange={(e) => setSlotDate(e.target.value)} className="rounded-2xl border border-line bg-paper px-3 py-2" />
            <input type="time" required value={slotTime} onChange={(e) => setSlotTime(e.target.value)} className="rounded-2xl border border-line bg-paper px-3 py-2" />
            <button type="submit" className="rounded-full bg-accent px-5 py-2 text-sm text-white">
              Save slot
            </button>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {mySlots.slice(0, 12).map((slot) => (
              <li key={slot.id} className="rounded-xl border border-line bg-paper/50 px-3 py-2 text-xs text-muted">
                {slot.slot_date} · {slot.start_time} · {slot.is_booked ? "booked" : "open"}
              </li>
            ))}
          </ul>
        </form>

        <div className="rounded-[22px] border border-line bg-card p-5">
          <h2 className="font-display text-2xl">Consultations</h2>
          <ul className="mt-4 space-y-4">
            {rows.map((row) => (
              <li key={row.id} className="rounded-2xl border border-line bg-paper/50 p-4">
                <p className="font-medium text-ink">
                  Visit {row.visit_number} · {row.patient.name} · {row.slot_date} {row.start_time}
                </p>
                <p className="text-sm text-muted">
                  Fee ₹{row.fee} · {row.status} · {row.meeting_provider.replace("_", " ")}
                </p>
                <a href={row.meeting_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-accent hover:underline">
                  Open meeting link
                </a>
                <div className="mt-3 flex flex-wrap gap-2">
                  <select
                    value={meetingProvider}
                    onChange={(e) => setMeetingProvider(e.target.value)}
                    className="rounded-2xl border border-line bg-card px-3 py-2 text-xs"
                  >
                    <option value="google_meet">Google Meet</option>
                    <option value="zoom">Zoom</option>
                  </select>
                  <input
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                    placeholder="Paste Google Meet / Zoom URL"
                    className="min-w-[240px] flex-1 rounded-2xl border border-line bg-card px-3 py-2 text-sm"
                  />
                  <button type="button" onClick={() => saveMeeting(row.id)} className="rounded-full border border-line px-4 py-2 text-xs">
                    Update link
                  </button>
                  {row.status === "scheduled" && (
                    <button type="button" onClick={() => cancelVisit(row.id)} className="rounded-full border border-line px-4 py-2 text-xs text-muted">
                      Cancel
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(row.id)
                      setReport({
                        summary: row.report?.summary || "",
                        diet: row.report?.diet || "",
                        lifestyle: row.report?.lifestyle || "",
                        recommendations: row.report?.recommendations || "",
                        recovery_score: row.report?.recovery_score ?? 60,
                        next_follow_up: row.report?.next_follow_up || "",
                      })
                    }}
                    className="rounded-full bg-accent px-4 py-2 text-xs text-white"
                  >
                    Write report
                  </button>
                </div>
                {activeId === row.id && (
                  <div className="mt-4 space-y-3 rounded-2xl border border-line bg-card p-4">
                    <Field label="Session summary" value={report.summary} onChange={(v) => setReport({ ...report, summary: v })} />
                    <Field label="Diet plan" value={report.diet} onChange={(v) => setReport({ ...report, diet: v })} />
                    <Field label="Lifestyle guidance" value={report.lifestyle} onChange={(v) => setReport({ ...report, lifestyle: v })} />
                    <Field label="Recommendations" value={report.recommendations} onChange={(v) => setReport({ ...report, recommendations: v })} />
                    <label className="block text-sm text-muted">
                      Recovery score (0-100)
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={report.recovery_score}
                        onChange={(e) => setReport({ ...report, recovery_score: Number(e.target.value) })}
                        className="mt-1 w-full rounded-2xl border border-line bg-paper px-3 py-2 text-ink"
                      />
                    </label>
                    <label className="block text-sm text-muted">
                      Next follow-up date
                      <input
                        type="date"
                        value={report.next_follow_up}
                        onChange={(e) => setReport({ ...report, next_follow_up: e.target.value })}
                        className="mt-1 w-full rounded-2xl border border-line bg-paper px-3 py-2 text-ink"
                      />
                    </label>
                    <button type="button" onClick={() => submitReport(row.id)} className="rounded-full bg-accent px-5 py-2 text-sm text-white">
                      Save report & complete visit
                    </button>
                  </div>
                )}
              </li>
            ))}
            {!rows.length && <p className="text-sm text-muted">No consultations yet.</p>}
          </ul>
        </div>
      </div>
    </section>
  )
}

function Field({ label, value, onChange }) {
  return (
    <label className="block text-sm text-muted">
      {label}
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="mt-1 w-full rounded-2xl border border-line bg-paper px-3 py-2 text-ink" />
    </label>
  )
}
