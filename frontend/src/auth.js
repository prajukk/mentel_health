const ACCOUNTS_KEY = "risk-check-accounts"
const SESSION_KEY = "risk-check-session"

function readAccounts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "{}")
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

async function digest(salt, password) {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function currentSession() {
  return localStorage.getItem(SESSION_KEY) || ""
}

export async function createAccount(name, password) {
  const cleaned = name.trim()
  if (cleaned.length < 2) throw new Error("Use a name with at least 2 letters.")
  if (password.length < 4) throw new Error("Use a password with at least 4 characters.")
  const accounts = readAccounts()
  const key = cleaned.toLowerCase()
  if (accounts[key]) throw new Error("That name is already in use.")
  const salt = crypto.randomUUID()
  accounts[key] = { name: cleaned, salt, hash: await digest(salt, password) }
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
  localStorage.setItem(SESSION_KEY, cleaned)
  return cleaned
}

export async function signIn(name, password) {
  const accounts = readAccounts()
  const record = accounts[name.trim().toLowerCase()]
  if (!record || (await digest(record.salt, password)) !== record.hash) {
    throw new Error("That name or password does not match.")
  }
  localStorage.setItem(SESSION_KEY, record.name)
  return record.name
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY)
}

export function getProfile(name) {
  if (!name) return null
  const accounts = readAccounts()
  const key = name.trim().toLowerCase()
  const record = accounts[key] || {}
  return {
    name: record.name || name,
    fullName: record.fullName || "",
    email: record.email || "",
    phone: record.phone || "",
    emergencyContactName: record.emergencyContactName || "",
    emergencyContactPhone: record.emergencyContactPhone || "",
    emergencyContactRelation: record.emergencyContactRelation || "",
    pronouns: record.pronouns || "",
    notes: record.notes || "",
  }
}

export function saveProfile(name, data) {
  if (!name) throw new Error("No active session to update profile.")
  const accounts = readAccounts()
  const key = name.trim().toLowerCase()
  if (!accounts[key]) {
    accounts[key] = { name }
  }
  accounts[key] = {
    ...accounts[key],
    fullName: (data.fullName ?? accounts[key].fullName ?? "").trim(),
    email: (data.email ?? accounts[key].email ?? "").trim(),
    phone: (data.phone ?? accounts[key].phone ?? "").trim(),
    emergencyContactName: (data.emergencyContactName ?? accounts[key].emergencyContactName ?? "").trim(),
    emergencyContactPhone: (data.emergencyContactPhone ?? accounts[key].emergencyContactPhone ?? "").trim(),
    emergencyContactRelation: (data.emergencyContactRelation ?? accounts[key].emergencyContactRelation ?? "").trim(),
    pronouns: (data.pronouns ?? accounts[key].pronouns ?? "").trim(),
    notes: (data.notes ?? accounts[key].notes ?? "").trim(),
  }
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
  return getProfile(name)
}

