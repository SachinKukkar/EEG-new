# Progress Report — EEG Biometric Authentication System
**Date:** 8 March 2026  
**Version:** 3.0.0  
**Prepared for:** Project Mentor

---

## 1. Executive Summary

Today's session focused on three goals:
1. Making the system **deployment-ready** as a production API.
2. Adding **real hardware EEG device support** (both REST and WebSocket).
3. Improving **signal robustness** against noisy real-world EEG data.

All changes were made to the existing codebase without breaking any existing functionality. The CSV-file-based authentication workflow still works exactly as before; hardware support is additive.

---

## 2. What We Built Today

### 2.1 Hardware Integration (New)

The system can now receive EEG data **directly from a hardware headset** without needing a pre-recorded CSV file. Two interfaces were added:

#### REST Endpoint: `POST /api/authenticate/raw`
```json
{
  "username": "alice",
  "subject_id": 1,
  "eeg_data": [[p4, cz, f8, t7], ...],
  "threshold": 0.90
}
```
- Client collects 5–10 seconds of EEG (1280–2560 samples at 256 Hz).
- Sends raw samples as a JSON array of shape `[T][4]`.
- The API filters, segments, and classifies in one call.
- Compatible with any hardware SDK: OpenBCI, BrainFlow, Emotiv, NeuroSky, etc.

#### WebSocket Endpoint: `ws://host:8000/ws/stream`
For lower-latency streaming:
1. Client sends `{ "type": "init", "username": ..., "subject_id": ... }`.
2. Client streams chunks: `{ "type": "data", "samples": [[...], ...] }`.
3. Client sends `{ "type": "predict" }` to trigger classification.
4. Server replies with `{ "type": "result", "success": true/false, "message": "..." }`.

Both endpoints appear in the auto-generated API docs at `/docs`.

---

### 2.2 Noise Robustness (Enhanced `eeg_processing.py`)

Real-world EEG from portable hardware is significantly noisier than clean lab recordings. Three layers of protection were added:

| Layer | What it does | Catches |
|---|---|---|
| **Bandpass filter** 0.5–40 Hz (4th-order Butterworth) | Removes DC drift and high-frequency EMG noise | Slow drift, muscle artefacts above 40 Hz |
| **Notch filter** 50 Hz (IIR, Q=30) | Removes mains/power-line interference | 50 Hz hum (or 60 Hz — configurable) |
| **Artifact rejection** per segment | Peak-to-peak < 150 µV, per-channel z-score < 4σ, flat-channel check | Eye blinks, electrode pops, saturation, loose contacts |

Filters use **SOS (second-order sections)** form — numerically stable for long signals. `sosfiltfilt` applies zero-phase (forwards + backwards) so no timing distortion.

**Fallback behaviour**: If all segments are rejected by the artifact filter (e.g. very noisy demo environment), the unfiltered segments are passed to the classifier rather than returning zero results. This ensures the system always gives an answer.

Verified with synthetic test:
```
Raw input : (1280, 4) — 5 seconds of sine-wave + Gaussian noise
Output    : (9, 256, 4) — 9 clean segments ready for CNN
```

---

### 2.3 Production Security Fixes

| Issue | Before | After |
|---|---|---|
| Database password | Hardcoded `'5911'` | Read from `DB_PASSWORD` env var |
| CORS policy | `allow_origins=["*"]` (open to all) | `ALLOWED_ORIGINS` env var (explicit list) |
| API key | None | Optional `API_KEY` env var; middleware enforces `X-API-Key` header |
| Docker user | Root | Non-root `appuser` (UID 1001) |
| Docker healthcheck | Used `requests` library | Uses Python stdlib `urllib.request` |
| `.env.example` | Only had Docker vars | Full template for all 15 config options |

---

### 2.4 Removed Desktop/Experimental Dependencies

The following packages were removed from `requirements.txt` — they were pulled in for early prototyping but are not used in the web API:

| Package removed | Reason |
|---|---|
| `PyQt5` | Desktop GUI framework, not used in API |
| `streamlit` | Rapid-prototype dashboard, replaced by React |
| `matplotlib` | Plotting — only `plotly` is used by the API |
| `seaborn` | Statistics plotting, unused |
| `reportlab` | PDF generation, unused |

**Added:**
- `websockets>=12.0` — required for the new WebSocket endpoint.
- `python-dotenv>=1.0.0` — loads `.env` in development automatically.
- `uvicorn[standard]` — WebSocket support in uvicorn.

---

### 2.5 Frontend: Hardware Streaming Tab (New)

A new **"Hardware" tab** was added to the React dashboard with:
- **REST mode**: Select any CSV with 4 columns (P4, Cz, F8, T7), click "Send to API" — no subject-ID filename matching required since the data is validated internally.
- **WebSocket mode**: Connect → Stream File → Predict — simulates live device streaming.
- **Integration guide panel** showing exact JSON formats for hardware developers.
- API client updated with `authenticateRaw()` and `createStreamSocket()` utility functions.

---

## 3. Architecture After Today's Changes

```
Hardware Device (OpenBCI / BrainFlow / custom)
       │
       ├─── POST /api/authenticate/raw  ──────────────────┐
       │    (REST, JSON, single shot)                      │
       │                                                   ▼
       └─── WebSocket /ws/stream  ────────────────► eeg_processing.py
                (streaming, real-time)                     │
                                                  preprocess_raw_eeg()
                                                  ├─ interpolate NaN/Inf
                                                  ├─ bandpass 0.5–40 Hz
                                                  ├─ notch 50 Hz
                                                  └─ artifact rejection
                                                           │
                                                           ▼
                                                      backend.py
                                                  authenticate()
                                                  ├─ load CNN + scaler
                                                  ├─ scale segments
                                                  ├─ majority vote
                                                  └─ log to MySQL
                                                           │
                                                    JSON response
                                                  { success, message,
                                                    segments_evaluated }

CSV File Upload (existing, unchanged)
       │
       └─── POST /api/authenticate  ──────────────────────┘
```

---

## 4. Deployment Recommendation

After evaluating cost, simplicity, GPU availability, and free-tier eligibility:

### Recommended: **Railway.app** (best for student/demo projects)
- Free tier: 500 hours/month, 512 MB RAM.
- Push Docker container via `railway up` or GitHub integration.
- Managed MySQL add-on included.
- WebSocket support built-in.
- **Steps**: Create `.env` from `.env.example` → `railway up` → done.

### Alternative: **Render.com**
- Free tier for web services (spins down after inactivity).
- Docker-based deploy, PostgreSQL add-on.
- Good WebSocket support.

### For Production Scale: **AWS / GCP / Azure**
- Use EC2 (AWS) or Cloud Run (GCP) for the backend.
- RDS (MySQL) for the database.
- CloudFront / Cloud CDN for the React frontend.
- If GPU needed for faster inference: EC2 `g4dn.xlarge` (NVIDIA T4).

### Local Demo (current dev setup)
```bash
# Backend
cd EEG-copy
cp .env.example .env   # fill in DB_PASSWORD
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev            # http://localhost:5173
```

### Docker (one command)
```bash
cp .env.example .env   # fill in passwords
docker-compose up --build
# Backend: http://localhost:8000
# Frontend: http://localhost:80
# API docs: http://localhost:8000/docs
```

---

## 5. Files Changed

| File | Change |
|---|---|
| `eeg_processing.py` | Complete rewrite — added bandpass, notch, artifact rejection, hardware pipeline |
| `api/main.py` | Added hardware REST + WebSocket endpoints, fixed CORS, added API-key middleware |
| `backend.py` | `authenticate()` accepts `precomputed_segments` kwarg for hardware path |
| `config.py` | All config now from environment variables |
| `db_config.py` | DB credentials from env vars (removed hardcoded password) |
| `frontend/src/api/client.js` | Added `authenticateRaw()`, `createStreamSocket()`, API key header |
| `frontend/src/App.jsx` | Added Hardware Streaming tab with REST + WebSocket mode |
| `requirements.txt` | Removed 5 unused packages, added `websockets`, `python-dotenv` |
| `docker-compose.yml` | Removed insecure default passwords, added all env vars |
| `Dockerfile.backend` | Non-root user, better healthcheck |
| `.env.example` | Complete template for all configuration |
| `CHANGELOG.md` | v3.0.0 release notes |

**Files removed:** `run_api.bat`, `run_frontend.bat`

---

## 6. How to Test Hardware Integration

### Quick test with synthetic data (no hardware needed)
```python
import requests, numpy as np

# Simulate 5 seconds of EEG at 256 Hz
t = np.linspace(0, 5, 256*5)
eeg = np.column_stack([
    np.sin(2*3.14*10*t),  # P4
    np.sin(2*3.14*12*t),  # Cz
    np.sin(2*3.14*8*t),   # F8
    np.sin(2*3.14*15*t),  # T7
])

response = requests.post("http://localhost:8000/api/authenticate/raw", json={
    "username": "alice",
    "subject_id": 1,
    "eeg_data": eeg.tolist(),
    "threshold": 0.90
})
print(response.json())
```

### With real BrainFlow hardware
```python
import brainflow
from brainflow.board_shim import BoardShim, BrainFlowInputParams
import requests

params = BrainFlowInputParams()
board = BoardShim(BoardIds.CYTON_BOARD, params)
board.prepare_session()
board.start_stream()
import time; time.sleep(10)  # collect 10 seconds

data = board.get_board_data()
eeg_channels = BoardShim.get_eeg_channels(BoardIds.CYTON_BOARD)
# Select channels matching P4, Cz, F8, T7 and reorder
eeg = data[eeg_channels[:4]].T.tolist()
board.stop_stream(); board.release_session()

response = requests.post("http://localhost:8000/api/authenticate/raw", json={
    "username": "alice", "subject_id": 1, "eeg_data": eeg
})
print(response.json())
```

---

## 7. Next Steps (Suggested)

1. **Register with real hardware**: Use `POST /api/users/register` with subject IDs matched to real hardware recordings.
2. **Retrain after hardware data collection**: Train the CNN on hardware-recorded data for best hardware-to-model match.
3. **Calibration session**: Add a 30-second resting-state calibration flow on the frontend.
4. **Deploy to Railway/Render**: Set env vars, push, domain is live.
5. **Per-IP rate limiting**: Consider `slowapi` library on the `/api/authenticate` endpoints.

---

*Report generated automatically — EEG Biometric Authentication System v3.0.0*
