# Security Features - Multi-User Form Builder

## Overview
This document outlines the security measures implemented to protect the multi-user form builder system from common threats and ensure data privacy.

## 🔒 Rate Limiting

### Form Operations
- **Form Creation**: 20 forms per hour per user
- **Form Updates**: 100 updates per hour per user  
- **Form Cloning**: 10 clones per hour per user
- **Form Submission**: 50 submissions per hour per IP
- **Data Export**: 5 exports per hour per user
- **Bulk Operations**: 10 operations per hour per user

### Public Access
- **Public Statistics**: 200 requests per hour per IP
- **General API**: 100 requests per 15 minutes per IP

### Authentication
- **Login Attempts**: 5 attempts per 15 minutes per IP
- **Registration**: 3 attempts per hour per IP
- **Password Reset**: 3 requests per hour per IP

## 🛡️ Content Security

### XSS Prevention
- Automatic detection of malicious script patterns
- Sanitization of form fields, descriptions, and options
- Validation of submission content
- CSP headers to prevent inline scripts

### Protected Patterns
```javascript
/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi
/javascript:/gi
/on\w+\s*=/gi
/data:text\/html/gi
/<iframe/gi
/<object/gi
/<embed/gi
```

## 📁 File Upload Security

### Allowed File Types
- CSV files (text/csv)
- Excel files (.xlsx, .xls)
- JSON files (application/json)
- Plain text files (text/plain)

### Restrictions
- Maximum file size: 10MB
- Blocked extensions: .exe, .bat, .cmd, .scr, .pif, .jar, .js, .php, .asp, .jsp
- MIME type validation
- Filename sanitization

## 🌐 CORS & Headers

### CORS Configuration
```javascript
{
  origin: [configured-domains],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Origin', 'Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['X-RateLimit-*']
}
```

### Security Headers
- **HSTS**: Force HTTPS with 1-year max-age
- **Content-Security-Policy**: Strict CSP rules
- **X-Frame-Options**: Prevent clickjacking
- **X-Content-Type-Options**: Prevent MIME sniffing
- **X-XSS-Protection**: Enable XSS filtering

## 🚨 Threat Detection

### Bot Protection
Detection patterns for:
- Web scrapers
- Automated tools
- Suspicious user agents
- High-frequency requests

### IP Monitoring
- Suspicious request patterns
- Geolocation anomalies
- Rate limit violations
- Failed authentication attempts

## 📊 Access Control

### Form Access Levels
1. **Form Owner**
   - Full CRUD operations
   - View all submissions
   - Export data
   - Clone forms
   - Delete forms

2. **Other Users**
   - View published forms only
   - Submit to forms
   - View own submissions
   - Clone published forms

3. **Anonymous Users**
   - View public form statistics
   - Submit to published forms (if allowed)

### Multi-User Security Model
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Form Owner    │    │   Other User    │    │ Anonymous User  │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • All forms     │    │ • Published     │    │ • Public stats  │
│ • All subs      │    │   forms only    │    │ • Submit forms  │
│ • Export data   │    │ • Own subs only │    │   (if allowed)  │
│ • Clone any     │    │ • Clone pub     │    │                 │
│ • Delete own    │    │   forms         │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔍 Security Logging

### Logged Events
- Form creation/updates/deletion
- Suspicious user agents
- Rate limit violations
- File upload attempts
- Authentication failures
- IP whitelist violations
- Content security violations

### Log Format
```json
{
  "timestamp": "2024-01-15T10:00:00Z",
  "level": "warn",
  "event": "rate_limit_exceeded",
  "userId": "uuid",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "details": {
    "endpoint": "/api/forms",
    "limit": 20,
    "current": 21
  }
}
```

## ⚙️ Configuration

### Environment Variables
```bash
# Rate Limiting
FORM_CREATION_RATE_LIMIT=20
FORM_SUBMISSION_RATE_LIMIT=50
PUBLIC_STATS_RATE_LIMIT=200

# Security
MAX_REQUEST_SIZE=10485760
SESSION_SECRET=your-secure-secret
FRONTEND_URL=http://localhost:3000

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=text/csv,application/json

# IP Whitelist (optional)
ADMIN_IP_WHITELIST=192.168.1.1,10.0.0.1
```

## 🔧 Implementation Details

### Middleware Stack
1. **Rate Limiting** - Applied per endpoint
2. **Authentication** - JWT/Session validation
3. **Content Validation** - XSS/injection prevention  
4. **File Validation** - Type/size checking
5. **Security Headers** - Helmet configuration
6. **CORS** - Origin validation
7. **Logging** - Security event tracking

### Database Security
- Parameterized queries (SQL injection prevention)
- Connection pooling limits
- Transaction isolation
- Soft deletes for data recovery

## 📈 Monitoring & Alerts

### Metrics to Monitor
- Rate limit hit rates
- Failed authentication attempts
- Suspicious file uploads
- XSS attempt frequency
- Bot traffic patterns

### Alert Thresholds
- Rate limit violations > 100/hour
- Failed logins > 50/hour per IP
- File upload rejections > 10/hour
- XSS attempts > 5/hour

## 🚀 Best Practices

### For Developers
1. Always validate input on both client and server
2. Use parameterized queries for database operations
3. Implement proper error handling without exposing system details
4. Log security events for monitoring
5. Regular security dependency updates

### For Administrators  
1. Monitor security logs regularly
2. Adjust rate limits based on usage patterns
3. Keep whitelist/blacklist updated
4. Regular security audits
5. Backup and disaster recovery plans

### For Users
1. Use strong passwords
2. Don't share form edit links publicly
3. Review form submissions regularly
4. Report suspicious activity
5. Keep browser updated

## 🔄 Updates & Maintenance

### Regular Tasks
- [ ] Weekly security log review
- [ ] Monthly rate limit adjustment
- [ ] Quarterly security audit
- [ ] Annual penetration testing
- [ ] Dependency updates (as needed)

### Security Patches
- Critical: Deploy within 24 hours
- High: Deploy within 1 week
- Medium: Deploy within 1 month
- Low: Deploy in next release cycle