/**
 * Improved Activity Logger with Backend Stability Features
 * 
 * Key improvements to prevent backend hanging:
 * 1. Connection timeout management
 * 2. Circuit breaker pattern
 * 3. Bulk logging operations
 * 4. Health monitoring
 * 5. Resource management
 */

import { getClient } from '../utils/database';
import { logger } from '../utils/logger';
import { Request } from 'express';

interface ActivityLogData {
  userId?: number | null;
  sessionId?: string | null;
  actionType?: string;
  actionCategory?: string;
  endpoint?: string;
  method?: string;
  responseStatus?: number;
  ipAddress?: string;
  userAgent?: string;
  processingTimeMs?: number;
  metadata?: any;
}

interface LoggerConfig {
  enabled: boolean;
  asyncProcessing: boolean;
  maxQueueSize: number;
  maxLogsPerSecond: number;
  batchSize: number;
  batchIntervalMs: number;
  connectionTimeoutMs: number;
  maxRetries: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetTimeMs: number;
}

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

class ImprovedActivityLogger {
  private static config: LoggerConfig = {
    enabled: process.env.ACTIVITY_LOGGING_ENABLED !== 'false',
    asyncProcessing: process.env.ACTIVITY_ASYNC_PROCESSING !== 'false',
    maxQueueSize: parseInt(process.env.ACTIVITY_LOG_MAX_QUEUE ?? '2000'),
    maxLogsPerSecond: parseInt(process.env.ACTIVITY_LOG_MAX_PER_SEC ?? '50'),
    batchSize: parseInt(process.env.ACTIVITY_LOG_BATCH_SIZE ?? '10'),
    batchIntervalMs: parseInt(process.env.ACTIVITY_LOG_BATCH_INTERVAL ?? '5000'),
    connectionTimeoutMs: parseInt(process.env.ACTIVITY_LOG_TIMEOUT ?? '3000'),
    maxRetries: parseInt(process.env.ACTIVITY_LOG_MAX_RETRIES ?? '3'),
    circuitBreakerThreshold: parseInt(process.env.ACTIVITY_CB_THRESHOLD ?? '5'),
    circuitBreakerResetTimeMs: parseInt(process.env.ACTIVITY_CB_RESET ?? '30000')
  };

  private static logQueue: ActivityLogData[] = [];
  private static batchProcessor: NodeJS.Timeout | null = null;
  private static circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    state: 'CLOSED'
  };
  
  // Rate limiting state
  private static logCount = 0;
  private static windowStart = Date.now();

  // Health metrics
  private static metrics = {
    totalLogs: 0,
    successfulLogs: 0,
    failedLogs: 0,
    queueDrops: 0,
    circuitBreakerTrips: 0,
    avgProcessingTime: 0
  };

  /**
   * Initialize the logger with batch processing
   */
  static initialize(): void {
    if (!this.config.enabled) {
      logger.info('Activity logging is disabled');
      return;
    }

    // Start batch processor
    this.startBatchProcessor();
    
    // Setup graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());

    logger.info('Improved Activity Logger initialized', {
      config: this.config,
      batchProcessing: true,
      circuitBreaker: true
    });
  }

  /**
   * Check circuit breaker state
   */
  private static checkCircuitBreaker(): boolean {
    const now = Date.now();
    
    switch (this.circuitBreaker.state) {
      case 'OPEN':
        if (now - this.circuitBreaker.lastFailureTime >= this.config.circuitBreakerResetTimeMs) {
          this.circuitBreaker.state = 'HALF_OPEN';
          logger.info('Circuit breaker transitioning to HALF_OPEN');
          return true;
        }
        return false;
        
      case 'HALF_OPEN':
        return true;
        
      case 'CLOSED':
        return true;
        
      default:
        return false;
    }
  }

  /**
   * Record circuit breaker success
   */
  private static recordSuccess(): void {
    if (this.circuitBreaker.state === 'HALF_OPEN') {
      this.circuitBreaker.state = 'CLOSED';
      this.circuitBreaker.failures = 0;
      logger.info('Circuit breaker reset to CLOSED');
    }
  }

  /**
   * Record circuit breaker failure
   */
  private static recordFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();
    
    if (this.circuitBreaker.failures >= this.config.circuitBreakerThreshold) {
      this.circuitBreaker.state = 'OPEN';
      this.metrics.circuitBreakerTrips++;
      logger.warn('Circuit breaker OPENED due to failures', {
        failures: this.circuitBreaker.failures,
        threshold: this.config.circuitBreakerThreshold
      });
    }
  }

  /**
   * Bulk insert activity logs with timeout protection
   */
  private static async bulkLog(logs: ActivityLogData[]): Promise<boolean> {
    if (logs.length === 0) return true;

    // Check circuit breaker
    if (!this.checkCircuitBreaker()) {
      logger.debug('Circuit breaker OPEN, dropping logs', { count: logs.length });
      return false;
    }

    const startTime = Date.now();
    let client: any = null;

    try {
      // Get client with timeout
      const clientPromise = getClient();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), this.config.connectionTimeoutMs)
      );
      
      client = await Promise.race([clientPromise, timeoutPromise]);

      // Prepare bulk insert query
      const query = `
        INSERT INTO user_activity_logs (
          user_id, session_id, action_type, action_category, 
          endpoint, method, response_status, ip_address, 
          user_agent, processing_time_ms, metadata, created_at
        ) VALUES ${logs.map((_, i) => 
          `($${i * 12 + 1}, $${i * 12 + 2}, $${i * 12 + 3}, $${i * 12 + 4}, 
           $${i * 12 + 5}, $${i * 12 + 6}, $${i * 12 + 7}, $${i * 12 + 8}, 
           $${i * 12 + 9}, $${i * 12 + 10}, $${i * 12 + 11}, $${i * 12 + 12})`
        ).join(', ')}
      `;

      // Prepare values array
      const values: any[] = [];
      logs.forEach(data => {
        values.push(
          data.userId || null,
          data.sessionId || null,
          data.actionType || 'UNKNOWN',
          data.actionCategory || 'SYSTEM',
          data.endpoint || null,
          data.method || null,
          data.responseStatus || null,
          data.ipAddress || null,
          data.userAgent || null,
          data.processingTimeMs || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
          new Date()
        );
      });

      // Execute with timeout
      const queryPromise = client && 'query' in client ? client.query(query, values) : Promise.reject(new Error('No client available'));
      const queryTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), this.config.connectionTimeoutMs)
      );

      await Promise.race([queryPromise, queryTimeoutPromise]);

      // Record success
      this.recordSuccess();
      this.metrics.successfulLogs += logs.length;
      this.metrics.totalLogs += logs.length;

      const processingTime = Date.now() - startTime;
      this.updateAvgProcessingTime(processingTime);

      logger.debug('Bulk activity logs inserted successfully', {
        count: logs.length,
        processingTimeMs: processingTime
      });

      return true;

    } catch (error) {
      this.recordFailure();
      this.metrics.failedLogs += logs.length;
      this.metrics.totalLogs += logs.length;

      logger.error('Bulk activity logging failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        logCount: logs.length,
        circuitBreakerState: this.circuitBreaker.state
      });

      return false;

    } finally {
      if (client && typeof (client as any).release === 'function') {
        try {
          (client as any).release();
        } catch (releaseError) {
          logger.error('Failed to release database client', { 
            error: releaseError instanceof Error ? releaseError.message : 'Unknown error'
          });
        }
      }
    }
  }

  /**
   * Start batch processor with error handling
   */
  private static startBatchProcessor(): void {
    if (this.batchProcessor) {
      clearInterval(this.batchProcessor);
    }

    this.batchProcessor = setInterval(async () => {
      try {
        await this.processBatch();
      } catch (error) {
        logger.error('Batch processor error', { 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, this.config.batchIntervalMs);
  }

  /**
   * Process a batch of queued logs
   */
  private static async processBatch(): Promise<void> {
    if (this.logQueue.length === 0) return;

    const batchSize = Math.min(this.config.batchSize, this.logQueue.length);
    const batch = this.logQueue.splice(0, batchSize);

    let retries = 0;
    while (retries < this.config.maxRetries) {
      const success = await this.bulkLog(batch);
      if (success) break;
      
      retries++;
      if (retries < this.config.maxRetries) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, retries), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        logger.debug(`Retrying batch processing, attempt ${retries + 1}`);
      }
    }

    if (retries >= this.config.maxRetries) {
      logger.error('Max retries exceeded for batch processing, dropping logs', {
        batchSize: batch.length
      });
    }
  }

  /**
   * Add log to queue with rate limiting and overflow protection
   */
  static logAsync(data: ActivityLogData): boolean {
    if (!this.config.enabled) return false;

    // Rate limiting check
    const now = Date.now();
    if (now - this.windowStart >= 1000) {
      this.windowStart = now;
      this.logCount = 0;
    }

    if (this.logCount >= this.config.maxLogsPerSecond) {
      logger.debug('Rate limit exceeded, dropping log');
      return false;
    }

    // Queue overflow protection
    if (this.logQueue.length >= this.config.maxQueueSize) {
      // Remove oldest logs to make room
      const removeCount = Math.floor(this.config.maxQueueSize * 0.1);
      this.logQueue.splice(0, removeCount);
      this.metrics.queueDrops += removeCount;
      
      logger.warn('Activity log queue overflow, dropped oldest logs', {
        droppedCount: removeCount,
        queueSize: this.logQueue.length
      });
    }

    // Add to queue
    this.logQueue.push({
      ...data,
      metadata: {
        ...data.metadata,
        queuedAt: new Date().toISOString()
      }
    });

    this.logCount++;
    return true;
  }

  /**
   * Synchronous logging (blocking) - use sparingly
   */
  static async logSync(data: ActivityLogData): Promise<boolean> {
    if (!this.config.enabled) return false;
    return await this.bulkLog([data]);
  }

  /**
   * Update average processing time
   */
  private static updateAvgProcessingTime(newTime: number): void {
    if (this.metrics.avgProcessingTime === 0) {
      this.metrics.avgProcessingTime = newTime;
    } else {
      // Exponential moving average
      this.metrics.avgProcessingTime = (this.metrics.avgProcessingTime * 0.9) + (newTime * 0.1);
    }
  }

  /**
   * Get health metrics
   */
  static getHealthMetrics(): any {
    return {
      enabled: this.config.enabled,
      queueSize: this.logQueue.length,
      maxQueueSize: this.config.maxQueueSize,
      circuitBreakerState: this.circuitBreaker.state,
      metrics: this.metrics,
      config: this.config
    };
  }

  /**
   * Graceful shutdown
   */
  static async shutdown(): Promise<void> {
    logger.info('Shutting down Activity Logger...');
    
    if (this.batchProcessor) {
      clearInterval(this.batchProcessor);
      this.batchProcessor = null;
    }

    // Process remaining logs
    if (this.logQueue.length > 0) {
      logger.info(`Processing ${this.logQueue.length} remaining logs...`);
      
      try {
        while (this.logQueue.length > 0) {
          await this.processBatch();
        }
        logger.info('All remaining logs processed successfully');
      } catch (error) {
        logger.error('Error processing remaining logs during shutdown', { 
          error: error instanceof Error ? error.message : 'Unknown error',
          remainingLogs: this.logQueue.length
        });
      }
    }

    logger.info('Activity Logger shutdown complete');
  }

  // Utility methods
  static getClientIP(req: Request): string {
    return (
      req.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
      req.get('X-Real-IP') ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  // Specialized logging methods with improved error handling
  static logLogin(userId: string | number, sessionId: string, req: Request): boolean {
    return this.logAsync({
      userId: parseInt(userId.toString()),
      sessionId,
      actionType: 'LOGIN',
      actionCategory: 'AUTH',
      endpoint: req.originalUrl,
      method: req.method,
      responseStatus: 200,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      processingTimeMs: (req as any).startTime ? Date.now() - (req as any).startTime : undefined,
      metadata: {
        loginMethod: 'email_password',
        timestamp: new Date().toISOString()
      }
    });
  }

  static logLogout(userId: string | number, sessionId: string): boolean {
    return this.logAsync({
      userId: parseInt(userId.toString()),
      sessionId,
      actionType: 'LOGOUT',
      actionCategory: 'AUTH',
      responseStatus: 200,
      metadata: {
        logoutReason: 'USER_LOGOUT',
        timestamp: new Date().toISOString()
      }
    });
  }

  static logFailedLogin(email: string, req: Request, reason = 'invalid_credentials'): boolean {
    return this.logAsync({
      userId: null,
      actionType: 'FAILED_LOGIN',
      actionCategory: 'SECURITY',
      endpoint: req.originalUrl,
      method: req.method,
      responseStatus: 401,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      processingTimeMs: (req as any).startTime ? Date.now() - (req as any).startTime : undefined,
      metadata: {
        email,
        reason,
        timestamp: new Date().toISOString()
      }
    });
  }

  static logPasswordChange(userId: string | number, sessionId: string, req: Request): boolean {
    return this.logAsync({
      userId: parseInt(userId.toString()),
      sessionId,
      actionType: 'CHANGE_PASSWORD',
      actionCategory: 'PROFILE',
      endpoint: req.originalUrl,
      method: req.method,
      responseStatus: 200,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      processingTimeMs: (req as any).startTime ? Date.now() - (req as any).startTime : undefined,
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  }
}

// Improved middleware with health monitoring
const improvedActivityMiddleware = (req: any, res: any, next: any) => {
  req.startTime = Date.now();
  
  // Skip automatic logging - only use explicit methods
  // This prevents overwhelming the system with too many logs
  
  next();
};

export { ImprovedActivityLogger, improvedActivityMiddleware };
export type { ActivityLogData };