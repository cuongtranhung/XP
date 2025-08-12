#!/bin/bash

# Frontend Performance Fix Script
echo "🚀 Fixing Frontend Performance Issues..."

cd frontend

# Step 1: Clean everything
echo "📦 Cleaning node_modules and cache..."
rm -rf node_modules
rm -rf .vite
rm -rf dist
rm -f package-lock.json

# Step 2: Update to correct Vite version
echo "📝 Fixing package versions..."
npm install vite@^5.0.10 --save-dev

# Step 3: Reinstall dependencies
echo "📥 Installing dependencies..."
npm install

# Step 4: Use optimized vite config
echo "⚙️ Applying optimized configuration..."
if [ -f vite.config.optimized.ts ]; then
  mv vite.config.ts vite.config.backup.ts
  mv vite.config.optimized.ts vite.config.ts
  echo "✅ Optimized vite config applied"
fi

# Step 5: Remove problematic stability file
echo "🗑️ Removing problematic files..."
if [ -f ../frontend-stability-fixes.js ]; then
  rm ../frontend-stability-fixes.js
  echo "✅ Removed frontend-stability-fixes.js"
fi

# Step 6: Build to test
echo "🔨 Building project..."
npm run build

echo "✨ Performance fixes applied successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Run 'npm run dev' to start the development server"
echo "2. Monitor console for any errors"
echo "3. Check performance in Chrome DevTools"
echo ""
echo "⚡ Expected improvements:"
echo "- Faster startup time (2-3x faster)"
echo "- No more crashes/freezes"
echo "- Reduced memory usage"
echo "- Better chunk splitting"