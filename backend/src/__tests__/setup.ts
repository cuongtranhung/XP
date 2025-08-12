import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.JWT_EXPIRES_IN = '24h';
process.env.DATABASE_URL = 'postgresql://postgres:@abcd1234@172.26.240.1:5432/postgres';

// Disable activity logging in tests to prevent connection leaks
process.env.ACTIVITY_LOGGING_ENABLED = 'false';

// Global test timeout
jest.setTimeout(10000);

// Mock external services that require network connections
jest.mock('../services/emailService', () => ({
  emailService: {
    sendWelcomeEmail: jest.fn().mockResolvedValue(true),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true)
  }
}));

// Global test variables for database cleanup
let dbPool: any = null;

// Setup before all tests
beforeAll(async () => {
  try {
    // Import actual database module for cleanup and monitoring
    const { pool, getPoolMetrics } = await import('../utils/database');
    dbPool = pool;
    
    // Log initial pool state
    const metrics = getPoolMetrics();
    console.log('📊 Initial database pool metrics:', {
      totalConnections: metrics.totalConnections,
      utilization: `${metrics.utilization}%`,
      maxConnections: metrics.maxConnections
    });
  } catch (error) {
    console.warn('Database import failed in test setup:', error);
  }
});

// Cleanup after each test
afterEach(async () => {
  try {
    // Clear any active timers/intervals from activity logger
    const activityTimers = (global as any).__ACTIVITY_TIMERS__;
    if (activityTimers) {
      activityTimers.forEach((timer: NodeJS.Timeout) => {
        clearTimeout(timer);
        clearInterval(timer);
      });
      (global as any).__ACTIVITY_TIMERS__ = [];
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Small delay to allow cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
  } catch (error) {
    console.warn('Test cleanup warning:', error);
  }
});

// Cleanup after all tests
afterAll(async () => {
  try {
    console.log('🧹 Starting test cleanup...');
    
    // Clean up activity logger if it exists
    try {
      const { MinimalActivityLogger, cleanupGlobalTimers } = require('../services/minimalActivityLogger');
      if (MinimalActivityLogger) {
        if (MinimalActivityLogger.cleanup) {
          MinimalActivityLogger.cleanup();
        } else if (MinimalActivityLogger.setEnabled) {
          MinimalActivityLogger.setEnabled(false);
        }
      }
      // Clean up global timers
      if (cleanupGlobalTimers) {
        cleanupGlobalTimers();
      }
    } catch (error) {
      console.warn('Activity logger cleanup failed:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    // Clean up performance monitor
    try {
      const performanceMonitor = require('../services/performanceMonitor').default;
      if (performanceMonitor && performanceMonitor.shutdown) {
        performanceMonitor.shutdown();
      }
    } catch (error) {
      console.warn('Performance monitor cleanup failed:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    // Close database pool connections
    if (dbPool && typeof dbPool.end === 'function') {
      console.log('🗄️ Closing database pool...');
      try {
        const timeoutId = setTimeout(() => {
          console.warn('⚠️ Database pool close timeout, forcing cleanup');
        }, 5000);
        
        await dbPool.end();
        clearTimeout(timeoutId);
        console.log('✅ Database pool closed');
      } catch (error) {
        console.warn('❌ Database pool close failed:', error instanceof Error ? error.message : 'Unknown error');
      }
    }
    
    // Clear all timers and intervals - use safer approach
    // Clear known timer IDs up to a reasonable limit
    for (let i = 1; i < 1000; i++) {
      clearTimeout(i);
      clearInterval(i);
    }
    
    // Final cleanup delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('✅ Test cleanup complete');
  } catch (error) {
    console.error('❌ Test cleanup error:', error);
  }
});