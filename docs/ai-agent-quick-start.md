# AI Agent Quick Start Guide - XP Project

## 🚀 Immediate Setup Steps

### 1. Environment Check
```bash
# Verify you're in the project root
pwd  # Should show: /mnt/c/Users/Admin/source/repos/XP

# Check Node version
node --version  # Must be >= 18.0.0

# Check if PostgreSQL is accessible
psql -h 172.26.240.1 -U postgres -c "SELECT version();"
# Password: @abcd1234
```

### 2. Quick Install & Run
```bash
# Install all dependencies (if not done)
npm run setup

# Start both frontend and backend
npm run dev

# Access points:
# Frontend: http://localhost:3000 or http://localhost:3001
# Backend API: http://localhost:5000
# Health Check: http://localhost:5000/health
```

## ⚠️ Critical Things to Know

### Database Connection (WSL2 Specific)
- **Issue**: Running in WSL2, PostgreSQL is on Windows host
- **Solution**: The app auto-detects Windows host IP from `/etc/resolv.conf`
- **Fallback**: If auto-detection fails, manually set `DATABASE_HOST` in backend/.env

### Hardcoded Credentials (DO NOT CHANGE)
```bash
DATABASE_PASSWORD=@abcd1234  # Used throughout migrations and scripts
DATABASE_USER=postgres
DATABASE_NAME=postgres
```

### Mixed Code Patterns
- **TypeScript AND JavaScript**: `minimalActivityLogger.js` is intentionally JavaScript
- **Different async patterns**: Some services use classes, others use exported functions
- **Raw SQL**: Despite TypeORM config, we use raw SQL with pg library

## 📂 Where to Find Things

### Authentication & Users
- **Backend Logic**: `backend/src/services/authService.ts`
- **Frontend Context**: `frontend/src/contexts/AuthContext.tsx`
- **Database Schema**: `backend/migrations/001_create_users_table.sql`
- **API Routes**: `backend/src/routes/authRoutes.ts`

### Dynamic Form Builder
- **Backend Module**: `backend/src/modules/dynamicFormBuilder/`
- **Frontend Components**: `frontend/src/components/formBuilder/`
- **WebSocket Service**: `backend/src/modules/dynamicFormBuilder/services/WebSocketService.ts`
- **Database Schema**: `backend/migrations/015_create_dynamic_forms_tables.sql`

### GPS Tracking
- **Backend Module**: `backend/src/modules/gpsModule/`
- **Frontend Hook**: `frontend/src/hooks/useLocation.ts`
- **Database Schema**: `backend/migrations/010_create_user_locations_table.sql`

### User Activity Logging
- **Service**: `backend/src/services/minimalActivityLogger.js` (JavaScript!)
- **Middleware**: Applied globally in `backend/src/app.ts`
- **Database Schema**: `backend/migrations/006_create_user_activity_logs.sql`

## 🔧 Common Tasks

### Add a New API Endpoint
1. Create route in `backend/src/routes/`
2. Add controller in `backend/src/controllers/`
3. Register route in `backend/src/app.ts`
4. Update `API_DOCUMENTATION_COMPLETE.md`

### Add a New Database Table
1. Create migration file in `backend/migrations/` (increment number)
2. Run: `cd backend && npm run migrate`
3. Update relevant model in `backend/src/models/`

### Add a Frontend Page
1. Create page component in `frontend/src/pages/`
2. Add route in `frontend/src/App.tsx`
3. Create any needed API service in `frontend/src/services/`
4. Add to navigation if needed

### Fix TypeScript Errors
```bash
# Check backend
cd backend && npm run type-check

# Check frontend  
cd frontend && npm run type-check

# Common fixes:
# - Version mismatch: Backend uses TS 5.9.2, Frontend uses 5.2.2
# - Missing types: Install @types/[package-name]
```

## 🐛 Debugging Tips

### Check Logs
```bash
# Backend logs
tail -f backend/logs/app-*.log

# Frontend console
# Open browser DevTools

# Database queries
# Set NODE_ENV=development for query logging
```

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Cannot connect to database" | Check WSL2 IP detection, verify PostgreSQL is running on Windows |
| "Port 3000 already in use" | Frontend auto-fallbacks to 3001 |
| "JWT_SECRET not defined" | Set in backend/.env file |
| "WebSocket connection failed" | Ensure server.ts properly initializes Socket.IO |
| "Memory leak detected" | Check `backend/src/utils/memoryMonitor.ts` logs |
| "Session expired" | Normal behavior, sessions cleaned up after 24h |

### Test User Credentials
```javascript
// From the codebase
email: "cuongtranhung@gmail.com"
// Password hash in DB, needs to be set via script
```

## 🚫 What NOT to Do

1. **DON'T** change the database password from `@abcd1234`
2. **DON'T** convert `minimalActivityLogger.js` to TypeScript
3. **DON'T** remove WSL2-specific code
4. **DON'T** upgrade TypeScript versions without testing
5. **DON'T** use TypeORM entities (we use raw SQL)
6. **DON'T** remove "legacy" code without checking dependencies
7. **DON'T** change port configurations without updating CORS

## 📊 Performance Considerations

- **Memory Monitor**: Automatically restarts if memory exceeds threshold
- **Connection Pool**: Limited to 10 connections (hardcoded)
- **Rate Limiting**: Applied on auth endpoints
- **Compression**: Enabled for responses > 1KB
- **Session Cleanup**: Runs periodically to remove expired sessions

## 🔗 Quick Links

- [Main Architecture Document](./brownfield-architecture.md)
- [API Documentation](../API_DOCUMENTATION_COMPLETE.md)
- [Project Structure](../PROJECT_STRUCTURE.md)
- [Development Guidelines - Do NOT](../DEVELOPMENT_GUIDELINES_DO_NOT.md)

## 💡 Pro Tips

1. **Always run migrations** after pulling changes
2. **Check multiple .md files** - documentation is scattered
3. **Test in WSL2** - production runs on Windows with WSL2
4. **Use existing patterns** - even if they seem suboptimal
5. **Manual test critical flows** - limited automated test coverage
6. **Check memory usage** - known to have leaks without monitoring
7. **Preserve workarounds** - they exist for good reasons