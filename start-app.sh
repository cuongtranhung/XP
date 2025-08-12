#!/bin/bash

echo "🚀 Starting Full Stack Application..."
echo ""

# Kill any existing processes
echo "🔧 Cleaning up old processes..."
pkill -f node || true
pkill -f npm || true
pkill -f vite || true
sleep 2

# Start backend
echo "📦 Starting Backend Server on port 5000..."
cd /mnt/c/Users/Admin/source/repos/XP/backend
PORT=5000 npm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 10

# Check backend health
echo "🔍 Checking backend health..."
curl -s http://localhost:5000/health | head -1

# Start frontend
echo ""
echo "🎨 Starting Frontend Server on port 3000..."
cd /mnt/c/Users/Admin/source/repos/XP/frontend
npx vite --host --port 3000 > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

# Wait for frontend
sleep 5

echo ""
echo "✅ Application started!"
echo ""
echo "📝 Access URLs:"
echo "  Backend:  http://localhost:5000"
echo "  Frontend: http://localhost:3000"
echo "  WSL2:     http://172.26.249.148:3000"
echo ""
echo "📋 Logs:"
echo "  Backend:  tail -f /tmp/backend.log"
echo "  Frontend: tail -f /tmp/frontend.log"
echo ""
echo "🛑 To stop: pkill -f node"