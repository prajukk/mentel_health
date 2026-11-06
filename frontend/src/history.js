const LIMIT = 20
let activeAccount = ""

export function setHistoryAccount(name) {
  activeAccount = name || ""
}

function storageKey() {
  return activeAccount ? `risk-check-history:${activeAccount.toLowerCase()}` : "risk-check-history"
}

export function readHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey()) || "[]")
    return Array.isArray(parsed) ? parsed : []
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
    inputs_used: result.inputs_used,
    cues: (result.cues || []).slice(0, 5),
  }
  localStorage.setItem(storageKey(), JSON.stringify([entry, ...previous].slice(0, LIMIT)))
  return previous[0] || null
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
