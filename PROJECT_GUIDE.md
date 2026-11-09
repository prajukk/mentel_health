# Mental Health Risk Check — Complete Project Guide

A from-scratch explanation of the whole system: what it is, how data flows, which models are used, how to run it, and how to manually test every screen.

> **Disclaimer:** This app is an **early screening flag only**. It is **not** a medical diagnosis and does not replace a counsellor, psychologist, or doctor. Crisis cues surface 24/7 helplines (e.g. Tele-MANAS / KIRAN in India, 988 in the US/Canada, [findahelpline.com](https://findahelpline.com/)).

---

## Table of contents

1. [What this project is](#1-what-this-project-is)
2. [Tech stack](#2-tech-stack)
3. [Folder map](#3-folder-map)
4. [Setup from scratch](#4-setup-from-scratch)
5. [How to run](#5-how-to-run)
6. [End-to-end user flow](#6-end-to-end-user-flow)
7. [Data & feature pipeline](#7-data--feature-pipeline)
8. [Models used](#8-models-used)
9. [Scoring & multimodal screen](#9-scoring--multimodal-screen)
10. [External AI services](#10-external-ai-services)
11. [API reference](#11-api-reference)
12. [Frontend screens](#12-frontend-screens)
13. [Manual test checklist](#13-manual-test-checklist)
14. [Automated tests](#14-automated-tests)
15. [Retraining experiments](#15-retraining-experiments)
16. [Common issues](#16-common-issues)

---

## 1. What this project is

**Mental Health Risk Check** is a web app that takes a short multimodal check-in and returns a **low / moderate / high** screening band.

Users can provide any combination of:

| Modality | What the user does | What the system uses |
|---|---|---|
| **Journal (writing)** | Types or uses “Speak to type” | TF-IDF + linguistic features → ML model |
| **Behavior** | Answers 4 daily habit questions | 0–8 point heuristic (sleep, energy, company, routine) |
| **Voice** | Records or uploads audio | Pitch, pauses, jitter (librosa); transcript if journal empty |
| **Photo** | Upload, paste, or **live camera** | Gemini Vision appearance (`sad` / `low` / `steady` / `unclear`) |

The **shown result** is the **highest** band among the modalities that were provided (behavior, writing, voice acoustics, photo). Wellness tip text can come from Gemini; spoken tip audio from Cartesia (with browser speech fallback).

**Auth & privacy (browser only):**

- Sign up / sign in with Gmail + password (salted SHA-256 in `localStorage`)
- Profile (name, emergency contact) stored locally; required once before check-in
- Check-in history stored in `localStorage` (heavy audio stripped to avoid quota errors)

---

## 2. Tech stack

| Layer | Tools |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4 |
| Backend | Python, FastAPI, Uvicorn |
| ML | scikit-learn (Random Forest, Linear SVM, Logistic Regression), joblib |
| Text features | TF-IDF (3000), VADER polarity, pronoun ratio, type-token ratio, word count |
| Voice features | librosa (pYIN pitch, jitter, pause ratio, MFCCs) |
| Vision / tips | Google Gemini (`gemini-2.5-flash` by default) |
| Speech | Cartesia (STT + TTS); browser Web Speech as fallback |
| Dataset | Dreaddit (Reddit stress posts) → train / validation / test splits |

---

## 3. Folder map

```
mentel_health/
├── PROJECT_GUIDE.md          ← this file
├── README.md
├── requirements.txt
├── .env / .env.example
├── backend/
│   ├── app.py                # FastAPI routes: /, /health, /metrics, /predict, /tts
│   ├── predict.py            # Inference + multimodal screen_flag
│   ├── train.py              # Train classifiers → artifacts + experiment1.csv
│   ├── prepare_data.py       # Clean Dreaddit CSVs
│   ├── build_features.py     # Build sparse feature matrices
│   ├── missing_experiments.py
│   ├── features_text.py
│   ├── features_behavior.py
│   ├── features_voice.py
│   ├── features_image.py
│   ├── external_apis.py      # Gemini + Cartesia
│   ├── key_pool.py           # Round-robin API keys
│   └── artifacts/            # Saved models (.joblib), feature names, selection JSON
├── data/
│   ├── raw/                  # train / validation / test CSVs, sample_voice.wav
│   └── processed/            # dreaddit.csv, X_text.npz, X_behavior.npz, X_all.npz
├── frontend/
│   ├── vite.config.js        # Proxies /api → http://127.0.0.1:8000
│   └── src/
│       ├── App.jsx           # View router
│       ├── api.js            # predict + metrics + tts
│       ├── auth.js           # Accounts / session / profile
│       ├── history.js        # Saved check-ins + trajectory
│       ├── audio.js          # Blob → WAV
│       ├── screens/          # Welcome, Login, Profile, CheckIn, Result, History, Evaluation
│       └── components/       # Header, Icons, ResultCharts
├── reports/
│   ├── experiment1.csv
│   ├── experiment2.csv
│   ├── experiment3_f1.png
│   └── project_report.md
└── tests/
    ├── test_screening.py
    └── wav.test.mjs
```

---

## 4. Setup from scratch

### Prerequisites

- Python **3.10+** (3.13 fine)
- Node.js **18+** and npm
- Optional: Gemini and/or Cartesia API keys (app still runs without them)

### Backend

```bash
cd mentel_health
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### Environment file

Copy `.env.example` → `.env` in `mentel_health/`:

```ini
GEMINI_API_KEY_1=your_key_here
GEMINI_API_KEY_2=
GEMINI_API_KEY_3=
GEMINI_API_KEY_4=

CARTESIA_API_KEY_1=your_key_here
CARTESIA_API_KEY_2=
CARTESIA_API_KEY_3=
CARTESIA_API_KEY_4=

GEMINI_MODEL=gemini-2.5-flash
CARTESIA_VERSION=2026-08-14
```

Empty keys are OK: ML scoring and daily behavior still work; photo look / Gemini tip / Cartesia voice degrade gracefully.

### Frontend

```bash
cd mentel_health/frontend
npm install
```

---

## 5. How to run

Open **two terminals**.

**Terminal 1 — API (port 8000):**

```bash
cd mentel_health
.\.venv\Scripts\activate
uvicorn backend.app:app --host 127.0.0.1 --port 8000 --reload
```

- Root: http://127.0.0.1:8000/
- Docs: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/health

**Terminal 2 — UI (port 5173):**

```bash
cd mentel_health/frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

Open: **http://127.0.0.1:5173**

Vite proxies `/api/*` → `http://127.0.0.1:8000/*` (so the browser calls `/api/predict`, backend sees `/predict`).

---

## 6. End-to-end user flow

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Login /   │────▶│   Profile   │────▶│   Welcome    │
│  Create     │     │ (once)      │     │   Home       │
└─────────────┘     └─────────────┘     └──────┬───────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    ▼                          ▼                          ▼
              New check-in               History                   Evaluation
                    │
        ┌───────────┼───────────┬────────────┐
        ▼           ▼           ▼            ▼
   1 Journal   2 Behavior   3 Voice     4 Photo
   (type /     (4 Qs)       (optional   (upload /
    speak)                   record)     paste / live cam)
        │           │           │            │
        └───────────┴───────────┴────────────┘
                            │
                            ▼
                    POST /api/predict
                            │
                            ▼
                     Result dashboard
                   (level + parts chips
                    + tip + history save)
```

**Step-by-step:**

1. Create account with Gmail + password (eye toggle shows/hides password).
2. Fill Profile once (name / contact fields as required by the form).
3. From Home → **New check-in**.
4. Complete steps (journal and/or behavior strongly recommended; voice & photo optional).
5. Submit → Result shows combined screen level, modality chips, charts, wellness tip.
6. Result is saved to History; **Score over time** chart updates when 2+ entries exist.
7. Evaluation page loads Experiment 1–3 metrics from `/api/metrics`.

---

## 7. Data & feature pipeline

### Training data

- Source: **Dreaddit** Reddit posts labeled for stress.
- Scripts:
  1. `python -m backend.prepare_data` → cleaned `data/processed/dreaddit.csv`
  2. `python -m backend.build_features` → `X_text.npz`, `X_behavior.npz`, `X_all.npz`
  3. `python -m backend.train` → models in `backend/artifacts/` + `reports/experiment1.csv`
  4. `python -m backend.missing_experiments` → `experiment2.csv` + `experiment3_f1.png`

### Text features (live + train)

- TF-IDF bag of up to **3000** n-grams
- Handcrafted: VADER compound, 1st-person pronoun ratio, type-token ratio, word count

### Behavior features

- **App (daily check-in):** four answers scored 0–8 → low / moderate / high  
  - Rough bands: low ≤ 2, moderate ≤ 4, else high (see `daily_level` in `predict.py`)
- **Training / experiments:** social metadata columns (`hour`, karma, upvote ratio, comment count)

### Voice features (live)

- Pitch mean (pYIN), pause ratio, pause count, jitter, loudness, MFCCs
- Soft **voice screen level** can raise the combined flag (calm voice does not lower it)

### Photo features (live)

- Gemini appearance → `sad` / `low` / `steady` / `unclear` (+ optional OCR writing)

---

## 8. Models used

### Classical ML (saved & used at inference)

Trained with scikit-learn; selection stored in `backend/artifacts/model_selection.json`.

| Input route | Saved model | Test F1 (approx.) | Artifact |
|---|---|---|---|
| **Text only** | **Random Forest** (200 trees) | **0.776** | `model_text.joblib` |
| **Behavior only** (social meta in train; app uses daily heuristic for UI) | **Linear SVM** | **0.679** | `model_behavior.joblib` |
| **Text + behavior** | **Random Forest** | **0.778** | `model_both.joblib` |

Also **benchmarked** (not always the saved winner):

- Logistic Regression
- Linear SVM
- Random Forest  

on each of: text / behavior / both → see Evaluation page and `reports/experiment1.csv`.

**Risk bands from model probability:**

| Probability | Level |
|---|---|
| &lt; 0.40 | low |
| 0.40 – 0.70 | moderate |
| &gt; 0.70 | high |

### External / non-sklearn models

| Purpose | Model / service |
|---|---|
| Photo look + tip writing | **Gemini** (`GEMINI_MODEL`, default `gemini-2.5-flash`) |
| Voice transcription (empty journal) | **Cartesia** STT (`ink-whisper`) |
| Wellness tip speech | **Cartesia** TTS (Sonic); fallback Web Speech API |
| In-browser dictate | Web Speech API (`SpeechRecognition`) |

### Heuristics (no ML weights)

- Daily behavior 0–8 → level
- `voice_screen_level` from pause / jitter thresholds
- Crisis keyword detection → force high + helplines
- `screen_flag` = **max** of available modality levels

---

## 9. Scoring & multimodal screen

Core idea in `backend/predict.py` → `screen_flag(...)`:

```
shown_level = max(behavior, writing, voice, photo)
```

Result UI shows **parts chips** (e.g. `behavior: moderate`, `writing: high`, `voice: high`, `photo: low`) so the user sees which signal drove the headline.

Examples:

- Distressed journal + mild behavior → headline can still be **high** (writing wins).
- Calm journal + high pause voice → voice can raise the band.
- Sad photo + low behavior → photo can raise the band.
- Gemini credits depleted → photo saved but look analysis unavailable; journal/behavior still score.

---

## 10. External AI services

| Service | Used for | If unavailable |
|---|---|---|
| Gemini | Appearance, tip text, short explanation | Fallback tip text; photo “unavailable” message |
| Cartesia | Tip audio TTS; STT when journal empty | No tip audio / use browser speech; journal typing still works |

Keys rotate via `key_pool.py` (multiple `GEMINI_API_KEY_*` / `CARTESIA_API_KEY_*`).

---

## 11. API reference

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Service info |
| GET | `/health` | Status + key counts |
| GET | `/metrics` | Experiment 1 & 2 tables for Evaluation UI |
| POST | `/predict` | Multipart: `text`, `sleep`, `energy`, `company`, `routine`, `audio`, `image`, optional social fields |
| POST | `/tts` | Text → WAV (Cartesia) |

Frontend calls them as `/api/...` through the Vite proxy.

---

## 12. Frontend screens

| Screen | Role |
|---|---|
| **Login** | Create account / sign in (Gmail + password) |
| **Profile** | One-time gate + editable profile / emergency contact |
| **Welcome** | Home hub: new check-in, history, evaluation |
| **CheckIn** | 4 steps: Journal → Behavior → Voice → Photo (live camera supported) |
| **Result** | Level, parts chips, charts, tip + audio, crisis banner if needed |
| **History** | Past check-ins + labeled **Score over time** chart |
| **Evaluation** | Experiment 1 bars, Experiment 2 table, Experiment 3 line |

---

## 13. Manual test checklist

Use this after both servers are running. Mark each item as you go.

### A. Smoke / health

- [ ] Open http://127.0.0.1:8000/ → JSON with `"status": "ok"`
- [ ] Open http://127.0.0.1:8000/health → `gemini_keys` / `cartesia_keys` look right
- [ ] Open http://127.0.0.1:5173 → Login or Welcome loads (no blank page)

### B. Auth & profile

- [ ] Create account with a Gmail-like address + password ≥ 4 chars
- [ ] Password eye toggle shows/hides password
- [ ] Wrong password shows clear error
- [ ] First login forces Profile before check-in
- [ ] Save profile → Welcome appears
- [ ] Sign out → Sign in again → session restored; profile not forced again if already saved

### C. Check-in — Journal

- [ ] Type sample text: `I feel anxious and I cannot sleep. I worry about everything in my life.`
- [ ] Word count updates
- [ ] “Speak to type” starts (Chrome); stop works; text appends
- [ ] Next → Behavior works without requiring voice/photo

### D. Check-in — Behavior

- [ ] Answer all four questions → can proceed
- [ ] Answer only some → submit blocked with clear error (or must clear all)
- [ ] Leave all empty and submit with journal only → allowed

### E. Check-in — Voice (optional)

- [ ] Record ≤ 20s → waveform moves → recording ready audio plays
- [ ] Upload a `.wav` / `.mp3` → attaches
- [ ] Voice-only submit (empty journal) → transcript or acoustics still produce a result

### F. Check-in — Photo (optional)

- [ ] Upload PNG/JPG
- [ ] Paste image with Ctrl+V on step 4
- [ ] **Take live photo** → allow camera → Capture → thumbnail “Photo attached”
- [ ] Remove photo clears attachment
- [ ] If Gemini has no credits: Result says photo saved / look analysis unavailable (no crash)

### G. Result

- [ ] Headline is low / moderate / high
- [ ] Modality **parts chips** appear when multiple inputs used
- [ ] Distressed journal + mild behavior → headline can be **high** (not stuck moderate)
- [ ] Wellness tip text appears (Gemini or fallback)
- [ ] Tip audio plays if Cartesia works; otherwise page still usable
- [ ] Header contrast readable on cream background
- [ ] Crisis-like wording (do **not** use real crisis text in demos unless testing intentionally) elevates safety UI

### H. History

- [ ] New result appears in list
- [ ] Expand entry shows modalities
- [ ] With 2+ entries, **Score over time** shows dates + scores (no overlapping “Higher” label)
- [ ] Clear history works after confirm

### I. Evaluation

- [ ] Experiment 1: Text RF ~0.776, Behavior SVM ~0.679, Both RF ~0.778 (outlined = saved)
- [ ] Experiment 2 table: 7 rows; text missing F1 drop ~0.099
- [ ] Experiment 3 line: 0.775 → 0.773 → 0.773 → 0.770
- [ ] Buttons: Take a check-in / View history / Return to Home

### J. Navigation / polish

- [ ] Header: Home, New check-in, History (count), Evaluation, Profile, Sign out
- [ ] “New check-in” resets draft (doesn’t keep old journal/photo)
- [ ] Cancel on step 1 returns home
- [ ] Mobile-ish narrow window: steps and buttons still usable

### Suggested demo script (happy path)

1. Sign in → New check-in  
2. Journal: anxious sleep sample above  
3. Behavior: mixed answers (e.g. short sleep, low energy, little company, partly routine)  
4. Optional short voice recording  
5. Optional live selfie  
6. Complete → confirm chips + combined level  
7. Open History → see trajectory  
8. Open Evaluation → confirm benchmark numbers  

---

## 14. Automated tests

```bash
cd mentel_health
.\.venv\Scripts\activate

# Full screening / API / experiment suite
python -m unittest tests.test_screening -v

# WAV helper (Node)
node tests/wav.test.mjs
```

Important cases covered include:

- Journal / behavior / combined routes  
- Distressed journal raising moderate behavior screen  
- Voice + behavior combine on screen  
- Photo appearance raising screen  
- Experiment CSV metrics  
- Cartesia unavailable still returns a score  

---

## 15. Retraining experiments

Only needed if you change features or want fresh reports:

```bash
python -m backend.prepare_data
python -m backend.build_features
python -m backend.train
python -m backend.missing_experiments
```

Then restart the API and refresh Evaluation.

**Experiment meanings:**

1. **Experiment 1** — Which classifier wins for text / behavior / both  
2. **Experiment 2** — What happens when text or behavior is missing, or behavior fields are hidden  
3. **Experiment 3** — F1 curve as more behavior fields are hidden (journal still present)

---

## 16. Common issues

| Symptom | Likely cause | Fix |
|---|---|---|
| Frontend loads, predict fails | API not running | Start uvicorn on 8000 |
| `/api/metrics` 404 in browser | Proxy / wrong port | Use Vite 5173, not raw 8000 for UI |
| Photo “look analysis unavailable” | Gemini billing / keys | Add valid keys or continue without photo look |
| No tip audio | Cartesia missing / error | Tip text still shows; browser speech may play |
| History fails to save | localStorage quota | App strips heavy audio; clear old history |
| Camera button does nothing | Permission denied | Allow camera; or upload/paste instead |
| Blank Evaluation | `/metrics` failed | Confirm `reports/experiment1.csv` & `experiment2.csv` exist |

---

## Quick mental model (one paragraph)

You collect **words, habits, voice, and a face photo**. Classical **sklearn** models score writing (and optional social behavior features); daily habits use a **simple points scale**; voice pauses and photo look can **raise** the flag. The UI shows the **highest** of those bands, saves the visit in the browser, and optionally speaks a short wellness tip. Nothing here diagnoses a disorder — it is a structured early check-in with transparent modality parts.

---

*Generated for the `mentel_health` codebase. Keep this file next to `README.md` when presenting or defending the project.*
