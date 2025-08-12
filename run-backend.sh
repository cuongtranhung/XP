#!/bin/bash
cd backend
export PORT=5000
export NODE_ENV=development
exec npx tsx src/server.ts