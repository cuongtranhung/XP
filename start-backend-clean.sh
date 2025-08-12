#!/bin/bash
echo "🧹 Killing old backend processes..."
pkill -f tsx 2>/dev/null
pkill -f "node.*server" 2>/dev/null
sleep 2

echo "🚀 Starting backend server..."
cd backend
export PORT=5000
export NODE_ENV=development
npx tsx src/server.ts