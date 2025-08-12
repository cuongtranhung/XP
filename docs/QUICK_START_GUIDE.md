# Hướng Dẫn Nhanh - Hệ Thống Phân Quyền XP

## 🚀 Bắt Đầu Nhanh

### Cho Quản Trị Viên - 5 Phút Setup

#### Bước 1: Tạo Vai Trò
```
1. Vào /role-management
2. Click "+ Tạo vai trò mới"
3. Nhập tên: "Quản lý Kinh doanh"
4. Click "Tạo"
```

#### Bước 2: Gán Quyền Cho Vai Trò
```
1. Click nút "Quyền" của vai trò
2. Chọn các quyền:
   ✓ users.view.all
   ✓ forms.create.all
   ✓ reports.view.department
3. Click "Lưu"
```

#### Bước 3: Gán Vai Trò Cho Người Dùng
```
1. Vào /user-management
2. Click "Vai trò" bên cạnh user
3. Chọn "Quản lý Kinh doanh"
4. Nhập lý do và click "Gán"
```

### Cho Người Dùng - Kiểm Tra Quyền

#### Xem Quyền Của Bạn
```
1. Vào /profile
2. Click tab "Quyền"
3. Xem danh sách quyền hiện có
```

#### Test Quyền
```
1. Vào /permission-guard-demo
2. Xem các chức năng bạn có thể truy cập
3. Test các nút bấm và form
```

---

## 📋 Checklist Triển Khai

### Phase 1: Setup Cơ Bản ✅
- [x] Cài đặt database
- [x] Tạo tables và functions
- [x] Import seed data
- [x] Cấu hình authentication

### Phase 2: Cấu Hình Vai Trò ✅
- [x] Tạo vai trò Super Admin
- [x] Tạo vai trò Administrator
- [x] Tạo vai trò Manager
- [x] Tạo vai trò Staff

### Phase 3: Gán Quyền ✅
- [x] Gán quyền cho Super Admin (*)
- [x] Gán quyền cho Administrator
- [x] Gán quyền cho Manager
- [x] Gán quyền cho Staff

### Phase 4: Test & Verify
- [ ] Test login với các role khác nhau
- [ ] Verify permission checks
- [ ] Test UI conditional rendering
- [ ] Check audit logs

---

## 🎯 Common Tasks

### Tạo User Admin Mới
```bash
# 1. Tạo user
POST /api/auth/register
{
  "email": "admin@company.com",
  "password": "SecurePass123!",
  "name": "Admin User"
}

# 2. Gán role Super Admin
POST /api/users/{userId}/roles
{
  "roleId": "super-admin-role-id",
  "reason": "Quản trị viên hệ thống"
}
```

### Tạo Role Custom
```sql
-- Insert role
INSERT INTO roles (name, display_name, description, type)
VALUES ('custom_role', 'Custom Role', 'Mô tả', 'custom');

-- Gán permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role-id', id FROM permissions 
WHERE resource = 'forms' AND action = 'view';
```

### Check Permission Trong Code

#### Frontend - React
```tsx
// Sử dụng CanAccess component
import { CanAccess } from '@/components/auth/CanAccess';

<CanAccess permission="users.create">
  <button>Create User</button>
</CanAccess>

// Sử dụng hook
import { useCanAccess } from '@/components/auth/CanAccess';

const { check } = useCanAccess();
if (check('users.create')) {
  // Show create button
}
```

#### Backend - Node.js
```javascript
// Middleware check
router.post('/users', 
  requirePermission('users.create'),
  async (req, res) => {
    // Create user logic
  }
);

// Manual check
if (await hasPermission(userId, 'users', 'create')) {
  // Allow action
}
```

---

## 🔧 Troubleshooting Nhanh

### Lỗi: "Không có quyền truy cập"
```
1. Kiểm tra role assignment:
   SELECT * FROM user_roles WHERE user_id = ?

2. Kiểm tra role permissions:
   SELECT * FROM role_permissions WHERE role_id = ?

3. Clear cache và reload:
   localStorage.clear()
   window.location.reload()
```

### Lỗi: "Cannot read permissions"
```
1. Check API endpoint:
   GET /api/auth/permissions

2. Verify token:
   console.log(localStorage.getItem('token'))

3. Check network tab for errors
```

### Lỗi: "Role not found"
```
1. Verify role exists:
   SELECT * FROM roles WHERE name = ?

2. Check role hierarchy:
   SELECT * FROM roles WHERE parent_id IS NOT NULL

3. Ensure role is active:
   UPDATE roles SET is_active = true WHERE id = ?
```

---

## 📊 Permission Matrix Quick Reference

### User Management
| Action | Super Admin | Admin | Manager | Staff | Guest |
|--------|------------|-------|---------|-------|-------|
| View All | ✅ | ✅ | ✅ | ❌ | ❌ |
| View Own | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create | ✅ | ✅ | ❌ | ❌ | ❌ |
| Update | ✅ | ✅ | Own | Own | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ | ❌ |

### Form Builder
| Action | Super Admin | Admin | Manager | Staff | Guest |
|--------|------------|-------|---------|-------|-------|
| View Forms | ✅ | ✅ | ✅ | Own | ❌ |
| Create Form | ✅ | ✅ | ✅ | ✅ | ❌ |
| Edit Form | ✅ | ✅ | Own | Own | ❌ |
| Delete Form | ✅ | ✅ | Own | ❌ | ❌ |
| View Submissions | ✅ | ✅ | Own | Own | ❌ |

### Reports & Analytics
| Action | Super Admin | Admin | Manager | Staff | Guest |
|--------|------------|-------|---------|-------|-------|
| View All Reports | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Dept Reports | ✅ | ✅ | ✅ | ❌ | ❌ |
| Export Reports | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create Reports | ✅ | ✅ | ✅ | ❌ | ❌ |

---

## 🔐 Security Best Practices

### 1. Password Policy
```javascript
// Minimum requirements
{
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true
}
```

### 2. Session Management
```javascript
// Auto logout after inactivity
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Refresh token rotation
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days
```

### 3. Audit Logging
```sql
-- Track all permission changes
CREATE TRIGGER audit_permission_changes
AFTER INSERT OR UPDATE OR DELETE ON user_roles
FOR EACH ROW EXECUTE FUNCTION log_permission_change();
```

---

## 📱 Mobile App Integration

### API Authentication
```javascript
// Login and get token
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

const { token, user } = await response.json();

// Use token for subsequent requests
headers: {
  'Authorization': `Bearer ${token}`
}
```

### Check Permissions
```javascript
// Get user permissions
const permissions = await fetch('/api/auth/permissions', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Check specific permission
const canCreate = permissions.some(p => 
  p.resource === 'users' && 
  p.action === 'create'
);
```

---

## 📈 Monitoring & Analytics

### Key Metrics to Track
1. **Active Users by Role**: Track role distribution
2. **Permission Usage**: Most/least used permissions
3. **Failed Access Attempts**: Security monitoring
4. **Role Changes**: Audit trail
5. **Login Patterns**: Usage analytics

### Dashboard Queries
```sql
-- Users by role
SELECT r.display_name, COUNT(ur.user_id) as user_count
FROM roles r
LEFT JOIN user_roles ur ON r.id = ur.role_id
GROUP BY r.id, r.display_name;

-- Recent permission changes
SELECT * FROM audit_logs
WHERE action LIKE '%permission%'
ORDER BY created_at DESC
LIMIT 100;
```

---

## 🆘 Support Contacts

### Technical Support
- **Email**: tech@xp-platform.com
- **Hotline**: 1900-1234
- **Hours**: 8:00 - 17:00 (Mon-Fri)

### Emergency Contacts
- **Security Issues**: security@xp-platform.com
- **System Down**: ops@xp-platform.com
- **On-call**: +84 123 456 789

### Resources
- [Full Documentation](./USER_ROLE_PERMISSION_SYSTEM.md)
- [API Reference](./API_REFERENCE.md)
- [Video Tutorials](https://youtube.com/xp-platform)
- [Community Forum](https://forum.xp-platform.com)

---

## ✅ Deployment Checklist

### Pre-Production
- [ ] Database backup
- [ ] Test migration scripts
- [ ] Verify seed data
- [ ] Test all roles
- [ ] Security audit

### Production
- [ ] Deploy backend
- [ ] Deploy frontend
- [ ] Run migrations
- [ ] Import seed data
- [ ] Verify permissions
- [ ] Monitor logs

### Post-Deployment
- [ ] User training
- [ ] Documentation update
- [ ] Performance monitoring
- [ ] Security scanning
- [ ] Backup verification

---

*Quick Start Guide v1.0 - Updated: 11/01/2024*