import os
import pandas as pd
import numpy as np
import logging
from scipy.signal import butter, sosfilt, iirnotch, sosfiltfilt
from config import CHANNELS, WINDOW_SIZE, STEP_SIZE, SAMPLING_RATE

# Production logging setup
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Signal processing helpers
# ---------------------------------------------------------------------------

def _butter_bandpass_sos(lowcut: float, highcut: float, fs: float, order: int = 4):
    """Return second-order sections for a Butterworth bandpass filter."""
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    sos = butter(order, [low, high], btype="band", output="sos")
    return sos


def _notch_sos(freq: float, fs: float, quality: float = 30.0):
    """Return second-order sections for an IIR notch filter."""
    b, a = iirnotch(freq / (0.5 * fs), quality)
    # Convert to SOS for numerical stability
    from scipy.signal import tf2sos
    sos = tf2sos(b, a)
    return sos


# Pre-build filters once at module load (avoids recalculation per call)
_BP_SOS = _butter_bandpass_sos(0.5, 40.0, SAMPLING_RATE, order=4)
_NOTCH_SOS = _notch_sos(50.0, SAMPLING_RATE)  # 50 Hz mains (change to 60 for US)


def apply_filters(signal: np.ndarray) -> np.ndarray:
    """Apply bandpass (0.5–40 Hz) and 50-Hz notch filter to raw EEG.

    Args:
        signal: shape (T, C) – time-major numpy array.

    Returns:
        Filtered signal of the same shape.
    """
    filtered = signal.copy().astype(np.float64)
    for ch in range(filtered.shape[1]):
        filtered[:, ch] = sosfiltfilt(_BP_SOS, filtered[:, ch])
        filtered[:, ch] = sosfiltfilt(_NOTCH_SOS, filtered[:, ch])
    return filtered.astype(np.float32)


def reject_artifacts(segment: np.ndarray, z_thresh: float = 4.0) -> bool:
    """Return True if the segment is clean (no artifact detected).

    Uses a peak-to-peak amplitude check per channel plus a z-score check
    so that muscle artifacts, electrode pops, and saturation are flagged.
    """
    for ch in range(segment.shape[1]):
        ch_data = segment[:, ch]
        # Peak-to-peak threshold (typical EEG < 150 µV after filtering)
        if np.ptp(ch_data) > 150.0:
            return False
        # Z-score check – reject if any sample is an extreme outlier
        std = np.std(ch_data)
        if std < 1e-9:
            return False  # Flat channel — electrode off
        if np.max(np.abs(ch_data - np.mean(ch_data))) / std > z_thresh:
            return False
    return True


def preprocess_raw_eeg(data: np.ndarray) -> np.ndarray:
    """Full preprocessing pipeline for raw hardware EEG.

    1. Interpolate NaNs
    2. Bandpass + notch filter
    3. Segment into windows
    4. Artifact rejection per window

    Args:
        data: shape (T, C) – raw continuous EEG from hardware.

    Returns:
        Clean segments as (N, WINDOW_SIZE, C) array.
    """
    if data.ndim != 2 or data.shape[1] != len(CHANNELS):
        raise ValueError(
            f"Expected shape (T, {len(CHANNELS)}), got {data.shape}"
        )

    # 1. Handle NaNs/Infs via linear interpolation per channel
    data = data.astype(np.float32)
    for ch in range(data.shape[1]):
        col = data[:, ch]
        bad = ~np.isfinite(col)
        if bad.any():
            idx = np.where(~bad)[0]
            if len(idx) < 2:
                col[:] = 0.0
            else:
                data[:, ch] = np.interp(np.arange(len(col)), idx, col[idx])

    # 2. Bandpass + notch filter
    if data.shape[0] >= 3 * WINDOW_SIZE:  # enough samples to filter safely
        data = apply_filters(data)

    # 3. Segment + 4. Artifact rejection
    segments = []
    for i in range(0, data.shape[0] - WINDOW_SIZE + 1, STEP_SIZE):
        seg = data[i : i + WINDOW_SIZE]
        if seg.shape[0] == WINDOW_SIZE and reject_artifacts(seg):
            segments.append(seg)

    if not segments:
        logger.warning("preprocess_raw_eeg: all segments rejected by artifact filter")
        # Fallback: return unfiltered segments so authentication can still proceed
        for i in range(0, data.shape[0] - WINDOW_SIZE + 1, STEP_SIZE):
            seg = data[i : i + WINDOW_SIZE]
            if seg.shape[0] == WINDOW_SIZE:
                segments.append(seg)

    return np.array(segments, dtype=np.float32)


# ---------------------------------------------------------------------------
# File-based helpers (used during registration and CSV-based authentication)
# ---------------------------------------------------------------------------

def get_subject_files(data_dir: str, subject_id: int) -> list:
    """Finds all resting-state EEG files for a specific subject."""
    try:
        if not os.path.exists(data_dir):
            logger.error(f"Data directory does not exist: {data_dir}")
            return []

        subject_files = []
        subject_str = f"s{subject_id:02d}"

        for filename in os.listdir(data_dir):
            # Only use resting-state data (ex01 / ex02) for stable biometrics
            if filename.startswith(subject_str) and (
                "_ex01_" in filename or "_ex02_" in filename
            ):
                file_path = os.path.join(data_dir, filename)
                if os.path.getsize(file_path) > 0:
                    subject_files.append(file_path)

        logger.info(f"Found {len(subject_files)} files for subject {subject_id}")
        return subject_files

    except Exception as e:
        logger.error(f"Error finding subject files: {e}")
        return []


def load_and_segment_csv(file_path: str) -> np.ndarray:
    """Loads a single filtered CSV file, filters, and segments it into windows."""
    try:
        if not os.path.exists(file_path):
            logger.error(f"File does not exist: {file_path}")
            return np.array([])

        df = pd.read_csv(file_path, usecols=CHANNELS)

        missing_channels = set(CHANNELS) - set(df.columns)
        if missing_channels:
            logger.error(f"Missing channels in {file_path}: {missing_channels}")
            return np.array([])

        df = df[CHANNELS]

        # Forward-fill then back-fill NaNs; remaining zeros are safe
        df = df.ffill().bfill().fillna(0.0)

        eeg_data = df.to_numpy(dtype=np.float32)

        # Apply digital filters if the file has enough data
        if eeg_data.shape[0] >= 3 * WINDOW_SIZE:
            eeg_data = apply_filters(eeg_data)

        segments = []
        for i in range(0, len(eeg_data) - WINDOW_SIZE + 1, STEP_SIZE):
            seg = eeg_data[i : i + WINDOW_SIZE]
            if seg.shape[0] == WINDOW_SIZE and reject_artifacts(seg):
                segments.append(seg)

        if not segments:
            # Fallback: include all segments without artifact rejection
            for i in range(0, len(eeg_data) - WINDOW_SIZE + 1, STEP_SIZE):
                seg = eeg_data[i : i + WINDOW_SIZE]
                if seg.shape[0] == WINDOW_SIZE:
                    segments.append(seg)

        logger.info(
            f"Extracted {len(segments)} segments from {os.path.basename(file_path)}"
        )
        return np.array(segments, dtype=np.float32)

    except Exception as e:
        logger.error(f"Error loading and segmenting {file_path}: {e}")
        return np.array([])


def validate_eeg_data(data: np.ndarray) -> tuple:
    """Validate EEG data quality before authentication."""
    if len(data) == 0:
        return False, "No data segments found"

    mean_amplitude = np.mean(np.abs(data))
    if mean_amplitude < 1e-6:
        return False, "Signal amplitude too low — check electrode connection"
    if mean_amplitude > 500:
        return False, "Signal amplitude too high — possible saturation or artifact"

    return True, "Data validation passed"
