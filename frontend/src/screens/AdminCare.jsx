import { useEffect, useState } from "react"
import { careAdminOverview, careApproveDoctor, careApprovePatient } from "../careApi.js"
import Header from "../components/Header.jsx"
import Icon from "../components/Icons.jsx"

export default function AdminCare({
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
  const [data, setData] = useState(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState("")

  async function load() {
    try {
      setData(await careAdminOverview())
      setError("")
    } catch (reason) {
      setError(reason.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function decideDoctor(id, status) {
    setBusy(`d-${id}-${status}`)
    try {
      await careApproveDoctor(id, status, status === "approved" ? "License verified by Admin." : "License rejected by Admin.")
      await load()
    } catch (reason) {
      setError(reason.message)
    } finally {
      setBusy("")
    }
  }

  async function decidePatient(id, status) {
    setBusy(`p-${id}-${status}`)
    try {
      await careApprovePatient(
        id,
        status,
        status === "approved"
          ? "Admin approved your consultation access. You may now book psychiatry doctors."
          : "Admin rejected consultation access for now.",
      )
      await load()
    } catch (reason) {
      setError(reason.message)
    } finally {
      setBusy("")
    }
  }

  return (
    <section className="page">
      <Header
        currentView="admin"
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
          <p className="eyebrow">Admin module</p>
          <h1 className="mt-2 font-display text-4xl">Approvals & consultations</h1>
          <p className="mt-3 max-w-2xl text-muted">
            Doctor licenses and patient consultation access are approved here only. Patients receive approval from Admin, not from doctors.
          </p>
        </div>

        {data && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Approved doctors" value={data.counts.doctors_approved} />
            <Stat label="Pending licenses" value={data.counts.doctors_pending ?? data.pending_doctors?.length ?? 0} />
            <Stat label="Approved patients" value={data.counts.patients_approved} />
            <Stat label="Consultations" value={data.counts.consultations} />
          </div>
        )}

        {error && <p className="rounded-xl border border-high/30 bg-[#FFF5F4] p-3 text-sm text-high">{error}</p>}

        <Panel title="Pending doctor licenses">
          {!data?.pending_doctors?.length && <p className="text-sm text-muted">No pending licenses.</p>}
          <ul className="space-y-3">
            {data?.pending_doctors?.map((doctor) => (
              <li key={doctor.id} className="rounded-2xl border border-line bg-paper/60 p-4">
                <p className="font-medium text-ink">{doctor.name}</p>
                <p className="text-sm text-muted">
                  {doctor.specialty} · {doctor.experience_years} yrs · License {doctor.license_number} · ₹{doctor.consult_fee}
                </p>
                <div className="mt-3 flex gap-2">
                  <button type="button" disabled={!!busy} onClick={() => decideDoctor(doctor.id, "approved")} className="rounded-full bg-accent px-4 py-1.5 text-xs text-white">
                    Approve license
                  </button>
                  <button type="button" disabled={!!busy} onClick={() => decideDoctor(doctor.id, "rejected")} className="rounded-full border border-line px-4 py-1.5 text-xs text-muted">
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Pending patient approvals">
          {!data?.pending_patients?.length && <p className="text-sm text-muted">No pending patients.</p>}
          <ul className="space-y-3">
            {data?.pending_patients?.map((patient) => (
              <li key={patient.id} className="rounded-2xl border border-line bg-paper/60 p-4">
                <p className="font-medium text-ink">{patient.name}</p>
                <p className="text-sm text-muted">{patient.email} · {patient.phone || "no phone"}</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" disabled={!!busy} onClick={() => decidePatient(patient.id, "approved")} className="rounded-full bg-accent px-4 py-1.5 text-xs text-white">
                    Approve patient
                  </button>
                  <button type="button" disabled={!!busy} onClick={() => decidePatient(patient.id, "rejected")} className="rounded-full border border-line px-4 py-1.5 text-xs text-muted">
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="All doctor licenses (reflects in Admin)">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="py-2">Doctor</th>
                  <th className="py-2">License</th>
                  <th className="py-2">Experience</th>
                  <th className="py-2">Fee</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {(data?.all_doctors || []).map((doctor) => (
                  <tr key={doctor.id} className="border-t border-line">
                    <td className="py-2">
                      <p className="font-medium text-ink">{doctor.name}</p>
                      <p className="text-xs text-muted">{doctor.specialty}</p>
                    </td>
                    <td className="py-2">
                      {doctor.license_number}
                      <p className="text-xs text-muted">{doctor.license_authority}</p>
                    </td>
                    <td className="py-2">{doctor.experience_years} yrs</td>
                    <td className="py-2">₹{doctor.consult_fee}</td>
                    <td className="py-2 capitalize">{doctor.license_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="All patients (Admin approval only)">
          <ul className="space-y-2">
            {(data?.all_patients || []).map((patient) => (
              <li key={patient.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-paper/50 px-3 py-2 text-sm">
                <span>
                  {patient.name} · {patient.email}
                </span>
                <span className="capitalize text-muted">{patient.approval_status}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Recent consultations">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="py-2">Patient</th>
                  <th className="py-2">Doctor</th>
                  <th className="py-2">When</th>
                  <th className="py-2">Fee</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data?.consultations?.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="py-2">{row.patient.name}</td>
                    <td className="py-2">{row.doctor.name}</td>
                    <td className="py-2">
                      {row.slot_date} {row.start_time}
                    </td>
                    <td className="py-2">₹{row.fee}</td>
                    <td className="py-2 capitalize">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </section>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-[20px] border border-line bg-card p-5">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl text-ink">{value}</p>
    </div>
  )
}

function Panel({ title, children }) {
  return (
    <div className="rounded-[22px] border border-line bg-card p-5">
      <h2 className="mb-4 flex items-center gap-2 font-display text-2xl">
        <Icon name="evaluation" className="h-5 w-5 text-accent" />
        {title}
      </h2>
      {children}
    </div>
  )
}
