/**
 * Dynamic Form Builder Module
 * Main module entry point for the Dynamic Form Builder functionality
 * Integrates with XP's existing authentication and database systems
 */

import { logger } from '../../utils/logger';
import { FormBuilderConfiguration, FormBuilderConfig } from './config';
import { CacheService } from './services/CacheService';
import Redis from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';

class DynamicFormBuilderModule {
  private config: FormBuilderConfiguration;
  private cacheService?: CacheService;
  private redis?: Redis;
  private io?: SocketIOServer;
  private initialized: boolean = false;

  constructor() {
    // Initialize configuration with custom settings if needed
    this.config = new FormBuilderConfiguration({
      features: {
        collaboration: process.env.FEATURE_COLLABORATION !== 'false',
        fileUpload: process.env.FEATURE_FILE_UPLOAD !== 'false',
        webhooks: process.env.FEATURE_WEBHOOKS !== 'false',
        analytics: process.env.FEATURE_ANALYTICS !== 'false',
        versioning: process.env.FEATURE_VERSIONING !== 'false',
        export: process.env.FEATURE_EXPORT !== 'false',
      }
    });
  }

  /**
   * Initialize the Dynamic Form Builder module
   */
  async initialize(httpServer?: http.Server): Promise<void> {
    try {
      const config = this.config.get();

      logger.info('Initializing Dynamic Form Builder module', {
        features: config.features,
        performance: config.performance,
        security: config.security
      });

      // Initialize Redis if caching is enabled AND Redis is available
      const redisEnabled = process.env.REDIS_ENABLED !== 'false' && process.env.ENABLE_CACHE !== 'false';
      if (config.performance.cache.enabled && redisEnabled) {
        this.redis = new Redis({
          host: process.env.REDIS_HOST ?? 'localhost',
          port: parseInt(process.env.REDIS_PORT ?? '6379'),
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB ?? '0'),
          keyPrefix: 'formbuilder:',
        });

        this.cacheService = new CacheService(this.redis, {
          ttl: config.performance.cache.ttl,
          maxSize: config.performance.cache.maxSize,
        });

        logger.info('Cache service initialized');
      } else {
        logger.info('Redis cache disabled - running without cache');
      }

      // Initialize WebSocket server if collaboration is enabled
      if (config.features.collaboration && httpServer) {
        const { initializeWebSocket } = await import('./websocket');
        this.io = await initializeWebSocket(httpServer, this.redis);
        logger.info('WebSocket server initialized');
      }

      // Initialize file upload service
      if (config.features.fileUpload) {
        const fileUploadService = require('./services/FileUploadService').default;
        await fileUploadService.initialize();
        
        // Set up cleanup job for orphaned files
        setInterval(() => {
          fileUploadService.cleanupOrphanedFiles().catch((error: any) => {
            logger.error('Failed to cleanup orphaned files', { error });
          });
        }, 24 * 60 * 60 * 1000); // Run daily

        logger.info('File upload service initialized');
      }

      // Initialize analytics aggregation job
      if (config.features.analytics) {
        setInterval(() => {
          this.aggregateAnalytics().catch((error: any) => {
            logger.error('Failed to aggregate analytics', { error });
          });
        }, config.analytics.aggregationInterval);

        logger.info('Analytics service initialized');
      }

      // Initialize monitoring
      if (config.monitoring.enabled) {
        const { initializeMonitoring } = await import('./monitoring');
        await initializeMonitoring(config.monitoring);
        logger.info('Monitoring initialized');
      }

      this.initialized = true;
      logger.info('Dynamic Form Builder module initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Dynamic Form Builder module', { error });
      throw error;
    }
  }

  /**
   * Get module configuration
   */
  getConfig(): FormBuilderConfig {
    return this.config.get();
  }

  /**
   * Update module configuration
   */
  updateConfig(updates: Partial<FormBuilderConfig>): void {
    this.config.update(updates);
    logger.info('Module configuration updated', { updates });
  }

  /**
   * Check if module is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get cache service instance
   */
  getCacheService(): CacheService | undefined {
    return this.cacheService;
  }

  /**
   * Get Redis client instance
   */
  getRedis(): Redis | undefined {
    return this.redis;
  }

  /**
   * Get WebSocket server instance
   */
  getWebSocketServer(): SocketIOServer | undefined {
    return this.io;
  }

  /**
   * Aggregate analytics data
   */
  private async aggregateAnalytics(): Promise<void> {
    // TODO: Implement analytics aggregation
    // const { AnalyticsService } = await import('./services/AnalyticsService');
    // const analyticsService = new AnalyticsService();
    // await analyticsService.aggregateHourlyStats();
  }

  /**
   * Get module health status
   */
  async getHealthStatus() {
    const config = this.config.get();
    const health: any = {
      module: 'DynamicFormBuilder',
      status: this.initialized ? 'healthy' : 'not_initialized',
      timestamp: new Date().toISOString(),
      features: config.features,
      services: {}
    };

    // Check Redis health
    if (this.redis) {
      try {
        await this.redis.ping();
        health.services.redis = 'healthy';
      } catch (error) {
        health.services.redis = 'unhealthy';
        health.status = 'degraded';
      }
    }

    // Check cache statistics
    if (this.cacheService) {
      try {
        const stats = await this.cacheService.getStats();
        health.services.cache = {
          status: 'healthy',
          stats
        };
      } catch (error) {
        health.services.cache = 'unhealthy';
      }
    }

    // Check WebSocket status
    if (this.io) {
      health.services.websocket = {
        status: 'healthy',
        connections: this.io.engine.clientsCount
      };
    }

    return health;
  }

  /**
   * Shutdown the module gracefully
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Dynamic Form Builder module');

    try {
      // Close WebSocket connections
      if (this.io) {
        this.io.close();
      }

      // Close Redis connection
      if (this.redis) {
        await this.redis.quit();
      }

      this.initialized = false;
      logger.info('Dynamic Form Builder module shut down successfully');
    } catch (error) {
      logger.error('Error shutting down Dynamic Form Builder module', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const dynamicFormBuilderModule = new DynamicFormBuilderModule();

// Export module components for individual imports
export * from './types';
// Don't re-export FormService here as it has conflicting exports
// Instead, users should import directly from the service file
export * from './services/SubmissionService';
export * from './services/AnalyticsService';
export * from './controllers/FormController';
export * from './controllers/SubmissionController';
export * from './routes/formRoutes';
export * from './routes/submissionRoutes';