import { useState } from "react"
import { createAccount, signIn } from "../auth.js"

const fieldClass =
  "mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-ink outline-none focus:border-accent"

export default function Login({ onSignedIn }) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      const account = creating ? await createAccount(name, password) : await signIn(name, password)
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
            This is an early flag, not a diagnosis. Sign in to keep your scores on this browser.
          </p>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-muted">A screening flag, kept only on this browser.</p>
      </div>
      <div className="flex items-center px-6 py-12 sm:px-12 lg:px-16">
        <form onSubmit={submit} className="w-full max-w-md rounded-[28px] border border-line bg-card p-8 sm:p-10">
          <h2 className="font-display text-3xl">{creating ? "Create an account" : "Sign in"}</h2>
          <label className="mt-8 block text-sm text-muted" htmlFor="name">
            Name
            <input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="username"
              className={fieldClass}
            />
          </label>
          <label className="mt-5 block text-sm text-muted" htmlFor="password">
            Password
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={creating ? "new-password" : "current-password"}
              className={fieldClass}
            />
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
