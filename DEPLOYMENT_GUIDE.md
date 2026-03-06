# 🚀 EEG Biometric Authentication - Deployment Guide

## Table of Contents
- [Quick Start (Local Demo)](#quick-start-local-demo)
- [Production Deployment](#production-deployment)
  - [Option 1: Docker Deployment](#option-1-docker-deployment)
  - [Option 2: Cloud Deployment (AWS/Azure/GCP)](#option-2-cloud-deployment)
  - [Option 3: VPS Deployment](#option-3-vps-deployment)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Security Checklist](#security-checklist)
- [Monitoring & Maintenance](#monitoring--maintenance)

---

## Quick Start (Local Demo)

### Prerequisites
- **Python 3.9+** installed
- **Node.js 18+** and npm installed
- **MySQL 8.0+** (optional - app has graceful fallback)
- Windows OS (for provided .bat files)

### Step 1: Clone & Setup Python Environment

```batch
cd D:\EEG-copy
python -m venv myenv
myenv\Scripts\activate
pip install -r requirements.txt
```

### Step 2: Configure Database (Optional)

If you want authentication logging, set up MySQL:

```batch
mysql -u root -p < setup_mysql.sql
```

Edit `db_config.py` with your MySQL credentials.

### Step 3: Start Backend API

```batch
run_api.bat
```

**Or manually:**
```batch
myenv\Scripts\activate
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

API will be available at: **http://localhost:8000**

### Step 4: Start Frontend

Open a **second terminal**:

```batch
run_frontend.bat
```

**Or manually:**
```batch
cd frontend
npm install
npm run dev
```

Frontend will be available at: **http://localhost:5174**

### Step 5: Test the System

1. Go to **http://localhost:5174**
2. Navigate to **Users** tab → Register a user (e.g., username: `alice`, subject ID: `01`)
3. Go to **Training** tab → Click "Train Model"
4. Go to **Authentication** tab → Upload `data/Filtered_Data/s01_ex05.csv`
5. Go to **Metrics** tab → Click "Evaluate Model" to see stunning visualizations!

---

## Production Deployment

### Option 1: Docker Deployment ✨ (Recommended)

#### Step 1: Create Dockerfile for Backend

Create `Dockerfile.backend`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    default-libmysqlclient-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY *.py ./
COPY api/ ./api/
COPY assets/ ./assets/
COPY data/ ./data/

# Expose port
EXPOSE 8000

# Run uvicorn
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### Step 2: Create Dockerfile for Frontend

Create `Dockerfile.frontend`:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY frontend/package*.json ./
RUN npm ci

# Copy source and build
COPY frontend/ ./
RUN npm run build

# Production server
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### Step 3: Create nginx.conf

```nginx
server {
    listen 80;
    server_name _;

    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### Step 4: Create docker-compose.yml

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: eeg_biometric
      MYSQL_USER: eeg_user
      MYSQL_PASSWORD: 5911
    volumes:
      - mysql_data:/var/lib/mysql
      - ./setup_mysql.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "3306:3306"
    networks:
      - eeg-network

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    ports:
      - "8000:8000"
    environment:
      - DB_HOST=mysql
      - DB_USER=eeg_user
      - DB_PASSWORD=5911
      - DB_NAME=eeg_biometric
    depends_on:
      - mysql
    volumes:
      - ./assets:/app/assets
      - ./data:/app/data
    networks:
      - eeg-network

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - eeg-network

volumes:
  mysql_data:

networks:
  eeg-network:
    driver: bridge
```

#### Step 5: Deploy

```batch
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Access: **http://localhost** (frontend automatically proxies API requests)

---

### Option 2: Cloud Deployment

#### AWS Deployment (EC2 + RDS)

**Step 1: Setup RDS MySQL Instance**
1. Go to AWS RDS Console
2. Create MySQL 8.0 database
3. Note endpoint, username, password
4. Update security group to allow inbound on 3306

**Step 2: Launch EC2 Instance**
1. Choose Ubuntu 22.04 LTS
2. Instance type: t3.medium (2 vCPU, 4GB RAM minimum)
3. Security group: Allow inbound on 22 (SSH), 80 (HTTP), 8000 (API)

**Step 3: SSH into EC2 and Setup**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python 3.11
sudo apt install python3.11 python3.11-venv python3-pip -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs -y

# Clone or upload your code
git clone <your-repo-url> eeg-app
cd eeg-app

# Setup Python
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Update db_config.py with RDS endpoint

# Setup Frontend
cd frontend
npm install
npm run build
cd ..

# Install PM2 for process management
sudo npm install -g pm2

# Start Backend
pm2 start "uvicorn api.main:app --host 0.0.0.0 --port 8000" --name eeg-backend

# Serve frontend (install serve)
sudo npm install -g serve
pm2 start "serve -s frontend/dist -p 80" --name eeg-frontend

# Save PM2 processes
pm2 save
pm2 startup
```

**Step 4: Configure Domain (Optional)**
1. Point your domain to EC2 public IP
2. Install Nginx & Certbot for HTTPS
3. Configure reverse proxy

---

### Option 3: VPS Deployment (DigitalOcean, Linode, Vultr)

**1. Choose VPS:** 
   - 2 vCPU, 4GB RAM minimum
   - Ubuntu 22.04 LTS

**2. SSH into VPS:**

```bash
ssh root@your-vps-ip
```

**3. Install Dependencies:**

```bash
# System updates
apt update && apt upgrade -y

# Install Python, Node, MySQL
apt install python3.11 python3.11-venv python3-pip nodejs npm mysql-server -y

# Secure MySQL
mysql_secure_installation
```

**4. Upload Code:**

```bash
# Using SCP from your local machine:
scp -r D:\EEG-copy root@your-vps-ip:/var/www/eeg-app

# Or use Git
cd /var/www
git clone <repo-url> eeg-app
cd eeg-app
```

**5. Setup Application:**

```bash
# Python environment
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend build
cd frontend
npm install
npm run build
cd ..

# Configure MySQL
mysql -u root -p < setup_mysql.sql
```

**6. Setup Nginx Reverse Proxy:**

```bash
apt install nginx -y

# Create Nginx config
nano /etc/nginx/sites-available/eeg-app
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /var/www/eeg-app/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable site:

```bash
ln -s /etc/nginx/sites-available/eeg-app /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

**7. Setup Systemd Service for Backend:**

```bash
nano /etc/systemd/system/eeg-backend.service
```

```ini
[Unit]
Description=EEG Biometric Backend API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/eeg-app
Environment="PATH=/var/www/eeg-app/venv/bin"
ExecStart=/var/www/eeg-app/venv/bin/uvicorn api.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

Start service:

```bash
systemctl daemon-reload
systemctl start eeg-backend
systemctl enable eeg-backend
systemctl status eeg-backend
```

**8. Setup HTTPS with Let's Encrypt:**

```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d your-domain.com
```

---

## Environment Configuration

### Backend Environment Variables

Create `.env` file in project root:

```env
# Database
DB_HOST=localhost
DB_USER=eeg_user
DB_PASSWORD=5911
DB_NAME=eeg_biometric
DB_POOL_SIZE=5

# API
API_HOST=0.0.0.0
API_PORT=8000
API_WORKERS=4

# Security
SECRET_KEY=your-super-secret-key-here
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com

# Paths
DATA_DIR=./data/Filtered_Data
ASSETS_DIR=./assets
MODEL_PATH=./assets/eeg_auth_model.pth
```

### Frontend Environment Variables

Create `frontend/.env.production`:

```env
VITE_API_BASE_URL=https://your-api-domain.com
```

---

## Database Setup

### Production MySQL Configuration

```sql
-- Create dedicated user with limited privileges
CREATE USER 'eeg_prod'@'%' IDENTIFIED BY 'strong-password-here';
GRANT SELECT, INSERT, UPDATE, DELETE ON eeg_biometric.* TO 'eeg_prod'@'%';
FLUSH PRIVILEGES;

-- Enable binary logging for backups
SET GLOBAL binlog_format = 'ROW';

-- Configure connection limits
SET GLOBAL max_connections = 200;
```

### Backup Strategy

```bash
# Daily backup cron job
0 2 * * * mysqldump -u eeg_user -p5911 eeg_biometric > /backups/eeg_$(date +\%Y\%m\%d).sql

# Backup assets folder
0 3 * * * tar -czf /backups/assets_$(date +\%Y\%m\%d).tar.gz /var/www/eeg-app/assets
```

---

## Security Checklist

### ✅ Pre-Deployment Security

- [ ] Change default database passwords
- [ ] Use HTTPS (SSL/TLS certificates)
- [ ] Enable CORS only for trusted origins
- [ ] Implement rate limiting on API endpoints
- [ ] Sanitize all file uploads
- [ ] Use environment variables for secrets
- [ ] Enable firewall (UFW on Ubuntu)
- [ ] Disable root SSH access
- [ ] Use SSH keys instead of passwords
- [ ] Keep dependencies updated (`pip list --outdated`)

### API Security Enhancements

Add to `api/main.py`:

```python
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

# Rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Trusted hosts
app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=["yourdomain.com", "www.yourdomain.com"]
)
```

---

## Monitoring & Maintenance

### Health Monitoring

```bash
# Check API health
curl http://localhost:8000/api/health

# Monitor resource usage
htop

# Check logs
pm2 logs eeg-backend
journalctl -u eeg-backend -f
```

### Performance Optimization

**Backend:**
- Use gunicorn with multiple workers: `gunicorn -w 4 -k uvicorn.workers.UvicornWorker api.main:app`
- Enable response caching
- Optimize model loading (load once, reuse)

**Frontend:**
- Minify and compress assets
- Use CDN for static assets
- Enable Gzip compression in Nginx
- Implement lazy loading for charts

### Logging

Configure structured logging in `backend.py`:

```python
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('eeg_app.log'),
        logging.StreamHandler()
    ]
)
```

---

## Troubleshooting

### Common Issues

**1. "ModuleNotFoundError" in Production**
```bash
# Ensure all dependencies installed
pip install -r requirements.txt --no-cache-dir
```

**2. "Connection refused" to MySQL**
```bash
# Check MySQL is running
systemctl status mysql

# Verify credentials in db_config.py
# Check firewall allows port 3306
```

**3. CORS errors in browser**
```python
# Update CORS middleware in api/main.py
# Add your frontend domain to allow_origins
```

**4. Frontend shows "Failed to fetch"**
- Check `VITE_API_BASE_URL` in `.env.production`
- Verify API is accessible from browser network tab
- Check Nginx proxy configuration

---

## Scaling Considerations

### Horizontal Scaling

- **Load Balancer:** Use Nginx/HAProxy to distribute traffic across multiple backend instances
- **Database:** MySQL read replicas for read-heavy workloads
- **Caching:** Redis for session management and computed metrics
- **Object Storage:** S3/MinIO for EEG data files

### Vertical Scaling

**Recommended Resources:**
- **Small (< 100 users):** 2 vCPU, 4GB RAM
- **Medium (100-1000 users):** 4 vCPU, 8GB RAM
- **Large (1000+ users):** 8+ vCPU, 16GB+ RAM

---

## Support & Maintenance

**Regular Maintenance Tasks:**
- Weekly: Check disk space, review logs
- Monthly: Update dependencies, security patches
- Quarterly: Database optimization, backup restoration tests

**Monitoring Metrics:**
- API response times (< 500ms target)
- Model inference time (< 2s per authentication)
- Database query performance
- System resource usage (CPU, RAM, Disk)

---

## 🎉 Deployment Complete!

Your EEG Biometric Authentication system is now production-ready. For questions or issues, refer to the main `README.md` or check application logs.

**Live System URLs:**
- Frontend: `https://yourdomain.com`
- API: `https://yourdomain.com/api`
- Health Check: `https://yourdomain.com/api/health`

---

**Last Updated:** March 2026  
**Version:** 2.0
