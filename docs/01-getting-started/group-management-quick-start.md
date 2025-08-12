---
title: Group Management - Quick Start Guide
version: 1.0.0
date: 2025-01-11
author: Claude Code
status: completed
tags: [quick-start, group-management, setup]
---

# Group Management - Quick Start Guide

## 🚀 Quick Setup

### Prerequisites
```bash
# Required
Node.js >= 18
PostgreSQL >= 13
npm >= 8
```

### Start Services
```bash
# Backend (Terminal 1)
cd backend
PORT=5000 npm run dev

# Frontend (Terminal 2)  
cd frontend
PORT=3002 npm run dev
```

### Access Application
- **Frontend**: http://localhost:3002
- **Backend API**: http://localhost:5000
- **Group Management**: http://localhost:3002/group-management

## 🎯 Core Features Overview

### 📊 Dashboard
- **Statistics Cards**: Real-time group metrics
- **Export Button**: Comprehensive Excel reports
- **Create Group**: Modal để tạo nhóm mới
- **Filters**: Search và filter groups

### ➕ Create Group
- **Group Name**: System identifier (alphanumeric, _, -)
- **Display Name**: User-friendly name
- **Description**: Optional description
- **Group Type**: Department/Project/Custom

### 👥 Group Details
- **Member List**: View all group members
- **Role Management**: Change member roles (Member/Manager/Owner)
- **Add Members**: Search và add users
- **Remove Members**: Remove với confirmation
- **Export Members**: Excel export
- **Import Members**: Bulk import từ Excel
- **Permissions**: Manage group permissions

## 🛠️ Developer Quick Reference

### Key Files
```
Frontend:
├── src/pages/GroupManagementPage.tsx         # Main dashboard
├── src/components/group-management/
│   ├── CreateGroupModal.tsx                 # Create group
│   ├── GroupDetailModal.tsx                 # Group details & members
│   ├── GroupPermissionsModal.tsx            # Permission management
│   └── UserSearchModal.tsx                  # User selection
├── src/services/
│   ├── groupManagementService.ts            # API calls
│   └── exportService.ts                     # Excel export
└── src/types/group-management.ts            # TypeScript types

Backend:
├── src/modules/user-management/
│   ├── routes/groupRoutes.ts                # API endpoints
│   ├── services/GroupService.ts             # Business logic
│   └── types/index.ts                       # Type definitions
```

### API Quick Reference
```typescript
// Get all groups
GET /api/user-management/groups
?search=keyword&group_type=department&is_active=true

// Create group
POST /api/user-management/groups
{
  "name": "it_team",
  "display_name": "IT Team", 
  "group_type": "department"
}

// Get group members
GET /api/user-management/groups/:id/members
?page=1&limit=10

// Add members (bulk)
POST /api/user-management/groups/:id/members
{
  "user_ids": ["user1", "user2"],
  "role_in_group": "member"
}

// Statistics
GET /api/user-management/groups/statistics
```

### Common Code Patterns

#### Service Usage
```typescript
import groupManagementService from '../services/groupManagementService';

// Get groups với filters
const response = await groupManagementService.getGroups({
  search: 'marketing',
  group_type: 'department',
  is_active: true
});

// Create new group
const newGroup = await groupManagementService.createGroup({
  name: 'marketing_team',
  display_name: 'Marketing Team',
  group_type: 'department',
  description: 'Marketing and PR team'
});
```

#### Export Usage
```typescript
import exportService from '../services/exportService';

// Export comprehensive report
await exportService.exportComprehensiveReport();

// Export group members
await exportService.exportGroupMembersToExcel(
  groupId, 
  groupName, 
  members
);
```

#### Modal Integration
```typescript
const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

// In JSX
<CreateGroupModal
  isOpen={isCreateModalOpen}
  onClose={() => setIsCreateModalOpen(false)}
  onGroupCreated={() => {
    loadGroups();
    setIsCreateModalOpen(false);
  }}
/>
```

## 🔧 Configuration

### Environment Variables
```env
# Backend
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dynamic_forms
DB_USER=your_user
DB_PASS=your_password

# Frontend (vite.config.ts)
server.port=3002
server.proxy['/api'].target='http://localhost:5000'
```

### Database Setup
```sql
-- Ensure tables exist
SELECT * FROM user_groups;
SELECT * FROM user_group_members;

-- Check if view exists
SELECT * FROM user_groups_summary LIMIT 1;
```

## 🐛 Common Issues & Solutions

### 1. Port Conflicts
```bash
# Kill processes
lsof -ti:3002 | xargs kill -9
lsof -ti:5000 | xargs kill -9

# Restart
PORT=5000 npm run dev
PORT=3002 npm run dev
```

### 2. API Connection Issues
- Check backend is running on port 5000
- Verify proxy configuration in vite.config.ts
- Check network/firewall settings

### 3. Database Errors
```bash
# Test connection
PGPASSWORD='your_password' psql -h localhost -U your_user -d dynamic_forms -c "SELECT COUNT(*) FROM user_groups;"
```

### 4. TypeScript Errors
```bash
# Check types
npm run typecheck

# Common fixes
# - Update interface definitions
# - Check import paths
# - Verify component props
```

## 📚 Advanced Usage

### Custom Validation
```typescript
// In CreateGroupModal.tsx
const validateForm = (): boolean => {
  const newErrors: {[key: string]: string} = {};
  
  // Custom validation logic
  if (!/^[a-zA-Z0-9_-]+$/.test(formData.name)) {
    newErrors.name = 'Invalid characters in group name';
  }
  
  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};
```

### Custom Export Formats
```typescript
// Add to exportService.ts
async exportCustomFormat(groups: Group[]): Promise<void> {
  // Custom export logic
  const data = groups.map(group => ({
    // Custom formatting
  }));
  
  // Generate file
  XLSX.writeFile(wb, 'custom_export.xlsx');
}
```

### Permission Integration
```typescript
// Check user permissions before actions
const canManageGroup = (userPermissions: string[], groupId: string) => {
  return userPermissions.includes('groups_update') || 
         userPermissions.includes('group_members_manage');
};

// Conditional rendering
{canManageGroup(permissions, group.id) && (
  <Button onClick={handleEditGroup}>Edit Group</Button>
)}
```

## 🎯 Testing Checklist

### Functional Testing
- [ ] Create group với all fields
- [ ] Update group information
- [ ] Add single member
- [ ] Add multiple members
- [ ] Change member role
- [ ] Remove member
- [ ] Export group data
- [ ] Export member list
- [ ] Search users
- [ ] Filter groups
- [ ] Permission management

### Browser Testing
- [ ] Chrome
- [ ] Firefox  
- [ ] Safari
- [ ] Mobile responsiveness

### Performance Testing
- [ ] Large group lists (100+ groups)
- [ ] Large member lists (100+ members)
- [ ] Export performance (1000+ records)
- [ ] Search response time

## 📞 Support

### Debug Information
```typescript
// Enable debug logging
localStorage.setItem('debug', 'group-management');

// Check service status
console.log('Backend:', await fetch('/api/user-management/groups/test'));
```

### Log Locations
- Browser Console: F12 → Console
- Backend Logs: Terminal output
- Network Requests: F12 → Network

---

**Quick Start Complete!** 🎉

For detailed documentation, see: [User Group Modal System](../03-features/user-group-modal-system.md)