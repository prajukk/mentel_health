from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import sparse
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from backend.train import ARTIFACT_DIR, evaluate, load_matrices, make_estimator

ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = ROOT / "reports" / "experiment2.csv"
CHART_PATH = ROOT / "reports" / "experiment3_f1.png"
HIDE_RATES = (0.0, 0.1, 0.3, 0.5)


def behavior_medians(behavior, train_rows):
    return np.median(behavior[train_rows], axis=0)


def hide_behavior(behavior, rate, medians, draw):
    hidden = behavior.copy()
    flags = np.zeros(behavior.shape, dtype=np.float32)
    if rate == 0:
        return hidden, flags
    mask = draw < rate
    flags[mask] = 1
    for column, median in enumerate(medians):
        hidden[mask[:, column], column] = median
    return hidden, flags


def stack_features(text, behavior, flags):
    return sparse.hstack(
        [text, sparse.csr_matrix(behavior), sparse.csr_matrix(flags)],
        format="csr",
    )


def metric_row(condition, model_name, metrics, reference_f1):
    return {
        "condition": condition,
        "model": model_name,
        "accuracy": metrics["accuracy"],
        "precision": metrics["precision"],
        "recall": metrics["recall"],
        "f1": metrics["f1"],
        "roc_auc": metrics["roc_auc"],
        "f1_drop": reference_f1 - metrics["f1"],
    }


def save_chart(rates, scores):
    figure, axis = plt.subplots(figsize=(7.2, 4.6))
    axis.plot(rates, scores, color="#0E6B67", marker="o", linewidth=2)
    for rate, score in zip(rates, scores):
        axis.annotate(
            f"{score:.3f}",
            (rate, score),
            textcoords="offset points",
            xytext=(0, 8),
            ha="center",
            color="#1F1A17",
        )
    drop = max(scores) - min(scores)
    worst_rate = rates[int(np.argmin(scores))]
    axis.set_title("F1 as behavior fields go missing")
    axis.set_xlabel("Behavior fields hidden (%)")
    axis.set_ylabel("F1")
    axis.set_xticks(rates)
    padding = max(0.02, drop * 0.35)
    axis.set_ylim(min(scores) - padding, max(scores) + padding)
    axis.annotate(
        f"Largest drop {drop:.3f} at {worst_rate:.0f}% hidden",
        xy=(0.02, 0.04),
        xycoords="axes fraction",
        color="#6B625A",
    )
    figure.tight_layout()
    figure.savefig(CHART_PATH, dpi=150)
    plt.close(figure)
    return drop, worst_rate


def main():
    index, matrices = load_matrices()
    labels = index["label"].to_numpy()
    train_rows = index["split"].eq("train").to_numpy()
    test_rows = index["split"].eq("test").to_numpy()
    text = matrices["text"]
    behavior = matrices["behavior"]
    medians = behavior_medians(behavior, train_rows)
    test_labels = labels[test_rows]
    draw = np.random.default_rng(42).random(behavior[test_rows].shape)

    full_model = joblib.load(ARTIFACT_DIR / "model_both.joblib")
    text_model = joblib.load(ARTIFACT_DIR / "model_text.joblib")
    behavior_model = joblib.load(ARTIFACT_DIR / "model_behavior.joblib")
    full_metrics = evaluate(full_model, matrices["both"][test_rows], test_labels)
    text_missing = evaluate(behavior_model, behavior[test_rows], test_labels)
    behavior_missing = evaluate(text_model, text[test_rows], test_labels)

    train_behavior, train_flags = hide_behavior(
        behavior[train_rows],
        0.3,
        medians,
        np.random.default_rng(7).random(behavior[train_rows].shape),
    )
    complete_flags = np.zeros_like(behavior[train_rows], dtype=np.float32)
    training_features = sparse.vstack(
        [
            stack_features(text[train_rows], behavior[train_rows], complete_flags),
            stack_features(text[train_rows], train_behavior, train_flags),
        ]
    )
    training_labels = np.concatenate([labels[train_rows], labels[train_rows]])
    missing_model = Pipeline(
        [
            ("scale", StandardScaler(with_mean=False)),
            ("model", make_estimator("random_forest")),
        ]
    )
    missing_model.fit(training_features, training_labels)
    joblib.dump(missing_model, ARTIFACT_DIR / "model_both_missing_flag.joblib")

    rows = [
        metric_row("full", "random_forest", full_metrics, full_metrics["f1"]),
        metric_row("text_missing", "linear_svm", text_missing, full_metrics["f1"]),
        metric_row("behavior_missing", "random_forest", behavior_missing, full_metrics["f1"]),
    ]
    chart_rates = []
    chart_scores = []
    for rate in HIDE_RATES:
        hidden_behavior, flags = hide_behavior(behavior[test_rows], rate, medians, draw)
        features = stack_features(text[test_rows], hidden_behavior, flags)
        metrics = evaluate(missing_model, features, test_labels)
        condition = "behavior_hidden_0" if rate == 0 else f"behavior_hidden_{int(rate * 100)}"
        rows.append(metric_row(condition, "random_forest_missing_flag", metrics, full_metrics["f1"]))
        chart_rates.append(rate * 100)
        chart_scores.append(metrics["f1"])

    report = pd.DataFrame(rows).round(4)
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    report.to_csv(REPORT_PATH, index=False)
    drop, worst_rate = save_chart(chart_rates, chart_scores)
    print(report.to_string(index=False))
    print(f"largest_partial_f1_drop {drop:.4f} at {worst_rate:.0f} percent")
    print(f"chart {CHART_PATH}")


if __name__ == "__main__":
    main()
