# Manual Test Guide - WebSocket Errors & Save Button

## Test 1: WebSocket Errors Check

### Steps:
1. Open browser and navigate to http://localhost:3000
2. Open Developer Console (F12) → Console tab
3. Login with:
   - Email: cuongtranhung@gmail.com
   - Password: @Abcd6789
4. Navigate to Forms page
5. Click Edit on any form or Create New Form

### Expected Results:
- ✅ **NO WebSocket errors** in console
- ✅ No "WebSocket connection failed" messages
- ✅ No "socket.io" connection errors

### What was fixed:
- Replaced `useFormCollaboration` with `useFormCollaborationDisabled`
- Removed all socket.io-client imports
- Disabled WebSocket functionality completely

---

## Test 2: Save Button When Editing Form

### Steps:
1. Login and navigate to Forms page
2. Click **Edit** button on any existing form
3. Observe the Save button status

### Expected Results:
- ✅ Save button is **ENABLED** immediately when editing
- ✅ Can click Save without making any changes
- ✅ Save button remains enabled after making changes

### What was fixed:
```javascript
// Old logic (WRONG):
disabled={!isDirty || (locked && !hasLock)}

// New logic (CORRECT):
disabled={loading || (id === 'new' && !isDirty && !hasChanges && (!formBuilderContext?.fields || formBuilderContext.fields.length === 0))}
```

- When editing (id !== 'new'): Always enabled
- When creating new: Enabled after any change

---

## Test 3: Form Builder Functionality

### Steps:
1. Edit an existing form
2. Try these actions:
   - Add a new field by dragging from sidebar
   - Edit field properties
   - Delete a field
   - Reorder fields
   - Click Save

### Expected Results:
- ✅ All actions work without errors
- ✅ Save button stays enabled
- ✅ Changes are saved to database
- ✅ No console errors

---

## Summary of Fixes

1. **WebSocket Errors**: Completely disabled by using mock collaboration hook
2. **Save Button**: Fixed logic to always enable when editing existing forms
3. **Change Tracking**: Added `hasChanges` state to track field modifications

## Quick Verification Commands

```bash
# Check WebSocket is disabled
grep -r "ENABLE_WEBSOCKET = false" frontend/src/hooks/

# Check correct import
grep "useFormCollaborationDisabled" frontend/src/pages/FormBuilderWithCollaboration.tsx

# Check Save button logic
grep "disabled=" frontend/src/pages/FormBuilderWithCollaboration.tsx | grep handleSave -A1
```