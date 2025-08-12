/**
 * Server initialization with WebSocket support
 */

import { createServer } from 'http';
import app from './app';
import { dynamicFormBuilderModule } from './modules/dynamicFormBuilder';
import { logger } from './utils/logger';
import { testConnection } from './utils/database';
import { gpsModule } from './modules/gpsModule';
import { SessionCleanupService } from './services/sessionCleanupService';
import { memoryMonitor } from './utils/memoryMonitor';

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Create HTTP server with optimized settings
const server = createServer(app);

// Optimize server for concurrent connections
server.maxConnections = 1000; // Allow up to 1000 concurrent connections
server.timeout = 30000; // 30 second timeout
server.keepAliveTimeout = 5000; // Keep alive for 5 seconds
server.headersTimeout = 6000; // Headers timeout slightly higher than keepAliveTimeout

// Start server and initialize modules
server.listen(PORT, HOST, async () => {
  logger.info('Server started successfully', {
    port: PORT,
    host: HOST,
    environment: process.env.NODE_ENV ?? 'development',
    endpoints: {
      api: `http://${HOST}:${PORT}`,
      health: `http://${HOST}:${PORT}/health`,
      auth: `http://${HOST}:${PORT}/api/auth`
    }
  });
  
  // Test database connection on startup
  try {
    await testConnection();
  } catch (error) {
    logger.warn('Database connection failed during startup', {
      message: 'Server started but database may be unavailable',
      error: error
    });
  }

  // Initialize GPS Module
  try {
    await gpsModule.initialize();
    logger.info('GPS Module initialization completed');
  } catch (error) {
    logger.error('Failed to initialize GPS Module', { error });
  }

  // Initialize Dynamic Form Builder Module with HTTP server for WebSocket support
  try {
    await dynamicFormBuilderModule.initialize(server);
    logger.info('Dynamic Form Builder Module initialization completed with WebSocket support');
  } catch (error) {
    logger.error('Failed to initialize Dynamic Form Builder Module', { error });
  }

  // Start session cleanup service
  try {
    SessionCleanupService.start();
    logger.info('Session cleanup service started');
  } catch (error) {
    logger.error('Failed to start session cleanup service', { error });
  }

  // Start memory monitoring
  try {
    memoryMonitor.start();
    logger.info('Memory monitoring started');
  } catch (error) {
    logger.error('Failed to start memory monitoring', { error });
  }
});