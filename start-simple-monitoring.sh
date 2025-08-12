#!/bin/bash
# Start Simple Monitoring Dashboard

echo "🚀 Starting Simple Monitoring Dashboard"
echo "======================================"
echo ""

# Check if already running
if [ -f "monitoring-server.pid" ]; then
    OLD_PID=$(cat monitoring-server.pid)
    if ps -p $OLD_PID > /dev/null 2>&1; then
        echo "✅ Monitoring server already running (PID: $OLD_PID)"
        echo "📊 Dashboard: http://172.26.249.148:4000"
        echo ""
        exit 0
    fi
fi

# Start the server
echo "Starting monitoring server..."
node simple-monitoring-server.js > simple-monitoring.log 2>&1 &
PID=$!
echo $PID > monitoring-server.pid

# Wait for server to start
sleep 2

# Check if running
if ps -p $PID > /dev/null 2>&1; then
    echo "✅ Monitoring server started (PID: $PID)"
    echo ""
    echo "📊 Dashboard URLs:"
    echo "   http://localhost:4000"
    echo "   http://172.26.249.148:4000"
    echo ""
    echo "📝 Log file: simple-monitoring.log"
    echo "🛑 To stop: kill $(cat monitoring-server.pid)"
    echo ""
else
    echo "❌ Failed to start server - check simple-monitoring.log"
    exit 1
fi