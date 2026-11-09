const ACCOUNTS_KEY = "risk-check-accounts"
const SESSION_KEY = "risk-check-session"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i

function readAccounts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "{}")
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase()
}

function assertEmail(email) {
  const cleaned = normalizeEmail(email)
  if (!cleaned || !EMAIL_RE.test(cleaned)) {
    throw new Error("Enter a valid Gmail address (e.g. name@gmail.com).")
  }
  return cleaned
}

async function digest(salt, password) {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function currentSession() {
  const email = localStorage.getItem(SESSION_KEY) || ""
  if (!email) return ""
  const accounts = readAccounts()
  if (!accounts[normalizeEmail(email)]) {
    localStorage.removeItem(SESSION_KEY)
    return ""
  }
  return email
}

export async function createAccount(email, password) {
  const cleaned = assertEmail(email)
  if (password.length < 4) throw new Error("Use a password with at least 4 characters.")
  const accounts = readAccounts()
  if (accounts[cleaned]) throw new Error("That Gmail is already in use.")
  const salt = crypto.randomUUID()
  const localName = cleaned.split("@")[0]
  accounts[cleaned] = {
    name: localName,
    email: cleaned,
    salt,
    hash: await digest(salt, password),
  }
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
  localStorage.setItem(SESSION_KEY, cleaned)
  return cleaned
}

export async function signIn(email, password) {
  const cleaned = assertEmail(email)
  const accounts = readAccounts()
  const record = accounts[cleaned]
  if (!record || (await digest(record.salt, password)) !== record.hash) {
    throw new Error("That Gmail or password does not match.")
  }
  const sessionEmail = record.email || cleaned
  localStorage.setItem(SESSION_KEY, sessionEmail)
  return sessionEmail
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY)
}

export function getProfile(email) {
  if (!email) return null
  const accounts = readAccounts()
  const key = normalizeEmail(email)
  const record = accounts[key] || {}
  return {
    name: record.name || email,
    fullName: record.fullName || "",
    email: record.email || key,
    phone: record.phone || "",
    emergencyContactName: record.emergencyContactName || "",
    emergencyContactPhone: record.emergencyContactPhone || "",
    emergencyContactRelation: record.emergencyContactRelation || "",
    pronouns: record.pronouns || "",
    notes: record.notes || "",
    profileComplete: !!record.profileComplete,
  }
}

export function isProfileComplete(email) {
  if (!email) return false
  const profile = getProfile(email)
  if (!profile) return false
  if (profile.profileComplete) return true
  return Boolean(
    profile.fullName?.trim() &&
      profile.phone?.trim() &&
      profile.emergencyContactName?.trim() &&
      profile.emergencyContactPhone?.trim(),
  )
}

export function saveProfile(email, data) {
  if (!email) throw new Error("No active session to update profile.")
  const accounts = readAccounts()
  const key = normalizeEmail(email)
  if (!accounts[key]) {
    throw new Error("Account not found. Please sign in again.")
  }
  const fullName = (data.fullName ?? accounts[key].fullName ?? "").trim()
  const phone = (data.phone ?? accounts[key].phone ?? "").trim()
  const emergencyContactName = (data.emergencyContactName ?? accounts[key].emergencyContactName ?? "").trim()
  const emergencyContactPhone = (data.emergencyContactPhone ?? accounts[key].emergencyContactPhone ?? "").trim()
  const emergencyContactRelation = (data.emergencyContactRelation ?? accounts[key].emergencyContactRelation ?? "").trim()
  const pronouns = (data.pronouns ?? accounts[key].pronouns ?? "").trim()
  const notes = (data.notes ?? accounts[key].notes ?? "").trim()
  const profileComplete = Boolean(fullName && phone && emergencyContactName && emergencyContactPhone)

  accounts[key] = {
    ...accounts[key],
    // Login Gmail stays the account identity; keep it in sync with the session key.
    email: key,
    fullName,
    phone,
    emergencyContactName,
    emergencyContactPhone,
    emergencyContactRelation,
    pronouns,
    notes,
    profileComplete,
  }
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
  return getProfile(email)
}
