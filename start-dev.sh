#!/bin/bash

# Start Development Environment Script
# This script handles WSL2 network configuration automatically

echo "🚀 Starting Development Environment..."

# Function to get Windows host IP
get_windows_host_ip() {
    # Get Windows host IP from default route (more reliable)
    ip route | grep default | awk '{print $3}'
}

# Function to check if PostgreSQL is accessible
check_postgres() {
    local host=$1
    echo "🔍 Checking PostgreSQL connection at $host:5432..."
    
    # Try to connect using psql
    PGPASSWORD='@abcd1234' psql -h "$host" -p 5432 -U postgres -d postgres -c "SELECT 1" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✅ PostgreSQL is accessible at $host"
        return 0
    else
        echo "❌ Cannot connect to PostgreSQL at $host"
        return 1
    fi
}

# Get Windows host IP
WINDOWS_HOST=$(get_windows_host_ip)
echo "📍 Windows Host IP: $WINDOWS_HOST"

# Update backend database configuration if needed
if [ -n "$WINDOWS_HOST" ]; then
    # Check if PostgreSQL is accessible
    if check_postgres "$WINDOWS_HOST"; then
        # Update .env file with current Windows host IP
        echo "📝 Updating backend database configuration..."
        
        # Create temporary .env with updated host
        cd backend
        if [ -f .env ]; then
            sed -i "s/DATABASE_HOST=.*/DATABASE_HOST=$WINDOWS_HOST/" .env
            sed -i "s/DB_HOST=.*/DB_HOST=$WINDOWS_HOST/" .env
            echo "✅ Backend .env updated with Windows host IP"
        fi
        cd ..
    else
        echo "⚠️ Using localhost fallback for database connection"
    fi
fi

# Start Backend
echo ""
echo "🔧 Starting Backend Server..."
cd backend

# Kill any existing backend process
pkill -f "node.*server" 2>/dev/null || true
pkill -f "ts-node.*server" 2>/dev/null || true

# Start backend in background
nohup npm run dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend started with PID: $BACKEND_PID"

# Wait for backend to be ready
echo "⏳ Waiting for backend to be ready..."
sleep 5

# Check if backend is running
if curl -s http://localhost:5000/api/health > /dev/null; then
    echo "✅ Backend is running at http://localhost:5000"
else
    echo "❌ Backend failed to start. Check logs/backend.log"
    exit 1
fi

cd ..

# Start Frontend
echo ""
echo "🎨 Starting Frontend Server..."
cd frontend

# Kill any existing frontend process
pkill -f "vite" 2>/dev/null || true

# Start frontend in background
nohup npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ Frontend started with PID: $FRONTEND_PID"

# Wait for frontend to be ready
echo "⏳ Waiting for frontend to be ready..."
sleep 5

# Check if frontend is running
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Frontend is running at http://localhost:3000"
else
    echo "❌ Frontend failed to start. Check logs/frontend.log"
    exit 1
fi

cd ..

echo ""
echo "🎉 Development environment is ready!"
echo ""
echo "📋 Access URLs:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:5000"
echo "   Database: $WINDOWS_HOST:5432"
echo ""
echo "📝 Logs:"
echo "   Backend:  logs/backend.log"
echo "   Frontend: logs/frontend.log"
echo ""
echo "🛑 To stop all services, run: ./stop-dev.sh"
echo ""

# Keep script running and show logs
echo "📊 Showing combined logs (Ctrl+C to exit)..."
tail -f logs/backend.log logs/frontend.log