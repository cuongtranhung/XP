# Multi-User Form Builder - API Documentation

## 🌐 Overview

This document describes the API changes and new endpoints for the multi-user Form Builder system. All endpoints now support multi-user access with proper permission controls.

## 🔐 Authentication

All API requests require authentication unless explicitly stated as public.

```bash
# Header format
Authorization: Bearer <jwt_token>

# Example request
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
     https://api.formbuilder.com/api/forms
```

## 📋 Forms API

### List Forms
**GET** `/api/forms`

**Description**: Get all forms visible to the current user (own forms + published forms from others)

**Query Parameters**:
```typescript
{
  page?: number           // Page number (default: 1)
  limit?: number         // Items per page (1-100, default: 10)
  status?: 'draft' | 'published' | 'archived' | 'all'
  filterOwner?: 'all' | 'mine' | 'others'  // NEW: Filter by ownership
  search?: string        // Search in form names and descriptions
  sort?: string         // Sort field: 'created_at', 'updated_at', 'name', 'status'
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "forms": [
      {
        "id": "form-uuid",
        "name": "Customer Feedback Form",
        "description": "Collect customer feedback",
        "status": "published",
        "ownerId": "owner-uuid",
        "ownerName": "John Doe",           // NEW: Owner display name
        "ownerEmail": "john@company.com",  // NEW: Owner email
        "isOwner": false,                  // NEW: Is current user the owner
        "submissionCount": 127,
        "lastSubmission": "2024-03-15T14:30:00Z",
        "createdAt": "2024-03-01T10:00:00Z",
        "updatedAt": "2024-03-10T16:45:00Z",
        "slug": "customer-feedback-form",
        "version": 1,
        "publicStats": true               // NEW: Whether public stats are enabled
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 15,
      "pages": 2
    },
    "summary": {                        // NEW: Summary statistics
      "totalForms": 15,
      "ownForms": 3,
      "othersForms": 12,
      "publishedForms": 13,
      "draftForms": 2
    }
  }
}
```

### Get Form Details
**GET** `/api/forms/{formId}`

**Description**: Get detailed form information. Anyone can view published forms, only owners can view draft forms.

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "form-uuid",
    "name": "Customer Feedback Form",
    "description": "Collect customer feedback",
    "status": "published",
    "ownerId": "owner-uuid",
    "ownerName": "John Doe",
    "ownerEmail": "john@company.com",
    "isOwner": false,                    // NEW: Permission indicator
    "canEdit": false,                    // NEW: Edit permission
    "canDelete": false,                  // NEW: Delete permission
    "canViewAllSubmissions": false,      // NEW: Submission access level
    "fields": [
      {
        "id": "field-uuid",
        "fieldKey": "customer_name",
        "fieldType": "text",
        "label": "Customer Name",
        "placeholder": "Enter your name",
        "required": true,
        "validation": {},
        "options": null,
        "order": 0
      }
    ],
    "settings": {
      "allowAnonymous": true,
      "requireLogin": false,
      "oneSubmissionPerUser": false,
      "showPublicStats": true,           // NEW: Public stats setting
      "emailNotifications": true
    },
    "statistics": {                      // NEW: Basic stats for all users
      "submissionCount": 127,
      "averageCompletionTime": 225000,   // milliseconds
      "lastSubmissionAt": "2024-03-15T14:30:00Z"
    }
  }
}
```

### Create Form
**POST** `/api/forms`

**Description**: Create a new form. User becomes the owner.

**Rate Limit**: 20 requests per hour per user

**Request Body**:
```json
{
  "name": "Customer Feedback Form",
  "description": "Collect customer feedback",
  "category": "Customer Service",
  "tags": ["feedback", "customer", "survey"],
  "settings": {
    "allowAnonymous": true,
    "requireLogin": false,
    "showPublicStats": true,             // NEW: Enable public statistics
    "oneSubmissionPerUser": false
  },
  "fields": [
    {
      "fieldKey": "customer_name",
      "fieldType": "text", 
      "label": "Customer Name",
      "required": true,
      "placeholder": "Enter your name"
    }
  ]
}
```

### Update Form
**PUT** `/api/forms/{formId}`

**Description**: Update form. Only form owners can update.

**Rate Limit**: 100 requests per hour per user

**Permission**: Form owner only

**Request Body**: Same as create form

### Delete Form
**DELETE** `/api/forms/{formId}`

**Description**: Delete form (soft delete). Only form owners can delete.

**Permission**: Form owner only

### Clone/Duplicate Form
**POST** `/api/forms/{formId}/duplicate`

**Description**: Create a copy of any published form. User becomes owner of the cloned form.

**Rate Limit**: 10 requests per hour per user

**Request Body**:
```json
{
  "name": "My Customer Feedback Form",  // Optional: new name
  "includeSettings": true,              // Copy form settings
  "includeFields": true,                // Copy all fields
  "includeValidation": true             // Copy field validation rules
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "new-form-uuid",
    "name": "My Customer Feedback Form",
    "status": "draft",                    // Cloned forms start as draft
    "ownerId": "current-user-uuid",       // Current user becomes owner
    "originalFormId": "original-form-uuid",
    "clonedAt": "2024-03-15T16:00:00Z",
    "fieldsCloned": 5,
    "message": "Form successfully cloned"
  }
}
```

### Get Form Statistics
**GET** `/api/forms/{formId}/stats`

**Description**: Get detailed form statistics. Only form owners can access.

**Permission**: Form owner only

**Response**:
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalSubmissions": 127,
      "uniqueSubmitters": 89,
      "averageCompletionTime": 225000,
      "completionRate": 0.73,
      "lastSubmissionAt": "2024-03-15T14:30:00Z"
    },
    "trends": {
      "submissionsToday": 12,
      "submissionsThisWeek": 45,
      "submissionsThisMonth": 127,
      "growthRate": 0.15
    },
    "demographics": {
      "loggedUsers": 67,
      "anonymousUsers": 60,
      "returningUsers": 23,
      "newUsers": 104
    },
    "fieldAnalytics": [
      {
        "fieldKey": "customer_rating",
        "completionRate": 0.98,
        "averageValue": 4.2,
        "commonValues": ["5", "4", "3"]
      }
    ]
  }
}
```

### Get Public Form Statistics  
**GET** `/api/forms/{formId}/public-stats`

**Description**: Get public statistics for any published form. No authentication required.

**Rate Limit**: 200 requests per hour per IP

**Response**:
```json
{
  "success": true,
  "data": {
    "formId": "form-uuid",
    "formName": "Customer Feedback Form",
    "ownerName": "John Doe",              // Public owner info
    "createdAt": "2024-03-01T10:00:00Z",
    "publicStats": {
      "totalSubmissions": 127,
      "averageRating": 4.2,               // If form has rating fields
      "averageCompletionTime": 225000,
      "completionRate": 0.73,
      "lastSubmissionAt": "2024-03-15T14:30:00Z"
    },
    "trends": {
      "submissionsLast7Days": [5, 8, 12, 9, 15, 11, 7],
      "submissionsLast30Days": 89,
      "growthTrend": "increasing"
    }
    // NOTE: No personal data, no individual submissions
  }
}
```

## 📝 Form Submissions API

### List Form Submissions
**GET** `/api/forms/{formId}/submissions`

**Description**: Get form submissions with multi-user access control

**Query Parameters**:
```typescript
{
  page?: number
  limit?: number
  sort?: string
  search?: string
  dateFrom?: string    // ISO date string
  dateTo?: string      // ISO date string
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "submissions": [
      {
        "id": "submission-uuid",
        "formId": "form-uuid",
        "submitterId": "user-uuid",
        "submitterName": "Jane Smith",     // Only shown to form owner
        "submitterEmail": "jane@email.com", // Only shown to form owner
        "data": {
          "customer_name": "Jane Smith",
          "rating": 5,
          "feedback": "Great service!"
        },
        "submittedAt": "2024-03-15T14:30:00Z",
        "ipAddress": "192.168.1.1",        // Only shown to form owner
        "userAgent": "Mozilla/5.0..."      // Only shown to form owner
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 127,
      "pages": 7
    },
    "accessInfo": {                        // NEW: Access information
      "isOwner": false,
      "accessType": "limited",             // "full" or "limited"
      "visibleSubmissions": 2,             // Number user can see
      "totalSubmissions": 127,             // Total in form
      "filterApplied": "own_submissions"   // Filter applied for non-owners
    }
  }
}
```

### Create Form Submission
**POST** `/api/forms/{formId}/submissions`

**Description**: Submit data to any published form

**Rate Limit**: 50 requests per hour per IP

**Request Body**:
```json
{
  "data": {
    "customer_name": "Jane Smith",
    "rating": 5,
    "feedback": "Great service!"
  }
}
```

### Get Single Submission
**GET** `/api/forms/{formId}/submissions/{submissionId}`

**Description**: Get single submission details

**Permission Rules**:
- Form owners can view any submission
- Other users can only view their own submissions

### Update Submission
**PUT** `/api/forms/{formId}/submissions/{submissionId}`

**Description**: Update existing submission

**Permission Rules**:
- Form owners can update any submission
- Other users can only update their own submissions (if allowed by form settings)

### Delete Submission
**DELETE** `/api/forms/{formId}/submissions/{submissionId}`

**Description**: Delete submission

**Permission Rules**:
- Form owners can delete any submission  
- Other users can delete their own submissions (if allowed by form settings)

## 🔒 Security Headers

All responses include security headers:

```http
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 15
X-RateLimit-Reset: 1647360000
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
```

## 🚫 Error Responses

### Standard Error Format
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": "Additional error details (optional)"
  }
}
```

### Common Error Codes

**Authentication Errors**
- `UNAUTHORIZED` (401): Missing or invalid token
- `FORBIDDEN` (403): Insufficient permissions
- `TOKEN_EXPIRED` (401): JWT token expired

**Permission Errors**
- `NOT_FORM_OWNER` (403): Only form owner can perform this action
- `FORM_NOT_FOUND` (404): Form doesn't exist or no access
- `SUBMISSION_ACCESS_DENIED` (403): Cannot access this submission

**Rate Limiting Errors**
- `RATE_LIMIT_EXCEEDED` (429): Too many requests
- `DAILY_LIMIT_EXCEEDED` (429): Daily usage limit reached

**Validation Errors**
- `INVALID_INPUT` (400): Request validation failed
- `INVALID_CONTENT` (400): Content contains malicious patterns
- `FILE_TOO_LARGE` (400): Uploaded file exceeds size limit
- `INVALID_FILE_TYPE` (400): File type not allowed

**Security Errors**
- `CONTENT_SECURITY_VIOLATION` (400): Content blocked by security filters
- `SUSPICIOUS_ACTIVITY` (429): Request flagged as suspicious

## 📊 Rate Limits Summary

| Operation | Limit | Window | Scope |
|-----------|-------|---------|-------|
| Form Creation | 20 | 1 hour | Per user |
| Form Updates | 100 | 1 hour | Per user |
| Form Cloning | 10 | 1 hour | Per user |
| Form Submissions | 50 | 1 hour | Per IP |
| Data Export | 5 | 1 hour | Per user |
| Public Stats | 200 | 1 hour | Per IP |
| General API | 100 | 15 minutes | Per IP |

## 🔄 Migration Notes

### Breaking Changes from Single-User API

1. **Form List Response**: Added ownership fields (`ownerId`, `ownerName`, `isOwner`)
2. **Submission Access**: Non-owners only see their own submissions
3. **New Endpoints**: Public stats, form cloning
4. **Rate Limiting**: New limits applied per operation type
5. **Security Headers**: Enhanced security response headers

### Backward Compatibility

- Existing API endpoints maintain same URLs
- Response structure extended (not changed)
- Authentication flow unchanged
- Form creation/update process unchanged for owners

### Client Updates Required

```javascript
// OLD: Assume user sees all submissions
const submissions = await api.get(`/forms/${formId}/submissions`);

// NEW: Check access level
const response = await api.get(`/forms/${formId}/submissions`);
const { submissions, accessInfo } = response.data;

if (accessInfo.accessType === 'limited') {
  console.log('You can only see your own submissions');
}
```

## 🧪 Testing the API

### Authentication Test
```bash
# Get auth token
curl -X POST https://api.formbuilder.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"password"}'

# Use token in subsequent requests
curl -H "Authorization: Bearer <token>" \
  https://api.formbuilder.com/api/forms
```

### Multi-User Workflow Test
```bash
# 1. User A creates form
curl -X POST https://api.formbuilder.com/api/forms \
  -H "Authorization: Bearer <token_a>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Form","status":"published"}'

# 2. User B sees the form
curl -H "Authorization: Bearer <token_b>" \
  https://api.formbuilder.com/api/forms

# 3. User B submits to form
curl -X POST https://api.formbuilder.com/api/forms/<form_id>/submissions \
  -H "Authorization: Bearer <token_b>" \
  -H "Content-Type: application/json" \
  -d '{"data":{"name":"User B","rating":5}}'

# 4. User A sees all submissions, User B sees only their own
curl -H "Authorization: Bearer <token_a>" \
  https://api.formbuilder.com/api/forms/<form_id>/submissions

curl -H "Authorization: Bearer <token_b>" \
  https://api.formbuilder.com/api/forms/<form_id>/submissions
```

## 📚 SDKs and Libraries

### JavaScript/Node.js
```javascript
const FormBuilderAPI = require('@formbuilder/sdk');

const api = new FormBuilderAPI({
  baseURL: 'https://api.formbuilder.com',
  apiKey: 'your-api-key'
});

// List all forms (including multi-user)
const forms = await api.forms.list({
  filterOwner: 'all',  // 'all', 'mine', 'others'
  status: 'published'
});

// Clone a form
const clonedForm = await api.forms.clone(formId, {
  name: 'My Cloned Form'
});

// Get submissions with access control
const submissions = await api.submissions.list(formId);
console.log(`Access type: ${submissions.accessInfo.accessType}`);
```

### Python
```python
from formbuilder_sdk import FormBuilderClient

client = FormBuilderClient(
    base_url='https://api.formbuilder.com',
    api_key='your-api-key'
)

# List forms with ownership filter
forms = client.forms.list(filter_owner='all')

# Clone form
cloned_form = client.forms.clone(form_id, name='My Cloned Form')

# Get submissions with access level
submissions = client.submissions.list(form_id)
print(f"Access type: {submissions['accessInfo']['accessType']}")
```

---

🔗 **API Base URL**: `https://api.formbuilder.com`  
📧 **API Support**: api-support@formbuilder.com  
📖 **Interactive Docs**: https://api.formbuilder.com/docs