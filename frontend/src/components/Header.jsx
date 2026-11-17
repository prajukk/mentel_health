import Icon from "./Icons.jsx"

export default function Header({
  currentView = "welcome",
  account,
  careRole = "",
  onHome,
  onNewCheckIn,
  onHistory,
  onEvaluation,
  onProfile,
  onSignOut,
  onCare,
  historyCount = 0,
}) {
  const careLabel = careRole === "admin" ? "Admin" : careRole === "doctor" ? "Doctor" : careRole === "patient" ? "Consult" : "Care"
  return (
    <header className="flex items-center gap-2 rounded-2xl border border-line bg-card/90 px-3 py-2.5 shadow-[0_18px_40px_-32px_rgba(31,26,23,0.65)] backdrop-blur-md sm:gap-3 sm:rounded-full sm:px-4 sm:py-2">
      {/* Brand / Logo */}
      <button
        type="button"
        onClick={onHome}
        title="Return to Home"
        className="group flex min-w-0 shrink-0 items-center gap-2 pl-0.5 text-left transition-opacity hover:opacity-90"
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-accent font-display text-lg text-white shadow-sm transition-transform group-hover:scale-105">
          R
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block font-display text-base font-semibold leading-none text-ink sm:text-lg">
            Risk check
          </span>
          <span className="mt-1 block text-[10px] font-semibold tracking-[0.18em] text-muted uppercase">
            Mental Health Screening
          </span>
        </span>
      </button>

      {/* Main Navigation Links */}
      <nav
        aria-label="Main Navigation"
        className="flex min-w-0 flex-1 flex-nowrap items-center gap-0.5 overflow-x-auto sm:gap-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <button
          type="button"
          onClick={onHome}
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium sm:text-sm transition-all ${
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
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium sm:text-sm transition-all ${
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
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium sm:text-sm transition-all ${
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
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium sm:text-sm transition-all ${
            currentView === "evaluation"
              ? "bg-accent text-white shadow-sm"
              : "text-muted hover:bg-paper hover:text-ink"
          }`}
          aria-current={currentView === "evaluation" ? "page" : undefined}
        >
          <Icon name="evaluation" className="h-4 w-4" />
          <span>Evaluation</span>
        </button>

        {onCare && (
          <button
            type="button"
            onClick={onCare}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium sm:text-sm transition-all ${
              currentView === "admin" || currentView === "doctor" || currentView === "patient"
                ? "bg-accent text-white shadow-sm"
                : "text-muted hover:bg-paper hover:text-ink"
            }`}
          >
            <Icon name="user" className="h-4 w-4" />
            <span>{careLabel}</span>
          </button>
        )}

        {/* Compact screens: wider layouts open Profile from the account chip */}
        {onProfile && (
          <button
            type="button"
            onClick={onProfile}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all md:hidden ${
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
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {account && onProfile && (
          <button
            type="button"
            onClick={onProfile}
            title={`Profile · ${account}`}
            className={`hidden max-w-[11rem] items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-all md:inline-flex ${
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
            className="hidden max-w-[11rem] items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-xs font-medium text-ink md:inline-flex"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-low" />
            <span className="truncate">{account}</span>
          </span>
        )}
        <button
          type="button"
          onClick={onSignOut}
          title="Sign out"
          className="rounded-full border border-line px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-high/40 hover:text-high sm:px-3 sm:text-sm"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
