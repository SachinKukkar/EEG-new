from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Ensure project root is importable
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import backend  # noqa: E402
from database import db  # noqa: E402
from metrics_visualizer import MetricsVisualizer, evaluate_real_model  # noqa: E402

MODEL_PATH = PROJECT_ROOT / "assets" / "model.pth"
DATA_DIR = PROJECT_ROOT / "data" / "Filtered_Data"
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"

app = FastAPI(
    title="EEG Biometric Authentication API",
    version="2.0.0",
    description="Production API for real EEG-based biometric authentication using deep learning.",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Pydantic models ----------

class RegisterUserRequest(BaseModel):
    username: str = Field(min_length=1, max_length=128)
    subject_id: int = Field(ge=1, le=999)


class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None


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
def health() -> Dict[str, Any]:
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
def list_users() -> Dict[str, Any]:
    users = backend.get_registered_users()
    details: List[Dict[str, Any]] = []
    for username in users:
        info = backend.get_user_info(username)
        if info:
            safe_info = _safe(info)
            if "data_shape" in safe_info and not isinstance(safe_info["data_shape"], (list, str)):
                safe_info["data_shape"] = str(safe_info["data_shape"])
            details.append(safe_info)
    return {"users": details}


@app.get("/api/users/{username}", tags=["Users"])
def get_user(username: str) -> Dict[str, Any]:
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
def model_status() -> Dict[str, Any]:
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
def dashboard() -> Dict[str, Any]:
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
def auth_logs(limit: int = 50) -> Dict[str, Any]:
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
def metrics(threshold: float = 0.90) -> Dict[str, Any]:
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

