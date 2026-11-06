function messageFrom(payload) {
  if (typeof payload?.detail === "string") return payload.detail
  return "The check-in could not be scored."
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
  const payload = await response.json()
  if (!response.ok) throw new Error(messageFrom(payload))
  return payload
}

export async function loadMetrics() {
  const response = await fetch("/api/metrics")
  if (!response.ok) throw new Error("Evaluation results are unavailable.")
  return response.json()
}
