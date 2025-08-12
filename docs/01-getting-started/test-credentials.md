# 🔐 Test Credentials
**Thông tin đăng nhập cho testing và development**

---

## ⚠️ CRITICAL WARNING / CẢNH BÁO QUAN TRỌNG

**🚨 ABSOLUTELY DO NOT CHANGE THESE CREDENTIALS 🚨**  
**🚨 TUYỆT ĐỐI KHÔNG THAY ĐỔI THÔNG TIN ĐĂNG NHẬP NÀY 🚨**

Thông tin đăng nhập này được sử dụng cho:
- Testing automation
- Development workflow
- Documentation examples
- API integration testing

**Không được thay đổi trong bất kỳ task, feature, hoặc update nào!**

---

## 📋 Login Information / Thông tin đăng nhập

### Primary Test Account / Tài khoản test chính

```yaml
Email: cuongtranhung@gmail.com
Password: @Abcd6789
User ID: 2
Full Name: Trần Hùng Cường
Status: Active & Email Verified
Created: 2025-08-02
Last Updated: 2025-08-05
```

### Account Details / Chi tiết tài khoản

| Field | Value | Note |
|-------|-------|------|
| **ID** | `2` | Primary key in users table |
| **Email** | `cuongtranhung@gmail.com` | Verified email address |
| **Password** | `@Abcd6789` | Bcrypt hashed with 12 rounds |
| **Full Name** | `Trần Hùng Cường` | Display name |
| **Email Verified** | `✅ true` | Email verification completed |
| **Created At** | `2025-08-02T01:40:32.916Z` | Account creation timestamp |
| **Updated At** | `2025-08-05T05:14:20.850Z` | Last password update |

---

## 🔧 Usage Examples / Ví dụ sử dụng

### Frontend Login
```
URL: http://localhost:3000/login
Email: cuongtranhung@gmail.com
Password: @Abcd6789
```

### API Authentication
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cuongtranhung@gmail.com",
    "password": "@Abcd6789"
  }'
```

### Expected API Response
```json
{
  "success": true,
  "sessionId": "uuid-session-id",
  "data": {
    "token": "jwt-token-here",
    "user": {
      "id": 2,
      "email": "cuongtranhung@gmail.com",
      "name": "Trần Hùng Cường",
      "emailVerified": true,
      "email_verified": true,
      "full_name": "Trần Hùng Cường",
      "created_at": "2025-08-02T01:40:32.916Z",
      "updated_at": "2025-08-05T05:14:20.850Z"
    }
  }
}
```

---

## 🛡️ Security Information / Thông tin bảo mật

### Password Hashing
- **Algorithm**: bcrypt
- **Rounds**: 12
- **Hash**: `$2a$12$eCDbjPkQmJvXQ1bmGeiecerkfW8LZbn3oG8ELzG9jrbxyrz6RlKxa`

### Database Location
```sql
-- PostgreSQL Database
SELECT * FROM users WHERE email = 'cuongtranhung@gmail.com';
-- ID: 2
-- Password stored as bcrypt hash
-- All sensitive data properly encrypted
```

### Security Notes
- Password được hash an toàn với bcrypt
- JWT tokens được generate tự động khi login
- Session management được handle bởi backend
- Tài khoản có email verified = true
- UAL (User Activity Logging) hiện tại đang disabled

---

## 📝 Development Notes / Ghi chú phát triển

### When to Use / Khi nào sử dụng
- ✅ Manual testing của login/logout flow
- ✅ API integration testing
- ✅ Frontend development và debugging
- ✅ Documentation examples
- ✅ Automated testing scripts

### When NOT to Use / Khi nào KHÔNG sử dụng
- ❌ Production environment
- ❌ Security testing với external systems
- ❌ Performance testing với large datasets
- ❌ Real user data migration

### Backup Information / Thông tin sao lưu
Nếu accidentally thay đổi password, có thể restore với:
```sql
UPDATE users 
SET password_hash = '$2a$12$eCDbjPkQmJvXQ1bmGeiecerkfW8LZbn3oG8ELzG9jrbxyrz6RlKxa',
    updated_at = CURRENT_TIMESTAMP 
WHERE email = 'cuongtranhung@gmail.com';
```

---

## 🔍 Verification Commands / Lệnh kiểm tra

### Check Account Status
```bash
# Test login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cuongtranhung@gmail.com","password":"@Abcd6789"}'

# Check database
PGPASSWORD='@abcd1234' psql -h 192.168.5.3 -p 5432 -U postgres -d postgres \
  -c "SELECT id, email, full_name, email_verified FROM users WHERE email = 'cuongtranhung@gmail.com';"
```

### Health Check
```bash
# System health
curl http://localhost:5000/health

# Database health  
curl http://localhost:5000/health/database
```

---

**Last Updated**: 2025-08-05  
**Status**: ✅ Active and Verified  
**Important**: NEVER CHANGE THESE CREDENTIALS!