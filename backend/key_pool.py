import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

RETRYABLE_STATUS = {401, 403, 408, 429, 500, 502, 503, 504}


class RetryableAPIError(Exception):
    def __init__(self, status):
        super().__init__(f"API request failed with status {status}")
        self.status = status


class KeyPool:
    """Round-robin pool. A refused or exhausted key is skipped for that call."""

    def __init__(self, keys):
        seen = set()
        ordered = []
        for key in keys:
            cleaned = str(key or "").strip()
            if not cleaned or cleaned in seen:
                continue
            seen.add(cleaned)
            ordered.append(cleaned)
        self.keys = ordered
        self._next = 0

    def __len__(self):
        return len(self.keys)

    def run(self, call):
        if not self.keys:
            return None
        for offset in range(len(self.keys)):
            index = (self._next + offset) % len(self.keys)
            try:
                result = call(self.keys[index])
            except RetryableAPIError:
                continue
            self._next = (index + 1) % len(self.keys)
            return result
        return None


def keys_from_env(prefix):
    numbered = [os.getenv(f"{prefix}_{number}") for number in range(1, 5)]
    combined = os.getenv(f"{prefix}S", "")
    single = os.getenv(prefix)
    extras = [part.strip() for part in combined.split(",") if part.strip()]
    return KeyPool([*numbered, *extras, single])
