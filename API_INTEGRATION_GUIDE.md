# EEG Biometric Authentication — Frontend Integration Guide

**Version:** 3.0.0  
**Backend:** FastAPI (Python)  
**For:** Frontend Developers

---

## 1. Getting Started

### Base URL
```
http://<backend-host>:8000
```
For local development: `http://localhost:8000`

### Set your environment variable
Create a `.env.local` file in the `frontend/` folder:
```
VITE_API_BASE_URL=http://localhost:8000
```
That's the only config you need. All API calls will automatically use this URL.

### Interactive API Docs
Once the backend is running, open these in your browser:
- **Swagger UI** (try all endpoints live): `http://localhost:8000/docs`
- **ReDoc** (clean reference): `http://localhost:8000/redoc`

---

## 2. Ready-Made API Client

The file `frontend/src/api/client.js` already contains all API functions ready to import:

```js
import {
  getHealth,
  getUsers, registerUser, deleteUser,
  trainModel, getModelStatus,
  authenticateUser,        // CSV file upload
  authenticateRaw,         // raw hardware data (JSON)
  createStreamSocket,      // WebSocket live stream
  getDashboard,
  getMetrics,
  getAuthLogs,
} from "./api/client";
```

Just import what you need — no setup required.

---

## 3. API Endpoints Reference

### System

#### `GET /api/health`
Check if the backend is alive and ready.

**Response:**
```json
{
  "status": "ok",
  "model_ready": true,
  "registered_users": 6,
  "data_files": 72,
  "db_available": true,
  "channels": ["P4", "Cz", "F8", "T7"],
  "hardware_endpoint": "/api/authenticate/raw",
  "websocket_endpoint": "/ws/stream"
}
```

**Client function:**
```js
const health = await getHealth();
if (health.model_ready) { /* model trained and ready */ }
```

---

### Users

#### `GET /api/users`
Get all registered users.

**Response:**
```json
{
  "users": [
    {
      "username": "alice",
      "subject_id": 1,
      "data_exists": true,
      "data_segments": 45
    }
  ]
}
```

**Client function:**
```js
const users = await getUsers(); // returns array of user objects
```

---

#### `GET /api/users/{username}`
Get a single user's details.

**Response:**
```json
{
  "user": {
    "username": "alice",
    "subject_id": 1,
    "data_exists": true,
    "data_segments": 45,
    "data_shape": [45, 256, 4]
  }
}
```

---

#### `POST /api/users/register`
Register a new user.

**Request body (JSON):**
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
  "message": "User alice registered successfully with 45 data segments"
}
```

**Client function:**
```js
const result = await registerUser({ username: "alice", subject_id: 1 });
if (result.success) { /* registered */ }
```

> **Note:** `subject_id` must match the number in the EEG CSV filenames (e.g. `s01_...csv` → subject_id = 1).

---

#### `DELETE /api/users/{username}`
Remove a registered user and their data.

**Response:**
```json
{
  "success": true,
  "message": "User 'alice' de-registered successfully"
}
```

**Client function:**
```js
const result = await deleteUser("alice");
```

---

### Model Training

#### `POST /api/model/train`
Train the CNN classifier on all registered users' EEG data.  
⚠️ Requires at least **2 registered users**. This may take a few minutes.

**Response:**
```json
{
  "success": true,
  "message": "Training completed and model assets saved."
}
```

**Client function:**
```js
const result = await trainModel();
```

---

#### `GET /api/model/status`
Check if the model has been trained.

**Response:**
```json
{
  "trained": true,
  "model_size_mb": 2.45,
  "registered_users": 6
}
```

**Client function:**
```js
const status = await getModelStatus();
if (status.trained) { /* can authenticate */ }
```

---

### Authentication

#### `POST /api/authenticate`
Authenticate using an uploaded EEG CSV file.

**Request:** `multipart/form-data` with these fields:

| Field | Type | Description |
|---|---|---|
| `file` | File | EEG CSV file (columns: P4, Cz, F8, T7) |
| `username` | string | Claimed username |
| `subject_id` | integer | Subject ID (must match registered ID) |
| `threshold` | float | Confidence threshold, default `0.90` |

**Response:**
```json
{
  "success": true,
  "message": "ACCESS GRANTED: 8/10 segments matched 'alice' (Avg confidence: 0.94)",
  "data": {
    "username": "alice",
    "subject_id": 1,
    "threshold": 0.90
  }
}
```

**Client function:**
```js
const result = await authenticateUser({
  file: fileInputRef.current.files[0],  // File object from <input type="file">
  username: "alice",
  subjectId: 1,
  threshold: 0.90
});

if (result.success) {
  // ACCESS GRANTED
} else {
  // ACCESS DENIED — result.message explains why
}
```

---

#### `POST /api/authenticate/raw`
Authenticate using raw EEG data from hardware (no file needed).

**Request body (JSON):**
```json
{
  "username": "alice",
  "subject_id": 1,
  "eeg_data": [
    [0.12, -0.34, 0.56, -0.78],
    [0.15, -0.31, 0.52, -0.80],
    ...
  ],
  "threshold": 0.90
}
```

| Field | Type | Description |
|---|---|---|
| `username` | string | Claimed username |
| `subject_id` | integer | Subject ID |
| `eeg_data` | `number[][]` | 2D array — rows = time samples, cols = `[P4, Cz, F8, T7]` |
| `threshold` | float | Optional, default `0.90` |

> Minimum: ~1280 samples (5 seconds at 256 Hz). Maximum: 30720 samples (120 seconds).

**Response:**
```json
{
  "success": true,
  "message": "ACCESS GRANTED: 7/9 segments matched 'alice'",
  "data": {
    "username": "alice",
    "subject_id": 1,
    "threshold": 0.90,
    "samples_received": 1280,
    "segments_evaluated": 9
  }
}
```

**Client function:**
```js
const result = await authenticateRaw({
  eegData: [[p4, cz, f8, t7], ...],  // 2D array from hardware SDK
  username: "alice",
  subjectId: 1,
  threshold: 0.90
});
```

---

### WebSocket — Live Hardware Streaming

**Endpoint:** `ws://localhost:8000/ws/stream`

Use this for real-time authentication as the EEG device streams data continuously.

**Protocol (3 steps):**

**Step 1 — Connect & initialize**
```js
const ws = createStreamSocket({
  username: "alice",
  subjectId: 1,
  threshold: 0.90,
  onReady:  (msg) => console.log(msg.message),        // "Stream initialized. Send data chunks."
  onResult: (msg) => console.log(msg.success, msg.message),
  onError:  (msg) => console.error(msg.detail),
});
```

**Step 2 — Stream data chunks from hardware**
```js
// Call this repeatedly as data arrives from the EEG device
ws.sendChunk([[p4, cz, f8, t7], [p4, cz, f8, t7], ...]); // any number of rows per chunk
```

**Step 3 — Trigger classification**
```js
ws.predict(); // server classifies all buffered data and sends result
```

**Close when done:**
```js
ws.close();
```

**Result message format:**
```json
{
  "type": "result",
  "success": true,
  "message": "ACCESS GRANTED: ...",
  "samples_received": 1280,
  "segments_evaluated": 9
}
```

---

### Dashboard & Analytics

#### `GET /api/dashboard`
Overview stats for the dashboard page.

**Response:**
```json
{
  "model_ready": true,
  "model_size_mb": 2.45,
  "data_directory_ready": true,
  "data_files": 72,
  "auth_stats": {
    "total_attempts": 120,
    "successful": 105,
    "success_rate": 0.875,
    "avg_confidence": 0.923
  },
  "users": { ... }
}
```

**Client function:**
```js
const dashboard = await getDashboard();
```

---

#### `GET /api/auth-logs?limit=50`
Recent authentication history.

**Response:**
```json
{
  "logs": [
    {
      "username": "alice",
      "success": true,
      "confidence": 0.94,
      "reason": "ACCESS GRANTED: ...",
      "timestamp": "2026-03-08T14:30:00"
    }
  ]
}
```

**Client function:**
```js
const logs = await getAuthLogs(50); // returns array
```

---

#### `GET /api/metrics?threshold=0.90`
Model performance metrics (FAR, FRR, AUC, etc.).

**Response:**
```json
{
  "threshold": 0.90,
  "sample_count": 200,
  "metrics": {
    "Accuracy": 0.945,
    "Precision": 0.961,
    "Recall": 0.928,
    "F1_Score": 0.944,
    "FAR": 0.038,
    "FRR": 0.072,
    "EER": 0.055,
    "AUC": 0.981,
    "fpr": [...],
    "tpr": [...]
  }
}
```

**Client function:**
```js
const metrics = await getMetrics(0.90);
```

---

## 4. Response Format

Every endpoint returns a consistent structure:

```json
{
  "success": true | false,
  "message": "Human readable explanation",
  "data": { ... }
}
```

For errors, FastAPI returns:
```json
{
  "detail": "Error description"
}
```

Handle it like this:
```js
try {
  const result = await someApiCall();
} catch (err) {
  const errorMessage = err?.response?.data?.detail || err.message;
}
```

---

## 5. CORS

The backend allows requests from:
- `http://localhost:5173` (Vite dev server)
- `http://localhost:3000` (Create React App / Next.js)

No extra headers needed for local development.

---

## 6. Important Notes

- `subject_id` is an integer (1–999) matching the `s##` prefix in EEG filenames
- EEG channel order is fixed: **P4, Cz, F8, T7** (columns 0–3)
- The model must be trained before any authentication endpoint will work
- File upload max size: **50 MB**
- Hardware JSON max samples: **30,720** (120 seconds at 256 Hz)
- All timestamps are ISO 8601 format

---

## 7. Quick Test (No Frontend Needed)

Paste this in your browser console or a JS file to test the connection:

```js
fetch("http://localhost:8000/api/health")
  .then(r => r.json())
  .then(d => console.log("Backend status:", d.status, "| Model ready:", d.model_ready));
```

---

*EEG Biometric Authentication System v3.0.0 — Backend team contact: share your backend IP/port with the frontend dev when deploying on a shared network.*
