# Backend API Server

**Version**: 2.0.0  
**Node.js**: 18.x+  
**Database**: PostgreSQL 13+  
**Status**: ✅ Production Ready

Express.js API server with TypeScript, PostgreSQL, and comprehensive security features.

## ✅ Recent Critical Fix (v1.1.0)

### UAL Backend Freeze Issue - RESOLVED
**Problem**: Backend becoming unresponsive during UAL enable/disable operations  
**Root Cause**: Nested database connection deadlock in `locationService.ts`  
**Status**: ✅ COMPLETELY FIXED

**Key Improvements**:
- 🔧 **Connection Pool Monitoring**: Real-time utilization tracking with alerts
- 🛡️ **Circuit Breakers**: Email service protection with automatic recovery  
- ⚡ **Async Logging Throttling**: Prevents event loop exhaustion (100 logs/sec limit)
- ⏱️ **Database Timeouts**: Comprehensive timeout configurations (10s/30s/60s)
- 📊 **Enhanced Health Checks**: Detailed system monitoring endpoints

See [docs/UAL_BACKEND_FREEZE_FIX.md](docs/UAL_BACKEND_FREEZE_FIX.md) for complete technical details.

## Features

- ✅ JWT-based authentication with session management
- ✅ Secure password hashing with bcrypt
- ✅ Email service with Nodemailer + circuit breaker protection
- ✅ Rate limiting & security middleware
- ✅ Input validation & sanitization
- ✅ Comprehensive logging with throttling
- ✅ Database migrations with connection pool monitoring
- ✅ Error handling with timeout configurations
- ✅ CORS configuration
- ✅ Docker support
- ✅ Location tracking services
- ✅ User Activity Logging (UAL) with admin controls
- ✅ Real-time system health monitoring

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with raw SQL queries
- **Authentication**: JWT tokens
- **Email**: Nodemailer
- **Security**: Helmet, CORS, Rate limiting
- **Validation**: express-validator
- **Logging**: Custom logger

## Project Structure

```
src/
├── controllers/      # Request handlers
├── middleware/       # Auth, validation, security
├── models/          # Database models
├── routes/          # API routes
├── services/        # Business logic
├── types/           # TypeScript types
└── utils/           # Utilities and helpers
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/verify-reset-token/:token` - Verify reset token
- `POST /api/auth/change-password` - Change password (authenticated)

### System
- `GET /api/health` - Health check
- `GET /` - API info

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Application
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/fullstack_auth

# JWT
JWT_SECRET=your-super-secure-256-bit-secret-key-here
JWT_EXPIRES_IN=24h

# Security
BCRYPT_ROUNDS=12
RESET_TOKEN_EXPIRY=3600000

# Email (Gmail example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@yourapp.com
FROM_NAME=Your App Name

# Rate Limiting
LOGIN_RATE_LIMIT=5
REGISTER_RATE_LIMIT=3
FORGOT_PASSWORD_RATE_LIMIT=3
RESET_PASSWORD_RATE_LIMIT=5
GENERAL_RATE_LIMIT=100
```

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- npm or yarn

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set up database**
   ```bash
   # Create database
   createdb fullstack_auth
   
   # Run migrations
   npm run migrate
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

### Production Build

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

### Docker

```bash
# Build image
docker build -t fullstack-auth-backend .

# Run container
docker run -p 5000:5000 --env-file .env fullstack-auth-backend
```

## Database

### Migrations

```bash
# Run all pending migrations
npm run migrate

# Create new migration
# Add SQL file to migrations/ directory with naming: 00X_description.sql
```

### Schema

- **users**: User accounts with authentication data
- **password_reset_tokens**: Temporary tokens for password reset
- **email_verification_tokens**: Tokens for email verification
- **migrations**: Migration tracking

## Security Features

### Authentication
- JWT tokens with configurable expiration
- Secure password hashing (bcrypt, 12 rounds)
- Token verification middleware
- Protected routes

### Rate Limiting
- Login: 5 attempts per 15 minutes
- Registration: 3 attempts per hour
- Password reset: 3 attempts per hour
- General API: 100 requests per 15 minutes

### Input Validation
- Email format validation
- Password strength requirements
- Input sanitization (XSS prevention)
- Request size limits

### Headers & CORS
- Helmet security headers
- CORS with specific origin allowlist
- Content Security Policy
- Request logging

## Email Service

### Supported Email Types
- Welcome email after registration
- Password reset with secure token
- Password reset confirmation
- Email verification (optional)

### SMTP Configuration
Supports any SMTP provider. Examples:

**Gmail**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password  # Use App Password
```

**SendGrid**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

## Development

### Scripts
```bash
npm run dev          # Start development server with nodemon
npm run build        # Build TypeScript to JavaScript
npm start           # Start production server
npm run migrate     # Run database migrations
npm test            # Run tests
npm run lint        # Run ESLint
npm run lint:fix    # Fix ESLint issues
```

### Adding New Features

1. **Add types** in `src/types/`
2. **Create model** in `src/models/` for database operations
3. **Add service** in `src/services/` for business logic
4. **Create controller** in `src/controllers/` for request handling
5. **Add routes** in `src/routes/` with validation and middleware
6. **Update main app** to include new routes

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Deployment

### Environment Setup
1. Set `NODE_ENV=production`
2. Use strong JWT secret (256-bit)
3. Configure secure SMTP settings
4. Set up database with SSL
5. Configure proper CORS origins

### Security Checklist
- [ ] Strong JWT secret configured
- [ ] Database uses SSL connections
- [ ] SMTP credentials secured
- [ ] CORS origins properly configured
- [ ] Rate limiting enabled
- [ ] Input validation active
- [ ] Logging configured
- [ ] Error handling implemented
- [ ] Health checks working

### Docker Deployment

```bash
# Build for production
docker build -t fullstack-auth-backend .

# Run with production environment
docker run -d \
  --name auth-backend \
  -p 5000:5000 \
  --env-file .env.production \
  fullstack-auth-backend
```

### Process Management

For production, use PM2 or similar:

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start dist/app.js --name "auth-backend"

# Monitor
pm2 monitor

# Logs
pm2 logs auth-backend
```

## Monitoring

### Health Checks
- `GET /api/health` - Application health
- Database connection status
- Email service status

### Logging
- Request/response logging
- Authentication events
- Security events
- Error logging
- Performance metrics

### Metrics to Monitor
- Response times
- Error rates
- Authentication success/failure rates
- Database connection pool
- Memory usage
- CPU usage

## Troubleshooting

### Common Issues

**Database Connection Failed**
```bash
# Check DATABASE_URL format
postgresql://username:password@host:port/database

# Test connection
psql $DATABASE_URL
```

**Email Service Not Working**
```bash
# Test SMTP configuration
npm run test:email

# Check credentials and host settings
# Ensure app passwords for Gmail
```

**JWT Token Issues**
```bash
# Verify JWT_SECRET is set and secure
# Check token expiration settings
# Validate client-side token storage
```

**Rate Limiting Too Strict**
```bash
# Adjust rate limits in .env
LOGIN_RATE_LIMIT=10
GENERAL_RATE_LIMIT=200
```

### Debugging

```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Check specific logs
grep "ERROR" logs/app.log
grep "Security" logs/app.log
```

## Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new features
4. Ensure all tests pass
5. Submit pull request

## License

MIT License - see LICENSE file for details