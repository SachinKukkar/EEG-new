# Production Issues & Solutions Guide

Quick reference for resolving the 7 critical production issues.

---

## ISSUE 1: CORS Misconfiguration (Frontend Can't Talk to Backend)

### Symptom

```javascript
❌ Access to XMLHttpRequest at 'https://eeg-api-xxxxx.onrender.com/api/model/train' 
   from origin 'https://eeg-new.vercel.app' has been blocked by CORS policy: 
   No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

### Root Cause

Backend CORS middleware not configured to allow frontend origin.

### Solution

#### Step 1: Update Render Environment Variables

1. Go to **Render Dashboard** → Select your service
2. **Settings** → **Environment Variables**
3. Add/Update:
   ```
   CORS_ORIGINS=https://eeg-new.vercel.app,https://yourdomain.com
   ```
4. Click **Save**

#### Step 2: Redeploy Backend

1. In Render → **Deployments** tab
2. Click **Manual Deploy**
3. Wait for "Your service is live" message

#### Step 3: Clear Frontend Cache

In browser:
- Chrome/Edge: `Ctrl+Shift+R`
- Firefox: `Ctrl+Shift+R`
- Safari: `Cmd+Shift+R`

#### Step 4: Test

Open browser console (F12) and check:
- Should NOT see CORS error
- Should see: `✅ API Response: 200 /api/health`

---

## ISSUE 2: Backend API Not Reachable (DNS / Service Issue)

### Symptom

```javascript
❌ Network Error: net::ERR_NAME_NOT_RESOLVED
// or
❌ Failed to fetch (no response after 180s)
```

### Root Cause

- Service not running / crashed
- DNS resolution failure
- Invalid backend URL

### Solution

#### Step 1: Verify Backend URL

1. Check Vercel frontend environment variables:
   ```
   Vercel Dashboard → Settings → Environment Variables
   VITE_API_BASE_URL=https://eeg-api-xxxxx.onrender.com
   ```
   (Must be your actual Render service URL)

2. Test URL in browser:
   ```
   https://eeg-api-xxxxx.onrender.com/api/health
   ```
   Should show JSON response

#### Step 2: Check Render Service Status

1. **Render Dashboard** → Select service
2. Look at status indicator (should be green "Running")
3. Click **Logs** tab
4. Look for:
   - `[INFO] - EEG API Starting Up` ✅
   - `[ERROR]` messages ❌

#### Step 3: Manual Restart

1. **Render** → Service → **Manual Deploy**
2. Wait 2-3 minutes for startup
3. Test health endpoint again

#### Step 4: Check for Crashes

Look in Render Logs for:
- Out of memory errors → Upgrade plan
- Port binding errors → Check PORT env var
- Module import errors → Run `pip install -r requirements.txt` locally

---

## ISSUE 3: Render Free Tier Cold Start (Service Sleeps)

### Symptom

```javascript
⚠️ API unreachable, retry 1/3 in 1000ms
⚠️ API unreachable, retry 2/3 in 2000ms
⚠️ API unreachable, retry 3/3 in 4000ms
❌ Network Error: timeout after 50+ seconds
```

First request after inactivity takes 50+ seconds.

### Root Cause

Render free tier spins down services after 15 min inactivity.

### Solution

#### Option 1: Automatic Retry (Already Enabled) ✅

Frontend automatically retries 3 times with exponential backoff:
- Retry 1: 1 second
- Retry 2: 2 seconds  
- Retry 3: 4 seconds

Check browser console for:
```
⚠️ API unreachable, retry 1/3 in 1000ms: /api/health
```

This is normal and expected. Just wait.

#### Option 2: Keep-Alive Pings (Optional)

Add to frontend `src/api/keepAlive.js`:

```javascript
import { api } from './client';

export function startKeepAlive() {
  setInterval(async () => {
    try {
      await api.get('/api/health', { timeout: 5000 });
    } catch (e) {
      // Expected if backend is cold starting
    }
  }, 25 * 60 * 1000); // Every 25 minutes
}
```

Call from `App.jsx`:

```javascript
useEffect(() => {
  startKeepAlive();
}, []);
```

#### Option 3: Upgrade Render Plan

- Free: Spins down after 15 min inactivity
- Starter: $7/month - never spins down
- Recommended for demos that need 24/7 reliability

---

## ISSUE 4: Missing or Incorrect Environment Configuration

### Symptom

```javascript
❌ Database unavailable (expected for JSON file fallback)
❌ PORT not set correctly
❌ Module import errors
```

### Solution

#### Step 1: Verify Render Environment Variables

**Render Dashboard** → **Settings** → **Environment Variables**

Should have:
```
CORS_ORIGINS=https://eeg-new.vercel.app
ENVIRONMENT=production
PYTHONUNBUFFERED=1
```

Not strictly required but recommended.

#### Step 2: Verify Start Command

**Render** → **Settings** → **Build & Deploy**

Start command **MUST** be:
```
uvicorn api.main:app --host 0.0.0.0 --port $PORT
```

Not just `python -m uvicorn` or hardcoded port.

#### Step 3: Check Frontend Environment Variable

**Vercel** → **Settings** → **Environment Variables**

Must have:
```
VITE_API_BASE_URL=https://eeg-api-xxxxx.onrender.com
```

If missing:
1. Add it
2. Click **Redeploy** in Vercel

---

## ISSUE 5: Incorrect Server Binding (Backend Not Accessible Externally)

### Symptom

Backend is running but frontend can't reach it:
```javascript
❌ Network Error: Connection refused
// or
❌ ERR_HOST_UNREACHABLE
```

### Root Cause

Backend bound to `localhost` (127.0.0.1) instead of `0.0.0.0`.

### Solution

#### Check Current Binding

**Render Logs** should show:
```
✅ Application startup complete [Uvicorn] running on http://0.0.0.0:8000
```

If shows `127.0.0.1:8000` → Problem!

#### Fix Start Command

**Render** → **Settings** → **Build & Deploy** → **Start Command:**

Change TO:
```
uvicorn api.main:app --host 0.0.0.0 --port $PORT
```

**NOT:**
```
uvicorn api.main:app --host 127.0.0.1 --port 8000
uvicorn api.main:app  # Uses localhost by default
```

#### Redeploy

1. Click **Manual Deploy**
2. Wait for "Your service is live"
3. Test: `https://eeg-api-xxxxx.onrender.com/api/health`

---

## ISSUE 6: Multiple API Failures (Cascade Failure)

### Symptom

ALL endpoints fail:
```javascript
❌ /api/health → 500 error
❌ /api/users → 500 error
❌ /api/dashboard → 500 error
❌ /api/model/train → 500 error
```

### Root Cause

1. Backend not reachable (network issue)
2. CORS blocking all requests
3. Backend crashed / not started
4. Configuration error

### Solution

#### Step 1: Systematic Diagnosis

Run in terminal:
```bash
# Test backend directly
curl -v https://eeg-api-xxxxx.onrender.com/api/health

# Expected: 200 OK with JSON response
# If fails: Backend unreachable or crashed
```

#### Step 2: Check Render Logs

**Render** → **Logs** tab → Search for:
- `ERROR` → Shows startup issues
- `Traceback` → Python exception details
- `Address already in use` → Port conflict

#### Step 3: Review Fix Checklist

- [ ] CORS enabled for your frontend origin
- [ ] Start command uses `0.0.0.0` and `$PORT`
- [ ] Environment variables set correctly
- [ ] No Python syntax errors in api/main.py
- [ ] `requirements.txt` installed successfully

#### Step 4: Check Frontend Error Handling

In browser console (F12):
- Green `✅` logs = working
- Red `❌` logs = errors
- Yellow `⚠️` logs = retries

---

## ISSUE 7: No Error Handling in Frontend (App Crashes Silently)

### Symptom

- App freezes or goes blank
- No error message shown to user
- Console has cryptic errors

### Solution - Already Implemented ✅

Frontend now has comprehensive error handling:

#### 1. Try-Catch on All API Calls

```javascript
async function onTrain() {
  try {
    const res = await trainModel();
    notify("success", res.message);
  } catch (err) {
    const msg = err?.response?.data?.detail || err.message || "Training failed";
    notify("error", msg);  // Shows user-friendly message
  }
}
```

#### 2. Network Retry Logic

Auto-retries network errors 3 times:
```javascript
// Automatic for GET requests and safe endpoints
```

#### 3. Health Check Validation

Validates backend health before operations:
```javascript
const health = await getHealth();
if (health.status !== "ok") {
  throw new Error("Backend unhealthy");
}
```

#### 4. User-Friendly Notifications

All errors show in UI notification bar:
- ❌ Red = Error
- ✅ Green = Success
- ⚠️ Amber = Warning
- ℹ️ Blue = Info

#### 5. Graceful Fallbacks

Some features gracefully degrade:
```javascript
const authLogs = await getAuthLogs().catch(() => []);
// If auth logs fail, shows empty list instead of crashing
```

---

## Production Readiness Checklist

Before sharing your link with users:

### Backend

- [ ] Deployed to Render
- [ ] Service shows green "Running" status
- [ ] Health endpoint returns valid JSON: `https://eeg-api-xxxxx.onrender.com/api/health`
- [ ] `CORS_ORIGINS` environment variable set to include frontend URL
- [ ] Model file exists (`assets/model.pth`) or can be trained
- [ ] Logs show "Startup complete" message
- [ ] No error messages in logs

### Frontend

- [ ] Deployed to Vercel  
- [ ] `VITE_API_BASE_URL` environment variable set correctly
- [ ] Build succeeds (`npm run build`)
- [ ] Can navigate between tabs without errors
- [ ] "Refresh" button syncs data successfully
- [ ] Browser console has no CORS error messages
- [ ] No 404s in network tab

### Integration

- [ ] Can register users (Users tab)
- [ ] Can train model (Training tab) - at least 2 users required
- [ ] Can view metrics (Metrics tab) - after training
- [ ] Can authenticate (Auth tab) - after training
- [ ] Can view dashboards (Overview tab)
- [ ] All API responses show in network tab with 200 status

### Performance

- [ ] First load < 5 seconds
- [ ] Training completes in < 10 minutes
- [ ] Retry logic visible in console (if cold starting)
- [ ] No memory leaks in browser DevTools

---

## Quick Commands Reference

```bash
# Test backend health
curl https://eeg-api-xxxxx.onrender.com/api/health

# Check DNS resolution
nslookup eeg-api-xxxxx.onrender.com

# View Render logs
# Via dashboard: Render → Logs tab

# Redeploy Vercel
vercel --prod

# Redeploy Render (must push or manual deploy)
git push origin main
# Then click "Manual Deploy" in Render, or auto-deploys from GitHub push

# Clear browser cache
# Chrome: Ctrl+Shift+R
# Firefox: Ctrl+Shift+R  
# Safari: Cmd+Shift+R
```

---

**Last Updated:** March 21, 2026
**Version:** 2.0.0 - Production Ready with Full Error Handling

