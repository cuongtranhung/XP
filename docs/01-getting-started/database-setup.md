# Database Setup Guide

Tôi đã chuyển đổi ứng dụng từ **in-memory storage** sang **PostgreSQL database** theo yêu cầu của bạn.

## ✅ Đã Hoàn Thành

### 1. Database Schema (`backend/src/database/schema.sql`)
- Bảng `users` với UUID primary key
- Bảng `password_reset_tokens` cho reset password  
- Bảng `user_sessions` cho session management
- Indexes và triggers tự động

### 2. Models Updated
- **`User.ts`**: Chuyển từ in-memory sang PostgreSQL
- **`PasswordResetToken.ts`**: Sử dụng database thật

### 3. Migration Scripts  
- **`migrate.ts`**: Tự động tạo bảng và cấu trúc database
- **`test-connection.ts`**: Test connection và troubleshooting

## 🎯 Configuration

**Database theo yêu cầu:**
```env
DATABASE_URL=postgresql://postgres:@abcd1234@localhost:5432/postgres
```

## 🚀 Commands Available

```bash
cd backend

# Test database connection
npm run db:test

# Run migration để tạo tables  
npm run db:migrate
```

## 📊 Database Schema

**Users Table:**
- `id` (UUID, Primary Key)
- `email` (Unique, Not Null)
- `password_hash` (Not Null)
- `full_name` (Not Null)
- `email_verified` (Boolean, Default: false)
- `created_at`, `updated_at`, `last_login`

**Password Reset Tokens Table:**
- `id` (UUID, Primary Key)
- `user_id` (Foreign Key → users.id)
- `token` (Unique, Not Null)
- `expires_at`, `created_at`, `used_at`

## ⚠️ Next Steps

1. **Start PostgreSQL service** trên máy bạn
2. **Run migration:** `npm run db:migrate`
3. **Test application** với database thật

## 🔧 PostgreSQL Setup Options

**Docker (Nhanh nhất):**
```bash
docker run --name postgres-auth -e POSTGRES_PASSWORD=@abcd1234 -p 5432:5432 -d postgres:15
```

**Manual Install:**
- Windows: https://www.postgresql.org/download/windows/
- Linux: `sudo apt install postgresql`
- macOS: `brew install postgresql`

---

**Status:** ✅ Code đã sẵn sàng. Chỉ cần start PostgreSQL và run migration.