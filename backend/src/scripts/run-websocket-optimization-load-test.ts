/**
 * WebSocket Optimization Load Test Runner
 * Script to execute comprehensive load testing for WebSocket optimization features
 */

import { runWebSocketOptimizationLoadTest } from '../tests/load-testing/websocket-optimization-load-test';
import { logger } from '../utils/logger';

// Load test configuration
const loadTestConfig = {
  baseUrl: process.env.API_BASE_URL || 'http://localhost:5000',
  adminToken: process.env.ADMIN_TOKEN || 'test-admin-token', // Would need real admin token
  concurrentConnections: parseInt(process.env.LOAD_TEST_CONNECTIONS || '100'),
  messagesPerConnection: parseInt(process.env.LOAD_TEST_MESSAGES || '10'),
  testDurationMs: parseInt(process.env.LOAD_TEST_DURATION || '30000'),
  rampUpTimeMs: parseInt(process.env.LOAD_TEST_RAMP_UP || '5000')
};

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    logger.info('WebSocket Optimization Load Test Runner started', {
      config: {
        ...loadTestConfig,
        adminToken: '[REDACTED]' // Don't log sensitive data
      }
    });

    // Validate configuration
    if (!loadTestConfig.baseUrl) {
      throw new Error('API_BASE_URL is required');
    }

    if (!loadTestConfig.adminToken || loadTestConfig.adminToken === 'test-admin-token') {
      logger.warn('Using default admin token. Set ADMIN_TOKEN environment variable for production testing.');
    }

    // Pre-test health check
    const axios = require('axios');
    try {
      const healthResponse = await axios.get(`${loadTestConfig.baseUrl}/health`);
      if (healthResponse.status !== 200) {
        throw new Error(`API health check failed: ${healthResponse.status}`);
      }
      logger.info('Pre-test health check passed');
    } catch (error) {
      logger.error('Pre-test health check failed', { error });
      throw new Error('API is not available for testing');
    }

    // Run the load test suite
    await runWebSocketOptimizationLoadTest(loadTestConfig);

    logger.info('WebSocket Optimization Load Test completed successfully');
    process.exit(0);

  } catch (error) {
    logger.error('WebSocket Optimization Load Test failed', { error });
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  logger.info('Load test interrupted by user');
  process.exit(130);
});

process.on('SIGTERM', () => {
  logger.info('Load test terminated');
  process.exit(143);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in load test', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection in load test', { reason, promise });
  process.exit(1);
});

// Execute main function
if (require.main === module) {
  main().catch((error) => {
    logger.error('Load test execution failed', { error });
    process.exit(1);
  });
}

export { main as runLoadTest };