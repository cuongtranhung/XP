#!/bin/bash

# Backend Stability Monitoring Script
# Monitors backend health and auto-restarts if needed

BACKEND_PORT=5000
FRONTEND_PORT=3000
BACKEND_DIR="/mnt/c/Users/Admin/source/repos/XP/backend"
FRONTEND_DIR="/mnt/c/Users/Admin/source/repos/XP/frontend"
LOG_FILE="/mnt/c/Users/Admin/source/repos/XP/stability-monitor.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_backend() {
    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$BACKEND_PORT/health" 2>/dev/null)
    
    if [ "$response" = "200" ]; then
        return 0
    else
        return 1
    fi
}

check_frontend() {
    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$FRONTEND_PORT" 2>/dev/null)
    
    if [ "$response" = "200" ]; then
        return 0
    else
        return 1
    fi
}

restart_backend() {
    log "🔄 Restarting backend server..."
    
    # Kill existing backend processes
    pkill -f "ts-node.*server.ts" || true
    sleep 2
    
    # Start backend
    cd "$BACKEND_DIR"
    PORT=$BACKEND_PORT nohup npx ts-node --transpile-only src/server.ts > backend-monitor.log 2>&1 &
    
    sleep 5
    
    if check_backend; then
        log "✅ Backend restarted successfully"
        return 0
    else
        log "❌ Backend restart failed"
        return 1
    fi
}

restart_frontend() {
    log "🔄 Restarting frontend server..."
    
    # Kill existing frontend processes
    pkill -f "vite.*3000" || true
    sleep 2
    
    # Start frontend
    cd "$FRONTEND_DIR"
    PORT=$FRONTEND_PORT nohup npm run dev > frontend-monitor.log 2>&1 &
    
    sleep 5
    
    if check_frontend; then
        log "✅ Frontend restarted successfully"
        return 0
    else
        log "❌ Frontend restart failed"
        return 1
    fi
}

monitor_loop() {
    log "🚀 Starting backend stability monitor..."
    
    while true; do
        # Check backend
        if ! check_backend; then
            log "⚠️  Backend not responding, attempting restart..."
            if ! restart_backend; then
                log "🚨 Critical: Backend restart failed multiple times"
            fi
        fi
        
        # Check frontend
        if ! check_frontend; then
            log "⚠️  Frontend not responding, attempting restart..."
            if ! restart_frontend; then
                log "🚨 Critical: Frontend restart failed"
            fi
        fi
        
        # Check system resources
        local memory_usage
        memory_usage=$(free | grep Mem | awk '{printf "%.1f", ($3/$2)*100}')
        
        if (( $(echo "$memory_usage > 90" | bc -l) 2>/dev/null )); then
            log "⚠️  High memory usage: ${memory_usage}%"
        fi
        
        # Wait 30 seconds before next check
        sleep 30
    done
}

# Usage instructions
show_usage() {
    echo "Backend Stability Monitor"
    echo ""
    echo "Usage:"
    echo "  $0 start    - Start monitoring in background"
    echo "  $0 stop     - Stop monitoring"
    echo "  $0 status   - Show current status"
    echo "  $0 check    - Run single health check"
    echo "  $0 logs     - Show recent logs"
    echo ""
}

case "$1" in
    start)
        if pgrep -f "monitor-backend-stability.sh" > /dev/null; then
            log "⚠️  Monitor already running"
        else
            log "🚀 Starting monitoring daemon..."
            nohup "$0" monitor > /dev/null 2>&1 &
            log "✅ Monitor started (PID: $!)"
        fi
        ;;
    
    stop)
        pkill -f "monitor-backend-stability.sh" && log "🛑 Monitor stopped" || log "ℹ️  Monitor not running"
        ;;
    
    status)
        if pgrep -f "monitor-backend-stability.sh" > /dev/null; then
            echo "✅ Monitor is running"
        else
            echo "❌ Monitor is not running"
        fi
        
        if check_backend; then
            echo "✅ Backend is healthy"
        else
            echo "❌ Backend is not responding"
        fi
        
        if check_frontend; then
            echo "✅ Frontend is healthy"
        else
            echo "❌ Frontend is not responding"
        fi
        ;;
    
    check)
        log "🔍 Running health checks..."
        if check_backend; then
            log "✅ Backend: Healthy"
        else
            log "❌ Backend: Not responding"
        fi
        
        if check_frontend; then
            log "✅ Frontend: Healthy"
        else
            log "❌ Frontend: Not responding"
        fi
        ;;
    
    logs)
        tail -20 "$LOG_FILE" 2>/dev/null || echo "No logs found"
        ;;
    
    monitor)
        monitor_loop
        ;;
    
    *)
        show_usage
        ;;
esac