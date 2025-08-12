# Multi-User Access System - Integration Guide

## Overview
Complete Multi-User Access System with form sharing, permissions, cloning, and audit logging.

## API Endpoints Summary

### 🔄 Form Sharing (`/api/forms/:formId/...`)
- `POST /:formId/share` - Share form with user
- `DELETE /:formId/share/:userId` - Remove sharing
- `GET /:formId/shares` - List all shares for form
- `GET /shared-with-me` - Get forms shared with current user
- `PUT /:formId/share/:userId` - Update share permission
- `POST /:formId/bulk-share` - Bulk share with multiple users
- `GET /:formId/access-list` - Get all users with access

### 🔐 Permissions (`/api/forms/...`)
- `GET /:formId/permissions` - Check user permissions for form
- `GET /:formId/permissions/:action` - Check specific permission
- `GET /accessible` - Get all accessible forms
- `PUT /:formId/visibility` - Update form visibility
- `GET /:formId/public` - Check if form is public
- `GET /:formId/owner` - Get form owner info
- `POST /batch-permissions` - Batch check permissions
- `POST /:formId/enforce/:action` - Enforce permission (test endpoint)

### 🔄 Form Cloning (`/api/forms/...`)
- `POST /:formId/clone` - Clone a form
- `GET /:formId/clones` - Get clone history
- `GET /:formId/original` - Get original form for clone
- `POST /:formId/create-template` - Create template from form
- `GET /templates` - Get available templates
- `POST /batch-clone` - Batch clone forms
- `GET /:formId/clone-stats` - Get clone statistics
- `DELETE /:formId/clone-history` - Delete clone history
- `POST /templates/:templateId/clone` - Clone from template

### 📋 Audit Logs (`/api/forms/:formId/...`)
- `GET /:formId/audit-logs` - Get form access logs
- `GET /my-activity` - Get user activity logs
- `GET /:formId/audit-stats` - Get audit statistics
- `GET /security/events` - Get security events
- `POST /:formId/audit-report` - Generate comprehensive report
- `GET /:formId/audit-logs/export` - Export logs to CSV
- `DELETE /cleanup` - Cleanup old logs (admin)
- `GET /health` - Service health check

### 📊 Dashboard (`/api/dashboard/...`)
- `GET /user` - Get user dashboard data
- `GET /form/:formId/stats` - Get comprehensive form stats
- `GET /access-summary` - Get user's access summary
- `GET /activity-summary` - Get recent activity summary
- `GET /system-health` - Get system health (admin)
- `GET /quick-stats` - Get quick stats for navigation

## Permission Levels
- **view**: Can view form structure and public data
- **submit**: Can submit form responses
- **edit**: Can modify form structure and settings
- **admin**: Full control (equivalent to owner for shared forms)

## Form Visibility Levels
- **private**: Only owner can access
- **shared**: Owner + explicitly shared users
- **public**: Anyone can view/submit
- **organization**: Organization members (future feature)

## Middleware Usage

### Basic Permission Protection
```typescript
import { requireViewPermission, requireEditPermission } from '../middleware/formPermissions';

// Protect form viewing (allows public forms)
router.get('/forms/:formId', requireViewPermission(), getForm);

// Protect form editing (owner/admin only)
router.put('/forms/:formId', requireEditPermission(), updateForm);
```

### Advanced Permission Control
```typescript
import { requireMinimumPermission, requireMethodBasedPermission } from '../middleware/formPermissions';

// Require minimum permission level
router.use('/forms/:formId/advanced', requireMinimumPermission('edit'));

// Different permissions per HTTP method
router.use('/forms/:formId/flexible', requireMethodBasedPermission({
  GET: 'view',
  POST: 'submit',
  PUT: 'edit',
  DELETE: 'delete'
}));
```

### Bulk Operations
```typescript
import { requireBulkPermission } from '../middleware/formPermissions';

// Protect bulk operations
router.post('/forms/bulk-operation', requireBulkPermission('edit', {
  formIdsField: 'form_ids',
  maxForms: 20
}));
```

## Service Usage

### Initialize Services
```typescript
import { MultiUserServiceManager } from './services/MultiUserServiceManager';

// Initialize with database pool
const serviceManager = MultiUserServiceManager.getInstance(dbPool);
```

### Service Examples

#### Form Sharing
```typescript
// Share a form
const result = await serviceManager.shareFormWithAudit(
  formId,
  sharedWithUserId,
  ownerUserId,
  'edit',
  expiresAt,
  'Collaboration on project form',
  { ip, userAgent, sessionId }
);

// Check permissions
const permissions = await serviceManager.permissionService.checkPermissions(formId, userId);
```

#### Form Cloning
```typescript
// Clone a form with audit logging
const result = await serviceManager.cloneFormWithAudit(
  formId,
  userId,
  { new_name: 'My Form Copy' },
  { ip, userAgent, sessionId }
);
```

#### Audit Logging
```typescript
// Log form access
await serviceManager.auditService.logAccess(
  formId,
  userId,
  'view',
  { additional: 'metadata' },
  true, // success
  undefined, // no error
  { ip, userAgent, sessionId }
);

// Generate report
const report = await serviceManager.generateComprehensiveAuditReport(
  formId,
  ownerUserId,
  dateFrom,
  dateTo
);
```

## Database Schema

### Core Tables Created
- `form_shares` - Form sharing relationships
- `form_access_logs` - Audit trail for all form access
- `form_clones` - Clone relationships and history
- `forms.visibility` - Added visibility column to forms table

### Functions & Views
- `check_form_permission(formId, userId)` - Permission checking function
- `get_accessible_forms(userId, includePublic)` - Get accessible forms
- `form_statistics_public` - Public form statistics view

## Integration Steps

### 1. Add to Main App Router
```typescript
import { initializeMultiUserRoutes } from './modules/dynamicFormBuilder/routes';

// In your main app.ts
const multiUserRoutes = initializeMultiUserRoutes(dbPool);
app.use('/api', multiUserRoutes);
```

### 2. Protect Existing Routes
```typescript
import { requireEditPermission } from './middleware/formPermissions';

// Protect existing form routes
router.put('/forms/:formId', requireEditPermission(), existingUpdateHandler);
router.delete('/forms/:formId', requireOwnership(), existingDeleteHandler);
```

### 3. Update Existing Services
Services automatically respect permissions when using the MultiUserServiceManager.

## Testing Examples

### Test Form Sharing
```bash
# Share a form
curl -X POST http://localhost:5000/api/forms/123/share \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 456,
    "permission_level": "edit",
    "notes": "Collaboration access"
  }'

# Check permissions
curl http://localhost:5000/api/forms/123/permissions \
  -H "Authorization: Bearer <token>"
```

### Test Form Cloning
```bash
# Clone a form
curl -X POST http://localhost:5000/api/forms/123/clone \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "new_name": "My Form Copy",
    "make_public": false
  }'

# Get clone history
curl http://localhost:5000/api/forms/123/clones \
  -H "Authorization: Bearer <token>"
```

### Test Dashboard
```bash
# Get user dashboard
curl http://localhost:5000/api/dashboard/user \
  -H "Authorization: Bearer <token>"

# Get quick stats
curl http://localhost:5000/api/dashboard/quick-stats \
  -H "Authorization: Bearer <token>"
```

## Features Implemented ✅

### Core Services
- ✅ **FormSharingService** - Complete sharing system with expiration and notes
- ✅ **FormPermissionService** - Hierarchical permission checking
- ✅ **FormCloneService** - Form cloning with template support
- ✅ **FormAuditService** - Comprehensive audit logging with batch processing
- ✅ **MultiUserServiceManager** - Unified service management

### API Endpoints
- ✅ **25+ REST endpoints** covering all multi-user operations
- ✅ **Permission middleware** with multiple protection levels
- ✅ **Dashboard endpoints** for user and system statistics
- ✅ **Bulk operations** support for efficiency

### Security Features
- ✅ **Authentication integration** with existing auth system
- ✅ **Permission enforcement** at API and service levels
- ✅ **Audit logging** for all actions with IP and user agent
- ✅ **Rate limiting** based on permission levels
- ✅ **Access control** with owner/shared/public model

### Database Integration
- ✅ **Complete schema** with foreign keys and indexes
- ✅ **Database functions** for complex queries
- ✅ **Transaction support** for data consistency
- ✅ **Migration scripts** with rollback capability

## Performance Features

### Optimizations
- **Batch processing** for audit logs (configurable batch size)
- **Permission caching** at request level
- **Bulk operations** for multi-form actions
- **Database functions** for complex queries
- **Connection pooling** management
- **Automatic cleanup** of expired shares and old logs

### Monitoring
- **Service health checks** with detailed status
- **Performance metrics** collection
- **Error tracking** and logging
- **Resource usage** monitoring

## Next Steps (Days 4-12)

### Remaining Implementation
1. **Frontend Components** (Days 4-6)
2. **Testing & Security** (Days 7-9)
3. **Deployment & Documentation** (Days 10-12)

### Integration Points
- Update existing FormService to use permission checking
- Update SubmissionService for user-specific access
- Add comprehensive unit tests
- Frontend React components for sharing UI
- Advanced security features (2FA, IP restrictions)

## Configuration

### Environment Variables
```env
# Already configured in existing system
DATABASE_URL=postgresql://...
JWT_SECRET=...

# Optional Redis for better performance
REDIS_URL=redis://localhost:6379

# Multi-user specific settings
FORM_SHARING_ENABLED=true
AUDIT_LOG_RETENTION_DAYS=90
MAX_SHARES_PER_FORM=100
BATCH_AUDIT_SIZE=50
```

The Multi-User Access System is now fully operational at the API level and ready for frontend integration!