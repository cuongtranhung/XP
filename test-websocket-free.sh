#!/bin/bash

# Test script to verify WebSocket errors are eliminated

echo "=== Testing Form Builder Without WebSocket Errors ==="
echo ""

# 1. Check if collaboration hooks are properly configured
echo "1. Checking collaboration hook configuration..."
grep -l "useFormCollaborationDisabled" /mnt/c/Users/Admin/source/repos/XP/frontend/src/pages/FormBuilderWithCollaboration.tsx > /dev/null && \
    echo "✅ FormBuilderWithCollaboration uses disabled hook" || \
    echo "❌ FormBuilderWithCollaboration not using disabled hook"

# 2. Check if socket.io imports are removed
echo ""
echo "2. Checking for socket.io imports..."
if grep -r "import.*socket.io-client" /mnt/c/Users/Admin/source/repos/XP/frontend/src --include="*.ts" --include="*.tsx" 2>/dev/null; then
    echo "❌ Found socket.io-client imports"
else
    echo "✅ No socket.io-client imports found"
fi

# 3. Check if useFormCollaboration.ts is disabled
echo ""
echo "3. Checking if useFormCollaboration.ts is disabled..."
grep "console.warn" /mnt/c/Users/Admin/source/repos/XP/frontend/src/hooks/useFormCollaboration.ts > /dev/null && \
    echo "✅ useFormCollaboration.ts is disabled with warning" || \
    echo "❌ useFormCollaboration.ts might still be active"

# 4. Check frontend is running
echo ""
echo "4. Checking if frontend is running..."
curl -I -s --max-time 2 http://localhost:3000 > /dev/null && \
    echo "✅ Frontend is running on port 3000" || \
    echo "❌ Frontend is not responding"

# 5. Summary
echo ""
echo "=== Summary ==="
echo "WebSocket errors should be eliminated if all checks pass."
echo "The form builder should work without any console errors."