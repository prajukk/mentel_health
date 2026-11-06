import { useEffect, useState } from "react"
import { loadMetrics } from "../api.js"
import Header from "../components/Header.jsx"
import Icon from "../components/Icons.jsx"

const FEATURES = [
  ["text", "Writing"],
  ["behavior", "Behavior"],
  ["both", "Both"],
]
const MODELS = [
  ["logistic_regression", "Logistic regression", "#0E6B67"],
  ["linear_svm", "Linear SVM", "#A56B1E"],
  ["random_forest", "Random forest", "#2F6F4E"],
]
const SAVED_MODEL = {
  text: "random_forest",
  behavior: "linear_svm",
  both: "random_forest",
}

const CONDITION_LABELS = {
  full: "Full text and behavior",
  text_missing: "Text missing",
  behavior_missing: "Behavior missing",
  behavior_hidden_0: "Behavior fields hidden 0%",
  behavior_hidden_10: "Behavior fields hidden 10%",
  behavior_hidden_30: "Behavior fields hidden 30%",
  behavior_hidden_50: "Behavior fields hidden 50%",
}

function modelLabel(model) {
  return MODELS.find(([key]) => key === model)?.[1] ?? model.replaceAll("_", " ")
}

function GroupedBars({ rows }) {
  const width = 640
  const height = 320
  const pad = { left: 44, right: 16, top: 28, bottom: 36 }
  const innerWidth = width - pad.left - pad.right
  const innerHeight = height - pad.top - pad.bottom
  const groupWidth = innerWidth / FEATURES.length

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Test F1 for writing, behavior, and both. The outlined bar is the saved model.">
      <text x={pad.left} y="16" fontSize="12" fill="#6B625A">
        Test F1
      </text>
      {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
        const y = pad.top + innerHeight - tick * innerHeight
        return (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#E6DCCB" />
            <text x={pad.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#6B625A">
              {tick.toFixed(2)}
            </text>
          </g>
        )
      })}
      {FEATURES.map(([feature], groupIndex) =>
        MODELS.map(([model, , color], modelIndex) => {
          const row = rows.find((item) => item.features === feature && item.model === model)
          const value = Number(row?.f1 ?? 0)
          const saved = SAVED_MODEL[feature] === model
          const barWidth = 28
          const x = pad.left + groupIndex * groupWidth + groupWidth / 2 + (modelIndex - 1) * (barWidth + 8) - barWidth / 2
          const barHeight = Math.max(value * innerHeight, 0)
          const y = pad.top + innerHeight - barHeight
          return (
            <g key={`${feature}-${model}`}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={color}
                stroke={saved ? "#1F1A17" : "none"}
                strokeWidth={saved ? 2 : 0}
                rx="6"
              />
              <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fontSize="11" fill="#1F1A17">
                {value.toFixed(3)}
              </text>
            </g>
          )
        }),
      )}
      {FEATURES.map(([feature, label], groupIndex) => (
        <text
          key={feature}
          x={pad.left + groupIndex * groupWidth + groupWidth / 2}
          y={height - 12}
          textAnchor="middle"
          fontSize="14"
          fill="#1F1A17"
        >
          {label}
        </text>
      ))}
    </svg>
  )
}

function MissingLine({ rows }) {
  const points = [0, 10, 30, 50].map((rate) => {
    const row = rows.find((item) => item.condition === `behavior_hidden_${rate}`)
    return { rate, f1: row?.f1 ?? 0 }
  })
  const width = 640
  const height = 280
  const pad = { left: 48, right: 16, top: 36, bottom: 48 }
  const innerWidth = width - pad.left - pad.right
  const innerHeight = height - pad.top - pad.bottom
  const scores = points.map((point) => point.f1)
  const low = Math.min(...scores) - 0.01
  const high = Math.max(...scores) + 0.01
  const coordinates = points.map((point) => {
    const x = pad.left + (point.rate / 50) * innerWidth
    const y = pad.top + ((high - point.f1) / (high - low)) * innerHeight
    return { ...point, x, y }
  })
  const path = coordinates.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Test F1 as more behavior fields are hidden">
      <text x={pad.left} y="14" fontSize="12" fill="#6B625A">
        Test F1
      </text>
      <line x1={pad.left} x2={pad.left} y1={pad.top} y2={height - pad.bottom} stroke="#E6DCCB" />
      <line x1={pad.left} x2={width - pad.right} y1={height - pad.bottom} y2={height - pad.bottom} stroke="#E6DCCB" />
      <path d={path} fill="none" stroke="#0E6B67" strokeWidth="2.5" />
      {coordinates.map((point) => (
        <g key={point.rate}>
          <circle cx={point.x} cy={point.y} r="4" fill="#0E6B67" />
          <text x={point.x} y={point.y - 10} textAnchor="middle" fontSize="12" fill="#1F1A17">
            {point.f1.toFixed(3)}
          </text>
          <text x={point.x} y={height - 22} textAnchor="middle" fontSize="12" fill="#6B625A">
            {point.rate}% hidden
          </text>
        </g>
      ))}
    </svg>
  )
}

export default function Evaluation({ account, onHome, onHistory, onEvaluation, onSignOut }) {
  const [metrics, setMetrics] = useState(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    loadMetrics()
      .then((payload) => {
        if (active) setMetrics(payload)
      })
      .catch((reason) => {
        if (active) setError(reason.message)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <section className="page">
      <Header account={account} onHome={onHome} onHistory={onHistory} onEvaluation={onEvaluation} onSignOut={onSignOut} />
      <div className="mx-auto mt-12 max-w-5xl space-y-12">
        <div>
          <p className="text-sm text-muted">Experiment 1</p>
          <h1 className="mt-2 flex items-center gap-3 font-display text-4xl">
            <Icon name="evaluation" className="h-8 w-8 text-accent" />
            F1 for text, behavior, and both
          </h1>
          <p className="mt-3 max-w-2xl text-muted">
            Each bar is the test F1. The outlined bar is the saved model: random forest for writing
            (0.776) and for both (0.778), and a linear SVM for behavior (0.679).
          </p>
          {metrics && (
            <div className="mt-6 rounded-[20px] border border-line bg-card p-5">
              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
                {MODELS.map(([key, label, color]) => (
                  <li key={key} className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ background: color }} />
                    {label}
                  </li>
                ))}
                <li className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full border-2 border-ink" />
                  Saved model
                </li>
              </ul>
              <GroupedBars rows={metrics.experiment1} />
            </div>
          )}
        </div>

        <div>
          <p className="text-sm text-muted">Experiment 2</p>
          <h2 className="mt-2 font-display text-3xl">Missing-data conditions</h2>
          <p className="mt-3 max-w-2xl text-muted">
            These rows remove a whole input, or hide some behavior fields and fill them with the training
            median plus a missing flag. The F1 drop is measured from the full score of 0.778. Removing the
            journal costs about 0.099. Removing routine costs about 0.001.
          </p>
          {metrics && (
            <div className="mt-6 overflow-x-auto rounded-[20px] border border-line bg-card">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Condition</th>
                    <th className="px-4 py-3 font-medium">Model</th>
                    <th className="px-4 py-3 font-medium">Accuracy</th>
                    <th className="px-4 py-3 font-medium">F1</th>
                    <th className="px-4 py-3 font-medium">ROC-AUC</th>
                    <th className="px-4 py-3 font-medium">F1 drop</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.experiment2.map((row) => (
                    <tr key={row.condition} className="border-t border-line">
                      <td className="px-4 py-3">{CONDITION_LABELS[row.condition] ?? row.condition}</td>
                      <td className="px-4 py-3">{modelLabel(row.model)}</td>
                      <td className="px-4 py-3">{Number(row.accuracy).toFixed(3)}</td>
                      <td className="px-4 py-3">{Number(row.f1).toFixed(3)}</td>
                      <td className="px-4 py-3">{Number(row.roc_auc).toFixed(3)}</td>
                      <td className="px-4 py-3">{Number(row.f1_drop).toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <p className="text-sm text-muted">Experiment 3</p>
          <h2 className="mt-2 font-display text-3xl">F1 as behavior fields go missing</h2>
          <p className="mt-3 max-w-2xl text-muted">
            This line uses only the 0%, 10%, 30%, and 50% hidden-field rows. It is separate from Experiment 2:
            the journal is still present. The largest drop on this line is about 0.004, from 0.775 to 0.770.
          </p>
          {metrics && (
            <div className="mt-6 rounded-[20px] border border-line bg-card p-4">
              <MissingLine rows={metrics.experiment2} />
            </div>
          )}
        </div>
        {!metrics && !error && <p className="text-muted">Loading evaluation results.</p>}
        {error && <p className="text-high">{error}</p>}
      </div>
    </section>
  )
}
