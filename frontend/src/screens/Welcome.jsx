import Header from "../components/Header.jsx"
import Icon from "../components/Icons.jsx"

const STEPS = [
  ["journal", "Journal", "The words you write or speak."],
  ["behavior", "Behavior", "Sleep, energy, people, and routine."],
  ["voice", "Voice", "How the recording sounds."],
  ["image", "Image", "How the photo looks."],
]

export default function Welcome({ account, onStart, onHome, onHistory, onEvaluation, onSignOut, lastCheckIn }) {
  return (
    <section className="page">
      <Header account={account} onHome={onHome} onHistory={onHistory} onEvaluation={onEvaluation} onSignOut={onSignOut} />
      <div className="mx-auto mt-16 grid max-w-5xl items-end gap-10 lg:grid-cols-[1.25fr_0.75fr] lg:gap-16">
        <div>
          <p className="eyebrow">Early screening</p>
          <h1 className="mt-5 max-w-xl font-display text-6xl leading-[0.96] text-ink sm:text-7xl">
            Mental health risk check
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
            This is an early flag, not a diagnosis. Take it when you want a clear picture of the day.
          </p>
          <button type="button" onClick={onStart} className="mt-10 rounded-full bg-accent px-8 py-4 text-base text-white">
            Start check-in
          </button>
        </div>
        <aside className="rounded-[28px] border border-line bg-card p-7 sm:p-8">
          <p className="eyebrow">What is included</p>
          <ol className="mt-6 space-y-5">
            {STEPS.map(([icon, title, detail]) => (
              <li key={title} className="grid grid-cols-[2.5rem_1fr] items-start gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-paper text-accent">
                  <Icon name={icon} className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-ink">{title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted">{detail}</span>
                </span>
              </li>
            ))}
          </ol>
          {lastCheckIn && (
            <button type="button" onClick={onHistory} className="mt-8 block text-left text-sm text-muted">
              Last check-in: <span className="capitalize text-ink">{lastCheckIn.risk_level}</span>
            </button>
          )}
        </aside>
      </div>
    </section>
  )
}