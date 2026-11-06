import Header from "../components/Header.jsx"
import Icon from "../components/Icons.jsx"
import { ChangeChart, DayShape, FeelGauge } from "../components/ResultCharts.jsx"

const NEXT_STEP = {
  low: "Keep a note of what felt steady. Talk with someone you trust if this changes.",
  moderate: "Consider talking with a counsellor about what has been weighing on you.",
  high: "Talk with a counsellor or a local health service soon. This screen cannot assess an emergency.",
}

function downloadSummary(result) {
  const daily = result.daily_behavior
  const lines = [
    "Mental health risk check",
    result.disclaimer,
    daily
      ? `Behavior: ${daily.level}, ${daily.points} of ${daily.out_of}`
      : `Level: ${result.risk_level}`,
    daily ? `Behavior notes: ${daily.notes.join(" ")}` : `Probability: ${Number(result.probability).toFixed(2)}`,
    result.inputs_used.includes("text")
      ? `Writing model: ${result.risk_level}, ${Number(result.probability).toFixed(2)}`
      : "",
    `Cues: ${(result.cues || []).join("; ") || "none"}`,
    "This file does not include the journal text.",
  ].filter(Boolean)
  const blob = new Blob([lines.join("\n")], { type: "text/plain" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = "risk-check.txt"
  link.click()
  URL.revokeObjectURL(url)
}

const LEVEL_COLOR = {
  low: "text-low",
  moderate: "text-moderate",
  high: "text-high",
}

function isRoutineCue(cue) {
  return /upvote|karma|comment|writing time|late-night/i.test(cue)
}

function isWeakWritingCue(cue) {
  return /vocabulary variety|writing length/i.test(cue)
}

function Card({ title, icon, children, className = "" }) {
  return (
    <article className={`rounded-[20px] border border-line bg-card p-6 ${className}`}>
      <h2 className="flex items-center gap-2 text-sm text-muted">
        {icon && <Icon name={icon} className="h-4 w-4" />}
        {title}
      </h2>
      <div className="mt-4 text-ink">{children}</div>
    </article>
  )
}

const ANSWER_WEIGHT = {
  sleep: { well: 0, short: 1, poor: 2, none: 2 },
  energy: { usual: 0, low: 1, very_low: 2 },
  company: { yes: 0, little: 1, no: 2 },
  routine: { yes: 0, partly: 1, no: 2 },
}

const ANSWER_LABEL = { sleep: "Sleep", energy: "Energy", company: "People", routine: "Routine" }

const ANSWER_DETAIL = {
  sleep: { well: "Usual", short: "Short", poor: "Poor", none: "Almost none" },
  energy: { usual: "Usual", low: "Low", very_low: "Very low" },
  company: { yes: "With people", little: "A little", no: "Alone" },
  routine: { yes: "Kept", partly: "Partly", no: "Not kept" },
}

function shownShare(result, headline) {
  const daily = result.daily_behavior
  if (daily && (!result.screen || result.screen.level === daily.level)) {
    return daily.points / daily.out_of
  }
  if (!result.screen) return Number(result.probability) || 0
  if (headline === "low") return 0.2
  if (headline === "moderate") return 0.55
  return 0.85
}

function behaviorRows(daily) {
  if (!daily?.answers) return []
  return ["sleep", "energy", "company", "routine"].map((key) => {
    const choice = daily.answers[key]
    const value = ANSWER_WEIGHT[key][choice] ?? 0
    return {
      label: ANSWER_LABEL[key],
      detail: ANSWER_DETAIL[key][choice] || choice,
      steadiness: 2 - value,
    }
  })
}

function shareFromScore(score) {
  if (!score) return 0
  if (score.score_kind === "behavior" && score.behavior_points != null) return score.behavior_points / 8
  return Number(score.probability) || 0
}

const PLAIN_WORDS = new Set(["today", "day", "time", "just", "like", "really", "know", "going", "people"])

function writingLines(cues) {
  const words = []
  for (const cue of cues) {
    const match = cue.match(/the word [“"](.+?)[”"]/)
    if (!match || PLAIN_WORDS.has(match[1].toLowerCase())) continue
    words.push(match[1])
  }
  const lines = []
  if (cues.some((cue) => /negative sentiment/i.test(cue))) lines.push("The writing sounds negative.")
  if (cues.some((cue) => /positive sentiment/i.test(cue))) lines.push("The writing sounds positive.")
  if (cues.some((cue) => /first-person/i.test(cue))) lines.push("It uses a lot of I, me, and my.")
  if (words.length) lines.push(`Words that stood out: ${words.join(", ")}.`)
  return lines.length ? lines : ["The score used the wording of the journal."]
}

function CueList({ cues }) {
  if (!cues.length) return <p>No strong cues in this check-in.</p>
  return (
    <ul className="space-y-2">
      {cues.map((cue) => (
        <li key={cue}>{cue}</li>
      ))}
    </ul>
  )
}

function scoreLabel(score) {
  if (!score) return ""
  if (score.score_kind === "behavior" && score.behavior_points != null) {
    return `${score.risk_level}, ${score.behavior_points} of 8`
  }
  return `${score.risk_level}, ${Number(score.probability).toFixed(2)}`
}

function checkedLine(result) {
  if (result.screen?.source === "both") {
    return "This follows the behavior answers and the look in the photo."
  }
  if (result.screen?.source === "photo") {
    return "This follows the look Gemini read in the photo."
  }
  if (result.daily_behavior || result.screen?.source === "behavior") {
    return "This follows sleep, energy, time with other people, and whether the usual routine was kept."
  }
  const writing = result.inputs_used.includes("text")
  const behavior = result.inputs_used.includes("behavior")
  if (writing && behavior) return "The number comes from your writing and the saved routine features."
  if (writing) return "The number comes from your writing only. Behavior was left out."
  return "The number comes from the saved routine features. No writing was scored."
}

export default function Result({ result, comparison, account, onEdit, onHome, onHistory, onEvaluation, onSignOut }) {
  const daily = result.daily_behavior
  const headline = result.screen?.level || daily?.level || result.risk_level
  const writingCues = result.inputs_used.includes("text")
    ? result.cues.filter((cue) => !isRoutineCue(cue) && !isWeakWritingCue(cue))
    : null
  const language = writingCues && writingCues.length ? writingCues : result.inputs_used.includes("text")
    ? result.cues.filter((cue) => !isRoutineCue(cue))
    : null
  const behaviorNotes = daily?.notes || result.behavior?.notes || null
  const share = shownShare(result, headline)
  const signs = behaviorRows(daily)
  const leftOut = [
    !language && "writing",
    !behaviorNotes && "behavior",
    !(result.voice_recorded && result.voice) && "voice",
    !result.image && "photo",
  ].filter(Boolean)

  return (
    <section className="page">
      <Header account={account} onHome={onHome} onHistory={onHistory} onEvaluation={onEvaluation} onSignOut={onSignOut} />
      <div className="mx-auto mt-10 max-w-5xl">
        <article className="rounded-[20px] border border-line bg-card p-8">
          <p className={`font-display text-6xl capitalize sm:text-7xl ${LEVEL_COLOR[headline]}`}>
            {headline}
          </p>
          {daily && (
            <p className="mt-4 text-lg text-ink">
              {daily.points} of {daily.out_of} behavior signs were concerning.
            </p>
          )}
          {result.image?.appearance && result.image.appearance !== "unclear" && (
            <p className={`${daily ? "mt-2" : "mt-4"} text-lg text-ink`}>
              The photo looks {result.image.appearance}.
            </p>
          )}
          {!daily && result.screen?.source !== "photo" && (
            <p className="mt-4 text-lg text-ink">Probability {result.probability.toFixed(2)}</p>
          )}
          <p className="mt-2 max-w-xl text-muted">{checkedLine(result)}</p>
          {daily && result.inputs_used.includes("text") && (
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
              The writing model read the journal as {result.risk_level}, {result.probability.toFixed(2)}. That
              number is from the words. The result above follows the behavior answers.
            </p>
          )}
          {!daily && (
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
              Under 0.40 is low. From 0.40 to 0.70 is moderate. Above 0.70 is high.
            </p>
          )}
          {comparison?.before && (
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <p>
                <span className="block text-sm text-muted">Before</span>
                <span className="capitalize">{scoreLabel(comparison.before)}</span>
              </p>
              <p>
                <span className="block text-sm text-muted">Now</span>
                <span className="capitalize">{scoreLabel(comparison.now)}</span>
              </p>
              <p>
                <span className="block text-sm text-muted">Change</span>
                {comparison.sentence}
              </p>
            </div>
          )}
          {comparison && !comparison.before && <p className="mt-4 text-sm text-muted">{comparison.sentence}</p>}
          <p className="mt-4 max-w-xl text-muted">{result.disclaimer}</p>
          {result.explanation && (
            <p className="mt-4 max-w-xl leading-relaxed text-ink">{result.explanation}</p>
          )}
        </article>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card title="How this feels" icon="feel" className={signs.length ? "" : "lg:col-span-2"}>
            <FeelGauge value={share} label={headline} />
          </Card>
          {signs.length > 0 && (
            <Card title="Parts of the day" icon="behavior">
              <DayShape parts={signs} />
            </Card>
          )}
          {comparison?.before && (
            <Card title="Last time and this time" icon="history" className="lg:col-span-2">
              <ChangeChart
                before={{
                  share: shareFromScore(comparison.before),
                  level: comparison.before.risk_level,
                  detail: comparison.before.behavior_points != null ? `${comparison.before.behavior_points} of 8` : Number(comparison.before.probability).toFixed(2),
                }}
                now={{
                  share: shareFromScore(comparison.now),
                  level: comparison.now.risk_level,
                  detail: comparison.now.behavior_points != null ? `${comparison.now.behavior_points} of 8` : Number(comparison.now.probability).toFixed(2),
                }}
              />
            </Card>
          )}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {language && (
            <Card title="Writing" icon="journal">
              <div className="space-y-3">
                <CueList cues={writingLines(language)} />
                <p className="text-sm leading-relaxed text-muted">
                  {daily
                    ? "These words are the writing model. The result above follows the behavior answers."
                    : "This is what the score used. One word is not a diagnosis."}
                </p>
              </div>
            </Card>
          )}
          {behaviorNotes && (
            <Card title="Behavior" icon="behavior">
              <div className="space-y-3">
                <ul className="space-y-2">
                  {behaviorNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
                <p className="text-sm leading-relaxed text-muted">
                  {daily
                    ? "These answers set the result. One answer is not a diagnosis."
                    : "These saved routine features were included with the writing."}
                </p>
              </div>
            </Card>
          )}
          {result.voice_recorded && result.voice && (
            <Card title="Voice" icon="voice">
              <div className="space-y-2">
                <p>Pitch {Math.round(result.voice.pitch_mean)} Hz, how high or low the voice sounded.</p>
                <p>
                  Silence {Math.round(result.voice.pause_ratio * 100)}%, with {result.voice.pause_count}{" "}
                  {result.voice.pause_count === 1 ? "pause" : "pauses"}.
                </p>
                {result.voice.transcript && <p>Heard: {result.voice.transcript}</p>}
                <p className="text-sm leading-relaxed text-muted">
                  {result.voice.used_in_score
                    ? "The journal was empty, so these spoken words were scored. Pitch and silence are not part of the number."
                    : "Pitch and silence are shown here. They do not change the behavior result."}
                </p>
              </div>
            </Card>
          )}
          {result.image && (
            <Card title="Image" icon="image">
              <div className="space-y-2">
                <p>
                  {result.image.appearance === "sad"
                    ? "Looks sad."
                    : result.image.appearance === "low"
                      ? "Looks low."
                      : result.image.appearance === "steady"
                        ? "Looks steady."
                        : "No clear look."}
                </p>
                {result.image.appearance_note && <p>{result.image.appearance_note}</p>}
                <p>
                  {result.image.width} by {result.image.height} pixels. Brightness{" "}
                  {Math.round(result.image.brightness * 100)}%.
                </p>
                <p>{result.image.writing ? `Writing seen: ${result.image.writing}` : "No writing was visible."}</p>
                <p className="text-sm leading-relaxed text-muted">
                  Gemini read this photo. A sad or low look can raise the result. This is not a diagnosis.
                </p>
              </div>
            </Card>
          )}
        </div>
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted">
          {leftOut.length
            ? `Left out: ${leftOut.join(", ")}. A blank is not counted as zero.`
            : "Writing, behavior, voice, and photo were all included."}
        </p>

        <article className="mt-8 max-w-xl rounded-[20px] border border-line bg-card p-6">
          <h2 className="flex items-center gap-2 text-sm text-muted">
            <Icon name="next" className="h-4 w-4" />
            Next step
          </h2>
          <p className="mt-3 leading-relaxed">{NEXT_STEP[headline]}</p>
        </article>

        <div className="mt-10 flex flex-wrap items-center gap-6">
          <a
            href="https://findahelpline.com/"
            className="text-accent underline decoration-line underline-offset-4"
          >
            Talk to a counsellor or a local health service
          </a>
          <button type="button" onClick={onEdit} className="rounded-full border border-line px-6 py-3">
            Edit check-in
          </button>
          <button
            type="button"
            onClick={() => downloadSummary(result)}
            className="rounded-full border border-line px-6 py-3"
          >
            Download summary
          </button>
        </div>
      </div>
    </section>
  )
}
