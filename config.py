"""Configuration settings for EEG processing project.

All sensitive/deployment values are read from environment variables so the
same codebase runs in development, staging, and production without changes.
"""
import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Data / Signal processing
# ---------------------------------------------------------------------------
CHANNELS = ['P4', 'Cz', 'F8', 'T7']
WINDOW_SIZE = 256
STEP_SIZE = 128
SAMPLING_RATE = 256  # Hz
MINS_NOTCH_FREQ = float(os.getenv("NOTCH_FREQ", "50"))  # 50 Hz (India/EU); set 60 for US

# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------
BATCH_SIZE = 32
LEARNING_RATE = 0.001
NUM_EPOCHS = int(os.getenv("NUM_EPOCHS", "50"))
PATIENCE = int(os.getenv("PATIENCE", "5"))
DROPOUT_RATE = 0.5

# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------
AUTH_THRESHOLD = float(os.getenv("AUTH_THRESHOLD", "0.90"))
MAJORITY_VOTE_THRESHOLD = 0.5

# Maximum raw samples accepted from a single hardware POST (safety cap)
MAX_HARDWARE_SAMPLES = int(os.getenv("MAX_HARDWARE_SAMPLES", "30720"))  # 120 s @ 256 Hz

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).parent.absolute()
ASSETS_DIR = Path(os.getenv("ASSETS_DIR", str(BASE_DIR / 'assets')))
DATA_DIR = Path(os.getenv("DATA_DIR", str(BASE_DIR / 'data' / 'Filtered_Data')))
MODEL_PATH = ASSETS_DIR / 'model.pth'
ENCODER_PATH = ASSETS_DIR / 'label_encoder.joblib'
SCALER_PATH = ASSETS_DIR / 'scaler.joblib'
USERS_PATH = ASSETS_DIR / 'users.json'

# ---------------------------------------------------------------------------
# API / Security
# ---------------------------------------------------------------------------
# Comma-separated allowed origins; use "*" for fully open (dev only)
ALLOWED_ORIGINS: list = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
    if o.strip()
]
# Optional API key (set to non-empty to require X-API-Key header on every request)
API_KEY: str = os.getenv("API_KEY", "")