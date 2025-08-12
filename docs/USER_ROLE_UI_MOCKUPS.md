# 🎨 USER ROLE SYSTEM - UI MOCKUPS & DESIGN SPECIFICATIONS

**Date**: January 10, 2025  
**Version**: 2.0.0  
**Project**: XP User Management System

## 📌 OVERVIEW

This document provides detailed UI mockups and design specifications for the User Role Management System. All mockups are presented in ASCII art format for easy reference during development.

## 🖼️ DETAILED UI MOCKUPS

### 1. USER MANAGEMENT TABLE WITH ROLES

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ User Management                                         [+ Thêm User] [⚙️]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🔍 [Tìm kiếm user...]                    [▼ Lọc vai trò] [▼ Trạng thái]    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ ┌────┬──────────────────┬──────────────────┬────────────┬─────────────────┐│
│ │ □  │ Thông tin User   │ Vai trò          │ Trạng thái │ Thao tác        ││
│ ├────┼──────────────────┼──────────────────┼────────────┼─────────────────┤│
│ │ □  │ [👤] Nguyễn Văn A│ [Super Admin]    │ ✅ Active  │ [✏️][👥][🗑️]   ││
│ │    │ admin@xp.com.vn  │ Priority: 1000   │ No expiry  │                 ││
│ │    │ ID: #12345       │ 🔒 System Role   │            │                 ││
│ ├────┼──────────────────┼──────────────────┼────────────┼─────────────────┤│
│ │ □  │ [👤] Trần Thị B  │ [Admin] [Manager]│ ✅ Active  │ [✏️][👥][🗑️]   ││
│ │    │ manager@xp.vn    │ Priority: 900    │ No expiry  │                 ││
│ │    │ ID: #12346       │ +1 more role     │            │                 ││
│ ├────┼──────────────────┼──────────────────┼────────────┼─────────────────┤│
│ │ □  │ [👤] Lê Văn C    │ [User]           │ ✅ Active  │ [✏️][👥][🗑️]   ││
│ │    │ user@xp.com.vn   │ Priority: 100    │ ⏰ 5 days  │                 ││
│ │    │ ID: #12347       │                  │            │                 ││
│ └────┴──────────────────┴──────────────────┴────────────┴─────────────────┘│
│                                                                              │
│ [□ Chọn tất cả]  [Gán vai trò hàng loạt] [Xóa vai trò]                    │
│                                                                              │
│ Hiển thị 1-10 của 45 users                              [◀] 1 2 3 4 5 [▶]  │
└─────────────────────────────────────────────────────────────────────────────┘

Legend:
[👥] = Quản lý vai trò
🔒 = Vai trò hệ thống (không thể xóa)
⏰ = Vai trò tạm thời có thời hạn
+N = Còn N vai trò khác
```

### 2. ROLE ASSIGNMENT MODAL

```
┌──────────────────────────────────────────────────────────────────┐
│ 🎭 Phân Quyền Cho User                                    [X]   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 👤 User: Trần Thị B (manager@xp.com.vn)                        │
│ ─────────────────────────────────────────────────────────────   │
│                                                                  │
│ 📋 Vai Trò Hiện Tại:                                           │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ ✅ Admin        Priority: 900   Không thời hạn    [🗑️]   │   │
│ │ ✅ Manager      Priority: 500   Không thời hạn    [🗑️]   │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ➕ Thêm Vai Trò Mới:                                           │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ 🔍 [Tìm kiếm vai trò...]                                  │   │
│ ├──────────────────────────────────────────────────────────┤   │
│ │ ☐ Super Admin    (1000) - Toàn quyền hệ thống           │   │
│ │ ☐ Department Head (600) - Quản lý phòng ban              │   │
│ │ ☐ Accountant     (400) - Quyền kế toán                   │   │
│ │ ☐ HR Manager     (400) - Quản lý nhân sự                 │   │
│ │ ☐ Team Lead      (300) - Trưởng nhóm                     │   │
│ │ ☐ User           (100) - Người dùng cơ bản               │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ⏰ Thời Hạn (Tùy chọn):                                        │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ 📅 Từ: [01/01/2025 ▼] [00:00 ▼]                         │   │
│ │ 📅 Đến: [31/12/2025 ▼] [23:59 ▼]                        │   │
│ │ ☐ Không thời hạn                                          │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ 📝 Lý Do Phân Quyền:                                           │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ [Phân công dự án mới Q1/2025...                      ]   │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ⚠️ Lưu ý: Vai trò có priority cao hơn sẽ có nhiều quyền hơn   │
│                                                                  │
│                              [Hủy] [💾 Lưu Thay Đổi]          │
└──────────────────────────────────────────────────────────────────┘
```

### 3. ROLE BADGE VARIATIONS

```
Các Kiểu Hiển Thị Badge Vai Trò:

1. Vai Trò Đơn:
   ┌─────────────────┐
   │  Super Admin    │  ← Nền đỏ (Priority 1000)
   └─────────────────┘

2. Nhiều Vai Trò:
   ┌───────────┐ ┌──────────┐
   │   Admin   │ │  Manager │  ← Nền cam & vàng
   └───────────┘ └──────────┘
   
3. Có Thời Hạn:
   ┌───────────────────────┐
   │  Manager ⏰ còn 5 ngày │  ← Hiển thị thời gian còn lại
   └───────────────────────┘

4. Vai Trò Hệ Thống:
   ┌──────────────────┐
   │ 🔒 Super Admin   │  ← Icon khóa cho vai trò hệ thống
   └──────────────────┘

5. Vai Trò Không Hoạt Động:
   ┌──────────────────┐
   │  Team Lead (Vô hiệu) │  ← Nền xám, chữ mờ
   └──────────────────┘

Mã Màu Theo Priority:
━━━━━━━━━━━━━━━━━━━━━
🔴 Đỏ (900-1000): Super Admin, Admin
🟠 Cam (500-899): Manager, Department Head  
🟡 Vàng (100-499): User, Basic roles
🟢 Xanh lá: Trạng thái Active
🔵 Xanh dương: Vai trò hệ thống
⚫ Xám: Không hoạt động/Hết hạn
```

### 4. ROLE MANAGEMENT DASHBOARD

```
┌────────────────────────────────────────────────────────────────────────┐
│ 📊 Tổng Quan Quản Lý Vai Trò                       [🔄 Làm mới] [⚙️]  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│ ┌─────────────────┬─────────────────┬─────────────────┬─────────────┐│
│ │ 📋 Tổng Vai Trò │ 👥 Users Active │ 🔒 Vai Trò HT  │ ⚙️ Tùy Chỉnh││
│ │       12        │       45        │       4         │      8      ││
│ └─────────────────┴─────────────────┴─────────────────┴─────────────┘│
│                                                                        │
│ 📊 Phân Bố Người Dùng Theo Vai Trò:                                  │
│ ┌────────────────────────────────────────────────────────────────┐   │
│ │ Super Admin  ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 2 users (4%)     │   │
│ │ Admin        ████████░░░░░░░░░░░░░░░░░░░░░░ 8 users (18%)    │   │
│ │ Manager      ██████████████░░░░░░░░░░░░░░░░ 14 users (31%)   │   │
│ │ User         █████████████████████░░░░░░░░░ 21 users (47%)   │   │
│ └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│ 📈 Thống Kê Nhanh:                                                    │
│ ┌────────────────────────────────────────────────────────────────┐   │
│ │ • Vai trò được gán nhiều nhất: User (21 người)                 │   │
│ │ • Vai trò sắp hết hạn: 3 assignments trong 7 ngày tới          │   │
│ │ • Vai trò mới tạo tháng này: 2 custom roles                    │   │
│ │ • Tỷ lệ sử dụng vai trò: 87% (39/45 users có vai trò)         │   │
│ └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│ 🕐 Hoạt Động Gần Đây:                                                │
│ ┌────────────────────────────────────────────────────────────────┐   │
│ │ 10:30 - Admin role được gán cho user@xp.vn bởi admin          │   │
│ │ 09:15 - Manager role bị xóa khỏi test@xp.vn bởi super_admin   │   │
│ │ Hôm qua - Vai trò "Team Lead" được tạo mới                    │   │
│ │ Hôm qua - 5 users được gán vai trò Manager                    │   │
│ └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│ [📥 Xuất Báo Cáo] [➕ Tạo Vai Trò] [👥 Gán Hàng Loạt]               │
└────────────────────────────────────────────────────────────────────────┘
```

### 5. CREATE/EDIT ROLE MODAL

```
┌───────────────────────────────────────────────────────────────┐
│ ✨ Tạo Vai Trò Mới                                     [X]   │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ 📝 Thông Tin Cơ Bản:                                        │
│ ─────────────────────────────────────────────────────────    │
│                                                               │
│ Tên Hệ Thống: *                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ team_lead                                               │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ℹ️ Viết thường, không dấu, không khoảng trắng               │
│                                                               │
│ Tên Hiển Thị: *                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Trưởng Nhóm                                            │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │
│ Mô Tả:                                                       │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Quản lý các thành viên trong nhóm và điều phối        │ │
│ │ công việc của team...                                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │
│ ⚙️ Cấu Hình:                                                │
│ ─────────────────────────────────────────────────────────    │
│                                                               │
│ Mức Độ Ưu Tiên (Priority): *                               │
│ ┌──────────────┐                                            │
│ │ 550      ▼  │  ℹ️ Phạm vi: 1-1000 (cao hơn = quyền lớn) │
│ └──────────────┘                                            │
│                                                               │
│ [1]━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━[1000]                  │
│        100    500  550   900   1000                         │
│        User   Mgr  ↑    Admin  Super                        │
│                                                               │
│ Loại Vai Trò:                                               │
│ ○ Vai trò hệ thống  ● Vai trò tùy chỉnh  ○ Vai trò phòng ban│
│                                                               │
│ Trạng Thái:                                                  │
│ ☑ Kích hoạt   ☐ Vô hiệu hóa                                │
│                                                               │
│ ⚠️ Lưu ý: Vai trò hệ thống không thể xóa sau khi tạo        │
│                                                               │
│                                 [Hủy] [💾 Tạo Vai Trò]      │
└───────────────────────────────────────────────────────────────┘
```

### 6. ROLE DETAIL VIEW

```
┌──────────────────────────────────────────────────────────────────┐
│ Chi Tiết Vai Trò: Administrator                      [✏️] [🗑️] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 📋 Thông Tin Vai Trò:                                          │
│ ┌────────────────────────┬────────────────────────────────┐    │
│ │ Thuộc Tính             │ Giá Trị                        │    │
│ ├────────────────────────┼────────────────────────────────┤    │
│ │ Tên Hệ Thống          │ admin                          │    │
│ │ Tên Hiển Thị          │ Administrator                  │    │
│ │ Mô Tả                  │ Quản trị viên với quyền cao    │    │
│ │ Mức Ưu Tiên           │ 900                            │    │
│ │ Loại                   │ 🔒 Vai Trò Hệ Thống           │    │
│ │ Trạng Thái            │ ✅ Đang Hoạt Động             │    │
│ │ Ngày Tạo              │ 01/12/2024 09:00               │    │
│ │ Cập Nhật Lần Cuối     │ 05/01/2025 14:30               │    │
│ │ Người Tạo             │ system                         │    │
│ └────────────────────────┴────────────────────────────────┘    │
│                                                                  │
│ 👥 Người Dùng Có Vai Trò Này (8 users):                        │
│ ┌────┬──────────────────┬──────────────────┬────────────────┐  │
│ │ □  │ Tên              │ Email            │ Ngày Gán       │  │
│ ├────┼──────────────────┼──────────────────┼────────────────┤  │
│ │ □  │ [👤] Nguyễn Văn A│ admin@xp.vn      │ 01/12/2024     │  │
│ │ □  │ [👤] Trần Thị B  │ manager@xp.vn    │ 15/12/2024     │  │
│ │ □  │ [👤] Lê Văn C    │ lead@xp.vn       │ 20/12/2024     │  │
│ │ □  │ [👤] Phạm Văn D  │ dev1@xp.vn       │ 25/12/2024     │  │
│ │ □  │ [👤] Hoàng Thị E │ hr@xp.vn         │ 28/12/2024     │  │
│ └────┴──────────────────┴──────────────────┴────────────────┘  │
│                                                                  │
│ [□ Chọn tất cả] [📥 Xuất Danh Sách] [🗑️ Xóa Vai Trò Hàng Loạt]│
│                                                                  │
│ 📊 Thống Kê:                                                    │
│ • Tổng users: 8 | Active: 7 | Expired: 1                       │
│ • Thời gian gán trung bình: 45 ngày                           │
│ • Lần gán gần nhất: 2 giờ trước                               │
└──────────────────────────────────────────────────────────────────┘
```

### 7. BULK ROLE ASSIGNMENT

```
┌────────────────────────────────────────────────────────────────┐
│ 👥 Gán Vai Trò Hàng Loạt                                [X]  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ 📋 Đã Chọn 5 Users:                                          │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ • user1@xp.vn - Nguyễn Văn A                             │ │
│ │ • user2@xp.vn - Trần Thị B                               │ │
│ │ • user3@xp.vn - Lê Văn C                                 │ │
│ │ • user4@xp.vn - Phạm Văn D                               │ │
│ │ • user5@xp.vn - Hoàng Thị E                              │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                                │
│ 🎯 Chọn Hành Động:                                           │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ ● Thêm vai trò                                            │ │
│ │ ○ Xóa vai trò                                             │ │
│ │ ○ Thay thế tất cả vai trò                                │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                                │
│ 📝 Chọn Vai Trò:                                             │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ ☑ Manager (Priority: 500) - Quản lý cấp trung            │ │
│ │ ☐ Team Lead (Priority: 550) - Trưởng nhóm                │ │
│ │ ☐ Department Head (Priority: 600) - Trưởng phòng         │ │
│ │ ☐ User (Priority: 100) - Người dùng cơ bản               │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                                │
│ ⚙️ Tùy Chọn Nâng Cao:                                        │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ ☐ Đặt thời hạn: [📅 Chọn ngày...        ]               │ │
│ │ ☑ Gửi email thông báo cho users                          │ │
│ │ ☐ Thêm ghi chú audit:                                    │ │
│ │   [Gán vai trò cho dự án Q1/2025...                  ]   │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                                │
│ ⚠️ Cảnh báo:                                                  │
│ • Thao tác này sẽ ảnh hưởng đến 5 users                      │
│ • 2 users hiện có vai trò Manager sẽ không bị thay đổi       │
│ • Hành động này sẽ được ghi vào audit log                    │
│                                                                │
│ 📊 Xem Trước Kết Quả:                                        │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ user1@xp.vn: User → User + Manager                       │ │
│ │ user2@xp.vn: Admin → Admin + Manager (đã có)             │ │
│ │ user3@xp.vn: ∅ → Manager                                 │ │
│ │ user4@xp.vn: User → User + Manager                       │ │
│ │ user5@xp.vn: Team Lead → Team Lead + Manager             │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                                │
│                           [Hủy] [💾 Áp Dụng Cho Tất Cả]     │
└────────────────────────────────────────────────────────────────┘
```

## 🎨 DESIGN SYSTEM

### Color Palette

```
Priority-Based Colors:
━━━━━━━━━━━━━━━━━━━━━
PRIORITY RANGE    HEX CODE    USAGE
─────────────────────────────────────
900-1000         #DC2626     Super Admin, Admin (Red)
500-899          #EA580C     Manager, Dept Head (Orange)  
100-499          #CA8A04     User, Basic (Yellow)
System           #2563EB     System Roles (Blue)
Active           #16A34A     Active Status (Green)
Inactive         #6B7280     Inactive/Expired (Gray)
```

### Typography

```
ELEMENT           FONT SIZE    WEIGHT    COLOR
────────────────────────────────────────────────
Page Title        24px         Bold      #111827
Section Header    18px         Semibold  #374151
Table Header      14px         Medium    #6B7280
Body Text         14px         Regular   #374151
Small Text        12px         Regular   #9CA3AF
Badge Text        12px         Medium    Dynamic
Button Text       14px         Medium    #FFFFFF
```

### Spacing System

```
SPACING UNIT    PIXELS    USAGE
──────────────────────────────────
xs              4px       Badge padding
sm              8px       Form element spacing
md              16px      Section spacing
lg              24px      Component spacing
xl              32px      Page sections
```

### Interactive States

```
STATE           VISUAL CHANGE
─────────────────────────────────
Default         Normal appearance
Hover           Brightness +10%, cursor: pointer
Active          Scale 0.98, shadow reduced
Disabled        Opacity 0.5, cursor: not-allowed
Loading         Spinner overlay, opacity 0.7
```

## 📱 RESPONSIVE BREAKPOINTS

```
BREAKPOINT    WIDTH         LAYOUT CHANGES
──────────────────────────────────────────────
Mobile        < 640px       Single column, stacked elements
Tablet        640-1024px    2 column grid, condensed table
Desktop       > 1024px      Full layout, side panels
```

## ♿ ACCESSIBILITY REQUIREMENTS

### WCAG 2.1 Compliance
- **Level AA**: Minimum requirement for all interfaces
- **Color Contrast**: 4.5:1 for normal text, 3:1 for large text
- **Focus Indicators**: Visible focus states for all interactive elements
- **Screen Reader**: Semantic HTML with ARIA labels

### Keyboard Navigation
```
KEY             ACTION
────────────────────────────
Tab             Navigate forward
Shift+Tab       Navigate backward
Enter           Activate button/link
Space           Toggle checkbox
Esc             Close modal/dropdown
Arrow Keys      Navigate within menus
```

## 🔄 INTERACTION FLOWS

### Role Assignment Flow
```
1. User clicks [👥] on user row
2. Modal opens with current roles
3. User selects roles to add/remove
4. Optional: Set expiration date
5. Optional: Add assignment reason
6. Click Save → API call → Update UI
7. Show success toast notification
```

### Bulk Assignment Flow
```
1. Select multiple users via checkboxes
2. Click "Gán vai trò hàng loạt"
3. Choose action type (add/remove/replace)
4. Select roles from list
5. Preview changes
6. Confirm → Process batch → Show progress
7. Display results summary
```

## 📊 COMPONENT SPECIFICATIONS

### RoleBadge Component
```typescript
interface RoleBadgeProps {
  role: Role;
  showPriority?: boolean;
  showExpiration?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}
```

### RoleAssignmentModal Component
```typescript
interface RoleAssignmentModalProps {
  user: User;
  currentRoles: Role[];
  availableRoles: Role[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (assignments: RoleAssignment[]) => Promise<void>;
}
```

### RoleManagementTable Component
```typescript
interface RoleManagementTableProps {
  roles: Role[];
  onEdit: (role: Role) => void;
  onDelete: (roleId: string) => void;
  onViewUsers: (roleId: string) => void;
  loading?: boolean;
}
```

## 🚀 IMPLEMENTATION NOTES

### Performance Considerations
- **Virtual Scrolling**: For tables with >100 rows
- **Lazy Loading**: Load role details on demand
- **Debounced Search**: 300ms delay for search inputs
- **Optimistic Updates**: Update UI before API confirmation

### State Management
- **Global State**: User roles in Redux/Context
- **Local State**: Modal states, form inputs
- **Cache Strategy**: 5-minute TTL for role lists
- **Real-time Updates**: WebSocket for role changes

### Error Handling
- **Network Errors**: Retry with exponential backoff
- **Validation Errors**: Inline field errors
- **Permission Errors**: Clear error messages
- **Conflict Resolution**: Show conflict dialog

## 📝 DEVELOPER CHECKLIST

### Pre-Implementation
- [ ] Review mockups with team
- [ ] Confirm color scheme
- [ ] Validate responsive requirements
- [ ] Test accessibility tools

### Implementation
- [ ] Create base components
- [ ] Implement responsive layouts
- [ ] Add keyboard navigation
- [ ] Include loading states
- [ ] Handle error cases

### Testing
- [ ] Cross-browser testing
- [ ] Mobile device testing
- [ ] Accessibility audit
- [ ] Performance profiling
- [ ] User acceptance testing

---

**Document Version**: 2.0.0  
**Last Updated**: January 10, 2025  
**Next Review**: After Phase 1 Implementation