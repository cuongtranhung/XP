# 🔧 Windows-WSL2 Access Fix Guide

## 🎯 **Vấn đề**: Windows không thể truy cập localhost từ WSL2

## ✅ **Giải pháp 1: Sử dụng WSL2 IP (KHUYẾN NGHỊ)**
Thay vì `localhost:3000`, hãy dùng:
```
http://172.26.249.148:3000/login
```

## ✅ **Giải pháp 2: Port Forwarding (Windows PowerShell Admin)**
Mở PowerShell **với quyền Administrator** và chạy:
```powershell
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=172.26.249.148
netsh interface portproxy add v4tov4 listenport=5000 listenaddress=0.0.0.0 connectport=5000 connectaddress=172.26.249.148
```

Sau đó truy cập: `http://localhost:3000/login`

## ✅ **Giải pháp 3: WSL2 Bridge Mode**
1. Tạo file `C:\Users\{username}\.wslconfig`:
```ini
[wsl2]
networkingMode=bridged
vmSwitch=WSLBridge
```

2. Restart WSL2:
```cmd
wsl --shutdown
wsl
```

## 🔍 **Test ngay**:
Hãy thử các URL này theo thứ tự:

1. **http://172.26.249.148:3000/login** ← Try this first!
2. **http://localhost:3000/login**
3. **http://127.0.0.1:3000/login**

## 🚨 **Nhanh nhất**: 
**Chỉ cần thử URL này ngay:**
```
http://172.26.249.148:3000/login
```

---
**Nguyên nhân**: WSL2 chạy trong virtual machine riêng, Windows cần IP cụ thể để kết nối.