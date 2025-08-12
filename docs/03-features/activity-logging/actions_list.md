# 📊 User Activity Logging (UAL) - Danh sách hành động được logging

**Date**: 2025-08-05  
**Project**: XP - Fullstack Authentication System  
**Module**: User Activity Logging (UAL)

---

## 📋 **Tổng quan UAL Actions**

User Activity Logging (UAL) module hiện tại đang theo dõi **14 loại hành động** chính được phân thành **6 categories** khác nhau.

---

## 🔧 **ACTION TYPES - Các loại hành động**

### 🔐 **1. AUTHENTICATION (AUTH Category)**

#### ✅ **LOGIN** 
- **Mô tả**: Đăng nhập thành công
- **Category**: `AUTH`
- **Response Status**: `200`
- **Metadata bao gồm**:
  - `loginMethod`: 'email_password'
  - `timestamp`: ISO string
- **Được log khi**: User đăng nhập thành công

#### 🚪 **LOGOUT**
- **Mô tả**: Đăng xuất
- **Category**: `AUTH` 
- **Response Status**: `200`
- **Metadata bao gồm**:
  - `logoutReason`: 'USER_LOGOUT'
  - `timestamp`: ISO string
- **Được log khi**: User click logout

#### 🔄 **TOKEN_REFRESH**
- **Mô tả**: Làm mới JWT token
- **Category**: `AUTH`
- **Response Status**: `200`
- **Được log khi**: Token được refresh tự động

#### ❌ **FAILED_LOGIN**
- **Mô tả**: Đăng nhập thất bại
- **Category**: `SECURITY`
- **Response Status**: `401`
- **Metadata bao gồm**:
  - `email`: Email đăng nhập failed
  - `reason`: 'invalid_credentials' (hoặc lý do khác)
  - `timestamp`: ISO string
- **Được log khi**: Sai email/password, account không tồn tại

### 👤 **2. PROFILE MANAGEMENT (PROFILE Category)**

#### 👁️ **VIEW_PROFILE**
- **Mô tả**: Xem thông tin profile
- **Category**: `PROFILE`
- **Response Status**: `200`
- **Được log khi**: User truy cập trang profile

#### ✏️ **UPDATE_PROFILE**
- **Mô tả**: Cập nhật thông tin profile
- **Category**: `PROFILE`
- **Response Status**: `200`
- **Được log khi**: User cập nhật tên, email, thông tin cá nhân

#### 🔒 **CHANGE_PASSWORD**
- **Mô tả**: Đổi mật khẩu
- **Category**: `PROFILE`
- **Response Status**: `200`
- **Metadata bao gồm**:
  - `timestamp`: ISO string
- **Được log khi**: User đổi password thành công

#### 🖼️ **UPLOAD_AVATAR**
- **Mô tả**: Upload/thay đổi avatar
- **Category**: `PROFILE`
- **Response Status**: `200`
- **Được log khi**: User upload hoặc thay đổi avatar

### ⚙️ **3. SETTINGS MANAGEMENT (SETTINGS Category)**

#### 👁️ **VIEW_SETTINGS**
- **Mô tả**: Xem trang cài đặt
- **Category**: `SETTINGS`
- **Response Status**: `200`
- **Được log khi**: User truy cập settings page

#### ✏️ **UPDATE_SETTINGS**
- **Mô tả**: Cập nhật cài đặt
- **Category**: `SETTINGS`
- **Response Status**: `200`
- **Được log khi**: User thay đổi preferences, notifications settings

### 🧭 **4. NAVIGATION (NAVIGATION Category)**

#### 📊 **VIEW_DASHBOARD**
- **Mô tả**: Truy cập dashboard
- **Category**: `NAVIGATION`
- **Response Status**: `200`
- **Được log khi**: User truy cập dashboard page

#### 📄 **VIEW_PAGE**
- **Mô tả**: Truy cập các trang khác
- **Category**: `NAVIGATION`
- **Response Status**: `200`
- **Được log khi**: User truy cập các trang trong ứng dụng

### 🌐 **5. API CALLS (SYSTEM Category)**

#### 🔧 **API_CALL**
- **Mô tả**: Gọi API endpoint
- **Category**: `SYSTEM`
- **Response Status**: Varies (200, 400, 500, etc.)
- **Được log khi**: User thực hiện API calls (hiện tại DISABLED)

### 🚨 **6. SECURITY & SYSTEM (SECURITY/SYSTEM Category)**

#### ⚠️ **SUSPICIOUS_ACTIVITY**
- **Mô tả**: Hoạt động đáng nghi
- **Category**: `SECURITY`
- **Response Status**: Varies
- **Được log khi**: Phát hiện pattern đáng nghi (multiple failed logins, unusual access)

#### ❗ **ERROR_OCCURRED**
- **Mô tả**: Lỗi hệ thống
- **Category**: `SYSTEM`
- **Response Status**: 500+
- **Được log khi**: Có lỗi xảy ra trong hệ thống

---

## 📊 **ACTION CATEGORIES - Phân loại hành động**

| Category | Số lượng Actions | Mô tả | Status Colors |
|----------|------------------|-------|---------------|
| **AUTH** | 3 actions | Authentication và authorization | 🟢 Green (success) |
| **PROFILE** | 4 actions | Quản lý thông tin cá nhân | 🔵 Blue (info) |
| **SETTINGS** | 2 actions | Cài đặt ứng dụng | 🟡 Yellow (settings) |
| **NAVIGATION** | 2 actions | Điều hướng trong app | 🟣 Purple (navigation) |
| **SECURITY** | 2 actions | Bảo mật và cảnh báo | 🔴 Red (security) |
| **SYSTEM** | 1 action | Hệ thống và API | 🟠 Orange (system) |

---

## 🎯 **CURRENTLY IMPLEMENTED - Hiện tại đã implement**

### ✅ **Active Logging Methods**
Các methods đang được sử dụng tích cực:

1. **`logLogin(userId, sessionId, req)`** ✅
2. **`logLogout(userId, sessionId)`** ✅  
3. **`logFailedLogin(email, req, reason)`** ✅
4. **`logPasswordChange(userId, sessionId, req)`** ✅

### 🔍 **Implementation Status by Action**

| Action Type | Implementation Status | Auto-Triggered | Manual Log Required |
|-------------|----------------------|----------------|-------------------|
| `LOGIN` | ✅ **Active** | ✅ Automatic | ❌ |
| `LOGOUT` | ✅ **Active** | ✅ Automatic | ❌ |
| `FAILED_LOGIN` | ✅ **Active** | ✅ Automatic | ❌ |
| `CHANGE_PASSWORD` | ✅ **Active** | ✅ Automatic | ❌ |
| `TOKEN_REFRESH` | 🟡 **Defined** | ❌ Not implemented | ✅ |
| `VIEW_PROFILE` | 🟡 **Defined** | ❌ Not implemented | ✅ |
| `UPDATE_PROFILE` | 🟡 **Defined** | ❌ Not implemented | ✅ |
| `UPLOAD_AVATAR` | 🟡 **Defined** | ❌ Not implemented | ✅ |
| `VIEW_SETTINGS` | 🟡 **Defined** | ❌ Not implemented | ✅ |
| `UPDATE_SETTINGS` | 🟡 **Defined** | ❌ Not implemented | ✅ |
| `VIEW_DASHBOARD` | 🟡 **Defined** | ❌ Not implemented | ✅ |
| `VIEW_PAGE` | 🟡 **Defined** | ❌ Not implemented | ✅ |
| `API_CALL` | 🔴 **Disabled** | ❌ Intentionally disabled | ✅ |
| `SUSPICIOUS_ACTIVITY` | 🟡 **Defined** | ❌ Not implemented | ✅ |
| `ERROR_OCCURRED` | 🟡 **Defined** | ❌ Not implemented | ✅ |

---

## 📝 **LOGGING DATA STRUCTURE**

Mỗi log entry bao gồm các thông tin sau:

### 🔧 **Core Fields**
- **`id`**: Unique identifier (BIGSERIAL)
- **`user_id`**: ID của user (có thể null cho failed login)
- **`session_id`**: Session identifier (VARCHAR 128)
- **`action_type`**: Loại hành động (VARCHAR 50)
- **`action_category`**: Phân loại (VARCHAR 30)
- **`created_at`**: Timestamp with timezone

### 🌐 **Request Information**
- **`endpoint`**: API endpoint accessed (VARCHAR 255)
- **`method`**: HTTP method (GET, POST, PUT, DELETE)
- **`response_status`**: HTTP status code (INTEGER)
- **`processing_time_ms`**: Response time (INTEGER)

### 🔍 **Client Information**
- **`ip_address`**: IP address (INET type)
- **`user_agent`**: Browser user agent (TEXT)
- **`referrer`**: HTTP referer (VARCHAR 500)
- **`browser_info`**: Parsed browser info (JSONB)
- **`location_info`**: Geographic info (JSONB)

### 📦 **Additional Data**
- **`resource_type`**: Type of resource accessed (VARCHAR 50)
- **`resource_id`**: ID of specific resource (VARCHAR 100)
- **`request_data`**: Sanitized request payload (JSONB)
- **`metadata`**: Additional flexible data (JSONB)

---

## 🚀 **FRONTEND DISPLAY**

### 📱 **Activity Log Viewer Component**
- **Location**: `frontend/src/components/activity/ActivityLogViewer.tsx`
- **Features**:
  - Real-time activity display
  - Filtering by action type and category
  - Pagination support
  - Color-coded status indicators

### 🎨 **Display Mapping**
```typescript
export const ACTION_TYPES = {
  LOGIN: 'Login',
  LOGOUT: 'Logout', 
  FAILED_LOGIN: 'Failed Login',
  CHANGE_PASSWORD: 'Password Change',
  API_CALL: 'API Call',
  PROFILE_UPDATE: 'Profile Update'
} as const;

export const ACTION_CATEGORIES = {
  AUTH: 'Authentication',
  SECURITY: 'Security',
  PROFILE: 'Profile', 
  SYSTEM: 'System',
  API: 'API'
} as const;
```

### 🎨 **Status Colors**
```typescript
export const STATUS_COLORS = {
  200: 'text-green-600',   // Success
  201: 'text-green-600',   // Created
  400: 'text-yellow-600',  // Bad Request
  401: 'text-red-600',     // Unauthorized
  403: 'text-red-600',     // Forbidden
  404: 'text-yellow-600',  // Not Found
  500: 'text-red-600'      // Server Error
} as const;
```

---

## 📈 **DATABASE PERFORMANCE**

### 🗃️ **Indexes Created**
```sql
-- Performance optimization indexes
CREATE INDEX idx_user_activity_logs_user_id_created_at ON user_activity_logs(user_id, created_at DESC);
CREATE INDEX idx_user_activity_logs_action_type ON user_activity_logs(action_type);
CREATE INDEX idx_user_activity_logs_action_category ON user_activity_logs(action_category);
CREATE INDEX idx_user_activity_logs_session_id ON user_activity_logs(session_id);
CREATE INDEX idx_user_activity_logs_created_at ON user_activity_logs(created_at DESC);
CREATE INDEX idx_user_activity_logs_ip_address ON user_activity_logs(ip_address);

-- Partial indexes for common queries
CREATE INDEX idx_user_activity_logs_failed_logins ON user_activity_logs(user_id, created_at DESC) 
WHERE action_type = 'FAILED_LOGIN';

CREATE INDEX idx_user_activity_logs_security_events ON user_activity_logs(created_at DESC) 
WHERE action_category = 'SECURITY';
```

---

## 🔧 **ADMIN CONTROLS**

### 🎛️ **Activity Control Panel**
- **Location**: `frontend/src/components/activity/ActivityControl.tsx`
- **Features**:
  - Enable/Disable UAL real-time
  - View current status
  - Monitor performance impact
  - Admin-only access (User ID 2)

### 📊 **Control API Endpoints**
- **`GET /api/activity-control/status`**: Check current status
- **`POST /api/activity-control/toggle`**: Enable/disable logging

---

## 🎯 **USAGE EXAMPLES**

### 💻 **Manual Logging Examples**

```javascript
// Log successful profile update
MinimalActivityLogger.logAsync({
  userId: 123,
  sessionId: 'session-id',
  actionType: 'UPDATE_PROFILE',
  actionCategory: 'PROFILE',
  endpoint: '/api/profile',
  method: 'PUT',
  responseStatus: 200,
  metadata: {
    fieldsUpdated: ['full_name', 'email'],
    timestamp: new Date().toISOString()
  }
});

// Log suspicious activity
MinimalActivityLogger.logAsync({
  userId: 456,
  actionType: 'SUSPICIOUS_ACTIVITY',
  actionCategory: 'SECURITY',
  responseStatus: 429,
  metadata: {
    suspiciousType: 'MULTIPLE_FAILED_LOGINS',
    attemptCount: 5,
    timeWindow: '5 minutes'
  }
});
```

### 🔍 **Query Examples**

```sql
-- Get recent activity for user
SELECT * FROM user_activity_logs 
WHERE user_id = 123 
ORDER BY created_at DESC 
LIMIT 10;

-- Get security events from last 24 hours
SELECT * FROM user_activity_logs 
WHERE action_category = 'SECURITY' 
AND created_at > NOW() - INTERVAL '24 hours';

-- Get failed login attempts by IP
SELECT ip_address, COUNT(*) as attempts
FROM user_activity_logs 
WHERE action_type = 'FAILED_LOGIN'
AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY ip_address
HAVING COUNT(*) > 3;
```

---

## 📊 **SUMMARY**

### 📈 **Current Statistics**
- **Total Action Types**: 14
- **Categories**: 6
- **Currently Active**: 4 action types
- **Database Indexes**: 8 performance indexes
- **Frontend Components**: 2 (Viewer + Control)
- **API Endpoints**: 4 (2 control + 2 data)

### ✅ **Key Features**
- ✅ Real-time logging capability
- ✅ Admin toggle control
- ✅ Performance optimized (minimal impact when disabled)
- ✅ Comprehensive data capture
- ✅ Security event tracking
- ✅ Frontend dashboard
- ✅ Database partitioning ready

### 🎯 **Current Focus**
Hiện tại UAL tập trung vào **authentication và security events**, với khả năng mở rộng dễ dàng cho các action types khác khi cần thiết.

---

*Document được tạo từ phân tích comprehensive UAL module - 2025-08-05*