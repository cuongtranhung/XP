# Dynamic Form Builder - API Documentation

## Overview

The Dynamic Form Builder API provides RESTful endpoints for creating, managing, and analyzing forms and submissions. All API requests should be made to:

```
Base URL: https://your-domain.com/api
```

## Authentication

Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

## Rate Limiting

- **Authenticated requests**: 1000 requests/hour
- **Public endpoints**: 100 requests/hour per IP
- **File uploads**: 50 requests/hour

Rate limit headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Forms API

### Create Form
Create a new form.

```http
POST /forms
```

**Request Body:**
```json
{
  "title": "Contact Form",
  "description": "Get in touch with us",
  "fields": [
    {
      "type": "text",
      "label": "Name",
      "key": "name",
      "required": true,
      "position": 0,
      "validation": {
        "minLength": 2,
        "maxLength": 50
      }
    }
  ],
  "settings": {
    "submitButtonText": "Submit",
    "successMessage": "Thank you!",
    "allowMultipleSubmissions": true,
    "requireAuthentication": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Contact Form",
    "status": "draft",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

### Get Forms
Retrieve user's forms with pagination.

```http
GET /forms?page=1&limit=20&search=contact&status=active
```

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `search` (string): Search in title and description
- `status` (string): Filter by status (draft, active, inactive)
- `sort` (string): Sort field (createdAt, updatedAt, title)
- `order` (string): Sort order (asc, desc)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Contact Form",
      "description": "Get in touch with us",
      "status": "active",
      "submissionCount": 42,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-15T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

### Get Form
Retrieve a specific form.

```http
GET /forms/{formId}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Contact Form",
    "description": "Get in touch with us",
    "fields": [...],
    "settings": {...},
    "status": "active",
    "publishedAt": "2024-01-10T00:00:00Z",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-15T00:00:00Z"
  }
}
```

### Update Form
Update form properties.

```http
PUT /forms/{formId}
```

**Request Body:**
```json
{
  "title": "Updated Contact Form",
  "fields": [...],
  "settings": {...}
}
```

### Delete Form
Delete a form and all its submissions.

```http
DELETE /forms/{formId}
```

### Publish Form
Change form status to active.

```http
POST /forms/{formId}/publish
```

### Unpublish Form
Change form status to inactive.

```http
POST /forms/{formId}/unpublish
```

### Duplicate Form
Create a copy of an existing form.

```http
POST /forms/{formId}/duplicate
```

### Get Form Statistics
Retrieve form analytics.

```http
GET /forms/{formId}/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSubmissions": 150,
    "uniqueSubmitters": 120,
    "averageCompletionTime": 180,
    "completionRate": 0.85,
    "lastSubmissionAt": "2024-01-20T10:30:00Z",
    "fieldStats": {
      "name": {
        "filled": 150,
        "skipped": 0
      }
    }
  }
}
```

## Submissions API

### Submit Form (Public)
Submit data to a form.

```http
POST /forms/{formId}/submit
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "message": "Hello world"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "message": "Thank you for your submission!"
  }
}
```

### Submit with File Upload
Use multipart/form-data for file uploads.

```http
POST /forms/{formId}/submit
Content-Type: multipart/form-data
```

**Form Data:**
- `name`: John Doe
- `email`: john@example.com
- `resume`: [file]

### Get Submissions
Retrieve form submissions.

```http
GET /forms/{formId}/submissions?page=1&limit=50&dateFrom=2024-01-01&dateTo=2024-01-31
```

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page (max: 100)
- `dateFrom` (date): Filter start date
- `dateTo` (date): Filter end date
- `search` (string): Search in submission data

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "formId": "550e8400-e29b-41d4-a716-446655440000",
      "data": {
        "name": "John Doe",
        "email": "john@example.com"
      },
      "submittedAt": "2024-01-15T10:30:00Z",
      "submittedBy": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "pages": 3
  }
}
```

### Get Submission
Retrieve a specific submission.

```http
GET /forms/{formId}/submissions/{submissionId}
```

### Update Submission
Update submission data.

```http
PUT /forms/{formId}/submissions/{submissionId}
```

### Delete Submission
Delete a submission.

```http
DELETE /forms/{formId}/submissions/{submissionId}
```

### Export Submissions
Export submissions in various formats.

```http
GET /forms/{formId}/submissions/export?format=csv&dateFrom=2024-01-01&dateTo=2024-01-31
```

**Query Parameters:**
- `format` (string): Export format (csv, excel, json)
- `dateFrom` (date): Filter start date
- `dateTo` (date): Filter end date
- `fields` (array): Specific fields to export

### Get Submission Analytics
Retrieve detailed analytics.

```http
GET /forms/{formId}/submissions/analytics
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSubmissions": 1500,
    "submissionsToday": 45,
    "submissionsThisWeek": 320,
    "submissionsThisMonth": 1200,
    "averagePerDay": 50,
    "completionRate": 0.85,
    "peakHours": [
      {"hour": 14, "count": 230},
      {"hour": 15, "count": 210}
    ],
    "deviceBreakdown": {
      "desktop": 900,
      "mobile": 500,
      "tablet": 100
    }
  }
}
```

## WebSocket API

### Connection
Connect to WebSocket server for real-time collaboration.

```javascript
const socket = io('wss://your-domain.com', {
  auth: {
    token: 'YOUR_JWT_TOKEN'
  }
});
```

### Events

#### Client to Server

**Join Form Room**
```javascript
socket.emit('form:join', formId);
```

**Leave Form Room**
```javascript
socket.emit('form:leave', formId);
```

**Update Form**
```javascript
socket.emit('form:update', {
  formId: 'form-id',
  updates: { title: 'New Title' }
});
```

**Add Field**
```javascript
socket.emit('form:field:add', {
  formId: 'form-id',
  field: { type: 'text', label: 'Name' },
  position: 0
});
```

**Update Field**
```javascript
socket.emit('form:field:update', {
  formId: 'form-id',
  fieldId: 'field-id',
  updates: { label: 'Full Name', required: true }
});
```

**Delete Field**
```javascript
socket.emit('form:field:delete', {
  formId: 'form-id',
  fieldId: 'field-id'
});
```

**Reorder Fields**
```javascript
socket.emit('form:field:reorder', {
  formId: 'form-id',
  fromIndex: 0,
  toIndex: 2
});
```

**Cursor Movement**
```javascript
socket.emit('form:cursor:move', {
  formId: 'form-id',
  x: 100,
  y: 200
});
```

#### Server to Client

**Collaborators List**
```javascript
socket.on('form:collaborators', (data) => {
  // data.collaborators: Array of active users
  // data.locked: Boolean
  // data.lockedBy: User ID if locked
});
```

**Collaborator Joined**
```javascript
socket.on('collaborator:joined', (data) => {
  // data.userId, data.userName, data.color
});
```

**Field Added**
```javascript
socket.on('form:field:added', (data) => {
  // data.field, data.position, data.addedBy
});
```

**Conflict Notification**
```javascript
socket.on('form:conflict', (data) => {
  // data.message, data.operation
});
```

## Webhook Integration

### Webhook Payload
When configured, form submissions trigger webhooks:

```json
{
  "event": "form.submitted",
  "timestamp": "2024-01-15T10:30:00Z",
  "form": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Contact Form"
  },
  "submission": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "data": {
      "name": "John Doe",
      "email": "john@example.com"
    },
    "submittedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Webhook Security
- Verify webhook signatures using HMAC-SHA256
- Retry failed webhooks up to 3 times
- Exponential backoff: 1s, 5s, 30s

### Webhook Headers
```
X-Webhook-Signature: sha256=...
X-Webhook-Event: form.submitted
X-Webhook-Timestamp: 1705315800
```

## Error Responses

### Standard Error Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

### Error Codes
- `UNAUTHORIZED`: Missing or invalid authentication
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Input validation failed
- `RATE_LIMITED`: Too many requests
- `SERVER_ERROR`: Internal server error

### HTTP Status Codes
- `200 OK`: Successful request
- `201 Created`: Resource created
- `400 Bad Request`: Invalid input
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Access denied
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict
- `429 Too Many Requests`: Rate limited
- `500 Internal Server Error`: Server error

## SDK Examples

### JavaScript/TypeScript
```typescript
import { FormBuilderClient } from '@xp/form-builder-sdk';

const client = new FormBuilderClient({
  apiKey: 'YOUR_API_KEY',
  baseUrl: 'https://your-domain.com/api'
});

// Create form
const form = await client.forms.create({
  title: 'Contact Form',
  fields: [...]
});

// Submit to form
const submission = await client.submissions.create(form.id, {
  name: 'John Doe',
  email: 'john@example.com'
});
```

### Python
```python
from xp_form_builder import FormBuilderClient

client = FormBuilderClient(
    api_key='YOUR_API_KEY',
    base_url='https://your-domain.com/api'
)

# Create form
form = client.forms.create({
    'title': 'Contact Form',
    'fields': [...]
})

# Get submissions
submissions = client.submissions.list(
    form_id=form['id'],
    page=1,
    limit=50
)
```

### cURL
```bash
# Create form
curl -X POST https://your-domain.com/api/forms \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Contact Form",
    "fields": [...]
  }'

# Export submissions
curl -X GET "https://your-domain.com/api/forms/{formId}/submissions/export?format=csv" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -o submissions.csv
```