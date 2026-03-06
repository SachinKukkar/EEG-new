# 🤝 Contributing to EEG Biometric Authentication System

## Team Structure

This project is collaboratively developed by a 4-person team:

### 👥 Team Roles

| Role | Responsibilities | Primary Directories | Branch Prefix |
|------|-----------------|---------------------|---------------|
| **Frontend Developer** | React UI, components, styling, API integration | `frontend/`, CSS files | `frontend/` |
| **Backend/ML Developer** | FastAPI endpoints, ML models, training logic | `api/`, `backend.py`, `model_management.py`, `eeg_processing.py` | `backend/` or `ml/` |
| **Documentation Specialist** | All documentation, guides, API docs | `*.md` files, documentation | `docs/` |
| **Testing & Visualization** | Testing, metrics charts, data visualization | `metrics_visualizer.py`, tests, visualizations | `test/` or `viz/` |

---

## 🌿 Branching Strategy

### Main Branches

- **`main`** — Production-ready code, protected branch
- **`develop`** — Integration branch for ongoing development

### Feature Branches

Each team member creates feature branches from `develop`:

**Naming Convention:**
```
<role>/<feature-description>

Examples:
- frontend/add-dashboard-charts
- backend/improve-auth-endpoint
- docs/update-deployment-guide
- test/add-unit-tests
- viz/enhance-metrics-display
```

### Branch Workflow

```
main (protected)
  └── develop
       ├── frontend/feature-name
       ├── backend/feature-name
       ├── docs/feature-name
       └── test/feature-name
```

---

## 🔄 Git Workflow

### 1. Clone the Repository

```bash
git clone https://github.com/SachinKukkar/EEG-new.git
cd EEG-new
```

### 2. Create Your Feature Branch

```bash
# Switch to develop branch
git checkout develop

# Pull latest changes
git pull origin develop

# Create your feature branch
git checkout -b <role>/<feature-name>

# Examples:
git checkout -b frontend/add-authentication-ui
git checkout -b backend/optimize-model-training
git checkout -b docs/add-api-examples
git checkout -b test/add-integration-tests
```

### 3. Make Changes

Work on your assigned components following the team structure.

### 4. Commit Your Changes

```bash
# Stage your changes
git add .

# Commit with descriptive message
git commit -m "feat(frontend): add authentication result display"

# Commit message format:
# <type>(<scope>): <description>
#
# Types: feat, fix, docs, style, refactor, test, chore
# Scopes: frontend, backend, ml, docs, test, viz, api
```

**Commit Message Examples:**
```bash
git commit -m "feat(frontend): add real-time metrics dashboard"
git commit -m "fix(backend): resolve authentication timeout issue"
git commit -m "docs(deployment): add Docker Swarm guide"
git commit -m "test(api): add unit tests for user registration"
git commit -m "feat(viz): implement interactive ROC curve"
git commit -m "chore(deps): update React to 18.3.1"
```

### 5. Push Your Changes

```bash
git push origin <role>/<feature-name>
```

### 6. Create Pull Request

1. Go to GitHub repository
2. Click "New Pull Request"
3. Base: `develop` ← Compare: `<your-branch>`
4. Add description of changes
5. Request review from relevant team member(s)
6. Wait for approval and merge

---

## 👨‍💻 Role-Specific Guidelines

### Frontend Developer 🎨

**Your Domain:**
- `frontend/src/` — All React components
- `frontend/src/styles.css` — Styling
- `frontend/src/api/client.js` — API client

**Best Practices:**
- Keep components modular and reusable
- Follow React hooks best practices
- Maintain consistent styling (use CSS variables)
- Test UI in different screen sizes
- Document prop types and component usage

**Before Committing:**
```bash
cd frontend
npm run build  # Ensure build works
npm run preview  # Test production build
```

**Communication:**
- Coordinate with Backend Dev on API changes
- Notify Testing team of new UI features
- Update Documentation team on UI flow changes

---

### Backend/ML Developer 🧠

**Your Domain:**
- `api/main.py` — FastAPI endpoints
- `backend.py` — Core business logic
- `model_management.py` — ML model architecture
- `eeg_processing.py` — Data processing
- `metrics_visualizer.py` — Metrics computation

**Best Practices:**
- Follow REST API conventions
- Add proper error handling
- Document all API endpoints
- Validate all inputs
- Log important operations
- Optimize model performance

**Before Committing:**
```bash
# Test API endpoints
uvicorn api.main:app --reload
# Visit http://localhost:8000/docs to verify

# Run backend tests (when available)
pytest tests/
```

**Communication:**
- Inform Frontend Dev of API changes (endpoint, request/response format)
- Notify Testing team of new endpoints to test
- Update Documentation team on API changes

---

### Documentation Specialist 📚

**Your Domain:**
- `README.md` — Project overview
- `DEPLOYMENT_GUIDE.md` — Deployment instructions
- `DEMO_WALKTHROUGH.md` — Demo guide
- `CONTRIBUTING.md` — This file
- API documentation
- Code comments review

**Best Practices:**
- Keep documentation up-to-date with code changes
- Use clear, concise language
- Include examples and code snippets
- Add diagrams where helpful
- Maintain consistent formatting
- Review PRs for documentation needs

**Documentation Checklist:**
- [ ] API endpoints documented
- [ ] Environment variables explained
- [ ] Setup steps clear and tested
- [ ] Troubleshooting section updated
- [ ] Examples working and current
- [ ] Links valid and not broken

**Communication:**
- Monitor all PRs for documentation needs
- Ask developers to explain new features
- Coordinate with all team members

---

### Testing & Visualization Expert 🧪

**Your Domain:**
- `metrics_visualizer.py` — Chart generation
- Test files (`tests/` directory)
- Data visualization components
- Integration testing
- Performance testing

**Best Practices:**
- Write comprehensive test cases
- Test edge cases and error scenarios
- Ensure visualizations are accurate
- Verify chart responsiveness
- Document test procedures
- Track and report bugs

**Before Committing:**
```bash
# Run all tests
pytest tests/ -v

# Check test coverage
pytest --cov=.

# Test visualizations manually
```

**Testing Checklist:**
- [ ] Unit tests for new functions
- [ ] Integration tests for API endpoints
- [ ] UI component tests
- [ ] Data validation tests
- [ ] Performance benchmarks
- [ ] Cross-browser testing (frontend)

**Communication:**
- Report bugs to relevant developers
- Suggest improvements based on testing
- Update Documentation team on test procedures

---

## 🔍 Code Review Process

### For Pull Request Authors

1. **Self-Review First**
   - Review your own changes
   - Check for console.log / debug statements
   - Verify no sensitive data committed
   - Run tests locally

2. **PR Description Template**
   ```markdown
   ## Changes Made
   - Bullet point list of changes
   
   ## Related Issue
   Fixes #<issue-number>
   
   ## Testing Done
   - How you tested the changes
   
   ## Screenshots (if UI changes)
   [Attach screenshots]
   
   ## Checklist
   - [ ] Code tested locally
   - [ ] Documentation updated
   - [ ] No console errors
   - [ ] Follows coding standards
   ```

3. **Request Reviewers**
   - Frontend changes → Backend Dev + Testing
   - Backend changes → Frontend Dev + Testing
   - Docs changes → All team members
   - Testing changes → Backend Dev + Frontend Dev

### For Reviewers

**Review Criteria:**
- [ ] Code follows project conventions
- [ ] No security vulnerabilities
- [ ] Proper error handling
- [ ] Changes are well-documented
- [ ] Tests included/updated
- [ ] No breaking changes (or properly communicated)

**Review Etiquette:**
- Be constructive and respectful
- Explain why you suggest changes
- Approve when satisfied, request changes if needed
- Respond promptly to reviews

---

## 📋 Issue Tracking

### Creating Issues

Use GitHub Issues with labels:

**Labels:**
- `bug` — Something isn't working
- `feature` — New feature request
- `frontend` — Frontend-related
- `backend` — Backend-related
- `ml` — Machine learning related
- `docs` — Documentation
- `test` — Testing related
- `viz` — Visualization related
- `urgent` — High priority
- `help wanted` — Need assistance

**Issue Template:**
```markdown
## Description
Clear description of the issue/feature

## Current Behavior
What currently happens

## Expected Behavior
What should happen

## Steps to Reproduce (for bugs)
1. Step 1
2. Step 2
3. ...

## Environment
- OS: [e.g., Windows 11]
- Python: [e.g., 3.11]
- Node: [e.g., 18.x]

## Additional Context
Screenshots, error logs, etc.
```

### Assigning Issues

- Frontend issues → Frontend Developer
- Backend/ML issues → Backend Developer
- Documentation issues → Documentation Specialist
- Testing/Viz issues → Testing & Visualization Expert

---

## 🚀 Release Process

### Version Numbering

Using Semantic Versioning: `MAJOR.MINOR.PATCH`

- **MAJOR** — Incompatible API changes
- **MINOR** — New features (backwards compatible)
- **PATCH** — Bug fixes

### Release Workflow

1. **Feature Complete** — All features for version on `develop`
2. **Create Release Branch**
   ```bash
   git checkout -b release/v2.1.0 develop
   ```
3. **Testing Phase** — Full testing by Testing team
4. **Bug Fixes** — Fix on release branch
5. **Update Version** — Update package.json, version files
6. **Merge to Main**
   ```bash
   git checkout main
   git merge release/v2.1.0
   git tag -a v2.1.0 -m "Release version 2.1.0"
   ```
7. **Merge Back to Develop**
   ```bash
   git checkout develop
   git merge release/v2.1.0
   ```
8. **Deploy** — Deploy to production

---

## 🛠️ Development Setup

### Initial Setup (All Team Members)

```bash
# 1. Clone repository
git clone https://github.com/SachinKukkar/EEG-new.git
cd EEG-new

# 2. Create develop branch (first time only)
git checkout -b develop

# 3. Setup Python environment
python -m venv myenv
myenv\Scripts\activate  # Windows
pip install -r requirements.txt

# 4. Setup Frontend
cd frontend
npm install
cd ..

# 5. (Optional) Setup MySQL
mysql -u root -p < setup_mysql.sql
```

### Daily Workflow

```bash
# 1. Start your day
git checkout develop
git pull origin develop

# 2. Create/switch to feature branch
git checkout -b <role>/<feature-name>

# 3. Work on your tasks
# ... make changes ...

# 4. Test your changes
# Run appropriate tests for your role

# 5. Commit and push
git add .
git commit -m "feat(<scope>): <description>"
git push origin <role>/<feature-name>

# 6. Create PR on GitHub when ready
```

---

## 📞 Communication

### Daily Standup (Recommended)

**Every team member shares:**
1. What I did yesterday
2. What I'll do today
3. Any blockers

### Coordination

- **Frontend ↔ Backend:** API contract agreement
- **Frontend ↔ Testing:** New features to test
- **Backend ↔ Testing:** API endpoints to test
- **All ↔ Docs:** Feature documentation needs

### Tools

- **GitHub Issues** — Task tracking
- **GitHub Projects** — Sprint planning
- **Pull Requests** — Code review discussion
- **Slack/Discord** — Quick communication
- **Wiki** — Knowledge base

---

## 🎯 Best Practices

### General

- ✅ Write clear commit messages
- ✅ Keep PRs focused (one feature per PR)
- ✅ Update documentation with code changes
- ✅ Test before committing
- ✅ Review others' code promptly
- ✅ Communicate early and often

### Code Quality

- ✅ Follow PEP 8 (Python) and Airbnb style (JavaScript)
- ✅ No hardcoded values (use config files)
- ✅ Proper error handling
- ✅ Meaningful variable/function names
- ✅ Add comments for complex logic
- ✅ Remove debug code before committing

### Security

- ❌ Never commit secrets (.env files)
- ❌ Never commit passwords or API keys
- ❌ Don't commit large binary files
- ✅ Use environment variables
- ✅ Validate all inputs
- ✅ Review security before merging

---

## 🐛 Troubleshooting

### Merge Conflicts

```bash
# 1. Update your branch with latest develop
git checkout develop
git pull origin develop
git checkout <your-branch>
git merge develop

# 2. Resolve conflicts in files
# 3. Mark as resolved
git add <resolved-files>
git commit -m "merge: resolve conflicts with develop"

# 4. Push
git push origin <your-branch>
```

### Sync Your Fork (if using forks)

```bash
# Add upstream remote (once)
git remote add upstream https://github.com/SachinKukkar/EEG-new.git

# Sync with upstream
git fetch upstream
git checkout develop
git merge upstream/develop
git push origin develop
```

---

## 📊 Project Metrics Tracking

Track these metrics (Testing team):

- Code coverage percentage
- Number of open/closed issues
- PR merge time
- Bug fix time
- API response times
- Model accuracy metrics

---

## 🎉 Getting Help

**Stuck? Ask your team!**

- **General Questions** → Post in team chat
- **Frontend Issues** → @frontend-dev
- **Backend Issues** → @backend-dev
- **Documentation** → @docs-specialist
- **Testing/Viz** → @test-viz-expert

**External Resources:**
- [React Docs](https://react.dev)
- [FastAPI Docs](https://fastapi.tiangolo.com)
- [PyTorch Docs](https://pytorch.org/docs)
- [Git Documentation](https://git-scm.com/doc)

---

## 📝 Changelog

Maintain CHANGELOG.md with all notable changes:

```markdown
## [2.1.0] - 2026-03-15
### Added
- New metrics visualization dashboard
- Docker deployment support

### Changed
- Improved authentication response time

### Fixed
- Fixed memory leak in model training
```

---

**Happy Coding! 🚀**

Questions? Open an issue or ask your team lead!
