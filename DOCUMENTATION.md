# EEG Biometric Authentication System — Technical Documentation

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [System Components](#system-components)
3. [API Reference](#api-reference)
4. [Data Pipeline](#data-pipeline)
5. [Machine Learning Model](#machine-learning-model)
6. [Database Schema](#database-schema)
7. [Frontend Architecture](#frontend-architecture)
8. [Deployment Guide](#deployment-guide)
9. [Configuration Reference](#configuration-reference)
10. [Security Considerations](#security-considerations)

---

## Architecture Overview

The system follows a **layered API-first architecture** enabling clean separation between frontend, API, and ML backend.

```
┌───────────────────────────┐
│   React Frontend (Vite)   │  Port 5173 (dev) or served from /dist
├───────────────────────────┤
│   FastAPI REST Layer      │  Port 8000
├───────────────────────────┤
│   Business Logic          │  backend.py (registration, training, auth)
├───────────────────────────┤
│   ML Engine               │  PyTorch CNN (model_management.py)
│   EEG Processing          │  eeg_processing.py
│   Metrics                 │  metrics_visualizer.py
├───────────────────────────┤
│   Storage                 │
│   ├─ MySQL (auth logs)    │  database.py
│   ├─ JSON (user registry) │  assets/users.json
│   └─ NumPy (EEG data)    │  assets/data_*.npy
└───────────────────────────┘
```

### Request flow

1. Frontend sends HTTP requests to FastAPI endpoints.
2. FastAPI routes call functions in `backend.py`.
3. `backend.py` orchestrates `eeg_processing.py` (data loading/segmentation), `model_management.py` (model loading/inference), and `database.py` (persistence).
4. Responses are JSON-serialized and returned to the frontend.

---

## System Components

### File Map

| File | Purpose |
|------|---------|
| `api/main.py` | FastAPI application — all REST endpoints |
| `api/__init__.py` | Package marker |
| `backend.py` | Core business logic (register, train, authenticate) |
| `database.py` | MySQL database wrapper with graceful fallback |
| `db_config.py` | MySQL connection parameters |
| `config.py` | Application-wide constants |
| `eeg_processing.py` | EEG file discovery and sliding-window segmentation |
| `model_management.py` | CNN model definition (`EEG_CNN_Improved`) + weight loading |
| `metrics_visualizer.py` | Holdout evaluation + metric computation |
| `frontend/` | React + Vite single-page application |
| `setup_mysql.sql` | Database initialization DDL |
| `requirements.txt` | Python dependencies |

### Key Constants (config.py)

| Constant | Value | Description |
|----------|-------|-------------|
| `CHANNELS` | `['P4', 'Cz', 'F8', 'T7']` | EEG electrode channels used |
| `WINDOW_SIZE` | `256` | Samples per segment |
| `STEP_SIZE` | `128` | Sliding window step |
| `SAMPLING_RATE` | `256` | Hz |

---

## API Reference

Base URL: `http://localhost:8000`

Interactive docs: `http://localhost:8000/docs` (Swagger UI)

### System

#### `GET /api/health`

Returns service status.

**Response:**
```json
{
  "status": "ok",
  "model_ready": true,
  "registered_users": 3,
  "data_files": 120,
  "db_available": true
}
```

### Users

#### `GET /api/users`

Lists all registered users with details.

**Response:**
```json
{
  "users": [
    {
      "username": "alice",
      "subject_id": 1,
      "data_segments": 45,
      "data_exists": true
    }
  ]
}
```

#### `GET /api/users/{username}`

Get single user details. Returns `404` if not found.

#### `POST /api/users/register`

Register a new user by mapping a username to a subject ID.

**Request Body:**
```json
{
  "username": "alice",
  "subject_id": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "User 'alice' registered successfully with 45 EEG segments.",
  "data": null
}
```

**Validation:**
- `username`: 1–128 characters
- `subject_id`: 1–999; must match CSV files in `data/Filtered_Data/`

#### `DELETE /api/users/{username}`

Remove a registered user and their stored EEG data.

### Model

#### `POST /api/model/train`

Train the CNN on all registered users' EEG data. Requires ≥ 2 users.

**Response:**
```json
{
  "success": true,
  "message": "Training completed and model assets saved.",
  "data": null
}
```

Training details:
- Optimizer: AdamW (lr=0.001, weight_decay=1e-4)
- Loss: CrossEntropyLoss
- Epochs: up to 50 with early stopping (patience=5)
- Saves: `assets/model.pth`, `assets/scaler.joblib`, `assets/label_encoder.joblib`

#### `GET /api/model/status`

**Response:**
```json
{
  "trained": true,
  "model_size_mb": 1.24,
  "registered_users": 3
}
```

### Authentication

#### `POST /api/authenticate`

Authenticate a user from an uploaded EEG CSV file.

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | EEG CSV file (.csv) |
| `username` | string | Yes | Claimed identity |
| `subject_id` | integer | Yes | Subject ID matching CSV filename |
| `threshold` | float | No | Confidence threshold (default: 0.90) |

**Response:**
```json
{
  "success": true,
  "message": "Authenticated as 'alice' — 89% of segments matched with avg confidence 0.95.",
  "data": {
    "username": "alice",
    "subject_id": 1,
    "threshold": 0.90
  }
}
```

**Authentication pipeline:**

1. Validate that `subject_id` matches the uploaded filename pattern `s{id}_ex*.csv`.
2. Load CSV, extract 4 EEG channels, apply sliding-window segmentation.
3. Scale each segment using the saved `StandardScaler`.
4. Run CNN inference on every segment → softmax probabilities.
5. For each segment, check if predicted class == claimed user AND confidence ≥ threshold.
6. Majority vote across all segments determines final result.

### Dashboard

#### `GET /api/dashboard`

Aggregated system overview.

**Response:**
```json
{
  "model_ready": true,
  "model_size_mb": 1.24,
  "data_directory_ready": true,
  "data_files": 120,
  "auth_stats": {
    "total_attempts": 15,
    "successful": 12,
    "failed": 3,
    "success_rate": 0.80,
    "avg_confidence": 0.92
  },
  "users": [...]
}
```

#### `GET /api/auth-logs?limit=50`

Recent authentication log entries (requires MySQL).

### Metrics

#### `GET /api/metrics?threshold=0.90`

Evaluate the trained model on a deterministic holdout set (last 20% of each user's EEG segments).

**Response:**
```json
{
  "threshold": 0.90,
  "sample_count": 128,
  "metrics": {
    "Accuracy": 0.96,
    "Precision": 0.95,
    "Recall": 0.97,
    "F1": 0.96,
    "AUC": 0.993,
    "FAR": 0.02,
    "FRR": 0.03,
    "EER": 0.025
  }
}
```

---

## Data Pipeline

### EEG Data Format

Source CSV files reside in `data/Filtered_Data/` with naming convention:

```
s{subject_id:02d}_ex{exercise}_{session}.csv
```

Example: `s01_ex01_s01.csv` = Subject 1, Exercise 1, Session 1

Each CSV contains columns for EEG channels. The system uses **4 channels**: P4, Cz, F8, T7.

### Segmentation

```
Raw CSV → extract 4 channels → sliding window (size=256, step=128) → segments
```

Each segment has shape `(4, 256)` — 4 channels × 256 time samples.

### Registration Flow

1. `register_user(username, subject_id)` discovers all CSV files for the subject.
2. Each CSV is loaded and segmented.
3. All segments are concatenated into a single NumPy array.
4. Saved as `assets/data_{username}.npy`.
5. User metadata recorded in `assets/users.json`.

### Training Flow

1. Load all registered users' `.npy` data.
2. Fit a `StandardScaler` across all data.
3. Fit a `LabelEncoder` for username → integer label mapping.
4. Train `EEG_CNN_Improved` with AdamW + early stopping.
5. Save `model.pth`, `scaler.joblib`, `label_encoder.joblib` to `assets/`.

---

## Machine Learning Model

### Architecture: `EEG_CNN_Improved`

```
Input: (batch, 4, 256) — 4 EEG channels, 256 time steps

Block 1: Conv1d(4→32, k=7, p=3) → BN → ReLU → MaxPool1d(2)
Block 2: Conv1d(32→64, k=5, p=2) → BN → ReLU → MaxPool1d(2)
Block 3: Conv1d(64→128, k=3, p=1) → BN → ReLU → MaxPool1d(2)
Block 4: Conv1d(128→256, k=3, p=1) → BN → ReLU → AdaptiveAvgPool1d(1)

Flatten → Linear(256→128) → ReLU → Dropout(0.5) → Linear(128→num_classes)
```

### Training Hyperparameters

| Parameter | Value |
|-----------|-------|
| Optimizer | AdamW |
| Learning rate | 0.001 |
| Weight decay | 1e-4 |
| Batch size | 32 |
| Max epochs | 50 |
| Early stopping patience | 5 |
| Loss function | CrossEntropyLoss |

### Evaluation

The `evaluate_real_model()` function:

1. Loads all registered users' stored EEG data.
2. Splits each user's data deterministically: first 80% for training context, last 20% as holdout.
3. Runs inference on the holdout set.
4. Computes binary authentication scores (genuine vs. impostor) for all user pairs.

Metrics computed: Accuracy, Precision, Recall, F1, AUC-ROC, FAR, FRR, EER.

---

## Database Schema

MySQL database `eeg_biometric` with three tables:

### `users`
```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(128) UNIQUE NOT NULL,
    subject_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### `auth_logs`
```sql
CREATE TABLE auth_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(128) NOT NULL,
    success BOOLEAN NOT NULL,
    confidence FLOAT,
    reason TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### `settings`
```sql
CREATE TABLE settings (
    setting_key VARCHAR(64) PRIMARY KEY,
    setting_value TEXT
);
```

**Graceful degradation:** If MySQL is unavailable, the system continues using JSON file storage. Database features (auth logging, stats) are silently disabled.

---

## Frontend Architecture

### Stack

- **React 18** — UI library
- **Vite 5** — Build tool and dev server
- **Axios** — HTTP client

### Structure

```
frontend/
├── index.html          # HTML entry point (loads Google Fonts)
├── package.json        # Dependencies and scripts
├── vite.config.js      # Vite configuration
└── src/
    ├── main.jsx        # React DOM mount
    ├── App.jsx         # Main application (all tabs)
    ├── styles.css      # Complete stylesheet
    └── api/
        └── client.js   # API client (all endpoint wrappers)
```

### Tabs

| Tab | Description |
|-----|-------------|
| Overview | System health, model status, registered users table |
| Users | Register/delete users, user cards with data details |
| Training | Train model with user count validation |
| Authentication | Upload EEG CSV, get pass/fail result with details |
| Metrics | Evaluate model on holdout data with configurable threshold |
| Auth Logs | View authentication history (requires MySQL) |

### API Client

All API calls go through `frontend/src/api/client.js`. The base URL defaults to `http://127.0.0.1:8000` and can be overridden via the `VITE_API_BASE_URL` environment variable.

---

## Deployment Guide

### Development Setup

```bash
# 1. Clone and enter project
git clone <repository-url>
cd EEG-copy

# 2. Python environment
python -m venv myenv
myenv\Scripts\activate          # Windows
# source myenv/bin/activate     # Linux/macOS

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. (Optional) Setup MySQL
mysql -u root -p < setup_mysql.sql

# 5. Start API server
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload

# 6. In another terminal — start frontend dev server
cd frontend
npm install
npm run dev
```

### Production Deployment

```bash
# 1. Build frontend
cd frontend
npm run build        # outputs to frontend/dist/

# 2. Run API (serves frontend/dist/ automatically)
cd ..
uvicorn api.main:app --host 0.0.0.0 --port 8000 --workers 4
```

When `frontend/dist/` exists, the FastAPI app mounts it as a static file server at `/`, so the entire application is served from port 8000.

### Batch Scripts

| Script | Purpose |
|--------|---------|
| `run_api.bat` | Start FastAPI backend |
| `run_frontend.bat` | Start Vite dev server |

### Environment Variables

| Variable | Where | Default | Description |
|----------|-------|---------|-------------|
| `VITE_API_BASE_URL` | `frontend/.env` | `http://127.0.0.1:8000` | Backend API URL |

---

## Configuration Reference

### db_config.py

```python
DB_CONFIG = {
    'host': 'localhost',
    'user': 'eeg_user',
    'password': '5911',
    'database': 'eeg_biometric',
    'port': 3306
}
```

### Model Parameters (backend.py)

| Parameter | Default | Location |
|-----------|---------|----------|
| `num_epochs` | 50 | `backend.py` → `train_model()` |
| `batch_size` | 32 | `backend.py` → `train_model()` |
| `learning_rate` | 0.001 | `backend.py` → `train_model()` |
| `early_stopping_patience` | 5 | `backend.py` → `train_model()` |

### Authentication Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `threshold` | 0.90 | Minimum softmax confidence to accept a segment |
| Majority vote | >50% | Segments matching ≥ 50% → authenticated |

---

## Security Considerations

1. **No simulation data**: All authentication uses real EEG segments only. Random/dummy code paths have been removed.
2. **Subject ID validation**: The `authenticate_with_subject_id()` function enforces that the GUI-provided subject ID matches the uploaded CSV filename pattern, preventing trivial impersonation.
3. **Input validation**: FastAPI Pydantic models enforce type and range constraints on all inputs.
4. **File handling**: Uploaded files are written to OS-managed temp directories and deleted immediately after processing.
5. **CORS**: Currently configured with `allow_origins=["*"]` for development. Restrict to your domain in production.
6. **Database credentials**: Stored in `db_config.py`. For production, use environment variables instead.
7. **Graceful degradation**: If MySQL is unreachable, the system continues operating with file-based storage. Auth logging is silently skipped.

### Production Hardening Checklist

- [ ] Set specific CORS origins instead of `*`
- [ ] Move database credentials to environment variables
- [ ] Run behind a reverse proxy (nginx/Caddy) with HTTPS
- [ ] Restrict API access with rate limiting
- [ ] Enable access logging
- [ ] Set `--workers` appropriately for uvicorn
