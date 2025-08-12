# User Management Module - Thiết kế đơn giản hóa

## 1. Tổng quan
Module User Management với các tính năng đã được đơn giản hóa:
- **Approve**: Chỉ là trạng thái Enable/Disable (is_approved: true/false)
- **Block**: Chỉ là trạng thái Enable/Disable (is_blocked: true/false)
- **User Groups**: Quản lý nhóm người dùng
- **User Roles**: Quản lý vai trò và phân quyền

## 2. Cấu trúc Database

### 2.1 Bảng Users (mở rộng)
```sql
users {
  -- Existing fields
  id UUID PRIMARY KEY
  email VARCHAR(255) UNIQUE
  password_hash VARCHAR(255)
  full_name VARCHAR(255)
  avatar_url VARCHAR(500)
  
  -- New fields
  username VARCHAR(100) UNIQUE
  phone_number VARCHAR(20)
  department VARCHAR(100)
  position VARCHAR(100)
  
  -- Simple status fields
  status VARCHAR(20) -- active, inactive, suspended
  is_approved BOOLEAN DEFAULT true  -- Simple Enable/Disable
  is_blocked BOOLEAN DEFAULT false  -- Simple Enable/Disable
  
  -- Timestamps
  last_login TIMESTAMP
  last_activity TIMESTAMP
  created_at TIMESTAMP
  updated_at TIMESTAMP
  deleted_at TIMESTAMP
}
```

### 2.2 Bảng Roles
```sql
roles {
  id UUID PRIMARY KEY
  name VARCHAR(50) UNIQUE
  display_name VARCHAR(100)
  description TEXT
  priority INTEGER
  is_system BOOLEAN
  is_active BOOLEAN
  created_at TIMESTAMP
  updated_at TIMESTAMP
}
```

### 2.3 Bảng Permissions
```sql
permissions {
  id UUID PRIMARY KEY
  resource VARCHAR(100)
  action VARCHAR(50)
  scope VARCHAR(20) -- all, own, department, group
  description TEXT
  created_at TIMESTAMP
}
```

### 2.4 Bảng User Groups
```sql
user_groups {
  id UUID PRIMARY KEY
  name VARCHAR(100) UNIQUE
  display_name VARCHAR(255)
  description TEXT
  group_type VARCHAR(50) -- department, project, custom
  parent_group_id UUID
  metadata JSONB
  is_active BOOLEAN
  created_at TIMESTAMP
  updated_at TIMESTAMP
}
```

### 2.5 Bảng User Roles (Junction)
```sql
user_roles {
  user_id UUID
  role_id UUID
  assigned_by UUID
  assigned_at TIMESTAMP
  expires_at TIMESTAMP
  PRIMARY KEY (user_id, role_id)
}
```

### 2.6 Bảng User Group Members (Junction)
```sql
user_group_members {
  user_id UUID
  group_id UUID
  role_in_group VARCHAR(20) -- member, manager, owner
  joined_at TIMESTAMP
  added_by UUID
  PRIMARY KEY (user_id, group_id)
}
```

### 2.7 Bảng Audit Logs
```sql
audit_logs {
  id UUID PRIMARY KEY
  user_id UUID
  action VARCHAR(100)
  entity_type VARCHAR(50)
  entity_id UUID
  old_values JSONB
  new_values JSONB
  ip_address INET
  user_agent TEXT
  session_id VARCHAR(255)
  created_at TIMESTAMP
}
```

## 3. API Endpoints

### 3.1 User Management
- `GET /api/users` - Lấy danh sách users với filters và pagination
- `GET /api/users/:id` - Lấy thông tin chi tiết user
- `POST /api/users` - Tạo user mới
- `PUT /api/users/:id` - Cập nhật thông tin user
- `DELETE /api/users/:id` - Xóa user (soft delete)

### 3.2 Approval & Blocking (Đơn giản hóa)
- `PUT /api/users/:id/approve` - Enable approval (is_approved = true)
- `PUT /api/users/:id/disapprove` - Disable approval (is_approved = false)
- `PUT /api/users/:id/block` - Enable blocking (is_blocked = true)
- `PUT /api/users/:id/unblock` - Disable blocking (is_blocked = false)

### 3.3 Roles Management
- `GET /api/roles` - Lấy danh sách roles
- `POST /api/roles` - Tạo role mới
- `PUT /api/roles/:id` - Cập nhật role
- `DELETE /api/roles/:id` - Xóa role

### 3.4 User Roles Assignment
- `GET /api/users/:id/roles` - Lấy roles của user
- `POST /api/users/:id/roles` - Gán role cho user
- `DELETE /api/users/:id/roles/:roleId` - Gỡ role khỏi user

### 3.5 Groups Management
- `GET /api/groups` - Lấy danh sách groups
- `POST /api/groups` - Tạo group mới
- `PUT /api/groups/:id` - Cập nhật group
- `DELETE /api/groups/:id` - Xóa group

### 3.6 Group Members
- `GET /api/groups/:id/members` - Lấy members của group
- `POST /api/groups/:id/members` - Thêm user vào group
- `PUT /api/groups/:id/members/:userId` - Cập nhật role trong group
- `DELETE /api/groups/:id/members/:userId` - Xóa user khỏi group

### 3.7 Statistics & Reports
- `GET /api/users/statistics` - Thống kê users
- `GET /api/audit-logs` - Xem audit logs

## 4. Frontend Components

### 4.1 User List Component
```typescript
interface UserListProps {
  filters: {
    status?: string[]
    department?: string
    is_blocked?: boolean
    is_approved?: boolean
    search?: string
  }
  onUserSelect: (user: User) => void
}
```

### 4.2 User Detail Component
```typescript
interface UserDetailProps {
  userId: string
  onApprovalToggle: (approved: boolean) => void
  onBlockToggle: (blocked: boolean) => void
  onRoleUpdate: (roles: Role[]) => void
  onGroupUpdate: (groups: Group[]) => void
}
```

### 4.3 Quick Actions Component
```typescript
interface QuickActionsProps {
  user: User
  onApprove: () => void    // Toggle is_approved = true
  onDisapprove: () => void // Toggle is_approved = false
  onBlock: () => void      // Toggle is_blocked = true
  onUnblock: () => void    // Toggle is_blocked = false
}
```

## 5. Business Logic đơn giản hóa

### 5.1 Approval Logic
- Khi `is_approved = false`: User không thể đăng nhập hoặc truy cập hệ thống
- Khi `is_approved = true`: User có thể sử dụng hệ thống bình thường
- Admin có thể toggle trạng thái này bất kỳ lúc nào

### 5.2 Blocking Logic
- Khi `is_blocked = true`: User bị chặn hoàn toàn, không thể đăng nhập
- Khi `is_blocked = false`: User hoạt động bình thường
- Status tự động chuyển sang 'suspended' khi blocked

### 5.3 Permission Check đơn giản
```typescript
function canUserAccess(user: User): boolean {
  return user.is_approved && !user.is_blocked && user.status === 'active';
}
```

## 6. Security Model

### 6.1 Authentication
- JWT tokens với refresh token
- Session management với Redis
- Password hashing với bcrypt

### 6.2 Authorization
- Role-based access control (RBAC)
- Permission inheritance qua role priority
- Resource-level permissions

### 6.3 Row Level Security (RLS)
- Tự động filter dữ liệu dựa trên user permissions
- Department-level isolation
- Group-based access control

## 7. Monitoring & Audit

### 7.1 Audit Events
- CREATE_USER
- UPDATE_USER
- DELETE_USER
- APPROVE_USER / DISAPPROVE_USER
- BLOCK_USER / UNBLOCK_USER
- ASSIGN_ROLE / REMOVE_ROLE
- ADD_TO_GROUP / REMOVE_FROM_GROUP

### 7.2 Metrics
- Total users
- Active users
- Blocked users
- Unapproved users
- Users by department
- Users by role
- Recent registrations

## 8. Implementation Priority

### Phase 1: Core User Management (Week 1)
- User CRUD operations
- Simple Approval/Block toggles
- Basic authentication

### Phase 2: Roles & Permissions (Week 2)
- Role management
- Permission assignment
- RBAC implementation

### Phase 3: Groups (Week 3)
- Group CRUD
- Member management
- Group hierarchy

### Phase 4: UI Components (Week 4)
- User list with filters
- User detail view
- Quick actions
- Bulk operations

### Phase 5: Testing & Optimization (Week 5)
- Unit tests
- Integration tests
- Performance optimization
- Security audit