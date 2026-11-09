import json
from functools import lru_cache
from pathlib import Path
import re

import joblib
import nltk
import numpy as np
from nltk.sentiment import SentimentIntensityAnalyzer
from scipy import sparse

from backend.external_apis import (
    compose_wellness_with_cartesia,
    explain,
    read_appearance,
    read_writing,
    transcribe,
)
from backend.features_image import extract_image
from backend.features_text import text_matrix
from backend.features_voice import extract_voice

ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_DIR = ROOT / "backend" / "artifacts"
REPORT_DIR = ROOT / "reports"
NLTK_DIR = ROOT / "nltk_data"
if str(NLTK_DIR) not in nltk.data.path:
    nltk.data.path.insert(0, str(NLTK_DIR))

LOW_THRESHOLD = 0.40
MODERATE_THRESHOLD = 0.70

CRISIS_PATTERNS = [
    r"\bkill\s+(my\s*self|me)\b",
    r"\bcommit\s+suicide\b",
    r"\bsuicid(e|al)\b",
    r"\bend\s+my\s+life\b",
    r"\bwant\s+to\s+die\b",
    r"\bhurt\s+(my\s*self|me)\b",
    r"\bbetter\s+off\s+dead\b",
    r"\bno\s+reason\s+to\s+live\b",
    r"\btake\s+my\s+own\s+life\b",
    r"\bself[\s-]harm\b",
]

CRISIS_HELPLINES = {
    "india": {"name": "Tele-MANAS", "contact": "14416 / 1800-891-4416", "url": "https://telemanas.mohfw.gov.in"},
    "us": {"name": "988 Suicide & Crisis Lifeline", "contact": "Call or Text 988", "url": "https://988lifeline.org"},
    "uk": {"name": "Samaritans", "contact": "116 123", "url": "https://www.samaritans.org"},
    "international": {"name": "Find A Helpline", "contact": "findahelpline.com", "url": "https://findahelpline.com"},
}


def check_crisis(text):
    if not text:
        return False
    lowered = text.lower()
    return any(re.search(pattern, lowered) for pattern in CRISIS_PATTERNS)


class PredictionInputError(ValueError):
    pass


def ensure_artifacts():
    required = [
        ARTIFACT_DIR / "tfidf.joblib",
        ARTIFACT_DIR / "model_text.joblib",
        ARTIFACT_DIR / "model_behavior.joblib",
        ARTIFACT_DIR / "model_both.joblib",
        ARTIFACT_DIR / "feature_names.json",
    ]
    if all(p.exists() for p in required):
        return

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    dreaddit_csv = ROOT / "data" / "processed" / "dreaddit.csv"
    if not dreaddit_csv.exists():
        from backend.prepare_data import prepare
        prepare()

    x_all = ROOT / "data" / "processed" / "X_all.npz"
    if not x_all.exists() or not (ARTIFACT_DIR / "tfidf.joblib").exists():
        from backend.build_features import main as build_main
        build_main()

    from backend.train import main as train_main
    train_main()


@lru_cache(maxsize=1)
def load_resources():
    ensure_artifacts()
    try:
        nltk.download("vader_lexicon", quiet=True)
    except Exception:
        pass
    names = json.loads((ARTIFACT_DIR / "feature_names.json").read_text(encoding="utf-8"))
    return {
        "analyzer": SentimentIntensityAnalyzer(),
        "vectorizer": joblib.load(ARTIFACT_DIR / "tfidf.joblib"),
        "models": {
            "text": joblib.load(ARTIFACT_DIR / "model_text.joblib"),
            "behavior": joblib.load(ARTIFACT_DIR / "model_behavior.joblib"),
            "both": joblib.load(ARTIFACT_DIR / "model_both.joblib"),
        },
        "names": {
            "text": names["text"],
            "behavior": names["behavior"],
            "both": names["text"] + names["behavior"],
        },
    }


def risk_level(probability):
    if probability < LOW_THRESHOLD:
        return "low"
    if probability <= MODERATE_THRESHOLD:
        return "moderate"
    return "high"


def positive_probability(pipeline, features):
    model = pipeline.named_steps["model"]
    if hasattr(model, "predict_proba"):
        return float(pipeline.predict_proba(features)[0, 1])
    decision = float(np.ravel(pipeline.decision_function(features))[0])
    return float(1.0 / (1.0 + np.exp(-decision)))


def describe_feature(name, value):
    if name == "vader_compound":
        if value < -0.05:
            return "negative sentiment in the writing"
        if value > 0.05:
            return "positive sentiment in the writing"
        return None
    if name == "first_person_ratio" and value >= 0.05:
        return "high first-person pronoun use"
    if name == "type_token_ratio" and value > 0:
        return "vocabulary variety in the writing"
    if name == "word_count" and value > 0:
        return f"writing length of {int(value)} words"
    if name == "hour":
        hour = int(value)
        if hour >= 22 or hour <= 5:
            return "late-night writing time"
        return f"writing time {hour:02d}:00"
    if name == "social_karma":
        return "karma from responses"
    if name == "social_upvote_ratio":
        return "upvote ratio"
    if name == "social_num_comments":
        return "comment count"
    if name.startswith("tfidf_") and value > 0:
        word = name.removeprefix("tfidf_")
        if word in {
            "today", "day", "time", "just", "like", "really", "know", "going", "people",
            "thing", "things", "got", "get", "im", "dont", "was", "were", "its", "this",
            "that", "with", "have", "had", "been", "about", "would", "could", "there",
            "then", "than", "very", "much", "even", "still", "also", "from", "your",
            "you", "what", "when", "where", "which", "who", "how", "why",
        }:
            return None
        return f"the word “{word}”"
    return None


def top_cues(pipeline, features, names, limit=5):
    model = pipeline.named_steps["model"]
    raw = features.toarray().ravel() if sparse.issparse(features) else np.asarray(features).ravel()
    scaled_values = pipeline.named_steps["scale"].transform(features)
    if sparse.issparse(scaled_values):
        scaled = scaled_values.toarray().ravel()
    else:
        scaled = np.asarray(scaled_values).ravel()
    if hasattr(model, "feature_importances_"):
        rank = np.abs(scaled) * np.asarray(model.feature_importances_).ravel()
    else:
        rank = np.abs(np.asarray(model.coef_).ravel() * scaled)
    cues = []
    for index in np.argsort(-rank):
        if len(cues) == limit:
            break
        phrase = describe_feature(names[index], raw[index])
        if phrase and phrase not in cues:
            cues.append(phrase)
    return cues


DAILY_OPTIONS = {
    "sleep": {
        "well": (0, "Sleep was about usual."),
        "short": (1, "Sleep was shorter than usual."),
        "poor": (2, "Sleep was poor."),
        "none": (2, "There was almost no sleep."),
    },
    "energy": {
        "usual": (0, "Energy was about usual."),
        "low": (1, "Energy was low."),
        "very_low": (2, "Energy was very low."),
    },
    "company": {
        "yes": (0, "There was time with other people."),
        "little": (1, "There was little time with other people."),
        "no": (2, "Most of the day was spent away from other people."),
    },
    "routine": {
        "yes": (0, "The usual routine was kept."),
        "partly": (1, "The usual routine was only partly kept."),
        "no": (2, "The usual routine was not kept."),
    },
}


def daily_level(points):
    if points <= 1:
        return "low"
    if points <= 4:
        return "moderate"
    return "high"


def daily_behavior_report(sleep, energy, company, routine):
    raw = {"sleep": sleep, "energy": energy, "company": company, "routine": routine}
    cleaned = {key: (None if value is None or str(value).strip() == "" else str(value).strip()) for key, value in raw.items()}
    if all(value is None for value in cleaned.values()):
        return None
    if any(value is None for value in cleaned.values()):
        raise PredictionInputError("Answer all four behavior questions, or leave them all empty.")
    notes = []
    points = 0
    answers = {}
    for key, choice in cleaned.items():
        option = DAILY_OPTIONS[key].get(choice)
        if option is None:
            raise PredictionInputError("Answer the behavior questions with one of the given choices.")
        weight, note = option
        points += weight
        notes.append(note)
        answers[key] = choice
    return {
        "level": daily_level(points),
        "points": points,
        "out_of": 8,
        "notes": notes,
        "answers": answers,
    }


def behavior_row(hour, karma, upvote_ratio, comment_count):
    return np.asarray([[hour, karma, upvote_ratio, comment_count]], dtype=np.float32)


def behavior_report(hour, karma, upvote_ratio, comment_count):
    hour = int(hour)
    suffix = "am" if hour < 12 else "pm"
    hour12 = 12 if hour % 12 == 0 else hour % 12
    clock = f"{hour12}:00 {suffix}"
    if hour >= 22 or hour <= 5:
        when = f"Written late at night, {clock}."
    elif hour < 12:
        when = f"Written in the morning, {clock}."
    elif hour < 17:
        when = f"Written in the afternoon, {clock}."
    else:
        when = f"Written in the evening, {clock}."
    response = float(karma)
    if response <= 2:
        response_line = f"Response score {response:g}, a small response."
    else:
        response_line = f"Response score {response:g}."
    share = float(upvote_ratio)
    if share >= 0.8:
        tone = "Most of those responses were positive."
    elif share >= 0.5:
        tone = "More responses were positive than negative."
    else:
        tone = "More responses were negative than positive."
    replies = int(float(comment_count))
    if replies == 0:
        reply_line = "No replies."
    elif replies == 1:
        reply_line = "1 reply."
    else:
        reply_line = f"{replies} replies."
    return {
        "hour": hour,
        "karma": response,
        "upvote_ratio": share,
        "comment_count": replies,
        "notes": [
            when,
            response_line,
            f"{round(share * 100)}% of responses were positive. {tone}",
            reply_line,
        ],
    }


def voice_summary(audio_path):
    extracted = extract_voice(audio_path)
    summary = {
        "used_in_score": False,
        "speaking_rate": round(extracted["speaking_rate"], 4),
        "pause_ratio": round(extracted["pause_ratio"], 4),
        "pause_count": extracted["pause_count"],
        "pitch_mean": round(extracted["pitch_mean"], 4),
        "loudness": round(extracted["loudness"], 4),
        "jitter": round(extracted["jitter"], 4),
        "transcript": None,
    }
    transcript = transcribe(audio_path)
    if transcript:
        summary["transcript"] = transcript
    return summary


def image_summary(image_path):
    summary = extract_image(image_path)
    summary["writing"] = read_writing(image_path)
    look = read_appearance(image_path)
    if look:
        summary["appearance"] = look["appearance"]
        summary["appearance_note"] = look["note"]
        summary["appearance_level"] = look["level"]
        summary["appearance_source"] = "gemini"
    else:
        # Gemini unavailable (billing/keys/network). Still keep local image facts.
        summary["appearance"] = "unclear"
        summary["appearance_note"] = (
            "Photo was saved, but face-look analysis is temporarily unavailable. "
            "Try again later, or continue with journal and behavior answers."
        )
        summary["appearance_level"] = None
        summary["appearance_source"] = "unavailable"
    summary["used_in_score"] = False
    return summary


def image_fact(image):
    if not image:
        return None
    parts = []
    if image.get("appearance") and image.get("appearance_note"):
        parts.append(f"Looks {image['appearance']}. {image['appearance_note']}")
    if image.get("writing"):
        parts.append(image["writing"])
    return " ".join(parts) or None


def voice_screen_level(voice):
    """Map acoustic cues to a soft screening band (raises only; calm voice returns None)."""
    if not voice:
        return None
    pause = float(voice.get("pause_ratio") or 0)
    pauses = int(voice.get("pause_count") or 0)
    jitter = float(voice.get("jitter") or 0)
    # Longer silence / fragmented speech can accompany strain or withdrawal.
    if pause >= 0.65 or (pause >= 0.5 and pauses >= 4) or (pause >= 0.45 and jitter >= 0.05):
        return "high"
    if pause >= 0.4 or pauses >= 3 or jitter >= 0.035:
        return "moderate"
    return None


def screen_flag(daily, image, writing_level=None, voice_level=None):
    """Shown flag = highest of behavior, writing, voice acoustics, and photo look."""
    rank = {"low": 0, "moderate": 1, "high": 2}
    parts = []
    if daily:
        parts.append(("behavior", daily["level"]))
    look = image.get("appearance_level") if image else None
    if look in rank:
        parts.append(("photo", look))
    if writing_level in rank:
        parts.append(("writing", writing_level))
    if voice_level in rank:
        parts.append(("voice", voice_level))
    if not parts:
        return None

    best_level = max(parts, key=lambda item: rank[item[1]])[1]
    winners = [name for name, level in parts if rank[level] == rank[best_level]]
    order = ["behavior", "writing", "voice", "photo"]
    winners = sorted(winners, key=lambda name: order.index(name) if name in order else 99)

    if winners == ["behavior", "photo"]:
        source = "both"
    elif len(winners) == 1:
        source = winners[0]
    else:
        source = "_and_".join(winners)

    return {
        "level": best_level,
        "source": source,
        "parts": {name: level for name, level in parts},
    }


def predict_risk(
    text,
    hour,
    karma,
    upvote_ratio,
    comment_count,
    audio_path=None,
    image_path=None,
    sleep=None,
    energy=None,
    company=None,
    routine=None,
):
    resources = load_resources()
    cleaned = str(text or "").strip()
    voice = voice_summary(audio_path) if audio_path else None
    image = None
    if image_path:
        try:
            image = image_summary(image_path)
        except ValueError as error:
            raise PredictionInputError(str(error)) from error
    text_from_voice = False
    if voice and voice["transcript"] and not cleaned:
        cleaned = voice["transcript"]
        voice["used_in_score"] = True
        text_from_voice = True
    elif image and image["writing"] and not cleaned:
        cleaned = image["writing"]
        image["used_in_score"] = True
    has_text = bool(cleaned)
    is_crisis = check_crisis(cleaned)
    behavior_values = (hour, karma, upvote_ratio, comment_count)
    has_behavior = all(value is not None for value in behavior_values)
    daily = daily_behavior_report(sleep, energy, company, routine)
    photo_level = image.get("appearance_level") if image else None
    acoustic_level = voice_screen_level(voice)
    if not has_text and not has_behavior and daily is None and not photo_level and acoustic_level is None:
        raise PredictionInputError(
            "Provide journal text, the behavior answers, a voice recording, or a photo of a person."
        )

    text_features = None
    if has_text:
        text_features = text_matrix([cleaned], resources["analyzer"], resources["vectorizer"])
    behavior_features = behavior_row(*behavior_values) if has_behavior else None

    if has_text and has_behavior:
        route = "both"
        features = sparse.hstack([text_features, sparse.csr_matrix(behavior_features)], format="csr")
        used = ["text", "behavior"]
    elif has_text:
        route = "text"
        features = text_features
        used = ["text"]
    else:
        route = "behavior"
        features = behavior_features
        used = ["behavior"]

    if not has_text and not has_behavior and (daily is not None or photo_level or acoustic_level):
        shown = screen_flag(daily, image, writing_level=None, voice_level=acoustic_level)
        level = shown["level"]
        if is_crisis:
            level = "high"
            shown = {**shown, "level": "high"}
        notes = list(daily["notes"]) if daily else []
        if image and image.get("appearance_note"):
            notes.append(image["appearance_note"])
        if voice and acoustic_level:
            notes.append(
                f"Voice cues suggested {acoustic_level} strain "
                f"(silence {round(float(voice.get('pause_ratio') or 0) * 100)}%, "
                f"{int(voice.get('pause_count') or 0)} pauses)."
            )
        share = daily["points"] / daily["out_of"] if daily else {"low": 0.2, "moderate": 0.55, "high": 0.8}[level]

        wellness = compose_wellness_with_cartesia(
            risk_level=level,
            probability=share,
            cues=[],
            excerpt="",
            daily_behavior=daily,
            voice=voice,
            image=image,
            crisis_detected=is_crisis,
        )
        empathic_summary = wellness["text"]
        audio_base64 = wellness["audio_base64"]

        used_inputs = []
        if daily:
            used_inputs.append("behavior")
        if voice is not None:
            used_inputs.append("voice")
        if image and (photo_level or image.get("writing") or image.get("appearance")):
            used_inputs.append("image")
        missing_inputs = [] if voice is not None else ["voice"]

        return {
            "risk_level": level,
            "probability": round(share, 4),
            "inputs_used": used_inputs or (["image"] if image else ["behavior"]),
            "inputs_missing": missing_inputs,
            "voice_recorded": voice is not None,
            "voice": voice,
            "image": image,
            "behavior": None,
            "daily_behavior": daily,
            "screen": shown,
            "cues": [],
            "crisis_detected": is_crisis,
            "crisis_helplines": CRISIS_HELPLINES if is_crisis else None,
            "explanation": explain(level, share, [], "", notes or None, voice, image_fact(image)),
            "wellness_tip": empathic_summary,
            "wellness_tip_audio": audio_base64,
            "wellness_tip_source": wellness["tip_source"],
            "wellness_voice_provider": wellness["voice_provider"],
            "empathic_summary": empathic_summary,
            "empathic_audio_base64": audio_base64,
            "thresholds": {"low_below": LOW_THRESHOLD, "high_above": MODERATE_THRESHOLD},
            "disclaimer": "This is a screening flag, not a clinical diagnosis.",
        }

    pipeline = resources["models"][route]
    probability = positive_probability(pipeline, features)
    level = risk_level(probability)
    if is_crisis:
        level = "high"
    cues = top_cues(pipeline, features, resources["names"][route])
    scored_text = cleaned if has_text else ""
    behavior = behavior_report(*behavior_values) if has_behavior else None
    # Combine behavior + writing + voice + photo; take the highest band.
    shown = screen_flag(
        daily,
        image,
        writing_level=level if has_text else None,
        voice_level=acoustic_level,
    )
    notes = list(daily["notes"]) if daily else (behavior["notes"] if behavior else None)
    shown_level = shown["level"] if shown else level
    if is_crisis:
        shown_level = "high"
        if shown:
            shown = {**shown, "level": "high"}

    wellness = compose_wellness_with_cartesia(
        risk_level=shown_level,
        probability=probability,
        cues=cues,
        excerpt=scored_text,
        daily_behavior=daily,
        voice=voice,
        image=image,
        crisis_detected=is_crisis,
    )
    empathic_summary = wellness["text"]
    audio_base64 = wellness["audio_base64"]

    missing_inputs = [] if voice is not None else ["voice"]

    return {
        "risk_level": level,
        "probability": round(probability, 4),
        "inputs_used": used,
        "inputs_missing": missing_inputs,
        "voice_recorded": voice is not None,
        "voice": voice,
        "image": image,
        "behavior": behavior,
        "daily_behavior": daily,
        "screen": shown,
        "cues": cues,
        "crisis_detected": is_crisis,
        "crisis_helplines": CRISIS_HELPLINES if is_crisis else None,
        "explanation": explain(
            shown["level"] if shown else level,
            probability,
            cues,
            scored_text,
            notes,
            voice,
            image_fact(image),
        ),
        "wellness_tip": empathic_summary,
        "wellness_tip_audio": audio_base64,
        "wellness_tip_source": wellness["tip_source"],
        "wellness_voice_provider": wellness["voice_provider"],
        "empathic_summary": empathic_summary,
        "empathic_audio_base64": audio_base64,
        "thresholds": {"low_below": LOW_THRESHOLD, "high_above": MODERATE_THRESHOLD},
        "disclaimer": "This is a screening flag, not a clinical diagnosis.",
    }


def load_metrics():
    import pandas as pd

    experiment1 = pd.read_csv(REPORT_DIR / "experiment1.csv")
    experiment2 = pd.read_csv(REPORT_DIR / "experiment2.csv")
    return {
        "experiment1": experiment1.to_dict(orient="records"),
        "experiment2": experiment2.to_dict(orient="records"),
    }
