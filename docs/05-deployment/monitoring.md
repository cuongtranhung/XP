# 📊 System Monitoring & Control Guide

## 🎯 Tổng Quan

Hệ thống monitoring cung cấp khả năng giám sát và điều khiển toàn diện cho ứng dụng, bao gồm:
- Dashboard web trực quan
- API điều khiển từ xa
- Hệ thống cảnh báo tự động
- Quy trình xử lý khẩn cấp

## 🚀 Khởi Động Nhanh

### 1. Monitoring Dashboard (Giao diện chính)
```bash
# Khởi động dashboard và API server
./start-monitoring-dashboard.sh

# Truy cập tại: http://localhost:4000
```

### 2. Alert Monitoring (Cảnh báo tự động)
```bash
# Khởi động hệ thống cảnh báo
./start-alert-monitoring.sh
```

### 3. Stability Monitoring (Giám sát liên tục)
```bash
# Chạy monitoring script
node stability-monitoring.js
```

## 🖥️ Dashboard Features

### Các Tab Chính

#### 1. **Services Tab** - Quản lý dịch vụ
- ▶️ Start All Services - Khởi động tất cả
- ⏹️ Stop All Services - Dừng tất cả
- 🔄 Restart Backend/Frontend - Khởi động lại từng service
- 🏥 Health Check - Kiểm tra sức khỏe hệ thống
- 📊 View Processes - Xem các tiến trình đang chạy

#### 2. **Monitoring Tab** - Giám sát
- 📊 Start Monitoring - Bắt đầu giám sát
- 🚨 Start Alert System - Kích hoạt cảnh báo
- 📋 View Alert Log - Xem log cảnh báo
- 📈 View Metrics - Xem số liệu thống kê
- 🧹 Clear Old Logs - Xóa log cũ
- 💾 Export Logs - Xuất log

#### 3. **Emergency Tab** - Xử lý khẩn cấp
- 🚨 Emergency Restart - Khởi động lại khẩn cấp
- ☠️ Force Kill All - Buộc dừng tất cả
- 🧹 Clear All Caches - Xóa cache
- 🔌 Reset DB Connections - Reset kết nối database
- 💾 Backup System - Sao lưu hệ thống
- 🛡️ Start Safe Mode - Chế độ an toàn

#### 4. **Logs Tab** - Xem logs
- 📄 Stability Log - Log ổn định
- 🚨 Alerts Log - Log cảnh báo
- ⚠️ Critical Alerts - Cảnh báo nghiêm trọng
- 🔧 Backend Log - Log backend
- 🎨 Frontend Log - Log frontend

#### 5. **Documentation Tab** - Tài liệu
- 📚 Emergency Procedures - Quy trình khẩn cấp
- 📊 Monitoring Guide - Hướng dẫn giám sát
- 🚨 Alert Thresholds - Ngưỡng cảnh báo
- ⌨️ Command Reference - Tham khảo lệnh

## 📈 Metrics & Thresholds

### Ngưỡng Cảnh Báo

| Metric | Warning | Critical | Emergency |
|--------|---------|----------|-----------|
| Memory | 70% | 85% | 95% |
| CPU | 60% | 80% | 95% |
| Response Time | 1s | 3s | 5s |
| Error Rate | 1% | 5% | 10% |
| DB Connections | 40/50 | 45/50 | 48/50 |
| Disk Usage | 70% | 85% | 95% |

### Mức Độ Cảnh Báo

- 🟢 **INFO**: Thông tin thông thường
- 🟡 **WARNING**: Cần chú ý, có thể đợi 1-2 giờ
- 🟠 **CRITICAL**: Cần xử lý ngay
- 🔴 **EMERGENCY**: Khẩn cấp, hệ thống có thể sập

## 🛠️ Scripts & Commands

### Monitoring Scripts
```bash
# Dashboard chính
./start-monitoring-dashboard.sh    # Khởi động dashboard
kill $(cat dashboard-api.pid)      # Dừng dashboard

# Alert monitoring
./start-alert-monitoring.sh        # Khởi động cảnh báo
node alert-thresholds.js          # Chạy trực tiếp

# Stability monitoring  
node stability-monitoring.js       # Giám sát ổn định
./setup-cron-monitoring.sh        # Cài đặt cron job

# Services management
./start-with-memory-limits.sh     # Khởi động với giới hạn memory
./stop-all-services.sh            # Dừng tất cả services
./emergency-restart.sh            # Khởi động lại khẩn cấp
```

### API Endpoints

Dashboard API chạy trên port 4000:

```bash
# Metrics
GET http://localhost:4000/api/metrics          # Lấy metrics
GET http://localhost:4000/api/services         # Trạng thái services
GET http://localhost:4000/api/alerts           # Danh sách cảnh báo

# Control
POST http://localhost:4000/api/execute         # Thực thi lệnh
Body: { "command": "start-all" }

# Logs
GET http://localhost:4000/api/logs/stability   # Xem log
POST http://localhost:4000/api/logs/clear      # Xóa log

# Database
GET http://localhost:4000/api/database/stats   # Thống kê DB
POST http://localhost:4000/api/database/reset-connections

# Backup
POST http://localhost:4000/api/backup          # Tạo backup
```

## 📁 File Structure

```
/mnt/c/Users/Admin/source/repos/XP/
│
├── monitoring-dashboard.html      # Giao diện dashboard
├── monitoring-api.js             # API server
├── alert-thresholds.js           # Hệ thống cảnh báo
├── stability-monitoring.js       # Giám sát ổn định
│
├── start-monitoring-dashboard.sh # Khởi động dashboard
├── start-alert-monitoring.sh     # Khởi động alerts
├── start-with-memory-limits.sh   # Khởi động với limits
├── emergency-restart.sh          # Khởi động khẩn cấp
├── stop-all-services.sh         # Dừng services
│
├── EMERGENCY_RECOVERY.md         # Hướng dẫn khẩn cấp
├── MONITORING_GUIDE.md          # File này
│
└── logs/
    ├── stability-monitor.log    # Log giám sát
    ├── alerts.log               # Log cảnh báo
    ├── critical-alerts.log      # Cảnh báo nghiêm trọng
    └── dashboard-api.log        # Log của API
```

## 🔍 Troubleshooting

### Dashboard không load được
```bash
# Kiểm tra API server
curl http://localhost:4000/api/health

# Xem log
tail -f dashboard-api.log

# Restart API
kill $(cat dashboard-api.pid)
./start-monitoring-dashboard.sh
```

### Không thể execute commands
```bash
# Kiểm tra quyền thực thi
chmod +x *.sh

# Kiểm tra Node.js
node --version

# Kiểm tra dependencies
npm install express cors axios
```

### Metrics không update
```bash
# Kiểm tra backend
curl http://localhost:5000/health

# Kiểm tra database
PGPASSWORD='@abcd1234' psql -h 172.26.240.1 -p 5432 -U postgres -d postgres -c "SELECT 1;"

# Restart monitoring
node stability-monitoring.js
```

## 📝 Daily Operations

### Buổi sáng
1. Mở dashboard: http://localhost:4000
2. Kiểm tra tab **Services** - tất cả phải Online
3. Xem tab **Logs** - kiểm tra có lỗi đêm qua không
4. Xem **Active Alerts** - xử lý cảnh báo nếu có

### Trong ngày
- Dashboard tự động refresh mỗi 5 giây
- Alerts sẽ hiện khi vượt ngưỡng
- Xử lý theo mức độ ưu tiên

### Cuối ngày
1. Export logs nếu cần: `tar -czf logs-$(date +%Y%m%d).tar.gz *.log`
2. Clear old logs nếu quá lớn
3. Kiểm tra resource usage trước khi về

## 🚨 Emergency Contacts

Khi có sự cố EMERGENCY:
1. Thực hiện **Emergency Restart** từ dashboard
2. Xem **EMERGENCY_RECOVERY.md** để biết chi tiết
3. Liên hệ team nếu không thể xử lý

## 💡 Tips & Best Practices

1. **Luôn giữ dashboard mở** trong giờ làm việc
2. **Set up alerts** để nhận thông báo sớm
3. **Backup thường xuyên** trước khi deploy
4. **Monitor trends** không chỉ xem số tức thời
5. **Document incidents** để học từ lỗi

## 🔄 Updates

Dashboard và monitoring system được cập nhật thường xuyên. Check git log để xem changes:
```bash
git log --oneline | grep -i monitor
```

---

**Version**: 1.0  
**Last Updated**: January 2024  
**Maintainer**: System Admin Team