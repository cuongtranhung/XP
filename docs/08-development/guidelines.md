# 🚫 DEVELOPMENT GUIDELINES - WHAT NOT TO DO
# HƯỚNG DẪN PHÁT TRIỂN - NHỮNG VIỆC KHÔNG ĐƯỢC LÀM

**Version**: 1.4  
**Created**: 2025-08-05  
**Updated**: 2025-08-05  
**Project**: XP - Fullstack Authentication System  
**Purpose**: Critical guidelines for secure and maintainable development

---

## 🔴 CRITICAL - NEVER DO THESE / TUYỆT ĐỐI KHÔNG LÀM

### 🔐 Security Violations / Vi phạm bảo mật

#### ❌ Test Credentials - NEVER CHANGE
- **NEVER** change test credentials `cuongtranhung@gmail.com` / `@Abcd6789`
- **NEVER** modify User ID 2 in any development task
- **NEVER** update password for testing account
  ```sql
  -- ❌ WRONG - DO NOT DO THIS
  UPDATE users SET password_hash = 'new-hash' WHERE email = 'cuongtranhung@gmail.com';
  
  -- ❌ WRONG - DO NOT CREATE TASKS THAT CHANGE TEST USER
  -- Any task modifying test user credentials
  ```
- These credentials are used for:
  - Documentation examples
  - Automated testing
  - Development workflows
  - API testing and validation

#### ❌ Authentication & Authorization
- **NEVER** use default secrets or weak defaults
  ```typescript
  // ❌ WRONG - Weak default
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  
  // ✅ CORRECT - Fail if not provided
  const JWT_SECRET = process.env.JWT_SECRET || (() => {
    throw new Error('JWT_SECRET environment variable is required');
  })();
  ```

- **NEVER** hardcode user IDs for admin checks
  ```typescript
  // ❌ WRONG
  if (req.user.id !== "1") { // Admin check
  
  // ✅ CORRECT
  if (!req.user.isAdmin || !req.user.roles.includes('admin')) {
  ```

- **NEVER** expose sensitive data in logs
  ```typescript
  // ❌ WRONG
  console.log('User password:', password);
  console.log('JWT token:', token);
  
  // ✅ CORRECT
  logger.info('Authentication attempt', { userId: user.id });
  ```

- **NEVER** automatically change passwords for protected user accounts
  ```typescript
  // ❌ FORBIDDEN - Do not auto-change passwords for these users
  const PROTECTED_USER_IDS = ['2', '18'];
  
  if (PROTECTED_USER_IDS.includes(userId)) {
    throw new Error('Automatic password changes are not allowed for this user account');
  }
  
  // ✅ CORRECT - Manual password changes only for protected accounts
  // These users must use standard password reset flow via email
  ```

#### ❌ Data Exposure
- **NEVER** return stack traces to clients in production
- **NEVER** log passwords, tokens, or sensitive data
- **NEVER** use console.log in production code
- **NEVER** expose database errors directly to clients

### 💾 Database & Data Violations / Vi phạm cơ sở dữ liệu

#### ❌ SQL Injection Prevention
- **NEVER** use string concatenation for SQL queries
  ```typescript
  // ❌ WRONG - SQL Injection vulnerability
  const query = `SELECT * FROM users WHERE email = '${email}'`;
  
  // ✅ CORRECT - Parameterized query
  const query = 'SELECT * FROM users WHERE email = $1';
  const result = await db.query(query, [email]);
  ```

- **NEVER** trust user input without validation
- **NEVER** use dynamic SQL without proper escaping

#### ❌ Data Integrity
- **NEVER** modify production data without backups
- **NEVER** run migrations without testing first
- **NEVER** skip transaction boundaries for related operations
- **NEVER** update sensitive data without audit trails

---

## ⚠️ HIGH RISK - AVOID THESE / TRÁNH LÀM

### 🔧 Code Quality Issues / Vấn đề chất lượng code

#### ❌ Poor Practices
- **AVOID** mixing module systems (require + import)
  ```typescript
  // ❌ AVOID
  import express from 'express';
  const { middleware } = require('./middleware');
  
  // ✅ CONSISTENT
  import express from 'express';
  import { middleware } from './middleware';
  ```

- **AVOID** console.log for debugging (use proper logger)
- **AVOID** hardcoded configuration values
- **AVOID** ignoring TypeScript warnings
- **AVOID** deeply nested callback functions

#### ❌ Error Handling
- **NEVER** suppress errors silently
  ```typescript
  // ❌ WRONG - Silent failure
  try {
    await riskyOperation();
  } catch (error) {
    // Silent - bad!
  }
  
  // ✅ CORRECT
  try {
    await riskyOperation();
  } catch (error) {
    logger.error('Operation failed', { error, context });
    throw error; // Re-throw or handle appropriately
  }
  ```

### 🚀 Performance Issues / Vấn đề hiệu suất

#### ❌ Performance Killers
- **AVOID** synchronous operations in request handlers
- **AVOID** N+1 query problems
- **AVOID** loading large datasets without pagination
- **AVOID** blocking operations in main thread
- **AVOID** memory leaks through unclosed connections

---

## 📝 Testing Violations / Vi phạm trong testing

### ❌ Test Security
- **NEVER** use production data in tests
- **NEVER** test with real API keys or secrets
- **NEVER** commit test credentials to repository
- **NEVER** hardcode real passwords in code or documentation
- **NEVER** skip security-related tests

### ⚠️ Test Credential Security
- **NEVER** document real passwords in code, comments, or documentation
  ```typescript
  // ❌ FORBIDDEN - Real credentials in code/docs
  const TEST_EMAIL = "cuongtrahung@gmail.com";
  const TEST_PASSWORD = "@Abcd6789";  // SECURITY RISK!
  
  // ✅ CORRECT - Use environment variables or test fixtures
  const TEST_EMAIL = process.env.TEST_EMAIL || "test@example.com";
  const TEST_PASSWORD = process.env.TEST_PASSWORD || "TestPass123!";
  ```

- **REQUIRED** secure test credential management:
  ```bash
  # Create .env.test file (NOT committed to git)
  TEST_EMAIL=cuongtrahung@gmail.com
  TEST_PASSWORD=@Abcd6789
  
  # Add to .gitignore
  .env.test
  .env.local
  *.env
  ```

### ❌ Test Quality
- **AVOID** testing implementation details instead of behavior
- **AVOID** flaky tests that pass/fail randomly
- **AVOID** tests without proper cleanup
- **AVOID** overly complex test setups

#### Example Test Violations:
```typescript
// ❌ WRONG - Testing implementation
test('should call bcrypt.hash', () => {
  expect(bcrypt.hash).toHaveBeenCalled();
});

// ✅ CORRECT - Testing behavior
test('should hash password before saving', async () => {
  const user = await createUser({ password: 'plaintext' });
  expect(user.password_hash).not.toBe('plaintext');
  expect(await bcrypt.compare('plaintext', user.password_hash)).toBe(true);
});
```

---

## 🏗️ Architecture & Design Violations / Vi phạm kiến trúc

### ❌ Coupling Issues
- **AVOID** tight coupling between layers
- **AVOID** circular dependencies
- **AVOID** God objects/classes with too many responsibilities
- **AVOID** direct database access from controllers

### ❌ Configuration Management
- **NEVER** hardcode environment-specific values
- **NEVER** commit .env files to repository
- **NEVER** use different config formats across environments

### ❌ Port Configuration Violations
- **NEVER** change frontend port from 3000
  ```bash
  # ❌ FORBIDDEN - Do not change frontend port
  PORT=3001 npm run dev  # Wrong!
  VITE_PORT=4000 npm run dev  # Wrong!
  
  # ✅ CORRECT - Frontend must run on port 3000
  npm run dev  # Default port 3000
  PORT=3000 npm run dev  # Explicit port 3000
  ```

- **NEVER** change backend port from 5000
  ```bash
  # ❌ FORBIDDEN - Do not change backend port
  PORT=3000 npm run dev  # Wrong!
  PORT=8000 node dist/app.js  # Wrong!
  
  # ✅ CORRECT - Backend must run on port 5000
  npm run dev  # Default port 5000
  PORT=5000 npm start  # Explicit port 5000
  ```

- **REQUIRED** process restart procedure if port conflicts occur:
  ```bash
  # Kill existing processes on required ports
  npx kill-port 3000  # Kill frontend process
  npx kill-port 5000  # Kill backend process
  
  # Or use system commands
  lsof -ti:3000 | xargs kill -9  # Kill process on port 3000
  lsof -ti:5000 | xargs kill -9  # Kill process on port 5000
  
  # Then restart on correct ports
  cd frontend && npm run dev  # Start frontend on port 3000
  cd backend && npm run dev   # Start backend on port 5000
  ```

---

## 🔄 Development Workflow Violations / Vi phạm quy trình

### ❌ Version Control
- **NEVER** commit secrets or credentials
- **NEVER** force push to main/master branch
- **NEVER** commit broken code
- **NEVER** skip code review for critical changes

### ❌ Deployment
- **NEVER** deploy without running tests
- **NEVER** deploy untested migration scripts
- **NEVER** deploy without rollback plan
- **NEVER** deploy directly to production

---

## 📋 Checklist Before Code Changes / Danh sách kiểm tra

### ✅ Security Checklist
- [ ] No hardcoded secrets or passwords
- [ ] All user inputs validated and sanitized
- [ ] Error messages don't expose sensitive data
- [ ] Authentication and authorization properly implemented
- [ ] SQL queries use parameterized statements
- [ ] **CRITICAL**: No automatic password changes for protected users (ID: 2, 18)

### ✅ Quality Checklist
- [ ] Code follows project conventions
- [ ] No console.log statements in production code
- [ ] Proper error handling implemented
- [ ] Type safety maintained (if using TypeScript)
- [ ] Tests cover critical functionality

### ✅ Configuration Checklist
- [ ] **CRITICAL**: Frontend runs on port 3000 only
- [ ] **CRITICAL**: Backend runs on port 5000 only
- [ ] No hardcoded port values in code
- [ ] Environment variables properly configured
- [ ] Port conflicts resolved using kill process procedure

### ✅ Performance Checklist
- [ ] No blocking synchronous operations
- [ ] Database queries optimized
- [ ] Proper caching where applicable
- [ ] Resource cleanup implemented
- [ ] Memory usage considered

---

## ✅ RECOMMENDED PRACTICES / THỰC HÀNH ĐƯỢC KHUYẾN NGHỊ

### 🧪 Testing Best Practices / Thực hành testing tốt nhất

#### ✅ Secure Test Environment Setup
- **USE** environment variables for test credentials:
  ```bash
  # Create .env.test (add to .gitignore)
  TEST_EMAIL=cuongtrahung@gmail.com
  TEST_PASSWORD=@Abcd6789
  DATABASE_URL=postgresql://test_user:test_pass@localhost:5432/test_db
  ```

- **USE** proper test data management:
  ```typescript
  // ✅ RECOMMENDED - Load from environment
  const TEST_CREDENTIALS = {
    email: process.env.TEST_EMAIL || 'test@example.com',
    password: process.env.TEST_PASSWORD || 'DefaultTest123!'
  };
  
  // Use in tests
  test('should authenticate user', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send(TEST_CREDENTIALS);
    expect(response.status).toBe(200);
  });
  ```

#### ✅ Test Data Best Practices
- **CREATE** dedicated test user accounts (not production users)
- **USE** test database seeding for consistent test data
- **CLEAN UP** test data after each test run
- **ISOLATE** tests to prevent data contamination

### 🔧 Development Best Practices / Thực hành phát triển tốt nhất

#### ✅ Code Generation Guidelines
- **FOLLOW** existing code patterns and conventions
- **USE** TypeScript interfaces for type safety
- **IMPLEMENT** proper error handling with try-catch blocks
- **ADD** input validation for all user inputs
- **USE** parameterized queries for database operations

#### ✅ Data Update Guidelines
- **BACKUP** data before major updates
- **USE** database transactions for related operations
- **VALIDATE** data integrity after updates
- **LOG** all data modifications with audit trails
- **TEST** data updates in development environment first

### 👤 User Profile Field Addition Process / Quy trình thêm trường dữ liệu user profile

#### ✅ Complete Checklist for Adding New User Profile Fields
**Based on avatar_url and date_of_birth implementation examples**

##### 🗃️ Step 1: Database Migration
```sql
-- Create migration file: migrations/00X_add_[field_name]_to_users.sql
-- Example: migrations/004_add_avatar_to_users.sql

-- Add column to users table
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500);

-- Create index for performance (if needed for queries)
CREATE INDEX IF NOT EXISTS idx_users_avatar_url ON users(avatar_url);

-- Add documentation comment
COMMENT ON COLUMN users.avatar_url IS 'URL or path to user profile avatar image';
```

##### 📝 Step 2: Backend Model Updates
```typescript
// Update src/models/User.ts
interface User {
  id: string;
  email: string;
  // ... existing fields
  avatar_url?: string;        // Add new field
  date_of_birth?: Date;       // Add new field
  created_at: Date;
  updated_at: Date;
}

// Update CreateUserData interface if field can be set during registration
interface CreateUserData {
  email: string;
  password_hash: string;
  full_name: string;
  avatar_url?: string;        // Add if needed during creation
}
```

##### 🔧 Step 3: Service Layer Updates
```typescript
// Update src/services/authService.ts or userService.ts
// Add methods for updating the new field

static async updateUserField(userId: string, fieldName: string, value: any) {
  // Validate input
  // Update database
  // Return updated user
}
```

##### 🌐 Step 4: API Endpoint Updates
```typescript
// Update src/controllers/authController.ts or userController.ts
// Add endpoints for updating the new field

export const updateUserProfile = async (req: Request, res: Response) => {
  // Validate request
  // Update user field
  // Return response
};
```

##### 🎨 Step 5: Frontend Type Updates
```typescript
// Update src/types/auth.ts
export interface User {
  id: string;
  email: string;
  // ... existing fields
  avatar_url?: string;        // Add new field
  date_of_birth?: string;     // Add new field (as string for frontend)
  created_at: string;
  updated_at: string;
}
```

##### 🖼️ Step 6: Frontend Component Creation (if needed)
```typescript
// Create specialized components for complex fields
// Examples:
// - src/components/common/AvatarUpload.tsx (for image fields)
// - src/components/common/DatePicker.tsx (for date fields)
// - src/utils/imageUtils.ts (for image processing)

// Update src/pages/SettingsPage.tsx to include new field
```

##### ✅ Step 7: Validation & Testing
- [ ] **Database**: Test migration up/down
- [ ] **Backend**: Test API endpoints with Postman/curl
- [ ] **Frontend**: Test UI components and form validation
- [ ] **Integration**: Test end-to-end user flow
- [ ] **Error Handling**: Test edge cases and error scenarios

##### 📋 Required Files to Update (Checklist)
- [ ] **Migration**: `migrations/00X_add_[field]_to_users.sql`
- [ ] **Backend Model**: `src/models/User.ts`
- [ ] **Service Layer**: `src/services/authService.ts` or `userService.ts`
- [ ] **Controller**: `src/controllers/authController.ts`
- [ ] **Routes**: `src/routes/authRoutes.ts` (if new endpoints)
- [ ] **Frontend Types**: `src/types/auth.ts`
- [ ] **Components**: Create new or update existing components
- [ ] **Pages**: Update `SettingsPage.tsx` or relevant pages
- [ ] **Utils**: Add validation/processing utilities if needed
- [ ] **Tests**: Add unit and integration tests

##### 🔒 Security Considerations
- [ ] **Input Validation**: Validate data type, length, format
- [ ] **Sanitization**: Clean user input to prevent XSS
- [ ] **Authorization**: Ensure only user can update their own profile
- [ ] **File Upload**: Validate file types, sizes (for image fields)
- [ ] **Privacy**: Consider if field should be public/private

##### ⚡ Performance Considerations
- [ ] **Database Index**: Add index if field will be queried frequently
- [ ] **Image Optimization**: Compress/resize images (for avatar fields)
- [ ] **Validation**: Client-side validation for better UX
- [ ] **Caching**: Update cache invalidation logic if needed

---

## 🚨 Emergency Response / Phản ứng khẩn cấp

### If You Accidentally:

#### 🔐 Committed Secrets
1. **IMMEDIATELY** revoke/rotate the compromised credentials
2. Remove from git history (git filter-branch or BFG)
3. Force push the cleaned history
4. Update all environments with new credentials

#### 💣 Deployed Broken Code
1. **IMMEDIATELY** rollback to previous version
2. Investigate root cause
3. Fix in development environment
4. Test thoroughly before re-deployment

#### 🗃️ Corrupted Data
1. **STOP** all write operations
2. Assess damage scope
3. Restore from latest backup
4. Implement additional safeguards

---

## 📚 Resources & References / Tài liệu tham khảo

### Security Resources
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
- [JWT Security Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)

### Code Quality
- [Clean Code Principles](https://github.com/ryanmcdermott/clean-code-javascript)
- [TypeScript Best Practices](https://typescript-eslint.io/rules/)
- [Express.js Security](https://expressjs.com/en/advanced/best-practice-security.html)

---

## 📞 When in Doubt / Khi không chắc chắn

### Ask These Questions:
1. **Security**: "Could this expose sensitive data or create vulnerabilities?"
2. **Performance**: "Will this create bottlenecks or resource issues?"
3. **Maintainability**: "Can other developers easily understand and modify this?"
4. **Reliability**: "What happens if this fails?"

### Getting Help:
- Review the comprehensive analysis report
- Consult team lead or senior developer
- Reference official documentation
- Consider security implications first

---

**Remember**: When in doubt, choose the safer, more secure option. Security and data integrity are never negotiable.

**Ghi nhớ**: Khi nghi ngờ, hãy chọn lựa chọn an toàn và bảo mật hơn. Bảo mật và tính toàn vẹn dữ liệu không bao giờ có thể thương lượng.

---

*This document should be reviewed and updated regularly as new security threats and best practices emerge.*
*Tài liệu này nên được xem xét và cập nhật thường xuyên khi có các mối đe dọa bảo mật và thực hành tốt nhất mới xuất hiện.*