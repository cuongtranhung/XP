# 📚 Project Documentation Index

Welcome to the Fullstack Authentication System documentation. This index provides a comprehensive overview of all project documentation and resources.

## 📋 Table of Contents

### 🚀 Getting Started
- [Main README](./README.md) - Project overview and quick start
- [Docker Setup](./DOCKER_SETUP.md) - Docker configuration and deployment
- [Database Setup](./DATABASE_SETUP.md) - Database configuration and migration
- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Production deployment instructions
- [Windows Server Deployment](./WINDOWS_SERVER_DEPLOYMENT.md) - Windows-specific deployment

### 🏗️ Architecture Documentation
- [Project Architecture](#architecture) - System architecture overview
- [API Documentation](#api-documentation) - REST API endpoints and schemas
- [Database Schema](#database-schema) - Database structure and relationships
- [Security Implementation](#security) - Security measures and best practices

### 💻 Development
- [Developer Guide](#developer-guide) - Development setup and workflows
- [Frontend Documentation](./frontend/README.md) - React application documentation
- [Backend Documentation](./backend/README.md) - Express API documentation
- [Testing Guide](#testing) - Testing strategies and reports

### 📊 Reports & Analysis
- [Build Report](./BUILD_REPORT.md) - Build configuration and optimization
- [Test Report](./TEST_REPORT.md) - Testing coverage and results
- [E2E Test Report](./e2e/SIGNUP_TEST_REPORT.md) - End-to-end testing results

---

## 🏗️ Project Architecture

### System Overview
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React SPA     │    │  Express API    │    │  PostgreSQL DB  │
│   (Frontend)    │◄──►│   (Backend)     │◄──►│   (Database)    │
│  Port: 3000     │    │  Port: 5000     │    │  Port: 5432     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Directory Structure
```
XP/
├── 📁 frontend/          # React application
│   ├── 📁 src/
│   │   ├── 📁 components/  # Reusable UI components
│   │   ├── 📁 pages/       # Route pages
│   │   ├── 📁 contexts/    # React contexts
│   │   ├── 📁 services/    # API service layer
│   │   ├── 📁 utils/       # Utility functions
│   │   └── 📁 types/       # TypeScript definitions
│   └── 📄 package.json
├── 📁 backend/           # Express API server
│   ├── 📁 src/
│   │   ├── 📁 controllers/ # Route controllers
│   │   ├── 📁 middleware/  # Express middleware
│   │   ├── 📁 models/      # Database models
│   │   ├── 📁 routes/      # API routes
│   │   ├── 📁 services/    # Business logic
│   │   ├── 📁 utils/       # Utility functions
│   │   └── 📁 database/    # DB migrations & setup
│   └── 📄 package.json
├── 📁 e2e/              # End-to-end tests
├── 📄 docker-compose.yml # Docker orchestration
└── 📄 README.md         # Main documentation
```

### Tech Stack

#### Frontend Stack
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS + CSS Modules
- **Routing**: React Router v6
- **State Management**: React Context + useReducer
- **Forms**: React Hook Form + Yup validation
- **HTTP Client**: Axios with interceptors
- **UI Components**: Custom components with Lucide icons
- **Build Tool**: Vite with HMR
- **Testing**: Jest + React Testing Library

#### Backend Stack
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL 15 with connection pooling
- **ORM**: Custom SQL queries with pg
- **Authentication**: JWT with bcrypt
- **Security**: Helmet, CORS, Rate limiting
- **Email**: Nodemailer with SMTP
- **Validation**: Express-validator
- **Testing**: Jest + Supertest
- **Process Management**: PM2 (production)

#### DevOps & Infrastructure
- **Containerization**: Docker + Docker Compose
- **Database**: PostgreSQL with persistent volumes
- **Reverse Proxy**: Nginx (production)
- **SSL**: Let's Encrypt certificates
- **Monitoring**: Custom health checks
- **Logging**: Winston with structured logs

---

## 🔐 Security Implementation

### Authentication & Authorization
- **JWT Tokens**: Secure token-based authentication
- **Password Hashing**: bcrypt with salt rounds
- **Rate Limiting**: Request throttling by IP
- **CORS**: Configured cross-origin requests
- **Helmet**: Security headers middleware
- **Input Validation**: Server-side validation
- **SQL Injection Protection**: Parameterized queries

### Data Protection
- **Environment Variables**: Sensitive data protection
- **Database Security**: Connection string encryption
- **Email Security**: Secure SMTP with TLS
- **Session Management**: JWT expiration handling
- **Password Reset**: Secure token-based reset

---

## 📊 API Documentation

### Authentication Endpoints

#### POST `/api/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "fullName": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "John Doe",
      "emailVerified": false
    }
  }
}
```

#### POST `/api/auth/login`
Authenticate user credentials.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "John Doe",
      "emailVerified": true
    }
  }
}
```

#### POST `/api/auth/forgot-password`
Request password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

#### POST `/api/auth/reset-password`
Reset password with token.

**Request Body:**
```json
{
  "token": "reset-token-here",
  "newPassword": "NewSecurePass123!"
}
```

### Health Check Endpoints

#### GET `/health`
Application health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-08-02T16:21:03.608Z",
  "uptime": 47384.825858186,
  "environment": "development",
  "version": "1.0.0",
  "database": {
    "status": "healthy",
    "connected": true,
    "responseTime": "53ms"
  }
}
```

---

## 🗄️ Database Schema

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  email_verification_token VARCHAR(255),
  email_verification_expires TIMESTAMP WITH TIME ZONE,
  last_login TIMESTAMP WITH TIME ZONE
);
```

### Password Reset Tokens Table
```sql
CREATE TABLE password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used BOOLEAN DEFAULT FALSE
);
```

---

## 🧪 Testing

### Test Coverage
- **Backend**: 85%+ unit test coverage
- **Frontend**: 80%+ component test coverage
- **E2E**: Critical user journeys covered
- **API**: All endpoints tested

### Test Reports
- [Backend Test Report](./TEST_REPORT.md)
- [E2E Test Report](./e2e/SIGNUP_TEST_REPORT.md)
- [Build Report](./BUILD_REPORT.md)

### Running Tests
```bash
# Backend tests
cd backend && npm test

# Frontend tests  
cd frontend && npm test

# E2E tests
cd e2e && npm test
```

---

## 🚀 Deployment

### Development
```bash
# Start all services
docker-compose up -d

# Or manually:
cd backend && npm run dev    # Port 5000
cd frontend && npm run dev   # Port 3000
```

### Production
```bash
# Docker deployment
docker-compose -f docker-compose.prod.yml up -d

# Manual deployment
npm run build
npm start
```

### Environment Configuration
- [Docker Setup Guide](./DOCKER_SETUP.md)
- [Database Setup Guide](./DATABASE_SETUP.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Windows Deployment](./WINDOWS_SERVER_DEPLOYMENT.md)

---

## 📞 Support & Contributing

### Getting Help
- Check existing documentation above
- Review [troubleshooting section](./README.md#troubleshooting)
- Check GitHub issues
- Contact development team

### Development Workflow
1. Clone repository
2. Install dependencies: `npm run setup`
3. Start development: `docker-compose up -d`
4. Run tests: `npm test`
5. Create pull request

### Code Quality
- ESLint configuration enforced
- Prettier formatting
- TypeScript strict mode
- Jest testing required
- Security audit required

---

## 📝 License

MIT License - see [LICENSE](./LICENSE) for details.

---

*Last updated: August 2025*
*Documentation maintained by: Development Team*