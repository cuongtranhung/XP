# XP Project - Fullstack Authentication System

🚀 **Enterprise-grade fullstack authentication system with advanced user group management**

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/your-repo)
[![Test Coverage](https://img.shields.io/badge/coverage-75%25-yellow)](https://github.com/your-repo)
[![Version](https://img.shields.io/badge/version-2.1.0-blue)](https://github.com/your-repo)
[![License](https://img.shields.io/badge/license-MIT-green)](https://github.com/your-repo)

## 🚀 What's New - v2.1.0 (2025-01-11)

### 🚄 Redis Cache & Performance Optimization
- **99.86% faster backend startup** - From 30s down to 41ms!
- **Intelligent caching layer** with Redis/Memory fallback
- **80-90% API response improvement** for cached endpoints
- **Lazy loading architecture** for on-demand module loading
- **Production-ready cache services** with warming & invalidation
- [View Redis Implementation](docs/REDIS_IMPLEMENTATION_PHASE1_COMPLETE.md)

### 👥 Advanced User Group Management Enhancement
- **Real-time member management** with bulk operations
- **60-80% query performance improvement** with database optimization
- **Professional UI/UX** with hover-based role management
- **Comprehensive testing** with 75%+ coverage
- **Production-ready** with full authentication and security
- [View Implementation Summary](docs/04-api/user-management/IMPLEMENTATION_SUMMARY.md)

## Core Features

### Authentication System
- ✅ User Registration with Email Verification
- ✅ Secure Login/Logout with JWT Tokens
- ✅ Password Reset via Email
- ✅ Protected Routes & Session Management

### Form Builder v2.0
- ✅ **Mobile-First Design** - Responsive across all devices
- ✅ **Drag & Drop Interface** - Visual form creation
- ✅ **8 Professional Templates** - Ready-to-use forms
- ✅ **Offline Mode** - PWA with service worker
- ✅ **Voice Commands** - Hands-free form building
- ✅ **WCAG 2.1 AAA** - Full accessibility compliance
- ✅ **Real-time Preview** - See changes instantly

## 📋 Development Guidelines

- 📊 [Comprehensive Analysis Report](./COMPREHENSIVE_ANALYSIS_REPORT.md) - Complete security, performance, and quality analysis
- 🚫 [Development Guidelines - What NOT to Do](./DEVELOPMENT_GUIDELINES_DO_NOT.md) - Critical security and quality guidelines

## Technology Stack

### Frontend
- React 18 with TypeScript 5.7.2
- Tailwind CSS for styling
- React Router for navigation
- React Hook Form for form handling
- Axios for API calls
- **Framer Motion** for animations
- **@dnd-kit** for drag & drop
- **Vite** for build tooling
- **PWA** with Service Workers

### Backend
- Node.js with Express
- TypeScript
- PostgreSQL database
- **Redis Cache** with Memory fallback
- JWT for authentication
- Bcrypt for password hashing
- Nodemailer for emails
- Security middleware (Helmet, CORS, Rate Limiting)
- **Optimized startup** (41ms with lazy loading)

## Project Structure

```
├── backend/                   # Express API server
├── frontend/                  # React application
│   ├── src/
│   │   ├── components/
│   │   │   └── formBuilder/  # Form Builder v2.0
│   │   │       ├── enhanced/ # 24 new components
│   │   │       └── FormBuilderComplete.tsx
│   │   ├── hooks/            # Custom React hooks
│   │   └── styles/           # Global styles
│   └── public/
│       └── service-worker.js # PWA support
├── docs/                      # Documentation
│   ├── modules/              # Module documentation
│   │   └── FORM-BUILDER.md   # Form Builder docs
│   └── CHANGELOG.md          # Version history
├── docker-compose.yml        # Local development
└── README.md                 # This file
```

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- npm or yarn

### 1. Clone & Install
```bash
git clone <repository-url>
cd fullstack-auth-system

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies  
cd ../frontend && npm install
```

### 2. Database Setup
```bash
# Create database
createdb fullstack_auth

# Run migrations
cd backend
npm run migrate
```

### 3. Environment Setup
```bash
# Backend
cd backend
cp .env.example .env
# Edit .env with your configuration

# Frontend
cd ../frontend
cp .env.example .env
# Edit .env with your configuration
```

### 4. Start Development Servers
```bash
# Start backend (in backend directory)
npm run dev

# Start frontend (in frontend directory)
npm start
```

### 5. Docker Alternative
```bash
# Start all services with Docker
docker-compose up -d
```

## 🔐 Test Credentials

**⚠️ IMPORTANT - FOR TESTING ONLY ⚠️**

Use these credentials for testing and development:

```
Email: cuongtranhung@gmail.com
Password: @Abcd6789
```

**Usage:**
- Frontend login: http://localhost:3000/login
- API testing: POST http://localhost:5000/api/auth/login
- User ID: 2
- Full Name: Trần Hùng Cường

**⚠️ DO NOT CHANGE THESE CREDENTIALS IN ANY TASK ⚠️**

## 📚 Complete Documentation

### Core Documentation
- 📋 **[Project Index](./PROJECT_INDEX_UPDATED.md)** - Complete documentation overview
- 🔌 **[API Reference](./API_DOCUMENTATION_COMPLETE.md)** - Full REST API documentation
- 📁 **[Project Structure](./PROJECT_STRUCTURE.md)** - Directory and file structure guide
- 🧪 **[Test Reports](./e2e/FINAL_LOGIN_TEST_REPORT.md)** - Testing documentation and results

### Form Builder v2.0 Documentation
- 📖 **[Form Builder Module Guide](/docs/modules/FORM-BUILDER.md)** - Complete implementation guide
- 📝 **[Version History](/docs/CHANGELOG.md)** - All version changes and improvements
- 📊 **[Implementation Summary](/docs/09-reports/improvement-logs/form-builder-implementation-summary.md)** - Technical summary and metrics

## Quick API Reference

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user  
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Change password
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/verify-reset-token/:token` - Verify reset token

### Health Check Endpoints
- `GET /health` - System health check
- `GET /health/database` - Database connectivity check

## Security Features

- Password hashing with bcrypt (12 rounds)
- JWT tokens with secure configuration
- Rate limiting on authentication endpoints
- Input validation and sanitization
- CORS configuration
- Helmet security headers
- SQL injection protection
- XSS protection

## Development

### Backend Development
```bash
cd backend
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run migrate      # Run database migrations
npm run test         # Run tests
```

### Frontend Development
```bash
cd frontend
npm start           # Start development server
npm run build       # Build for production
npm run test        # Run tests
npm run lint        # Run linting
npm run dev         # Vite development server
```

### Form Builder Usage
```typescript
import { FormBuilderComplete } from '@/components/formBuilder';

function App() {
  return (
    <FormBuilderComplete 
      formId="contact-form"
      onSave={(data) => console.log('Form saved:', data)}
    />
  );
}
```

## Deployment

See deployment guides in:
- `backend/README.md` - Backend deployment
- `frontend/README.md` - Frontend deployment

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details