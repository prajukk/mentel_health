# Mental Health Disorder Risk Prediction Using Behavioral and Linguistic Features

[![Python 3.13+](https://img.shields.io/badge/Python-3.13+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/React-19.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4.3-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)

An early risk screening web system designed to identify indicators of stress and mental health strain using multi-modal signals: linguistic features, daily routine behaviors, acoustic voice patterns, and visual appearance cues.

> [!IMPORTANT]
> **Medical Disclaimer**: This application is strictly an **early screening flag**, **NOT a clinical diagnosis**. It does not diagnose clinical conditions (such as Major Depressive Disorder or Generalized Anxiety Disorder) nor does it substitute for consultation with a licensed psychologist, psychiatrist, or medical doctor. Users in distress are immediately directed to 24/7 crisis hotlines and local healthcare professionals at [findahelpline.com](https://findahelpline.com/).

---

## Table of Contents

- [Overview & Architecture](#overview--architecture)
- [Input Modalities](#input-modalities)
- [Project Structure](#project-structure)
- [Setup & Installation](#setup--installation)
- [Running the Project](#running-the-project)
- [Model Training & Experiments](#model-training--experiments)
- [API Documentation](#api-documentation)
- [Crisis Detection & Safety Protocol](#crisis-detection--safety-protocol)
- [Testing](#testing)

---

## Overview & Architecture

The system combines classical natural language processing and machine learning models with external AI APIs (Google Gemini and Cartesia Speech) to provide a private, multi-angle check-in experience:

```
[User Input: Text, Daily Behavior, Audio Recording, Photo]
                    │
                    ▼
           ┌─────────────────┐
           │  FastAPI Server │
           └────────┬────────┘
                    │
    ┌───────────────┼───────────────┬────────────────┐
    ▼               ▼               ▼                ▼
[Text Features] [Behavior]     [Voice Features] [Visual Features]
 - TF-IDF 3000   - Sleep,       - Librosa pYIN   - Gemini Vision
 - VADER Compound  Energy,       - Pause Ratio    - Appearance
 - Pronoun Ratio   Social,      - Jitter, Loudness (sad/low/steady)
 - Word count      Routine      - 13 MFCCs       - OCR text
    │               │               │                │
    └───────────────┼───────────────┴────────────────┘
                    ▼
          ┌───────────────────┐
          │ ML Classifier /   │
          │ Heuristic Screen  │
          └─────────┬─────────┘
                    │
                    ▼
   [Crisis Check & Gemini Summary]
                    │
                    ▼
   [React Dashboard & Visualizations]
```

### Risk Stratification Bands

| Model Probability / Score | Risk Flag | Recommended Next Step |
| :--- | :--- | :--- |
| **< 0.40** | **Low** | Keep note of what felt steady; revisit if feelings shift. |
| **0.40 – 0.70** | **Moderate** | Consider speaking with a counsellor about ongoing burdens. |
| **> 0.70** | **High** | Talk with a healthcare professional or counsellor promptly. |

---

## Input Modalities

1. **Journal (Linguistic)**:
   - Written thoughts or speech transcribed directly in-browser using the Web Speech API.
   - Extracts 4 handcrafted linguistic features (VADER compound polarity, 1st-person pronoun ratio `[i, me, my, mine, myself]`, type-token lexical diversity, word count) + 3,000 TF-IDF n-grams.
2. **Behavior (Daily Routine)**:
   - Assesses sleep quality, daily energy levels, social interaction, and adherence to routine (0–8 point scale).
   - In benchmark experiments, also models social platform metadata (`hour`, `social_karma`, `social_upvote_ratio`, `social_num_comments`).
3. **Voice (Acoustics & Cartesia STT)**:
   - In-browser microphone recording with real-time HTML5 Canvas waveform oscilloscope.
   - Converts audio to 16-bit PCM WAV in-memory.
   - Extracts fundamental frequency pitch via `librosa.pyin`, period jitter, speech-to-pause ratio, and 13 MFCCs.
   - Transcribes audio via Cartesia's `ink-whisper` STT model as a fallback if the journal is blank.
4. **Image (Visual Appearance & OCR)**:
   - Uploads a photo analyzed via Gemini 2.5 Flash Vision.
   - Categorizes appearance into `sad`, `low`, `steady`, or `unclear`.
   - Transcribes handwritten notes or text if visible in the photo.
5. **Crisis Intervention & LLM Explanation**:
   - Detects severe self-harm / suicidal ideation keywords and elevates the flag immediately with 24/7 hotline numbers.
   - Uses Gemini to generate a two-sentence, non-diagnostic synthesis of observed cues.

---

## Project Structure

```
mentel_health/
├── .env.example               # Environment template for API keys
├── .gitignore                 # Git ignore rules
├── README.md                  # Comprehensive documentation
├── requirements.txt           # Python dependencies
├── backend/
│   ├── app.py                 # FastAPI application endpoints
│   ├── build_features.py      # Feature extraction pipeline (.npz exporter)
│   ├── external_apis.py       # Gemini Vision/STT & Cartesia integration
│   ├── features_behavior.py   # Behavior feature matrix extractor
│   ├── features_image.py      # Image metadata & brightness parser
│   ├── features_text.py       # TF-IDF & linguistic feature extractors
│   ├── features_voice.py      # Librosa acoustic feature extractor (pYIN)
│   ├── key_pool.py            # Fault-tolerant round-robin API key pool
│   ├── missing_experiments.py # Missing-data imputation experiment suite
│   ├── predict.py             # Inference engine & scoring router
│   ├── prepare_data.py        # Dreaddit dataset ingestion & cleaning
│   ├── train.py               # Classifier model training pipeline
│   └── artifacts/             # Serialized joblib models & feature names
├── data/
│   ├── raw/                   # Raw train/val/test CSVs & sample audio
│   └── processed/             # Cleaned Dreaddit CSV & sparse feature matrices
├── frontend/
│   ├── package.json           # Node dependencies
│   ├── vite.config.js         # Vite configuration with /api proxy to FastAPI
│   └── src/
│       ├── api.js             # Fetch wrapper for /api/predict & /api/metrics
│       ├── audio.js           # Float32 to 16-bit PCM WAV encoder
│       ├── auth.js            # Client-side salted SHA-256 session management
│       ├── history.js         # Check-in localStorage persistence & comparison
│       ├── components/        # Header, Icons, and SVG Visualizers (Gauge, Radar)
│       └── screens/           # Welcome, Login, CheckIn, Result, History, Evaluation
├── reports/
│   ├── experiment1.csv        # Baseline model comparison results
│   ├── experiment2.csv        # Missing-modality benchmark results
│   ├── experiment3_f1.png     # F1 degradation curve plot
│   └── project_report.md      # Detailed academic project report
└── tests/
    ├── test_screening.py      # 24 Python unittest test cases
    └── wav.test.mjs           # Node.js WAV encoding unit test
```

---

## Setup & Installation

### Prerequisites

- **Python 3.10+** (Python 3.13 recommended)
- **Node.js 18+** and **npm**
- (Optional) Google Gemini API Key(s) & Cartesia API Key(s)

### 1. Backend Setup

From the `mentel_health` directory:

```bash
# Create and activate virtual environment
python -m venv .venv

# Windows:
.\.venv\Scripts\activate

# Linux / macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Environment Configuration

Create a `.env` file in the `mentel_health` directory (or copy from `.env.example`):

```ini
GEMINI_API_KEY_1=your_gemini_api_key
GEMINI_API_KEY_2=
GEMINI_API_KEY_3=
GEMINI_API_KEY_4=

CARTESIA_API_KEY_1=your_cartesia_api_key
CARTESIA_API_KEY_2=
CARTESIA_API_KEY_3=
CARTESIA_API_KEY_4=

GEMINI_MODEL=gemini-2.5-flash
CARTESIA_VERSION=2026-08-14
```

> **Note**: Both Gemini and Cartesia are optional. If no keys are provided, the system still runs local machine learning inference and rule-based screening smoothly without failing.

### 3. Frontend Setup

From the `mentel_health/frontend` directory:

```bash
npm install
```

---

## Running the Project

### 1. Start Backend API Server

From `mentel_health` with your virtual environment activated:

```bash
uvicorn backend.app:app --host 127.0.0.1 --port 8000 --reload
```
The FastAPI backend will start at `http://127.0.0.1:8000`. You can inspect the interactive documentation at `http://127.0.0.1:8000/docs`.

### 2. Start Frontend Dev Server

From `mentel_health/frontend`:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```
Open your browser and navigate to `http://127.0.0.1:5173`.

---

## Model Training & Experiments

The project includes reproducible scripts to re-create all processed matrices, train classifiers, and regenerate experiment benchmarks:

```bash
# 1. Clean and split Dreaddit raw data
python -m backend.prepare_data

# 2. Extract TF-IDF, linguistic, and behavioral feature matrices
python -m backend.build_features

# 3. Train models and generate Experiment 1 metrics
python -m backend.train

# 4. Run missing-data ablation study and plot Experiment 2 & 3 charts
python -m backend.missing_experiments
```

### Experiment Benchmark Summary

| Feature Modality | Selected Model | Test Accuracy | Test Precision | Test Recall | Test F1 | Test ROC-AUC |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Text Only** | Random Forest | 0.7524 | 0.7275 | 0.8320 | **0.7762** | 0.8322 |
| **Behavior Only** | Linear SVM | 0.5734 | 0.5552 | 0.8726 | **0.6786** | 0.5998 |
| **Both (Text + Behavior)** | Random Forest | 0.7552 | 0.7321 | 0.8293 | **0.7776** | 0.8326 |

---

## API Documentation

### `GET /health`
Returns system status and active API key count in rotation pools.
```json
{
  "status": "ok",
  "gemini_keys": 4,
  "cartesia_keys": 4
}
```

### `GET /metrics`
Returns benchmark evaluation metrics for Experiment 1 (feature comparison) and Experiment 2 (missingness conditions).

### `POST /predict`
Multipart form endpoint supporting:
- `text` (string): Journal entry.
- `sleep`, `energy`, `company`, `routine` (strings): Daily lifestyle answers.
- `audio` (UploadFile): WAV/MP3/M4A voice sample (max 15MB).
- `image` (UploadFile): PNG/JPG photo (max 15MB).
- `hour`, `karma`, `upvote_ratio`, `comment_count` (optional floats): Social platform metadata.

---

## Crisis Detection & Safety Protocol

If the text contains expressions of self-harm or suicidal intent, the system triggers an immediate safety protocol:
- Flags `crisis_detected: true`.
- Automatically raises the risk banner to **High**.
- Surfaces 24/7 direct-dial and online support helplines:
  - **India**: Tele-MANAS (`14416` / `1800-891-4416`) & KIRAN (`1800-599-0019`)
  - **US & Canada**: Suicide & Crisis Lifeline (`988`)
  - **United Kingdom**: Samaritans (`116 123`)
  - **International**: [findahelpline.com](https://findahelpline.com/)

---

## Testing

Run the full Python test suite (24 tests):
```bash
python -m unittest tests.test_screening -v
```

Run client-side WAV encoding tests:
```bash
node tests/wav.test.mjs
```

Build production frontend bundle:
```bash
cd frontend && npm run build
```
