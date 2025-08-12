/**
 * Test Application Setup
 * Configures Express app for testing with all middleware and routes
 */

import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Pool } from 'pg';
import { createTestDatabase, dropTestDatabase } from './testDatabase';
import { seedTestData } from './testSeed';

// Import middleware
import { authenticate } from '../../src/middleware/auth';
import { generalRateLimit } from '../../src/middleware/rateLimiter';
import { corsConfig, securityHeaders, sanitizeRequest } from '../../src/middleware/security';

// Import routes
import formRoutes from '../../src/modules/dynamicFormBuilder/routes/formRoutes';
import submissionRoutes from '../../src/modules/dynamicFormBuilder/routes/submissionRoutes';
import authRoutes from '../../src/routes/authRoutes';

let testDb: Pool;
let testApp: Express;

export const setupTestApp = async (): Promise<Express> => {
  if (testApp) {
    return testApp;
  }

  // Create test database
  testDb = await createTestDatabase();

  // Create Express app
  testApp = express();

  // Security middleware
  testApp.use(helmet({ contentSecurityPolicy: false })); // Disable CSP for tests
  testApp.use(corsConfig);
  testApp.use(sanitizeRequest);

  // Body parsing
  testApp.use(express.json({ limit: '10mb' }));
  testApp.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Rate limiting (with reduced limits for testing)
  if (process.env.NODE_ENV !== 'test-no-limits') {
    testApp.use('/api', generalRateLimit);
  }

  // Routes
  testApp.use('/api/auth', authRoutes);
  testApp.use('/api/forms', formRoutes);
  testApp.use('/api/submissions', submissionRoutes);

  // Error handling
  testApp.use((err: any, req: any, res: any, next: any) => {
    console.error('Test app error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'test' ? err.message : 'Internal server error'
      }
    });
  });

  // Seed test data
  await seedTestData(testDb);

  return testApp;
};

export const cleanupTestApp = async (): Promise<void> => {
  if (testDb) {
    await dropTestDatabase(testDb);
  }
};

export const getTestDatabase = (): Pool => {
  return testDb;
};

// Helper to reset test data between tests
export const resetTestData = async (): Promise<void> => {
  if (testDb) {
    // Clear all test data
    await testDb.query('TRUNCATE TABLE form_submissions CASCADE');
    await testDb.query('TRUNCATE TABLE form_fields CASCADE');
    await testDb.query('TRUNCATE TABLE forms CASCADE');
    await testDb.query('TRUNCATE TABLE users CASCADE');
    
    // Re-seed basic data
    await seedTestData(testDb);
  }
};

// Helper to create isolated test database instance
export const createIsolatedTestDb = async (): Promise<Pool> => {
  const testDbName = `test_formbuilder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: testDbName
  });

  // Create database
  const adminPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: 'postgres'
  });

  await adminPool.query(`CREATE DATABASE "${testDbName}"`);
  await adminPool.end();

  // Run migrations
  // Note: In a real setup, you'd run your migration scripts here
  
  return pool;
};