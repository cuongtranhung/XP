#!/bin/bash
export PORT=5000
export NODE_ENV=development
npx ts-node --transpile-only src/server.ts