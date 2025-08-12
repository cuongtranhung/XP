#!/bin/bash
# Start services with optimized memory limits

echo "🚀 Starting services with memory optimization..."

# Set Node.js memory limits (2GB for backend)
export NODE_OPTIONS="--max-old-space-size=2048 --max-semi-space-size=64"

# Enable production optimizations
export NODE_ENV=production
export UV_THREADPOOL_SIZE=4

# Database settings
export DB_POOL_MAX=50
export DB_POOL_MIN=10
export DB_IDLE_TIMEOUT=30000

# Enable memory monitoring
export MEMORY_MONITORING=true

echo "📊 Memory limits set:"
echo "  - Max heap: 2048MB"
echo "  - Thread pool: 4"
echo "  - DB pool: 10-50 connections"

# Start backend with memory limits
echo "🔧 Starting backend..."
cd backend && npm run dev &
BACKEND_PID=$!

# Start frontend (development mode for now)
echo "🎨 Starting frontend..."
cd ../frontend && npm run dev &
FRONTEND_PID=$!

echo "✅ Services started:"
echo "  - Backend PID: $BACKEND_PID"
echo "  - Frontend PID: $FRONTEND_PID"

# Save PIDs for later management
echo $BACKEND_PID > backend.pid
echo $FRONTEND_PID > frontend.pid

echo "🎯 Services running with memory optimization"
echo "To stop: kill \$(cat backend.pid) \$(cat frontend.pid)"