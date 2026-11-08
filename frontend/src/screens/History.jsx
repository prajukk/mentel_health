import { useState } from "react"
import Header from "../components/Header.jsx"
import Icon from "../components/Icons.jsx"
import { clearHistory, downloadSummary, readHistory } from "../history.js"

const LEVEL_COLOR = {
  low: "text-low",
  moderate: "text-moderate",
  high: "text-high",
}

const LEVEL_BG = {
  low: "bg-low/10 text-low border-low/30",
  moderate: "bg-moderate/10 text-moderate border-moderate/30",
  high: "bg-high/10 text-high border-high/30",
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

export default function History({
  account,
  onHome,
  onEvaluation,
  onHistory,
  onProfile,
  onSignOut,
  onSelectResult,
  onNewCheckIn,
}) {
  const [entries, setEntries] = useState(() => readHistory())
  const [expandedId, setExpandedId] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)

  function toggleExpand(id) {
    setExpandedId((current) => (current === id ? null : id))
  }

  function removeAll() {
    clearHistory()
    setEntries([])
    setConfirmClear(false)
  }

  return (
    <section className="page">
      <Header
        currentView="history"
        account={account}
        onHome={onHome}
        onNewCheckIn={onNewCheckIn}
        onEvaluation={onEvaluation}
        onHistory={onHistory}
        onProfile={onProfile}
        onSignOut={onSignOut}
        historyCount={entries.length}
      />
      <div className="mx-auto mt-8 max-w-5xl">
        {/* Top Breadcrumb & Quick Actions */}
        <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted sm:text-sm">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onHome}
              className="flex items-center gap-1 text-accent transition-colors hover:underline"
            >
              <Icon name="home" className="h-3.5 w-3.5" />
              <span>Home</span>
            </button>
            <Icon name="chevronRight" className="h-3.5 w-3.5 text-muted/60" />
            <span className="text-ink font-medium">Check-In History</span>
          </div>

          <div className="flex items-center gap-2">
            {onNewCheckIn && (
              <button
                type="button"
                onClick={onNewCheckIn}
                className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5"
              >
                <Icon name="plus" className="h-3.5 w-3.5" />
                <span>Take new check-in</span>
              </button>
            )}
          </div>
        </nav>

        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Account: {account || "Local User"}</p>
            <h1 className="mt-2 flex items-center gap-3 font-display text-4xl">
              <Icon name="history" className="h-8 w-8 text-accent" />
              Check-in history
            </h1>
            <p className="mt-3 max-w-xl text-muted">
              Select any check-in below to view complete details, extracted cues, modality notes, or open it in the full dashboard.
            </p>
          </div>
          {entries.length > 0 && (
            <span className="rounded-full border border-line bg-card px-4 py-1 text-sm text-muted">
              {entries.length} {entries.length === 1 ? "check-in" : "check-ins"} saved
            </span>
          )}
        </div>

        {entries.length > 1 && (
          <div className="mt-8 rounded-[20px] border border-line bg-card p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Score Trajectory</p>
            <Trend entries={entries} />
          </div>
        )}

        {entries.length === 0 ? (
          <div className="mt-12 rounded-[20px] border border-line bg-card p-10 text-center">
            <p className="text-lg text-ink">No check-ins saved yet.</p>
            <p className="mt-2 text-sm text-muted">Complete your first check-in to track your wellness history here.</p>
            <button
              type="button"
              onClick={onNewCheckIn || onHome}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-transform hover:-translate-y-0.5"
            >
              <Icon name="plus" className="h-4 w-4" />
              Start a check-in
            </button>
          </div>
        ) : (
          <ul className="mt-8 space-y-4">
            {entries.map((entry) => {
              const isExpanded = expandedId === entry.id
              const daily = entry.daily_behavior || entry.fullResult?.daily_behavior
              const voice = entry.voice || entry.fullResult?.voice
              const image = entry.image || entry.fullResult?.image
              const explanation = entry.explanation || entry.fullResult?.explanation
              const cues = entry.cues?.length ? entry.cues : entry.fullResult?.cues || []
              const hasCrisis = entry.crisis_detected || entry.fullResult?.crisis_detected

              return (
                <li
                  key={entry.id}
                  className={`rounded-[20px] border transition-all ${
                    isExpanded ? "border-accent/40 bg-card shadow-md" : "border-line bg-card/80 hover:border-line/80"
                  }`}
                >
                  {/* Card Header */}
                  <div
                    onClick={() => toggleExpand(entry.id)}
                    className="flex cursor-pointer flex-wrap items-center justify-between gap-4 p-5 sm:p-6"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        toggleExpand(entry.id)
                      }
                    }}
                    aria-expanded={isExpanded}
                  >
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                      <span
                        className={`rounded-full border px-3 py-1 font-display text-lg font-semibold capitalize sm:text-xl ${
                          LEVEL_BG[entry.risk_level] || "bg-paper text-ink"
                        }`}
                      >
                        {entry.risk_level}
                      </span>
                      <div>
                        <p className="font-display text-lg text-ink">
                          {entry.score_kind === "behavior" && entry.behavior_points != null
                            ? `Behavior score: ${entry.behavior_points} of 8 signs`
                            : `Model probability: ${Number(entry.probability).toFixed(2)}`}
                        </p>
                        <p className="text-xs text-muted sm:text-sm">
                          {new Date(entry.at).toLocaleDateString(undefined, {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Modality Badges */}
                      <div className="hidden flex-wrap items-center gap-1.5 sm:flex">
                        {entry.inputs_used?.map((input) => (
                          <span
                            key={input}
                            className="rounded-full bg-paper px-2.5 py-0.5 text-xs font-medium capitalize text-muted"
                          >
                            {input}
                          </span>
                        ))}
                        {voice && (
                          <span className="rounded-full bg-paper px-2.5 py-0.5 text-xs font-medium text-muted">
                            Voice
                          </span>
                        )}
                        {image && (
                          <span className="rounded-full bg-paper px-2.5 py-0.5 text-xs font-medium text-muted">
                            Photo
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        className="rounded-full border border-line bg-paper px-3.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent"
                        aria-label={isExpanded ? "Collapse check-in details" : "Expand check-in details"}
                      >
                        {isExpanded ? "Hide details ▲" : "View complete details ▼"}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Complete Details Panel */}
                  {isExpanded && (
                    <div className="border-t border-line/60 bg-paper/30 p-5 sm:p-6">
                      {/* Crisis Warning if present */}
                      {hasCrisis && (
                        <div className="mb-5 rounded-[16px] border border-high/30 bg-[#FFF5F4] p-4 text-sm text-ink">
                          <p className="font-semibold text-high">Crisis Support Resources</p>
                          <p className="mt-1 text-muted">
                            This check-in triggered a crisis support alert. Helplines: Tele-MANAS (14416 / 1800-891-4416), 988 (US/Canada), 116 123 (UK).
                          </p>
                        </div>
                      )}

                      {/* AI / Model Summary Explanation */}
                      {explanation && (
                        <div className="mb-5 rounded-[16px] border border-line bg-card p-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Screening Summary</p>
                          <p className="mt-2 text-sm leading-relaxed text-ink italic">"{explanation}"</p>
                        </div>
                      )}

                      {/* Personalized Wellness Tip */}
                      {(entry.wellness_tip || entry.empathic_summary || entry.fullResult?.wellness_tip || entry.fullResult?.empathic_summary) && (
                        <div className="mb-5 rounded-[16px] border border-accent/30 bg-accent/5 p-4">
                          <div className="flex items-center gap-2">
                            <Icon name="sparkle" className="h-4 w-4 text-accent" />
                            <p className="text-xs font-semibold uppercase tracking-wider text-accent">Today's Wellness Tip</p>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-ink italic font-display">
                            "{entry.wellness_tip || entry.empathic_summary || entry.fullResult?.wellness_tip || entry.fullResult?.empathic_summary}"
                          </p>
                        </div>
                      )}

                      <div className="grid gap-4 sm:grid-cols-2">
                        {/* Daily Behavior Breakdown */}
                        {daily && (
                          <div className="rounded-[16px] border border-line bg-card p-4">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                              <Icon name="behavior" className="h-4 w-4 text-accent" />
                              Daily Behavior Signs ({daily.points} / {daily.out_of})
                            </h3>
                            {daily.answers && (
                              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                <div className="rounded-lg bg-paper p-2">
                                  <span className="text-muted block">Sleep</span>
                                  <span className="font-medium capitalize text-ink">{daily.answers.sleep || "N/A"}</span>
                                </div>
                                <div className="rounded-lg bg-paper p-2">
                                  <span className="text-muted block">Energy</span>
                                  <span className="font-medium capitalize text-ink">{daily.answers.energy || "N/A"}</span>
                                </div>
                                <div className="rounded-lg bg-paper p-2">
                                  <span className="text-muted block">People</span>
                                  <span className="font-medium capitalize text-ink">{daily.answers.company || "N/A"}</span>
                                </div>
                                <div className="rounded-lg bg-paper p-2">
                                  <span className="text-muted block">Routine</span>
                                  <span className="font-medium capitalize text-ink">{daily.answers.routine || "N/A"}</span>
                                </div>
                              </div>
                            )}
                            {daily.notes && daily.notes.length > 0 && (
                              <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-muted">
                                {daily.notes.map((note, idx) => (
                                  <li key={idx}>{note}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}

                        {/* Linguistic Cues */}
                        <div className="rounded-[16px] border border-line bg-card p-4">
                          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                            <Icon name="journal" className="h-4 w-4 text-accent" />
                            Linguistic Features & Cues
                          </h3>
                          {cues.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {cues.map((cue, idx) => (
                                <span
                                  key={idx}
                                  className="rounded-full bg-paper px-2.5 py-1 text-xs text-ink border border-line/60"
                                >
                                  {cue}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 text-xs text-muted">No specific linguistic cues were highlighted.</p>
                          )}
                          <p className="mt-3 text-xs text-muted">
                            Model score: {Number(entry.probability).toFixed(4)} ({entry.score_kind} model)
                          </p>
                        </div>

                        {/* Voice Acoustic Breakdown */}
                        {voice && (
                          <div className="rounded-[16px] border border-line bg-card p-4">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                              <Icon name="voice" className="h-4 w-4 text-accent" />
                              Voice Acoustic Features
                            </h3>
                            <div className="mt-3 space-y-1.5 text-xs text-muted">
                              <p>
                                Pitch mean: <span className="font-medium text-ink">{Math.round(voice.pitch_mean || 0)} Hz</span>
                              </p>
                              <p>
                                Silence / Pauses:{" "}
                                <span className="font-medium text-ink">
                                  {Math.round((voice.pause_ratio || 0) * 100)}% ({voice.pause_count || 0} pauses)
                                </span>
                              </p>
                              <p>
                                Speaking rate: <span className="font-medium text-ink">{Number(voice.speaking_rate || 0).toFixed(2)}</span>
                              </p>
                              {voice.transcript && (
                                <p className="mt-2 rounded-lg bg-paper p-2 text-ink">
                                  <span className="text-muted block text-[11px]">Transcript:</span>
                                  "{voice.transcript}"
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Photo Appearance */}
                        {image && (
                          <div className="rounded-[16px] border border-line bg-card p-4">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                              <Icon name="image" className="h-4 w-4 text-accent" />
                              Visual Appearance
                            </h3>
                            <div className="mt-3 space-y-1.5 text-xs text-muted">
                              <p>
                                Observed appearance:{" "}
                                <span className="font-medium capitalize text-ink">{image.appearance || "Unclear"}</span>
                              </p>
                              {image.appearance_note && (
                                <p className="text-ink">"{image.appearance_note}"</p>
                              )}
                              <p>
                                Brightness: <span className="font-medium text-ink">{Math.round((image.brightness || 0) * 100)}%</span> (
                                {image.width} × {image.height} px)
                              </p>
                              {image.writing && (
                                <p className="mt-2 rounded-lg bg-paper p-2 text-ink">
                                  <span className="text-muted block text-[11px]">Writing seen:</span>
                                  {image.writing}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Bar */}
                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {onSelectResult && (
                            <button
                              type="button"
                              onClick={() => onSelectResult(entry.fullResult || entry)}
                              className="rounded-full bg-accent px-4 py-2 text-xs font-medium text-white shadow-sm hover:opacity-95"
                            >
                              Open in full result dashboard
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => downloadSummary(entry.fullResult || entry, entry.at)}
                            className="rounded-full border border-line bg-card px-4 py-2 text-xs font-medium text-ink hover:bg-paper"
                          >
                            Download report (.txt)
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleExpand(entry.id)}
                          className="text-xs text-muted hover:text-ink"
                        >
                          Close details
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {entries.length > 0 && (
          <div className="mt-8 flex justify-end">
            {confirmClear ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-high">Are you sure? This deletes saved history on this browser.</span>
                <button
                  type="button"
                  onClick={removeAll}
                  className="rounded-full bg-high px-4 py-2 text-xs font-medium text-white"
                >
                  Yes, clear all
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="rounded-full border border-line px-3 py-2 text-xs text-muted"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="text-xs text-muted hover:text-high"
              >
                Clear all history
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
