#!/bin/bash

# Stop Development Environment Script

echo "🛑 Stopping Development Environment..."

# Kill backend processes
echo "Stopping backend..."
pkill -f "node.*server" 2>/dev/null || true
pkill -f "ts-node.*server" 2>/dev/null || true
pkill -f "npm.*dev" 2>/dev/null || true

# Kill frontend processes
echo "Stopping frontend..."
pkill -f "vite" 2>/dev/null || true
pkill -f "npm.*dev" 2>/dev/null || true

# Check if processes are stopped
sleep 2

# Check for remaining processes
REMAINING=$(ps aux | grep -E "(vite|node.*server|ts-node)" | grep -v grep | wc -l)

if [ $REMAINING -eq 0 ]; then
    echo "✅ All services stopped successfully"
else
    echo "⚠️ Some processes may still be running:"
    ps aux | grep -E "(vite|node.*server|ts-node)" | grep -v grep
fi

echo "Done!"