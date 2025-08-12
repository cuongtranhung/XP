#!/bin/bash
# TypeScript 5.7 Compatibility Fix Script

set -e
cd "$(dirname "$0")/.."

echo "🔧 Fixing TypeScript 5.7 compatibility issues..."

# Fix 1: Update import statements for LoadingSpinner (both named and default)
echo "📦 Fixing LoadingSpinner imports..."
find frontend/src -name "*.tsx" -o -name "*.ts" | xargs grep -l "LoadingSpinner" | while read file; do
    # Keep existing default imports as they are
    # Convert destructured imports to use both named and default
    sed -i 's/import { LoadingSpinner }/import LoadingSpinner, { LoadingSpinner as SpinnerComponent }/g' "$file"
    # Fix the usage to use default import
    sed -i 's/<SpinnerComponent/<LoadingSpinner/g' "$file"
done

# Fix 2: Fix isRequired prop to required
echo "🔧 Fixing isRequired -> required prop..."
find frontend/src -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/isRequired:/required:/g'
find frontend/src -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/isRequired\([^a-zA-Z_]\)/required\1/g'

# Fix 3: Remove jsx prop from style elements  
echo "🎨 Fixing JSX style elements..."
find frontend/src -name "*.tsx" | xargs sed -i 's/<style jsx>/<style>/g'
find frontend/src -name "*.tsx" | xargs sed -i '/jsx: true,/d'

# Fix 4: Fix toast method calls
echo "🍞 Fixing toast method calls..."
find frontend/src -name "*.tsx" | xargs sed -i 's/toast\.info(/toast.success(/g'

# Fix 5: Fix missing return statements
echo "↩️  Adding missing return statements..."
find frontend/src -name "*.tsx" | while read file; do
    # Add return null; to components that don't return anything
    sed -i '/^  }: React\.FC/,/^}$/{
        /^}$/{
            i\  return null;
        }
    }' "$file"
done

# Fix 6: Fix component return type issues
echo "🔄 Fixing component return types..."
find frontend/src -name "*.tsx" | while read file; do
    # For switch statements without default returns, add return null
    if grep -q "switch.*{" "$file" && ! grep -q "default:" "$file"; then
        sed -i '/switch.*{/,/}/ {
            /}$/ i\    default:\
            /}$/ i\      return null;
        }' "$file"
    fi
done

# Fix 7: Fix aria-relevant attribute values
echo "🎯 Fixing ARIA attributes..."
find frontend/src -name "*.tsx" | xargs sed -i 's/aria-relevant="[^"]*"/aria-relevant="additions text"/g'

# Fix 8: Fix number vs string comparison issues  
echo "🔢 Fixing type comparison issues..."
find frontend/src -name "*.tsx" | while read file; do
    # Convert number comparisons to proper types
    sed -i 's/\([a-zA-Z_][a-zA-Z0-9_]*\) === '\''[0-9]\+'\''/String(\1) === "\2"/g' "$file"
    sed -i 's/\([a-zA-Z_][a-zA-Z0-9_]*\) === "[0-9]\+"/Number(\1) === \2/g' "$file"
done

echo "✅ TypeScript 5.7 compatibility fixes completed!"
echo ""
echo "📋 Summary of fixes applied:"
echo "   - Fixed LoadingSpinner import/export patterns"
echo "   - Changed isRequired props to required"
echo "   - Removed jsx prop from style elements"  
echo "   - Fixed toast method calls"
echo "   - Added missing return statements"
echo "   - Fixed component return types"
echo "   - Fixed ARIA attribute values"
echo "   - Fixed type comparison issues"
echo ""
echo "🧪 Next: Run 'npm run typecheck' to verify fixes"