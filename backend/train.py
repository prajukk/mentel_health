import json
from pathlib import Path

import joblib
import pandas as pd
from scipy import sparse
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

ROOT = Path(__file__).resolve().parents[1]
PROCESSED_DIR = ROOT / "data" / "processed"
ARTIFACT_DIR = ROOT / "backend" / "artifacts"
REPORT_PATH = ROOT / "reports" / "experiment1.csv"

FEATURE_SETS = ("text", "behavior", "both")
MODEL_NAMES = ("logistic_regression", "linear_svm", "random_forest")


def load_matrices():
    index = pd.read_csv(PROCESSED_DIR / "feature_index.csv")
    matrices = {
        "text": sparse.load_npz(PROCESSED_DIR / "X_text.npz"),
        "behavior": sparse.load_npz(PROCESSED_DIR / "X_behavior.npz").toarray(),
        "both": sparse.load_npz(PROCESSED_DIR / "X_all.npz"),
    }
    return index, matrices


def make_estimator(name):
    if name == "logistic_regression":
        return LogisticRegression(max_iter=1000, random_state=42)
    if name == "linear_svm":
        return SVC(kernel="linear", random_state=42)
    return RandomForestClassifier(n_estimators=200, random_state=42, n_jobs=-1)


def make_pipeline(name, feature_set):
    center = feature_set == "behavior"
    return Pipeline(
        [
            ("scale", StandardScaler(with_mean=center)),
            ("model", make_estimator(name)),
        ]
    )


def positive_scores(pipeline, features):
    model = pipeline.named_steps["model"]
    if hasattr(model, "predict_proba"):
        return pipeline.predict_proba(features)[:, 1]
    return pipeline.decision_function(features)


def evaluate(pipeline, features, labels):
    predicted = pipeline.predict(features)
    return {
        "accuracy": accuracy_score(labels, predicted),
        "precision": precision_score(labels, predicted, zero_division=0),
        "recall": recall_score(labels, predicted, zero_division=0),
        "f1": f1_score(labels, predicted, zero_division=0),
        "roc_auc": roc_auc_score(labels, positive_scores(pipeline, features)),
    }


def main():
    index, matrices = load_matrices()
    labels = index["label"].to_numpy()
    train_rows = index["split"].eq("train").to_numpy()
    validation_rows = index["split"].eq("validation").to_numpy()
    test_rows = index["split"].eq("test").to_numpy()

    rows = []
    chosen = {}
    for feature_set in FEATURE_SETS:
        features = matrices[feature_set]
        best = None
        for model_name in MODEL_NAMES:
            pipeline = make_pipeline(model_name, feature_set)
            pipeline.fit(features[train_rows], labels[train_rows])
            validation = evaluate(pipeline, features[validation_rows], labels[validation_rows])
            test = evaluate(pipeline, features[test_rows], labels[test_rows])
            rows.append({"features": feature_set, "model": model_name, **test})
            candidate = (validation["f1"], validation["roc_auc"], model_name, pipeline, test["f1"])
            if best is None or candidate[:2] > best[:2]:
                best = candidate
        validation_f1, validation_auc, model_name, pipeline, test_f1 = best
        joblib.dump(pipeline, ARTIFACT_DIR / f"model_{feature_set}.joblib")
        chosen[feature_set] = {
            "model": model_name,
            "validation_f1": validation_f1,
            "validation_roc_auc": validation_auc,
            "test_f1": test_f1,
        }
        print(f"saved model_{feature_set}.joblib {model_name} validation_f1 {validation_f1:.4f}")

    report = pd.DataFrame(rows)[
        ["features", "model", "accuracy", "precision", "recall", "f1", "roc_auc"]
    ]
    report = report.round(4)
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    report.to_csv(REPORT_PATH, index=False)
    (ARTIFACT_DIR / "model_selection.json").write_text(json.dumps(chosen, indent=2), encoding="utf-8")
    print(report.to_string(index=False))


if __name__ == "__main__":
    main()
