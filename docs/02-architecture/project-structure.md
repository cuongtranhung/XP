# 📁 Project Structure Documentation

**Version**: 2.0  
**Last Updated**: August 3, 2025  
**Framework**: Fullstack Authentication System

---

## 🏗️ Complete Directory Structure

```
XP/                                   # Root project directory
├── 📄 .eslintrc.js                  # Root-level ESLint configuration
├── 📄 README.md                     # Main project documentation
├── 📄 PROJECT_INDEX.md              # Legacy project index
├── 📄 PROJECT_INDEX_UPDATED.md      # Updated comprehensive index
├── 📄 API_DOCUMENTATION_COMPLETE.md # Complete REST API reference
├── 📄 PROJECT_STRUCTURE.md          # This file - project structure guide
├── 📄 docker-compose.yml            # Development Docker orchestration
├── 📄 docker-compose.prod.yml       # Production Docker orchestration
│
├── 📁 frontend/                      # React SPA Application (Port: 3000)
│   ├── 📄 package.json              # Frontend dependencies & scripts
│   ├── 📄 package-lock.json         # Dependency lock file
│   ├── 📄 vite.config.ts            # Vite build configuration
│   ├── 📄 tsconfig.json             # TypeScript configuration
│   ├── 📄 tsconfig.node.json        # Node-specific TypeScript config
│   ├── 📄 tailwind.config.js        # Tailwind CSS configuration
│   ├── 📄 postcss.config.js         # PostCSS configuration
│   ├── 📄 index.html                # Entry HTML template
│   ├── 📄 .env                      # Environment variables
│   ├── 📄 .env.example              # Environment template
│   │
│   ├── 📁 public/                   # Static assets
│   │   ├── 📄 vite.svg              # Vite logo
│   │   └── 📄 favicon.ico           # Site favicon
│   │
│   ├── 📁 src/                      # Source code directory
│   │   ├── 📄 main.tsx              # Application entry point
│   │   ├── 📄 App.tsx               # Root React component
│   │   ├── 📄 App.css               # Global application styles
│   │   ├── 📄 index.css             # Base CSS with Tailwind
│   │   ├── 📄 vite-env.d.ts         # Vite type definitions
│   │   │
│   │   ├── 📁 components/           # Reusable UI components
│   │   │   ├── 📁 auth/             # Authentication components
│   │   │   │   ├── 📄 LoginForm.tsx        # User login form
│   │   │   │   ├── 📄 RegisterForm.tsx     # User registration form
│   │   │   │   ├── 📄 ForgotPasswordForm.tsx # Password reset form
│   │   │   │   ├── 📄 ResetPasswordForm.tsx  # New password form
│   │   │   │   └── 📄 ProtectedRoute.tsx    # Route protection HOC
│   │   │   │
│   │   │   ├── 📁 common/           # Shared UI components
│   │   │   │   ├── 📄 Button.tsx           # Reusable button component
│   │   │   │   ├── 📄 Input.tsx            # Form input component
│   │   │   │   ├── 📄 Alert.tsx            # Alert/notification component
│   │   │   │   ├── 📄 Loading.tsx          # Loading spinner component
│   │   │   │   └── 📄 Modal.tsx            # Modal dialog component
│   │   │   │
│   │   │   └── 📁 layout/           # Layout components
│   │   │       ├── 📄 Header.tsx           # Site header navigation
│   │   │       ├── 📄 Footer.tsx           # Site footer
│   │   │       ├── 📄 Navigation.tsx       # Main navigation menu
│   │   │       └── 📄 Layout.tsx           # Main layout wrapper
│   │   │
│   │   ├── 📁 pages/                # Route page components
│   │   │   ├── 📄 HomePage.tsx             # Landing/home page
│   │   │   ├── 📄 LoginPage.tsx            # Login page container
│   │   │   ├── 📄 RegisterPage.tsx         # Registration page
│   │   │   ├── 📄 DashboardPage.tsx        # User dashboard
│   │   │   ├── 📄 ProfilePage.tsx          # User profile management
│   │   │   ├── 📄 ForgotPasswordPage.tsx   # Password reset request
│   │   │   ├── 📄 ResetPasswordPage.tsx    # Password reset form
│   │   │   └── 📄 NotFoundPage.tsx         # 404 error page
│   │   │
│   │   ├── 📁 contexts/             # React Context providers
│   │   │   ├── 📄 AuthContext.tsx          # Authentication state management
│   │   │   ├── 📄 ThemeContext.tsx         # Theme/dark mode context
│   │   │   └── 📄 NotificationContext.tsx  # App-wide notifications
│   │   │
│   │   ├── 📁 services/             # API service layer
│   │   │   ├── 📄 apiService.ts            # Base API configuration
│   │   │   ├── 📄 authService.ts           # Authentication API calls
│   │   │   ├── 📄 userService.ts           # User management API
│   │   │   └── 📄 healthService.ts         # Health check API
│   │   │
│   │   ├── 📁 hooks/                # Custom React hooks
│   │   │   ├── 📄 useAuth.ts               # Authentication hook
│   │   │   ├── 📄 useApi.ts                # API request hook
│   │   │   ├── 📄 useLocalStorage.ts       # Local storage hook
│   │   │   └── 📄 useDebounce.ts           # Debounce utility hook
│   │   │
│   │   ├── 📁 utils/                # Utility functions
│   │   │   ├── 📄 validation.ts            # Form validation helpers
│   │   │   ├── 📄 formatters.ts            # Data formatting utilities
│   │   │   ├── 📄 constants.ts             # Application constants
│   │   │   ├── 📄 storage.ts               # Storage utilities
│   │   │   └── 📄 helpers.ts               # General helper functions
│   │   │
│   │   └── 📁 types/                # TypeScript type definitions
│   │       ├── 📄 auth.ts                  # Authentication types
│   │       ├── 📄 user.ts                  # User data types
│   │       ├── 📄 api.ts                   # API response types
│   │       └── 📄 index.ts                 # Exported types
│   │
│   └── 📁 node_modules/             # Frontend dependencies (auto-generated)
│
├── 📁 backend/                       # Express API Server (Port: 5000)
│   ├── 📄 package.json              # Backend dependencies & scripts
│   ├── 📄 package-lock.json         # Dependency lock file
│   ├── 📄 tsconfig.json             # TypeScript configuration
│   ├── 📄 nodemon.json              # Nodemon development config
│   ├── 📄 jest.config.js            # Jest testing configuration
│   ├── 📄 .env                      # Environment variables
│   ├── 📄 .env.example              # Environment template
│   ├── 📄 README.md                 # Backend-specific documentation
│   ├── 📄 admin-update-password.js  # Admin utility script
│   │
│   ├── 📁 src/                      # Source code directory
│   │   ├── 📄 app.ts                # Express application setup
│   │   ├── 📄 server.ts             # Server entry point
│   │   │
│   │   ├── 📁 controllers/          # Route controllers
│   │   │   ├── 📄 authController.ts        # Authentication controller
│   │   │   ├── 📄 userController.ts        # User management controller
│   │   │   └── 📄 healthController.ts      # Health check controller
│   │   │
│   │   ├── 📁 middleware/           # Express middleware
│   │   │   ├── 📄 auth.ts                  # JWT authentication middleware
│   │   │   ├── 📄 rateLimiter.ts           # Rate limiting middleware
│   │   │   ├── 📄 validation.ts            # Input validation middleware
│   │   │   ├── 📄 errorHandler.ts          # Global error handling
│   │   │   ├── 📄 cors.ts                  # CORS configuration
│   │   │   ├── 📄 security.ts              # Security headers (Helmet)
│   │   │   └── 📄 logging.ts               # Request logging middleware
│   │   │
│   │   ├── 📁 models/               # Database models
│   │   │   ├── 📄 User.ts                  # User model interface
│   │   │   ├── 📄 PasswordResetToken.ts    # Password reset model
│   │   │   └── 📄 index.ts                 # Model exports
│   │   │
│   │   ├── 📁 routes/               # API route definitions
│   │   │   ├── 📄 authRoutes.ts            # Authentication routes
│   │   │   ├── 📄 userRoutes.ts            # User management routes
│   │   │   ├── 📄 healthRoutes.ts          # Health check routes
│   │   │   └── 📄 index.ts                 # Route aggregation
│   │   │
│   │   ├── 📁 services/             # Business logic layer
│   │   │   ├── 📄 authService.ts           # Authentication business logic
│   │   │   ├── 📄 userService.ts           # User management logic
│   │   │   ├── 📄 emailService.ts          # Email sending service
│   │   │   ├── 📄 jwtService.ts            # JWT token service
│   │   │   └── 📄 passwordService.ts       # Password hashing service
│   │   │
│   │   ├── 📁 utils/                # Helper functions
│   │   │   ├── 📄 validation.ts            # Validation rules
│   │   │   ├── 📄 logger.ts                # Logging utilities
│   │   │   ├── 📄 constants.ts             # Application constants
│   │   │   ├── 📄 helpers.ts               # General utilities
│   │   │   └── 📄 crypto.ts                # Cryptographic utilities
│   │   │
│   │   ├── 📁 database/             # Database configuration
│   │   │   ├── 📄 connection.ts            # PostgreSQL connection setup
│   │   │   ├── 📄 pool.ts                  # Connection pool configuration
│   │   │   ├── 📄 queries.ts               # SQL query definitions
│   │   │   └── 📄 init.sql                 # Database initialization
│   │   │
│   │   └── 📁 types/                # TypeScript definitions
│   │       ├── 📄 auth.ts                  # Authentication types
│   │       ├── 📄 user.ts                  # User types
│   │       ├── 📄 database.ts              # Database types
│   │       ├── 📄 express.ts               # Express type extensions
│   │       └── 📄 index.ts                 # Type exports
│   │
│   ├── 📁 migrations/               # Database migration files
│   │   ├── 📄 001_create_users_table.sql   # Initial user table
│   │   ├── 📄 002_create_password_reset_tokens.sql # Password reset table
│   │   └── 📄 003_add_indexes.sql          # Database indexes
│   │
│   ├── 📁 tests/                    # Backend test files
│   │   ├── 📁 unit/                        # Unit tests
│   │   ├── 📁 integration/                 # Integration tests
│   │   ├── 📄 setup.ts                     # Test setup configuration
│   │   └── 📄 teardown.ts                  # Test cleanup
│   │
│   └── 📁 node_modules/             # Backend dependencies (auto-generated)
│
├── 📁 e2e/                          # End-to-End Tests (Playwright)
│   ├── 📄 package.json              # E2E test dependencies
│   ├── 📄 package-lock.json         # Dependency lock file
│   ├── 📄 playwright.config.ts      # Playwright configuration
│   ├── 📄 .env                      # Test environment variables
│   ├── 📄 LOGIN_TEST_REPORT.md      # Test documentation
│   ├── 📄 FINAL_LOGIN_TEST_REPORT.md # Final test summary
│   │
│   ├── 📁 tests/                    # Test specifications
│   │   ├── 📄 login-comprehensive.spec.ts  # 57 comprehensive login tests
│   │   ├── 📄 login-edge-cases.spec.ts     # Advanced security testing
│   │   ├── 📄 login-specific-user.spec.ts  # User-specific tests
│   │   ├── 📄 registration.spec.ts         # User registration tests
│   │   ├── 📄 password-reset.spec.ts       # Password reset flow tests
│   │   └── 📄 navigation.spec.ts           # Navigation and routing tests
│   │
│   ├── 📁 test-results/             # Test execution artifacts
│   │   ├── 📄 test-results.json            # Test run results
│   │   ├── 📁 screenshots/                 # Test screenshots
│   │   └── 📁 videos/                      # Test recordings
│   │
│   ├── 📁 fixtures/                 # Test data and fixtures
│   │   ├── 📄 users.json                   # Test user data
│   │   └── 📄 test-data.json               # General test data
│   │
│   └── 📁 node_modules/             # E2E test dependencies (auto-generated)
│
├── 📁 scripts/                      # Deployment and utility scripts
│   ├── 📄 deploy-windows.ps1        # Windows deployment script
│   ├── 📄 backup-windows.ps1        # Windows backup script
│   ├── 📄 setup-dev.sh              # Development environment setup
│   ├── 📄 setup-prod.sh             # Production environment setup
│   └── 📄 health-check.sh           # System health monitoring
│
└── 📁 docs/                         # Additional documentation
    ├── 📄 DOCKER_SETUP.md           # Docker containerization guide
    ├── 📄 DATABASE_SETUP.md         # Database configuration guide
    ├── 📄 DEPLOYMENT_GUIDE.md       # Production deployment guide
    ├── 📄 WINDOWS_SERVER_DEPLOYMENT.md # Windows-specific deployment
    ├── 📄 SECURITY_GUIDE.md         # Security implementation guide
    ├── 📄 PERFORMANCE_GUIDE.md      # Performance optimization guide
    └── 📄 TROUBLESHOOTING.md        # Common issues and solutions
```

---

## 🔧 File Types and Purposes

### Configuration Files

| File | Purpose | Location |
|------|---------|----------|
| `.eslintrc.js` | Code quality linting rules | Root |
| `package.json` | Dependencies and scripts | Multiple |
| `tsconfig.json` | TypeScript compilation config | Multiple |
| `vite.config.ts` | Frontend build configuration | Frontend |
| `playwright.config.ts` | E2E test configuration | E2E |
| `docker-compose.yml` | Development orchestration | Root |
| `docker-compose.prod.yml` | Production orchestration | Root |
| `.env` | Environment variables | Multiple |
| `nodemon.json` | Development server config | Backend |
| `jest.config.js` | Unit test configuration | Backend |

### Source Code Files

| Pattern | Purpose | Technology |
|---------|---------|------------|
| `*.tsx` | React components with JSX | TypeScript + React |
| `*.ts` | TypeScript source files | TypeScript |
| `*.css` | Styling and design | CSS/Tailwind |
| `*.sql` | Database schema and migrations | PostgreSQL |
| `*.spec.ts` | Test specifications | Jest/Playwright |
| `*.md` | Documentation files | Markdown |

### Key Directories

| Directory | Purpose | Primary Technology |
|-----------|---------|-------------------|
| `frontend/src/components` | Reusable UI components | React + TypeScript |
| `frontend/src/pages` | Route page components | React + TypeScript |
| `frontend/src/contexts` | State management | React Context API |
| `frontend/src/services` | API communication layer | Axios + TypeScript |
| `backend/src/controllers` | HTTP request handlers | Express + TypeScript |
| `backend/src/middleware` | Request processing pipeline | Express middleware |
| `backend/src/services` | Business logic layer | TypeScript |
| `backend/src/database` | Database configuration | PostgreSQL + pg |
| `e2e/tests` | End-to-end test suites | Playwright |

---

## 🚀 Build and Development Files

### Frontend Build Process
- **Entry Point**: `frontend/src/main.tsx`
- **Build Tool**: Vite with TypeScript
- **Output**: `frontend/dist/` (auto-generated)
- **Dev Server**: Port 3000 with HMR

### Backend Build Process
- **Entry Point**: `backend/src/server.ts`
- **Build Tool**: TypeScript compiler (tsc)
- **Output**: `backend/dist/` (auto-generated)
- **Dev Server**: Port 5000 with nodemon

### Docker Configuration
- **Development**: `docker-compose.yml`
- **Production**: `docker-compose.prod.yml`
- **Services**: Frontend, Backend, PostgreSQL, Redis

---

## 📊 File Statistics

### Frontend Codebase
- **Total Components**: ~15 React components
- **Pages**: 8 route pages
- **Services**: 4 API service files
- **Utilities**: 5 helper/utility files
- **Types**: 4 TypeScript definition files

### Backend Codebase
- **Controllers**: 3 main controllers
- **Routes**: 3 route definition files
- **Middleware**: 7 middleware functions
- **Services**: 5 business logic services
- **Models**: 3 data models

### Testing Codebase
- **E2E Tests**: 78+ test scenarios
- **Test Files**: 6 comprehensive test suites
- **Coverage**: Backend 85%+, Frontend 80%+

---

## 🔐 Security-Related Files

### Authentication & Authorization
- `backend/src/middleware/auth.ts` - JWT authentication
- `backend/src/services/jwtService.ts` - Token management
- `backend/src/services/passwordService.ts` - Password hashing
- `frontend/src/contexts/AuthContext.tsx` - Frontend auth state

### Security Configuration
- `backend/src/middleware/security.ts` - Helmet security headers
- `backend/src/middleware/cors.ts` - CORS configuration
- `backend/src/middleware/rateLimiter.ts` - Rate limiting
- `backend/src/middleware/validation.ts` - Input validation

### Environment Security
- `.env` files (multiple) - Secure configuration
- `backend/admin-update-password.js` - Administrative utilities

---

## 📈 Performance and Monitoring

### Health Monitoring
- `backend/src/controllers/healthController.ts` - Health checks
- `backend/src/routes/healthRoutes.ts` - Health endpoints
- `scripts/health-check.sh` - System monitoring

### Performance Optimization
- `frontend/vite.config.ts` - Frontend build optimization
- `backend/src/database/pool.ts` - Database connection pooling
- `frontend/src/services/apiService.ts` - API request optimization

---

## 🧪 Testing Infrastructure

### Unit Testing
- `backend/tests/` - Backend unit tests
- Jest configuration in `backend/jest.config.js`

### Integration Testing
- `backend/tests/integration/` - API integration tests
- Database testing with test fixtures

### End-to-End Testing
- `e2e/tests/` - Comprehensive E2E test suites
- Playwright configuration and utilities
- Test reporting and artifacts

---

**Documentation Version**: 2.0  
**Last Updated**: August 3, 2025  
**Maintained By**: Development Team