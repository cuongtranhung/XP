# 📚 XP Project Reference Guide

**Version**: 1.0  
**Created**: 2025-08-05  
**Project**: XP - Fullstack Authentication System  
**Purpose**: Comprehensive reference for development, implementation, and feature building

---

## 📋 **Table of Contents**

1. [🏗️ Project Overview](#-project-overview)
2. [⚡ Quick Start](#-quick-start)
3. [🏛️ Architecture Reference](#-architecture-reference)
4. [🔧 Development Guidelines](#-development-guidelines)
5. [🧩 Module References](#-module-references)
6. [📡 API Reference](#-api-reference)
7. [🗃️ Database Schema](#-database-schema)
8. [🎨 Frontend Components](#-frontend-components)
9. [🚀 Build & Deploy](#-build--deploy)
10. [🔍 Testing Reference](#-testing-reference)
11. [📊 Performance & Monitoring](#-performance--monitoring)
12. [🛡️ Security Reference](#-security-reference)
13. [🎯 Common Tasks](#-common-tasks)
14. [📖 Documentation Index](#-documentation-index)

---

## 🏗️ **Project Overview**

### 📊 **Project Statistics**
- **Type**: Fullstack Authentication System
- **Architecture**: Monorepo with workspaces
- **Backend**: Node.js + TypeScript + Express + PostgreSQL
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Testing**: Jest (unit) + Playwright (E2E)
- **Database**: PostgreSQL with migrations
- **Deployment**: Docker + Docker Compose

### 🌟 **Key Features**
- ✅ JWT-based authentication
- ✅ Email verification system
- ✅ Password reset functionality
- ✅ User profile management (avatar, date of birth)
- ✅ Activity logging system (UAL)
- ✅ Rate limiting & security middleware
- ✅ Responsive design
- ✅ Real-time admin controls

### 📁 **Project Structure**
```
XP/
├── backend/           # Node.js API server
├── frontend/          # React SPA
├── e2e/              # Playwright tests
├── docker-compose.yml # Development environment
├── package.json      # Workspace configuration
└── documentation/    # All project docs
```

---

## ⚡ **Quick Start**

### 🚀 **Development Setup**
```bash
# 1. Install dependencies
npm run setup

# 2. Start development servers
npm run dev:backend    # Port 5000
npm run dev:frontend   # Port 3000

# 3. Run tests
npm run test:backend
npm run test:frontend
npm run test:e2e
```

### 🔧 **Environment Variables**
```bash
# Backend (.env)
JWT_SECRET=your-strong-secret-key-here
DATABASE_URL=postgresql://user:pass@localhost:5432/xp_db
FRONTEND_URL=http://localhost:3000
ACTIVITY_LOGGING_ENABLED=true

# Frontend (.env)
VITE_API_URL=http://localhost:5000
```

### 🎯 **Port Configuration**
- **Frontend**: `3000` (NEVER change - see DG rules)
- **Backend**: `5000` (NEVER change - see DG rules)
- **Database**: `5432`
- **E2E Tests**: `3001` (alternative frontend port)

---

## 🏛️ **Architecture Reference**

### 🧩 **System Architecture**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React SPA     │───▶│   Express API   │───▶│   PostgreSQL    │
│   (Frontend)    │    │   (Backend)     │    │   (Database)    │
│   Port: 3000    │    │   Port: 5000    │    │   Port: 5432    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Tailwind CSS  │    │   JWT + bcrypt  │    │   Migrations    │
│   Components    │    │   Rate Limiting │    │   Partitioning  │
│   React Router  │    │   Activity Log  │    │   Indexing      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 🔄 **Request Flow**
1. **Frontend**: React Router → API Service → Axios
2. **Backend**: Express → Middleware → Controller → Service → Model → Database
3. **Response**: Database → Model → Service → Controller → Frontend

### 📦 **Module Organization**

#### **Backend Modules**:
- **Controllers**: Handle HTTP requests and responses
- **Services**: Business logic and external integrations
- **Models**: Database interaction and data validation
- **Middleware**: Authentication, logging, rate limiting
- **Routes**: API endpoint definitions
- **Utils**: Shared utilities and helpers

#### **Frontend Modules**:
- **Components**: Reusable UI components
- **Pages**: Route-specific page components
- **Services**: API calls and external services
- **Contexts**: React Context for state management
- **Utils**: Client-side utilities and helpers
- **Types**: TypeScript type definitions

---

## 🔧 **Development Guidelines**

### 📋 **Critical Rules (DO NOT VIOLATE)**
Refer to `DEVELOPMENT_GUIDELINES_DO_NOT.md` for complete list:

#### 🚨 **NEVER DO**:
- Change frontend port from 3000
- Change backend port from 5000
- Auto-change passwords for User ID 2, 18
- Use console.log in production code
- Hardcode JWT secrets
- Mix require() with ES6 imports

#### ✅ **ALWAYS DO**:
- Use parameterized SQL queries
- Validate all user inputs
- Use proper error handling with try-catch
- Follow existing code patterns
- Add TypeScript types for new code
- Test in development before production

### 🎯 **Code Quality Standards**
- **TypeScript**: Strict mode enabled
- **ESLint**: Configured for React and Node.js
- **Prettier**: Code formatting
- **Testing**: >80% coverage target
- **Security**: OWASP compliance

---

## 🧩 **Module References**

### 🔐 **Authentication Module**

#### **Files**:
- `backend/src/services/authService.ts` - JWT and password handling
- `backend/src/controllers/authController.ts` - Auth endpoints
- `backend/src/middleware/auth.ts` - Authentication middleware
- `frontend/src/contexts/AuthContext.tsx` - Auth state management

#### **Key Functions**:
```typescript
// Backend
AuthService.register(userData)
AuthService.login(credentials)
AuthService.verifyToken(token)

// Frontend
const { user, login, logout, isAuthenticated } = useAuth();
```

#### **Protected Routes**:
```typescript
<ProtectedRoute>
  <DashboardPage />
</ProtectedRoute>
```

### 👤 **User Profile Module**

#### **Database Fields**:
- `id`, `email`, `password_hash`, `full_name`
- `email_verified`, `avatar_url`, `date_of_birth`
- `created_at`, `updated_at`, `last_login`

#### **Profile Field Addition Process**:
Refer to `DEVELOPMENT_GUIDELINES_DO_NOT.md` section "User Profile Field Addition Process"

**7-Step Process**:
1. Database Migration
2. Backend Model Updates
3. Service Layer Updates
4. API Endpoint Updates
5. Frontend Type Updates
6. Frontend Component Creation
7. Validation & Testing

### 📊 **User Activity Logging (UAL) Module**

Refer to `USER_ACTIVITY_LOGGING_REVIEW.md` and `UAL_ACTIONS_LIST.md`

#### **Current Active Actions**:
- `LOGIN` - Auto-logged on successful login
- `LOGOUT` - Auto-logged on logout
- `FAILED_LOGIN` - Auto-logged on auth failure
- `CHANGE_PASSWORD` - Auto-logged on password change

#### **Toggle Control**:
```typescript
// Backend
MinimalActivityLogger.setEnabled(false); // Disable
MinimalActivityLogger.setEnabled(true);  // Enable

// API
POST /api/activity-control/toggle { "enabled": false }
GET /api/activity-control/status
```

#### **Performance Impact**:
- **Disabled**: < 0.001ms per request
- **Enabled**: Async processing, non-blocking

---

## 📡 **API Reference**

### 🔐 **Authentication Endpoints**

#### **POST /api/auth/register**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "Full Name"
}
```

#### **POST /api/auth/login**
```json
{
  "email": "user@example.com", 
  "password": "SecurePass123!"
}
```

#### **POST /api/auth/logout**
Headers: `Authorization: Bearer <token>`

#### **GET /api/auth/profile**
Headers: `Authorization: Bearer <token>`

### 🏥 **Health Check Endpoints**

#### **GET /health**
Basic health check

#### **GET /health/database**
Database connection status

### 📊 **Activity Logging Endpoints**

#### **GET /api/activity-control/status** (Admin Only)
Returns UAL module status

#### **POST /api/activity-control/toggle** (Admin Only)
Enable/disable UAL module

#### **GET /api/activity** (Admin Only)
Retrieve activity logs with filtering

---

## 🗃️ **Database Schema**

### 👥 **Users Table**
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    avatar_url VARCHAR(500),
    date_of_birth DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 📊 **User Activity Logs Table**
```sql
CREATE TABLE user_activity_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(128),
    action_type VARCHAR(50) NOT NULL,
    action_category VARCHAR(30) NOT NULL,
    endpoint VARCHAR(255),
    method VARCHAR(10),
    response_status INTEGER,
    ip_address INET,
    user_agent TEXT,
    processing_time_ms INTEGER,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 🔑 **Password Reset Tokens Table**
```sql
CREATE TABLE password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 🗃️ **Database Migrations**
```bash
# Run migrations
npm run db:migrate

# Create new migration
# Manually create: migrations/XXX_description.sql
```

---

## 🎨 **Frontend Components**

### 🧩 **Component Structure**
```
src/components/
├── auth/              # Authentication components
│   ├── LoginForm.tsx
│   ├── RegisterForm.tsx
│   ├── ForgotPasswordForm.tsx
│   └── ProtectedRoute.tsx
├── common/            # Reusable UI components
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Alert.tsx
│   ├── LoadingSpinner.tsx
│   ├── Avatar.tsx
│   └── AvatarUpload.tsx
├── activity/          # Activity logging components
│   ├── ActivityLogViewer.tsx
│   └── ActivityControl.tsx
└── layout/            # Layout components
    ├── AppLayout.tsx
    └── AuthLayout.tsx
```

### 🎯 **Key Components Usage**

#### **Button Component**:
```tsx
<Button 
  variant="primary" 
  size="lg" 
  loading={isLoading}
  onClick={handleClick}
>
  Submit
</Button>
```

#### **Input Component**:
```tsx
<Input
  type="email"
  label="Email Address"
  error={errors.email}
  {...register('email')}
/>
```

#### **Alert Component**:
```tsx
<Alert type="error" message="Something went wrong" />
<Alert type="success" message="Operation successful" />
```

### 🎨 **Styling System**
- **Framework**: Tailwind CSS
- **Components**: Consistent design system
- **Responsive**: Mobile-first approach
- **Colors**: Defined color palette
- **Typography**: Consistent font scales

---

## 🚀 **Build & Deploy**

### 🏗️ **Build Commands**
```bash
# Development
npm run dev:frontend   # Start dev server
npm run dev:backend    # Start API server

# Production builds
npm run build:frontend # Build React app
npm run build:backend  # Compile TypeScript

# Full build
npm run build         # Build both frontend and backend
```

### 🐳 **Docker Deployment**
```bash
# Development
docker-compose up -d

# Production
docker-compose -f docker-compose.prod.yml up -d
```

### 📦 **Environment Configuration**

#### **Development**:
- Frontend: Vite dev server on port 3000
- Backend: Nodemon with TypeScript on port 5000
- Database: PostgreSQL container on port 5432

#### **Production**:
- Frontend: Static files served by Nginx
- Backend: Compiled JavaScript with PM2
- Database: PostgreSQL with connection pooling

---

## 🔍 **Testing Reference**

### 🧪 **Test Structure**
```
backend/src/__tests__/
├── integration/       # Integration tests
│   └── auth.integration.test.ts
└── services/         # Unit tests
    └── authService.test.ts

frontend/src/__tests__/
├── contexts/         # Context tests
│   └── AuthContext.test.tsx
└── pages/           # Page tests
    └── Login.test.tsx

e2e/tests/           # End-to-end tests
├── auth.spec.ts
├── login.spec.ts
└── signup.spec.ts
```

### 🎯 **Test Commands**
```bash
# Unit tests
npm run test:backend
npm run test:frontend

# E2E tests
npm run test:e2e

# Coverage
npm run test:coverage
```

### 📊 **Test Credentials**
Use `.env.test` file with test credentials:
```bash
TEST_EMAIL=cuongtrahung@gmail.com
TEST_PASSWORD=@Abcd6789
```

---

## 📊 **Performance & Monitoring**

### ⚡ **Performance Targets**
- **Frontend Load Time**: < 3s on 3G
- **API Response Time**: < 200ms average
- **Database Queries**: < 100ms average
- **Bundle Size**: < 500KB initial

### 📈 **Monitoring Points**
- JWT token validation performance
- Database connection pool status
- Activity logging overhead
- Memory usage patterns
- Error rates by endpoint

### 🔧 **Performance Tools**
- **Frontend**: Vite build analyzer
- **Backend**: Request timing middleware
- **Database**: Query performance logs
- **E2E**: Playwright performance metrics

---

## 🛡️ **Security Reference**

### 🔒 **Security Measures Implemented**
- JWT token authentication
- bcrypt password hashing (12 rounds)
- Rate limiting on all endpoints
- CORS configuration
- Helmet security headers
- SQL injection prevention
- Input validation and sanitization

### 🚨 **Security Vulnerabilities Fixed**
Refer to `IMPROVEMENT_SUMMARY.md`:
- ✅ JWT secret vulnerability eliminated
- ✅ Information disclosure via console.log removed
- ✅ Structured logging without data exposure

### 🔐 **Security Checklist**
Before any deployment:
- [ ] JWT_SECRET environment variable set
- [ ] No console.log statements in production
- [ ] All user inputs validated
- [ ] SQL queries parameterized
- [ ] Rate limiting active
- [ ] HTTPS enabled in production

---

## 🎯 **Common Tasks**

### 🆕 **Adding a New User Profile Field**

1. **Create Migration**:
```sql
-- migrations/XXX_add_field_to_users.sql
ALTER TABLE users ADD COLUMN new_field VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_users_new_field ON users(new_field);
```

2. **Update Backend Model**:
```typescript
// src/models/User.ts
interface User {
  // ... existing fields
  new_field?: string;
}
```

3. **Update Frontend Types**:
```typescript
// src/types/auth.ts
export interface User {
  // ... existing fields
  new_field?: string;
}
```

4. **Add UI Components**:
```tsx
// Update SettingsPage.tsx or relevant component
<Input
  label="New Field"
  {...register('new_field')}
/>
```

### 🔐 **Adding a New Authentication Method**

1. **Backend Service**:
```typescript
// src/services/authService.ts
static async newAuthMethod(credentials) {
  // Implementation
  MinimalActivityLogger.logLogin(userId, sessionId, req);
}
```

2. **Controller Endpoint**:
```typescript
// src/controllers/authController.ts
export const newAuthEndpoint = async (req, res) => {
  // Implementation
};
```

3. **Frontend Integration**:
```typescript
// src/services/api.ts
export const newAuthMethod = (credentials) => {
  return axios.post('/api/auth/new-method', credentials);
};
```

### 📊 **Adding a New UAL Action Type**

1. **Update Database Constraint**:
```sql
ALTER TABLE user_activity_logs DROP CONSTRAINT chk_action_type;
ALTER TABLE user_activity_logs ADD CONSTRAINT chk_action_type 
CHECK (action_type IN (..., 'NEW_ACTION'));
```

2. **Add Logging Method**:
```javascript
// src/services/minimalActivityLogger.js
static logNewAction(userId, sessionId, req, metadata) {
  this.logAsync({
    userId: parseInt(userId),
    sessionId,
    actionType: 'NEW_ACTION',
    actionCategory: 'APPROPRIATE_CATEGORY',
    // ... other fields
  });
}
```

3. **Update Types**:
```typescript
// src/types/activityLog.ts
export enum ActionType {
  // ... existing types
  NEW_ACTION = 'NEW_ACTION'
}
```

### 🧪 **Adding a New Test**

1. **Unit Test**:
```typescript
// src/__tests__/services/newService.test.ts
describe('NewService', () => {
  test('should do something', async () => {
    // Test implementation
  });
});
```

2. **E2E Test**:
```typescript
// e2e/tests/new-feature.spec.ts
test('should test new feature', async ({ page }) => {
  // Test implementation
});
```

---

## 📖 **Documentation Index**

### 📚 **Core Documentation**
- `README.md` - Project overview and setup
- `PROJECT_REFERENCE.md` - This comprehensive reference (you are here)
- `DEVELOPMENT_GUIDELINES_DO_NOT.md` - Critical development rules

### 🔍 **Analysis & Reports**
- `COMPREHENSIVE_ANALYSIS_REPORT.md` - Complete security and quality analysis
- `IMPROVEMENT_SUMMARY.md` - Recent improvements and fixes applied

### 🧩 **Module Documentation**
- `USER_ACTIVITY_LOGGING_REVIEW.md` - UAL module technical review
- `UAL_ACTIONS_LIST.md` - Complete list of logged actions
- `PROJECT_STRUCTURE.md` - Detailed project structure

### 🔧 **Configuration Files**
- `.env.test.example` - Environment variables template
- `package.json` - Workspace and script configuration
- `docker-compose.yml` - Development environment setup

### 🏗️ **Architecture Documentation**
- `API_DOCUMENTATION.md` - API endpoints reference
- `DATABASE_SETUP.md` - Database configuration guide
- `DEPLOYMENT_GUIDE.md` - Production deployment instructions

### 🧪 **Testing Documentation**
- `TEST_REPORT.md` - Testing results and coverage
- `MANUAL_TEST_GUIDE.md` - Manual testing procedures

---

## 🎯 **Quick Reference Cards**

### 🚀 **Startup Commands**
```bash
# Complete setup
npm run setup && npm run dev:backend & npm run dev:frontend

# Individual services
npm run dev:backend    # API server
npm run dev:frontend   # React app
npm run test:e2e      # End-to-end tests
```

### 🔧 **Development Tools**
```bash
npm run lint          # Code linting
npm run format        # Code formatting
npm run type-check    # TypeScript checking
npm run build         # Production build
```

### 🗃️ **Database Commands**
```bash
npm run db:migrate    # Run migrations
npm run db:setup      # Setup database
npm run db:test       # Test connection
```

### 🎯 **Port References**
- **Frontend**: `3000` (Never change)
- **Backend**: `5000` (Never change)
- **Database**: `5432`
- **E2E Tests**: `3001`

### 🔐 **Admin Access**
- **Activity Control**: User ID `2`
- **Protected Users**: ID `2`, `18` (no auto password changes)

---

## 📞 **Getting Help**

### 🆘 **When You Need Help**
1. **Check this reference first** - Most answers are here
2. **Review Development Guidelines** - For rules and restrictions
3. **Check module documentation** - For specific implementations
4. **Run tests** - To verify changes work correctly

### 🔍 **Debugging Steps**
1. Check environment variables are set
2. Verify ports 3000 and 5000 are available
3. Ensure database is running and accessible
4. Check logs for specific error messages
5. Verify JWT_SECRET is properly configured

### 📋 **Before Making Changes**
1. Read relevant documentation sections
2. Check Development Guidelines for restrictions
3. Review existing patterns in codebase
4. Plan changes following established processes
5. Test thoroughly in development environment

---

**Last Updated**: 2025-08-05  
**Status**: ✅ **Complete Reference - Ready for Development**

*This reference should be your first stop for any development questions. Keep it updated as the project evolves!*