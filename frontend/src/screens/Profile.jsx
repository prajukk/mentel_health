import { useState } from "react"
import { getProfile, isProfileComplete, saveProfile } from "../auth.js"
import Header from "../components/Header.jsx"
import Icon from "../components/Icons.jsx"

const RELATIONS = [
  "Parent",
  "Partner / Spouse",
  "Sibling",
  "Child",
  "Friend",
  "Therapist / Doctor",
  "Other",
]

const fieldClass =
  "mt-1.5 w-full rounded-2xl border border-line bg-paper/60 px-4 py-2.5 text-sm text-ink outline-none focus:border-accent"

export default function Profile({
  account,
  required = false,
  onComplete,
  onHome,
  onNewCheckIn,
  onHistory,
  onEvaluation,
  onSignOut,
  onProfile,
  historyCount = 0,
}) {
  const [profile, setProfile] = useState(() => getProfile(account))
  const [savedMessage, setSavedMessage] = useState("")
  const [error, setError] = useState("")

  function handleChange(field, value) {
    setProfile((prev) => ({ ...prev, [field]: value }))
    setSavedMessage("")
    setError("")
  }

  function handleSave(e) {
    e.preventDefault()
    if (!profile.fullName?.trim()) {
      setError("Please enter your full name.")
      return
    }
    if (!profile.phone?.trim()) {
      setError("Please enter your phone number.")
      return
    }
    if (!profile.emergencyContactName?.trim() || !profile.emergencyContactPhone?.trim()) {
      setError("Please add an emergency contact name and phone number.")
      return
    }
    try {
      const updated = saveProfile(account, profile)
      setProfile(updated)
      setError("")
      if (isProfileComplete(account)) {
        setSavedMessage("Profile complete. You can continue to your check-in.")
        if (required && onComplete) {
          window.setTimeout(() => onComplete(), 450)
          return
        }
      }
      setSavedMessage("Your profile has been saved successfully.")
    } catch (err) {
      setError(err.message || "Failed to save profile.")
    }
  }

  return (
    <section className="page">
      <Header
        currentView="profile"
        account={account}
        onHome={onHome}
        onNewCheckIn={required ? undefined : onNewCheckIn}
        onHistory={required ? undefined : onHistory}
        onEvaluation={required ? undefined : onEvaluation}
        onProfile={onProfile}
        onSignOut={onSignOut}
        historyCount={historyCount}
      />

      <div className="mx-auto mt-8 max-w-3xl">
        <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted sm:text-sm">
          <div className="flex items-center gap-2">
            {!required && (
              <>
                <button
                  type="button"
                  onClick={onHome}
                  className="flex items-center gap-1 text-accent transition-colors hover:underline"
                >
                  <Icon name="home" className="h-3.5 w-3.5" />
                  <span>Home</span>
                </button>
                <Icon name="chevronRight" className="h-3.5 w-3.5 text-muted/60" />
              </>
            )}
            <span className="text-ink font-medium">
              {required ? "Complete your profile" : "User Profile & Safety"}
            </span>
          </div>

          {!required && (
            <button
              type="button"
              onClick={onHome}
              className="rounded-full border border-line bg-card px-3 py-1 text-xs text-muted hover:text-ink hover:bg-paper"
            >
              Back to Home
            </button>
          )}
        </nav>

        {required && (
          <div className="mb-5 rounded-[20px] border border-accent/30 bg-accent/10 p-4 text-sm text-ink">
            <p className="font-medium text-accent">One-time setup</p>
            <p className="mt-1 text-muted">
              New accounts need a completed profile once. Fill the required fields below, then continue.
              You will not be asked again on this browser.
            </p>
          </div>
        )}

        <div className="rounded-[28px] border border-line bg-card p-6 sm:p-10 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line/60 pb-6">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 font-display text-2xl font-bold text-accent">
                {(profile.fullName || account || "U")[0].toUpperCase()}
              </span>
              <div>
                <h1 className="font-display text-2xl sm:text-3xl text-ink">
                  {profile.fullName || account}
                </h1>
                <p className="text-xs text-muted">
                  Signed in with Gmail: <span className="font-medium text-ink">{account}</span>
                  {profile.pronouns && ` · (${profile.pronouns})`}
                </p>
              </div>
            </div>

            <div className="rounded-full border border-low/30 bg-low/10 px-3.5 py-1 text-xs font-medium text-low">
              Private & Local on this browser
            </div>
          </div>

          <form onSubmit={handleSave} className="mt-8 space-y-6">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                1. Personal Information
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="font-medium text-ink">
                    Full Name <span className="text-high">*</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={profile.fullName}
                    onChange={(e) => handleChange("fullName", e.target.value)}
                    placeholder="e.g. Alex Johnson"
                    className={fieldClass}
                  />
                </label>

                <label className="block text-sm">
                  <span className="font-medium text-ink">Pronouns</span>
                  <input
                    type="text"
                    value={profile.pronouns}
                    onChange={(e) => handleChange("pronouns", e.target.value)}
                    placeholder="e.g. they/them, she/her, he/him"
                    className={fieldClass}
                  />
                </label>

                <label className="block text-sm">
                  <span className="font-medium text-ink flex items-center gap-1.5">
                    <Icon name="mail" className="h-3.5 w-3.5 text-accent" />
                    Gmail
                  </span>
                  <input
                    type="email"
                    value={profile.email || account}
                    readOnly
                    title="Login Gmail cannot be changed here"
                    placeholder="e.g. yourname@gmail.com"
                    className="mt-1.5 w-full rounded-2xl border border-line bg-paper/40 px-4 py-2.5 text-sm text-muted outline-none"
                  />
                </label>

                <label className="block text-sm">
                  <span className="font-medium text-ink flex items-center gap-1.5">
                    <Icon name="phone" className="h-3.5 w-3.5 text-accent" />
                    Phone Number <span className="text-high">*</span>
                  </span>
                  <input
                    type="tel"
                    required
                    value={profile.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="e.g. +1 (555) 019-2834"
                    className={fieldClass}
                  />
                </label>
              </div>
            </div>

            <div className="rounded-[22px] border border-line bg-paper/40 p-5 sm:p-6">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                  <Icon name="feel" className="h-4 w-4 text-accent" />
                  2. Emergency Contact <span className="text-high normal-case tracking-normal">*</span>
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Required once for safety. A trusted person we can show if you ever need support.
                </p>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <label className="block text-sm sm:col-span-1">
                  <span className="font-medium text-ink">
                    Contact Name <span className="text-high">*</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={profile.emergencyContactName}
                    onChange={(e) => handleChange("emergencyContactName", e.target.value)}
                    placeholder="e.g. Sarah Connor"
                    className="mt-1.5 w-full rounded-2xl border border-line bg-card px-4 py-2.5 text-sm text-ink outline-none focus:border-accent"
                  />
                </label>

                <label className="block text-sm sm:col-span-1">
                  <span className="font-medium text-ink">
                    Phone Number <span className="text-high">*</span>
                  </span>
                  <input
                    type="tel"
                    required
                    value={profile.emergencyContactPhone}
                    onChange={(e) => handleChange("emergencyContactPhone", e.target.value)}
                    placeholder="e.g. +1 (555) 123-4567"
                    className="mt-1.5 w-full rounded-2xl border border-line bg-card px-4 py-2.5 text-sm text-ink outline-none focus:border-accent"
                  />
                </label>

                <label className="block text-sm sm:col-span-1">
                  <span className="font-medium text-ink">Relationship</span>
                  <select
                    value={profile.emergencyContactRelation}
                    onChange={(e) => handleChange("emergencyContactRelation", e.target.value)}
                    className="mt-1.5 w-full rounded-2xl border border-line bg-card px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
                  >
                    <option value="">Select relation...</option>
                    {RELATIONS.map((rel) => (
                      <option key={rel} value={rel}>
                        {rel}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                3. Personal Wellness Notes / Goals
              </h2>
              <textarea
                value={profile.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                placeholder="Write any personal notes, triggers to avoid, or daily routines that help you feel grounded..."
                className="mt-2 w-full rounded-2xl border border-line bg-paper/60 px-4 py-3 text-sm text-ink outline-none focus:border-accent min-h-24 resize-y leading-relaxed"
              />
            </div>

            {savedMessage && (
              <div className="rounded-xl border border-low/30 bg-low/10 p-3 text-xs text-low font-medium flex items-center gap-2">
                <Icon name="check" className="h-4 w-4" />
                <span>{savedMessage}</span>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-high/30 bg-[#FFF5F4] p-3 text-xs text-high font-medium">
                {error}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line/60 pt-6">
              <button
                type="submit"
                className="flex items-center gap-2 rounded-full bg-accent px-8 py-3 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5"
              >
                <Icon name="check" className="h-4 w-4" />
                <span>{required ? "Save & continue" : "Save Profile Changes"}</span>
              </button>

              {!required && (
                <div className="flex items-center gap-3">
                  {onNewCheckIn && (
                    <button
                      type="button"
                      onClick={onNewCheckIn}
                      className="rounded-full border border-line bg-paper px-5 py-2.5 text-xs sm:text-sm font-medium text-ink hover:bg-card"
                    >
                      Start a Check-In
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onHome}
                    className="rounded-full border border-line px-5 py-2.5 text-xs sm:text-sm text-muted hover:text-ink"
                  >
                    Return to Home
                  </button>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
