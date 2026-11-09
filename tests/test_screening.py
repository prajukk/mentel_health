import unittest
from pathlib import Path
from unittest.mock import patch

import joblib
import numpy as np
import pandas as pd
from scipy import sparse
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC

from backend.app import app
from backend.features_text import fit_tfidf
from backend.features_voice import VOICE_FEATURES, extract_voice
from backend.key_pool import KeyPool, RetryableAPIError
from backend.predict import PredictionInputError, load_metrics, predict_risk

ROOT = Path(__file__).resolve().parents[1]
JOURNAL = "I feel anxious and I cannot sleep. I worry about everything in my life."
SAMPLE_WAV = ROOT / "data" / "raw" / "sample_voice.wav"


def quiet_predict(*args, **kwargs):
    wellness = {
        "text": "Take a gentle pause and care for yourself today.",
        "tip_source": "fallback",
        "voice_provider": None,
        "audio_base64": None,
    }
    with patch("backend.predict.explain", return_value=None), patch(
        "backend.predict.transcribe", return_value=None
    ), patch("backend.predict.compose_wellness_with_cartesia", return_value=wellness):
        return predict_risk(*args, **kwargs)


class DatasetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.frame = pd.read_csv(ROOT / "data" / "processed" / "dreaddit.csv")

    def test_row_count_and_columns(self):
        self.assertEqual(len(self.frame), 3553)
        self.assertEqual(
            list(self.frame.columns),
            [
                "split",
                "post_id",
                "text",
                "label",
                "social_timestamp",
                "social_karma",
                "social_upvote_ratio",
                "social_num_comments",
            ],
        )

    def test_official_split_counts(self):
        counts = self.frame.groupby(["split", "label"]).size()
        self.assertEqual(int(counts[("train", 0)]), 1092)
        self.assertEqual(int(counts[("train", 1)]), 1178)
        self.assertEqual(int(counts[("validation", 0)]), 258)
        self.assertEqual(int(counts[("validation", 1)]), 310)
        self.assertEqual(int(counts[("test", 0)]), 346)
        self.assertEqual(int(counts[("test", 1)]), 369)


class FeatureTests(unittest.TestCase):
    def test_matrix_shapes(self):
        text = sparse.load_npz(ROOT / "data" / "processed" / "X_text.npz")
        behavior = sparse.load_npz(ROOT / "data" / "processed" / "X_behavior.npz")
        combined = sparse.load_npz(ROOT / "data" / "processed" / "X_all.npz")
        voice = sparse.load_npz(ROOT / "data" / "processed" / "X_voice_sample.npz")
        self.assertEqual(text.shape, (3553, 3004))
        self.assertEqual(behavior.shape, (3553, 4))
        self.assertEqual(combined.shape, (3553, 3008))
        self.assertEqual(voice.shape[1], len(VOICE_FEATURES))

    def test_tfidf_matches_training_split_only(self):
        frame = pd.read_csv(ROOT / "data" / "processed" / "dreaddit.csv")
        saved = joblib.load(ROOT / "backend" / "artifacts" / "tfidf.joblib")
        refit = fit_tfidf(frame.loc[frame["split"] == "train", "text"])
        self.assertIsInstance(saved, TfidfVectorizer)
        self.assertEqual(len(saved.get_feature_names_out()), 3000)
        np.testing.assert_allclose(saved.idf_, refit.idf_, rtol=1e-5, atol=1e-5)
        full = TfidfVectorizer(max_features=3000, stop_words="english", lowercase=True, dtype=np.float32)
        full.fit(frame["text"])
        self.assertFalse(np.allclose(saved.idf_, full.idf_, rtol=1e-4, atol=1e-4))


class ModelTests(unittest.TestCase):
    def test_saved_model_types(self):
        text = joblib.load(ROOT / "backend" / "artifacts" / "model_text.joblib")
        behavior = joblib.load(ROOT / "backend" / "artifacts" / "model_behavior.joblib")
        both = joblib.load(ROOT / "backend" / "artifacts" / "model_both.joblib")
        self.assertIsInstance(text.named_steps["model"], RandomForestClassifier)
        self.assertIsInstance(behavior.named_steps["model"], SVC)
        self.assertEqual(behavior.named_steps["model"].kernel, "linear")
        self.assertIsInstance(both.named_steps["model"], RandomForestClassifier)

    def test_voice_features_are_not_in_the_trained_names(self):
        import json

        names = json.loads((ROOT / "backend" / "artifacts" / "feature_names.json").read_text(encoding="utf-8"))
        trained = set(names["text"] + names["behavior"])
        self.assertTrue(set(VOICE_FEATURES).isdisjoint(trained))


class ExperimentTests(unittest.TestCase):
    def test_experiment_tables(self):
        metrics = load_metrics()
        self.assertEqual(len(metrics["experiment1"]), 9)
        self.assertEqual(len(metrics["experiment2"]), 7)
        by_features = {row["features"]: row for row in metrics["experiment1"] if row["model"] in {
            "random_forest",
            "linear_svm",
        }}
        text = next(row for row in metrics["experiment1"] if row["features"] == "text" and row["model"] == "random_forest")
        behavior = next(row for row in metrics["experiment1"] if row["features"] == "behavior" and row["model"] == "linear_svm")
        both = next(row for row in metrics["experiment1"] if row["features"] == "both" and row["model"] == "random_forest")
        self.assertAlmostEqual(text["f1"], 0.7762, places=4)
        self.assertAlmostEqual(text["accuracy"], 0.7524, places=4)
        self.assertAlmostEqual(text["roc_auc"], 0.8322, places=4)
        self.assertAlmostEqual(behavior["f1"], 0.6786, places=4)
        self.assertAlmostEqual(both["f1"], 0.7776, places=4)
        self.assertAlmostEqual(both["accuracy"], 0.7552, places=4)
        self.assertAlmostEqual(both["roc_auc"], 0.8326, places=4)
        rows = {row["condition"]: row for row in metrics["experiment2"]}
        self.assertAlmostEqual(rows["text_missing"]["f1_drop"], 0.099, places=3)
        self.assertAlmostEqual(rows["behavior_missing"]["f1_drop"], 0.0014, places=4)
        self.assertAlmostEqual(rows["behavior_hidden_50"]["f1_drop"], 0.0074, places=4)
        curve = [rows[f"behavior_hidden_{rate}"]["f1"] for rate in (0, 10, 30, 50)]
        self.assertAlmostEqual(max(curve) - min(curve), 0.0045, places=4)
        self.assertTrue((ROOT / "reports" / "experiment3_f1.png").read_bytes().startswith(b"\x89PNG"))
        del by_features


class VoiceTests(unittest.TestCase):
    def test_generated_tone_has_two_pauses_near_180_hz(self):
        header = SAMPLE_WAV.read_bytes()[:12]
        self.assertEqual(header[:4], b"RIFF")
        self.assertEqual(header[8:12], b"WAVE")
        features = extract_voice(SAMPLE_WAV)
        self.assertEqual(features["pause_count"], 2)
        self.assertGreater(features["pitch_mean"], 170)
        self.assertLess(features["pitch_mean"], 190)
        self.assertEqual(len(VOICE_FEATURES), 20)


class PredictionTests(unittest.TestCase):
    def test_journal_and_routine(self):
        result = quiet_predict(JOURNAL, 23, 2, 0.8, 1)
        self.assertEqual(result["risk_level"], "high")
        self.assertAlmostEqual(result["probability"], 0.735, delta=0.015)
        self.assertEqual(result["inputs_used"], ["text", "behavior"])
        self.assertEqual(result["disclaimer"], "This is a screening flag, not a clinical diagnosis.")
        self.assertIsNone(result["explanation"])
        joined = " ".join(result["cues"]).lower()
        self.assertIn("first-person", joined)
        self.assertIn("feel", joined)
        self.assertIn("anxious", joined)
        self.assertIn("late at night", " ".join(result["behavior"]["notes"]))

    def test_routine_only(self):
        result = quiet_predict("", 23, 2, 0.8, 1)
        self.assertEqual(result["risk_level"], "moderate")
        self.assertAlmostEqual(result["probability"], 0.541, delta=0.02)
        self.assertEqual(result["inputs_used"], ["behavior"])
        self.assertNotIn("text", result["inputs_used"])
        self.assertTrue(any("late-night" in cue for cue in result["cues"]))

    def test_daily_behavior_sets_the_shown_level(self):
        steady = quiet_predict(
            JOURNAL,
            None,
            None,
            None,
            None,
            sleep="well",
            energy="usual",
            company="yes",
            routine="yes",
        )
        self.assertEqual(steady["daily_behavior"]["level"], "low")
        self.assertEqual(steady["daily_behavior"]["points"], 0)
        self.assertEqual(steady["inputs_used"], ["text"])
        self.assertEqual(steady["risk_level"], "high")
        # Heavy journal can raise the shown screen above calm behavior answers.
        self.assertEqual(steady["screen"]["level"], "high")
        self.assertIn("writing", steady["screen"]["source"])

        strained = quiet_predict(
            "",
            None,
            None,
            None,
            None,
            sleep="poor",
            energy="very_low",
            company="no",
            routine="no",
        )
        self.assertEqual(strained["daily_behavior"]["level"], "high")
        self.assertEqual(strained["daily_behavior"]["points"], 8)
        self.assertEqual(strained["risk_level"], "high")
        self.assertEqual(strained["inputs_used"], ["behavior"])
        self.assertIn("Sleep was poor.", strained["daily_behavior"]["notes"])

    def test_distressed_journal_raises_moderate_behavior_screen(self):
        text = (
            "I feel overwhelmed and anxious. I cannot sleep well, my energy is very low, "
            "and I have been alone most of the day. Everything feels heavy and hard to manage."
        )
        result = quiet_predict(
            text,
            None,
            None,
            None,
            None,
            sleep="short",
            energy="usual",
            company="no",
            routine="partly",
        )
        self.assertEqual(result["daily_behavior"]["points"], 4)
        self.assertEqual(result["daily_behavior"]["level"], "moderate")
        self.assertEqual(result["risk_level"], "high")
        self.assertEqual(result["screen"]["level"], "high")
        self.assertIn("writing", result["screen"]["parts"])
        self.assertIn("behavior", result["screen"]["parts"])

    def test_voice_and_behavior_combine_on_screen(self):
        from backend.predict import screen_flag, voice_screen_level

        self.assertEqual(
            voice_screen_level({"pause_ratio": 0.7, "pause_count": 5, "jitter": 0.02}),
            "high",
        )
        self.assertEqual(
            voice_screen_level({"pause_ratio": 0.42, "pause_count": 3, "jitter": 0.01}),
            "moderate",
        )
        self.assertIsNone(voice_screen_level({"pause_ratio": 0.1, "pause_count": 0, "jitter": 0.01}))

        daily = {"level": "moderate", "points": 4, "out_of": 8}
        shown = screen_flag(
            daily,
            {"appearance_level": None},
            writing_level="low",
            voice_level="high",
        )
        self.assertEqual(shown["level"], "high")
        self.assertEqual(shown["parts"]["behavior"], "moderate")
        self.assertEqual(shown["parts"]["voice"], "high")
        self.assertIn("voice", shown["source"])

    def test_sad_photo_raises_the_screen(self):
        from tempfile import NamedTemporaryFile

        from PIL import Image

        look = {"appearance": "sad", "note": "The face looks down.", "level": "high"}
        with NamedTemporaryFile(suffix=".png", delete=False) as temporary:
            Image.new("RGB", (8, 8), (20, 20, 20)).save(temporary.name)
            path = temporary.name
        try:
            with patch("backend.predict.read_writing", return_value=None), patch(
                "backend.predict.read_appearance", return_value=look
            ), patch("backend.predict.explain", return_value=None):
                mixed = predict_risk(
                    JOURNAL,
                    None,
                    None,
                    None,
                    None,
                    image_path=path,
                    sleep="well",
                    energy="usual",
                    company="yes",
                    routine="yes",
                )
                photo = predict_risk("", None, None, None, None, image_path=path)
        finally:
            Path(path).unlink(missing_ok=True)
        self.assertEqual(mixed["daily_behavior"]["level"], "low")
        self.assertEqual(mixed["screen"]["level"], "high")
        self.assertIn("photo", mixed["screen"]["parts"])
        self.assertTrue(
            mixed["screen"]["source"] == "both"
            or "photo" in mixed["screen"]["source"]
            or "writing" in mixed["screen"]["source"]
        )
        self.assertEqual(mixed["image"]["appearance"], "sad")
        self.assertEqual(photo["risk_level"], "high")
        self.assertEqual(photo["inputs_used"], ["image"])
        self.assertEqual(photo["screen"]["source"], "photo")

    def test_journal_only_without_explanation(self):
        result = quiet_predict(JOURNAL, None, None, None, None)
        self.assertEqual(result["risk_level"], "high")
        self.assertAlmostEqual(result["probability"], 0.713, delta=0.015)
        self.assertEqual(result["inputs_used"], ["text"])
        self.assertIsNone(result["explanation"])

    def test_partial_routine_is_left_out(self):
        partial = quiet_predict(JOURNAL, 23, None, None, None)
        journal = quiet_predict(JOURNAL, None, None, None, None)
        self.assertEqual(partial["inputs_used"], ["text"])
        self.assertEqual(partial["probability"], journal["probability"])

    def test_neither_input_is_rejected(self):
        with self.assertRaises(PredictionInputError):
            quiet_predict("", None, None, None, None)

    def test_recording_supplies_words_when_journal_is_empty(self):
        with patch("backend.predict.explain", return_value=None), patch(
            "backend.predict.transcribe", return_value=JOURNAL
        ):
            result = predict_risk("", None, None, None, None, SAMPLE_WAV)
        self.assertTrue(result["voice"]["used_in_score"])
        self.assertEqual(result["voice"]["transcript"], JOURNAL)
        self.assertEqual(result["inputs_used"], ["text"])
        self.assertEqual(result["risk_level"], "high")
        self.assertNotIn("speaking_rate", result["inputs_used"])

    def test_filled_journal_keeps_transcript_out_of_the_score(self):
        with patch("backend.predict.explain", return_value=None), patch(
            "backend.predict.transcribe", return_value="unrelated transcript"
        ):
            result = predict_risk(JOURNAL, None, None, None, None, SAMPLE_WAV)
        self.assertFalse(result["voice"]["used_in_score"])
        self.assertEqual(result["voice"]["transcript"], "unrelated transcript")
        self.assertAlmostEqual(result["probability"], 0.713, delta=0.015)

    def test_cartesia_unavailable_still_returns_the_score(self):
        with patch("backend.predict.explain", return_value=None), patch(
            "backend.predict.transcribe", return_value=None
        ):
            result = predict_risk(JOURNAL, 23, 2, 0.8, 1, SAMPLE_WAV)
        self.assertIsNone(result["voice"]["transcript"])
        self.assertEqual(result["risk_level"], "high")
        self.assertGreater(result["voice"]["pitch_mean"], 170)


class KeyPoolTests(unittest.TestCase):
    def test_round_robin_skips_retryable_statuses(self):
        pool = KeyPool(["a", "b", "c", "d"])
        seen = []

        def call(key):
            seen.append(key)
            if key in {"a", "b"}:
                raise RetryableAPIError(429)
            return key

        self.assertEqual(pool.run(call), "c")
        self.assertEqual(seen, ["a", "b", "c"])
        self.assertEqual(pool.run(lambda key: key), "d")

    def test_every_key_failing_returns_none(self):
        pool = KeyPool(["a", "b", "c", "d"])

        def call(key):
            raise RetryableAPIError(503)

        self.assertIsNone(pool.run(call))

    def test_empty_pool_returns_none(self):
        self.assertIsNone(KeyPool(["", None]).run(lambda key: key))


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from fastapi.testclient import TestClient

        cls.client = TestClient(app)

    def test_health_and_metrics(self):
        health = self.client.get("/health")
        self.assertEqual(health.status_code, 200)
        body = health.json()
        self.assertEqual(body["status"], "ok")
        self.assertGreaterEqual(body["gemini_keys"], 0)
        self.assertGreaterEqual(body["cartesia_keys"], 0)
        metrics = self.client.get("/metrics")
        self.assertEqual(metrics.status_code, 200)
        self.assertEqual(len(metrics.json()["experiment1"]), 9)
        self.assertEqual(len(metrics.json()["experiment2"]), 7)

    def test_missing_input_is_http_400(self):
        response = self.client.post("/predict", data={"text": "   "})
        self.assertEqual(response.status_code, 400)

    def test_predict_does_not_require_external_keys(self):
        wellness = {
            "text": "Take a gentle pause and care for yourself today.",
            "tip_source": "fallback",
            "voice_provider": None,
            "audio_base64": None,
        }
        with patch("backend.predict.explain", return_value=None), patch(
            "backend.predict.compose_wellness_with_cartesia", return_value=wellness
        ):
            response = self.client.post(
                "/predict",
                data={"text": JOURNAL, "hour": "23", "karma": "2", "upvote_ratio": "0.8", "comment_count": "1"},
            )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["risk_level"], "high")
        self.assertEqual(body["disclaimer"], "This is a screening flag, not a clinical diagnosis.")
        self.assertIsNone(body["explanation"])
        screen = (ROOT / "frontend" / "src" / "screens" / "Result.jsx").read_text(encoding="utf-8")
        self.assertIn("https://findahelpline.com/", screen)


if __name__ == "__main__":
    unittest.main()
