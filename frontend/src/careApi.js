const CARE_TOKEN_KEY = "risk-check-care-token"
const CARE_USER_KEY = "risk-check-care-user"

async function readJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export function getCareToken() {
  return localStorage.getItem(CARE_TOKEN_KEY) || ""
}

export function getCareUser() {
  try {
    return JSON.parse(localStorage.getItem(CARE_USER_KEY) || "null")
  } catch {
    return null
  }
}

export function clearCareSession() {
  localStorage.removeItem(CARE_TOKEN_KEY)
  localStorage.removeItem(CARE_USER_KEY)
}

function saveSession(payload) {
  localStorage.setItem(CARE_TOKEN_KEY, payload.token)
  localStorage.setItem(CARE_USER_KEY, JSON.stringify(payload.user))
  return payload
}

async function careFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  const token = getCareToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json"
  }
  const response = await fetch(`/api/care${path}`, { ...options, headers })
  const payload = await readJson(response)
  if (!response.ok) {
    const detail = payload?.detail
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((item) => item?.msg || JSON.stringify(item)).join("; ")
          : detail?.msg || "Care request failed."
    throw new Error(message)
  }
  return payload
}

export async function careRegister(body) {
  const payload = await careFetch("/auth/register", { method: "POST", body: JSON.stringify(body) })
  return saveSession(payload)
}

export async function careLogin(body) {
  const payload = await careFetch("/auth/login", { method: "POST", body: JSON.stringify(body) })
  return saveSession(payload)
}

export async function careMe() {
  const user = await careFetch("/me")
  localStorage.setItem(CARE_USER_KEY, JSON.stringify(user))
  return user
}

export const careAdminOverview = () => careFetch("/admin/overview")
export const careApproveDoctor = (id, status, note = "") =>
  careFetch(`/admin/doctors/${id}/license`, { method: "POST", body: JSON.stringify({ status, note }) })
export const careApprovePatient = (id, status, note = "") =>
  careFetch(`/admin/patients/${id}/approval`, { method: "POST", body: JSON.stringify({ status, note }) })

export const careListDoctors = () => careFetch("/doctors")
export const careDoctorSlots = (doctorId) => careFetch(`/doctors/${doctorId}/slots`)
export const careAddSlot = (body) => careFetch("/doctor/slots", { method: "POST", body: JSON.stringify(body) })
export const careMySlots = () => careFetch("/doctor/slots")
export const careDoctorConsultations = () => careFetch("/doctor/consultations")
export const careBook = (body) => careFetch("/consultations/book", { method: "POST", body: JSON.stringify(body) })
export const careCancelConsultation = (id) =>
  careFetch(`/consultations/${id}/cancel`, { method: "POST", body: JSON.stringify({}) })
export const careUpdateMeeting = (id, body) =>
  careFetch(`/consultations/${id}/meeting`, { method: "PATCH", body: JSON.stringify(body) })
export const careWriteReport = (id, body) =>
  careFetch(`/consultations/${id}/report`, { method: "POST", body: JSON.stringify(body) })
export const carePatientConsultations = () => careFetch("/patient/consultations")
export const carePatientRecovery = () => careFetch("/patient/recovery")
export const careNotifications = () => careFetch("/notifications")
