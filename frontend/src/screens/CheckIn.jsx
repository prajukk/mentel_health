import { useEffect, useRef, useState } from "react"
import { blobToWav } from "../audio.js"
import Header from "../components/Header.jsx"
import Icon from "../components/Icons.jsx"

const STEPS = [
  ["journal", "Journal"],
  ["behavior", "Behavior"],
  ["voice", "Voice"],
  ["image", "Image"],
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
      <span className="text-sm text-muted">{label}</span>
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
  onHistory,
  onEvaluation,
  onSignOut,
  onSubmit,
  submitting,
  error,
}) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [recordError, setRecordError] = useState("")
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState("")
  const [speechError, setSpeechError] = useState("")
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
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

  return (
    <section className="page">
      <Header account={account} onHome={onHome} onHistory={onHistory} onEvaluation={onEvaluation} onSignOut={onSignOut} />
      <div className="mx-auto mt-12 max-w-3xl">
        <ol className="flex flex-wrap gap-3">
          {STEPS.map(([icon, label], index) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => onStep(index)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm ${
                  index === step ? "bg-accent text-white" : index < step ? "border border-accent/30 text-accent" : "border border-line text-muted"
                }`}
              >
                <Icon name={icon} className="h-4 w-4" />
                {label}
              </button>
            </li>
          ))}
        </ol>

        <div className="mt-10">
          {step === 0 && (
            <div>
              <h1 className="flex items-center gap-3 font-display text-4xl text-ink">
                <Icon name="journal" className="h-8 w-8 text-accent" />
                Journal
              </h1>
              <p className="mt-3 max-w-lg text-muted">
                This is the writing. The behavior step sets the main result when you answer it. Type here, or press Speak.
              </p>
              <textarea
                value={draft.text}
                onChange={(event) => onChange({ text: event.target.value })}
                placeholder="Write what has been on your mind."
                className={`${controlClass} mt-8 min-h-80 resize-y leading-relaxed`}
              />
              <div className="mt-3 flex items-center justify-between gap-4">
                <p className="text-sm text-muted">
                  {wordCount} words
                  {interim ? ` · ${interim}` : ""}
                </p>
                <button
                  type="button"
                  onClick={listening ? stopSpeaking : startSpeaking}
                  aria-pressed={listening}
                  className="rounded-full bg-accent px-5 py-2 text-sm text-white"
                >
                  {listening ? "Stop speaking" : "Speak"}
                </button>
              </div>
              {speechError && <p className="mt-3 text-sm text-high">{speechError}</p>}
            </div>
          )}

          {step === 1 && (
            <div>
              <h1 className="flex items-center gap-3 font-display text-4xl text-ink">
                <Icon name="behavior" className="h-8 w-8 text-accent" />
                Behavior
              </h1>
              <p className="mt-3 max-w-lg text-muted">
                This is how the day went: sleep, energy, time with other people, and your usual routine.
                These answers set the main result. Answer all four, or leave them empty to use the writing only.
              </p>
              <div className="mt-8 grid gap-5">
                {BEHAVIOR_QUESTIONS.map((question) => (
                  <Field key={question.id} id={question.id} label={question.label}>
                    <select
                      id={question.id}
                      value={draft[question.id] || ""}
                      onChange={(event) => onChange({ [question.id]: event.target.value })}
                      className={controlClass}
                    >
                      <option value="">Choose one</option>
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
                <p className="mt-4 text-sm text-moderate">
                  Answer the remaining behavior questions, or clear them to leave behavior out.
                </p>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 className="flex items-center gap-3 font-display text-4xl text-ink">
                <Icon name="voice" className="h-8 w-8 text-accent" />
                Voice
              </h1>
              <p className="mt-3 max-w-lg leading-relaxed text-muted">
                This is the sound of your voice. Pitch and pauses are shown on the result. They do not
                change the behavior result. If the journal is empty, the words heard here are scored as writing.
              </p>
              <div className="mt-8 rounded-[20px] border border-line bg-card p-6">
                <canvas ref={canvasRef} width="640" height="72" className="h-16 w-full" />
                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={recording ? stopRecording : startRecording}
                    className="rounded-full bg-accent px-6 py-3 text-white"
                    aria-pressed={recording}
                  >
                    {recording ? "Stop" : "Record"}
                  </button>
                  <span className="text-sm text-muted">
                    {String(Math.floor(seconds / 60)).padStart(1, "0")}:
                    {String(seconds % 60).padStart(2, "0")} / 0:20
                  </span>
                  <label className="cursor-pointer text-sm text-accent">
                    Upload a recording instead
                    <input type="file" accept="audio/*" onChange={onFile} className="sr-only" />
                  </label>
                </div>
                {draft.audioUrl && (
                  <audio controls src={draft.audioUrl} className="mt-5 w-full" />
                )}
                {recordError && <p className="mt-4 text-sm text-high">{recordError}</p>}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h1 className="flex items-center gap-3 font-display text-4xl text-ink">
                <Icon name="image" className="h-8 w-8 text-accent" />
                Image
              </h1>
              <p className="mt-3 max-w-lg leading-relaxed text-muted">
                Upload a photo of yourself. Gemini reads whether the person looks sad, low, or steady,
                and that look can raise the result. It is an appearance reading, not a diagnosis.
              </p>
              <label className="mt-8 block cursor-pointer rounded-[20px] border border-line bg-card p-6 text-accent">
                Choose a photo
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (!file) return
                    onChange({ imageFile: file, imageUrl: URL.createObjectURL(file) })
                  }}
                />
              </label>
              {draft.imageUrl && (
                <img src={draft.imageUrl} alt="Chosen photo" className="mt-5 max-h-64 rounded-[20px] border border-line" />
              )}
            </div>
          )}

          {error && <p className="mt-6 text-sm text-high">{error}</p>}

          <div className="mt-10 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onStep(step - 1)}
              disabled={step === 0 || submitting}
              className="rounded-full border border-line px-6 py-3 disabled:opacity-40"
            >
              Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => onStep(step + 1)}
                className="rounded-full bg-accent px-6 py-3 text-white"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={onSubmit}
                disabled={submitting || recording}
                className="rounded-full bg-accent px-6 py-3 text-white disabled:opacity-50"
              >
                {submitting ? "Scoring" : "See result"}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
