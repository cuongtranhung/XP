#!/bin/bash
# Stop all running services cleanly

echo "🛑 Stopping All Services"
echo "======================="
echo ""

# Function to stop service
stop_service() {
    local pid_file=$1
    local service_name=$2
    
    if [ -f "$pid_file" ]; then
        PID=$(cat "$pid_file")
        if ps -p $PID > /dev/null 2>&1; then
            echo "Stopping $service_name (PID: $PID)..."
            kill $PID 2>/dev/null
            
            # Wait for graceful shutdown (max 5 seconds)
            for i in {1..5}; do
                if ! ps -p $PID > /dev/null 2>&1; then
                    echo "  ✅ $service_name stopped gracefully"
                    rm -f "$pid_file"
                    return 0
                fi
                sleep 1
            done
            
            # Force kill if still running
            echo "  ⚠️  Force stopping $service_name..."
            kill -9 $PID 2>/dev/null
            rm -f "$pid_file"
            echo "  ✅ $service_name force stopped"
        else
            echo "  ℹ️  $service_name not running (stale PID file)"
            rm -f "$pid_file"
        fi
    else
        echo "  ℹ️  No PID file for $service_name"
    fi
}

# Stop all services
stop_service "backend.pid" "Backend"
stop_service "frontend.pid" "Frontend"
stop_service "alert-monitor.pid" "Alert Monitor"
stop_service "monitor.pid" "Stability Monitor"

# Additional cleanup - stop any node processes that might be orphaned
echo ""
echo "🧹 Checking for orphaned processes..."

# Find and stop orphaned node processes
ORPHANED=$(pgrep -f "node.*(server|vite|monitoring|alert)" 2>/dev/null)
if [ ! -z "$ORPHANED" ]; then
    echo "Found orphaned processes: $ORPHANED"
    echo "Stopping orphaned processes..."
    pkill -f "node.*(server|vite|monitoring|alert)" 2>/dev/null
    echo "  ✅ Orphaned processes stopped"
else
    echo "  ✅ No orphaned processes found"
fi

# Free up ports
echo ""
echo "🔌 Freeing up ports..."
fuser -k 5000/tcp 2>/dev/null && echo "  ✅ Port 5000 freed" || echo "  ℹ️  Port 5000 already free"
fuser -k 3000/tcp 2>/dev/null && echo "  ✅ Port 3000 freed" || echo "  ℹ️  Port 3000 already free"

echo ""
echo "======================="
echo "✅ All services stopped"
echo ""
echo "To restart services:"
echo "  Normal mode: ./start-with-memory-limits.sh"
echo "  Emergency mode: ./emergency-restart.sh"
echo "  Monitoring only: ./start-alert-monitoring.sh"