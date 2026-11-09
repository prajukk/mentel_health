import { useEffect, useRef, useState } from "react"
import { blobToWav } from "../audio.js"
import Header from "../components/Header.jsx"
import Icon from "../components/Icons.jsx"

const STEPS = [
  { id: "journal", title: "Journal", subtitle: "Writing / Speech", optional: false },
  { id: "behavior", title: "Behavior", subtitle: "Daily Habits", optional: false },
  { id: "voice", title: "Voice", subtitle: "Acoustic Pitch & Pauses", optional: true },
  { id: "image", title: "Photo", subtitle: "Visual Assessment", optional: true },
]
const LIMIT_SECONDS = 20

const BEHAVIOR_QUESTIONS = [
  {
    id: "sleep",
    label: "How did you sleep last night?",
    options: [
      ["well", "About as usual"],
      ["short", "Less than usual"],
      ["poor", "Poorly"],
      ["none", "Almost not at all"],
    ],
  },
  {
    id: "energy",
    label: "How is your energy today?",
    options: [
      ["usual", "About as usual"],
      ["low", "Low"],
      ["very_low", "Very low"],
    ],
  },
  {
    id: "company",
    label: "Did you spend time with other people?",
    options: [
      ["yes", "Yes"],
      ["little", "A little"],
      ["no", "No"],
    ],
  },
  {
    id: "routine",
    label: "Did you keep your usual meals, class, or going out?",
    options: [
      ["yes", "Yes"],
      ["partly", "Partly"],
      ["no", "No"],
    ],
  },
]

function Field({ id, label, children }) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  )
}

const controlClass =
  "w-full rounded-[20px] border border-line bg-card px-4 py-3 text-ink outline-none focus:border-accent"

export default function CheckIn({
  draft,
  onChange,
  step,
  onStep,
  account,
  onHome,
  onNewCheckIn,
  onHistory,
  onEvaluation,
  onProfile,
  onSignOut,
  onSubmit,
  submitting,
  error,
  historyCount = 0,
}) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [recordError, setRecordError] = useState("")
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState("")
  const [speechError, setSpeechError] = useState("")
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState("")
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const cameraStreamRef = useRef(null)
  const videoRef = useRef(null)
  const timerRef = useRef(null)
  const frameRef = useRef(0)
  const audioContextRef = useRef(null)
  const canvasRef = useRef(null)
  const chunksRef = useRef([])
  const recognitionRef = useRef(null)
  const listeningRef = useRef(false)
  const textRef = useRef(draft.text)

  useEffect(() => {
    textRef.current = draft.text
  }, [draft.text])

  function attachImageFile(file) {
    if (!file || !file.type?.startsWith("image/")) return false
    onChange({ imageFile: file, imageUrl: URL.createObjectURL(file) })
    return true
  }

  function stopCamera() {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    cameraStreamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOpen(false)
  }

  async function startCamera() {
    setCameraError("")
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser cannot open the camera. Upload or paste a photo instead.")
      return
    }
    try {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
      cameraStreamRef.current = null
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      cameraStreamRef.current = stream
      setCameraOpen(true)
    } catch {
      setCameraError("Camera permission was blocked or unavailable. Upload or paste a photo instead.")
      stopCamera()
    }
  }

  useEffect(() => {
    if (!cameraOpen || !cameraStreamRef.current || !videoRef.current) return undefined
    const video = videoRef.current
    video.srcObject = cameraStreamRef.current
    video.play?.().catch(() => {})
    return () => {
      video.srcObject = null
    }
  }, [cameraOpen])

  function captureLivePhoto() {
    const video = videoRef.current
    if (!video || !video.videoWidth) {
      setCameraError("Camera is still starting. Try Capture again in a moment.")
      return
    }
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext("2d")
    // Mirror selfie so the saved photo matches the preview.
    context.translate(canvas.width, 0)
    context.scale(-1, 1)
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError("Could not capture the photo. Try again or upload a file.")
          return
        }
        const file = new File([blob], `live-photo-${Date.now()}.jpg`, { type: "image/jpeg" })
        attachImageFile(file)
        stopCamera()
        setCameraError("")
      },
      "image/jpeg",
      0.92,
    )
  }

  useEffect(() => {
    if (step !== 3) {
      stopCamera()
      return undefined
    }
    function onPaste(event) {
      const items = event.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type?.startsWith("image/")) {
          const file = item.getAsFile()
          if (file?.type?.startsWith("image/")) {
            event.preventDefault()
            onChange({ imageFile: file, imageUrl: URL.createObjectURL(file) })
          }
          break
        }
      }
    }
    window.addEventListener("paste", onPaste)
    return () => {
      window.removeEventListener("paste", onPaste)
      stopCamera()
    }
  }, [step, onChange])

  function stopSpeaking() {
    listeningRef.current = false
    recognitionRef.current?.stop()
    setListening(false)
    setInterim("")
  }

  function startSpeaking() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) {
      setSpeechError("This browser cannot take speech. You can type the journal instead.")
      return
    }
    setSpeechError("")
    const recognition = new Recognition()
    recognition.lang = "en-US"
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event) => {
      let spoken = ""
      let heard = ""
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const piece = event.results[index][0].transcript
        if (event.results[index].isFinal) spoken += piece
        else heard += piece
      }
      if (spoken.trim()) {
        const current = textRef.current.trim()
        const next = current ? `${current} ${spoken.trim()}` : spoken.trim()
        textRef.current = next
        onChange({ text: next })
      }
      setInterim(heard.trim())
    }
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setSpeechError("The microphone is unavailable. You can type the journal instead.")
      } else if (event.error !== "aborted" && event.error !== "no-speech") {
        setSpeechError("Speech could not be heard. You can type the journal instead.")
      }
      listeningRef.current = false
      setListening(false)
      setInterim("")
    }
    recognition.onend = () => {
      if (!listeningRef.current) {
        setListening(false)
        setInterim("")
        return
      }
      try {
        recognition.start()
      } catch {
        listeningRef.current = false
        setListening(false)
      }
    }
    recognitionRef.current = recognition
    listeningRef.current = true
    recognition.start()
    setListening(true)
  }

  useEffect(() => {
    if (step !== 0) stopSpeaking()
  }, [step])

  useEffect(
    () => () => {
      window.cancelAnimationFrame(frameRef.current)
      listeningRef.current = false
      recognitionRef.current?.stop()
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
      cameraStreamRef.current = null
    },
    [],
  )

  function releaseStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
  }

  function draw(analyser) {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext("2d")
    const samples = new Uint8Array(analyser.fftSize)
    const paint = () => {
      analyser.getByteTimeDomainData(samples)
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.strokeStyle = "#0E6B67"
      context.lineWidth = 2
      context.beginPath()
      samples.forEach((value, index) => {
        const x = (index / (samples.length - 1)) * canvas.width
        const y = ((value - 128) / 128) * (canvas.height / 2) + canvas.height / 2
        if (index === 0) context.moveTo(x, y)
        else context.lineTo(x, y)
      })
      context.stroke()
      frameRef.current = window.requestAnimationFrame(paint)
    }
    paint()
  }

  async function storeRecording(blob) {
    const wav = await blobToWav(blob)
    const audioUrl = URL.createObjectURL(wav)
    onChange({ audioBlob: wav, audioUrl })
  }

  function stopRecording() {
    window.clearInterval(timerRef.current)
    window.cancelAnimationFrame(frameRef.current)
    const recorder = recorderRef.current
    if (recorder && recorder.state !== "inactive") recorder.stop()
    else releaseStream()
    setRecording(false)
  }

  async function startRecording() {
    setRecordError("")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data)
      }
      recorder.onstop = async () => {
        releaseStream()
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" })
          await storeRecording(blob)
        } catch {
          setRecordError("The recording could not be prepared.")
        }
      }
      recorder.start()
      recorderRef.current = recorder
      const context = new AudioContext()
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)
      audioContextRef.current = context
      draw(analyser)
      setSeconds(0)
      setRecording(true)
      timerRef.current = window.setInterval(() => {
        setSeconds((current) => {
          if (current + 1 >= LIMIT_SECONDS) {
            stopRecording()
            return LIMIT_SECONDS
          }
          return current + 1
        })
      }, 1000)
    } catch {
      setRecordError("The microphone is unavailable. You can upload a recording instead.")
    }
  }

  async function onFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setRecordError("")
    try {
      await storeRecording(file)
      setSeconds(0)
    } catch {
      setRecordError("That audio file could not be read.")
    }
  }

  const wordCount = draft.text.trim() ? draft.text.trim().split(/\s+/).length : 0
  const filledBehavior = [draft.sleep, draft.energy, draft.company, draft.routine].filter(Boolean).length
  const isBehaviorComplete = filledBehavior === 4
  const hasWritingOrBehavior = draft.text.trim().length > 0 || isBehaviorComplete

  // Helper to check if a step is fulfilled
  function isStepCompleted(index) {
    if (index === 0) return Boolean(draft.text.trim())
    if (index === 1) return isBehaviorComplete
    if (index === 2) return Boolean(draft.audioBlob || draft.audioUrl)
    if (index === 3) return Boolean(draft.imageFile || draft.imageUrl)
    return false
  }

  return (
    <section className="page">
      <Header
        currentView="checkin"
        account={account}
        onHome={onHome}
        onNewCheckIn={onNewCheckIn || (() => onStep(0))}
        onHistory={onHistory}
        onEvaluation={onEvaluation}
        onProfile={onProfile}
        onSignOut={onSignOut}
        historyCount={historyCount}
      />

      <div className="mx-auto mt-8 max-w-3xl">
        {/* Breadcrumb Navigation Bar */}
        <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted sm:text-sm">
          <button
            type="button"
            onClick={onHome}
            className="flex items-center gap-1 text-accent transition-colors hover:underline"
          >
            <Icon name="home" className="h-3.5 w-3.5" />
            <span>Home</span>
          </button>
          <Icon name="chevronRight" className="h-3.5 w-3.5 text-muted/60" />
          <span className="text-ink font-medium">New Check-In</span>
          <Icon name="chevronRight" className="h-3.5 w-3.5 text-muted/60" />
          <span className="rounded-full bg-paper px-2.5 py-0.5 font-medium text-ink border border-line">
            Step {step + 1} of 4: {STEPS[step].title}
          </span>
        </nav>

        {/* Interactive Step Stepper Tabs */}
        <div className="rounded-[22px] border border-line bg-card p-3 shadow-xs">
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STEPS.map((s, index) => {
              const active = index === step
              const done = isStepCompleted(index)
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onStep(index)}
                    className={`flex w-full flex-col items-start gap-1 rounded-2xl p-2.5 text-left transition-all sm:p-3 ${
                      active
                        ? "bg-accent text-white shadow-sm"
                        : done
                          ? "bg-paper/70 text-ink hover:bg-paper"
                          : "text-muted hover:bg-paper/40"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
                        <Icon name={s.id} className="h-4 w-4" />
                        Step {index + 1}
                      </span>
                      {done && (
                        <span
                          className={`grid h-4 w-4 place-items-center rounded-full text-[10px] ${
                            active ? "bg-white text-accent" : "bg-low/20 text-low"
                          }`}
                        >
                          ✓
                        </span>
                      )}
                    </div>
                    <span className="font-display text-sm font-semibold sm:text-base leading-tight">
                      {s.title}
                    </span>
                    <span
                      className={`text-[11px] leading-tight ${
                        active ? "text-white/80" : "text-muted"
                      }`}
                    >
                      {s.optional ? "Optional" : "Primary"}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>

        {/* Step Content */}
        <div className="mt-8 rounded-[28px] border border-line bg-card p-6 sm:p-9 shadow-sm">
          {step === 0 && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="eyebrow">Step 1 of 4 · Words & Thoughts</span>
                <span className="rounded-full bg-paper px-3 py-1 text-xs text-muted border border-line">
                  Primary Modality
                </span>
              </div>
              <h1 className="mt-3 flex items-center gap-3 font-display text-3xl sm:text-4xl text-ink">
                <Icon name="journal" className="h-7 w-7 text-accent" />
                Journal Entry
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Write down what is on your mind today, how you are coping, or what has been weighing on you.
                You can type in your thoughts or click <strong>Speak</strong> to transcribe aloud.
              </p>
              <textarea
                value={draft.text}
                onChange={(event) => {
                  textRef.current = event.target.value
                  onChange({ text: event.target.value })
                }}
                placeholder="Write what has been on your mind today..."
                className={`${controlClass} mt-6 min-h-64 resize-y leading-relaxed`}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs sm:text-sm text-muted">
                  {wordCount} words
                  {interim ? ` · Listening: "${interim}"` : ""}
                </p>
                <button
                  type="button"
                  onClick={listening ? stopSpeaking : startSpeaking}
                  aria-pressed={listening}
                  className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                    listening ? "bg-high text-white animate-pulse" : "bg-accent text-white"
                  }`}
                >
                  <Icon name="voice" className="h-4 w-4" />
                  {listening ? "Stop speaking" : "Speak to type"}
                </button>
              </div>
              {speechError && <p className="mt-3 text-xs text-high">{speechError}</p>}
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="eyebrow">Step 2 of 4 · Daily Rhythm</span>
                <span className="rounded-full bg-paper px-3 py-1 text-xs text-muted border border-line">
                  Primary Modality
                </span>
              </div>
              <h1 className="mt-3 flex items-center gap-3 font-display text-3xl sm:text-4xl text-ink">
                <Icon name="behavior" className="h-7 w-7 text-accent" />
                Daily Habits & Behavior
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                These four questions look at sleep, energy, social interaction, and routine.
                Completing all four sets the behavioral screening score.
              </p>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                {BEHAVIOR_QUESTIONS.map((question) => (
                  <Field key={question.id} id={question.id} label={question.label}>
                    <select
                      id={question.id}
                      value={draft[question.id] || ""}
                      onChange={(event) => onChange({ [question.id]: event.target.value })}
                      className={controlClass}
                    >
                      <option value="">Choose an answer...</option>
                      {question.options.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
              {filledBehavior > 0 && filledBehavior < 4 && (
                <div className="mt-4 rounded-xl border border-moderate/30 bg-moderate/10 p-3 text-xs text-moderate">
                  Please answer all 4 questions ({filledBehavior}/4 completed), or clear them to rely on text only.
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="eyebrow">Step 3 of 4 · Audio Acoustics</span>
                <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                  Optional
                </span>
              </div>
              <h1 className="mt-3 flex items-center gap-3 font-display text-3xl sm:text-4xl text-ink">
                <Icon name="voice" className="h-7 w-7 text-accent" />
                Voice Recording
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Acoustic analysis calculates pitch variation and pause ratio. If you did not enter a journal,
                the spoken words here will be transcribed and scored.
              </p>
              <div className="mt-6 rounded-[22px] border border-line bg-paper/50 p-6">
                <canvas ref={canvasRef} width="640" height="72" className="h-16 w-full rounded-xl bg-card border border-line/50" />
                <div className="mt-5 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={recording ? stopRecording : startRecording}
                    className={`flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium text-white shadow-sm ${
                      recording ? "bg-high animate-pulse" : "bg-accent"
                    }`}
                    aria-pressed={recording}
                  >
                    <Icon name="voice" className="h-4 w-4" />
                    {recording ? "Stop recording" : "Record audio (20s)"}
                  </button>
                  <span className="text-xs font-medium text-muted">
                    {String(Math.floor(seconds / 60)).padStart(1, "0")}:
                    {String(seconds % 60).padStart(2, "0")} / 0:20
                  </span>
                  <label className="cursor-pointer text-xs font-medium text-accent hover:underline">
                    Or upload an audio file (.wav, .mp3, .m4a)
                    <input type="file" accept="audio/*" onChange={onFile} className="sr-only" />
                  </label>
                </div>
                {draft.audioUrl && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-ink mb-1">Recording ready:</p>
                    <audio controls src={draft.audioUrl} className="w-full" />
                  </div>
                )}
                {recordError && <p className="mt-3 text-xs text-high">{recordError}</p>}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="eyebrow">Step 4 of 4 · Visual Emotion</span>
                <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                  Optional
                </span>
              </div>
              <h1 className="mt-3 flex items-center gap-3 font-display text-3xl sm:text-4xl text-ink">
                <Icon name="image" className="h-7 w-7 text-accent" />
                Photo Assessment
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Capture a live photo with your camera, or upload / paste (Ctrl+V) one. Gemini reads facial cues and
                brightness. This is purely supplementary and never replaces professional evaluation.
              </p>

              {!cameraOpen ? (
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:opacity-95"
                  >
                    <Icon name="camera" className="h-4 w-4" />
                    Take live photo
                  </button>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-card px-5 py-2.5 text-sm font-medium text-ink hover:border-accent">
                    <Icon name="image" className="h-4 w-4 text-accent" />
                    Upload photo
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        attachImageFile(file)
                        event.target.value = ""
                      }}
                    />
                  </label>
                </div>
              ) : (
                <div className="mt-6 overflow-hidden rounded-[22px] border border-line bg-ink/95">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="aspect-video w-full object-cover"
                    style={{ transform: "scaleX(-1)" }}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-card px-4 py-3">
                    <p className="text-xs text-muted">Position your face in frame, then capture.</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="rounded-full border border-line px-4 py-2 text-xs font-medium text-muted hover:text-ink"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={captureLivePhoto}
                        className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-xs font-medium text-white"
                      >
                        <Icon name="camera" className="h-3.5 w-3.5" />
                        Capture
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <label
                className="mt-4 block cursor-pointer rounded-[22px] border-2 border-dashed border-line bg-paper/50 p-6 text-center transition-colors hover:border-accent"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  const file = event.dataTransfer?.files?.[0]
                  attachImageFile(file)
                }}
              >
                <Icon name="image" className="mx-auto h-7 w-7 text-accent/80" />
                <span className="mt-2 block text-sm font-medium text-ink">Drop or paste a photo here</span>
                <span className="mt-1 block text-xs text-muted">PNG, JPG, or WEBP up to 15MB · Ctrl+V works here</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    attachImageFile(file)
                    event.target.value = ""
                  }}
                />
              </label>

              {cameraError && <p className="mt-3 text-xs text-high">{cameraError}</p>}

              {draft.imageUrl && (
                <div className="mt-4 flex items-center gap-4">
                  <img
                    src={draft.imageUrl}
                    alt="Chosen photo"
                    className="max-h-48 rounded-[18px] border border-line object-cover shadow-xs"
                  />
                  <div>
                    <p className="text-xs font-semibold text-ink">Photo attached</p>
                    <button
                      type="button"
                      onClick={() => {
                        stopCamera()
                        onChange({ imageFile: null, imageUrl: "" })
                      }}
                      className="mt-2 rounded-full border border-line bg-card px-3 py-1 text-xs text-muted hover:text-high"
                    >
                      Remove photo
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Validation or Error Message */}
          {error && (
            <div className="mt-6 rounded-xl border border-high/30 bg-[#FFF5F4] p-3 text-xs text-high">
              {error}
            </div>
          )}

          {/* Bottom Navigation Buttons */}
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line/60 pt-6">
            {/* Left Button: Cancel/Exit on step 0, or Back on subsequent steps */}
            {step === 0 ? (
              <button
                type="button"
                onClick={onHome}
                className="flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-xs sm:text-sm text-muted transition-colors hover:border-line/80 hover:text-ink"
              >
                <Icon name="arrowLeft" className="h-4 w-4" />
                Cancel & return home
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onStep(step - 1)}
                disabled={submitting}
                className="flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-xs sm:text-sm text-ink transition-colors hover:bg-paper disabled:opacity-40"
              >
                <Icon name="arrowLeft" className="h-4 w-4" />
                Previous step
              </button>
            )}

            {/* Right Buttons: Quick Submit shortcut + Next / Finish */}
            <div className="flex flex-wrap items-center gap-3">
              {/* If on step 1 or 2 and core inputs are provided, allow fast finishing */}
              {step > 0 && step < STEPS.length - 1 && hasWritingOrBehavior && (
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={submitting || recording}
                  className="rounded-full border border-accent/40 bg-accent/5 px-4 py-2.5 text-xs sm:text-sm font-medium text-accent hover:bg-accent/10"
                >
                  Skip optional & see result
                </button>
              )}

              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => onStep(step + 1)}
                  className="flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-xs sm:text-sm font-medium text-white shadow-sm transition-transform hover:-translate-y-0.5"
                >
                  <span>Next: {STEPS[step + 1].title}</span>
                  <Icon name="chevronRight" className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={submitting || recording}
                  className="flex items-center gap-2 rounded-full bg-accent px-7 py-3 text-sm font-semibold text-white shadow-md transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Evaluating check-in...
                    </>
                  ) : (
                    <>
                      <span>Complete & see result</span>
                      <Icon name="check" className="h-4 w-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
