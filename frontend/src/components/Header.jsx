import Icon from "./Icons.jsx"

export default function Header({
  currentView = "welcome",
  account,
  onHome,
  onNewCheckIn,
  onHistory,
  onEvaluation,
  onProfile,
  onSignOut,
  historyCount = 0,
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card/90 px-3 py-2.5 shadow-[0_18px_40px_-32px_rgba(31,26,23,0.65)] backdrop-blur-md sm:rounded-full sm:px-5 sm:py-2">
      {/* Brand / Logo */}
      <button
        type="button"
        onClick={onHome}
        title="Return to Home"
        className="group flex items-center gap-3 pl-1 text-left transition-opacity hover:opacity-90"
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-accent font-display text-lg text-white shadow-sm transition-transform group-hover:scale-105">
          R
        </span>
        <span>
          <span className="block font-display text-base font-semibold leading-none text-ink sm:text-lg">
            Risk check
          </span>
          <span className="mt-1 block text-[10px] font-semibold tracking-[0.18em] text-muted uppercase">
            Mental Health Screening
          </span>
        </span>
      </button>

      {/* Main Navigation Links */}
      <nav aria-label="Main Navigation" className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onHome}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium sm:text-sm transition-all ${
            currentView === "welcome"
              ? "bg-accent text-white shadow-sm"
              : "text-muted hover:bg-paper hover:text-ink"
          }`}
          aria-current={currentView === "welcome" ? "page" : undefined}
        >
          <Icon name="home" className="h-4 w-4" />
          <span>Home</span>
        </button>

        {onNewCheckIn && (
          <button
            type="button"
            onClick={onNewCheckIn}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium sm:text-sm transition-all ${
              currentView === "checkin"
                ? "bg-accent text-white shadow-sm"
                : "border border-accent/40 bg-accent/10 text-accent hover:bg-accent/20"
            }`}
            aria-current={currentView === "checkin" ? "page" : undefined}
          >
            <Icon name="plus" className="h-3.5 w-3.5" />
            <span>New check-in</span>
          </button>
        )}

        <button
          type="button"
          onClick={onHistory}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium sm:text-sm transition-all ${
            currentView === "history"
              ? "bg-accent text-white shadow-sm"
              : "text-muted hover:bg-paper hover:text-ink"
          }`}
          aria-current={currentView === "history" ? "page" : undefined}
        >
          <Icon name="history" className="h-4 w-4" />
          <span>History</span>
          {historyCount > 0 && (
            <span
              className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                currentView === "history"
                  ? "bg-white/25 text-white"
                  : "bg-paper text-muted border border-line"
              }`}
            >
              {historyCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onEvaluation}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium sm:text-sm transition-all ${
            currentView === "evaluation"
              ? "bg-accent text-white shadow-sm"
              : "text-muted hover:bg-paper hover:text-ink"
          }`}
          aria-current={currentView === "evaluation" ? "page" : undefined}
        >
          <Icon name="evaluation" className="h-4 w-4" />
          <span>Evaluation</span>
        </button>

        {onProfile && (
          <button
            type="button"
            onClick={onProfile}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium sm:text-sm transition-all ${
              currentView === "profile"
                ? "bg-accent text-white shadow-sm"
                : "text-muted hover:bg-paper hover:text-ink"
            }`}
            aria-current={currentView === "profile" ? "page" : undefined}
          >
            <Icon name="user" className="h-4 w-4" />
            <span>Profile</span>
          </button>
        )}
      </nav>

      {/* Account Info and Sign Out */}
      <div className="flex items-center gap-2 sm:gap-3">
        {account && onProfile && (
          <button
            type="button"
            onClick={onProfile}
            title={account}
            className={`hidden max-w-[14rem] items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all border sm:inline-flex ${
              currentView === "profile"
                ? "border-accent bg-accent/10 text-ink shadow-sm"
                : "border-line bg-paper text-ink hover:border-accent hover:bg-card"
            }`}
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-low" />
            <span className="truncate font-semibold text-ink">{account}</span>
          </button>
        )}
        {account && !onProfile && (
          <span
            title={account}
            className="hidden max-w-[14rem] items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1 text-xs font-medium text-ink sm:inline-flex"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-low" />
            <span className="truncate">{account}</span>
          </span>
        )}
        <button
          type="button"
          onClick={onSignOut}
          title="Sign out"
          className="rounded-full border border-line px-3.5 py-1.5 text-xs text-muted transition-colors hover:border-high/40 hover:text-high sm:px-4 sm:py-2 sm:text-sm"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
