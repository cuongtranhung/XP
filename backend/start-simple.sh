#!/bin/bash

# Simple backend start script that bypasses TypeScript errors

echo "Starting backend with transpile-only mode..."

# Kill any existing backend process
pkill -f "node.*server" 2>/dev/null || true
pkill -f "ts-node" 2>/dev/null || true

# Start backend with transpile-only
npx ts-node --transpile-only src/server.ts