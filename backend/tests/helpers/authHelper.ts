/**
 * Authentication Test Helpers
 * Helper functions for user creation and authentication in tests
 */

import { Express } from 'express';
import request from 'supertest';
import { getTestDatabase } from '../setup/testApp';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export interface TestUser {
  id: string;
  email: string;
  fullName: string;
  passwordHash: string;
  createdAt: Date;
}

/**
 * Create a test user in the database
 */
export const createTestUser = async (
  email: string, 
  fullName: string, 
  password: string,
  role: string = 'user'
): Promise<TestUser> => {
  const db = getTestDatabase();
  const userId = uuidv4();
  const passwordHash = await bcrypt.hash(password, 10);
  
  const query = `
    INSERT INTO users (id, email, full_name, password_hash, role, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    RETURNING id, email, full_name, password_hash, created_at
  `;
  
  const result = await db.query(query, [userId, email, fullName, passwordHash, role]);
  return result.rows[0];
};

/**
 * Authenticate user and return JWT token
 */
export const authenticateUser = async (app: Express, email: string, password: string): Promise<string> => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);
    
  expect(response.body.success).toBe(true);
  expect(response.body.data.token).toBeDefined();
  
  return response.body.data.token;
};

/**
 * Create user and get authentication token in one step
 */
export const createAuthenticatedUser = async (
  app: Express,
  email: string,
  fullName: string,
  password: string,
  role: string = 'user'
): Promise<{ user: TestUser; token: string }> => {
  const user = await createTestUser(email, fullName, password, role);
  const token = await authenticateUser(app, email, password);
  
  return { user, token };
};

/**
 * Create multiple test users for multi-user testing
 */
export const createMultipleUsers = async (count: number = 3): Promise<TestUser[]> => {
  const users: TestUser[] = [];
  
  for (let i = 1; i <= count; i++) {
    const user = await createTestUser(
      `user${i}@test.com`,
      `Test User ${i}`,
      `password${i}`
    );
    users.push(user);
  }
  
  return users;
};

/**
 * Create admin user for testing admin functionality
 */
export const createAdminUser = async (): Promise<TestUser> => {
  return await createTestUser(
    'admin@test.com',
    'Admin User',
    'adminpass123',
    'admin'
  );
};

/**
 * Get user by ID from database
 */
export const getUserById = async (userId: string): Promise<TestUser | null> => {
  const db = getTestDatabase();
  const query = 'SELECT * FROM users WHERE id = $1';
  const result = await db.query(query, [userId]);
  
  return result.rows[0] || null;
};

/**
 * Update user in database
 */
export const updateUser = async (userId: string, updates: Partial<TestUser>): Promise<TestUser> => {
  const db = getTestDatabase();
  const setClause = Object.keys(updates)
    .map((key, index) => `${key} = $${index + 2}`)
    .join(', ');
  
  const query = `
    UPDATE users 
    SET ${setClause}, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;
  
  const values = [userId, ...Object.values(updates)];
  const result = await db.query(query, values);
  
  return result.rows[0];
};

/**
 * Delete user from database
 */
export const deleteUser = async (userId: string): Promise<void> => {
  const db = getTestDatabase();
  await db.query('DELETE FROM users WHERE id = $1', [userId]);
};

/**
 * Clear all test users
 */
export const clearTestUsers = async (): Promise<void> => {
  const db = getTestDatabase();
  await db.query('DELETE FROM users WHERE email LIKE \'%@test.com\'');
};

/**
 * Verify JWT token structure
 */
export const verifyTokenStructure = (token: string): void => {
  expect(typeof token).toBe('string');
  expect(token.split('.').length).toBe(3); // JWT has 3 parts separated by dots
  expect(token.length).toBeGreaterThan(20);
};

/**
 * Make authenticated request helper
 */
export const makeAuthenticatedRequest = (app: Express, token: string) => {
  return {
    get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) => request(app).post(url).set('Authorization', `Bearer ${token}`),
    put: (url: string) => request(app).put(url).set('Authorization', `Bearer ${token}`),
    patch: (url: string) => request(app).patch(url).set('Authorization', `Bearer ${token}`),
    delete: (url: string) => request(app).delete(url).set('Authorization', `Bearer ${token}`)
  };
};

/**
 * Test multiple user authentication scenarios
 */
export const testAuthenticationScenarios = () => {
  return {
    validLogin: {
      email: 'valid@test.com',
      password: 'validpass123'
    },
    invalidEmail: {
      email: 'nonexistent@test.com',
      password: 'anypassword'
    },
    invalidPassword: {
      email: 'valid@test.com',
      password: 'wrongpassword'
    },
    malformedEmail: {
      email: 'not-an-email',
      password: 'validpass123'
    },
    emptyCredentials: {
      email: '',
      password: ''
    }
  };
};

/**
 * Simulate user session for testing
 */
export const simulateUserSession = async (
  app: Express,
  userData: { email: string; fullName: string; password: string }
): Promise<{ user: TestUser; token: string; request: ReturnType<typeof makeAuthenticatedRequest> }> => {
  const { user, token } = await createAuthenticatedUser(
    app,
    userData.email,
    userData.fullName,
    userData.password
  );
  
  const authenticatedRequest = makeAuthenticatedRequest(app, token);
  
  return { user, token, request: authenticatedRequest };
};

/**
 * Test permission levels
 */
export const createUsersWithDifferentRoles = async () => {
  const regularUser = await createTestUser('regular@test.com', 'Regular User', 'pass123', 'user');
  const adminUser = await createTestUser('admin@test.com', 'Admin User', 'adminpass', 'admin');
  const moderatorUser = await createTestUser('mod@test.com', 'Moderator User', 'modpass', 'moderator');
  
  return { regularUser, adminUser, moderatorUser };
};

/**
 * Cleanup helper for auth tests
 */
export const cleanupAuthTestData = async (): Promise<void> => {
  await clearTestUsers();
};