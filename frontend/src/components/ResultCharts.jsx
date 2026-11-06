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
  const cx = 160
  const cy = 148
  const radius = 108
  const bands = [
    { start: Math.PI, end: Math.PI * 0.6, color: "#2F6F4E" },
    { start: Math.PI * 0.6, end: Math.PI * 0.3, color: "#A56B1E" },
    { start: Math.PI * 0.3, end: 0, color: "#8C3A2F" },
  ]
  const [needleX, needleY] = polar(cx, cy, radius - 18, Math.PI * (1 - share))
  const tone = share > 0.7 ? "text-high" : share >= 0.4 ? "text-moderate" : "text-low"

  return (
    <div>
      <svg viewBox="0 0 320 188" className="w-full" role="img" aria-label={`The day feels ${label}`}>
        {bands.map((band) => (
          <path
            key={band.color}
            d={arcPath(cx, cy, radius, band.start, band.end)}
            fill="none"
            stroke={band.color}
            strokeWidth="16"
            strokeLinecap="butt"
          />
        ))}
        <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="#1F1A17" strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="6" fill="#1F1A17" />
        <text x="36" y="176" fill="#6B625A" fontSize="13">
          Lighter
        </text>
        <text x="284" y="176" textAnchor="end" fill="#6B625A" fontSize="13">
          Heavier
        </text>
      </svg>
      <p className={`text-center font-display text-4xl capitalize ${tone}`}>{label}</p>
      <p className="mt-2 text-center text-sm leading-relaxed text-muted">
        The needle shows how heavy this check-in feels.
      </p>
    </div>
  )
}

export function DayShape({ parts }) {
  const cx = 210
  const cy = 188
  const radius = 78
  const angle = (index) => -Math.PI / 2 + (index * 2 * Math.PI) / parts.length
  const at = (index, amount) => {
    const reach = (Math.min(2, Math.max(0, amount)) / 2) * radius
    return polar(cx, cy, reach, angle(index))
  }

  return (
    <div>
      <svg
        viewBox="0 0 420 376"
        className="mx-auto w-full max-w-md"
        role="img"
        aria-label={parts.map((part) => `${part.label}, ${part.detail}`).join(". ")}
      >
        {[1, 2].map((ring) => (
          <polygon
            key={ring}
            points={parts.map((_, index) => at(index, ring).join(",")).join(" ")}
            fill="none"
            stroke="#E6DCCB"
            strokeWidth="1.5"
          />
        ))}
        {parts.map((part, index) => {
          const [x, y] = at(index, 2)
          return <line key={part.label} x1={cx} y1={cy} x2={x} y2={y} stroke="#E6DCCB" />
        })}
        <polygon
          points={parts.map((part, index) => at(index, part.steadiness).join(",")).join(" ")}
          fill="#0E6B67"
          fillOpacity="0.2"
          stroke="#0E6B67"
          strokeWidth="2.5"
        />
        {parts.map((part, index) => {
          const [x, y] = at(index, part.steadiness)
          return <circle key={`${part.label}-dot`} cx={x} cy={y} r="5" fill="#0E6B67" />
        })}
        {parts.map((part, index) => {
          const [x, y] = polar(cx, cy, radius + 36, angle(index))
          const anchor = x < cx - 12 ? "end" : x > cx + 12 ? "start" : "middle"
          const shift = y < cy - 12 ? -6 : y > cy + 12 ? 8 : 4
          return (
            <text key={`${part.label}-name`} x={x} y={y + shift} textAnchor={anchor} fill="#1F1A17" fontSize="15">
              <tspan x={x}>{part.label}</tspan>
              <tspan x={x} dy="16" fill="#6B625A" fontSize="12">
                {part.detail}
              </tspan>
            </text>
          )
        })}
      </svg>
      <p className="text-center text-sm leading-relaxed text-muted">
        The shape reaches out where the day felt steadier, and pulls in where it felt harder.
      </p>
    </div>
  )
}

export function ChangeChart({ before, now }) {
  const bars = [
    { name: "Last time", ...before },
    { name: "This time", ...now },
  ]

  return (
    <div className="mx-auto grid max-w-md grid-cols-[4.5rem_1fr_1fr] items-end gap-4" role="img" aria-label={`Last time ${before.detail}, this time ${now.detail}`}>
      <div>
        <div className="flex h-44 flex-col justify-between text-xs text-muted">
          <span>Heavier</span>
          <span>Middle</span>
          <span>Lighter</span>
        </div>
        <div className="h-16" aria-hidden="true" />
      </div>
      {bars.map((bar) => {
        const share = Math.min(1, Math.max(0, bar.share))
        return (
          <div key={bar.name} className="flex flex-col items-center">
            <div className="flex h-44 w-full items-end justify-center">
              <div
                className="w-16 rounded-t-[16px]"
                style={{ height: `${Math.max(share * 100, 8)}%`, background: bandColor(share) }}
              />
            </div>
            <p className="mt-3 text-sm text-muted">{bar.name}</p>
            <p className="capitalize">{bar.level}</p>
            <p className="text-sm text-muted">{bar.detail}</p>
          </div>
        )
      })}
    </div>
  )
}
