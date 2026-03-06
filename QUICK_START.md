# 🚀 Quick Start Guide for Team Members

## Initial Setup (First Time Only)

### 1. Clone Repository

```bash
git clone https://github.com/SachinKukkar/EEG-new.git
cd EEG-new
```

### 2. Setup Python Environment

```bash
# Create virtual environment
python -m venv myenv

# Activate (Windows)
myenv\Scripts\activate

# Activate (Linux/Mac)
source myenv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Setup Frontend

```bash
cd frontend
npm install
cd ..
```

### 4. (Optional) Setup MySQL Database

```bash
mysql -u root -p < setup_mysql.sql
```

Edit `db_config.py` if needed to match your MySQL credentials.

---

## Running the Application

### Start Backend API

```bash
# Windows
myenv\Scripts\activate
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload

# Linux/Mac
source myenv/bin/activate
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

API will be at: http://localhost:8000  
API Docs: http://localhost:8000/docs

### Start Frontend (in new terminal)

```bash
cd frontend
npm run dev
```

Frontend will be at: http://localhost:5173 or http://localhost:5174

---

## Git Workflow for Team Members

### Daily Workflow

```bash
# 1. Start of day - update develop branch
git checkout develop
git pull origin develop

# 2. Create your feature branch
git checkout -b <role>/<feature-name>

# Examples:
git checkout -b frontend/add-user-profile
git checkout -b backend/improve-auth-logic
git checkout -b docs/update-api-guide
git checkout -b test/add-api-tests

# 3. Make your changes
# ... edit files ...

# 4. Check what you changed
git status
git diff

# 5. Add your changes
git add .
# Or add specific files
git add frontend/src/App.jsx

# 6. Commit with meaningful message
git commit -m "feat(frontend): add user profile component"

# Examples of commit messages:
# git commit -m "feat(backend): add user authentication endpoint"
# git commit -m "fix(frontend): resolve responsive layout issue"
# git commit -m "docs(readme): update installation steps"
# git commit -m "test(api): add tests for user registration"

# 7. Push to GitHub
git push origin <role>/<feature-name>

# 8. Go to GitHub and create Pull Request
# - Base: develop
# - Compare: your branch
# - Request reviews from teammates
```

### Pull Request Guidelines

**PR Title Format:**
```
feat(frontend): Add user dashboard
fix(backend): Resolve authentication timeout
docs(deployment): Update Docker instructions
test(api): Add integration tests
```

**PR Description Template:**
```markdown
## What Changed
- Added user dashboard component
- Integrated with /api/dashboard endpoint
- Added responsive design

## Related Issue
Closes #123

## Testing
- Tested in Chrome, Firefox, Edge
- Verified API integration
- Checked responsive layout

## Screenshots
[Attach screenshots if UI changes]

## Checklist
- [x] Code tested locally
- [x] Documentation updated
- [x] No console errors
- [x] Follows team conventions
```

### Syncing Your Branch

```bash
# If develop has new changes while you're working
git checkout develop
git pull origin develop
git checkout your-branch
git merge develop

# Resolve any conflicts, then:
git add .
git commit -m "merge: sync with develop"
git push origin your-branch
```

---

## Team-Specific Guidelines

### Frontend Developer 🎨

**Your Files:**
- `frontend/src/App.jsx`
- `frontend/src/styles.css`
- `frontend/src/api/client.js`
- All `.jsx` components

**Before Committing:**
```bash
cd frontend
npm run build  # Make sure build works
npm run preview  # Test production build
```

**Common Tasks:**
```bash
# Add new component
touch frontend/src/components/NewComponent.jsx

# Update styles
code frontend/src/styles.css

# Install new package
cd frontend
npm install recharts --save
cd ..
git add frontend/package.json frontend/package-lock.json
```

---

### Backend/ML Developer 🧠

**Your Files:**
- `api/main.py`
- `backend.py`
- `model_management.py`
- `eeg_processing.py`
- `database.py`

**Before Committing:**
```bash
# Test API
uvicorn api.main:app --reload
# Visit http://localhost:8000/docs

# Run tests (when available)
pytest tests/
```

**Common Tasks:**
```bash
# Add new endpoint
code api/main.py

# Update model
code model_management.py

# Install new package
pip install scikit-learn
pip freeze | Select-String "scikit-learn" >> requirements.txt
```

---

### Documentation Specialist 📚

**Your Files:**
- `README.md`
- `CONTRIBUTING.md`
- `DEPLOYMENT_GUIDE.md`
- `TEAM_STRUCTURE.md`
- All `.md` files

**Before Committing:**
```bash
# Check for broken links
# Preview markdown rendering
# Test all code examples
```

**Common Tasks:**
```bash
# Update README
code README.md

# Add new guide
touch docs/SECURITY_GUIDE.md

# Check all docs
ls *.md
```

---

### Testing & Visualization Expert 🧪

**Your Files:**
- `metrics_visualizer.py`
- `tests/` directory
- `pytest.ini`

**Before Committing:**
```bash
# Run all tests
pytest tests/ -v

# Check coverage
pytest --cov=. --cov-report=html

# Test visualizations
python metrics_visualizer.py
```

**Common Tasks:**
```bash
# Create test file
touch tests/test_authentication.py

# Update metrics
code metrics_visualizer.py

# Install test dependencies
pip install pytest pytest-cov
```

---

## Common Commands

### Git

```bash
# Check current branch
git branch

# Switch branch
git checkout <branch-name>

# See changes
git status
git diff

# Undo changes (before commit)
git checkout -- <file>

# See commit history
git log --oneline

# Pull latest
git pull origin develop

# Push changes
git push origin <your-branch>
```

### Python

```bash
# Activate environment
myenv\Scripts\activate  # Windows
source myenv/bin/activate  # Linux/Mac

# Install package
pip install <package-name>

# Update requirements
pip freeze > requirements.txt

# Run API
uvicorn api.main:app --reload
```

### Frontend

```bash
# Install dependencies
npm install

# Dev server
npm run dev

# Build production
npm run build

# Install package
npm install <package-name>
```

---

## Troubleshooting

### "Git not recognized"
- Install Git: https://git-scm.com/downloads

### "Python not found"
- Install Python 3.9+: https://www.python.org/downloads/

### "npm not recognized"
- Install Node.js 18+: https://nodejs.org/

### "Port already in use"
```bash
# Kill process on port (Windows)
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Change port
uvicorn api.main:app --port 8001
```

### "Module not found"
```bash
# Reinstall dependencies
pip install -r requirements.txt
cd frontend && npm install
```

### Merge Conflicts
```bash
# 1. Open conflicted files
# 2. Look for <<<<<<< and >>>>>>>
# 3. Edit to keep desired changes
# 4. Remove conflict markers
# 5. Stage and commit
git add <resolved-file>
git commit -m "merge: resolve conflicts"
```

---

## Resources

- **Git Guide:** https://git-scm.com/doc
- **GitHub Flow:** https://guides.github.com/introduction/flow/
- **React Docs:** https://react.dev
- **FastAPI Docs:** https://fastapi.tiangolo.com
- **PyTorch Docs:** https://pytorch.org/docs
- **Team Docs:** See `CONTRIBUTING.md` and `TEAM_STRUCTURE.md`

---

## Need Help?

1. Check documentation in repository
2. Ask in team chat
3. Create GitHub issue
4. Review previous PRs for examples

---

## Quick Reference Card

```
SETUP:              git clone → python -m venv → pip install → npm install
DAILY:              git pull → git checkout -b → code → git add → git commit → git push
BACKEND:            uvicorn api.main:app --reload
FRONTEND:           cd frontend && npm run dev
TEST:               pytest tests/
BUILD:              npm run build
HELP:               git status, git log, git diff
```

---

**Happy Coding! 🚀**

See `CONTRIBUTING.md` for detailed team workflow.
