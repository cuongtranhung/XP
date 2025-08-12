# XP Fullstack Authentication System - Brownfield Architecture Document

## Introduction

This document captures the CURRENT STATE of the XP Fullstack Authentication System codebase, including technical debt, workarounds, and real-world patterns. It serves as a reference for AI agents working on enhancements.

### Document Scope

Comprehensive documentation of entire system including authentication, form builder, and GPS tracking modules.

### Change Log

| Date       | Version | Description                 | Author    |
| ---------- | ------- | --------------------------- | --------- |
| 2025-01-07 | 1.0     | Initial brownfield analysis | AI Agent  |

## Quick Reference - Key Files and Entry Points

### Critical Files for Understanding the System

- **Main Entry**: `backend/src/server.ts` - HTTP server initialization with WebSocket support
- **App Configuration**: `backend/src/app.ts` - Express app setup with middleware and routes
- **Frontend Entry**: `frontend/src/main.tsx` - React application entry point
- **Database Config**: `backend/src/config/database.config.ts` - TypeORM configuration with WSL2 support
- **Auth Context**: `frontend/src/contexts/AuthContext.tsx` - Frontend authentication state management
- **API Service**: `frontend/src/services/api.ts` - Axios-based API client configuration

### Core Business Logic

- **Authentication**: `backend/src/services/authService.ts` - JWT-based auth with email verification
- **Session Management**: `backend/src/services/sessionService.ts` - User session tracking
- **Form Builder**: `backend/src/modules/dynamicFormBuilder/` - Complete form building system
- **GPS Module**: `backend/src/modules/gpsModule/` - Location tracking functionality
- **Activity Logging**: `backend/src/services/minimalActivityLogger.js` - User activity tracking

## High Level Architecture

### Technical Summary

The system is a monorepo-based fullstack application with separate frontend and backend packages, deployed on Windows/WSL2 environment. It features JWT authentication, real-time capabilities via Socket.IO, and modular architecture with pluggable features.

### Actual Tech Stack (from package.json files)

| Category       | Technology     | Version      | Notes                                |
| -------------- | -------------- | ------------ | ------------------------------------ |
| Runtime        | Node.js        | >=18.0.0     | Required minimum version             |
| Backend        | Express        | 4.18.2       | With extensive middleware stack      |
| Frontend       | React          | 18.2.0       | With TypeScript and Vite            |
| Database       | PostgreSQL     | 13+          | With TypeORM and raw SQL migrations |
| Authentication | JWT            | 9.0.2        | Custom implementation with sessions |
| Real-time      | Socket.IO      | 4.6.2        | WebSocket support for forms/GPS     |
| Caching        | Redis/IORedis  | 5.7.0        | Optional, for Socket.IO adapter     |
| Build Tool     | Vite           | 7.1.0        | Fast HMR development                |
| CSS Framework  | Tailwind CSS   | 3.3.6        | Utility-first CSS                   |
| Testing        | Jest/Playwright| Various      | Unit and E2E testing                |
| TypeScript     | TypeScript     | 5.9.2/5.2.2  | Different versions front/back       |

### Repository Structure Reality Check

- Type: **Monorepo** with npm workspaces
- Package Manager: npm (>=9.0.0)
- Notable: Separate package.json for frontend, backend, and e2e testing
- WSL2 Specific: Special handling for Windows host IP detection

## Source Tree and Module Organization

### Project Structure (Actual)

```text
XP/
├── backend/                  # Express API server (Port 5000)
│   ├── src/
│   │   ├── app.ts           # Express app configuration (COMPLEX: mixed patterns)
│   │   ├── server.ts        # Server entry with WebSocket init
│   │   ├── controllers/     # HTTP request handlers (inconsistent async patterns)
│   │   ├── services/        # Business logic (MIXED: some use classes, some exports)
│   │   ├── models/          # Database models (NOT TypeORM entities, custom implementations)
│   │   ├── middleware/      # Express middleware (auth, validation, rate limiting)
│   │   ├── routes/          # API route definitions
│   │   ├── utils/           # Utilities (logger, database, validation)
│   │   ├── config/          # Configuration files
│   │   └── modules/         # Feature modules (Form Builder, GPS)
│   │       ├── dynamicFormBuilder/  # COMPLEX: Full WebSocket integration
│   │       └── gpsModule/           # Location tracking system
│   ├── migrations/          # SQL migration files (manual tracking, no proper tool)
│   ├── scripts/             # Database setup and migration scripts
│   └── dist/                # Compiled JavaScript output
│
├── frontend/                 # React SPA (Port 3000/3001)
│   ├── src/
│   │   ├── main.tsx        # App entry point
│   │   ├── App.tsx         # Root component with routing
│   │   ├── components/     # UI components (mixed patterns)
│   │   │   ├── auth/       # Authentication forms
│   │   │   ├── common/     # Reusable components
│   │   │   ├── formBuilder/# Form builder UI (COMPLEX: drag-drop)
│   │   │   └── layout/     # Layout components
│   │   ├── pages/          # Route pages
│   │   ├── contexts/       # React contexts (Auth, FormBuilder)
│   │   ├── services/       # API service layer
│   │   ├── hooks/          # Custom React hooks
│   │   └── types/          # TypeScript definitions
│   └── dist/               # Production build output
│
├── e2e/                     # Playwright E2E tests
│   └── tests/              # Test specifications
│
├── docs/                    # Documentation (MANY FILES - some outdated)
├── scripts/                 # Deployment scripts (Windows PowerShell)
└── docker/                  # Docker configurations
```

### Key Modules and Their Purpose

- **Authentication System**: `backend/src/services/authService.ts` - JWT-based with email verification, password reset
- **Session Management**: `backend/src/services/sessionService.ts` - Tracks user sessions with device info
- **User Activity Logging**: `backend/src/services/minimalActivityLogger.js` - CRITICAL: JavaScript file in TypeScript project
- **Dynamic Form Builder**: `backend/src/modules/dynamicFormBuilder/` - Complete form creation system with:
  - Real-time collaboration via WebSocket
  - File uploads with image processing
  - Webhook integration
  - Analytics and conflict resolution
- **GPS Module**: `backend/src/modules/gpsModule/` - Location tracking with session management
- **Cache Service**: `backend/src/services/cacheService.ts` - In-memory caching (NOT Redis by default)
- **Email Service**: `backend/src/services/emailService.ts` - Nodemailer integration

## Data Models and APIs

### Data Models

Database uses raw SQL migrations with pg library, NOT TypeORM entities despite configuration:

- **Users Table**: See `backend/migrations/001_create_users_table.sql`
- **Password Reset Tokens**: See `backend/migrations/002_create_password_reset_tokens_table.sql`
- **User Activity Logs**: See `backend/migrations/006_create_user_activity_logs.sql`
- **User Sessions**: See `backend/migrations/007_create_user_sessions.sql`
- **User Locations**: See `backend/migrations/010_create_user_locations_table.sql`
- **GPS Module Config**: See `backend/migrations/012_create_gps_module_config_table.sql`
- **Dynamic Forms Tables**: See `backend/migrations/015_create_dynamic_forms_tables.sql`

### API Specifications

- **API Documentation**: See `API_DOCUMENTATION_COMPLETE.md` for full REST API reference
- **Authentication Endpoints**: `/api/auth/*` - login, register, logout, password reset
- **Session Endpoints**: `/api/sessions/*` - session management
- **Activity Endpoints**: `/api/activity/*` - user activity tracking
- **GPS Endpoints**: `/api/gps-module/*` - location tracking
- **Form Builder Endpoints**: `/api/forms/*` - form CRUD, submissions, uploads
- **Health Check**: `/health` - system health monitoring

## Technical Debt and Known Issues

### Critical Technical Debt

1. **Mixed JavaScript/TypeScript**: `minimalActivityLogger.js` is JavaScript in a TypeScript project
2. **Database Migrations**: Manually tracked, no proper migration tool despite TypeORM config
3. **TypeScript Version Mismatch**: Frontend uses 5.2.2, Backend uses 5.9.2
4. **No TypeORM Usage**: TypeORM configured but not actually used, raw SQL everywhere
5. **Multiple Documentation Files**: Over 40 .md files, many outdated or redundant
6. **WSL2 Specific Code**: Database connection has WSL2-specific IP detection
7. **Mixed Async Patterns**: Some services use classes, others use exported functions
8. **No Proper Testing**: Test coverage minimal despite Jest/Playwright setup
9. **Hardcoded Credentials**: Database password visible in multiple files
10. **Console Logging**: Many debug console.log statements left in code

### Workarounds and Gotchas

- **WSL2 Database Connection**: Must detect Windows host IP dynamically via `/etc/resolv.conf`
- **Port Configuration**: Frontend runs on 3000 OR 3001, backend on 5000
- **Environment Variables**: Multiple .env files, some missing from repo
- **CORS Issues**: Extensive CORS configuration for WSL2 IP addresses
- **Activity Logging**: Can be disabled via `ACTIVITY_LOGGING_ENABLED=false`
- **WebSocket Initialization**: Must pass HTTP server to form builder module
- **Memory Monitoring**: Custom memory monitor to prevent leaks
- **Session Cleanup**: Background service required for expired sessions
- **Compression Middleware**: Added to reduce payload sizes
- **Multiple Start Scripts**: Various shell scripts for different environments

## Integration Points and External Dependencies

### External Services

| Service     | Purpose            | Integration Type | Key Files                                    |
| ----------- | ------------------ | ---------------- | -------------------------------------------- |
| PostgreSQL  | Primary database   | pg library       | `backend/src/utils/database.ts`             |
| Nodemailer  | Email sending      | SMTP             | `backend/src/services/emailService.ts`      |
| Socket.IO   | Real-time updates  | WebSocket        | `backend/src/modules/dynamicFormBuilder/`   |
| Redis       | Optional caching   | IORedis          | `backend/src/services/cacheService.ts`      |
| Sharp       | Image processing   | Native binding   | Form builder file uploads                   |

### Internal Integration Points

- **Frontend-Backend Communication**: REST API on port 5000, expects JWT in Authorization header
- **WebSocket Communication**: Socket.IO for real-time form collaboration
- **Background Jobs**: Session cleanup service, memory monitoring
- **File Uploads**: Multer middleware with Sharp for image processing
- **Activity Tracking**: Middleware intercepts all requests for logging

## Development and Deployment

### Local Development Setup

1. **Prerequisites**:
   - Node.js >= 18.0.0
   - PostgreSQL 13+ (can be on Windows host in WSL2)
   - npm >= 9.0.0

2. **Actual Steps That Work**:
   ```bash
   # Clone and install
   npm run setup  # Installs all workspace dependencies
   
   # Database setup (PostgreSQL must be running)
   cd backend
   npm run migrate  # Run SQL migrations
   
   # Start development
   cd ..
   npm run dev  # Starts both frontend and backend
   # OR separately:
   # Terminal 1: cd backend && npm run dev
   # Terminal 2: cd frontend && npm run dev
   ```

3. **Known Setup Issues**:
   - WSL2 users must ensure PostgreSQL is accessible from WSL
   - Database password hardcoded as '@abcd1234'
   - Frontend may conflict on port 3000, fallback to 3001
   - TypeScript version conflicts may cause compilation issues

### Build and Deployment Process

- **Build Commands**:
  ```bash
  npm run build:frontend  # Vite production build
  npm run build:backend   # TypeScript compilation
  ```
- **Deployment**: Windows-specific PowerShell scripts in `scripts/`
- **Docker**: Docker Compose configurations available but may not work with WSL2
- **Production Notes**: No proper CI/CD pipeline, manual deployment

## Testing Reality

### Current Test Coverage

- **Unit Tests**: Minimal coverage, some auth service tests
- **Integration Tests**: Basic auth flow tests
- **E2E Tests**: Comprehensive Playwright tests for login/registration
- **Manual Testing**: Primary QA method, see multiple test HTML files

### Running Tests

```bash
# Backend tests
cd backend
npm test           # Jest unit tests

# Frontend tests  
cd frontend
npm test           # Jest + React Testing Library

# E2E tests
cd e2e
npm test           # Playwright tests
```

## Performance and Monitoring

### Performance Characteristics

- **Memory Usage**: Custom monitor prevents leaks, restarts at threshold
- **Connection Pooling**: PostgreSQL pool size hardcoded to 10
- **Rate Limiting**: express-rate-limit on auth endpoints
- **Compression**: gzip compression on responses > 1KB
- **Caching**: In-memory cache service, no Redis by default

### Monitoring and Observability

- **Logging**: Winston logger with daily rotation
- **Health Checks**: `/health` endpoint for uptime monitoring
- **Activity Tracking**: Comprehensive user action logging to database
- **Memory Monitoring**: Custom memory usage tracking
- **Performance Monitoring**: Basic timing middleware

## Security Considerations

### Current Security Measures

- **Authentication**: JWT with 24h expiration
- **Password Hashing**: Bcrypt with 12 rounds
- **Rate Limiting**: On authentication endpoints
- **CORS**: Configured for specific origins
- **Helmet**: Security headers middleware
- **Input Validation**: express-validator on routes

### Security Concerns

- **Hardcoded Secrets**: Database password visible in code
- **No Secrets Management**: JWT secret from environment only
- **Session Management**: Custom implementation, not battle-tested
- **File Uploads**: Limited validation on uploaded files
- **SQL Injection**: Raw SQL queries without proper parameterization in places

## Module-Specific Documentation

### Dynamic Form Builder Module

**Location**: `backend/src/modules/dynamicFormBuilder/`

**Features**:
- Drag-and-drop form creation
- Real-time collaboration via WebSocket
- File uploads with image processing
- Webhook integration for submissions
- Analytics and reporting
- Conflict resolution for concurrent edits

**Technical Debt**:
- Complex WebSocket initialization
- No proper state management
- Mixed async patterns

### GPS Module

**Location**: `backend/src/modules/gpsModule/`

**Features**:
- Real-time location tracking
- Session-based tracking
- Privacy controls
- Location history

**Technical Debt**:
- Tightly coupled to user sessions
- No proper error handling for GPS failures

## Appendix - Useful Commands and Scripts

### Frequently Used Commands

```bash
# Development
npm run dev              # Start full stack development
npm run setup            # Install all dependencies

# Backend specific
cd backend
npm run dev             # Start backend only
npm run migrate         # Run database migrations
npm run build           # Compile TypeScript

# Frontend specific
cd frontend  
npm run dev             # Start frontend only
npm run build           # Production build

# Testing
npm run test:backend    # Backend tests
npm run test:frontend   # Frontend tests
npm run test:e2e        # E2E tests

# Database
node scripts/generate-schema-script.js  # Generate schema
```

### Debugging and Troubleshooting

- **Logs**: Check `backend/logs/` for application logs
- **Debug Mode**: Set `DEBUG=*` for verbose logging
- **Database Issues**: Check WSL2 IP configuration
- **Port Conflicts**: Frontend fallback from 3000 to 3001
- **Memory Issues**: Check memory monitor logs
- **WebSocket Issues**: Ensure server.ts properly initializes Socket.IO

### Environment Variables

Key environment variables (see `.env.example` files):

```bash
# Backend
DATABASE_HOST=         # Windows host IP for WSL2
DATABASE_PORT=5432
DATABASE_USER=postgres  
DATABASE_PASSWORD=@abcd1234
DATABASE_NAME=postgres
JWT_SECRET=            # Required for auth
PORT=5000

# Frontend
VITE_API_URL=http://localhost:5000
```

## Notes for AI Agents

1. **This is a brownfield project** - Respect existing patterns even if suboptimal
2. **WSL2 environment** - Special handling needed for database connections
3. **Mixed patterns** - Some TypeScript, some JavaScript; some classes, some functions
4. **Heavy technical debt** - Incremental improvements preferred over rewrites
5. **Multiple documentation files** - This document is the authoritative source
6. **Test carefully** - Limited test coverage means manual testing critical
7. **Preserve workarounds** - Many exist for good reasons (WSL2, memory, etc.)
8. **Check migrations** - Database schema in SQL files, not TypeORM entities