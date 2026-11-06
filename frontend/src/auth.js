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
