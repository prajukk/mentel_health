from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
PROCESSED_PATH = ROOT / "data" / "processed" / "dreaddit.csv"

SPLITS = {
    "train": "train_data.csv",
    "validation": "validation_data.csv",
    "test": "test-data.csv",
}

COLUMNS = [
    "split",
    "post_id",
    "text",
    "label",
    "social_timestamp",
    "social_karma",
    "social_upvote_ratio",
    "social_num_comments",
]


def load_split(split_name, filename):
    frame = pd.read_csv(RAW_DIR / filename).copy()
    frame["split"] = split_name
    return frame


def prepare():
    frames = [load_split(name, filename) for name, filename in SPLITS.items()]
    data = pd.concat(frames, ignore_index=True)
    rows_in = len(data)
    text = data["text"].fillna("").astype(str).str.strip()
    data = data.loc[text.ne("")].copy()
    data["text"] = text.loc[data.index]
    data = data[COLUMNS]
    PROCESSED_PATH.parent.mkdir(parents=True, exist_ok=True)
    data.to_csv(PROCESSED_PATH, index=False)
    return rows_in, data


def main():
    rows_in, data = prepare()
    print(f"rows_in {rows_in}")
    print(f"rows_out {len(data)}")
    print(f"empty_text_dropped {rows_in - len(data)}")
    counts = data.groupby(["split", "label"], observed=True).size()
    print(counts.to_string())


if __name__ == "__main__":
    main()
