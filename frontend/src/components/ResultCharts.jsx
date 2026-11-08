function bandColor(share) {
  if (share > 0.7) return "#8C3A2F"
  if (share >= 0.4) return "#A56B1E"
  return "#2F6F4E"
}

function polar(cx, cy, radius, angle) {
  return [cx + radius * Math.cos(angle), cy - radius * Math.sin(angle)]
}

function arcPath(cx, cy, radius, start, end) {
  const [x0, y0] = polar(cx, cy, radius, start)
  const [x1, y1] = polar(cx, cy, radius, end)
  const large = start - end > Math.PI ? 1 : 0
  return `M ${x0} ${y0} A ${radius} ${radius} 0 ${large} 0 ${x1} ${y1}`
}

export function FeelGauge({ value, label }) {
  const share = Math.min(1, Math.max(0, Number(value) || 0))
  const percent = Math.round(share * 100)
  const cx = 160
  const cy = 145
  const radius = 105

  // 3 calibrated risk bands
  const bands = [
    { start: Math.PI, end: Math.PI * 0.6, color: "#2F6F4E", name: "Low (<40%)" },
    { start: Math.PI * 0.6, end: Math.PI * 0.3, color: "#A56B1E", name: "Moderate (40-70%)" },
    { start: Math.PI * 0.3, end: 0, color: "#8C3A2F", name: "High (>70%)" },
  ]

  // Tick marks at 0%, 20%, 40%, 60%, 80%, 100%
  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1.0].map((t) => {
    const angle = Math.PI * (1 - t)
    const [x1, y1] = polar(cx, cy, radius - 16, angle)
    const [x2, y2] = polar(cx, cy, radius + 4, angle)
    const [lx, ly] = polar(cx, cy, radius + 17, angle)
    return { t, x1, y1, x2, y2, lx, ly, label: `${Math.round(t * 100)}%` }
  })

  const [needleX, needleY] = polar(cx, cy, radius - 15, Math.PI * (1 - share))
  const tone = share > 0.7 ? "text-high" : share >= 0.4 ? "text-moderate" : "text-low"
  const toneBg = share > 0.7 ? "bg-high/10 text-high border-high/30" : share >= 0.4 ? "bg-moderate/10 text-moderate border-moderate/30" : "bg-low/10 text-low border-low/30"

  return (
    <div>
      <div className="relative">
        <svg viewBox="0 0 320 185" className="w-full" role="img" aria-label={`The day feels ${label}, ${percent}% risk index`}>
          {/* Gauge background bands */}
          {bands.map((band) => (
            <path
              key={band.color}
              d={arcPath(cx, cy, radius, band.start, band.end)}
              fill="none"
              stroke={band.color}
              strokeWidth="18"
              strokeLinecap="butt"
            />
          ))}

          {/* Tick lines */}
          {ticks.map((tick) => (
            <g key={tick.t}>
              <line
                x1={tick.x1}
                y1={tick.y1}
                x2={tick.x2}
                y2={tick.y2}
                stroke="#FFFDF8"
                strokeWidth="2"
              />
              <text
                x={tick.lx}
                y={tick.ly + 3}
                textAnchor="middle"
                fontSize="10"
                fill="#6B625A"
                fontWeight="500"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* Needle with drop shadow */}
          <line
            x1={cx}
            y1={cy}
            x2={needleX}
            y2={needleY}
            stroke="#1F1A17"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r="7" fill="#1F1A17" />
          <circle cx={cx} cy={cy} r="3" fill="#FFFDF8" />
        </svg>

        {/* Center Score Indicator */}
        <div className="mt-1 flex flex-col items-center justify-center">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-display text-sm font-semibold capitalize ${toneBg}`}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: bandColor(share) }} />
            {label} Risk · {percent}% Index
          </span>
        </div>
      </div>

      {/* Threshold Guide */}
      <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-xl border border-line bg-paper/50 p-2 text-center text-[11px]">
        <div className="rounded-lg bg-card p-1.5">
          <span className="block font-semibold text-low">0 – 39%</span>
          <span className="text-muted">Steady / Low</span>
        </div>
        <div className="rounded-lg bg-card p-1.5">
          <span className="block font-semibold text-moderate">40 – 69%</span>
          <span className="text-muted">Moderate</span>
        </div>
        <div className="rounded-lg bg-card p-1.5">
          <span className="block font-semibold text-high">70 – 100%</span>
          <span className="text-muted">Elevated</span>
        </div>
      </div>

      <p className="mt-3 text-center text-xs leading-relaxed text-muted">
        This needle maps your combined inputs onto an objective screening spectrum. A score below 40% reflects steady functioning.
      </p>
    </div>
  )
}

export function DayShape({ parts }) {
  const cx = 200
  const cy = 160
  const radius = 75
  const angle = (index) => -Math.PI / 2 + (index * 2 * Math.PI) / parts.length
  const at = (index, amount) => {
    const reach = (Math.min(2, Math.max(0, amount)) / 2) * radius
    return polar(cx, cy, reach, angle(index))
  }

  // Calculate overall day steadiness
  const totalPoints = parts.reduce((acc, p) => acc + (p.steadiness || 0), 0)
  const maxPoints = parts.length * 2
  const steadinessPercent = Math.round((totalPoints / (maxPoints || 1)) * 100)

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-muted">Day Rhythm Radar</span>
        <span className="rounded-full bg-paper px-2.5 py-0.5 font-medium text-ink border border-line">
          {steadinessPercent}% Steadiness
        </span>
      </div>

      <svg
        viewBox="0 0 400 320"
        className="mx-auto w-full max-w-sm"
        role="img"
        aria-label={parts.map((part) => `${part.label}: ${part.detail}`).join(". ")}
      >
        {/* Background Grid Concentric Polygons */}
        {[0.5, 1, 1.5, 2].map((ring) => (
          <polygon
            key={ring}
            points={parts.map((_, index) => at(index, ring).join(",")).join(" ")}
            fill={ring === 2 ? "#FFFDF8" : "none"}
            stroke="#E6DCCB"
            strokeWidth={ring === 1 || ring === 2 ? "1.5" : "1"}
            strokeDasharray={ring % 1 !== 0 ? "3,3" : undefined}
          />
        ))}

        {/* Axis Spokes */}
        {parts.map((part, index) => {
          const [x, y] = at(index, 2)
          return <line key={part.label} x1={cx} y1={cy} x2={x} y2={y} stroke="#E6DCCB" strokeWidth="1.2" />
        })}

        {/* Data Shape */}
        <polygon
          points={parts.map((part, index) => at(index, part.steadiness).join(",")).join(" ")}
          fill="#0E6B67"
          fillOpacity="0.22"
          stroke="#0E6B67"
          strokeWidth="2.5"
        />

        {/* Data Vertices */}
        {parts.map((part, index) => {
          const [x, y] = at(index, part.steadiness)
          return <circle key={`${part.label}-dot`} cx={x} cy={y} r="5" fill="#0E6B67" stroke="#FFFDF8" strokeWidth="2" />
        })}

        {/* Outer Axis Labels */}
        {parts.map((part, index) => {
          const [x, y] = polar(cx, cy, radius + 30, angle(index))
          const anchor = x < cx - 10 ? "end" : x > cx + 10 ? "start" : "middle"
          const shift = y < cy - 10 ? -4 : y > cy + 10 ? 8 : 4
          return (
            <text key={`${part.label}-name`} x={x} y={y + shift} textAnchor={anchor} fill="#1F1A17" fontSize="13" fontWeight="600">
              <tspan x={x}>{part.label}</tspan>
              <tspan x={x} dy="14" fill="#6B625A" fontSize="11" fontWeight="400">
                {part.detail}
              </tspan>
            </text>
          )
        })}
      </svg>

      {/* Habit Breakdown Badges */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
        {parts.map((part) => (
          <div key={part.label} className="rounded-xl border border-line bg-paper/60 p-2.5">
            <span className="block text-[11px] font-semibold uppercase text-muted">{part.label}</span>
            <span className="mt-0.5 block font-medium text-ink truncate">{part.detail}</span>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-line overflow-hidden">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${(part.steadiness / 2) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-center text-xs leading-relaxed text-muted">
        The radar stretches outward toward the perimeter (Level 2) where your habits were steady, and contracts inward (Level 0) where disruption occurred.
      </p>
    </div>
  )
}

export function ChangeChart({ before, now }) {
  const bars = [
    { name: "Previous Check-in", ...before },
    { name: "Current Check-in", ...now },
  ]

  const shareBefore = Math.min(1, Math.max(0, before.share || 0))
  const shareNow = Math.min(1, Math.max(0, now.share || 0))
  const delta = Math.round((shareNow - shareBefore) * 100)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <span className="text-xs text-muted">Longitudinal Progress</span>
        {delta !== 0 ? (
          <span
            className={`rounded-full px-3 py-0.5 text-xs font-semibold border ${delta < 0
                ? "bg-low/10 text-low border-low/30"
                : "bg-moderate/10 text-moderate border-moderate/30"
              }`}
          >
            {delta < 0 ? `↓ ${Math.abs(delta)}% Improved (Lighter)` : `↑ +${delta}% Increased Risk`}
          </span>
        ) : (
          <span className="rounded-full bg-paper px-3 py-0.5 text-xs text-muted border border-line">
            Steady (No change)
          </span>
        )}
      </div>

      <div className="mx-auto grid max-w-md grid-cols-[4.5rem_1fr_1fr] items-end gap-5" role="img" aria-label={`Previous ${before.detail}, current ${now.detail}`}>
        <div>
          <div className="flex h-44 flex-col justify-between text-xs text-muted">
            <span className="font-semibold text-high">Heavier (100%)</span>
            <span className="font-semibold text-moderate">Mid (50%)</span>
            <span className="font-semibold text-low">Lighter (0%)</span>
          </div>
          <div className="h-14" aria-hidden="true" />
        </div>

        {bars.map((bar) => {
          const share = Math.min(1, Math.max(0, bar.share))
          const percent = Math.round(share * 100)
          return (
            <div key={bar.name} className="flex flex-col items-center">
              <div className="flex h-44 w-full items-end justify-center">
                <div className="relative flex flex-col items-center w-20">
                  <span className="mb-1 text-xs font-bold text-ink">
                    {percent}%
                  </span>
                  <div
                    className="w-full rounded-t-[18px] transition-all duration-500 shadow-xs"
                    style={{
                      height: `${Math.max(share * 140, 16)}px`,
                      background: bandColor(share),
                    }}
                  />
                </div>
              </div>
              <p className="mt-3 text-xs font-semibold text-ink">{bar.name}</p>
              <span className="capitalize text-xs font-medium text-muted">{bar.level}</span>
              <p className="text-[11px] text-muted">{bar.detail}</p>
            </div>
          )
        })}
      </div>

      <p className="mt-4 text-center text-xs leading-relaxed text-muted">
        Direct side-by-side comparison illustrating changes between your last recorded check-in and today.
      </p>
    </div>
  )
}
