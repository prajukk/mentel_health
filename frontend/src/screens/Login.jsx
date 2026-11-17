import { useState } from "react"
import { createAccount, seedProfileFromAccount, signIn } from "../auth.js"
import { careLogin, careRegister } from "../careApi.js"
import Icon from "../components/Icons.jsx"

const fieldClass =
  "mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-ink outline-none focus:border-accent"

const ROLES = [
  { id: "patient", label: "Patient" },
  { id: "doctor", label: "Doctor" },
  { id: "admin", label: "Admin" },
]

export default function Login({ onSignedIn }) {
  const [creating, setCreating] = useState(false)
  const [role, setRole] = useState("patient")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [licenseNumber, setLicenseNumber] = useState("")
  const [experienceYears, setExperienceYears] = useState("5")
  const [consultFee, setConsultFee] = useState("700")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      if (role === "admin") {
        if (creating) throw new Error("Admin accounts are seeded. Sign in with admin@care.local / admin123")
        const care = await careLogin({ email, password })
        onSignedIn({ email: care.user.email, care })
        return
      }

      if (role === "doctor") {
        if (creating) {
          if (!name.trim()) throw new Error("Enter your full name.")
          if (!phone.trim()) throw new Error("Enter your phone number.")
        }
        const care = creating
          ? await careRegister({
              email,
              password,
              name: name.trim(),
              role: "doctor",
              phone: phone.trim(),
              whatsapp: phone.trim(),
              license_number: licenseNumber,
              license_authority: "Medical Council",
              specialty: "Psychiatry",
              experience_years: Number(experienceYears) || 0,
              bio: "Psychiatry consultant",
              consult_fee: Number(consultFee) || 500,
            })
          : await careLogin({ email, password })
        onSignedIn({ email: care.user.email, care })
        return
      }

      // Patient: keep existing screening auth + care patient account
      const phoneNumber = phone.trim()
      if (creating) {
        if (!name.trim()) throw new Error("Enter your full name.")
        if (!phoneNumber) throw new Error("Enter your phone number.")
      }
      const displayName = (name.trim() || email.split("@")[0]).trim()

      let localEmail = ""
      if (creating) {
        localEmail = await createAccount(email, password, {
          fullName: displayName,
          phone: phoneNumber,
        })
      } else {
        try {
          localEmail = await signIn(email, password)
        } catch {
          localEmail = ""
        }
      }

      let care = null
      try {
        care = creating
          ? await careRegister({
              email,
              password,
              name: displayName,
              role: "patient",
              phone: phoneNumber,
              whatsapp: phoneNumber,
            })
          : await careLogin({ email, password })
      } catch (careError) {
        if (creating) {
          try {
            care = await careLogin({ email, password })
          } catch {
            throw careError
          }
        } else if (localEmail) {
          try {
            care = await careRegister({
              email,
              password,
              name: displayName || email.split("@")[0],
              role: "patient",
              phone: phoneNumber,
              whatsapp: phoneNumber,
            })
          } catch {
            try {
              care = await careLogin({ email, password })
            } catch {
              throw careError
            }
          }
        } else {
          throw careError
        }
      }

      const sessionEmail = localEmail || care.user.email
      seedProfileFromAccount(sessionEmail, {
        fullName: care?.user?.name || displayName,
        phone: care?.user?.phone || phoneNumber,
      })
      onSignedIn({ email: sessionEmail, care })
    } catch (reason) {
      setError(typeof reason.message === "string" ? reason.message : "Sign in failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-between px-6 py-12 sm:px-12 lg:px-16 lg:py-16">
        <p className="eyebrow">Screening + consultation</p>
        <div className="my-12">
          <h1 className="max-w-lg font-display text-6xl leading-[0.96] text-ink sm:text-7xl">
            Mental health risk check
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
            Multimodal screening stays on Home. Choose a role to sign in: patients book psychiatry visits, doctors run
            Meet or Zoom consults, and admin approves licenses and patient access.
          </p>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-muted">Early risk flag only, not a clinical diagnosis.</p>
      </div>
      <div className="flex items-center px-6 py-12 sm:px-12 lg:px-16">
        <form onSubmit={submit} className="w-full max-w-md rounded-[28px] border border-line bg-card p-8 sm:p-10">
          <h2 className="font-display text-3xl">{creating ? "Create an account" : "Sign in"}</h2>

          <div className="mt-6 flex flex-wrap gap-2">
            {ROLES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setRole(item.id)
                  setError("")
                }}
                className={`rounded-full px-4 py-1.5 text-xs font-medium ${
                  role === item.id ? "bg-accent text-white" : "border border-line text-muted"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {(role === "doctor" || role === "patient") && creating && (
            <label className="mt-6 block text-sm text-muted" htmlFor="name">
              Full name *
              <input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Johnson"
                className={fieldClass}
              />
            </label>
          )}

          <label className="mt-5 block text-sm text-muted" htmlFor="gmail">
            Email
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
              >
                <Icon name={showPassword ? "eyeOff" : "eye"} className="h-5 w-5" />
              </button>
            </span>
          </label>

          {creating && (role === "patient" || role === "doctor") && (
            <label className="mt-5 block text-sm text-muted" htmlFor="phone">
              Phone / WhatsApp *
              <input
                id="phone"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className={fieldClass}
              />
            </label>
          )}

          {creating && role === "doctor" && (
            <>
              <label className="mt-5 block text-sm text-muted" htmlFor="license">
                License number
                <input id="license" required value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} className={fieldClass} />
              </label>
              <label className="mt-5 block text-sm text-muted" htmlFor="exp">
                Experience (years)
                <input id="exp" type="number" min="0" value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} className={fieldClass} />
              </label>
              <label className="mt-5 block text-sm text-muted" htmlFor="fee">
                Consult fee (₹)
                <input id="fee" type="number" min="0" value={consultFee} onChange={(e) => setConsultFee(e.target.value)} className={fieldClass} />
              </label>
              <p className="mt-2 text-xs text-muted">Specialty fixed to Psychiatry. License goes to Admin for approval.</p>
            </>
          )}

          {error && <p className="mt-4 text-sm text-high">{error}</p>}
          <button type="submit" disabled={busy} className="mt-8 rounded-full bg-accent px-8 py-3 text-white disabled:opacity-50">
            {creating ? "Create account" : "Sign in"}
          </button>
          {role !== "admin" && (
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
          )}
        </form>
      </div>
    </section>
  )
}
