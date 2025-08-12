# XP Project - Comprehensive Index

## 🎯 Project Overview

**Name**: Fullstack Authentication System (XP)  
**Type**: Monorepo with React + Node.js/Express + PostgreSQL  
**Architecture**: Microservices with real-time features  
**Status**: Active Development

## 📦 Tech Stack

### Frontend
- **Framework**: React 18.2 with TypeScript 5.7
- **Build Tool**: Vite 6.0
- **Styling**: Tailwind CSS 3.3
- **State Management**: React Query 5.84
- **Form Management**: React Hook Form 7.48
- **UI Components**: 
  - Lucide React (icons)
  - DnD Kit (drag-drop)
  - Framer Motion (animations)
- **Real-time**: Socket.IO Client
- **Charts**: Chart.js with React-ChartJS-2

### Backend
- **Runtime**: Node.js 18+ with TypeScript 5.9
- **Framework**: Express 4.18
- **Database**: PostgreSQL with pg driver
- **ORM**: TypeORM 0.3
- **Authentication**: JWT (jsonwebtoken)
- **File Storage**: AWS S3 / Cloudflare R2
- **Real-time**: Socket.IO with Redis adapter
- **Email**: Nodemailer
- **Security**: Helmet, bcrypt, rate limiting
- **Monitoring**: Winston logging, Prometheus metrics

### Testing & Quality
- **Unit Testing**: Jest
- **E2E Testing**: Playwright
- **Linting**: ESLint with TypeScript support
- **Formatting**: Prettier

## 🗂️ Project Structure

```
XP/
├── 📁 backend/              # Node.js Express API server
│   ├── src/
│   │   ├── app.ts          # Express app configuration
│   │   ├── server.ts       # Server entry point
│   │   ├── config/         # Configuration files
│   │   ├── controllers/    # Request handlers
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # Data models
│   │   ├── modules/        # Feature modules
│   │   │   ├── comments/   # Comment system
│   │   │   ├── dynamicFormBuilder/  # Form builder
│   │   │   ├── gpsModule/  # GPS tracking
│   │   │   └── user-management/     # User/role management
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Utility functions
│   ├── migrations/         # Database migrations
│   └── scripts/            # Setup & utility scripts
│
├── 📁 frontend/            # React TypeScript SPA
│   ├── src/
│   │   ├── App.tsx        # Main app component
│   │   ├── main.tsx       # Entry point
│   │   ├── components/    # Reusable components
│   │   │   ├── auth/      # Authentication components
│   │   │   ├── common/    # Shared components
│   │   │   ├── comments/  # Comment components
│   │   │   └── activity/  # Activity tracking
│   │   ├── contexts/      # React contexts
│   │   ├── hooks/         # Custom React hooks
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   ├── types/         # TypeScript types
│   │   └── utils/         # Utility functions
│   └── public/            # Static assets
│
├── 📁 e2e/                # End-to-end tests
│   ├── tests/             # Test specifications
│   └── playwright.config.ts
│
├── 📁 docs/               # Documentation
│   ├── 01-getting-started/
│   ├── 02-architecture/
│   ├── 03-features/
│   ├── 04-api/
│   ├── 05-deployment/
│   ├── 06-testing/
│   ├── 07-troubleshooting/
│   ├── 08-development/
│   └── 09-reports/
│
├── 📁 scripts/            # Utility scripts
├── 📁 coordination/       # Claude Flow coordination
└── 📁 migrations/         # Database migrations
```

## 🚀 Core Features

### 1. Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- Multi-device session management
- Password reset & email verification
- Two-factor authentication support

### 2. Dynamic Form Builder
- Drag-and-drop form creation
- 15+ field types (text, select, date, file, etc.)
- Conditional logic & validation
- Form templates & versioning
- Real-time collaboration
- Public form sharing

### 3. User Activity Logging (UAL)
- Comprehensive activity tracking
- Session management
- Location tracking with GPS
- Action type categorization
- Performance metrics

### 4. Comment System
- Nested comments with replies
- Real-time updates
- File attachments
- Mention support
- Moderation features

### 5. User Management
- User CRUD operations
- Role & permission management
- Group management
- Audit logging
- Profile management with avatars

### 6. Real-time Features
- WebSocket connections via Socket.IO
- Real-time notifications
- Collaborative form editing
- Live activity monitoring
- Presence indicators

### 7. File Management
- Cloudflare R2 integration
- Image optimization with Sharp
- Parallel upload system
- File type validation
- Thumbnail generation

## 📝 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/forgot-password` - Password reset
- `POST /api/auth/verify-email` - Email verification

### Forms
- `GET /api/forms` - List forms
- `POST /api/forms` - Create form
- `GET /api/forms/:id` - Get form
- `PUT /api/forms/:id` - Update form
- `DELETE /api/forms/:id` - Delete form
- `POST /api/forms/:id/submit` - Submit form

### User Management
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `GET /api/users/:id` - Get user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Comments
- `GET /api/comments` - List comments
- `POST /api/comments` - Create comment
- `PUT /api/comments/:id` - Update comment
- `DELETE /api/comments/:id` - Delete comment

## 🔧 Development Commands

### Quick Start
```bash
# Install dependencies
npm run setup

# Start development servers
npm run dev

# Or start individually
npm run dev:frontend  # Frontend on http://localhost:3000
npm run dev:backend   # Backend on http://localhost:5000
```

### Database Setup
```bash
cd backend
npm run db:setup       # Run migrations
npm run db:migrate     # Run specific migrations
npm run formbuilder:setup  # Setup form builder tables
```

### Testing
```bash
# Unit tests
npm run test:frontend
npm run test:backend

# E2E tests
npm run test:e2e

# With coverage
npm run test:coverage
```

### Build & Deploy
```bash
# Build for production
npm run build:frontend
npm run build:backend

# Docker deployment
docker-compose up       # Development
docker-compose -f docker-compose.prod.yml up  # Production
```

## 🔐 Environment Variables

### Backend (.env)
```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname

# JWT
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# Email (SendGrid)
SENDGRID_API_KEY=your-api-key
FROM_EMAIL=noreply@example.com

# Cloudflare R2
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=your-bucket

# Redis (optional)
REDIS_URL=redis://localhost:6379
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

## 📚 Key Documentation

### Getting Started
- [Database Setup](docs/01-getting-started/database-setup.md)
- [Development Setup](docs/01-getting-started/dev-setup.md)
- [Test Credentials](docs/01-getting-started/test-credentials.md)

### Architecture
- [Project Structure](docs/02-architecture/project-structure.md)
- [System Initiatives](docs/02-architecture/system-initiatives.md)

### Features
- [Dynamic Forms Guide](docs/03-features/dynamic-forms/guide.md)
- [Activity Logging](docs/03-features/activity-logging/module_documentation.md)
- [GPS Tracking](docs/03-features/gps-tracking/tracking-implementation-guide.md)

### API Documentation
- [Complete API Reference](docs/04-api/complete-reference.md)
- [API Overview](docs/04-api/overview.md)

### Deployment
- [Deployment Guide](docs/05-deployment/deployment-guide.md)
- [Docker Setup](docs/05-deployment/docker.md)
- [Windows Server](docs/05-deployment/windows-server.md)
- [WSL2 Setup](docs/05-deployment/wsl2-setup.md)

## 🎯 Development Initiatives

### Current Focus Areas
1. **Performance Optimization** - Build time and runtime improvements
2. **TypeScript 5.7 Migration** - Upgrading to latest TypeScript
3. **User Activity Logging** - Strategic improvements for 2025
4. **Form Builder UX** - Drag-drop and field reordering enhancements
5. **Real-time Communication** - WebSocket optimization
6. **Caching System** - Redis integration and performance

## 🔌 Integrations

### Claude Flow Integration
- Swarm orchestration support
- Memory persistence
- Task coordination
- AI-assisted development workflows

### External Services
- **SendGrid** - Email delivery
- **Cloudflare R2** - Object storage
- **PostgreSQL** - Primary database
- **Redis** - Caching and sessions
- **Docker** - Containerization

## 🧪 Testing Strategy

### Coverage Requirements
- Unit tests: >80% coverage
- Integration tests: Critical paths
- E2E tests: User workflows
- Performance tests: Load testing

### Test Locations
- Backend: `backend/src/__tests__/`
- Frontend: `frontend/src/__tests__/`
- E2E: `e2e/tests/`
- Performance: `tests/`

## 🚦 Development Status

### ✅ Completed
- Core authentication system
- Dynamic form builder
- Comment system
- User management
- File upload system
- Basic activity logging

### 🔄 In Progress
- Performance optimization
- TypeScript 5.7 migration
- Enhanced activity logging
- Form builder improvements
- Real-time collaboration

### 📋 Planned
- Advanced analytics
- Internationalization (i18n)
- Advanced permissions
- Workflow automation
- Mobile app

## 📞 Quick Links

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **API Docs**: http://localhost:5000/api-docs
- **WebSocket**: ws://localhost:5000

## 🛠️ Troubleshooting

Common issues and solutions are documented in:
- [Common Issues](docs/07-troubleshooting/common-issues.md)
- [Login Issues](docs/07-troubleshooting/login-issues.md)
- [Stability Issues](docs/07-troubleshooting/stability.md)
- [Emergency Recovery](docs/07-troubleshooting/emergency-recovery.md)

## 📊 Performance Metrics

### Target Metrics
- **Frontend Build**: <30s
- **Backend Startup**: <5s
- **API Response**: <200ms
- **Page Load**: <3s
- **Bundle Size**: <500KB initial

### Monitoring
- Backend logs: `logs/backend.log`
- Frontend performance: Browser DevTools
- API metrics: `/api/metrics`
- Health check: `/api/health`

---

**Last Updated**: January 2025  
**Version**: 1.0.0  
**Maintainer**: Development Team