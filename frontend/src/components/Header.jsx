import Icon from "./Icons.jsx"

export default function Header({ account, onHome, onHistory, onEvaluation, onSignOut }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-full border border-line bg-card/80 px-3 py-2 shadow-[0_18px_40px_-32px_rgba(31,26,23,0.65)] backdrop-blur-md sm:px-4">
      <button type="button" onClick={onHome} className="flex items-center gap-3 pl-1 text-left">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-accent font-display text-lg text-white">R</span>
        <span>
          <span className="block font-display text-lg leading-none text-ink">Risk check</span>
          <span className="mt-1 block text-[10px] font-semibold tracking-[0.18em] text-muted uppercase">Screening</span>
        </span>
      </button>
      <nav className="flex flex-wrap items-center gap-1">
        <button type="button" onClick={onHistory} className="flex items-center gap-2 rounded-full px-4 py-2 text-sm text-muted hover:bg-paper hover:text-ink">
          <Icon name="history" className="h-4 w-4" />
          History
        </button>
        <button type="button" onClick={onEvaluation} className="flex items-center gap-2 rounded-full px-4 py-2 text-sm text-muted hover:bg-paper hover:text-ink">
          <Icon name="evaluation" className="h-4 w-4" />
          Evaluation
        </button>
      </nav>
      <div className="flex items-center gap-3">
        {account && <span className="hidden text-sm text-ink sm:inline">{account}</span>}
        <button type="button" onClick={onSignOut} className="rounded-full border border-line px-4 py-2 text-sm">
          Sign out
        </button>
      </div>
    </header>
  )
}