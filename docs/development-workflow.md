# Development Workflow Guide - XP Project

## 🚀 Getting Started (First Time Setup)

### Prerequisites Checklist
```bash
# Check your environment
node --version          # Must be >= 18.0.0
npm --version           # Must be >= 9.0.0
psql --version          # PostgreSQL 13+

# WSL2 users - verify Windows host IP
cat /etc/resolv.conf | grep nameserver
# Should show something like: nameserver 172.26.240.1
```

### Initial Setup Sequence
```bash
# 1. Clone and enter project
cd /mnt/c/Users/Admin/source/repos/XP

# 2. Install all dependencies
npm run setup

# 3. Setup database (PostgreSQL must be running)
cd backend
cp .env.example .env
# Edit .env - set DATABASE_HOST to Windows IP if WSL2
npm run migrate

# 4. Setup frontend environment
cd ../frontend
cp .env.example .env
# Usually no changes needed

# 5. Verify setup
cd ..
npm run dev
# Should start both frontend and backend
```

## 📝 Daily Development Flow

### Morning Startup Routine
```bash
# 1. Pull latest changes
git pull origin main

# 2. Check for new migrations
cd backend
ls migrations/  # Check for new files
npm run migrate # Run if new migrations exist

# 3. Update dependencies if package.json changed
cd ..
npm run setup

# 4. Start development servers
npm run dev

# 5. Verify everything works
curl http://localhost:5000/health
# Should return: {"status":"healthy","timestamp":"..."}
```

### Active Development Workflow

#### Working on Backend Features
```bash
# Terminal 1 - Backend only
cd backend
npm run dev
# Watches for changes, auto-restarts

# Terminal 2 - Test your changes
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

#### Working on Frontend Features  
```bash
# Terminal 1 - Frontend only
cd frontend
npm run dev
# Hot module replacement enabled

# Browser automatically opens to http://localhost:3000
# If port 3000 is busy, tries 3001
```

#### Working on Full Stack Features
```bash
# Single terminal - both services
npm run dev
# Starts both frontend and backend
```

### Code Quality Checks (Before Committing)

```bash
# 1. Type checking
npm run type-check
# Or separately:
# npm run type-check:frontend
# npm run type-check:backend

# 2. Linting
npm run lint
# Fix automatically:
npm run lint:fix

# 3. Run tests (limited coverage)
npm run test:backend
npm run test:frontend

# 4. Manual testing checklist
- [ ] Login works
- [ ] Forms can be created/saved
- [ ] No console errors in browser
- [ ] No crash in backend logs
```

## 🔨 Common Development Tasks

### Adding a New API Endpoint

1. **Create Route Handler**
```typescript
// backend/src/routes/newFeatureRoutes.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/new-endpoint', authenticate, async (req, res) => {
  // Implementation
});

export default router;
```

2. **Register in App**
```typescript
// backend/src/app.ts
import newFeatureRoutes from './routes/newFeatureRoutes';

// Add after other routes
app.use('/api/new-feature', newFeatureRoutes);
```

3. **Add Frontend Service**
```typescript
// frontend/src/services/newFeatureService.ts
import api from './api';

export const newFeatureService = {
  getData: () => api.get('/new-feature/new-endpoint'),
};
```

### Adding a Database Table

1. **Create Migration File**
```sql
-- backend/migrations/019_create_new_table.sql
CREATE TABLE IF NOT EXISTS new_table (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_new_table_user_id ON new_table(user_id);
```

2. **Run Migration**
```bash
cd backend
npm run migrate
```

3. **Create Model** (Note: We use raw SQL, not ORM)
```typescript
// backend/src/models/NewModel.ts
import { pool } from '../utils/database';

export class NewModel {
  static async create(data: any) {
    const result = await pool.query(
      'INSERT INTO new_table (user_id, data) VALUES ($1, $2) RETURNING *',
      [data.userId, JSON.stringify(data.data)]
    );
    return result.rows[0];
  }
}
```

### Adding a Frontend Page

1. **Create Page Component**
```tsx
// frontend/src/pages/NewPage.tsx
import React from 'react';

export const NewPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1>New Page</h1>
    </div>
  );
};
```

2. **Add Route**
```tsx
// frontend/src/App.tsx
import { NewPage } from './pages/NewPage';

// In routes section
<Route path="/new-page" element={<NewPage />} />
```

3. **Add Navigation Link**
```tsx
// frontend/src/components/layout/AppLayout.tsx
<Link to="/new-page">New Feature</Link>
```

## 🐛 Debugging Workflows

### Backend Debugging

#### Check Logs
```bash
# Real-time logs
tail -f backend/logs/app-*.log

# Search for errors
grep ERROR backend/logs/app-*.log

# Database queries (set NODE_ENV=development)
export NODE_ENV=development
cd backend && npm run dev
# Now SQL queries are logged
```

#### Common Issues & Solutions

| Problem | Debug Steps | Solution |
|---------|------------|----------|
| "Cannot connect to database" | `psql -h 172.26.240.1 -U postgres -c "SELECT 1"` | Fix DATABASE_HOST in .env |
| "JWT_SECRET not defined" | `echo $JWT_SECRET` | Add to backend/.env |
| "Module not found" | `ls node_modules/[module]` | Run `npm install` |
| Memory leak warning | Check `backend/logs/memory-*.log` | Restart server, check WebSocket cleanup |

### Frontend Debugging

#### Browser DevTools
```javascript
// Add breakpoints in code
debugger;

// Check network tab for API calls
// Check console for errors
// Use React DevTools extension
```

#### Common Issues & Solutions

| Problem | Debug Steps | Solution |
|---------|------------|----------|
| Blank page | Check browser console | Usually import errors |
| API calls fail | Check Network tab | Wrong API_URL or CORS |
| State not updating | React DevTools | Check context providers |
| Styles not working | Inspect element | Tailwind class typos |

## 🧪 Testing Workflows

### Manual Testing Checklist

#### Authentication Flow
```bash
# 1. Test registration
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test User"}'

# 2. Test login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'

# 3. Save the token from response
TOKEN="eyJhbGc..."

# 4. Test authenticated endpoint
curl http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer $TOKEN"
```

#### Form Builder Testing
1. Create a new form
2. Add multiple field types
3. Drag to reorder fields
4. Save the form
5. Preview the form
6. Submit test data
7. Check submission in database

#### GPS Module Testing
1. Enable location permissions
2. Start tracking session
3. Move around (or fake coordinates)
4. Stop tracking
5. View location history

### Automated Testing

```bash
# Unit tests
cd backend && npm test
cd ../frontend && npm test

# E2E tests (Playwright)
cd e2e && npm test

# Specific test file
npm test -- auth.spec.ts
```

## 📦 Build & Deployment Workflow

### Local Build Test
```bash
# Build backend
cd backend
npm run build
# Check dist/ folder created

# Build frontend
cd ../frontend  
npm run build
# Check dist/ folder created

# Test production builds
cd ../backend
NODE_ENV=production node dist/server.js

# In another terminal
cd ../frontend
npx serve -s dist -p 3000
```

### Pre-Deployment Checklist
- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] No console.log statements
- [ ] Environment variables documented
- [ ] Database migrations tested
- [ ] API documentation updated
- [ ] Version bumped in package.json

### Deployment Steps (Windows/WSL2)
```powershell
# Use PowerShell scripts
.\scripts\deploy-windows.ps1

# Or manual steps:
1. Build both apps
2. Copy dist folders to server
3. Update environment variables
4. Run migrations on production DB
5. Restart services
6. Verify health endpoint
```

## 🔄 Git Workflow

### Branch Strategy
```bash
main          # Production-ready code
├── develop   # Integration branch
├── feature/* # New features
├── fix/*     # Bug fixes
└── hotfix/*  # Emergency fixes
```

### Commit Process
```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Make changes
# ... edit files ...

# 3. Check what changed
git status
git diff

# 4. Stage changes
git add -A

# 5. Commit with meaningful message
git commit -m "feat: add new feature

- Implemented X functionality
- Updated Y component
- Fixed Z issue"

# 6. Push to remote
git push origin feature/new-feature

# 7. Create Pull Request
# Use GitHub/GitLab UI
```

### Code Review Checklist
- [ ] No hardcoded secrets
- [ ] TypeScript types added
- [ ] Error handling present
- [ ] Database queries parameterized
- [ ] Tests added/updated
- [ ] Documentation updated

## 🆘 Emergency Procedures

### Server Crash Recovery
```bash
# 1. Check if process is running
ps aux | grep node

# 2. Check memory usage
free -h

# 3. Restart backend
cd backend
npm run dev

# 4. Check logs for errors
tail -100 backend/logs/app-*.log
```

### Database Connection Lost
```bash
# 1. Test connection
psql -h 172.26.240.1 -U postgres -d postgres -c "SELECT 1"

# 2. Restart PostgreSQL (on Windows)
# Use Services app or:
net stop postgresql
net start postgresql

# 3. Check connection pool
# May need to restart backend
```

### Memory Leak Detected
```bash
# 1. Check memory monitor logs
cat backend/logs/memory-*.log

# 2. Identify leaking module
# Usually WebSocket connections

# 3. Temporary fix - restart
pm2 restart backend

# 4. Long-term - fix cleanup code
```

## 📋 Daily Checklist

### Start of Day
- [ ] Pull latest code
- [ ] Run migrations if needed
- [ ] Start dev servers
- [ ] Check health endpoint
- [ ] Review logs for overnight errors

### Before Committing
- [ ] Run type-check
- [ ] Run linting
- [ ] Test main flows manually
- [ ] Remove debug code
- [ ] Update documentation

### End of Day
- [ ] Commit or stash changes
- [ ] Push feature branches
- [ ] Note any blockers
- [ ] Stop dev servers (optional)

## 💡 Productivity Tips

1. **Use VS Code Tasks** - Configure tasks.json for common commands
2. **Install Extensions** - ESLint, Prettier, GitLens, Thunder Client
3. **Create Snippets** - For common code patterns
4. **Use Postman/Insomnia** - Save API collections
5. **Monitor Performance** - Keep DevTools open
6. **Document as You Go** - Update README immediately
7. **Test Early** - Don't wait until feature is complete
8. **Ask Questions** - Check existing docs first

## 🔗 Quick Command Reference

```bash
# Development
npm run dev                 # Start everything
npm run dev:frontend       # Frontend only
npm run dev:backend        # Backend only

# Database
npm run migrate            # Run migrations
npm run db:test           # Test connection

# Quality
npm run lint              # Check code style
npm run lint:fix          # Auto-fix issues
npm run type-check        # TypeScript check
npm run test              # Run tests

# Build
npm run build:frontend    # Build frontend
npm run build:backend     # Build backend

# Utilities
npm run setup            # Install all deps
./start-dev.sh          # Unix start script
./stop-dev.sh           # Unix stop script
```