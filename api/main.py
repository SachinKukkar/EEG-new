from __future__ import annotations

import json
import logging
import os
import sys
import tempfile
from pathlib import Path
from typing import Any, List

import numpy as np
from fastapi import (
    FastAPI,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Bootstrap project root on sys.path
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Load .env if present (development convenience — production uses real env vars)
try:
    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / ".env", override=False)
except ImportError:
    pass  # python-dotenv not installed — env vars must be set externally

import backend  # noqa: E402
from config import ALLOWED_ORIGINS, API_KEY, MAX_HARDWARE_SAMPLES, CHANNELS  # noqa: E402
from database import db  # noqa: E402
from eeg_processing import preprocess_raw_eeg  # noqa: E402
from metrics_visualizer import MetricsVisualizer, evaluate_real_model  # noqa: E402

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("eeg.api")

MODEL_PATH = PROJECT_ROOT / "assets" / "model.pth"
DATA_DIR = PROJECT_ROOT / "data" / "Filtered_Data"
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"

# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------
app = FastAPI(
    title="EEG Biometric Authentication API",
    version="3.0.0",
    description=(
        "Production API for real-time EEG-based biometric authentication. "
        "Supports file-based authentication (CSV upload) and live hardware "
        "streaming via REST or WebSocket."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS — configured via ALLOWED_ORIGINS env var
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Optional API-key middleware
# ---------------------------------------------------------------------------
SKIP_KEY_PATHS = {"/docs", "/redoc", "/openapi.json", "/api/health"}

@app.middleware("http")
async def api_key_guard(request: Request, call_next):
    if API_KEY and request.url.path not in SKIP_KEY_PATHS:
        provided = request.headers.get("X-API-Key", "")
        if provided != API_KEY:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Missing or invalid X-API-Key header"},
            )
    return await call_next(request)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class RegisterUserRequest(BaseModel):
    username: str = Field(min_length=1, max_length=128)
    subject_id: int = Field(ge=1, le=999)


class ApiResponse(BaseModel):
    success: bool
    message: str
    data: dict[str, Any] | None = None


class HardwareAuthRequest(BaseModel):
    """
    Payload for hardware-based real-time authentication.

    The hardware device sends a continuous EEG recording as a 2-D array:
      - ``eeg_data``: list of T rows, each row has C channel values
        where C == len(CHANNELS) == 4  (P4, Cz, F8, T7)
      - ``username``: claimed identity
      - ``subject_id``: registered subject ID (anti-spoofing cross-check)
      - ``threshold``: optional per-request confidence override
    """
    username: str = Field(min_length=1, max_length=128)
    subject_id: int = Field(ge=1, le=999)
    eeg_data: List[List[float]] = Field(
        description="Raw EEG samples: shape [T, 4] — rows=time-steps, cols=channels"
    )
    threshold: float = Field(default=0.90, ge=0.0, le=1.0)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe(value: Any) -> Any:
    """Recursively convert numpy/torch types to JSON-safe Python builtins."""
    if hasattr(value, "tolist"):
        return value.tolist()
    if isinstance(value, dict):
        return {k: _safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_safe(v) for v in value]
    return value


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/api/health", tags=["System"])
def health() -> dict[str, Any]:
    data_files = 0
    if DATA_DIR.exists():
        data_files = len([f for f in os.listdir(DATA_DIR) if f.endswith(".csv")])
    return {
        "status": "ok",
        "model_ready": MODEL_PATH.exists(),
        "registered_users": len(backend.get_registered_users()),
        "data_files": data_files,
        "db_available": db.available,
        "channels": CHANNELS,
        "hardware_endpoint": "/api/authenticate/raw",
        "websocket_endpoint": "/ws/stream",
    }


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

@app.get("/api/users", tags=["Users"])
def list_users() -> dict[str, Any]:
    users = backend.get_registered_users()
    details: list[dict[str, Any]] = []
    for username in users:
        info = backend.get_user_info(username)
        if info:
            safe_info = _safe(info)
            if "data_shape" in safe_info and not isinstance(safe_info["data_shape"], (list, str)):
                safe_info["data_shape"] = str(safe_info["data_shape"])
            details.append(safe_info)
    return {"users": details}


@app.get("/api/users/{username}", tags=["Users"])
def get_user(username: str) -> dict[str, Any]:
    info = backend.get_user_info(username)
    if not info:
        raise HTTPException(status_code=404, detail=f"User '{username}' not found")
    return {"user": _safe(info)}


@app.post("/api/users/register", response_model=ApiResponse, tags=["Users"])
def register_user(payload: RegisterUserRequest) -> ApiResponse:
    success, message = backend.register_user(payload.username.strip(), payload.subject_id)
    return ApiResponse(success=success, message=message)


@app.delete("/api/users/{username}", response_model=ApiResponse, tags=["Users"])
def delete_user(username: str) -> ApiResponse:
    success, message = backend.deregister_user(username)
    return ApiResponse(success=success, message=message)


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------

@app.post("/api/model/train", response_model=ApiResponse, tags=["Model"])
def train_model() -> ApiResponse:
    users = backend.get_registered_users()
    if len(users) < 2:
        return ApiResponse(
            success=False,
            message=f"Need at least 2 registered users to train. Currently: {len(users)}.",
        )
    success = backend.train_model()
    if success:
        return ApiResponse(success=True, message="Training completed and model assets saved.")
    return ApiResponse(success=False, message="Training failed. Check server logs for details.")


@app.get("/api/model/status", tags=["Model"])
def model_status() -> dict[str, Any]:
    model_exists = MODEL_PATH.exists()
    model_size = 0.0
    if model_exists:
        model_size = round(MODEL_PATH.stat().st_size / (1024 * 1024), 2)
    return {
        "trained": model_exists,
        "model_size_mb": model_size,
        "registered_users": len(backend.get_registered_users()),
    }


# ---------------------------------------------------------------------------
# Authentication — CSV file upload (existing flow)
# ---------------------------------------------------------------------------

@app.post("/api/authenticate", response_model=ApiResponse, tags=["Authentication"])
async def authenticate_csv(
    file: UploadFile = File(...),
    username: str = Form(...),
    subject_id: int = Form(...),
    threshold: float = Form(0.90),
) -> ApiResponse:
    """Authenticate using an uploaded EEG CSV file."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="A valid EEG CSV file (.csv) is required.")
    if threshold < 0.0 or threshold > 1.0:
        raise HTTPException(status_code=400, detail="threshold must be between 0.0 and 1.0")

    temp_path = None
    try:
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        if len(content) > 50 * 1024 * 1024:  # 50 MB cap
            raise HTTPException(status_code=413, detail="File too large (max 50 MB).")

        with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp:
            tmp.write(content)
            temp_path = tmp.name

        is_auth, reason = backend.authenticate_with_subject_id(
            username_claim=username.strip(),
            gui_subject_id=subject_id,
            file_path=temp_path,
            threshold=threshold,
            original_filename=file.filename,
        )
        return ApiResponse(
            success=is_auth,
            message=reason,
            data={"username": username, "subject_id": subject_id, "threshold": threshold},
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("CSV authentication error")
        raise HTTPException(status_code=500, detail=f"Authentication error: {exc}") from exc
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


# ---------------------------------------------------------------------------
# Authentication — Raw hardware data (JSON array)
# ---------------------------------------------------------------------------

@app.post("/api/authenticate/raw", response_model=ApiResponse, tags=["Authentication"])
def authenticate_raw(payload: HardwareAuthRequest) -> ApiResponse:
    """
    Authenticate using raw EEG data sent directly from hardware.

    The hardware driver should:
    1. Collect at least 5–10 seconds of EEG (1280–2560 samples at 256 Hz).
    2. POST the samples as a JSON array of shape [T, 4] (P4, Cz, F8, T7).
    3. Include the claimed username, subject_id, and optional threshold.

    The API will:
    - Validate input dimensions and apply anti-spoofing checks.
    - Apply bandpass (0.5–40 Hz) + 50 Hz notch filtering.
    - Reject motion artifacts via z-score analysis.
    - Segment, scale, and classify with the trained CNN.
    - Return a majority-vote authentication decision.
    """
    if not MODEL_PATH.exists():
        raise HTTPException(
            status_code=503, detail="Model not trained yet. Train via POST /api/model/train."
        )

    # Dimension / size validation
    T = len(payload.eeg_data)
    if T == 0:
        raise HTTPException(status_code=400, detail="eeg_data is empty.")
    if T > MAX_HARDWARE_SAMPLES:
        raise HTTPException(
            status_code=413,
            detail=f"eeg_data too large: {T} samples (max {MAX_HARDWARE_SAMPLES}).",
        )
    n_ch = len(payload.eeg_data[0]) if T > 0 else 0
    if n_ch != len(CHANNELS):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Expected {len(CHANNELS)} channels ({CHANNELS}), got {n_ch}. "
                "Ensure column order matches the configured CHANNELS."
            ),
        )

    try:
        raw = np.array(payload.eeg_data, dtype=np.float32)
    except (ValueError, OverflowError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid eeg_data values: {exc}") from exc

    # Preprocess: filter + segment + artifact rejection
    try:
        segments = preprocess_raw_eeg(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if len(segments) == 0:
        return ApiResponse(
            success=False,
            message="No valid EEG segments found after preprocessing. Check signal quality.",
            data={"samples_received": T, "segments_extracted": 0},
        )

    # Delegate to backend's existing authentication pipeline
    is_auth, reason = backend.authenticate(
        username_claim=payload.username.strip(),
        file_path=None,           # signal already preprocessed
        threshold=payload.threshold,
        precomputed_segments=segments,
    )

    return ApiResponse(
        success=is_auth,
        message=reason,
        data={
            "username": payload.username,
            "subject_id": payload.subject_id,
            "threshold": payload.threshold,
            "samples_received": T,
            "segments_evaluated": int(len(segments)),
        },
    )


# ---------------------------------------------------------------------------
# WebSocket — live hardware streaming
# ---------------------------------------------------------------------------

@app.websocket("/ws/stream")
async def websocket_stream(ws: WebSocket):
    """
    WebSocket endpoint for real-time EEG hardware streaming.

    Protocol (JSON messages):
    ─────────────────────────
    CLIENT → SERVER  (handshake):
        { "type": "init",
          "username": "alice",
          "subject_id": 1,
          "threshold": 0.90 }

    CLIENT → SERVER  (data chunk, repeat as needed):
        { "type": "data",
          "samples": [[p4, cz, f8, t7], ...] }   ← list of rows

    CLIENT → SERVER  (trigger classification):
        { "type": "predict" }

    SERVER → CLIENT:
        { "type": "result",
          "success": true|false,
          "message": "...",
          "samples_received": N,
          "segments_evaluated": M }

    SERVER → CLIENT  (error):
        { "type": "error", "detail": "..." }
    """
    await ws.accept()
    username = None
    subject_id = None
    threshold = 0.90
    buffer: list = []

    try:
        while True:
            raw_msg = await ws.receive_text()
            try:
                msg = json.loads(raw_msg)
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "detail": "Invalid JSON"})
                continue

            mtype = msg.get("type")

            if mtype == "init":
                username = str(msg.get("username", "")).strip()
                subject_id = int(msg.get("subject_id", 0))
                threshold = float(msg.get("threshold", 0.90))
                buffer = []
                await ws.send_json({"type": "ready", "message": "Stream initialized. Send data chunks."})

            elif mtype == "data":
                samples = msg.get("samples", [])
                if not isinstance(samples, list):
                    await ws.send_json({"type": "error", "detail": "samples must be a list"})
                    continue
                buffer.extend(samples)
                if len(buffer) > MAX_HARDWARE_SAMPLES:
                    buffer = buffer[-MAX_HARDWARE_SAMPLES:]  # keep only latest window
                await ws.send_json({"type": "ack", "buffered_samples": len(buffer)})

            elif mtype == "predict":
                if not username or subject_id is None:
                    await ws.send_json({"type": "error", "detail": "Send 'init' first."})
                    continue
                if len(buffer) < 256:
                    await ws.send_json({
                        "type": "error",
                        "detail": f"Not enough data: {len(buffer)} samples (need ≥256).",
                    })
                    continue

                try:
                    raw_arr = np.array(buffer, dtype=np.float32)
                    segments = preprocess_raw_eeg(raw_arr)
                    if len(segments) == 0:
                        await ws.send_json({
                            "type": "result",
                            "success": False,
                            "message": "No clean segments found — check signal quality.",
                            "samples_received": len(buffer),
                            "segments_evaluated": 0,
                        })
                    else:
                        is_auth, reason = backend.authenticate(
                            username_claim=username,
                            file_path=None,
                            threshold=threshold,
                            precomputed_segments=segments,
                        )
                        await ws.send_json({
                            "type": "result",
                            "success": is_auth,
                            "message": reason,
                            "samples_received": len(buffer),
                            "segments_evaluated": int(len(segments)),
                        })
                except Exception as exc:
                    logger.exception("WebSocket predict error")
                    await ws.send_json({"type": "error", "detail": str(exc)})

                buffer = []  # reset buffer after prediction

            else:
                await ws.send_json({"type": "error", "detail": f"Unknown message type: {mtype}"})

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@app.get("/api/dashboard", tags=["Dashboard"])
def dashboard() -> dict[str, Any]:
    data_files = 0
    if DATA_DIR.exists():
        data_files = len([f for f in os.listdir(DATA_DIR) if f.endswith(".csv")])
    model_size = 0.0
    if MODEL_PATH.exists():
        model_size = round(MODEL_PATH.stat().st_size / (1024 * 1024), 2)
    return {
        "model_ready": MODEL_PATH.exists(),
        "model_size_mb": model_size,
        "data_directory_ready": DATA_DIR.exists(),
        "data_files": data_files,
        "auth_stats": db.get_auth_stats(),
        "users": _safe(db.get_users()),
    }


@app.get("/api/auth-logs", tags=["Dashboard"])
def auth_logs(limit: int = 50) -> dict[str, Any]:
    """Return recent authentication log entries."""
    if not db.available:
        return {"logs": []}
    try:
        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT username, success, confidence, reason, timestamp "
            "FROM auth_logs ORDER BY timestamp DESC LIMIT %s",
            (min(limit, 200),),
        )
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return {
            "logs": [
                {
                    "username": r[0],
                    "success": bool(r[1]),
                    "confidence": float(r[2]) if r[2] is not None else 0,
                    "reason": r[3] or "",
                    "timestamp": r[4].isoformat() if r[4] else "",
                }
                for r in rows
            ]
        }
    except Exception:
        return {"logs": []}


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

@app.get("/api/metrics", tags=["Metrics"])
def metrics(threshold: float = 0.90) -> dict[str, Any]:
    result, error = evaluate_real_model()
    if error:
        raise HTTPException(status_code=400, detail=error)

    y_true, y_scores = result
    visualizer = MetricsVisualizer()
    m = visualizer.calculate_authentication_metrics(y_true, y_scores, threshold)

    return {
        "threshold": threshold,
        "sample_count": int(len(y_true)),
        "metrics": _safe(m),
    }


# ---------------------------------------------------------------------------
# Serve frontend build if present
# ---------------------------------------------------------------------------

if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")



# ---------- Pydantic models ----------

class RegisterUserRequest(BaseModel):
    username: str = Field(min_length=1, max_length=128)
    subject_id: int = Field(ge=1, le=999)


class ApiResponse(BaseModel):
    success: bool
    message: str
    data: dict[str, Any] | None = None


# ---------- Helpers ----------

def _safe(value: Any) -> Any:
    """Recursively convert numpy/torch types to JSON-safe Python builtins."""
    if hasattr(value, "tolist"):
        return value.tolist()
    if isinstance(value, dict):
        return {k: _safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_safe(v) for v in value]
    return value


# ---------- Health ----------

@app.get("/api/health", tags=["System"])
def health() -> dict[str, Any]:
    data_files = 0
    if DATA_DIR.exists():
        data_files = len([f for f in os.listdir(DATA_DIR) if f.endswith(".csv")])
    return {
        "status": "ok",
        "model_ready": MODEL_PATH.exists(),
        "registered_users": len(backend.get_registered_users()),
        "data_files": data_files,
        "db_available": db.available,
    }


# ---------- Users ----------

@app.get("/api/users", tags=["Users"])
def list_users() -> dict[str, Any]:
    users = backend.get_registered_users()
    details: list[dict[str, Any]] = []
    for username in users:
        info = backend.get_user_info(username)
        if info:
            safe_info = _safe(info)
            if "data_shape" in safe_info and not isinstance(safe_info["data_shape"], (list, str)):
                safe_info["data_shape"] = str(safe_info["data_shape"])
            details.append(safe_info)
    return {"users": details}


@app.get("/api/users/{username}", tags=["Users"])
def get_user(username: str) -> dict[str, Any]:
    info = backend.get_user_info(username)
    if not info:
        raise HTTPException(status_code=404, detail=f"User '{username}' not found")
    return {"user": _safe(info)}


@app.post("/api/users/register", response_model=ApiResponse, tags=["Users"])
def register_user(payload: RegisterUserRequest) -> ApiResponse:
    success, message = backend.register_user(payload.username.strip(), payload.subject_id)
    return ApiResponse(success=success, message=message)


@app.delete("/api/users/{username}", response_model=ApiResponse, tags=["Users"])
def delete_user(username: str) -> ApiResponse:
    success, message = backend.deregister_user(username)
    return ApiResponse(success=success, message=message)


# ---------- Model ----------

@app.post("/api/model/train", response_model=ApiResponse, tags=["Model"])
def train_model() -> ApiResponse:
    users = backend.get_registered_users()
    if len(users) < 2:
        return ApiResponse(success=False, message=f"Need at least 2 users to train. Currently {len(users)} registered.")
    success = backend.train_model()
    if success:
        return ApiResponse(success=True, message="Training completed and model assets saved.")
    return ApiResponse(success=False, message="Training failed. Check server logs for details.")


@app.get("/api/model/status", tags=["Model"])
def model_status() -> dict[str, Any]:
    model_exists = MODEL_PATH.exists()
    model_size = 0.0
    if model_exists:
        model_size = round(MODEL_PATH.stat().st_size / (1024 * 1024), 2)
    return {
        "trained": model_exists,
        "model_size_mb": model_size,
        "registered_users": len(backend.get_registered_users()),
    }


# ---------- Authentication ----------

@app.post("/api/authenticate", response_model=ApiResponse, tags=["Authentication"])
async def authenticate(
    file: UploadFile = File(...),
    username: str = Form(...),
    subject_id: int = Form(...),
    threshold: float = Form(0.90),
) -> ApiResponse:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="A valid EEG CSV file is required.")

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp:
            content = await file.read()
            tmp.write(content)
            temp_path = tmp.name

        is_auth, reason = backend.authenticate_with_subject_id(
            username_claim=username.strip(),
            gui_subject_id=subject_id,
            file_path=temp_path,
            threshold=threshold,
            original_filename=file.filename,
        )
        return ApiResponse(
            success=is_auth,
            message=reason,
            data={"username": username, "subject_id": subject_id, "threshold": threshold},
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Authentication error: {exc}") from exc
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


# ---------- Dashboard ----------

@app.get("/api/dashboard", tags=["Dashboard"])
def dashboard() -> dict[str, Any]:
    data_files = 0
    if DATA_DIR.exists():
        data_files = len([f for f in os.listdir(DATA_DIR) if f.endswith(".csv")])
    model_size = 0.0
    if MODEL_PATH.exists():
        model_size = round(MODEL_PATH.stat().st_size / (1024 * 1024), 2)
    return {
        "model_ready": MODEL_PATH.exists(),
        "model_size_mb": model_size,
        "data_directory_ready": DATA_DIR.exists(),
        "data_files": data_files,
        "auth_stats": db.get_auth_stats(),
        "users": _safe(db.get_users()),
    }


@app.get("/api/auth-logs", tags=["Dashboard"])
def auth_logs(limit: int = 50) -> dict[str, Any]:
    """Return recent authentication log entries."""
    if not db.available:
        return {"logs": []}
    try:
        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT username, success, confidence, reason, timestamp "
            "FROM auth_logs ORDER BY timestamp DESC LIMIT %s",
            (min(limit, 200),),
        )
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return {
            "logs": [
                {
                    "username": r[0],
                    "success": bool(r[1]),
                    "confidence": float(r[2]) if r[2] is not None else 0,
                    "reason": r[3] or "",
                    "timestamp": r[4].isoformat() if r[4] else "",
                }
                for r in rows
            ]
        }
    except Exception:
        return {"logs": []}


# ---------- Metrics ----------

@app.get("/api/metrics", tags=["Metrics"])
def metrics(threshold: float = 0.90) -> dict[str, Any]:
    result, error = evaluate_real_model()
    if error:
        raise HTTPException(status_code=400, detail=error)

    y_true, y_scores = result
    visualizer = MetricsVisualizer()
    m = visualizer.calculate_authentication_metrics(y_true, y_scores, threshold)

    return {
        "threshold": threshold,
        "sample_count": int(len(y_true)),
        "metrics": _safe(m),
    }


# ---------- Serve frontend build if present ----------

if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")

