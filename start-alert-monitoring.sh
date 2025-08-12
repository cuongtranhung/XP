#!/bin/bash
# Start alert threshold monitoring

echo "🚨 Starting Alert Threshold Monitoring..."
echo "=================================="
echo "This will monitor critical system metrics and trigger alerts"
echo "when thresholds are exceeded."
echo ""
echo "Thresholds:"
echo "  Memory: Warning 70%, Critical 85%, Emergency 95%"
echo "  CPU: Warning 60%, Critical 80%, Emergency 95%"
echo "  Response Time: Warning 1s, Critical 3s, Emergency 5s"
echo "  Error Rate: Warning 1%, Critical 5%, Emergency 10%"
echo "=================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if alert-thresholds.js exists
if [ ! -f "alert-thresholds.js" ]; then
    echo "❌ alert-thresholds.js not found in current directory"
    exit 1
fi

# Create log directory if it doesn't exist
LOG_DIR="logs"
if [ ! -d "$LOG_DIR" ]; then
    mkdir -p "$LOG_DIR"
    echo "📁 Created logs directory"
fi

# Start monitoring
echo "🔄 Starting monitoring process..."
node alert-thresholds.js 2>&1 | tee -a logs/alert-monitor.log &
PID=$!

echo "✅ Alert monitoring started with PID: $PID"
echo ""
echo "📝 Log files:"
echo "  - alerts.log: All alerts"
echo "  - critical-alerts.log: Critical and emergency alerts only"
echo "  - logs/alert-monitor.log: Process output"
echo ""
echo "To stop monitoring: kill $PID"
echo ""

# Save PID for later management
echo $PID > alert-monitor.pid
echo "💾 PID saved to alert-monitor.pid"

# Option to run in foreground
read -p "Run in foreground? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Running in foreground mode. Press Ctrl+C to stop."
    wait $PID
else
    echo "Running in background. Use 'kill \$(cat alert-monitor.pid)' to stop."
fi