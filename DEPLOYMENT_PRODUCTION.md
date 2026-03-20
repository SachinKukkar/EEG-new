# Production Deployment Guide - EEG Biometric Authentication

This guide ensures your EEG application runs reliably in production with proper error handling, CORS configuration, and cold start resilience.

## Table of Contents

1. [Backend Deployment (Render)](#backend-deployment-render)
2. [Frontend Deployment (Vercel)](#frontend-deployment-vercel)
3. [Environment Configuration](#environment-configuration)
4. [Troubleshooting](#troubleshooting)
5. [Monitoring & Logging](#monitoring--logging)

---

## Backend Deployment (Render)

### Prerequisites

- Render.com account
- Git repository with code pushed to GitHub

### Step 1: Create Render Blueprint (Recommended)

Create a `render.yaml` in project root:

```yaml
services:
  - type: web
    name: eeg-api
    runtime: python-3.11
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn api.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: ENVIRONMENT
        value: production
      - key: CORS_ORIGINS
        value: https://eeg-new.vercel.app
      - key: PYTHONUNBUFFERED
        value: "1"
    disk:
      name: eeg-storage
      mountPath: /app
      sizeGB: 1
```

### Step 2: Deploy on Render

1. Go to **Render Dashboard** → **New +** → **Web Service**
2. Connect your GitHub repository
3. Select branch (main/develop)
4. Set runtime: **Python 3.11**
5. Build command: `pip install -r requirements.txt`
6. Start command: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`

### Step 3: Configure Environment Variables

In Render Dashboard → Service Settings → Environment:

| Variable | Value | Purpose |
|----------|-------|---------|
| `ENVIRONMENT` | `production` | Environment indicator |
| `CORS_ORIGINS` | `https://eeg-new.vercel.app,https://yourdomain.com` | Allowed origins (comma-separated) |
| `PYTHONUNBUFFERED` | `1` | Real-time logging |
| `PORT` | Auto-set by Render | Server port |

### Step 4: Provision Persistent Storage

1. In Render → Service Settings → Disks
2. Create disk: **Name:** `eeg-storage`, **Size:** 1 GB, **Mount Path:** `/app`
3. This preserves model files, user data across redeploys

### Step 5: Validate Deployment

```bash
# Check health endpoint
curl https://eeg-api-xxxxx.onrender.com/api/health

# Expected response:
# {
#   "status": "ok",
#   "timestamp": "2026-03-21T...",
#   "model_ready": true,
#   "registered_users": 5,
#   "data_files": 60,
#   "db_available": false,
#   "environment": "production"
# }
```

### Step 6: Keep Backend Alive (Optional - Prevents Cold Starts)

**Issue:** Render free tier spins down inactive services → 50s restart delay
**Solution:** Add keep-alive pings to frontend

```javascript
// frontend/src/api/keepAlive.js
export function startKeepAlive() {
  setInterval(async () => {
    try {
      await api.get('/api/health', { timeout: 5000 });
    } catch (e) {
      console.debug('Keep-alive ping failed (acceptable)', e.message);
    }
  }, 25 * 60 * 1000); // Every 25 minutes
}
```

Call from App.jsx `useEffect`:

```javascript
useEffect(() => {
  if (import.meta.env.MODE === 'production') {
    startKeepAlive();
  }
}, []);
```

---

## Frontend Deployment (Vercel)

### Step 1: Connect GitHub Repository

1. Go to **Vercel** → **Add New** → **Project**
2. Select your GitHub repository
3. Vercel auto-detects Next.js or Vite

### Step 2: Configure Build Settings

| Setting | Value |
|---------|-------|
| Framework | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

### Step 3: Set Environment Variables

In Vercel → Settings → Environment Variables:

```
VITE_API_BASE_URL=https://eeg-api-xxxxx.onrender.com
```

**Important:** This must include `VITE_` prefix for Vite to inject at build time.

### Step 4: Deploy

```bash
# Via CLI
npm install -g vercel
vercel --prod

# Or commit to GitHub for auto-deploy
git push origin main
```

### Step 5: Verify Frontend

1. Navigate to `https://eeg-new.vercel.app`
2. Check browser console (F12) for logs:
   - Should see: `✅ Backend health: OK`
   - Should NOT see CORS errors

---

## Environment Configuration

### Backend `.env` (Render)

Create `.env` file in project root (Git-ignored):

```env
# Production Settings
ENVIRONMENT=production
PYTHONUNBUFFERED=1

# CORS - Comma-separated origins
CORS_ORIGINS=https://eeg-new.vercel.app,https://yourdomain.com

# Database (optional - currently defaults to JSON file storage)
# DB_HOST=your-mysql-host.aws.rds.amazonaws.com
# DB_USER=admin
# DB_PASSWORD=secure_password_here
# DB_NAME=eeg_database

# Port (auto-set by Render to $PORT)
PORT=8000
```

### Frontend `.env.local` (Development Only)

```env
VITE_API_BASE_URL=http://localhost:8000
```

### Render Dashboard Configuration

**Settings** → **Environment Variables:**

```
CORS_ORIGINS=https://eeg-new.vercel.app
ENVIRONMENT=production
PYTHONUNBUFFERED=1
```

---

## How to Fix Common Issues

### Issue 1: CORS Error in Browser Console

**Error:**
```
Access to XMLHttpRequest at 'https://eeg-api-xxxxx.onrender.com/...' 
from origin 'https://eeg-new.vercel.app' has been blocked by CORS policy
```

**Fix:**
1. Verify `CORS_ORIGINS` environment variable on Render includes frontend URL
2. Redeploy backend after changing environment variables
3. Hard refresh frontend (Ctrl+Shift+R)

### Issue 2: Backend Responds with 500 Errors

**Check Render Logs:**
1. In Render Dashboard → Logs tab
2. Look for stack traces
3. Common issues:
   - Missing model file (`assets/model.pth`)
   - Database connection failure (expected, should use JSON file fallback)
   - Out of memory (training a big model)

**Fix:**
```bash
# Ensure model file exists in Render persistent disk
# If not, train model locally then upload
```

### Issue 3: "Backend Unreachable" / Net::ERR_NAME_NOT_RESOLVED

**Cause:** Render service sleeping (free tier)

**Fix Options:**
1. **Use keep-alive ping** (recommended) - See "Step 6" above
2. **Upgrade to paid plan** ($7/month minimum)
3. **Use alternative host** (Railway, Fly.io, etc.)

**Frontend Already Handles Cold Starts:**
- Automatic retry on timeout (3 retries with exponential backoff)
- 1s → 2s → 4s delay between retries
- Shows loading state to user during cold start

### Issue 4: Model Training Fails / Takes Forever

**Check:**
1. Are there at least 2 registered users? Required for training
2. Check Render logs for timeout (training may exceed 30min Render timeout)

**Solution:**
```bash
# Train locally first
cd /path/to/project
python -m backend  # or your training script

# Upload model to Render persistence
```

### Issue 5: Vercel Frontend Shows Old Content

**Fix - Hard refresh:**
- Chrome: `Ctrl+Shift+R`
- Firefox: `Ctrl+Shift+R`
- Safari: `Cmd+Shift+R`

Or clear build cache in Vercel:
1. Vercel Dashboard → Project Settings → Git
2. Click "Redeploy" button

---

## Monitoring & Logging

### Backend Logs (Render)

1. Render Dashboard → Service → Logs
2. Filter: `INFO`, `ERROR`
3. Look for startup sequence:

```
[2026-03-21 10:00:00] INFO - ================================================================================
[2026-03-21 10:00:00] INFO - EEG API Starting Up
[2026-03-21 10:00:00] INFO - ================================================================================
[2026-03-21 10:00:00] INFO - Environment: production
[2026-03-21 10:00:00] INFO - Database available: False
[2026-03-21 10:00:00] INFO - CORS middleware configured successfully.
```

### Frontend Console (Browser DevTools)

Open `F12` → Console tab:

- **Good logs:**
  ```
  📤 API Request: GET https://eeg-new-service.onrender.com/api/health
  ✅ API Response: 200 https://eeg-new-service.onrender.com/api/health
  ```

- **Problem logs:**
  ```
  ❌ API Error: 500 /api/model/train - Internal server error
  ❌ Network Error: timeout of 180000ms exceeded
  ```

### Health Check Status Page

Frontend displays backend status in Overview tab:
- **Model:** Shows "Ready" or "—"
- **Database:** Shows "On" or "Off"
- **Files:** Count of available data files

---

## Deployment Checklist

Use this checklist before sharing your link:

### Backend (Render)

- [ ] Service deployed and running (check Render logs for "Your service is live")
- [ ] Health endpoint accessible: `curl https://eeg-api-xxxxx.onrender.com/api/health`
- [ ] Environment variables set: `CORS_ORIGINS`, `ENVIRONMENT`
- [ ] Persistent disk configured (1GB minimum)
- [ ] Model file exists and is readable
- [ ] At least 2 users registered in JSON file

### Frontend (Vercel)

- [ ] Project deployed from GitHub
- [ ] Environment variable `VITE_API_BASE_URL` set to Render URL
- [ ] Build succeeds `npm run build`
- [ ] No CORS errors in browser console
- [ ] Can refresh data (Sync button works)

### Post-Deployment Tests

1. **Health Check**
   - [ ] Navigate to app → Overview tab
   - [ ] Click "Refresh" → Should show "Synced" notification

2. **Registration**
   - [ ] Users tab → Fill in username & subject ID
   - [ ] Click "Register" → Should succeed

3. **Training**
   - [ ] Register 2-3 users
   - [ ] Training tab → Click "Train Model"
   - [ ] Should show progress, complete in 2-5 minutes

4. **Metrics**
   - [ ] After training, go to Metrics tab
   - [ ] Click "Compute Metrics" → Should display charts

---

## Performance Tips for Production

1. **CDN Caching:** Vercel auto-caches static files
2. **Image Optimization:** Use `.vercel/project.json` for image optimization
3. **API Caching:** Frontend caches response for 60s between refreshes
4. **Database:** Upgrade from JSON file to MySQL for faster queries (optional)

---

## Support & Debugging

### Quick Diagnostic Command

```bash
# Test backend connectivity
curl -X GET https://eeg-api-xxxxx.onrender.com/api/health -H "Content-Type: application/json"

# Should return JSON with status: "ok"
```

### Enable Debug Mode

Add to Render environment variables:
```
DEBUG=1
PYTHONUNBUFFERED=1
LOG_LEVEL=DEBUG
```

### Reach Out

- Check [Render Docs](https://render.com/docs)
- Check [Vercel Docs](https://vercel.com/docs)
- Review application logs in both dashboards

---

**Last Updated:** March 21, 2026
**Version:** 2.0.0 - Production Ready
