#!/bin/bash

echo "=== Testing Form Save Button Fix ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "Checking the Save button logic in FormBuilderWithCollaboration.tsx..."
echo ""

# Check if the hasChanges state is added
echo "1. Checking hasChanges state implementation:"
if grep -q "const \[hasChanges, setHasChanges\] = useState(false)" /mnt/c/Users/Admin/source/repos/XP/frontend/src/pages/FormBuilderWithCollaboration.tsx; then
    echo -e "${GREEN}✅ hasChanges state is implemented${NC}"
else
    echo -e "${RED}❌ hasChanges state not found${NC}"
fi

echo ""
echo "2. Checking if field changes trigger hasChanges:"
if grep -q "setHasChanges(true); // Mark as changed" /mnt/c/Users/Admin/source/repos/XP/frontend/src/pages/FormBuilderWithCollaboration.tsx; then
    echo -e "${GREEN}✅ Field changes trigger hasChanges${NC}"
else
    echo -e "${RED}❌ Field changes don't trigger hasChanges${NC}"
fi

echo ""
echo "3. Checking Save button logic:"
if grep -q "disabled={(id === 'new' && !isDirty && !hasChanges) || (locked && !hasLock)}" /mnt/c/Users/Admin/source/repos/XP/frontend/src/pages/FormBuilderWithCollaboration.tsx; then
    echo -e "${GREEN}✅ Save button enables correctly for edit mode${NC}"
    echo "   - When creating new form: requires changes (isDirty or hasChanges)"
    echo "   - When editing existing form: always enabled (unless locked)"
else
    echo -e "${RED}❌ Save button logic needs update${NC}"
fi

echo ""
echo "4. Checking if hasChanges resets after save:"
if grep -q "setHasChanges(false); // Reset changes flag after successful save" /mnt/c/Users/Admin/source/repos/XP/frontend/src/pages/FormBuilderWithCollaboration.tsx; then
    echo -e "${GREEN}✅ hasChanges resets after successful save${NC}"
else
    echo -e "${RED}❌ hasChanges doesn't reset after save${NC}"
fi

echo ""
echo "=== Summary ==="
echo "The Save button should now work correctly:"
echo "- When editing an existing form: Save button is always enabled"
echo "- When creating a new form: Save button enables when changes are made"
echo "- Changes to fields are properly tracked"
echo ""
echo "Test by:"
echo "1. Go to Forms list"
echo "2. Click Edit on any form"
echo "3. The Save button should be enabled immediately"
echo "4. Make changes to fields - Save button stays enabled"
echo "5. Save and verify the changes are persisted"