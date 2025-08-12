#!/bin/bash
# Automated monitoring startup script

echo "🚀 Starting Stability Monitoring System..."

# Check if monitoring is already running
if pgrep -f "stability-monitoring.js" > /dev/null; then
    echo "⚠️ Monitoring is already running"
    exit 0
fi

# Start monitoring in background
nohup node stability-monitoring.js > stability-monitor-output.log 2>&1 &
MONITOR_PID=$!

echo "✅ Monitoring started with PID: $MONITOR_PID"
echo "📊 Logs: stability-monitor-output.log"
echo "📝 Monitor log: stability-monitor.log"

# Save PID for later management
echo $MONITOR_PID > monitoring.pid

echo "🎯 Monitoring is now running in background"
echo "To stop: kill \$(cat monitoring.pid)"