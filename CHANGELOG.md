# Changelog

All notable changes to the EEG Biometric Authentication System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Advanced user analytics dashboard
- Multi-factor authentication integration
- Mobile application (React Native)
- Kubernetes deployment configurations
- Rate limiting on API endpoints (per-IP)

---

## [3.0.0] - 2026-03-08

### Added
- **Hardware REST endpoint** `POST /api/authenticate/raw` — accepts raw EEG samples as a
  JSON array `[T][4]` from any hardware SDK (OpenBCI, BrainFlow, Emotiv, etc.).
- **WebSocket streaming endpoint** `/ws/stream` — real-time EEG authentication where the
  device can stream live samples and trigger classification without file uploads.
- **Bandpass filter (0.5–40 Hz)** applied to all incoming EEG using a 4th-order
  Butterworth filter (SOS form for numerical stability).
- **50 Hz notch filter** removes mains-frequency interference (configurable via
  `NOTCH_FREQ` env var; set to `60` for USA/Canada).
- **Artifact rejection** — every segment is tested with a peak-to-peak amplitude check
  (< 150 µV) and a per-channel z-score check (threshold = 4σ). Flat channels (potential
  electrode-off) are also detected. Fallback to unfiltered segments when all are rejected,
  so authentication never silently returns zero results.
- **`preprocess_raw_eeg()`** — single pipeline function that interpolates NaNs/Infs,
  filters, segments, and runs artifact rejection on continuous hardware data.
- **Environment-variable driven config** (`config.py`, `db_config.py`) — every
  deployment-sensitive value (DB password, origins, thresholds) is now read from env
  vars. A `.env.example` template covers all options.
- **Configurable CORS** via `ALLOWED_ORIGINS` env var (was hardcoded `"*"`).
- **Optional API-key enforcement** — set `API_KEY` env var to require
  `X-API-Key` header on all requests (except `/docs` and `/api/health`).
- **`python-dotenv`** loads `.env` automatically in development.
- **`websockets`** added to requirements for WebSocket support.
- **Hardware Streaming tab** in the React frontend with REST and WebSocket modes.
- **`authenticateRaw()`** and **`createStreamSocket()`** helper functions added to
  `frontend/src/api/client.js`.
- `X-API-Key` header automatically attached in frontend if `VITE_API_KEY` env var set.
- Non-root Docker user (`appuser`, UID 1001) for container security.
- `--timeout-keep-alive 75` on uvicorn for stable WebSocket connections behind a proxy.

### Changed
- `authenticate()` in `backend.py` accepts optional `precomputed_segments` kwarg so the
  hardware endpoint reuses the existing classification pipeline without file I/O.
- CORS `allow_origins` changed from `["*"]` to a configurable list.
- `load_and_segment_csv()` now applies bandpass + notch filtering and artifact rejection
  instead of only filling NaN with zeros.
- `docker-compose.yml` — DB passwords no longer have insecure defaults; must be
  explicitly set via `.env`.
- `Dockerfile.backend` healthcheck uses `urllib.request` (stdlib) instead of `requests`.
- API version bumped to `3.0.0`.
- Frontend footer updated to `v3.0`.

### Removed
- `PyQt5`, `matplotlib`, `seaborn`, `reportlab`, `streamlit` from `requirements.txt`
  (desktop/notebook dependencies not needed in the web API).
- `run_api.bat`, `run_frontend.bat` (replaced by uvicorn/vite CLI commands).
- Hardcoded DB password `5911` from `db_config.py`.
- Hardcoded `allow_origins=["*"]` CORS policy.

### Security
- No credentials or secrets in source files — all via env vars.
- CORS locked to explicit allowed origins.
- Optional API key authentication middleware.
- File upload size capped at 50 MB.
- Hardware POST sample count capped at `MAX_HARDWARE_SAMPLES` (default 120 s @ 256 Hz).
- Docker container runs as non-root user.

---

## [2.0.0] - 2026-03-07

### Added - Major Release 🎉

#### Frontend
- **Amazing Metrics Visualizations** with Recharts library
  - Animated metric cards with progress bars
  - Interactive ROC curve with gradient area chart
  - Color-coded confusion matrix with hover effects
  - Error analysis bar charts (FAR, FRR, EER)
  - 6-dimensional performance radar chart
  - Precision-Recall curve visualization
  - Advanced metrics table with detailed statistics
- Modern responsive UI with CSS animations
- 6-tab dashboard (Overview, Users, Training, Auth, Metrics, Logs)
- Real-time status indicators
- Loading spinners and state management

#### Backend
- FastAPI REST API with 10+ endpoints
- Complete API documentation via Swagger/OpenAPI
- Health check endpoint with DB and model status
- Model status endpoint with file size info
- Authentication logs endpoint
- Dashboard metrics aggregation
- Graceful MySQL fallback system
- CORS middleware configuration
- Comprehensive error handling

#### Machine Learning
- 4-layer Conv1d CNN architecture (`EEG_CNN_Improved`)
- BatchNorm1d layers for normalization
- Early stopping with patience=5
- AdamW optimizer with weight decay
- Deterministic holdout evaluation (last 20% per user)
- Real-time model training progress
- Model performance metrics calculation

#### Data Processing
- 4-channel EEG processing (P4, Cz, F8, T7)
- Sliding window segmentation (256 samples, 128 step)
- Data validation and quality checks
- Subject ID extraction from filenames
- Segment-wise majority voting for authentication

#### Database
- MySQL integration with authentication logs
- User management (register, delete, list)
- Authentication history tracking
- System settings persistence
- Graceful degradation when DB unavailable

#### Deployment
- **Docker support** with multi-stage builds
- Docker Compose orchestration (MySQL + Backend + Frontend)
- Nginx reverse proxy configuration
- Production-ready Dockerfiles
- Environment variable configuration
- Volume persistence for data

#### Documentation
- Comprehensive README with badges and examples
- Complete DEPLOYMENT_GUIDE (450+ lines)
  - Docker deployment
  - AWS EC2 + RDS guide
  - VPS deployment instructions
  - Security checklist
  - Monitoring and scaling guide
- DEMO_WALKTHROUGH for step-by-step demos
- PROJECT_SUMMARY for quick overview
- CONTRIBUTING guide for team collaboration
- TEAM_STRUCTURE for 4-person team organization
- API documentation at /docs endpoint

#### Team Collaboration
- GitHub workflow setup
- Branch strategy documentation
- Role-based responsibilities
- 4-person team structure
- PR review guidelines
- Issue tracking templates

### Changed
- Replaced simulation code with real data processing
- Improved authentication logic (removed dummy fallbacks)
- Enhanced metrics computation for production accuracy
- Optimized model architecture for better performance
- Upgraded frontend from basic to production-quality UI
- Migrated from Streamlit to React + FastAPI architecture

### Fixed
- Removed `torch.randn` dummy data in model size calculation
- Removed `DummyLogger` fallback - requires proper logging
- Fixed non-deterministic train/test split (now uses last 20%)
- Removed silent authentication bypass
- Fixed import paths in API for uvicorn execution
- Improved error handling across all endpoints

### Removed
- Streamlit app (`streamlit_app.py`)
- Old batch files (fix_pytorch.bat, recreate_env.bat, etc.)
- Demo guide for simulation data
- Dummy/simulation code throughout codebase
- Unnecessary root-level node_modules
- Python cache files
- Old database file (eeg_system.db)

### Security
- Input validation on all API endpoints
- File upload restrictions (CSV only)
- Environment variables for sensitive data
- CORS configuration for allowed origins
- SQL injection prevention in database queries
- Proper error messages (no sensitive info leakage)

---

## [1.0.0] - Initial Version

### Added
- Basic Streamlit-based UI
- Initial CNN model for EEG authentication
- User registration system
- EEG data loading from CSV files
- Basic training functionality
- Simple authentication mechanism
- MySQL database support
- Basic metrics visualization with Plotly

### Known Issues (Resolved in 2.0.0)
- Used simulation data in some places
- Streamlit limitations for production deployment
- Non-deterministic evaluation splits
- Mixed dummy/real data handling

---

## Version History Summary

- **v2.0.0** (Current) - Production-ready system with Docker, amazing visualizations, team collaboration
- **v1.0.0** - Initial Streamlit-based prototype

---

## Migration Guide

### From 1.0.0 to 2.0.0

**Breaking Changes:**
- Streamlit app removed - now uses React frontend
- API-based architecture - requires running both backend and frontend
- Different port configuration (8000 for API, 5173/5174 for frontend)

**Steps to Migrate:**
```bash
# 1. Update dependencies
pip install -r requirements.txt
cd frontend && npm install

# 2. Start new backend
uvicorn api.main:app --host 0.0.0.0 --port 8000

# 3. Start new frontend
cd frontend && npm run dev

# 4. Re-register users (user data format compatible)
# 5. Re-train model (model architecture improved)
```

---

## Versioning Policy

We use [Semantic Versioning](https://semver.org/):
- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible new features
- **PATCH** version for backwards-compatible bug fixes

---

## Release Notes Format

Each release section includes:
- **Added** - New features
- **Changed** - Changes in existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security improvements

---

**Note:** This changelog is maintained by the Documentation Specialist and updated with each release.

For detailed commit history, see: https://github.com/SachinKukkar/EEG-new/commits/main
