/**
 * Optimized Server - Fast startup with lazy module loading
 */

import { createServer } from 'http';
import app from './app';
import { logger } from './utils/logger';
import { testConnection } from './utils/database';

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || 'localhost';

// Disable modules that slow down startup in development
const FAST_STARTUP = process.env.FAST_STARTUP !== 'false';

// Create HTTP server
const server = createServer(app);

// Optimize server settings
server.maxConnections = 1000;
server.timeout = 30000;
server.keepAliveTimeout = 5000;
server.headersTimeout = 6000;

// Initialize essential services before starting server
async function initializeEssentialServices() {
  // Test database connection (but don't block startup)
  testConnection()
    .then(() => logger.info('Database connection verified'))
    .catch(error => logger.warn('Database connection failed', { error }));
}

// Initialize optional modules after server starts (lazy loading)
async function initializeOptionalModules() {
  if (FAST_STARTUP) {
    logger.info('Fast startup mode - skipping optional modules');
    return;
  }

  // Lazy load modules after server is running
  setTimeout(async () => {
    try {
      // GPS Module
      const { gpsModule } = await import('./modules/gpsModule');
      await gpsModule.initialize();
      logger.info('GPS Module initialized');
    } catch (error) {
      logger.warn('GPS Module initialization skipped', { error });
    }

    try {
      // Dynamic Form Builder Module (without Redis)
      const { dynamicFormBuilderModule } = await import('./modules/dynamicFormBuilder');
      await dynamicFormBuilderModule.initialize(server);
      logger.info('Dynamic Form Builder Module initialized');
    } catch (error) {
      logger.warn('Form Builder Module initialization skipped', { error });
    }

    try {
      // Session Cleanup Service
      const { SessionCleanupService } = await import('./services/sessionCleanupService');
      SessionCleanupService.start();
      logger.info('Session cleanup service started');
    } catch (error) {
      logger.warn('Session cleanup service skipped', { error });
    }

    try {
      // Memory Monitor
      const { memoryMonitor } = await import('./utils/memoryMonitor');
      memoryMonitor.start();
      logger.info('Memory monitoring started');
    } catch (error) {
      logger.warn('Memory monitoring skipped', { error });
    }
  }, 1000); // Start loading modules 1 second after server starts
}

// Start server immediately
async function startServer() {
  const startTime = Date.now();
  
  // Initialize only essential services
  await initializeEssentialServices();
  
  // Start server without waiting for optional modules
  server.listen(PORT, HOST, () => {
    const startupTime = Date.now() - startTime;
    
    logger.info('🚀 Server started successfully', {
      port: PORT,
      host: HOST,
      environment: process.env.NODE_ENV ?? 'development',
      startupTime: `${startupTime}ms`,
      fastStartup: FAST_STARTUP,
      endpoints: {
        api: `http://${HOST}:${PORT}`,
        health: `http://${HOST}:${PORT}/health`,
        auth: `http://${HOST}:${PORT}/api/auth`
      }
    });
    
    // Initialize optional modules in background
    initializeOptionalModules();
  });
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, closing server gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, closing server gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Start the server
startServer().catch(error => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});