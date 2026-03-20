# Environment Configuration Reference

This file documents all environment variables used by the EEG application.

## Backend Environment Variables (Render)

### Core Settings

| Variable | Default | Purpose | Example |
|----------|---------|---------|---------|
| `PORT` | `8000` | Server listening port (auto-set by Render) | `auto` |
| `ENVIRONMENT` | `development` | Environment name | `production` |
| `PYTHONUNBUFFERED` | `1` | Real-time stdout logging | `1` |

### CORS & Security

| Variable | Default | Purpose | Example |
|----------|---------|---------|---------|
| `CORS_ORIGINS` | See code | Comma-separated allowed origins | `https://eeg-new.vercel.app,https://yourdomain.com` |

**Note:** If not set, defaults include:
- `http://localhost:5173` (Vite dev)
- `http://localhost:5174` (alt)
- `http://localhost:3000` (common dev)
- `http://127.0.0.1:5173`
- `https://eeg-new.vercel.app` (production)

Regex pattern `https://.*\.vercel\.app` allows all Vercel preview deployments.

### Database (Optional)

| Variable | Default | Purpose | Example |
|----------|---------|---------|---------|
| `DB_HOST` | `localhost` | MySQL host | `your-db.aws.rds.amazonaws.com` |
| `DB_PORT` | `3306` | MySQL port | `3306` |
| `DB_USER` | `root` | MySQL user | `admin` |
| `DB_PASSWORD` | `` | MySQL password | `secure_password` |
| `DB_NAME` | `eeg_database` | Database name | `eeg_db` |

**Note:** If DB is unavailable, app gracefully falls back to JSON file storage at `assets/users.json`.

### Deployment-Specific

| Variable | Value | Render.com |
|----------|-------|-----------|
| Start Command | `uvicorn api.main:app --host 0.0.0.0 --port $PORT` | Required |
| Build Command | `pip install -r requirements.txt` | Required |
| Disk Size | 1GB minimum | Suggested |
| Mount Path | `/app` | Stores model, users, data |

---

## Frontend Environment Variables (Vercel)

### API Configuration

| Variable | Default | Purpose | Example |
|----------|---------|---------|---------|
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000` | Backend API URL | `https://eeg-api-xxxxx.onrender.com` |

**Important:** Must start with `VITE_` prefix for Vite to inject at build time.

### Vercel Deployment

Set in **Vercel Dashboard** → **Settings** → **Environment Variables**:

```
VITE_API_BASE_URL=https://eeg-api-xxxxx.onrender.com
```

**Production URL Example:**
```
https://eeg-new.vercel.app
```

---

## Configuration by Environment

### Local Development

**Backend (`python` terminal):**
```bash
# No special env vars needed, defaults work
python -m uvicorn api.main:app --reload
# Listens on http://localhost:8000
```

**Frontend (`node` terminal):**
```bash
# Create .env.local
echo "VITE_API_BASE_URL=http://localhost:8000" > frontend/.env.local

npm run dev
# Runs on http://localhost:5173
```

### Production (Render + Vercel)

**Backend (Render):**
1. Dashboard → Service → Environment
2. Add:
   ```
   CORS_ORIGINS=https://eeg-new.vercel.app
   ENVIRONMENT=production
   PYTHONUNBUFFERED=1
   ```
3. Deploy

**Frontend (Vercel):**
1. Dashboard → Project → Settings → Environment Variables
2. Add:
   ```
   VITE_API_BASE_URL=https://eeg-api-xxxxx.onrender.com
   ```
3. Redeploy (or wait for auto-deploy from Git)

---

## How to Set Environment Variables

### Option 1: Render Web UI

1. Go to Render Dashboard
2. Select your service/project
3. Click **Settings**
4. Scroll to **Environment Variables**
5. Click **Add Environment Variable**
6. Enter Key and Value
7. Click **Save**
8. Redeploy service for changes to take effect

### Option 2: render.yaml

Create `render.yaml` in project root:

```yaml
services:
  - type: web
    name: eeg-api
    envVars:
      - key: CORS_ORIGINS
        value: https://eeg-new.vercel.app
      - key: ENVIRONMENT
        value: production
      - key: PYTHONUNBUFFERED
        value: "1"
```

Push changes and redeploy.

### Option 3: Vercel Web UI

1. Vercel Dashboard → Project
2. **Settings** → **Environment Variables**
3. Add Key + Value
4. App redeploys automatically from Git

### Option 4: Vercel CLI

```bash
vercel env add VITE_API_BASE_URL
# Prompts for value
# Specify scope: production, preview, development

vercel redeploy --prod
```

---

## Troubleshooting Environment Variables

### Frontend Can't Connect to Backend

**Problem:** Frontend shows "Backend unreachable"

**Checklist:**
1. Verify `VITE_API_BASE_URL` is set in Vercel
   ```bash
   vercel env ls
   # Should list VITE_API_BASE_URL=https://eeg-api-xxxxx.onrender.com
   ```

2. Verify frontend deployed after setting env var
   ```bash
   vercel --prod  # Force redeploy
   ```

3. Check frontend build log for `VITE_API_BASE_URL`
   ```
   Vercel → Deployments → Select latest → Build Logs
   Should show: "VITE_API_BASE_URL=https://..."
   ```

### CORS Errors in Browser

**Problem:** 
```
CORS policy: No 'Access-Control-Allow-Origin' header
```

**Checklist:**
1. Backend `CORS_ORIGINS` includes frontend URL:
   ```bash
   # Render Dashboard → Environment Variables
   CORS_ORIGINS=https://eeg-new.vercel.app
   ```

2. Backend redeployed after changing `CORS_ORIGINS`
   ```bash
   # Render → Activity → Wait for "Your service is live"
   ```

3. Frontend made hard refresh:
   ```bash
   Ctrl+Shift+R  # Clear cache and reload
   ```

### Backend Not Starting

**Problem:** Render shows error status, no logs

**Checklist:**
1. Verify Start Command is correct:
   ```
   uvicorn api.main:app --host 0.0.0.0 --port $PORT
   ```

2. Check `PORT` is not hardcoded (must use `$PORT` variable)

3. Review Render logs:
   ```
   Render → Service → Logs
   Look for errors during startup
   ```

---

## Security Best Practices

### Never Commit Secrets

✅ **DO:** Store sensitive values in Render/Vercel env vars
```bash
# .gitignore
.env
.env.local
.env.*.local
```

❌ **DON'T:** Commit database passwords, API keys to Git

### Use Different Secrets per Environment

- **Development:** Use localhost and dummy values
- **Staging:** Use staging database
- **Production:** Use production credentials from secure vault

---

## Validation Script

Test your environment configuration:

```javascript
// frontend/src/utils/validateEnv.js
export function validateEnvironment() {
  const issues = [];
  
  const apiUrl = import.meta.env.VITE_API_BASE_URL;
  if (!apiUrl) {
    issues.push('VITE_API_BASE_URL not set - backend unreachable');
  } else if (!apiUrl.startsWith('http')) {
    issues.push('VITE_API_BASE_URL is invalid URL');
  }
  
  if (issues.length > 0) {
    console.error('❌ Environment validation failed:', issues);
    return false;
  }
  
  console.log('✅ Environment variables valid');
  return true;
}
```

Call from App.jsx:

```javascript
useEffect(() => {
  validateEnvironment();
}, []);
```

---

## Reference: Full Backend .env Example

```env
# Core
ENVIRONMENT=production
PYTHONUNBUFFERED=1
PORT=8000

# CORS
CORS_ORIGINS=https://eeg-new.vercel.app,https://yourdomain.com

# Database (optional)
DB_HOST=eeg-db.aws.rds.amazonaws.com
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=secure_password_here
DB_NAME=eeg_production

# Logging
LOG_LEVEL=INFO
LOG_FILE=/app/logs/eeg.log
```

---

**Last Updated:** March 21, 2026
**Version:** 2.0.0
