# Known Issues and Workarounds Reference - XP Project

## 🔴 Critical Issues (System Breaking)

### 1. WSL2 Database Connection Failure
**Symptoms**: 
- Error: "connect ECONNREFUSED 127.0.0.1:5432"
- Cannot connect to PostgreSQL from WSL2

**Root Cause**: 
PostgreSQL running on Windows host, not accessible from WSL2 default localhost

**Workaround**:
```bash
# Get Windows host IP
cat /etc/resolv.conf | grep nameserver
# Example output: nameserver 172.26.240.1

# Update backend/.env
DATABASE_HOST=172.26.240.1  # Use your actual IP

# Test connection
psql -h 172.26.240.1 -U postgres -c "SELECT 1"
# Password: @abcd1234
```

**Permanent Fix**: Docker-compose setup (not yet implemented)

---

### 2. Memory Leak in WebSocket Connections
**Symptoms**:
- Server memory usage grows continuously
- Server crashes after ~24 hours
- Error: "JavaScript heap out of memory"

**Root Cause**: 
WebSocket connections not properly cleaned up on disconnect

**Workaround**:
```javascript
// Memory monitor auto-restarts at threshold
// Check: backend/src/utils/memoryMonitor.ts

// Manual restart
pm2 restart backend
# OR
npm run dev # Ctrl+C then restart
```

**Monitor Memory**:
```bash
# Check current usage
ps aux | grep node
# Watch memory logs
tail -f backend/logs/memory-*.log
```

---

### 3. Session Not Invalidated on Logout
**Symptoms**:
- User can still use old JWT after logout
- Sessions remain active in database
- Security vulnerability

**Root Cause**: 
Logout only removes client-side token, doesn't invalidate server-side

**Workaround**:
```typescript
// Manually invalidate in database
UPDATE user_sessions 
SET is_active = false, 
    ended_at = NOW() 
WHERE user_id = ? AND token_hash = ?;
```

**Current Behavior**: Relies on 24h expiration

---

## 🟡 High Priority Issues

### 4. Frontend Port Conflicts
**Symptoms**:
- Error: "Port 3000 is already in use"
- Frontend won't start

**Root Cause**: 
Another process using port 3000

**Workaround**:
```bash
# Frontend auto-fallbacks to 3001
# Or manually specify:
PORT=3002 npm run dev

# Find what's using port 3000
lsof -i :3000  # Linux/Mac
netstat -ano | findstr :3000  # Windows
```

---

### 5. TypeScript Version Mismatch Errors
**Symptoms**:
- Type errors that shouldn't exist
- Different behavior in frontend vs backend
- Build failures

**Root Cause**: 
Frontend: TypeScript 5.2.2, Backend: TypeScript 5.9.2

**Workaround**:
```bash
# Use skip-lib-check
// tsconfig.json
{
  "compilerOptions": {
    "skipLibCheck": true
  }
}

# Or ignore specific errors
// @ts-ignore
// @ts-expect-error
```

---

### 6. File Upload Size Limits
**Symptoms**:
- Large file uploads fail
- Error: "PayloadTooLargeError"

**Root Cause**: 
Express body-parser limit set to 10MB

**Workaround**:
```typescript
// For specific routes, increase limit
router.post('/upload', 
  express.json({ limit: '50mb' }),
  uploadHandler
);

// Or use streaming for large files
// Use multer's streaming API
```

---

### 7. CORS Errors in Development
**Symptoms**:
- "CORS policy" errors in browser
- API calls blocked
- Works in Postman but not browser

**Root Cause**: 
Frontend/backend on different ports

**Workaround**:
```javascript
// Already configured but if issues:
// backend/src/app.ts - add your IP
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://YOUR_IP:3000',  // Add your IP
];
```

---

## 🟢 Medium Priority Issues

### 8. Email Sending Failures
**Symptoms**:
- Registration emails not sent
- Password reset not working
- No error in logs

**Root Cause**: 
Email service not configured

**Workaround**:
```bash
# backend/.env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=app-specific-password

# For testing, use console logging
EMAIL_ENABLED=false  # Logs to console instead
```

---

### 9. Form Builder Drag-Drop Mobile Issues
**Symptoms**:
- Can't drag fields on mobile
- Touch events not working
- UI unresponsive

**Root Cause**: 
@dnd-kit touch support issues

**Workaround**:
```typescript
// Add touch-action CSS
.draggable {
  touch-action: none;
}

// Or disable on mobile
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
if (isMobile) {
  // Use alternative UI
}
```

---

### 10. GPS Battery Drain
**Symptoms**:
- Mobile battery drains quickly
- Device gets hot
- GPS stops working

**Root Cause**: 
High accuracy mode + frequent updates

**Workaround**:
```typescript
// Reduce accuracy and frequency
const options = {
  enableHighAccuracy: false,  // Lower accuracy
  timeout: 10000,
  maximumAge: 30000  // Cache position for 30s
};

// Update interval
tracking_interval: 60000  // 1 minute instead of 5 seconds
```

---

### 11. Activity Logs Growing Too Large
**Symptoms**:
- Database size increasing rapidly
- Queries becoming slow
- Disk space issues

**Root Cause**: 
Logging every request, no cleanup

**Workaround**:
```sql
-- Manual cleanup old logs
DELETE FROM user_activity_logs 
WHERE created_at < NOW() - INTERVAL '30 days';

-- Check table size
SELECT pg_size_pretty(pg_total_relation_size('user_activity_logs'));

-- Disable non-critical logging
ACTIVITY_LOGGING_ENABLED=false
```

---

### 12. Concurrent Form Editing Conflicts
**Symptoms**:
- Changes lost when multiple users edit
- "Last write wins" behavior
- No conflict warnings

**Root Cause**: 
No proper conflict resolution

**Workaround**:
```typescript
// Lock form for single editor
// Or implement manual merge
// Currently: Save frequently, communicate with team
```

---

## 🔵 Low Priority Issues

### 13. No Refresh Token Mechanism
**Symptoms**:
- Users logged out after 24h
- Need to re-login daily

**Root Cause**: 
JWT expires, no refresh token

**Workaround**:
```javascript
// Extend JWT expiration (security risk)
JWT_EXPIRES_IN=7d  // Instead of 24h

// Or implement remember me
// Store refresh token separately
```

---

### 14. Console.log Statements in Production
**Symptoms**:
- Console cluttered with debug info
- Sensitive data potentially exposed

**Root Cause**: 
Debug code not removed

**Workaround**:
```javascript
// Override console.log in production
if (process.env.NODE_ENV === 'production') {
  console.log = () => {};
}

// Or use proper logger with levels
logger.debug() // Instead of console.log
```

---

### 15. No API Rate Limiting on All Endpoints
**Symptoms**:
- API can be abused
- No DDoS protection

**Root Cause**: 
Rate limiting only on auth endpoints

**Workaround**:
```typescript
// Add global rate limit
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests
});

app.use('/api/', limiter);
```

---

## 🛠️ Development Environment Issues

### 16. npm install Failures
**Symptoms**:
- Dependency installation fails
- Version conflicts

**Workaround**:
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

# Or use legacy peer deps
npm install --legacy-peer-deps
```

---

### 17. Hot Reload Not Working
**Symptoms**:
- Changes not reflected
- Need manual restart

**Workaround**:
```bash
# Check nodemon is running
ps aux | grep nodemon

# For frontend, check Vite HMR
# May need to disable firewall

# Nuclear option - restart everything
npm run dev
```

---

### 18. Database Migration Order Issues
**Symptoms**:
- Migrations fail
- Foreign key constraints violated

**Root Cause**: 
Migrations not idempotent

**Workaround**:
```sql
-- Always use IF NOT EXISTS
CREATE TABLE IF NOT EXISTS ...

-- Check before adding constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_name') THEN
    ALTER TABLE ... ADD CONSTRAINT ...;
  END IF;
END $$;
```

---

## 🔍 Debugging Helpers

### Check System Status
```bash
# Overall health
curl http://localhost:5000/health

# Database connection
cd backend && npm run db:test

# Check all services
ps aux | grep -E "node|npm"

# Memory usage
free -h

# Disk space
df -h

# Port usage
netstat -tulpn | grep LISTEN
```

### Common Log Locations
```bash
backend/logs/app-*.log      # Application logs
backend/logs/error-*.log    # Error logs
backend/logs/memory-*.log   # Memory monitor
backend/server.log          # Server startup
frontend/                   # Check browser console
```

### Emergency Reset
```bash
# Full reset procedure
cd /mnt/c/Users/Admin/source/repos/XP

# 1. Stop everything
pkill -f node

# 2. Clean everything
rm -rf backend/node_modules backend/dist backend/logs/*
rm -rf frontend/node_modules frontend/dist
rm -rf e2e/node_modules

# 3. Reinstall
npm run setup

# 4. Reset database
psql -h 172.26.240.1 -U postgres -c "DROP DATABASE IF EXISTS postgres"
psql -h 172.26.240.1 -U postgres -c "CREATE DATABASE postgres"
cd backend && npm run migrate

# 5. Start fresh
cd .. && npm run dev
```

## 📊 Issue Priority Matrix

| Issue | Frequency | Impact | Difficulty to Fix |
|-------|-----------|--------|-------------------|
| WSL2 DB Connection | Daily | High | Medium |
| Memory Leaks | Weekly | High | High |
| Session Issues | Daily | High | Medium |
| Port Conflicts | Daily | Low | Low |
| TypeScript Mismatch | Often | Medium | Medium |
| CORS Errors | Often | Medium | Low |
| Email Failures | Sometimes | Medium | Low |
| GPS Battery | Sometimes | Medium | Medium |
| Form Conflicts | Rare | High | High |
| Console Logs | Always | Low | Low |

## 🔮 Upcoming Fixes (Planned)

1. **Q1 2025**: Implement proper session management
2. **Q1 2025**: Fix WebSocket memory leaks  
3. **Q2 2025**: Add refresh token mechanism
4. **Q2 2025**: Implement conflict resolution for forms
5. **Q3 2025**: Migrate to TypeORM properly
6. **Q3 2025**: Add comprehensive testing
7. **Q4 2025**: Performance optimization
8. **Q4 2025**: Security audit and fixes

## 💡 General Workaround Strategy

1. **Check existing documentation** - 40+ .md files might have solutions
2. **Look for TODO/FIXME** comments in code
3. **Check GitHub issues** (if repo is on GitHub)
4. **Try the nuclear option** - Full reset often works
5. **Use environment variables** - Many behaviors configurable
6. **Disable problematic features** - Via feature flags
7. **Monitor and restart** - Automated monitoring helps
8. **Document new issues** - Add to this file!