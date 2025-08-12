# API Reference - User Role Permission System

## Base URL
```
Development: http://localhost:5000/api
Production: https://api.xp-platform.com/api
```

## Authentication
All protected endpoints require Bearer token authentication:
```http
Authorization: Bearer <jwt_token>
```

---

## Authentication Endpoints

### Login
```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "refresh_token_here",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "User Name",
      "roles": ["admin", "manager"]
    }
  }
}
```

### Register
```http
POST /auth/register
```

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "password": "SecurePassword123!",
  "name": "New User",
  "phone": "+84123456789"
}
```

### Refresh Token
```http
POST /auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "refresh_token_here"
}
```

### Logout
```http
POST /auth/logout
```

**Headers:**
```http
Authorization: Bearer <jwt_token>
```

### Get Current User
```http
GET /auth/me
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "avatar_url": "https://...",
    "is_active": true,
    "email_verified": true,
    "roles": [
      {
        "id": "role-uuid",
        "name": "admin",
        "display_name": "Administrator"
      }
    ]
  }
}
```

---

## User Management Endpoints

### List Users
```http
GET /users
```

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 10)
- `search` (string): Search by name or email
- `role` (string): Filter by role
- `status` (string): Filter by status (active/inactive)

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "email": "user@example.com",
        "name": "User Name",
        "avatar_url": "https://...",
        "is_active": true,
        "roles": ["admin"],
        "created_at": "2024-01-11T10:00:00Z",
        "last_login": "2024-01-11T14:30:00Z"
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 10,
      "totalPages": 10
    }
  }
}
```

### Get User Details
```http
GET /users/:userId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "avatar_url": "https://...",
    "is_active": true,
    "email_verified": true,
    "phone": "+84123456789",
    "roles": [
      {
        "id": "role-uuid",
        "name": "admin",
        "display_name": "Administrator",
        "assigned_at": "2024-01-10T10:00:00Z",
        "assigned_by": "super-admin-uuid"
      }
    ],
    "permissions": [
      {
        "resource": "users",
        "action": "create",
        "scope": "all"
      }
    ],
    "groups": [
      {
        "id": "group-uuid",
        "name": "Sales Department",
        "type": "department"
      }
    ],
    "created_at": "2024-01-01T10:00:00Z",
    "updated_at": "2024-01-11T10:00:00Z",
    "last_login": "2024-01-11T14:30:00Z"
  }
}
```

### Update User
```http
PUT /users/:userId
```

**Request Body:**
```json
{
  "name": "Updated Name",
  "phone": "+84987654321",
  "is_active": true
}
```

### Delete User
```http
DELETE /users/:userId
```

### Assign Role to User
```http
POST /users/:userId/roles
```

**Request Body:**
```json
{
  "roleId": "role-uuid",
  "reason": "Promoted to manager"
}
```

### Remove Role from User
```http
DELETE /users/:userId/roles/:roleId
```

**Request Body:**
```json
{
  "reason": "Role change due to department transfer"
}
```

### Bulk Operations
```http
POST /users/bulk
```

**Request Body:**
```json
{
  "userIds": ["uuid1", "uuid2", "uuid3"],
  "operation": "activate|deactivate|assignRole|removeRole",
  "data": {
    "roleId": "role-uuid",
    "reason": "Bulk role assignment"
  }
}
```

---

## Role Management Endpoints

### List Roles
```http
GET /roles
```

**Query Parameters:**
- `type` (string): Filter by type (system/custom)
- `includePermissions` (boolean): Include permissions in response

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "admin",
      "display_name": "Administrator",
      "description": "System administrator with full access",
      "type": "system",
      "parent_id": null,
      "user_count": 5,
      "permission_count": 50,
      "created_at": "2024-01-01T10:00:00Z"
    }
  ]
}
```

### Get Role Details
```http
GET /roles/:roleId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "admin",
    "display_name": "Administrator",
    "description": "System administrator with full access",
    "type": "system",
    "parent": {
      "id": "parent-uuid",
      "name": "super_admin",
      "display_name": "Super Administrator"
    },
    "children": [
      {
        "id": "child-uuid",
        "name": "user_admin",
        "display_name": "User Administrator"
      }
    ],
    "permissions": [
      {
        "id": "perm-uuid",
        "resource": "users",
        "action": "create",
        "scope": "all",
        "display_name": "Create Users"
      }
    ],
    "users": [
      {
        "id": "user-uuid",
        "email": "admin@example.com",
        "name": "Admin User"
      }
    ]
  }
}
```

### Create Role
```http
POST /roles
```

**Request Body:**
```json
{
  "name": "custom_role",
  "display_name": "Custom Role",
  "description": "A custom role for specific needs",
  "type": "custom",
  "parent_id": "parent-role-uuid"
}
```

### Update Role
```http
PUT /roles/:roleId
```

**Request Body:**
```json
{
  "display_name": "Updated Role Name",
  "description": "Updated description",
  "parent_id": "new-parent-uuid"
}
```

### Delete Role
```http
DELETE /roles/:roleId
```

### Assign Permissions to Role
```http
POST /roles/:roleId/permissions
```

**Request Body:**
```json
{
  "permissionIds": ["perm-uuid1", "perm-uuid2"],
  "permissions": [
    {
      "resource": "forms",
      "action": "create",
      "scope": "all"
    }
  ]
}
```

### Remove Permissions from Role
```http
DELETE /roles/:roleId/permissions
```

**Request Body:**
```json
{
  "permissionIds": ["perm-uuid1", "perm-uuid2"]
}
```

### Get Role Hierarchy
```http
GET /roles/hierarchy
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "super-admin-uuid",
      "name": "super_admin",
      "display_name": "Super Administrator",
      "children": [
        {
          "id": "admin-uuid",
          "name": "admin",
          "display_name": "Administrator",
          "children": [...]
        }
      ]
    }
  ]
}
```

---

## Permission Management Endpoints

### List All Permissions
```http
GET /permissions
```

**Query Parameters:**
- `resource` (string): Filter by resource
- `action` (string): Filter by action
- `scope` (string): Filter by scope

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "resource": "users",
      "action": "create",
      "scope": "all",
      "display_name": "Create Users",
      "description": "Ability to create new users",
      "category": "User Management"
    }
  ]
}
```

### Get Current User Permissions
```http
GET /permissions/me
```

**Response:**
```json
{
  "success": true,
  "data": {
    "role_permissions": [
      {
        "id": "perm-uuid",
        "resource": "users",
        "action": "view",
        "scope": "all",
        "from_role": "admin"
      }
    ],
    "direct_permissions": [
      {
        "id": "perm-uuid",
        "resource": "reports",
        "action": "export",
        "scope": "department"
      }
    ],
    "effective_permissions": [
      {
        "resource": "users",
        "action": "view",
        "scope": "all"
      }
    ]
  }
}
```

### Check Permission
```http
POST /permissions/check
```

**Request Body:**
```json
{
  "resource": "users",
  "action": "create",
  "scope": "all"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "hasPermission": true,
    "source": "role",
    "role": "admin"
  }
}
```

### Grant Direct Permission
```http
POST /permissions/grant
```

**Request Body:**
```json
{
  "userId": "user-uuid",
  "permissionId": "perm-uuid",
  "reason": "Temporary access for project X",
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

### Revoke Direct Permission
```http
POST /permissions/revoke
```

**Request Body:**
```json
{
  "userId": "user-uuid",
  "permissionId": "perm-uuid",
  "reason": "Project completed"
}
```

### Get Permission Matrix
```http
GET /permissions/matrix
```

**Response:**
```json
{
  "success": true,
  "data": {
    "resources": ["users", "forms", "reports"],
    "actions": ["view", "create", "update", "delete"],
    "matrix": {
      "users": {
        "view": ["admin", "manager", "staff"],
        "create": ["admin"],
        "update": ["admin", "manager"],
        "delete": ["admin"]
      }
    }
  }
}
```

---

## Group Management Endpoints

### List Groups
```http
GET /groups
```

**Query Parameters:**
- `type` (string): Filter by type (department/project/custom)
- `includeMembers` (boolean): Include member list

### Get Group Details
```http
GET /groups/:groupId
```

### Create Group
```http
POST /groups
```

**Request Body:**
```json
{
  "name": "Sales Department",
  "description": "Sales team members",
  "type": "department",
  "metadata": {
    "location": "HQ",
    "manager": "user-uuid"
  }
}
```

### Add Members to Group
```http
POST /groups/:groupId/members
```

**Request Body:**
```json
{
  "userIds": ["user-uuid1", "user-uuid2"]
}
```

### Remove Members from Group
```http
DELETE /groups/:groupId/members
```

**Request Body:**
```json
{
  "userIds": ["user-uuid1", "user-uuid2"]
}
```

---

## Audit Log Endpoints

### Get Audit Logs
```http
GET /audit
```

**Query Parameters:**
- `action` (string): Filter by action type
- `userId` (string): Filter by user
- `resource` (string): Filter by resource
- `startDate` (string): Start date (ISO 8601)
- `endDate` (string): End date (ISO 8601)
- `page` (number): Page number
- `limit` (number): Items per page

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "log-uuid",
        "action": "role.assigned",
        "user_id": "user-uuid",
        "user_name": "Admin User",
        "target_id": "target-uuid",
        "target_type": "user",
        "details": {
          "role": "admin",
          "reason": "Promotion"
        },
        "ip_address": "192.168.1.1",
        "user_agent": "Mozilla/5.0...",
        "created_at": "2024-01-11T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 500,
      "page": 1,
      "limit": 20
    }
  }
}
```

### Export Audit Logs
```http
GET /audit/export
```

**Query Parameters:**
- Same as Get Audit Logs
- `format` (string): Export format (csv/json/pdf)

---

## Error Responses

All endpoints follow a consistent error response format:

### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid request parameters",
    "details": {
      "field": "email",
      "error": "Invalid email format"
    }
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You don't have permission to perform this action",
    "required_permission": "users.create"
  }
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found"
  }
}
```

### 409 Conflict
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Resource already exists"
  }
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "requestId": "req-uuid"
  }
}
```

---

## Rate Limiting

API endpoints are rate limited to prevent abuse:

- **Authentication endpoints**: 5 requests per minute
- **Read endpoints**: 100 requests per minute
- **Write endpoints**: 30 requests per minute
- **Bulk operations**: 10 requests per minute

Rate limit headers:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1641900000
```

---

## Webhooks

### Configure Webhook
```http
POST /webhooks
```

**Request Body:**
```json
{
  "url": "https://your-server.com/webhook",
  "events": ["user.created", "role.assigned", "permission.changed"],
  "secret": "webhook_secret_key"
}
```

### Webhook Events

#### user.created
```json
{
  "event": "user.created",
  "timestamp": "2024-01-11T10:00:00Z",
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "newuser@example.com"
    }
  }
}
```

#### role.assigned
```json
{
  "event": "role.assigned",
  "timestamp": "2024-01-11T10:00:00Z",
  "data": {
    "user_id": "user-uuid",
    "role_id": "role-uuid",
    "assigned_by": "admin-uuid"
  }
}
```

#### permission.changed
```json
{
  "event": "permission.changed",
  "timestamp": "2024-01-11T10:00:00Z",
  "data": {
    "role_id": "role-uuid",
    "added_permissions": ["perm1", "perm2"],
    "removed_permissions": ["perm3"]
  }
}
```

---

## WebSocket Events

Connect to WebSocket for real-time updates:
```javascript
const ws = new WebSocket('ws://localhost:5000/ws');

ws.on('message', (data) => {
  const event = JSON.parse(data);
  console.log('Event:', event);
});
```

### Subscribe to Events
```json
{
  "action": "subscribe",
  "channels": ["permissions", "roles", "users"]
}
```

### Real-time Events
```json
{
  "channel": "permissions",
  "event": "updated",
  "data": {
    "userId": "user-uuid",
    "permissions": [...]
  }
}
```

---

## SDK Examples

### JavaScript/TypeScript
```typescript
import { XPClient } from '@xp/sdk';

const client = new XPClient({
  apiUrl: 'https://api.xp-platform.com',
  apiKey: 'your-api-key'
});

// Login
const { user, token } = await client.auth.login({
  email: 'user@example.com',
  password: 'password'
});

// Check permission
const hasPermission = await client.permissions.check({
  resource: 'users',
  action: 'create'
});

// Get users
const users = await client.users.list({
  page: 1,
  limit: 10
});
```

### Python
```python
from xp_sdk import XPClient

client = XPClient(
    api_url='https://api.xp-platform.com',
    api_key='your-api-key'
)

# Login
user, token = client.auth.login(
    email='user@example.com',
    password='password'
)

# Check permission
has_permission = client.permissions.check(
    resource='users',
    action='create'
)

# Get users
users = client.users.list(page=1, limit=10)
```

---

## Testing

### Postman Collection
Download our Postman collection for easy API testing:
[Download Postman Collection](https://api.xp-platform.com/postman-collection.json)

### cURL Examples

**Login:**
```bash
curl -X POST https://api.xp-platform.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'
```

**Get Users:**
```bash
curl -X GET https://api.xp-platform.com/api/users \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Check Permission:**
```bash
curl -X POST https://api.xp-platform.com/api/permissions/check \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resource":"users","action":"create","scope":"all"}'
```

---

## API Versioning

The API uses URL versioning. Current version: v1

Future versions will be available at:
- `/api/v2/...`
- `/api/v3/...`

Deprecated endpoints will be marked with:
```http
X-API-Deprecated: true
X-API-Deprecation-Date: 2024-12-31
```

---

## Support

For API support and questions:
- Email: api-support@xp-platform.com
- Documentation: https://docs.xp-platform.com/api
- Status Page: https://status.xp-platform.com
- GitHub Issues: https://github.com/xp-platform/api/issues

---

*API Reference v1.0 - Last Updated: 11/01/2024*