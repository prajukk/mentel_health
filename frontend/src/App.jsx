import { useState } from "react"
import { predict } from "./api.js"
import { currentSession, signOut } from "./auth.js"
import { compareWithPrevious, readHistory, rememberCheckIn, setHistoryAccount } from "./history.js"
import CheckIn from "./screens/CheckIn.jsx"
import Evaluation from "./screens/Evaluation.jsx"
import History from "./screens/History.jsx"
import Login from "./screens/Login.jsx"
import Result from "./screens/Result.jsx"
import Welcome from "./screens/Welcome.jsx"

const EMPTY_DRAFT = {
  text: "",
  sleep: "",
  energy: "",
  company: "",
  routine: "",
  audioBlob: null,
  audioUrl: "",
  imageFile: null,
  imageUrl: "",
}

function behaviorState(draft) {
  const values = [draft.sleep, draft.energy, draft.company, draft.routine]
  const filled = values.filter(Boolean).length
  return { ready: filled === 4, partial: filled > 0 && filled < 4 }
}

export default function App() {
  const [account, setAccount] = useState(() => {
    const name = currentSession()
    setHistoryAccount(name)
    return name
  })
  const [view, setView] = useState("welcome")
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [result, setResult] = useState(null)
  const [comparison, setComparison] = useState("")
  const [historyVersion, setHistoryVersion] = useState(0)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const historyList = readHistory()
  const historyCount = historyList.length
  const openHistory = () => setView("history")

  function updateDraft(partial) {
    setDraft((current) => {
      if (partial.audioUrl && current.audioUrl) URL.revokeObjectURL(current.audioUrl)
      if (partial.imageUrl && current.imageUrl) URL.revokeObjectURL(current.imageUrl)
      return { ...current, ...partial }
    })
  }

  function goHome() {
    setView("welcome")
    setError("")
  }

  function startNewCheckIn() {
    setDraft((current) => {
      if (current.audioUrl) URL.revokeObjectURL(current.audioUrl)
      if (current.imageUrl) URL.revokeObjectURL(current.imageUrl)
      return EMPTY_DRAFT
    })
    setStep(0)
    setError("")
    setView("checkin")
  }

  function enter(name) {
    setHistoryAccount(name)
    setAccount(name)
    setView("welcome")
    setError("")
  }

  function leave() {
    setDraft((current) => {
      if (current.audioUrl) URL.revokeObjectURL(current.audioUrl)
      if (current.imageUrl) URL.revokeObjectURL(current.imageUrl)
      return EMPTY_DRAFT
    })
    setResult(null)
    setComparison("")
    setError("")
    setView("welcome")
    signOut()
    setHistoryAccount("")
    setAccount("")
  }

  async function submit() {
    const behavior = behaviorState(draft)
    if (!draft.text.trim() && !behavior.ready && !draft.imageFile) {
      setError("Write a journal entry, answer the behavior questions, or add a photo.")
      setStep(draft.text.trim() ? 1 : 0)
      return
    }
    if (behavior.partial) {
      setError("Answer all four behavior questions, or clear them to leave behavior out.")
      setStep(1)
      return
    }
    setSubmitting(true)
    setError("")
    try {
      const payload = await predict({ ...draft, behaviorReady: behavior.ready })
      const previous = rememberCheckIn(payload)
      setComparison(compareWithPrevious(payload, previous))
      setHistoryVersion((version) => version + 1)
      setResult(payload)
      setView("result")
    } catch (reason) {
      setError(reason.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!account) {
    return <Login onSignedIn={enter} />
  }

  if (view === "checkin") {
    return (
      <CheckIn
        draft={draft}
        onChange={updateDraft}
        step={step}
        onStep={setStep}
        account={account}
        onHome={goHome}
        onNewCheckIn={startNewCheckIn}
        onHistory={openHistory}
        onEvaluation={() => setView("evaluation")}
        onSignOut={leave}
        onSubmit={submit}
        submitting={submitting}
        error={error}
        historyCount={historyCount}
      />
    )
  }

  if (view === "result" && result) {
    return (
      <Result
        result={result}
        comparison={comparison}
        onEdit={() => {
          setError("")
          setView("checkin")
        }}
        account={account}
        onHome={goHome}
        onNewCheckIn={startNewCheckIn}
        onHistory={openHistory}
        onEvaluation={() => setView("evaluation")}
        onSignOut={leave}
        historyCount={historyCount}
      />
    )
  }

  if (view === "evaluation") {
    return (
      <Evaluation
        account={account}
        onHome={goHome}
        onNewCheckIn={startNewCheckIn}
        onHistory={openHistory}
        onEvaluation={() => setView("evaluation")}
        onSignOut={leave}
        historyCount={historyCount}
      />
    )
  }

  if (view === "history") {
    return (
      <History
        key={historyVersion}
        account={account}
        onHome={goHome}
        onNewCheckIn={startNewCheckIn}
        onHistory={openHistory}
        onEvaluation={() => setView("evaluation")}
        onSignOut={leave}
        historyCount={historyCount}
        onSelectResult={(pastResult) => {
          setResult(pastResult)
          setComparison("")
          setView("result")
        }}
      />
    )
  }

  return (
    <Welcome
      account={account}
      onStart={startNewCheckIn}
      onHome={goHome}
      onHistory={openHistory}
      onEvaluation={() => setView("evaluation")}
      onSignOut={leave}
      lastCheckIn={historyList[0]}
      historyCount={historyCount}
    />
  )
}
