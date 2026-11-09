import { useState } from "react"
import { createAccount, signIn } from "../auth.js"
import Icon from "../components/Icons.jsx"

const fieldClass =
  "mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-ink outline-none focus:border-accent"

export default function Login({ onSignedIn }) {
  const [creating, setCreating] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      const account = creating ? await createAccount(email, password) : await signIn(email, password)
      onSignedIn(account)
    } catch (reason) {
      setError(reason.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-between px-6 py-12 sm:px-12 lg:px-16 lg:py-16">
        <p className="eyebrow">Early screening</p>
        <div className="my-12">
          <h1 className="max-w-lg font-display text-6xl leading-[0.96] text-ink sm:text-7xl">
            Mental health risk check
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
            This is an early flag, not a diagnosis. Sign in with Gmail to keep your scores on this browser.
          </p>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-muted">A screening flag, kept only on this browser.</p>
      </div>
      <div className="flex items-center px-6 py-12 sm:px-12 lg:px-16">
        <form onSubmit={submit} className="w-full max-w-md rounded-[28px] border border-line bg-card p-8 sm:p-10">
          <h2 className="font-display text-3xl">{creating ? "Create an account" : "Sign in"}</h2>
          <label className="mt-8 block text-sm text-muted" htmlFor="gmail">
            Gmail
            <input
              id="gmail"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name@gmail.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="mt-5 block text-sm text-muted" htmlFor="password">
            Password
            <span className="relative mt-2 block">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={creating ? "new-password" : "current-password"}
                className={`${fieldClass} mt-0 pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1.5 text-muted transition-colors hover:bg-card hover:text-ink"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                <Icon name={showPassword ? "eyeOff" : "eye"} className="h-5 w-5" />
              </button>
            </span>
          </label>
          {error && <p className="mt-4 text-sm text-high">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="mt-8 rounded-full bg-accent px-8 py-3 text-white disabled:opacity-50"
          >
            {creating ? "Create account" : "Sign in"}
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating((current) => !current)
              setError("")
            }}
            className="mt-6 block text-sm text-muted"
          >
            {creating ? "I already have an account" : "Create an account"}
          </button>
        </form>
      </div>
    </section>
  )
}
