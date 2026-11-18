import { useRef, useState } from "react"
import { predict } from "./api.js"
import { clearCareSession, getCareUser } from "./careApi.js"
import { currentSession, ensureLocalShellAccount, isProfileComplete, seedProfileFromAccount, signOut } from "./auth.js"
import { compareWithPrevious, readHistory, rememberCheckIn, setHistoryAccount } from "./history.js"
import AdminCare from "./screens/AdminCare.jsx"
import CheckIn from "./screens/CheckIn.jsx"
import DoctorCare from "./screens/DoctorCare.jsx"
import Evaluation from "./screens/Evaluation.jsx"
import History from "./screens/History.jsx"
import Login from "./screens/Login.jsx"
import PatientCare from "./screens/PatientCare.jsx"
import Profile from "./screens/Profile.jsx"
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

function careHomeView(role) {
  if (role === "admin") return "admin"
  if (role === "doctor") return "doctor"
  if (role === "patient") return "patient"
  return "welcome"
}

function initialViewFor(account, careUser) {
  if (!account) return "welcome"
  if (careUser?.role === "admin" || careUser?.role === "doctor") return careHomeView(careUser.role)
  return isProfileComplete(account) ? "welcome" : "profile"
}

export default function App() {
  const [account, setAccount] = useState(() => {
    const name = currentSession()
    const care = getCareUser()
    if (name && care) {
      seedProfileFromAccount(name, { fullName: care.name, phone: care.phone })
    }
    setHistoryAccount(name)
    return name
  })
  const [careUser, setCareUser] = useState(() => getCareUser())
  const [view, setView] = useState(() => initialViewFor(currentSession(), getCareUser()))
  const [profileGate, setProfileGate] = useState(() => {
    const name = currentSession()
    const care = getCareUser()
    if (care?.role === "admin" || care?.role === "doctor") return false
    return Boolean(name && !isProfileComplete(name))
  })
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [result, setResult] = useState(null)
  const [comparison, setComparison] = useState("")
  const [historyVersion, setHistoryVersion] = useState(0)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [resultEditable, setResultEditable] = useState(true)
  const submittingRef = useRef(false)

  const historyList = readHistory()
  const historyCount = historyList.length
  const isStaff = careUser?.role === "admin" || careUser?.role === "doctor"

  function requireProfileOr(run) {
    if (isStaff) {
      run()
      return
    }
    if (profileGate || (account && !isProfileComplete(account))) {
      setProfileGate(true)
      setView("profile")
      return
    }
    run()
  }

  const openHistory = () => requireProfileOr(() => setView("history"))
  const openProfile = () => setView("profile")
  const openEvaluation = () => requireProfileOr(() => setView("evaluation"))
  const openCare = () => setView(careHomeView(careUser?.role || "patient"))

  function updateDraft(partial) {
    setDraft((current) => {
      if ("audioUrl" in partial && current.audioUrl && partial.audioUrl !== current.audioUrl) {
        URL.revokeObjectURL(current.audioUrl)
      }
      if ("imageUrl" in partial && current.imageUrl && partial.imageUrl !== current.imageUrl) {
        URL.revokeObjectURL(current.imageUrl)
      }
      return { ...current, ...partial }
    })
  }

  function goHome() {
    if (isStaff) {
      setView(careHomeView(careUser.role))
      setError("")
      return
    }
    requireProfileOr(() => {
      setView("welcome")
      setError("")
    })
  }

  function startNewCheckIn() {
    requireProfileOr(() => {
      setDraft((current) => {
        if (current.audioUrl) URL.revokeObjectURL(current.audioUrl)
        if (current.imageUrl) URL.revokeObjectURL(current.imageUrl)
        return EMPTY_DRAFT
      })
      setStep(0)
      setError("")
      setView("checkin")
    })
  }

  function enter(payload) {
    const care = payload?.care || null
    const email =
      typeof payload === "string"
        ? payload
        : ensureLocalShellAccount(payload.email, care?.user?.name || "")
    if (care?.user) {
      seedProfileFromAccount(email, {
        fullName: care.user.name,
        phone: care.user.phone,
      })
    }
    setHistoryAccount(email)
    setAccount(email)
    setCareUser(care?.user || getCareUser())
    const role = care?.user?.role
    if (role === "admin" || role === "doctor") {
      setProfileGate(false)
      setView(careHomeView(role))
      setError("")
      return
    }
    const ready = isProfileComplete(email)
    setProfileGate(!ready)
    setView(ready ? "welcome" : "profile")
    setError("")
  }

  function finishProfileSetup() {
    setProfileGate(false)
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
    setProfileGate(false)
    setView("welcome")
    clearCareSession()
    setCareUser(null)
    signOut()
    setHistoryAccount("")
    setAccount("")
  }

  async function submit() {
    if (submittingRef.current) return
    if (profileGate || !isProfileComplete(account)) {
      setProfileGate(true)
      setView("profile")
      return
    }
    const behavior = behaviorState(draft)
    if (!draft.text.trim() && !behavior.ready && !draft.imageFile && !draft.audioBlob) {
      setError("Write a journal entry, answer the behavior questions, record your voice, or add a photo.")
      setStep(draft.audioBlob ? 2 : draft.text.trim() ? 1 : 0)
      return
    }
    if (behavior.partial) {
      setError("Answer all four behavior questions, or clear them to leave behavior out.")
      setStep(1)
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    setError("")
    try {
      const payload = await predict({ ...draft, behaviorReady: behavior.ready })
      const previous = rememberCheckIn(payload)
      setComparison(compareWithPrevious(payload, previous))
      setHistoryVersion((version) => version + 1)
      setResult(payload)
      setResultEditable(true)
      setView("result")
    } catch (reason) {
      setError(reason.message)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  if (!account) {
    return <Login onSignedIn={enter} />
  }

  const needsProfile = !isStaff && (profileGate || !isProfileComplete(account))
  const activeView = needsProfile ? "profile" : view
  const sharedNav = {
    account,
    careUser,
    onHome: goHome,
    onNewCheckIn: isStaff ? undefined : startNewCheckIn,
    onHistory: openHistory,
    onEvaluation: openEvaluation,
    onProfile: isStaff ? undefined : openProfile,
    onSignOut: leave,
    onCareHome: careUser ? openCare : undefined,
    historyCount,
  }

  if (activeView === "admin" && careUser?.role === "admin") {
    return <AdminCare {...sharedNav} />
  }
  if (activeView === "doctor" && careUser?.role === "doctor") {
    return <DoctorCare {...sharedNav} />
  }
  if (activeView === "patient" && careUser?.role === "patient") {
    return <PatientCare {...sharedNav} onCareUserChange={setCareUser} />
  }

  if (activeView === "checkin") {
    return (
      <CheckIn
        draft={draft}
        onChange={updateDraft}
        step={step}
        onStep={setStep}
        account={account}
        careRole={careUser?.role}
        onHome={goHome}
        onNewCheckIn={startNewCheckIn}
        onHistory={openHistory}
        onEvaluation={openEvaluation}
        onProfile={openProfile}
        onSignOut={leave}
        onCare={careUser ? openCare : undefined}
        onSubmit={submit}
        submitting={submitting}
        error={error}
        historyCount={historyCount}
      />
    )
  }

  if (activeView === "result" && result) {
    return (
      <Result
        result={result}
        comparison={comparison}
        canEdit={resultEditable}
        onEdit={
          resultEditable
            ? () => {
                setError("")
                setView("checkin")
              }
            : undefined
        }
        account={account}
        careRole={careUser?.role}
        onHome={goHome}
        onNewCheckIn={startNewCheckIn}
        onHistory={openHistory}
        onEvaluation={openEvaluation}
        onProfile={openProfile}
        onSignOut={leave}
        onCare={careUser ? openCare : undefined}
        historyCount={historyCount}
      />
    )
  }

  if (activeView === "evaluation") {
    return (
      <Evaluation
        account={account}
        onHome={goHome}
        onNewCheckIn={startNewCheckIn}
        onHistory={openHistory}
        onEvaluation={openEvaluation}
        onProfile={openProfile}
        onSignOut={leave}
        historyCount={historyCount}
      />
    )
  }

  if (activeView === "history") {
    return (
      <History
        key={historyVersion}
        account={account}
        onHome={goHome}
        onNewCheckIn={startNewCheckIn}
        onHistory={openHistory}
        onEvaluation={openEvaluation}
        onProfile={openProfile}
        onSignOut={leave}
        historyCount={historyCount}
        onSelectResult={(pastResult) => {
          setResult(pastResult)
          setComparison("")
          setResultEditable(false)
          setView("result")
        }}
      />
    )
  }

  if (activeView === "profile") {
    return (
      <Profile
        account={account}
        required={needsProfile}
        onComplete={finishProfileSetup}
        onHome={goHome}
        onNewCheckIn={startNewCheckIn}
        onHistory={openHistory}
        onEvaluation={openEvaluation}
        onProfile={openProfile}
        onSignOut={leave}
        historyCount={historyCount}
      />
    )
  }

  return (
    <Welcome
      account={account}
      careUser={careUser}
      onStart={startNewCheckIn}
      onHome={goHome}
      onHistory={openHistory}
      onEvaluation={openEvaluation}
      onProfile={openProfile}
      onSignOut={leave}
      onCare={careUser ? openCare : undefined}
      lastCheckIn={historyList[0]}
      historyCount={historyCount}
    />
  )
}
