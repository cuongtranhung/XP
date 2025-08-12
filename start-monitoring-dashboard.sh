#!/bin/bash
# Start Monitoring Dashboard and API Server

echo "🚀 Starting Monitoring Dashboard System"
echo "======================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if monitoring-api.js exists
if [ ! -f "monitoring-api.js" ]; then
    echo "❌ monitoring-api.js not found"
    exit 1
fi

# Check if dashboard HTML exists
if [ ! -f "monitoring-dashboard.html" ]; then
    echo "❌ monitoring-dashboard.html not found"
    exit 1
fi

# Create backups directory if it doesn't exist
if [ ! -d "backups" ]; then
    mkdir -p backups
    echo "📁 Created backups directory"
fi

# Check if API server is already running
if [ -f "dashboard-api.pid" ]; then
    OLD_PID=$(cat dashboard-api.pid)
    if ps -p $OLD_PID > /dev/null 2>&1; then
        echo "⚠️  Dashboard API is already running (PID: $OLD_PID)"
        echo "Stop it first with: kill $OLD_PID"
        exit 1
    fi
fi

# Start the monitoring API server
echo "📡 Starting Monitoring API Server..."
node monitoring-api.js > dashboard-api.log 2>&1 &
API_PID=$!
echo $API_PID > dashboard-api.pid

# Wait for API to start
echo "⏳ Waiting for API server to initialize..."
for i in {1..10}; do
    if curl -s http://localhost:4000/api/health > /dev/null 2>&1; then
        echo "✅ API Server is running (PID: $API_PID)"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ API Server failed to start - check dashboard-api.log"
        kill $API_PID 2>/dev/null
        rm dashboard-api.pid
        exit 1
    fi
    sleep 1
done

# Display access information
echo ""
echo "======================================"
echo "✅ Monitoring Dashboard is ready!"
echo ""
echo "🖥️  Dashboard URL: http://localhost:4000"
echo "📡 API Endpoint: http://localhost:4000/api"
echo "📝 API Log: dashboard-api.log"
echo ""
echo "Features available:"
echo "  • Real-time system metrics"
echo "  • Service control panel"
echo "  • Log viewer"
echo "  • Alert monitoring"
echo "  • Emergency controls"
echo ""
echo "To stop: kill $(cat dashboard-api.pid)"
echo "======================================"
echo ""

# Optional: Open browser
echo "Would you like to open the dashboard in your browser? (y/n)"
read -n 1 -r REPLY
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Try to open browser based on OS
    if command -v xdg-open &> /dev/null; then
        xdg-open http://localhost:4000
    elif command -v open &> /dev/null; then
        open http://localhost:4000
    elif command -v start &> /dev/null; then
        start http://localhost:4000
    else
        echo "Please open http://localhost:4000 in your browser"
    fi
fi