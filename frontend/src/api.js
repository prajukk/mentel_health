function messageFrom(payload, fallback = "The check-in could not be scored.") {
  if (typeof payload?.detail === "string") return payload.detail
  if (Array.isArray(payload?.detail) && payload.detail[0]?.msg) return payload.detail[0].msg
  return fallback
}

async function readJson(response) {
  const raw = await response.text()
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function predict(draft) {
  const body = new FormData()
  body.append("text", draft.text ?? "")
  if (draft.behaviorReady) {
    body.append("sleep", draft.sleep)
    body.append("energy", draft.energy)
    body.append("company", draft.company)
    body.append("routine", draft.routine)
  }
  if (draft.audioBlob) {
    body.append("audio", draft.audioBlob, "check-in.wav")
  }
  if (draft.imageFile) {
    body.append("image", draft.imageFile, draft.imageFile.name || "check-in.png")
  }
  const response = await fetch("/api/predict", { method: "POST", body })
  const payload = await readJson(response)
  if (!response.ok) throw new Error(messageFrom(payload))
  if (!payload) throw new Error("The server returned an empty response.")
  return payload
}

export async function loadMetrics() {
  const response = await fetch("/api/metrics")
  if (!response.ok) throw new Error("Evaluation results are unavailable.")
  const payload = await readJson(response)
  if (!payload) throw new Error("Evaluation results are unavailable.")
  return payload
}

export async function synthesizeVoice(text) {
  if (!text || !text.trim()) return null
  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
    if (!response.ok) return null
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}
