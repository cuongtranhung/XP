# 📡 API Documentation

Complete REST API documentation for the Fullstack Authentication System.

## 📋 Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [API Endpoints](#api-endpoints)
  - [Authentication Routes](#authentication-routes)
  - [Health Check Routes](#health-check-routes)
- [Response Schemas](#response-schemas)
- [Status Codes](#status-codes)

---

## 🔍 Overview

**Base URL**: `http://localhost:5000` (development)  
**Content-Type**: `application/json`  
**Authentication**: JWT Bearer Token (where required)

### API Versioning
Currently using API v1 with routes prefixed by `/api/auth` for authentication endpoints.

### Request/Response Format
All requests and responses use JSON format with UTF-8 encoding.

---

## 🔐 Authentication

### JWT Token Authentication
Protected routes require a valid JWT token in the Authorization header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Lifecycle
- **Expiration**: 24 hours (configurable)
- **Refresh**: Manual re-authentication required
- **Storage**: Client-side localStorage (development)

---

## ⚠️ Error Handling

### Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### Common Error Scenarios
- **400 Bad Request**: Invalid request data
- **401 Unauthorized**: Missing or invalid token
- **403 Forbidden**: Insufficient permissions
- **409 Conflict**: Resource already exists
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

---

## 🛡️ Rate Limiting

### Limits by Endpoint
- **Login**: 5 attempts per 15 minutes per IP
- **Register**: 3 attempts per 15 minutes per IP
- **Forgot Password**: 3 attempts per hour per IP
- **Reset Password**: 5 attempts per hour per IP
- **General API**: 100 requests per 15 minutes per IP

### Rate Limit Headers
```http
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 1234567890
```

---

## 🚀 API Endpoints

### Authentication Routes

#### POST `/api/auth/register`
Register a new user account.

**Request:**
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "fullName": "John Doe"
}
```

**Validation Rules:**
- `email`: Valid email format, unique
- `password`: Min 8 chars, 1 uppercase, 1 lowercase, 1 number
- `fullName`: 2-50 characters, letters and spaces only

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "John Doe",
      "emailVerified": false
    }
  },
  "message": "Registration successful"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "User with this email already exists"
}
```

---

#### POST `/api/auth/login`
Authenticate user credentials.

**Request:**
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "John Doe",
      "emailVerified": true
    }
  },
  "message": "Login successful"
}
```

**Error Response (401):**
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

---

#### POST `/api/auth/forgot-password`
Request password reset email.

**Request:**
```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Password reset instructions sent to your email"
}
```

**Note**: Returns success even for non-existent emails (security measure).

---

#### POST `/api/auth/reset-password`
Reset password using reset token.

**Request:**
```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePass123!"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Password reset successful"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Invalid or expired reset token"
}
```

---

#### GET `/api/auth/validate`
Validate JWT token (Protected Route).

**Request:**
```http
GET /api/auth/validate
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "John Doe"
    }
  }
}
```

---

#### POST `/api/auth/logout`
Logout user (Protected Route).

**Request:**
```http
POST /api/auth/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### Health Check Routes

#### GET `/health`
Application health status.

**Request:**
```http
GET /health
```

**Success Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2025-08-02T16:21:03.608Z",
  "uptime": 47384.825858186,
  "environment": "development",
  "version": "2.0.0",
  "database": {
    "status": "healthy",
    "connected": true,
    "responseTime": "53ms",
    "poolInfo": {
      "totalCount": 1,
      "idleCount": 0,
      "waitingCount": 0
    }
  }
}
```

---

#### GET `/health/database`
Database-specific health check.

**Request:**
```http
GET /health/database
```

**Success Response (200):**
```json
{
  "status": "healthy",
  "connected": true,
  "responseTime": "45ms",
  "timestamp": "2025-08-02T16:21:03.608Z"
}
```

**Error Response (503):**
```json
{
  "status": "unhealthy",
  "connected": false,
  "error": "Connection timeout",
  "timestamp": "2025-08-02T16:21:03.608Z"
}
```

---

## 📊 Response Schemas

### User Object
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe",
  "emailVerified": false
}
```

### Success Response
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "fieldName",
      "message": "Field-specific error"
    }
  ]
}
```

### JWT Token Payload
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

## 📋 Status Codes

### Success Codes
- **200 OK**: Request successful
- **201 Created**: Resource created successfully

### Client Error Codes
- **400 Bad Request**: Invalid request data
- **401 Unauthorized**: Authentication required
- **403 Forbidden**: Access denied
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource conflict
- **422 Unprocessable Entity**: Validation error
- **429 Too Many Requests**: Rate limit exceeded

### Server Error Codes
- **500 Internal Server Error**: Server error
- **503 Service Unavailable**: Service temporarily unavailable

---

## 🧪 Testing the API

### Using cURL

#### Register a new user:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!",
    "fullName": "Test User"
  }'
```

#### Login:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!"
  }'
```

#### Check health:
```bash
curl http://localhost:5000/health
```

### Using Postman
1. Import the API collection
2. Set environment variables:
   - `baseUrl`: `http://localhost:5000`
   - `token`: `<JWT_TOKEN_FROM_LOGIN>`

---

## 🔧 Development Notes

### Adding New Endpoints
1. Create route in `/src/routes/`
2. Add controller method in `/src/controllers/`
3. Add validation middleware if needed
4. Update this documentation
5. Add tests in `/src/__tests__/`

### Authentication Middleware
```javascript
// Protect routes with authentication
import { authenticate } from '../middleware/auth';

router.get('/protected', authenticate, controller.method);
```

### Validation Middleware
```javascript
// Add request validation
import { body, validationResult } from 'express-validator';

const validateRegistration = [
  body('email').isEmail(),
  body('password').isLength({ min: 8 }),
  // ... other validations
];

router.post('/register', validateRegistration, controller.register);
```

---

## 📞 Support

For API support and questions:
- Check [troubleshooting guide](./README.md#troubleshooting)
- Review error messages and status codes
- Contact development team

---

*Last updated: August 2025*  
*API Version: 1.0*