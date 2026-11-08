const LIMIT = 20
let activeAccount = ""

export function setHistoryAccount(name) {
  activeAccount = name || ""
}

function storageKey() {
  return activeAccount ? `risk-check-history:${activeAccount.toLowerCase()}` : "risk-check-history"
}

function normalizeHistoryEntry(entry) {
  if (!entry) return null
  const fullResult = entry.fullResult || {
    risk_level: entry.risk_level,
    probability: entry.probability,
    inputs_used: entry.inputs_used || [],
    cues: entry.cues || [],
    explanation: entry.explanation || null,
    daily_behavior: entry.daily_behavior || null,
    voice: entry.voice || null,
    image: entry.image || null,
    behavior: entry.behavior || null,
    screen: entry.screen || null,
    crisis_detected: !!entry.crisis_detected,
    disclaimer: "This is a screening flag, not a clinical diagnosis.",
  }
  return {
    ...entry,
    cues: entry.cues || [],
    inputs_used: entry.inputs_used || [],
    explanation: entry.explanation || fullResult.explanation || null,
    daily_behavior: entry.daily_behavior || fullResult.daily_behavior || null,
    voice: entry.voice || fullResult.voice || null,
    image: entry.image || fullResult.image || null,
    behavior: entry.behavior || fullResult.behavior || null,
    screen: entry.screen || fullResult.screen || null,
    crisis_detected: !!entry.crisis_detected || !!fullResult.crisis_detected,
    fullResult,
  }
}

export function readHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey()) || "[]")
    return Array.isArray(parsed) ? parsed.map(normalizeHistoryEntry) : []
  } catch {
    return []
  }
}

function shownScore(result) {
  if (result.screen) {
    const daily = result.daily_behavior
    return {
      risk_level: result.screen.level,
      probability: daily ? daily.points / daily.out_of : { low: 0.2, moderate: 0.55, high: 0.8 }[result.screen.level],
      score_kind: "behavior",
      behavior_points: daily ? daily.points : null,
    }
  }
  if (result.daily_behavior) {
    return {
      risk_level: result.daily_behavior.level,
      probability: result.daily_behavior.points / result.daily_behavior.out_of,
      score_kind: "behavior",
      behavior_points: result.daily_behavior.points,
    }
  }
  return {
    risk_level: result.risk_level,
    probability: result.probability,
    score_kind: "model",
    behavior_points: null,
  }
}

export function rememberCheckIn(result) {
  const previous = readHistory()
  const shown = shownScore(result)
  const entry = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    risk_level: shown.risk_level,
    probability: shown.probability,
    score_kind: shown.score_kind,
    behavior_points: shown.behavior_points,
    inputs_used: result.inputs_used || [],
    cues: result.cues || [],
    explanation: result.explanation || null,
    daily_behavior: result.daily_behavior || null,
    voice: result.voice || null,
    image: result.image || null,
    behavior: result.behavior || null,
    screen: result.screen || null,
    crisis_detected: !!result.crisis_detected,
    fullResult: result,
  }
  localStorage.setItem(storageKey(), JSON.stringify([entry, ...previous].slice(0, LIMIT)))
  return previous[0] || null
}

export function downloadSummary(result, timestamp) {
  const daily = result.daily_behavior
  const dateStr = timestamp ? new Date(timestamp).toLocaleString() : new Date().toLocaleString()
  const headline = result.screen?.level || daily?.level || result.risk_level || "Unknown"
  const lines = [
    "==========================================",
    "       MENTAL HEALTH RISK CHECK REPORT    ",
    "==========================================",
    `Date & Time: ${dateStr}`,
    `Screening Flag: ${headline.toUpperCase()}`,
    "",
    "--- MODALITIES EVALUATED ---",
    `Inputs Used: ${(result.inputs_used || []).join(", ") || "None"}`,
    daily ? `Daily Behavior: ${daily.level} (${daily.points} / ${daily.out_of} signs concerning)` : "",
    daily?.notes?.length ? `Behavior Notes: ${daily.notes.join("; ")}` : "",
    result.inputs_used?.includes("text") ? `Writing Model Probability: ${Number(result.probability).toFixed(4)}` : "",
    result.voice ? `Voice Acoustic: Pitch ${Math.round(result.voice.pitch_mean || 0)} Hz, Silence ${Math.round((result.voice.pause_ratio || 0) * 100)}%, Pauses ${result.voice.pause_count || 0}` : "",
    result.voice?.transcript ? `Heard Voice Words: ${result.voice.transcript}` : "",
    result.image?.appearance ? `Photo Appearance: ${result.image.appearance} - ${result.image.appearance_note || ""}` : "",
    result.image?.writing ? `Photo Writing Seen: ${result.image.writing}` : "",
    "",
    "--- KEY CUES & HIGHLIGHTS ---",
    `Identified Cues: ${(result.cues || []).join("; ") || "None"}`,
    result.explanation ? `Summary: ${result.explanation}` : "",
    "",
    result.crisis_detected
      ? "--- CRISIS SUPPORT HELPLINES (24/7) ---\n" +
        "• India (Tele-MANAS): 14416 / 1800-891-4416\n" +
        "• US & Canada: 988\n" +
        "• UK (Samaritans): 116 123\n" +
        "• International: https://findahelpline.com\n"
      : "",
    "--- IMPORTANT DISCLAIMER ---",
    result.disclaimer || "This is a screening flag, not a clinical diagnosis.",
    "This check-in is an early risk indicator and NOT a clinical diagnosis.",
    "If you are feeling overwhelmed, please speak with a healthcare professional or counsellor.",
    "==========================================",
  ].filter(Boolean)
  const blob = new Blob([lines.join("\n")], { type: "text/plain" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `risk-check-${new Date(timestamp || Date.now()).toISOString().slice(0, 10)}.txt`
  link.click()
  URL.revokeObjectURL(url)
}

export function clearHistory() {
  localStorage.removeItem(storageKey())
}

export function compareWithPrevious(current, previous) {
  const now = shownScore(current)
  if (!previous) {
    return {
      sentence: "This is the first check-in saved for this account.",
      before: null,
      now,
      change: "first",
    }
  }
  const beforeKind = previous.score_kind || "model"
  if (now.score_kind !== beforeKind) {
    return {
      sentence: "This result follows the day's behavior.",
      before: {
        risk_level: previous.risk_level,
        probability: previous.probability,
        score_kind: beforeKind,
        behavior_points: previous.behavior_points ?? null,
      },
      now,
      change: "different",
    }
  }
  const delta = now.probability - previous.probability
  let change = "same"
  let sentence = "The screening flag stayed about the same."
  if (delta >= 0.01) {
    change = "up"
    sentence = "The screening flag went up."
  } else if (delta <= -0.01) {
    change = "down"
    sentence = "The screening flag went down."
  }
  return {
    sentence,
    before: {
      risk_level: previous.risk_level,
      probability: previous.probability,
      score_kind: beforeKind,
      behavior_points: previous.behavior_points ?? null,
    },
    now,
    change,
  }
}
