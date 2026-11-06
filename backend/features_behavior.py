import numpy as np
import pandas as pd

BEHAVIOR_FEATURES = [
    "hour",
    "social_karma",
    "social_upvote_ratio",
    "social_num_comments",
]


def behavior_matrix(frame):
    timestamps = pd.to_numeric(frame["social_timestamp"], errors="coerce")
    hours = pd.to_datetime(timestamps, unit="s", utc=True).dt.hour.fillna(0)
    values = np.column_stack(
        [
            hours.to_numpy(dtype=np.float32),
            pd.to_numeric(frame["social_karma"], errors="coerce").fillna(0).to_numpy(dtype=np.float32),
            pd.to_numeric(frame["social_upvote_ratio"], errors="coerce").fillna(0).to_numpy(dtype=np.float32),
            pd.to_numeric(frame["social_num_comments"], errors="coerce").fillna(0).to_numpy(dtype=np.float32),
        ]
    )
    return values
