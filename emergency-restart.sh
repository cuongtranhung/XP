#!/bin/bash
# Emergency System Restart Script
# Use this when system is unresponsive or experiencing critical issues

echo "🚨 EMERGENCY SYSTEM RESTART"
echo "============================"
echo "This will forcefully restart all services"
echo ""

# Confirmation prompt
read -p "Are you sure you want to perform emergency restart? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Restart cancelled"
    exit 0
fi

echo ""
echo "📝 Starting emergency restart at $(date)"

# Step 1: Stop all services
echo "🛑 Stopping all services..."
if [ -f backend.pid ]; then
    kill $(cat backend.pid) 2>/dev/null && echo "  - Backend stopped"
fi

if [ -f frontend.pid ]; then
    kill $(cat frontend.pid) 2>/dev/null && echo "  - Frontend stopped"
fi

if [ -f alert-monitor.pid ]; then
    kill $(cat alert-monitor.pid) 2>/dev/null && echo "  - Alert monitor stopped"
fi

# Kill any remaining node processes
pkill -f "node.*server" 2>/dev/null
pkill -f "node.*vite" 2>/dev/null

# Step 2: Clear problematic caches and temp files
echo "🧹 Clearing caches and temporary files..."
rm -rf /tmp/cache/* 2>/dev/null
rm -rf frontend/node_modules/.vite 2>/dev/null
rm -rf backend/dist/* 2>/dev/null

# Truncate large log files instead of deleting
echo "📄 Truncating log files..."
echo "Log truncated at $(date)" > stability-monitor.log
echo "Log truncated at $(date)" > alerts.log
echo "Log truncated at $(date)" > critical-alerts.log

# Step 3: Free up ports if needed
echo "🔌 Checking and freeing ports..."
fuser -k 5000/tcp 2>/dev/null && echo "  - Port 5000 freed"
fuser -k 3000/tcp 2>/dev/null && echo "  - Port 3000 freed"

# Wait a moment for ports to be fully released
sleep 2

# Step 4: Start backend in safe mode
echo "🔧 Starting backend in safe mode..."
cd backend
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=1024 --max-semi-space-size=32"
export DB_POOL_MAX=20
export DB_POOL_MIN=5

npm run dev > ../backend-emergency.log 2>&1 &
BACKEND_PID=$!
cd ..
echo $BACKEND_PID > backend.pid
echo "  - Backend started with PID: $BACKEND_PID"

# Wait for backend to initialize
echo "⏳ Waiting for backend to initialize..."
for i in {1..30}; do
    if curl -s http://localhost:5000/health > /dev/null 2>&1; then
        echo "  ✅ Backend is responding"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "  ❌ Backend failed to start - check backend-emergency.log"
        exit 1
    fi
    sleep 1
done

# Step 5: Build and start frontend in production mode
echo "🎨 Starting frontend in production mode..."
cd frontend

# Use production build if available, otherwise dev mode
if [ -d "dist" ] && [ -f "dist/index.html" ]; then
    echo "  - Using existing production build"
    npx vite preview --port 3000 > ../frontend-emergency.log 2>&1 &
else
    echo "  - Starting in development mode"
    npm run dev > ../frontend-emergency.log 2>&1 &
fi

FRONTEND_PID=$!
cd ..
echo $FRONTEND_PID > frontend.pid
echo "  - Frontend started with PID: $FRONTEND_PID"

# Step 6: Start monitoring
echo "📊 Starting monitoring services..."
node stability-monitoring.js > monitoring-emergency.log 2>&1 &
MONITOR_PID=$!
echo $MONITOR_PID > monitor.pid
echo "  - Monitoring started with PID: $MONITOR_PID"

# Step 7: Verify all services
echo ""
echo "🔍 Verifying services..."
sleep 3

# Check backend
if curl -s http://localhost:5000/health > /dev/null 2>&1; then
    echo "  ✅ Backend: RUNNING"
else
    echo "  ❌ Backend: NOT RESPONDING"
fi

# Check frontend
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "  ✅ Frontend: RUNNING"
else
    echo "  ❌ Frontend: NOT RESPONDING"
fi

# Check monitoring
if ps -p $MONITOR_PID > /dev/null 2>&1; then
    echo "  ✅ Monitoring: RUNNING"
else
    echo "  ❌ Monitoring: NOT RUNNING"
fi

echo ""
echo "============================"
echo "🚀 Emergency restart complete at $(date)"
echo ""
echo "📝 Log files:"
echo "  - backend-emergency.log"
echo "  - frontend-emergency.log"
echo "  - monitoring-emergency.log"
echo ""
echo "⚠️  System is running in SAFE MODE with reduced resources"
echo "Please investigate the root cause and restore normal operations"
echo ""
echo "To stop services: ./stop-all-services.sh"
echo "To return to normal mode: ./start-with-memory-limits.sh"