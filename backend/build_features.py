import json
from pathlib import Path

import joblib
import nltk
import numpy as np
import pandas as pd
import soundfile as sf
from nltk.sentiment import SentimentIntensityAnalyzer
from scipy import sparse

from backend.features_behavior import BEHAVIOR_FEATURES, behavior_matrix
from backend.features_text import fit_tfidf, text_feature_names, text_matrix
from backend.features_voice import VOICE_FEATURES, voice_vector

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "processed" / "dreaddit.csv"
PROCESSED_DIR = ROOT / "data" / "processed"
ARTIFACT_DIR = ROOT / "backend" / "artifacts"
SAMPLE_VOICE = ROOT / "data" / "raw" / "sample_voice.wav"


def ensure_vader():
    nltk.download("vader_lexicon", quiet=True)
    return SentimentIntensityAnalyzer()


def write_sample_voice():
    sample_rate = 16000
    timeline = np.linspace(0, 2.0, sample_rate * 2, endpoint=False)
    tone = 0.2 * np.sin(2 * np.pi * 180 * timeline)
    samples = np.zeros_like(timeline)
    first_phrase = (timeline >= 0.1) & (timeline < 0.7)
    second_phrase = (timeline >= 1.0) & (timeline < 1.7)
    samples[first_phrase] = tone[first_phrase]
    samples[second_phrase] = tone[second_phrase]
    SAMPLE_VOICE.parent.mkdir(parents=True, exist_ok=True)
    sf.write(SAMPLE_VOICE, samples.astype(np.float32), sample_rate)


def print_sample(text_row, text_names, behavior_row, voice_row):
    print("TEXT")
    for name, value in zip(text_names[:4], text_row[:4].toarray().ravel()):
        print(f"  {name} {float(value):.4f}")
    nonzero = text_row[:, 4:].nonzero()
    print(f"  tfidf_columns {text_row.shape[1] - 4}")
    print(f"  tfidf_nonzero {len(nonzero[1])}")
    print("BEHAVIOR")
    for name, value in zip(BEHAVIOR_FEATURES, behavior_row):
        print(f"  {name} {float(value):.4f}")
    print("VOICE")
    for name, value in zip(VOICE_FEATURES, voice_row):
        print(f"  {name} {float(value):.4f}")


def main():
    data = pd.read_csv(DATA_PATH)
    analyzer = ensure_vader()
    train_text = data.loc[data["split"] == "train", "text"].astype(str)
    vectorizer = fit_tfidf(train_text)
    texts = data["text"].astype(str)
    text_features = text_matrix(texts, analyzer, vectorizer)
    behavior = behavior_matrix(data)
    behavior_features = sparse.csr_matrix(behavior)
    combined = sparse.hstack([text_features, behavior_features], format="csr")

    write_sample_voice()
    voice = voice_vector(SAMPLE_VOICE)
    voice_features = sparse.csr_matrix(voice.reshape(1, -1))

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    sparse.save_npz(PROCESSED_DIR / "X_text.npz", text_features)
    sparse.save_npz(PROCESSED_DIR / "X_behavior.npz", behavior_features)
    sparse.save_npz(PROCESSED_DIR / "X_all.npz", combined)
    sparse.save_npz(PROCESSED_DIR / "X_voice_sample.npz", voice_features)
    data[["split", "label"]].to_csv(PROCESSED_DIR / "feature_index.csv", index=False)
    joblib.dump(vectorizer, ARTIFACT_DIR / "tfidf.joblib")

    names = {
        "text": text_feature_names(vectorizer),
        "behavior": BEHAVIOR_FEATURES,
        "voice": VOICE_FEATURES,
    }
    (ARTIFACT_DIR / "feature_names.json").write_text(json.dumps(names), encoding="utf-8")

    print(f"X_text {text_features.shape}")
    print(f"X_behavior {behavior_features.shape}")
    print(f"X_all {combined.shape}")
    print(f"X_voice_sample {voice_features.shape}")
    print_sample(text_features[0], names["text"], behavior[0], voice)


if __name__ == "__main__":
    main()
