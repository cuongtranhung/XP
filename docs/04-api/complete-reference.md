# 🔌 Complete API Reference - Fullstack Authentication System

**API Version**: 1.0  
**Base URL**: `http://localhost:5000`  
**Documentation Updated**: August 3, 2025

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Request/Response Format](#requestresponse-format)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [API Endpoints](#api-endpoints)
   - [Authentication Routes](#authentication-routes)
   - [User Management Routes](#user-management-routes)
   - [Health Check Routes](#health-check-routes)
7. [Data Models](#data-models)
8. [Status Codes](#status-codes)
9. [Testing](#testing)
10. [Security](#security)

---

## 🔍 Overview

The Fullstack Authentication API provides secure user authentication and management capabilities using JWT tokens, bcrypt password hashing, and comprehensive security measures.

### Key Features
- 🔐 JWT-based authentication
- 🔒 Bcrypt password hashing (12 rounds)
- 🛡️ Rate limiting on all endpoints
- ✅ Input validation and sanitization
- 📧 Email verification system
- 🔄 Password reset functionality
- 🏥 Health monitoring endpoints

### API Conventions
- RESTful design principles
- JSON request/response format
- UTF-8 encoding
- ISO 8601 date format
- Bearer token authentication

---

## 🔐 Authentication

### JWT Token Authentication

All protected routes require a valid JWT token in the Authorization header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Configuration
- **Algorithm**: HS256
- **Expiration**: 24 hours
- **Issuer**: fullstack-auth-app
- **Audience**: fullstack-auth-users

### Token Payload Structure
```json
{
  "userId": 1,
  "email": "user@example.com",
  "iat": 1234567890,
  "exp": 1234654290,
  "aud": "fullstack-auth-users",
  "iss": "fullstack-auth-app"
}
```

---

## 📝 Request/Response Format

### Standard Request Headers
```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer <token> // For protected routes
```

### Success Response Format
```json
{
  "success": true,
  "data": {
    // Response data object
  },
  "message": "Operation successful",
  "timestamp": "2025-08-03T10:30:00Z"
}
```

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "AUTH_001",
    "message": "Invalid credentials",
    "details": "The email or password provided is incorrect"
  },
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format",
      "code": "VALIDATION_001"
    }
  ],
  "timestamp": "2025-08-03T10:30:00Z"
}
```

---

## ⚠️ Error Handling

### Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| AUTH_001 | Invalid credentials | 401 |
| AUTH_002 | Token expired | 401 |
| AUTH_003 | Token invalid | 401 |
| AUTH_004 | Insufficient permissions | 403 |
| VALIDATION_001 | Invalid email format | 400 |
| VALIDATION_002 | Password too weak | 400 |
| VALIDATION_003 | Required field missing | 400 |
| USER_001 | User not found | 404 |
| USER_002 | Email already exists | 409 |
| RATE_001 | Too many requests | 429 |
| SERVER_001 | Internal server error | 500 |
| DB_001 | Database connection error | 503 |

### Error Response Examples

#### Validation Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_001",
    "message": "Validation failed"
  },
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format",
      "code": "VALIDATION_001"
    },
    {
      "field": "password",
      "message": "Password must be at least 8 characters",
      "code": "VALIDATION_002"
    }
  ]
}
```

#### Authentication Error
```json
{
  "success": false,
  "error": {
    "code": "AUTH_001",
    "message": "Authentication failed",
    "details": "Invalid email or password"
  }
}
```

---

## 🛡️ Rate Limiting

### Endpoint-Specific Limits

| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| Login | 5 requests | 15 minutes | IP address |
| Register | 3 requests | 15 minutes | IP address |
| Forgot Password | 3 requests | 1 hour | IP address |
| Reset Password | 5 requests | 1 hour | IP address |
| General API | 100 requests | 15 minutes | IP address |

### Rate Limit Headers
```http
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 1627890123
X-RateLimit-Reset-After: 900
```

### Rate Limit Exceeded Response
```json
{
  "success": false,
  "error": {
    "code": "RATE_001",
    "message": "Too many requests",
    "details": "Rate limit exceeded. Please try again in 15 minutes."
  },
  "retryAfter": 900
}
```

---

## 🚀 API Endpoints

### Authentication Routes

#### 1. Register New User

**Endpoint**: `POST /api/auth/register`  
**Description**: Create a new user account  
**Rate Limit**: 3 per 15 minutes  
**Authentication**: Not required

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "fullName": "John Doe"
}
```

**Validation Rules**:
- `email`: Valid email format, max 255 chars, unique
- `password`: Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
- `fullName`: 2-50 chars, letters and spaces only

**Success Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "John Doe",
      "emailVerified": false,
      "createdAt": "2025-08-03T10:30:00Z"
    }
  },
  "message": "Registration successful. Please verify your email."
}
```

**Error Responses**:
- 400 Bad Request - Validation errors
- 409 Conflict - Email already exists

---

#### 2. User Login

**Endpoint**: `POST /api/auth/login`  
**Description**: Authenticate user and receive JWT token  
**Rate Limit**: 5 per 15 minutes  
**Authentication**: Not required

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "John Doe",
      "emailVerified": true,
      "lastLogin": "2025-08-03T10:30:00Z"
    }
  },
  "message": "Login successful"
}
```

**Error Responses**:
- 401 Unauthorized - Invalid credentials
- 429 Too Many Requests - Rate limit exceeded

---

#### 3. Validate Token

**Endpoint**: `GET /api/auth/validate`  
**Description**: Validate JWT token and get user info  
**Rate Limit**: General API limit  
**Authentication**: Required

**Request Headers**:
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "valid": true,
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "John Doe",
      "emailVerified": true
    },
    "tokenExpiry": "2025-08-04T10:30:00Z"
  }
}
```

**Error Responses**:
- 401 Unauthorized - Invalid or expired token

---

#### 4. User Logout

**Endpoint**: `POST /api/auth/logout`  
**Description**: Logout user (client-side token removal)  
**Rate Limit**: General API limit  
**Authentication**: Required

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

#### 5. Request Password Reset

**Endpoint**: `POST /api/auth/forgot-password`  
**Description**: Send password reset email  
**Rate Limit**: 3 per hour  
**Authentication**: Not required

**Request Body**:
```json
{
  "email": "user@example.com"
}
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "If the email exists, password reset instructions have been sent"
}
```

**Note**: Always returns 200 OK to prevent email enumeration

---

#### 6. Reset Password

**Endpoint**: `POST /api/auth/reset-password`  
**Description**: Reset password using token from email  
**Rate Limit**: 5 per hour  
**Authentication**: Not required

**Request Body**:
```json
{
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePass123!"
}
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Password reset successful. You can now login with your new password."
}
```

**Error Responses**:
- 400 Bad Request - Invalid or expired token
- 400 Bad Request - Password validation failed

---

#### 7. Verify Reset Token

**Endpoint**: `GET /api/auth/verify-reset-token/:token`  
**Description**: Verify if password reset token is valid  
**Rate Limit**: General API limit  
**Authentication**: Not required

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "valid": true,
    "email": "user@example.com"
  }
}
```

**Error Responses**:
- 400 Bad Request - Invalid or expired token

---

### User Management Routes

#### 8. Get Current User

**Endpoint**: `GET /api/auth/me`  
**Description**: Get current authenticated user details  
**Rate Limit**: General API limit  
**Authentication**: Required

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "John Doe",
      "emailVerified": true,
      "createdAt": "2025-08-01T10:30:00Z",
      "updatedAt": "2025-08-03T10:30:00Z",
      "lastLogin": "2025-08-03T10:30:00Z"
    }
  }
}
```

---

#### 9. Change Password

**Endpoint**: `POST /api/auth/change-password`  
**Description**: Change current user's password  
**Rate Limit**: General API limit  
**Authentication**: Required

**Request Body**:
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword456!"
}
```

**Validation Rules**:
- `currentPassword`: Required, current user's password
- `newPassword`: Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Error Responses**:
- 400 Bad Request - Invalid current password
- 400 Bad Request - New password validation failed
- 401 Unauthorized - Authentication required

---

### Health Check Routes

#### 10. System Health Check

**Endpoint**: `GET /health`  
**Description**: Check overall system health  
**Rate Limit**: None  
**Authentication**: Not required

**Success Response** (200 OK):
```json
{
  "status": "healthy",
  "timestamp": "2025-08-03T10:30:00Z",
  "uptime": 86400.123,
  "environment": "production",
  "version": "2.0.0",
  "services": {
    "api": "healthy",
    "database": "healthy",
    "email": "healthy",
    "cache": "healthy"
  },
  "database": {
    "status": "healthy",
    "connected": true,
    "responseTime": "23ms",
    "poolInfo": {
      "totalCount": 10,
      "idleCount": 8,
      "waitingCount": 0
    }
  }
}
```

**Error Response** (503 Service Unavailable):
```json
{
  "status": "unhealthy",
  "timestamp": "2025-08-03T10:30:00Z",
  "services": {
    "api": "healthy",
    "database": "unhealthy",
    "email": "healthy",
    "cache": "degraded"
  },
  "errors": [
    {
      "service": "database",
      "error": "Connection timeout",
      "details": "Unable to connect to PostgreSQL"
    }
  ]
}
```

---

#### 11. Database Health Check

**Endpoint**: `GET /health/database`  
**Description**: Check database connectivity  
**Rate Limit**: None  
**Authentication**: Not required

**Success Response** (200 OK):
```json
{
  "status": "healthy",
  "connected": true,
  "responseTime": "15ms",
  "timestamp": "2025-08-03T10:30:00Z",
  "details": {
    "version": "PostgreSQL 15.3",
    "activeConnections": 3,
    "maxConnections": 100
  }
}
```

---

## 📊 Data Models

### User Model
```typescript
interface User {
  id: number;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  lastLogin?: string; // ISO 8601
}
```

### Authentication Response
```typescript
interface AuthResponse {
  success: boolean;
  data?: {
    token: string;
    user: User;
  };
  message?: string;
  timestamp: string; // ISO 8601
}
```

### Error Response
```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string;
  };
  errors?: ValidationError[];
  timestamp: string; // ISO 8601
  retryAfter?: number; // seconds
}

interface ValidationError {
  field: string;
  message: string;
  code: string;
}
```

---

## 📋 Status Codes

### Success Codes
- **200 OK** - Request successful
- **201 Created** - Resource created successfully

### Client Error Codes
- **400 Bad Request** - Invalid request data or validation error
- **401 Unauthorized** - Authentication required or failed
- **403 Forbidden** - Insufficient permissions
- **404 Not Found** - Resource not found
- **409 Conflict** - Resource already exists
- **422 Unprocessable Entity** - Validation error with details
- **429 Too Many Requests** - Rate limit exceeded

### Server Error Codes
- **500 Internal Server Error** - Unexpected server error
- **502 Bad Gateway** - Service unavailable
- **503 Service Unavailable** - Service temporarily down

---

## 🧪 Testing

### Testing with cURL

#### Register User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!",
    "fullName": "Test User"
  }'
```

#### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!"
  }'
```

#### Protected Request
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Testing with JavaScript

```javascript
// Login request
const response = await fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'TestPass123!'
  })
});

const data = await response.json();
if (data.success) {
  // Store token
  localStorage.setItem('token', data.data.token);
}

// Protected request
const protectedResponse = await fetch('http://localhost:5000/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
});
```

---

## 🔒 Security

### Security Headers
```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
```

### Best Practices
1. Always use HTTPS in production
2. Store JWT tokens securely (httpOnly cookies recommended)
3. Implement token refresh mechanism
4. Regular security audits
5. Monitor rate limiting and adjust as needed
6. Log security events for monitoring
7. Implement account lockout after failed attempts
8. Use secure password reset tokens
9. Validate all input on server side
10. Keep dependencies updated

### Security Considerations
- Passwords are hashed using bcrypt with 12 salt rounds
- JWT tokens expire after 24 hours
- Rate limiting prevents brute force attacks
- Email enumeration prevention on password reset
- SQL injection protection via parameterized queries
- XSS protection through input sanitization
- CSRF protection via SameSite cookies

---

**API Version**: 1.0  
**Last Updated**: August 3, 2025  
**Maintained By**: Development Team