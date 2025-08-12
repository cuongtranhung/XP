# Hệ Thống Phân Quyền Người Dùng XP - Tài Liệu Hướng Dẫn

## Mục Lục
1. [Giới Thiệu](#giới-thiệu)
2. [Hướng Dẫn Cho Quản Trị Viên](#hướng-dẫn-cho-quản-trị-viên)
3. [Hướng Dẫn Cho Người Dùng](#hướng-dẫn-cho-người-dùng)
4. [Tham Khảo Kỹ Thuật](#tham-khảo-kỹ-thuật)

---

## Giới Thiệu

### Tổng Quan Hệ Thống
Hệ thống Phân Quyền Người Dùng XP là một giải pháp toàn diện để quản lý quyền truy cập và phân quyền trong ứng dụng. Hệ thống được xây dựng theo mô hình RBAC (Role-Based Access Control) với các tính năng nâng cao.

### Các Khái Niệm Cơ Bản

#### 1. **Người Dùng (Users)**
- Tài khoản cá nhân trong hệ thống
- Mỗi người dùng có thể có một hoặc nhiều vai trò
- Có thể được gán quyền trực tiếp hoặc thông qua vai trò

#### 2. **Vai Trò (Roles)**
- Tập hợp các quyền được định nghĩa trước
- Có thể gán cho nhiều người dùng
- Phân cấp theo hierarchy (vai trò cha/con)

#### 3. **Quyền (Permissions)**
- Định nghĩa khả năng thực hiện hành động cụ thể
- Cấu trúc: `resource.action.scope`
  - **Resource**: Tài nguyên (users, forms, reports...)
  - **Action**: Hành động (view, create, update, delete...)
  - **Scope**: Phạm vi (all, own, department...)

#### 4. **Nhóm (Groups)**
- Tập hợp người dùng theo phòng ban hoặc dự án
- Hỗ trợ quản lý quyền theo nhóm

---

## Hướng Dẫn Cho Quản Trị Viên

### 1. Quản Lý Người Dùng

#### Truy Cập Trang Quản Lý Người Dùng
1. Đăng nhập với tài khoản quản trị
2. Vào menu **"Quản lý" → "Người dùng"**
3. Hoặc truy cập trực tiếp: `/user-management`

#### Xem Danh Sách Người Dùng
- **Thông tin hiển thị**:
  - Avatar và tên người dùng
  - Email và trạng thái xác thực
  - Vai trò hiện tại
  - Trạng thái tài khoản (Active/Inactive)
  - Thời gian đăng nhập cuối

- **Tính năng tìm kiếm**:
  - Tìm theo tên, email
  - Lọc theo vai trò
  - Lọc theo trạng thái

#### Gán Vai Trò Cho Người Dùng
1. Click vào nút **"Vai trò"** bên cạnh người dùng
2. Trong modal hiện ra:
   - Chọn vai trò từ danh sách
   - Nhập lý do gán vai trò
   - Click **"Gán vai trò"**
3. Hệ thống sẽ tự động cập nhật quyền

#### Thao Tác Hàng Loạt
1. Chọn nhiều người dùng bằng checkbox
2. Chọn thao tác từ menu:
   - **Kích hoạt**: Bật tài khoản
   - **Vô hiệu hóa**: Tắt tài khoản tạm thời
   - **Gán vai trò**: Gán vai trò cho nhiều người
   - **Xóa vai trò**: Xóa vai trò khỏi người dùng

### 2. Quản Lý Vai Trò

#### Truy Cập Trang Quản Lý Vai Trò
1. Vào menu **"Quản lý" → "Vai trò"**
2. Hoặc truy cập: `/role-management`

#### Tạo Vai Trò Mới
1. Click nút **"+ Tạo vai trò mới"**
2. Điền thông tin:
   - **Tên vai trò**: Tên hiển thị (VD: "Quản lý Kinh doanh")
   - **Mô tả**: Mô tả chi tiết về vai trò
   - **Loại vai trò**: System/Custom
   - **Vai trò cha**: Chọn nếu cần kế thừa quyền
3. Click **"Tạo vai trò"**

#### Gán Quyền Cho Vai Trò
1. Click vào nút **"Quyền"** của vai trò
2. Trong giao diện phân quyền:
   - **Tab "Theo Tài nguyên"**: Xem quyền theo resource
   - **Tab "Theo Hành động"**: Xem quyền theo action
   - **Tab "Ma trận"**: Xem tổng quan dạng bảng
3. Chọn quyền bằng cách tick checkbox
4. Click **"Lưu thay đổi"**

#### Phân Cấp Vai Trò
- Vai trò con tự động kế thừa quyền từ vai trò cha
- Có thể override quyền ở vai trò con
- Xem hierarchy trong tab **"Cây vai trò"**

### 3. Quản Lý Quyền

#### Cấu Trúc Quyền
```
resource.action.scope
```

**Ví dụ**:
- `users.view.all` - Xem tất cả người dùng
- `users.view.own` - Chỉ xem thông tin của mình
- `forms.create.department` - Tạo form trong phòng ban

#### Quyền Đặc Biệt
- **Wildcard** (`*`): Áp dụng cho tất cả
  - `*.view.all` - Xem tất cả mọi thứ
  - `users.*.all` - Mọi quyền trên users

#### Kiểm Tra Quyền
1. Vào trang **"Test Quyền"**: `/permission-guard-demo`
2. Xem danh sách quyền hiện tại
3. Test các chức năng với quyền khác nhau

### 4. Quản Lý Nhóm

#### Tạo Nhóm Mới
1. Vào **"Quản lý" → "Nhóm"**
2. Click **"+ Tạo nhóm"**
3. Điền thông tin:
   - Tên nhóm
   - Mô tả
   - Loại nhóm (Department/Project/Custom)
4. Thêm thành viên vào nhóm

#### Gán Quyền Theo Nhóm
1. Chọn nhóm cần gán quyền
2. Click **"Quản lý quyền"**
3. Gán vai trò hoặc quyền trực tiếp cho nhóm
4. Tất cả thành viên sẽ nhận được quyền

### 5. Báo Cáo & Phân Tích

#### Dashboard Phân Quyền
- **Tổng quan**: Số lượng users, roles, permissions
- **Biểu đồ**: Phân bố vai trò, quyền sử dụng nhiều nhất
- **Cảnh báo**: Tài khoản chưa có vai trò, quyền conflict

#### Audit Log
- Xem lịch sử thay đổi quyền
- Theo dõi ai đã gán/xóa quyền
- Export báo cáo audit

### 6. Best Practices

#### Nguyên Tắc Least Privilege
- Chỉ gán quyền tối thiểu cần thiết
- Review định kỳ và thu hồi quyền không cần

#### Tổ Chức Vai Trò
```
Super Admin
├── Admin
│   ├── User Admin
│   └── System Admin
├── Manager
│   ├── Department Manager
│   └── Project Manager
└── User
    ├── Staff
    └── Guest
```

#### Naming Convention
- Vai trò: `[Level]_[Function]` (VD: `Manager_Sales`)
- Quyền: `resource.action.scope` (VD: `reports.export.department`)

---

## Hướng Dẫn Cho Người Dùng

### 1. Hiểu Về Quyền Của Bạn

#### Xem Quyền Hiện Tại
1. Vào **"Tài khoản" → "Quyền của tôi"**
2. Hoặc truy cập: `/profile`
3. Tab **"Quyền"** hiển thị:
   - Vai trò được gán
   - Danh sách quyền chi tiết
   - Nhóm tham gia

#### Yêu Cầu Quyền Mới
1. Vào **"Yêu cầu quyền"**
2. Chọn quyền cần thiết
3. Nhập lý do yêu cầu
4. Gửi cho quản trị phê duyệt

### 2. Sử Dụng Quyền

#### Quyền Xem (View)
- Cho phép xem nội dung
- Không thể chỉnh sửa
- Phạm vi: all/own/department

#### Quyền Tạo (Create)
- Tạo mới tài nguyên
- Thường đi kèm quyền view
- Áp dụng validation rules

#### Quyền Sửa (Update)
- Chỉnh sửa tài nguyên hiện có
- Có thể giới hạn theo owner
- Audit log tự động

#### Quyền Xóa (Delete)
- Xóa tài nguyên
- Thường yêu cầu xác nhận
- Có thể soft delete

### 3. Giao Diện Theo Quyền

#### Conditional UI
- Nút/menu chỉ hiện khi có quyền
- Form fields ẩn/hiện theo quyền
- Readonly mode cho view-only

#### Access Denied
- Thông báo khi không có quyền
- Hướng dẫn yêu cầu quyền
- Redirect về trang phù hợp

### 4. Troubleshooting

#### Không Thấy Chức Năng
1. Kiểm tra quyền hiện tại
2. Xác nhận vai trò đã được gán
3. Logout và login lại
4. Liên hệ admin nếu vẫn lỗi

#### Bị Từ Chối Truy Cập
- Kiểm tra scope của quyền
- Xác nhận ownership (nếu scope=own)
- Kiểm tra department (nếu scope=department)

---

## Tham Khảo Kỹ Thuật

### 1. API Endpoints

#### Authentication & Authorization
```
POST   /api/auth/login         - Đăng nhập
POST   /api/auth/logout        - Đăng xuất
GET    /api/auth/me            - Thông tin user hiện tại
GET    /api/auth/permissions   - Quyền của user
```

#### User Management
```
GET    /api/users              - Danh sách users
GET    /api/users/:id          - Chi tiết user
PUT    /api/users/:id          - Cập nhật user
POST   /api/users/:id/roles    - Gán vai trò
DELETE /api/users/:id/roles    - Xóa vai trò
```

#### Role Management
```
GET    /api/roles              - Danh sách roles
POST   /api/roles              - Tạo role mới
PUT    /api/roles/:id          - Cập nhật role
DELETE /api/roles/:id          - Xóa role
POST   /api/roles/:id/permissions - Gán quyền cho role
```

#### Permission Management
```
GET    /api/permissions        - Danh sách permissions
GET    /api/permissions/check  - Kiểm tra quyền
POST   /api/permissions/grant  - Cấp quyền trực tiếp
POST   /api/permissions/revoke - Thu hồi quyền
```

### 2. Database Schema

#### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### Roles Table
```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY,
  name VARCHAR(100) UNIQUE,
  display_name VARCHAR(255),
  description TEXT,
  type role_type,
  parent_id UUID REFERENCES roles(id),
  created_at TIMESTAMP
);
```

#### Permissions Table
```sql
CREATE TABLE permissions (
  id UUID PRIMARY KEY,
  resource VARCHAR(100),
  action VARCHAR(50),
  scope VARCHAR(50),
  display_name VARCHAR(255),
  description TEXT
);
```

#### User_Roles Junction
```sql
CREATE TABLE user_roles (
  user_id UUID REFERENCES users(id),
  role_id UUID REFERENCES roles(id),
  assigned_at TIMESTAMP,
  assigned_by UUID,
  PRIMARY KEY (user_id, role_id)
);
```

#### Role_Permissions Junction
```sql
CREATE TABLE role_permissions (
  role_id UUID REFERENCES roles(id),
  permission_id UUID REFERENCES permissions(id),
  granted_at TIMESTAMP,
  PRIMARY KEY (role_id, permission_id)
);
```

### 3. Frontend Components

#### Permission Context
```typescript
// contexts/PermissionContext.tsx
interface PermissionContextType {
  permissions: Permission[];
  hasPermission: (resource: string, action: string, scope?: string) => boolean;
  canAccess: (permission: string) => boolean;
  refreshPermissions: () => Promise<void>;
}
```

#### CanAccess Component
```tsx
// Conditional rendering based on permissions
<CanAccess permission="users.create">
  <button>Create User</button>
</CanAccess>

// With fallback
<CanAccess 
  permission="admin.panel" 
  fallback={<p>No access</p>}
>
  <AdminPanel />
</CanAccess>
```

#### Protected Routes
```tsx
// Route with permission check
<Route
  path="/admin"
  element={
    <ProtectedRoute permission="admin.access">
      <AdminDashboard />
    </ProtectedRoute>
  }
/>
```

### 4. Security Considerations

#### Token Management
- JWT tokens với expiry time
- Refresh token rotation
- Secure cookie storage

#### Permission Caching
- Frontend cache với TTL
- Invalidate on role change
- Sync với backend định kỳ

#### Audit Logging
- Log mọi permission changes
- Track access attempts
- Regular audit reviews

#### Best Practices
1. **Defense in Depth**: Check quyền ở cả frontend và backend
2. **Fail Secure**: Mặc định deny nếu không rõ ràng
3. **Regular Review**: Audit quyền định kỳ
4. **Separation of Duties**: Phân tách quyền admin
5. **Least Privilege**: Gán quyền tối thiểu cần thiết

### 5. Performance Optimization

#### Caching Strategy
```typescript
// Permission cache với TTL
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const permissionCache = new Map();

function getCachedPermissions(userId) {
  const cached = permissionCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}
```

#### Database Indexes
```sql
-- Optimize permission lookups
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_permissions_resource ON permissions(resource, action);
```

#### Query Optimization
- Use materialized views cho permission matrix
- Batch permission checks
- Lazy load permissions khi cần

### 6. Troubleshooting Guide

#### Common Issues

**1. User không thấy được quyền mới**
- Clear browser cache
- Check role assignment
- Verify permission grant
- Restart session

**2. Permission denied errors**
- Check backend logs
- Verify token validity
- Check permission scope
- Confirm resource ownership

**3. Slow permission checks**
- Review cache settings
- Check database indexes
- Optimize permission queries
- Consider denormalization

#### Debug Mode
```javascript
// Enable debug logging
localStorage.setItem('DEBUG_PERMISSIONS', 'true');

// View permission checks in console
window.__PERMISSION_DEBUG__ = true;
```

#### Health Check Endpoints
```
GET /api/health/permissions - Check permission service
GET /api/health/cache      - Check cache status
GET /api/health/database   - Check DB connectivity
```

---

## Phụ Lục

### A. Glossary

| Thuật ngữ | Tiếng Anh | Mô tả |
|-----------|-----------|-------|
| Người dùng | User | Tài khoản trong hệ thống |
| Vai trò | Role | Tập hợp quyền |
| Quyền | Permission | Khả năng thực hiện hành động |
| Nhóm | Group | Tập hợp users |
| Phạm vi | Scope | Giới hạn của quyền |
| Tài nguyên | Resource | Đối tượng được bảo vệ |
| Hành động | Action | Thao tác trên resource |

### B. Quick Reference

#### Role Hierarchy
```
Super Administrator (*)
├── Administrator
│   ├── User Administrator
│   ├── System Administrator
│   └── Security Administrator
├── Manager
│   ├── Department Manager
│   ├── Project Manager
│   └── Team Leader
├── Staff
│   ├── Senior Staff
│   └── Junior Staff
└── Guest (read-only)
```

#### Permission Matrix Example
| Resource | View | Create | Update | Delete |
|----------|------|--------|--------|--------|
| Users | ✓ All | ✓ Admin | ✓ Own | ✓ Admin |
| Forms | ✓ All | ✓ Staff | ✓ Own | ✓ Manager |
| Reports | ✓ Dept | ✓ Manager | ✓ Manager | ✓ Admin |
| Settings | ✓ Own | ✗ | ✓ Own | ✗ |

### C. Contact & Support

**Technical Support**
- Email: support@xp-platform.com
- Phone: 1900-xxxx
- Hours: 8:00 - 17:00 (Mon-Fri)

**Documentation**
- Online Docs: https://docs.xp-platform.com
- Video Tutorials: https://learn.xp-platform.com
- API Reference: https://api.xp-platform.com/docs

**Community**
- Forum: https://forum.xp-platform.com
- Discord: https://discord.gg/xp-platform
- GitHub: https://github.com/xp-platform

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-01-11 | Initial release |
| 1.0.1 | 2024-01-11 | Added troubleshooting guide |
| 1.0.2 | 2024-01-11 | Updated API documentation |

---

*Tài liệu này được cập nhật lần cuối: 11/01/2024*
*© 2024 XP Platform. All rights reserved.*