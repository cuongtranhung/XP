#!/bin/bash
# quick-start.sh - Quick project recovery for Claude Code

echo "🔍 Khôi phục cấu trúc dự án XP..."

# Hiển thị trạng thái dự án hiện tại
echo "📊 Trạng thái hiện tại:"
echo "- Project: Fullstack Authentication System"
echo "- Frontend: React + TypeScript (Port 3000)"
echo "- Backend: Node.js + Express (Port 5000)" 
echo "- Database: PostgreSQL on Windows (Port 5432)"

# Kiểm tra services đang chạy
echo "🔍 Kiểm tra services..."
ps aux | grep -E "(vite|node|postgres)" | grep -v grep

# Hiển thị các URL quan trọng
echo "🌐 URLs truy cập:"
WSL_IP=$(ip addr show eth0 | grep inet | awk '{print $2}' | cut -d/ -f1)
echo "- Frontend: http://$WSL_IP:3000"
echo "- Backend: http://localhost:5000"
echo "- Login: http://$WSL_IP:3000/login"

# Hiển thị thông tin test
echo "🔑 Test credentials: cuongtranhung@gmail.com / @Abcd6789"

# Kiểm tra kết nối database
echo "🗄️ Kiểm tra kết nối PostgreSQL..."
if nc -z localhost 5432 2>/dev/null; then
    echo "✅ PostgreSQL connected"
else
    echo "❌ PostgreSQL not accessible - Check Windows PostgreSQL service"
fi