# 🧪 Manual Test Guide: Profile Update Navigation

## Current Database State
```sql
User: cuongtranhung@gmail.com
Full Name: "Trần Hùng Cường"  
Date of Birth: "2008-07-11" (in DB as Date object)
```

## Test Steps

### Step 1: Login
1. **Open browser**: Navigate to `http://localhost:3000`
2. **Login with**:
   - Email: `cuongtranhung@gmail.com`
   - Password: `@Abcd6789`
3. **Expected**: Redirect to Dashboard with user info displayed

### Step 2: Check Current Dashboard Info
**Look for current values**:
- Full Name in header: "Welcome back, Trần Hùng Cường!"
- Date of Birth in Account Information: "12/07/2008" (DD/MM/YYYY format)

### Step 3: Navigate to Settings
1. **Click**: "Update Profile" button in Quick Actions
2. **Expected**: Navigate to `/settings?tab=profile`
3. **Verify**: Settings page loads with current values:
   - Full Name field: "Trần Hùng Cường"
   - Date of Birth field: "12/07/2008" (DD/MM/YYYY format)

### Step 4: Update Profile
1. **Change Date of Birth**: Clear field and enter `25/12/1990`
2. **Change Full Name**: Add " - Navigation Test" → `Trần Hùng Cường - Navigation Test`
3. **Click**: "Save Changes" button

### Step 5: Verify Navigation Flow
**Expected Console Logs** (F12 → Console):
```
✅ Profile update successful, starting navigation flow...
🔄 Refreshing user data...
✅ User data refreshed
🚀 Starting navigation to dashboard in 1.5 seconds...
📍 Navigating to dashboard...
```

**Expected UI Behavior**:
1. ✅ Toast message: "Profile updated successfully"
2. ✅ After 1.5 seconds: Auto-redirect to `/dashboard`
3. ✅ Dashboard shows updated info:
   - Header: "Welcome back, Trần Hùng Cường - Navigation Test!"
   - Date of Birth: "25/12/1990"

### Step 6: Database Verification
After successful update, database should show:
```sql
Full Name: "Trần Hùng Cường - Navigation Test"
Date of Birth: "1990-12-25" (YYYY-MM-DD format in DB)
```

## Debug Checklist

### If Navigation Doesn't Work:
1. **Check Console**: Look for error messages or missing logs
2. **Check Network Tab**: Verify API call to `/api/auth/profile` succeeds
3. **Check Toast**: Does success message appear?
4. **Check URL**: Does URL change to `/dashboard` after 1.5s?

### If Date Format Wrong:
1. **Input Field**: Should accept DD/MM/YYYY format
2. **API Payload**: Should send YYYY-MM-DD to backend
3. **Database**: Should store as YYYY-MM-DD
4. **Display**: Should show DD/MM/YYYY in Dashboard

### If User Data Not Refreshed:
1. **Check AuthContext**: `refreshUser()` should be called
2. **Check API**: `/api/auth/me` should return updated data
3. **Check Dashboard**: Should use latest user data from context

## Test Results Template

**Date/Time**: _______
**Tester**: _______

| Step | Expected | Actual | Pass/Fail | Notes |
|------|----------|--------|-----------|-------|
| Login | Dashboard loads | | | |
| Settings Navigation | Settings page loads | | | |
| Profile Update | Success message shows | | | |
| Auto Navigation | Redirects to dashboard | | | |
| Updated Info Display | Shows new values | | | |
| Database Update | Correct format stored | | | |

**Overall Result**: PASS / FAIL
**Issues Found**: _______
**Additional Notes**: _______