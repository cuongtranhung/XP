---
title: API - Group Management System
version: 1.0.0
date: 2025-01-11
author: Claude Code
status: draft
tags: [api, group-management, user-management]
---

# API: Group Management System

Complete API documentation for the User Group Management system in the XP Enterprise Application Platform.

## Base URL

All group management endpoints are prefixed with:
```
/api/user-management/groups
```

## Authentication

All endpoints require JWT Bearer token authentication and specific permissions.

### Required Headers
| Header | Value | Required |
|--------|-------|----------|
| Authorization | Bearer {jwt_token} | Yes |
| Content-Type | application/json | Yes |

## Permissions

The group management system uses role-based permissions:

| Permission | Description |
|------------|-------------|
| `READ_GROUPS` | View groups and basic information |
| `CREATE_GROUPS` | Create new groups |
| `UPDATE_GROUPS` | Modify existing groups |
| `DELETE_GROUPS` | Delete groups |
| `READ_GROUP_MEMBERS` | View group members |
| `MANAGE_GROUP_MEMBERS` | Add/remove members, change roles |

## Endpoints Overview

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/` | READ_GROUPS | List all groups |
| GET | `/:id` | READ_GROUPS | Get group details |
| POST | `/` | CREATE_GROUPS | Create new group |
| PUT | `/:id` | UPDATE_GROUPS | Update group |
| DELETE | `/:id` | DELETE_GROUPS | Delete group |
| GET | `/:id/members` | READ_GROUP_MEMBERS | Get group members |
| POST | `/:id/members` | MANAGE_GROUP_MEMBERS | Add members to group |
| DELETE | `/:id/members/:userId` | MANAGE_GROUP_MEMBERS | Remove member |
| PUT | `/:id/members/:userId` | MANAGE_GROUP_MEMBERS | Update member role |
| GET | `/:id/available-users` | MANAGE_GROUP_MEMBERS | Search available users |

---

## 1. List Groups

Get all groups with optional filtering.

**Endpoint**: `GET /api/user-management/groups`  
**Permission**: `READ_GROUPS`

### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| group_type | string | No | Filter by type | `department` |
| is_active | boolean | No | Filter by status | `true` |
| search | string | No | Search in name/description | `marketing` |

**Valid group_type values**: `system`, `department`, `project`, `custom`

### Response

**Success (200)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "marketing_team",
      "display_name": "Marketing Team",
      "description": "Marketing department group",
      "group_type": "department",
      "parent_group_id": null,
      "is_active": true,
      "member_count": 12,
      "active_member_count": 10,
      "created_at": "2025-01-10T10:00:00Z",
      "updated_at": "2025-01-10T10:00:00Z"
    }
  ]
}
```

### Example Usage

**cURL**:
```bash
curl -X GET "https://api.example.com/api/user-management/groups?group_type=department&is_active=true" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json"
```

**JavaScript**:
```javascript
const response = await fetch('/api/user-management/groups?group_type=department', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
const groups = await response.json();
```

---

## 2. Get Group Details

Retrieve detailed information about a specific group.

**Endpoint**: `GET /api/user-management/groups/:id`  
**Permission**: `READ_GROUPS`

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Group ID |

### Response

**Success (200)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "marketing_team",
    "display_name": "Marketing Team", 
    "description": "Marketing department group",
    "group_type": "department",
    "parent_group_id": null,
    "metadata": {},
    "is_active": true,
    "created_by": 123,
    "created_at": "2025-01-10T10:00:00Z",
    "updated_at": "2025-01-10T10:00:00Z"
  }
}
```

**Error (404)**:
```json
{
  "success": false,
  "error": "Group not found"
}
```

---

## 3. Create Group

Create a new group.

**Endpoint**: `POST /api/user-management/groups`  
**Permission**: `CREATE_GROUPS`

### Request Body

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| name | string | Yes | Unique group name | 2-100 chars |
| display_name | string | Yes | Display name | 2-255 chars |
| description | string | No | Group description | Max 1000 chars |
| group_type | string | No | Group type | `department`, `project`, `custom` |
| parent_group_id | UUID | No | Parent group ID | Valid UUID |

### Request Example

```json
{
  "name": "product_team",
  "display_name": "Product Development Team",
  "description": "Team responsible for product development",
  "group_type": "department",
  "parent_group_id": null
}
```

### Response

**Success (201)**:
```json
{
  "success": true,
  "message": "Group created successfully",
  "data": {
    "id": "new-uuid",
    "name": "product_team",
    "display_name": "Product Development Team",
    "description": "Team responsible for product development",
    "group_type": "department",
    "parent_group_id": null,
    "is_active": true,
    "created_at": "2025-01-11T10:00:00Z",
    "updated_at": "2025-01-11T10:00:00Z"
  }
}
```

**Error (400)**:
```json
{
  "success": false,
  "error": "Group with this name already exists"
}
```

---

## 4. Update Group

Update an existing group's information.

**Endpoint**: `PUT /api/user-management/groups/:id`  
**Permission**: `UPDATE_GROUPS`

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Group ID |

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| display_name | string | No | New display name |
| description | string | No | New description |
| is_active | boolean | No | Active status |

**Note**: Group `name` and `group_type` cannot be changed via API for data integrity.

### Response

**Success (200)**:
```json
{
  "success": true,
  "message": "Group updated successfully",
  "data": {
    "id": "uuid",
    "display_name": "Updated Display Name",
    "is_active": false,
    "updated_at": "2025-01-11T10:30:00Z"
  }
}
```

---

## 5. Delete Group

Delete a group and all its memberships.

**Endpoint**: `DELETE /api/user-management/groups/:id`  
**Permission**: `DELETE_GROUPS`

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Group ID |

### Response

**Success (200)**:
```json
{
  "success": true,
  "message": "Group deleted successfully"
}
```

**Error (404)**:
```json
{
  "success": false,
  "error": "Group not found"
}
```

**Warning**: Deleting a group will remove all user memberships. This action cannot be undone.

---

## 6. Get Group Members

Get paginated list of group members.

**Endpoint**: `GET /api/user-management/groups/:id/members`  
**Permission**: `READ_GROUP_MEMBERS`

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Group ID |

### Query Parameters

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| page | integer | No | Page number | 1 |
| limit | integer | No | Items per page (max 100) | 10 |

### Response

**Success (200)**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 123,
        "email": "user@example.com",
        "full_name": "John Doe",
        "department": "Marketing",
        "status": "active",
        "is_approved": true,
        "is_blocked": false,
        "role_in_group": "member",
        "joined_at": "2025-01-10T10:00:00Z"
      }
    ],
    "total": 25,
    "page": 1,
    "limit": 10,
    "total_pages": 3
  }
}
```

---

## 7. Add Members to Group

Add one or multiple users to a group (bulk assignment supported).

**Endpoint**: `POST /api/user-management/groups/:id/members`  
**Permission**: `MANAGE_GROUP_MEMBERS`

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Group ID |

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| user_ids | string[] | Yes | Array of user IDs to add |
| role_in_group | string | No | Role for all users | Default: `member` |

**Valid roles**: `member`, `manager`, `owner`

### Request Example

```json
{
  "user_ids": ["123", "456", "789"],
  "role_in_group": "member"
}
```

### Response

**Success (200)**:
```json
{
  "success": true,
  "message": "Processed 3 user assignments",
  "data": {
    "successful": [
      {
        "user_id": "123",
        "success": true,
        "message": "User added to group successfully"
      },
      {
        "user_id": "456", 
        "success": true,
        "message": "User added to group successfully"
      }
    ],
    "failed": [
      {
        "user_id": "789",
        "success": false,
        "error": "User not found"
      }
    ],
    "summary": {
      "total": 3,
      "successful_count": 2,
      "failed_count": 1
    }
  }
}
```

---

## 8. Remove Member from Group

Remove a user from a group.

**Endpoint**: `DELETE /api/user-management/groups/:id/members/:userId`  
**Permission**: `MANAGE_GROUP_MEMBERS`

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Group ID |
| userId | string | Yes | User ID to remove |

### Response

**Success (200)**:
```json
{
  "success": true,
  "message": "User removed from group successfully"
}
```

**Error (404)**:
```json
{
  "success": false,
  "error": "User is not a member of this group"
}
```

---

## 9. Update Member Role

Update a user's role within a group.

**Endpoint**: `PUT /api/user-management/groups/:id/members/:userId`  
**Permission**: `MANAGE_GROUP_MEMBERS`

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Group ID |
| userId | string | Yes | User ID |

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| role_in_group | string | Yes | New role |

**Valid roles**: `member`, `manager`, `owner`

### Request Example

```json
{
  "role_in_group": "manager"
}
```

### Response

**Success (200)**:
```json
{
  "success": true,
  "message": "User role in group updated successfully",
  "data": {
    "user_id": "123",
    "group_id": "uuid",
    "role_in_group": "manager"
  }
}
```

---

## 10. Search Available Users

Search for users not in the group (for assignment).

**Endpoint**: `GET /api/user-management/groups/:id/available-users`  
**Permission**: `MANAGE_GROUP_MEMBERS`

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Group ID |

### Query Parameters

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| search | string | No | Search term (name/email) | - |
| department | string | No | Filter by department | - |
| limit | integer | No | Max results (1-100) | 20 |

### Response

**Success (200)**:
```json
{
  "success": true,
  "data": [
    {
      "id": 456,
      "email": "jane@example.com",
      "full_name": "Jane Smith",
      "department": "Engineering",
      "position": "Developer",
      "is_approved": true,
      "is_blocked": false
    }
  ]
}
```

### Example Usage

```javascript
// Search for users to add to group
const response = await fetch(`/api/user-management/groups/${groupId}/available-users?search=john&department=Engineering`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

---

## Error Responses

### Common Error Codes

| Code | Description | Example Response |
|------|-------------|------------------|
| 400 | Bad Request | `{"success": false, "error": "Validation failed", "details": [...]}` |
| 401 | Unauthorized | `{"success": false, "error": "Authentication required"}` |
| 403 | Forbidden | `{"success": false, "error": "Insufficient permissions"}` |
| 404 | Not Found | `{"success": false, "error": "Group not found"}` |
| 409 | Conflict | `{"success": false, "error": "Group with this name already exists"}` |
| 500 | Server Error | `{"success": false, "error": "Internal server error"}` |

### Validation Errors

Validation errors return detailed field-level information:

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "type": "field",
      "msg": "Group name must be between 2 and 100 characters",
      "path": "name",
      "location": "body"
    }
  ]
}
```

---

## Rate Limiting

All group management endpoints are subject to rate limiting:

- **General Operations**: 100 requests per minute per user
- **Bulk Operations**: 10 requests per minute per user
- **Search Operations**: 50 requests per minute per user

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit per window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Time when limit resets

---

## Audit Logging

All group management operations are automatically logged for audit purposes:

### Logged Actions
- `CREATE_GROUP`: Group creation
- `UPDATE_GROUP`: Group modifications  
- `DELETE_GROUP`: Group deletion
- `ADD_USER_TO_GROUP`: Member additions
- `REMOVE_USER_FROM_GROUP`: Member removals
- `UPDATE_USER_GROUP_ROLE`: Role changes

### Audit Log Format
```json
{
  "user_id": "123",
  "action": "ADD_USER_TO_GROUP",
  "entity_type": "user",
  "entity_id": "456",
  "new_values": {
    "group_id": "uuid",
    "group_name": "Marketing Team",
    "role_in_group": "member"
  },
  "timestamp": "2025-01-11T10:00:00Z"
}
```

---

## Integration Examples

### React Hook for Group Management

```typescript
import { useState, useEffect } from 'react';

export const useGroupManagement = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchGroups = async (filters = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams(filters);
      const response = await fetch(`/api/user-management/groups?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      const result = await response.json();
      if (result.success) {
        setGroups(result.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const addMembersToGroup = async (groupId, userIds, role = 'member') => {
    const response = await fetch(`/api/user-management/groups/${groupId}/members`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user_ids: userIds, role_in_group: role })
    });
    return response.json();
  };

  return {
    groups,
    loading,
    fetchGroups,
    addMembersToGroup
  };
};
```

### Node.js Service Integration

```typescript
import axios from 'axios';

class GroupManagementService {
  private baseURL = '/api/user-management/groups';
  
  async createGroup(groupData: any, token: string) {
    try {
      const response = await axios.post(this.baseURL, groupData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to create group');
    }
  }
  
  async getGroupMembers(groupId: string, pagination: any, token: string) {
    const params = new URLSearchParams(pagination);
    const response = await axios.get(`${this.baseURL}/${groupId}/members?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
  }
}
```

---

## Testing

### Unit Test Examples

```javascript
describe('Group Management API', () => {
  test('should create group successfully', async () => {
    const groupData = {
      name: 'test_group',
      display_name: 'Test Group',
      description: 'Test description',
      group_type: 'custom'
    };
    
    const response = await request(app)
      .post('/api/user-management/groups')
      .set('Authorization', `Bearer ${validToken}`)
      .send(groupData)
      .expect(201);
      
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('test_group');
  });
});
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-11 | Initial API documentation release |

---

## Related Documentation

- [User Management Overview](../user-management-overview.md)
- [Authentication API](./auth-api.md)
- [Permission System](./permission-system.md)
- [Audit Logging](./audit-logging.md)
- [Group Management Frontend Guide](../../01-getting-started/group-management-guide.md)