# 🚀 Dynamic Form Builder - API Specifications

## 📋 Table of Contents
- [Overview](#overview)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
- [Request/Response Formats](#requestresponse-formats)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Webhooks](#webhooks)
- [WebSocket Events](#websocket-events)

---

## Overview

The Dynamic Form Builder API provides comprehensive endpoints for creating, managing, and analyzing forms with advanced features including conditional logic, multi-step forms, and real-time collaboration.

### Base URLs
- **Production**: `https://api.formbuilder.com/v1`
- **Staging**: `https://staging-api.formbuilder.com/v1`
- **Development**: `http://localhost:5000/api/v1`

### API Versioning
- Current Version: `v1`
- Version Header: `X-API-Version: 1.0`
- Deprecation Policy: 6 months notice with `Sunset` header

---

## Authentication

### JWT Authentication
```http
Authorization: Bearer {jwt_token}
```

### API Key Authentication
```http
X-API-Key: {api_key}
```

### OAuth 2.0
```http
Authorization: Bearer {oauth_token}
```

---

## API Endpoints

### Form Management

#### List Forms
```http
GET /forms
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | integer | 1 | Page number |
| limit | integer | 20 | Items per page (max 100) |
| status | string | all | Filter by status (draft, published, archived) |
| search | string | - | Search in name and description |
| tags | array | - | Filter by tags |
| category | string | - | Filter by category |
| sort | string | -created_at | Sort field and direction |
| owner_id | uuid | - | Filter by owner |
| team_id | uuid | - | Filter by team |

**Response:**
```json
{
  "success": true,
  "data": {
    "forms": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "slug": "customer-feedback-2024",
        "name": "Customer Feedback Form",
        "description": "Collect customer feedback and satisfaction ratings",
        "status": "published",
        "version": 2,
        "category": "survey",
        "tags": ["feedback", "customer", "nps"],
        "visibility": "public",
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-16T14:20:00Z",
        "published_at": "2024-01-16T14:20:00Z",
        "owner": {
          "id": "user-123",
          "name": "John Doe",
          "email": "john@company.com"
        },
        "team": {
          "id": "team-456",
          "name": "Marketing Team"
        },
        "statistics": {
          "views": 1250,
          "submissions": 342,
          "conversion_rate": 27.36,
          "avg_completion_time": 180
        },
        "settings": {
          "multi_page": true,
          "save_progress": true,
          "require_auth": false,
          "notifications": {
            "email": ["admin@company.com"],
            "webhook": ["https://api.company.com/form-webhook"]
          }
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "pages": 8,
      "has_next": true,
      "has_prev": false
    },
    "filters_applied": {
      "status": "published",
      "tags": ["feedback"]
    }
  }
}
```

#### Create Form
```http
POST /forms
```

**Request Body:**
```json
{
  "name": "Employee Onboarding Form",
  "description": "New employee information and document collection",
  "category": "hr",
  "tags": ["onboarding", "hr", "employee"],
  "team_id": "team-789",
  "settings": {
    "theme": "modern",
    "multi_page": true,
    "progress_bar": {
      "enabled": true,
      "type": "steps"
    },
    "save_progress": {
      "enabled": true,
      "auto_save": true,
      "interval": 30
    },
    "notifications": {
      "email": {
        "recipients": ["hr@company.com"],
        "on_submission": true,
        "include_data": true
      },
      "webhook": {
        "url": "https://api.company.com/webhooks/form-submission",
        "method": "POST",
        "headers": {
          "X-Custom-Header": "value"
        },
        "retry": {
          "enabled": true,
          "max_attempts": 3,
          "backoff_multiplier": 2
        }
      }
    },
    "confirmation": {
      "type": "message",
      "title": "Thank you!",
      "message": "Your onboarding information has been submitted successfully.",
      "redirect_url": null,
      "redirect_delay": null
    },
    "security": {
      "captcha": true,
      "honeypot": true,
      "csrf_protection": true,
      "allowed_domains": ["company.com"],
      "ip_rate_limit": {
        "enabled": true,
        "max_attempts": 5,
        "window_minutes": 15
      }
    },
    "scheduling": {
      "start_date": "2024-02-01T00:00:00Z",
      "end_date": null,
      "timezone": "America/New_York"
    },
    "quotas": {
      "max_submissions": 1000,
      "max_per_user": 1
    }
  },
  "fields": [
    {
      "field_key": "personal_info_section",
      "field_type": "section",
      "label": "Personal Information",
      "position": 0
    },
    {
      "field_key": "full_name",
      "field_type": "text",
      "label": "Full Name",
      "placeholder": "Enter your full name",
      "position": 1,
      "required": true,
      "validation": {
        "min_length": 2,
        "max_length": 100,
        "pattern": "^[a-zA-Z\\s]+$",
        "messages": {
          "required": "Full name is required",
          "pattern": "Please enter a valid name (letters and spaces only)"
        }
      }
    },
    {
      "field_key": "email",
      "field_type": "email",
      "label": "Email Address",
      "placeholder": "your.email@company.com",
      "position": 2,
      "required": true,
      "validation": {
        "pattern": "^[^@]+@company\\.com$",
        "messages": {
          "pattern": "Please use your company email address"
        }
      }
    },
    {
      "field_key": "department",
      "field_type": "select",
      "label": "Department",
      "placeholder": "Select your department",
      "position": 3,
      "required": true,
      "options": [
        {"label": "Engineering", "value": "engineering"},
        {"label": "Marketing", "value": "marketing"},
        {"label": "Sales", "value": "sales"},
        {"label": "HR", "value": "hr"},
        {"label": "Finance", "value": "finance"}
      ],
      "conditional_logic": {
        "rules": [
          {
            "conditions": [
              {
                "field": "department",
                "operator": "equals",
                "value": "engineering"
              }
            ],
            "actions": [
              {
                "type": "show",
                "target": "programming_languages"
              }
            ]
          }
        ]
      }
    },
    {
      "field_key": "programming_languages",
      "field_type": "checkbox_group",
      "label": "Programming Languages",
      "position": 4,
      "hidden": true,
      "options": [
        {"label": "JavaScript", "value": "js"},
        {"label": "Python", "value": "python"},
        {"label": "Java", "value": "java"},
        {"label": "Go", "value": "go"},
        {"label": "Rust", "value": "rust"}
      ]
    },
    {
      "field_key": "start_date",
      "field_type": "date",
      "label": "Start Date",
      "position": 5,
      "required": true,
      "validation": {
        "min": "2024-02-01",
        "max": "2024-12-31",
        "messages": {
          "min": "Start date cannot be before February 1, 2024",
          "max": "Start date must be within 2024"
        }
      }
    },
    {
      "field_key": "documents_section",
      "field_type": "section",
      "label": "Required Documents",
      "position": 6
    },
    {
      "field_key": "resume",
      "field_type": "file",
      "label": "Resume/CV",
      "position": 7,
      "required": true,
      "validation": {
        "max_size": 5242880,
        "allowed_types": ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        "messages": {
          "max_size": "File size must not exceed 5MB",
          "allowed_types": "Only PDF and Word documents are allowed"
        }
      }
    }
  ],
  "steps": [
    {
      "title": "Personal Information",
      "description": "Basic information about you",
      "fields": ["personal_info_section", "full_name", "email", "department", "programming_languages", "start_date"]
    },
    {
      "title": "Documents",
      "description": "Upload required documents",
      "fields": ["documents_section", "resume"]
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "slug": "employee-onboarding-form-1705320600",
    "name": "Employee Onboarding Form",
    "status": "draft",
    "version": 1,
    "share_url": "https://forms.company.com/s/employee-onboarding-form-1705320600",
    "edit_url": "https://app.company.com/forms/660e8400-e29b-41d4-a716-446655440000/edit",
    "preview_url": "https://app.company.com/forms/660e8400-e29b-41d4-a716-446655440000/preview",
    "created_at": "2024-01-15T12:30:00Z",
    "fields": [...],
    "steps": [...]
  }
}
```

#### Get Form Details
```http
GET /forms/{form_id}
```

**Path Parameters:**
- `form_id` (uuid) - Form ID or slug

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| include | array | - | Include related data (fields, steps, webhooks, analytics) |
| version | integer | latest | Specific form version |

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Customer Feedback Form",
    "fields": [...],
    "steps": [...],
    "webhooks": [...],
    "analytics_summary": {
      "total_views": 5420,
      "unique_visitors": 3210,
      "total_submissions": 892,
      "conversion_rate": 27.79,
      "avg_completion_time": 240,
      "abandonment_rate": 15.3,
      "last_submission": "2024-01-16T18:45:00Z"
    }
  }
}
```

#### Update Form
```http
PUT /forms/{form_id}
```

**Request Body:**
```json
{
  "name": "Updated Customer Feedback Form",
  "description": "New description",
  "settings": {
    "theme": "dark"
  },
  "increment_version": false
}
```

#### Delete Form
```http
DELETE /forms/{form_id}
```

**Query Parameters:**
- `permanent` (boolean) - Permanently delete instead of soft delete

#### Duplicate Form
```http
POST /forms/{form_id}/duplicate
```

**Request Body:**
```json
{
  "name": "Copy of Customer Feedback Form",
  "team_id": "team-123",
  "include_submissions": false,
  "include_webhooks": true
}
```

#### Publish Form
```http
POST /forms/{form_id}/publish
```

**Request Body:**
```json
{
  "version_note": "Added new satisfaction rating field",
  "notify_collaborators": true
}
```

### Field Management

#### List Form Fields
```http
GET /forms/{form_id}/fields
```

**Query Parameters:**
- `step_id` (uuid) - Filter by step
- `include_hidden` (boolean) - Include hidden fields

#### Add Field
```http
POST /forms/{form_id}/fields
```

**Request Body:**
```json
{
  "field_key": "satisfaction_rating",
  "field_type": "rating",
  "label": "How satisfied are you?",
  "position": 10,
  "step_id": "step-123",
  "required": true,
  "options": {
    "max": 5,
    "show_labels": true,
    "labels": {
      "1": "Very Dissatisfied",
      "5": "Very Satisfied"
    }
  }
}
```

#### Update Field
```http
PUT /forms/{form_id}/fields/{field_id}
```

#### Delete Field
```http
DELETE /forms/{form_id}/fields/{field_id}
```

#### Reorder Fields
```http
POST /forms/{form_id}/fields/reorder
```

**Request Body:**
```json
{
  "field_orders": [
    {"field_id": "field-1", "position": 0},
    {"field_id": "field-2", "position": 1},
    {"field_id": "field-3", "position": 2}
  ]
}
```

#### Bulk Field Operations
```http
POST /forms/{form_id}/fields/bulk
```

**Request Body:**
```json
{
  "operations": [
    {
      "type": "create",
      "data": {
        "field_key": "new_field",
        "field_type": "text",
        "label": "New Field"
      }
    },
    {
      "type": "update",
      "field_id": "field-123",
      "data": {
        "label": "Updated Label"
      }
    },
    {
      "type": "delete",
      "field_id": "field-456"
    }
  ]
}
```

### Form Submissions

#### Submit Form
```http
POST /forms/{form_id}/submissions
```

**Request Body:**
```json
{
  "data": {
    "full_name": "John Doe",
    "email": "john.doe@company.com",
    "department": "engineering",
    "programming_languages": ["js", "python"],
    "start_date": "2024-03-01",
    "satisfaction_rating": 5
  },
  "metadata": {
    "source": "web",
    "referrer": "https://company.com/careers",
    "device": {
      "type": "desktop",
      "browser": "Chrome 120",
      "os": "Windows 11"
    }
  },
  "partial": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "sub-789",
    "form_id": "550e8400-e29b-41d4-a716-446655440000",
    "submission_number": 893,
    "status": "completed",
    "submitted_at": "2024-01-16T19:30:00Z",
    "confirmation": {
      "message": "Thank you for your feedback!",
      "reference_number": "FB-2024-000893"
    },
    "score": 85,
    "processing_status": "pending"
  }
}
```

#### List Submissions
```http
GET /forms/{form_id}/submissions
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | integer | 1 | Page number |
| limit | integer | 20 | Items per page |
| status | string | all | Filter by status |
| date_from | date | - | Start date filter |
| date_to | date | - | End date filter |
| search | string | - | Search in submission data |
| export | string | - | Export format (csv, xlsx, json) |

#### Get Submission
```http
GET /forms/{form_id}/submissions/{submission_id}
```

#### Update Submission (Draft)
```http
PUT /forms/{form_id}/submissions/{submission_id}
```

**Request Body:**
```json
{
  "data": {
    "full_name": "John M. Doe"
  },
  "current_step": 2,
  "completed_steps": [1]
}
```

#### Export Submissions
```http
GET /forms/{form_id}/submissions/export
```

**Query Parameters:**
- `format` (string) - Export format (csv, xlsx, json, pdf)
- `fields` (array) - Specific fields to export
- `date_from` (date) - Start date
- `date_to` (date) - End date
- `include_metadata` (boolean) - Include submission metadata

### Analytics

#### Get Analytics Summary
```http
GET /forms/{form_id}/analytics/summary
```

**Query Parameters:**
- `period` (string) - Time period (24h, 7d, 30d, 90d, 1y, all)
- `timezone` (string) - Timezone for data aggregation

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "total_views": 15420,
      "unique_visitors": 8932,
      "total_submissions": 2341,
      "completed_submissions": 2105,
      "conversion_rate": 26.23,
      "avg_completion_time": 312,
      "bounce_rate": 18.5
    },
    "trends": {
      "views": [
        {"date": "2024-01-10", "value": 542},
        {"date": "2024-01-11", "value": 618}
      ],
      "submissions": [
        {"date": "2024-01-10", "value": 142},
        {"date": "2024-01-11", "value": 161}
      ]
    },
    "top_traffic_sources": [
      {"source": "direct", "visits": 4521, "conversions": 1203},
      {"source": "google", "visits": 3210, "conversions": 842}
    ],
    "device_breakdown": {
      "desktop": {"percentage": 65.2, "submissions": 1527},
      "mobile": {"percentage": 28.4, "submissions": 665},
      "tablet": {"percentage": 6.4, "submissions": 149}
    }
  }
}
```

#### Get Field Analytics
```http
GET /forms/{form_id}/analytics/fields
```

**Response:**
```json
{
  "success": true,
  "data": {
    "fields": [
      {
        "field_id": "field-123",
        "field_name": "email",
        "interactions": 2341,
        "avg_time_spent": 8.5,
        "error_rate": 3.2,
        "abandonment_rate": 1.5,
        "most_common_errors": [
          {
            "type": "format",
            "message": "Invalid email format",
            "count": 75
          }
        ]
      }
    ],
    "completion_funnel": [
      {"step": 1, "entered": 2341, "completed": 2250, "drop_rate": 3.9},
      {"step": 2, "entered": 2250, "completed": 2105, "drop_rate": 6.4}
    ]
  }
}
```

### Webhooks

#### List Webhooks
```http
GET /forms/{form_id}/webhooks
```

#### Create Webhook
```http
POST /forms/{form_id}/webhooks
```

**Request Body:**
```json
{
  "name": "Slack Notification",
  "url": "https://hooks.slack.com/services/xxx",
  "method": "POST",
  "events": ["form.submitted", "form.completed"],
  "auth": {
    "type": "bearer",
    "token": "xoxb-slack-token"
  },
  "headers": {
    "Content-Type": "application/json"
  },
  "payload_template": {
    "text": "New form submission from {{data.full_name}}",
    "channel": "#form-submissions"
  },
  "retry": {
    "enabled": true,
    "max_attempts": 3,
    "backoff_multiplier": 2
  },
  "conditions": {
    "field": "department",
    "operator": "equals",
    "value": "sales"
  }
}
```

#### Test Webhook
```http
POST /forms/{form_id}/webhooks/{webhook_id}/test
```

**Request Body:**
```json
{
  "sample_data": {
    "full_name": "Test User",
    "email": "test@example.com"
  }
}
```

### Templates

#### List Templates
```http
GET /templates
```

**Query Parameters:**
- `category` (string) - Filter by category
- `is_public` (boolean) - Public templates only
- `is_featured` (boolean) - Featured templates only

#### Create Form from Template
```http
POST /templates/{template_id}/create-form
```

**Request Body:**
```json
{
  "name": "My Survey Form",
  "team_id": "team-123",
  "customize": {
    "theme": "dark",
    "logo_url": "https://company.com/logo.png"
  }
}
```

---

## Request/Response Formats

### Standard Success Response
```json
{
  "success": true,
  "data": {...},
  "meta": {
    "request_id": "req_123abc",
    "timestamp": "2024-01-16T12:00:00Z",
    "version": "1.0"
  }
}
```

### Standard Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "code": "invalid_format",
        "message": "Email format is invalid"
      }
    ]
  },
  "meta": {
    "request_id": "req_123abc",
    "timestamp": "2024-01-16T12:00:00Z"
  }
}
```

### Pagination Format
```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "pages": 8,
    "has_next": true,
    "has_prev": false,
    "next_cursor": "eyJpZCI6MTIzfQ==",
    "prev_cursor": null
  }
}
```

---

## Error Handling

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Invalid request data |
| AUTHENTICATION_REQUIRED | 401 | Missing or invalid authentication |
| INSUFFICIENT_PERMISSIONS | 403 | User lacks required permissions |
| RESOURCE_NOT_FOUND | 404 | Requested resource not found |
| CONFLICT | 409 | Resource conflict (e.g., duplicate slug) |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Internal server error |
| SERVICE_UNAVAILABLE | 503 | Service temporarily unavailable |

### Validation Error Details
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "fields[0].field_key",
        "code": "duplicate",
        "message": "Field key 'email' already exists"
      },
      {
        "field": "settings.quotas.max_submissions",
        "code": "min_value",
        "message": "Maximum submissions must be at least 1"
      }
    ]
  }
}
```

---

## Rate Limiting

### Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1705419600
X-RateLimit-Reset-After: 3600
```

### Rate Limit Tiers

| Tier | Requests/Hour | Burst | Concurrent |
|------|---------------|-------|------------|
| Free | 100 | 10 | 2 |
| Basic | 1,000 | 50 | 5 |
| Pro | 10,000 | 200 | 20 |
| Enterprise | Unlimited | 1000 | 100 |

### Rate Limit Response
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded",
    "retry_after": 3600,
    "limit": 1000,
    "remaining": 0,
    "reset": "2024-01-16T13:00:00Z"
  }
}
```

---

## Webhooks

### Webhook Events

| Event | Description |
|-------|-------------|
| form.created | Form was created |
| form.updated | Form was updated |
| form.published | Form was published |
| form.archived | Form was archived |
| form.deleted | Form was deleted |
| submission.created | New submission created |
| submission.updated | Submission updated |
| submission.completed | Submission completed |
| webhook.failed | Webhook delivery failed |

### Webhook Payload
```json
{
  "event": "submission.completed",
  "timestamp": "2024-01-16T19:30:00Z",
  "data": {
    "form": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Customer Feedback Form"
    },
    "submission": {
      "id": "sub-789",
      "number": 893,
      "data": {...},
      "metadata": {...}
    }
  },
  "signature": "sha256=abcdef123456..."
}
```

### Webhook Security

#### Signature Verification
```typescript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return `sha256=${hash}` === signature;
}
```

---

## WebSocket Events

### Connection
```javascript
const ws = new WebSocket('wss://api.formbuilder.com/v1/ws');

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your-jwt-token'
  }));
});
```

### Real-time Events

#### Form Collaboration
```json
{
  "type": "form.field.locked",
  "data": {
    "form_id": "550e8400-e29b-41d4-a716-446655440000",
    "field_id": "field-123",
    "user": {
      "id": "user-456",
      "name": "Jane Smith"
    }
  }
}
```

#### Analytics Updates
```json
{
  "type": "analytics.submission",
  "data": {
    "form_id": "550e8400-e29b-41d4-a716-446655440000",
    "submission_count": 894,
    "conversion_rate": 27.81
  }
}
```

#### Live Form Viewing
```json
{
  "type": "form.viewer.joined",
  "data": {
    "form_id": "550e8400-e29b-41d4-a716-446655440000",
    "viewer": {
      "id": "anonymous-123",
      "location": "New York, US",
      "device": "mobile"
    },
    "current_viewers": 12
  }
}
```

---

## SDK Examples

### JavaScript/TypeScript
```typescript
import { FormBuilderClient } from '@formbuilder/sdk';

const client = new FormBuilderClient({
  apiKey: 'your-api-key',
  environment: 'production'
});

// Create a form
const form = await client.forms.create({
  name: 'Contact Form',
  fields: [
    {
      field_key: 'email',
      field_type: 'email',
      label: 'Email Address',
      required: true
    }
  ]
});

// Submit to form
const submission = await client.submissions.create(form.id, {
  data: {
    email: 'user@example.com'
  }
});
```

### Python
```python
from formbuilder import FormBuilderClient

client = FormBuilderClient(
    api_key='your-api-key',
    environment='production'
)

# Create a form
form = client.forms.create(
    name='Contact Form',
    fields=[
        {
            'field_key': 'email',
            'field_type': 'email',
            'label': 'Email Address',
            'required': True
        }
    ]
)

# Submit to form
submission = client.submissions.create(
    form_id=form.id,
    data={
        'email': 'user@example.com'
    }
)
```

### cURL
```bash
# Create a form
curl -X POST https://api.formbuilder.com/v1/forms \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Contact Form",
    "fields": [{
      "field_key": "email",
      "field_type": "email",
      "label": "Email Address",
      "required": true
    }]
  }'
```

---

## Postman Collection

Download our [Postman Collection](https://api.formbuilder.com/postman-collection.json) for easy API testing and exploration.

## OpenAPI Specification

Access our [OpenAPI 3.0 Specification](https://api.formbuilder.com/openapi.yaml) for API documentation and code generation.