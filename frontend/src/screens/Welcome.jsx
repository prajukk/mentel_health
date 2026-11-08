import Header from "../components/Header.jsx"
import Icon from "../components/Icons.jsx"

const STEPS = [
  ["journal", "1. Journal", "Write or speak your thoughts freely."],
  ["behavior", "2. Daily Behavior", "Answer 4 questions on sleep, energy, company, and routine."],
  ["voice", "3. Voice (Optional)", "Record or upload audio to analyze pitch and pauses."],
  ["image", "4. Photo (Optional)", "Upload a photo to assess emotional expression via Gemini."],
]

export default function Welcome({
  account,
  onStart,
  onHome,
  onHistory,
  onEvaluation,
  onSignOut,
  lastCheckIn,
  historyCount = 0,
}) {
  return (
    <section className="page">
      <Header
        currentView="welcome"
        account={account}
        onHome={onHome}
        onNewCheckIn={onStart}
        onHistory={onHistory}
        onEvaluation={onEvaluation}
        onSignOut={onSignOut}
        historyCount={historyCount}
      />

      <div className="mx-auto mt-12 max-w-5xl">
        {/* Hero Section */}
        <div className="grid items-center gap-10 lg:grid-cols-[1.25fr_0.75fr] lg:gap-14">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/5 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              Multimodal Early Screening
            </div>

            <h1 className="mt-4 max-w-xl font-display text-5xl leading-[1.02] text-ink sm:text-6xl">
              Understand how today is feeling
            </h1>

            <p className="mt-5 max-w-lg text-base sm:text-lg leading-relaxed text-muted">
              A private, multimodal mental wellness check-in powered by machine learning and acoustic analysis.
              Early risk indicators, not a clinical diagnosis.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={onStart}
                className="flex items-center gap-2.5 rounded-full bg-accent px-8 py-4 text-base font-medium text-white shadow-lg transition-transform hover:-translate-y-0.5"
              >
                <Icon name="plus" className="h-5 w-5" />
                Start check-in
              </button>

              <button
                type="button"
                onClick={onHistory}
                className="flex items-center gap-2 rounded-full border border-line bg-card px-6 py-4 text-base font-medium text-ink transition-colors hover:bg-paper"
              >
                <Icon name="history" className="h-5 w-5 text-accent" />
                View history {historyCount > 0 && `(${historyCount})`}
              </button>
            </div>
          </div>

          {/* Quick Steps Overview Card */}
          <aside className="rounded-[28px] border border-line bg-card p-6 sm:p-7 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Check-in Process</p>
              <span className="text-xs text-muted">~2-3 minutes</span>
            </div>

            <ol className="mt-5 space-y-4">
              {STEPS.map(([icon, title, detail]) => (
                <li key={title} className="grid grid-cols-[2.5rem_1fr] items-start gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-paper text-accent shadow-xs">
                    <Icon name={icon} className="h-4 w-4" />
                  </span>
                  <div>
                    <span className="block text-sm font-semibold text-ink">{title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">{detail}</span>
                  </div>
                </li>
              ))}
            </ol>

            {lastCheckIn && (
              <div className="mt-6 border-t border-line/60 pt-4">
                <button
                  type="button"
                  onClick={onHistory}
                  className="group flex w-full items-center justify-between text-left"
                >
                  <div>
                    <span className="block text-xs text-muted">Previous check-in</span>
                    <span className="mt-0.5 font-display text-sm font-semibold capitalize text-ink">
                      {lastCheckIn.risk_level} risk
                      <span className="ml-1 text-xs font-normal text-muted">
                        ({new Date(lastCheckIn.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })})
                      </span>
                    </span>
                  </div>
                  <span className="text-xs font-medium text-accent group-hover:underline">View details →</span>
                </button>
              </div>
            )}
          </aside>
        </div>

        {/* Navigation Shortcut Cards */}
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Card 1: New Check-in */}
          <div
            onClick={onStart}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onStart()
              }
            }}
            className="group cursor-pointer rounded-[24px] border border-line bg-card p-6 transition-all hover:border-accent/40 hover:shadow-md"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-white">
              <Icon name="plus" className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-display text-xl font-semibold text-ink">Take New Check-In</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Step through journal writing, behavior questions, voice recording, and optional photo.
            </p>
            <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-accent">
              <span>Begin check-in</span>
              <Icon name="chevronRight" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </div>

          {/* Card 2: History */}
          <div
            onClick={onHistory}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onHistory()
              }
            }}
            className="group cursor-pointer rounded-[24px] border border-line bg-card p-6 transition-all hover:border-accent/40 hover:shadow-md"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-white">
              <Icon name="history" className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-display text-xl font-semibold text-ink">Check-In History</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {historyCount > 0
                ? `Review your past ${historyCount} check-in ${historyCount === 1 ? "record" : "records"}, scores, and detailed notes.`
                : "View past submissions, compare trajectory over time, and inspect complete modality breakdowns."}
            </p>
            <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-accent">
              <span>Open history</span>
              <Icon name="chevronRight" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </div>

          {/* Card 3: Evaluation */}
          <div
            onClick={onEvaluation}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onEvaluation()
              }
            }}
            className="group cursor-pointer rounded-[24px] border border-line bg-card p-6 transition-all hover:border-accent/40 hover:shadow-md sm:col-span-2 lg:col-span-1"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-white">
              <Icon name="evaluation" className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-display text-xl font-semibold text-ink">Model Evaluation</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Inspect ML benchmark metrics across Random Forest, Linear SVM, and missing-data robustness tests.
            </p>
            <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-accent">
              <span>View benchmarks</span>
              <Icon name="chevronRight" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
