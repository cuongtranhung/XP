# 🚀 Thông tin truy cập hệ thống

## ✅ Trạng thái hiện tại
- **Frontend**: Đang chạy ✅
- **Backend**: Đang chạy ✅
- **Database**: PostgreSQL on Windows ✅

## 📱 Cách truy cập từ Windows Browser

### Frontend (React App)
```
http://172.26.249.148:3000
```
⚠️ **Lưu ý**: Không thể dùng `localhost:3000` từ Windows browser do giới hạn của WSL2

### Backend API
```
http://localhost:5000
```
Hoặc
```
http://172.26.249.148:5000
```

### Login Page
```
http://172.26.249.148:3000/login
```

## 🔑 Thông tin đăng nhập test
- **Email**: cuongtranhung@gmail.com
- **Password**: @Abcd6789

## 🛠️ Lệnh quản lý

### Kiểm tra trạng thái
```bash
ps aux | grep -E "(vite|node)" | grep -v grep
```

### Dừng tất cả services
```bash
./stop-dev.sh
```

### Khởi động lại
```bash
# Backend
cd backend
npx ts-node --transpile-only src/server.ts

# Frontend (terminal khác)
cd frontend
npm run dev
```

## ⚠️ Lưu ý quan trọng

1. **WSL2 Network**: Do cách WSL2 hoạt động, `localhost` trong WSL2 khác với `localhost` trong Windows
2. **IP động**: IP `172.26.249.148` có thể thay đổi sau khi restart Windows
3. **Kiểm tra IP hiện tại**:
   ```bash
   ip addr show eth0 | grep inet | awk '{print $2}' | cut -d/ -f1
   ```

## 🎯 Giải pháp tốt nhất

Để có localhost ổn định, bạn có thể:

1. **Sử dụng PowerShell** để forward port:
   ```powershell
   netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=172.26.249.148
   ```

2. **Hoặc dùng Docker Desktop** với WSL2 backend (tự động xử lý network)

3. **Hoặc chạy trực tiếp trong Windows** (không qua WSL2)

## 📊 Status Dashboard

| Service | URL | Status |
|---------|-----|--------|
| Frontend | http://172.26.249.148:3000 | ✅ Running |
| Backend | http://localhost:5000 | ✅ Running |
| Database | localhost:5432 (Windows) | ✅ Connected |

---
*Last updated: 2025-08-07*