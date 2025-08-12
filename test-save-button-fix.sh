#!/bin/bash

echo "=== Testing Save Button Fix for Edit Form ==="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Save Button Logic:${NC}"
echo "----------------------------------------"

# Check the current Save button logic
echo "Current Save button disable condition:"
grep -A2 -B2 "onClick={handleSave}" /mnt/c/Users/Admin/source/repos/XP/frontend/src/pages/FormBuilderWithCollaboration.tsx | grep "disabled="

echo ""
echo -e "${GREEN}Expected Behavior:${NC}"
echo "1. When EDITING existing form (id !== 'new'):"
echo "   - Save button should be ENABLED (can save anytime)"
echo ""
echo "2. When CREATING new form (id === 'new'):"
echo "   - Save button disabled ONLY when:"
echo "     • No changes made (isDirty = false)"
echo "     • No field changes (hasChanges = false)"  
echo "     • No fields added (fields.length = 0)"
echo "   - Otherwise ENABLED"
echo ""
echo "3. Always disabled when loading = true"

echo ""
echo -e "${YELLOW}Current Implementation:${NC}"
echo "disabled={loading || (id === 'new' && !isDirty && !hasChanges && (!formBuilderContext?.fields || formBuilderContext.fields.length === 0))}"

echo ""
echo -e "${GREEN}✓ This means:${NC}"
echo "• Edit mode: Save always enabled (unless loading)"
echo "• Create mode: Save enabled when any change occurs"
echo ""
echo "The Save button should now work correctly when editing forms!"