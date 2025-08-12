# PERMANENT TEST CREDENTIALS

## ⚠️ IMPORTANT: DO NOT CHANGE THESE CREDENTIALS

These credentials are permanently configured for testing purposes and must **NEVER** be changed.

## Test Account

**Email**: `cuongtranhung@gmail.com`  
**Password**: `@Abcd6789`

## Database Information

- **User ID**: 2
- **Full Name**: Trần Hùng Cường
- **Email Verified**: Yes
- **Account Status**: Active

## Password Hash (for reference)

```
$2a$12$l13iQ9XKJeTYcg6hyfhvaeJ/f.e/nDwFM8f9/SwmeVb7INwaXurJC
```

## Testing Commands

### API Login Test
```bash
node test-permanent-login.js
```

### Database Verification
```bash
PGPASSWORD='@abcd1234' psql -h 172.26.240.1 -p 5432 -U postgres -d postgres -c "SELECT id, email, full_name, email_verified FROM users WHERE email = 'cuongtranhung@gmail.com';"
```

### Frontend Login
Navigate to: http://localhost:3000/login

Use credentials:
- Email: `cuongtranhung@gmail.com`
- Password: `@Abcd6789`

## Configuration Status

✅ Password hash generated and verified  
✅ Database updated with permanent password  
✅ Login tested and confirmed working  
✅ Session creation verified  

## Notes

- This password was specifically requested to be permanent by the user
- The password `@Abcd6789` must be used for all future tests
- Do not modify or update this password under any circumstances
- This configuration was completed on 2025-08-08

## Test Results

Last successful test:
- **Date**: 2025-08-08
- **Status**: ✅ Login successful
- **Session ID**: e0e15cc3-e4ce-4a37-aca4-a7c85d6032c6
- **Token**: JWT generated successfully
- **Response Time**: < 500ms

---

**⚠️ REMINDER: This password is PERMANENT. DO NOT CHANGE IT.**