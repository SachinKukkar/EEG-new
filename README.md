# 🧠 EEG Biometric Authentication System

[![Python](https://img.shields.io/badge/Python-3.9%2B-blue)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-green)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.3-61dafb)](https://reactjs.org/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.0%2B-red)](https://pytorch.org/)

Real EEG-based biometric authentication using a PyTorch CNN, exposed via a FastAPI REST API with a modern React frontend featuring stunning data visualizations.

## ✨ Features

- **🔐 User Registration** — Map usernames to subject IDs; auto-loads EEG segments from CSV data
- **🧠 Deep Learning** — 4-layer Conv1d CNN with BatchNorm, early stopping, and AdamW optimizer
- **✅ Authentication** — Upload EEG CSV, verify identity via segment-wise majority vote
- **📊 Advanced Metrics** — Interactive visualizations: ROC curves, confusion matrix, radar charts, precision-recall curves
- **📈 Real-time Dashboard** — 6-tab console with animated performance metrics and health monitoring
- **💾 MySQL Logging** — Authentication history with success rates and confidence tracking (graceful fallback)
- **🐳 Docker Ready** — Complete containerization with docker-compose for instant deployment

## 🎯 Quick Start

### For Local Demo

#### Option 1: Using Batch Files (Windows)

1. **Start Backend:**
   ```batch
   run_api.bat
   ```

2. **Start Frontend** (in new terminal):
   ```batch
   run_frontend.bat
   ```

3. **Access the app:** http://localhost:5174

#### Option 2: Manual Setup

**Backend:**
```bash
python -m venv myenv
myenv\Scripts\activate            # Windows
# source myenv/bin/activate       # Linux/macOS
pip install -r requirements.txt
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### For Production Deployment

#### 🐳 Docker (Recommended)

```bash
# Copy environment template
copy .env.example .env

# Start all services (MySQL + Backend + Frontend)
docker-compose up -d

# View logs
docker-compose logs -f

# Access at http://localhost
```

**📖 Full deployment guide:** See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for:
- Cloud deployment (AWS, Azure, GCP)
- VPS deployment (DigitalOcean, Linode)
- Kubernetes setup
- Security hardening
- Monitoring and scaling

## 🎨 Amazing Visualizations

The Metrics tab features stunning, interactive visualizations:

- **📈 ROC Curve** with area gradient and EER marker
- **🔲 Confusion Matrix** with color-coded heatmap
- **🎯 Performance Radar** showing all key metrics
- **📊 Error Analysis** bar charts (FAR, FRR, EER)
- **📉 Precision-Recall Curve** with AUC
- **💫 Animated Gauge Cards** for Accuracy, Precision, Recall, F1

All charts are responsive and built with Recharts!

## 📁 Project Structure

```
├── api/
│   ├── __init__.py
│   └── main.py              # FastAPI endpoints (health, users, train, auth, metrics)
├── backend.py                # Core logic (register, train, authenticate)
├── database.py               # MySQL wrapper with graceful fallback
├── db_config.py              # Database connection config
├── config.py                 # Constants (channels, window size, thresholds)
├── eeg_processing.py         # CSV loading and segmentation
├── model_management.py       # EEG_CNN_Improved model definition
├── metrics_visualizer.py     # Holdout evaluation and plotly visualizations
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Main React app with 6 tabs
│   │   ├── api/client.js     # API client wrapper
│   │   └── styles.css        # Modern CSS with animations
│   ├── index.html
│   ├── package.json
│   └── vite.config.js        # Vite build config
├── data/Filtered_Data/       # Source EEG CSV files
├── assets/                   # Trained model + user data
├── Dockerfile.backend        # Backend container
├── Dockerfile.frontend       # Frontend container
├── docker-compose.yml        # Full stack orchestration
├── nginx.conf                # Reverse proxy config
├── setup_mysql.sql           # Database DDL
├── requirements.txt
├── DEPLOYMENT_GUIDE.md       # Complete deployment instructions
└── README.md
```

## 🔌 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | System health check (API + DB + Model status) |
| GET | `/api/users` | List all registered users with data stats |
| POST | `/api/users/register` | Register user (username + subject_id) |
| DELETE | `/api/users/{username}` | Remove user and associated data |
| POST | `/api/model/train` | Train CNN on all registered users |
| GET | `/api/model/status` | Model readiness + file size |
| POST | `/api/authenticate` | Authenticate via EEG CSV file upload |
| GET | `/api/dashboard` | Aggregated system metrics |
| GET | `/api/auth-logs` | Recent authentication log entries |
| GET | `/api/metrics?threshold=0.90` | Holdout evaluation metrics |

**Interactive API Docs:** http://localhost:8000/docs

## 🎮 Usage Workflow

1. **Register Users** — Go to Users tab, register 2+ users (e.g., `alice` → subject `01`, `bob` → subject `02`)
2. **Train Model** — Go to Training tab, click "Train Model" (uses all registered users' EEG data)
3. **Authenticate** — Go to Authentication tab, upload EEG CSV (e.g., `s01_ex05.csv`), claim identity
4. **View Metrics** — Go to Metrics tab, click "Evaluate Model" to see beautiful performance visualizations
5. **Check Logs** — Go to Auth Logs tab to see authentication history (requires MySQL)

## 🧪 Sample Test Files

Use EEG files from `data/Filtered_Data/`:
- `s01_ex05.csv` — Subject 01, Exercise 5
- `s02_ex06.csv` — Subject 02, Exercise 6
- `s03_ex07.csv` — Subject 03, Exercise 7

Each CSV contains 4 EEG channels (P4, Cz, F8, T7) at 256 Hz.

## ⚙️ Configuration

### EEG Processing (`config.py`)
```python
CHANNELS = ['P4', 'Cz', 'F8', 'T7']  # 4-channel EEG
WINDOW_SIZE = 256                      # Samples per segment
STEP_SIZE = 128                        # 50% overlap
SAMPLING_RATE = 256                    # Hz
CONFIDENCE_THRESHOLD = 0.90            # Default auth threshold
```

### Model Architecture (`model_management.py`)
```
EEG_CNN_Improved:
  Conv1d(4 → 32)  + BatchNorm + ReLU + MaxPool
  Conv1d(32 → 64)  + BatchNorm + ReLU + MaxPool
  Conv1d(64 → 128) + BatchNorm + ReLU + MaxPool
  Conv1d(128 → 256) + BatchNorm + ReLU + MaxPool
  Flatten
  Linear(256 → 128) + ReLU + Dropout(0.5)
  Linear(128 → num_classes)
```

### Training (`backend.py`)
- **Optimizer:** AdamW (lr=0.001, weight_decay=0.01)
- **Loss:** CrossEntropyLoss
- **Early Stopping:** Patience=5, Max Epochs=50
- **Validation Split:** Last 20% of each user (deterministic)

## 🐳 Docker Deployment

The fastest way to deploy:

```bash
# 1. Copy environment file
copy .env.example .env

# 2. Start all services
docker-compose up -d

# 3. Check status
docker-compose ps

# 4. View logs
docker-compose logs -f backend

# 5. Access the application
# Frontend: http://localhost
# API: http://localhost/api
```

**What you get:**
- MySQL 8.0 database with auto-initialization
- FastAPI backend with health checks
- React frontend served by Nginx
- Automatic service orchestration
- Volume persistence for data

## 📚 Documentation

- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** — Complete deployment guide (Docker, AWS, VPS, security)
- **[setup_mysql.sql](setup_mysql.sql)** — Database schema (users, auth_logs, settings)
- **API Docs** — Interactive Swagger UI at `/docs` when API is running

## 🔒 Security Features

- ✅ Graceful MySQL fallback (app works without database)
- ✅ File upload validation (CSV only, size limits)
- ✅ Input sanitization on all endpoints
- ✅ CORS middleware (configurable origins)
- ✅ Production-ready error handling
- ✅ No hardcoded secrets (environment variables)
- ✅ Health monitoring endpoints

## 🛠️ Development

**Backend development:**
```bash
# Activate virtual environment
myenv\Scripts\activate

# Run with hot reload
uvicorn api.main:app --reload

# Run tests (if available)
pytest
```

**Frontend development:**
```bash
cd frontend

# Install dependencies
npm install

# Dev server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🐛 Troubleshooting

**"Cannot connect to database"**
- App works fine without MySQL (graceful fallback)
- Check `db_config.py` settings if you want logging

**"Model not found"**
- Train a model first via Training tab
- Model saves to `assets/eeg_auth_model.pth`

**"No data for user"**
- CSV files must match pattern: `s{ID:02d}_ex*.csv`
- Files must be in `data/Filtered_Data/`
- Register user with correct subject ID

**CORS errors**
- Check `VITE_API_BASE_URL` in `frontend/.env`
- Verify API is accessible at the configured URL

## 📊 Performance

**Metrics (8-class authentication, 256-sample windows):**
- Accuracy: ~95%+
- FAR: <5%
- FRR: <5%
- EER: ~2-4%
- Inference: <200ms per file

## 🚀 Roadmap

- [ ] Real-time EEG streaming authentication
- [ ] Multi-factor authentication (EEG + password)
- [ ] Advanced visualization dashboard
- [ ] REST API rate limiting
- [ ] Kubernetes deployment configs
- [ ] Mobile app (React Native)

## 📝 License

MIT License — See LICENSE file for details

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push and submit a pull request

## 📧 Support

For issues or questions:
- Check existing documentation
- Review API docs at `/docs`
- Open a GitHub issue
- Check application logs

---

**Built with ❤️ using PyTorch, FastAPI, React, and Recharts**

**Version:** 2.0 | **Last Updated:** March 2026
