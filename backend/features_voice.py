from pathlib import Path

import librosa
import numpy as np

VOICE_FEATURES = [
    "speaking_rate",
    "pause_ratio",
    "pause_count",
    "pitch_mean",
    "pitch_range",
    "loudness",
    "jitter",
] + [f"mfcc_{index:02d}" for index in range(1, 14)]


def _pause_count(silent, minimum_frames):
    count = 0
    run = 0
    for is_silent in silent:
        if is_silent:
            run += 1
            continue
        if run >= minimum_frames:
            count += 1
        run = 0
    if run >= minimum_frames:
        count += 1
    return count


def _pitch_stats(samples, sample_rate):
    pitch, _, _ = librosa.pyin(
        samples,
        fmin=librosa.note_to_hz("C2"),
        fmax=librosa.note_to_hz("C5"),
        sr=sample_rate,
    )
    voiced = pitch[~np.isnan(pitch)]
    if voiced.size == 0:
        return 0.0, 0.0, 0.0, 0.0
    periods = np.full(pitch.shape, np.nan)
    periods[~np.isnan(pitch)] = 1.0 / pitch[~np.isnan(pitch)]
    jumps = []
    for current, following in zip(periods[:-1], periods[1:]):
        if np.isnan(current) or np.isnan(following):
            continue
        jumps.append(abs(following - current))
    mean_period = float(np.mean(periods[~np.isnan(periods)]))
    jitter = float(np.mean(jumps) / mean_period) if jumps and mean_period else 0.0
    duration = len(samples) / sample_rate
    speaking_rate = float(voiced.size / duration) if duration else 0.0
    return speaking_rate, float(np.mean(voiced)), float(np.ptp(voiced)), jitter


def extract_voice(source, sample_rate=16000):
    if isinstance(source, (str, Path)):
        samples, sample_rate = librosa.load(source, sr=sample_rate)
    else:
        samples = np.asarray(source, dtype=np.float32)
    if samples.size == 0:
        return {name: 0.0 for name in VOICE_FEATURES}

    rms = librosa.feature.rms(y=samples, frame_length=2048, hop_length=512)[0]
    peak = float(np.max(rms)) if rms.size else 0.0
    silent = rms < max(peak * 0.1, 1e-4)
    minimum_frames = max(1, int(0.1 * sample_rate / 512))
    speaking_rate, pitch_mean, pitch_range, jitter = _pitch_stats(samples, sample_rate)
    mfcc = librosa.feature.mfcc(y=samples, sr=sample_rate, n_mfcc=13)
    mfcc_mean = np.mean(mfcc, axis=1)

    values = {
        "speaking_rate": speaking_rate,
        "pause_ratio": float(np.mean(silent)) if silent.size else 0.0,
        "pause_count": float(_pause_count(silent, minimum_frames)),
        "pitch_mean": pitch_mean,
        "pitch_range": pitch_range,
        "loudness": float(np.mean(rms)) if rms.size else 0.0,
        "jitter": jitter,
    }
    for index, value in enumerate(mfcc_mean, start=1):
        values[f"mfcc_{index:02d}"] = float(value)
    return values


def voice_vector(source, sample_rate=16000):
    features = extract_voice(source, sample_rate=sample_rate)
    return np.asarray([features[name] for name in VOICE_FEATURES], dtype=np.float32)
