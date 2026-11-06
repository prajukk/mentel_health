import { useState } from "react"
import Header from "../components/Header.jsx"
import Icon from "../components/Icons.jsx"
import { clearHistory, readHistory } from "../history.js"

const LEVEL_COLOR = {
  low: "text-low",
  moderate: "text-moderate",
  high: "text-high",
}

function Trend({ entries }) {
  const points = [...entries].reverse()
  if (points.length < 2) return null
  const width = 640
  const height = 180
  const pad = 24
  const scores = points.map((entry) => entry.probability)
  const low = Math.max(0, Math.min(...scores) - 0.05)
  const high = Math.min(1, Math.max(...scores) + 0.05)
  const span = high - low || 1
  const coordinates = points.map((entry, index) => {
    const x = pad + (index / (points.length - 1)) * (width - pad * 2)
    const y = pad + ((high - entry.probability) / span) * (height - pad * 2)
    return { ...entry, x, y }
  })
  const path = coordinates.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Recent risk probabilities">
      <path d={path} fill="none" stroke="#0E6B67" strokeWidth="2.5" />
      {coordinates.map((point) => (
        <circle key={point.id} cx={point.x} cy={point.y} r="4" fill="#0E6B67" />
      ))}
    </svg>
  )
}

export default function History({ account, onHome, onEvaluation, onHistory, onSignOut }) {
  const [entries, setEntries] = useState(() => readHistory())
  const [confirmClear, setConfirmClear] = useState(false)

  function removeAll() {
    clearHistory()
    setEntries([])
    setConfirmClear(false)
  }

  return (
    <section className="page">
      <Header account={account} onHome={onHome} onEvaluation={onEvaluation} onHistory={onHistory} onSignOut={onSignOut} />
      <div className="mx-auto mt-12 max-w-5xl">
        <p className="text-sm text-muted">For this account</p>
        <h1 className="mt-2 flex items-center gap-3 font-display text-4xl">
          <Icon name="history" className="h-8 w-8 text-accent" />
          Check-in history
        </h1>
        <p className="mt-3 max-w-xl text-muted">
          Scores stay on this browser for the signed-in name. The journal text is not saved.
        </p>

        {entries.length > 1 && (
          <div className="mt-8 rounded-[20px] border border-line bg-card p-4">
            <Trend entries={entries} />
          </div>
        )}

        {entries.length === 0 ? (
          <p className="mt-10 text-muted">No check-ins yet.</p>
        ) : (
          <ul className="mt-8 space-y-3">
            {entries.map((entry) => (
              <li key={entry.id} className="rounded-[20px] border border-line bg-card px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className={`font-display text-3xl capitalize ${LEVEL_COLOR[entry.risk_level]}`}>
                    {entry.risk_level}
                  </p>
                  <p className="text-sm text-muted">{new Date(entry.at).toLocaleString()}</p>
                </div>
                <p className="mt-2">
                  {entry.score_kind === "behavior"
                    ? `Behavior ${entry.behavior_points} of 8`
                    : `Probability ${Number(entry.probability).toFixed(2)}`}
                </p>
                <p className="mt-1 text-sm text-muted">{entry.inputs_used.join(" and ") || "No inputs"}</p>
              </li>
            ))}
          </ul>
        )}

        {entries.length > 0 && (
          <div className="mt-8">
            {confirmClear ? (
              <button type="button" onClick={removeAll} className="rounded-full border border-line px-6 py-3">
                Clear these scores
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="text-sm text-muted"
              >
                Clear history
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
