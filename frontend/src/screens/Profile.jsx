import { useState } from "react"
import { getProfile, saveProfile } from "../auth.js"
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

export default function Profile({
  account,
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
    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      setError("Please enter a valid email address (e.g. name@gmail.com).")
      return
    }
    try {
      const updated = saveProfile(account, profile)
      setProfile(updated)
      setSavedMessage("Your profile has been saved successfully.")
      setError("")
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
        onNewCheckIn={onNewCheckIn}
        onHistory={onHistory}
        onEvaluation={onEvaluation}
        onProfile={onProfile}
        onSignOut={onSignOut}
        historyCount={historyCount}
      />

      <div className="mx-auto mt-8 max-w-3xl">
        {/* Top Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted sm:text-sm">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onHome}
              className="flex items-center gap-1 text-accent transition-colors hover:underline"
            >
              <Icon name="home" className="h-3.5 w-3.5" />
              <span>Home</span>
            </button>
            <Icon name="chevronRight" className="h-3.5 w-3.5 text-muted/60" />
            <span className="text-ink font-medium">User Profile & Safety</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onHome}
              className="rounded-full border border-line bg-card px-3 py-1 text-xs text-muted hover:text-ink hover:bg-paper"
            >
              Back to Home
            </button>
          </div>
        </nav>

        {/* Profile Card */}
        <div className="rounded-[28px] border border-line bg-card p-6 sm:p-10 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line/60 pb-6">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 font-display text-2xl font-bold text-accent">
                {account ? account[0].toUpperCase() : "U"}
              </span>
              <div>
                <h1 className="font-display text-2xl sm:text-3xl text-ink">
                  {profile.fullName || account}
                </h1>
                <p className="text-xs text-muted">
                  Account username: <span className="font-medium text-ink">@{account}</span>
                  {profile.pronouns && ` · (${profile.pronouns})`}
                </p>
              </div>
            </div>

            <div className="rounded-full border border-low/30 bg-low/10 px-3.5 py-1 text-xs font-medium text-low">
              Private & Local on this browser
            </div>
          </div>

          <form onSubmit={handleSave} className="mt-8 space-y-6">
            {/* Personal Details Section */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                1. Personal Information
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="font-medium text-ink">Full Name</span>
                  <input
                    type="text"
                    value={profile.fullName}
                    onChange={(e) => handleChange("fullName", e.target.value)}
                    placeholder="e.g. Alex Johnson"
                    className="mt-1.5 w-full rounded-2xl border border-line bg-paper/60 px-4 py-2.5 text-sm text-ink outline-none focus:border-accent"
                  />
                </label>

                <label className="block text-sm">
                  <span className="font-medium text-ink">Pronouns</span>
                  <input
                    type="text"
                    value={profile.pronouns}
                    onChange={(e) => handleChange("pronouns", e.target.value)}
                    placeholder="e.g. they/them, she/her, he/him"
                    className="mt-1.5 w-full rounded-2xl border border-line bg-paper/60 px-4 py-2.5 text-sm text-ink outline-none focus:border-accent"
                  />
                </label>

                <label className="block text-sm">
                  <span className="font-medium text-ink flex items-center gap-1.5">
                    <Icon name="mail" className="h-3.5 w-3.5 text-accent" />
                    Gmail / Email Address
                  </span>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    placeholder="e.g. yourname@gmail.com"
                    className="mt-1.5 w-full rounded-2xl border border-line bg-paper/60 px-4 py-2.5 text-sm text-ink outline-none focus:border-accent"
                  />
                </label>

                <label className="block text-sm">
                  <span className="font-medium text-ink flex items-center gap-1.5">
                    <Icon name="phone" className="h-3.5 w-3.5 text-accent" />
                    Phone Number
                  </span>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="e.g. +1 (555) 019-2834"
                    className="mt-1.5 w-full rounded-2xl border border-line bg-paper/60 px-4 py-2.5 text-sm text-ink outline-none focus:border-accent"
                  />
                </label>
              </div>
            </div>

            {/* Emergency Contact Section */}
            <div className="rounded-[22px] border border-line bg-paper/40 p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                    <Icon name="feel" className="h-4 w-4 text-accent" />
                    2. Emergency Contact (Recommended)
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    A trusted friend, family member, or care provider to reach if you ever experience severe distress.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <label className="block text-sm sm:col-span-1">
                  <span className="font-medium text-ink">Contact Name</span>
                  <input
                    type="text"
                    value={profile.emergencyContactName}
                    onChange={(e) => handleChange("emergencyContactName", e.target.value)}
                    placeholder="e.g. Sarah Connor"
                    className="mt-1.5 w-full rounded-2xl border border-line bg-card px-4 py-2.5 text-sm text-ink outline-none focus:border-accent"
                  />
                </label>

                <label className="block text-sm sm:col-span-1">
                  <span className="font-medium text-ink">Phone Number</span>
                  <input
                    type="tel"
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

            {/* Wellness Goals / Notes */}
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

            {/* Notifications and Alerts */}
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

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line/60 pt-6">
              <button
                type="submit"
                className="flex items-center gap-2 rounded-full bg-accent px-8 py-3 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5"
              >
                <Icon name="check" className="h-4 w-4" />
                <span>Save Profile Changes</span>
              </button>

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
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}

