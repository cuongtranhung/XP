/**
 * WebSocket Optimization Service
 * Connection pooling, message queuing, and performance optimization for WebSocket connections
 */

import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { logger } from '../utils/logger';
import redisClient from '../config/redis';
import { EventEmitter } from 'events';

export interface ConnectionPool {
  id: string;
  name: string;
  maxConnections: number;
  activeConnections: number;
  idleConnections: number;
  queuedRequests: number;
  connectionTimeout: number;
  idleTimeout: number;
  createdAt: Date;
  lastActivity: Date;
}

export interface MessageQueue {
  queueId: string;
  name: string;
  type: 'realtime' | 'broadcast' | 'notification' | 'system';
  priority: 'low' | 'medium' | 'high' | 'critical';
  maxSize: number;
  currentSize: number;
  processingRate: number; // messages per second
  retryAttempts: number;
  dlqEnabled: boolean; // Dead Letter Queue
  createdAt: Date;
  lastProcessed: Date;
}

export interface QueuedMessage {
  messageId: string;
  queueId: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  payload: any;
  targetUsers?: string[];
  targetRooms?: string[];
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  scheduledAt?: Date;
  processedAt?: Date;
  errorMessage?: string;
}

export interface PerformanceMetrics {
  connections: {
    total: number;
    active: number;
    idle: number;
    failed: number;
    avgConnectionTime: number;
  };
  messages: {
    sent: number;
    received: number;
    queued: number;
    failed: number;
    avgLatency: number;
    throughput: number; // messages per second
  };
  memory: {
    used: number;
    available: number;
    percentage: number;
    bufferSize: number;
  };
  redis: {
    connections: number;
    memory: number;
    operations: number;
    latency: number;
  };
}

/**
 * WebSocket Optimization Service
 */
class WebSocketOptimizationService extends EventEmitter {
  private io: SocketIOServer | null = null;
  private connectionPools = new Map<string, ConnectionPool>();
  private messageQueues = new Map<string, MessageQueue>();
  private queuedMessages = new Map<string, QueuedMessage[]>();
  private performanceMetrics: PerformanceMetrics = this.initializeMetrics();
  
  private processingInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private readonly defaultPoolConfig = {
    maxConnections: 1000,
    connectionTimeout: 30000, // 30 seconds
    idleTimeout: 300000, // 5 minutes
  };

  private readonly defaultQueueConfig = {
    maxSize: 10000,
    processingRate: 100, // messages per second
    retryAttempts: 3,
    dlqEnabled: true,
  };

  constructor() {
    super();
    this.setupDefaultPools();
    this.setupDefaultQueues();
    this.startProcessingLoop();
    this.startMetricsCollection();
    this.startCleanupTasks();
  }

  /**
   * Initialize WebSocket server with optimization
   */
  async initializeOptimizedWebSocket(server: any): Promise<void> {
    try {
      this.io = new SocketIOServer(server, {
        cors: {
          origin: process.env.FRONTEND_URL || 'http://localhost:3001',
          credentials: true
        },
        transports: ['websocket', 'polling'],
        // Optimization settings
        pingTimeout: 60000,
        pingInterval: 25000,
        upgradeTimeout: 10000,
        maxHttpBufferSize: 1e6, // 1MB
        // Connection state recovery
        connectionStateRecovery: {
          maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
          skipMiddlewares: true,
        },
        // Compression
        compression: true,
        // Adapter for clustering
        adapter: createAdapter(redisClient, redisClient.duplicate())
      });

      await this.setupOptimizedEventHandlers();
      await this.setupConnectionPooling();
      
      logger.info('✅ Optimized WebSocket server initialized successfully', {
        compression: true,
        clustering: true,
        connectionRecovery: true
      });

    } catch (error) {
      logger.error('❌ Failed to initialize optimized WebSocket server', { error });
      throw error;
    }
  }

  /**
   * Create optimized connection pool
   */
  async createConnectionPool(config: {
    name: string;
    maxConnections?: number;
    connectionTimeout?: number;
    idleTimeout?: number;
  }): Promise<string> {
    try {
      const poolId = `pool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const pool: ConnectionPool = {
        id: poolId,
        name: config.name,
        maxConnections: config.maxConnections || this.defaultPoolConfig.maxConnections,
        activeConnections: 0,
        idleConnections: 0,
        queuedRequests: 0,
        connectionTimeout: config.connectionTimeout || this.defaultPoolConfig.connectionTimeout,
        idleTimeout: config.idleTimeout || this.defaultPoolConfig.idleTimeout,
        createdAt: new Date(),
        lastActivity: new Date()
      };

      this.connectionPools.set(poolId, pool);
      
      // Store in Redis for clustering
      await this.storePoolInRedis(poolId, pool);

      logger.info('Connection pool created', {
        poolId,
        name: config.name,
        maxConnections: pool.maxConnections
      });

      this.emit('poolCreated', pool);
      return poolId;

    } catch (error) {
      logger.error('Failed to create connection pool', { error, config });
      throw error;
    }
  }

  /**
   * Create message queue with optimization
   */
  async createMessageQueue(config: {
    name: string;
    type: MessageQueue['type'];
    maxSize?: number;
    processingRate?: number;
    retryAttempts?: number;
    dlqEnabled?: boolean;
  }): Promise<string> {
    try {
      const queueId = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const queue: MessageQueue = {
        queueId,
        name: config.name,
        type: config.type,
        priority: this.getQueuePriority(config.type),
        maxSize: config.maxSize || this.defaultQueueConfig.maxSize,
        currentSize: 0,
        processingRate: config.processingRate || this.defaultQueueConfig.processingRate,
        retryAttempts: config.retryAttempts || this.defaultQueueConfig.retryAttempts,
        dlqEnabled: config.dlqEnabled ?? this.defaultQueueConfig.dlqEnabled,
        createdAt: new Date(),
        lastProcessed: new Date()
      };

      this.messageQueues.set(queueId, queue);
      this.queuedMessages.set(queueId, []);
      
      // Store in Redis for clustering
      await this.storeQueueInRedis(queueId, queue);

      logger.info('Message queue created', {
        queueId,
        name: config.name,
        type: config.type,
        maxSize: queue.maxSize
      });

      this.emit('queueCreated', queue);
      return queueId;

    } catch (error) {
      logger.error('Failed to create message queue', { error, config });
      throw error;
    }
  }

  /**
   * Queue message for optimized delivery
   */
  async queueMessage(message: {
    queueId?: string;
    type: string;
    priority?: QueuedMessage['priority'];
    payload: any;
    targetUsers?: string[];
    targetRooms?: string[];
    scheduledAt?: Date;
    maxRetries?: number;
  }): Promise<string> {
    try {
      // Auto-select queue if not specified
      const queueId = message.queueId || this.selectOptimalQueue(message.type, message.priority);
      const queue = this.messageQueues.get(queueId);
      
      if (!queue) {
        throw new Error(`Queue not found: ${queueId}`);
      }

      // Check queue capacity
      if (queue.currentSize >= queue.maxSize) {
        logger.warn('Queue at capacity, message dropped', { queueId, currentSize: queue.currentSize });
        throw new Error(`Queue at capacity: ${queueId}`);
      }

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const queuedMessage: QueuedMessage = {
        messageId,
        queueId,
        type: message.type,
        priority: message.priority || 'medium',
        payload: message.payload,
        targetUsers: message.targetUsers,
        targetRooms: message.targetRooms,
        retryCount: 0,
        maxRetries: message.maxRetries || queue.retryAttempts,
        createdAt: new Date(),
        scheduledAt: message.scheduledAt
      };

      // Add to queue
      const messages = this.queuedMessages.get(queueId) || [];
      messages.push(queuedMessage);
      
      // Sort by priority and creation time
      messages.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

      this.queuedMessages.set(queueId, messages);
      
      // Update queue metrics
      queue.currentSize = messages.length;
      queue.lastProcessed = new Date();

      // Store in Redis for persistence
      await this.storeMessageInRedis(queuedMessage);

      this.performanceMetrics.messages.queued++;

      logger.debug('Message queued successfully', {
        messageId,
        queueId,
        type: message.type,
        priority: queuedMessage.priority,
        queueSize: queue.currentSize
      });

      this.emit('messageQueued', queuedMessage);
      return messageId;

    } catch (error) {
      logger.error('Failed to queue message', { error, message });
      throw error;
    }
  }

  /**
   * Process message queues
   */
  async processQueues(): Promise<void> {
    try {
      const startTime = Date.now();
      let totalProcessed = 0;

      // Process queues by priority
      const sortedQueues = Array.from(this.messageQueues.values())
        .sort((a, b) => {
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        });

      for (const queue of sortedQueues) {
        const processed = await this.processQueue(queue);
        totalProcessed += processed;
      }

      const processingTime = Date.now() - startTime;
      
      // Update metrics
      this.performanceMetrics.messages.throughput = totalProcessed / (processingTime / 1000);

      if (totalProcessed > 0) {
        logger.debug('Queue processing completed', {
          totalProcessed,
          processingTime,
          throughput: this.performanceMetrics.messages.throughput.toFixed(2)
        });
      }

    } catch (error) {
      logger.error('Failed to process queues', { error });
    }
  }

  /**
   * Get connection pool status
   */
  getConnectionPoolStatus(poolId: string): ConnectionPool | null {
    return this.connectionPools.get(poolId) || null;
  }

  /**
   * Get message queue status
   */
  getMessageQueueStatus(queueId: string): {
    queue: MessageQueue;
    pendingMessages: number;
    processingRate: number;
  } | null {
    const queue = this.messageQueues.get(queueId);
    if (!queue) return null;

    const messages = this.queuedMessages.get(queueId) || [];
    
    return {
      queue,
      pendingMessages: messages.length,
      processingRate: queue.processingRate
    };
  }

  /**
   * Get comprehensive performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics & {
    pools: ConnectionPool[];
    queues: MessageQueue[];
    uptime: number;
  } {
    return {
      ...this.performanceMetrics,
      pools: Array.from(this.connectionPools.values()),
      queues: Array.from(this.messageQueues.values()),
      uptime: process.uptime()
    };
  }

  /**
   * Optimize WebSocket performance
   */
  async optimizePerformance(): Promise<{
    optimizations: string[];
    beforeMetrics: PerformanceMetrics;
    afterMetrics: PerformanceMetrics;
  }> {
    try {
      const beforeMetrics = { ...this.performanceMetrics };
      const optimizations: string[] = [];

      // 1. Optimize connection pools
      await this.optimizeConnectionPools();
      optimizations.push('Connection pool optimization');

      // 2. Optimize message queues
      await this.optimizeMessageQueues();
      optimizations.push('Message queue optimization');

      // 3. Clear old data
      await this.performCleanup();
      optimizations.push('Memory cleanup');

      // 4. Optimize Redis connections
      await this.optimizeRedisConnections();
      optimizations.push('Redis optimization');

      const afterMetrics = { ...this.performanceMetrics };

      logger.info('Performance optimization completed', {
        optimizations,
        memoryImprovement: beforeMetrics.memory.percentage - afterMetrics.memory.percentage
      });

      return {
        optimizations,
        beforeMetrics,
        afterMetrics
      };

    } catch (error) {
      logger.error('Failed to optimize performance', { error });
      throw error;
    }
  }

  // Private helper methods

  private async setupOptimizedEventHandlers(): Promise<void> {
    if (!this.io) return;

    this.io.engine.on('connection_error', (err) => {
      logger.error('WebSocket connection error', { error: err.message });
      this.performanceMetrics.connections.failed++;
    });

    this.io.on('connection', (socket) => {
      const startTime = Date.now();
      this.performanceMetrics.connections.active++;

      socket.on('disconnect', () => {
        this.performanceMetrics.connections.active--;
        const connectionTime = Date.now() - startTime;
        this.updateAvgConnectionTime(connectionTime);
      });
    });

    logger.info('Optimized WebSocket event handlers setup completed');
  }

  private async setupConnectionPooling(): Promise<void> {
    // Setup connection pooling with Redis
    await this.createConnectionPool({
      name: 'default',
      maxConnections: 1000,
      connectionTimeout: 30000,
      idleTimeout: 300000
    });

    await this.createConnectionPool({
      name: 'priority',
      maxConnections: 500,
      connectionTimeout: 15000,
      idleTimeout: 180000
    });

    logger.info('Connection pooling setup completed');
  }

  private setupDefaultPools(): void {
    // Default pools will be created in setupConnectionPooling
  }

  private setupDefaultQueues(): void {
    // Default queues created during initialization
    setTimeout(async () => {
      await this.createMessageQueue({
        name: 'realtime',
        type: 'realtime',
        maxSize: 5000,
        processingRate: 200,
        retryAttempts: 2
      });

      await this.createMessageQueue({
        name: 'broadcast',
        type: 'broadcast',
        maxSize: 10000,
        processingRate: 100,
        retryAttempts: 3
      });

      await this.createMessageQueue({
        name: 'notification',
        type: 'notification',
        maxSize: 15000,
        processingRate: 50,
        retryAttempts: 5
      });

      await this.createMessageQueue({
        name: 'system',
        type: 'system',
        maxSize: 2000,
        processingRate: 300,
        retryAttempts: 1
      });
    }, 1000);
  }

  private async processQueue(queue: MessageQueue): Promise<number> {
    const messages = this.queuedMessages.get(queue.queueId) || [];
    if (messages.length === 0) return 0;

    const maxProcessing = Math.min(messages.length, queue.processingRate / 10); // Process 1/10th per cycle
    const toProcess = messages.splice(0, maxProcessing);
    
    let processed = 0;
    
    for (const message of toProcess) {
      try {
        // Check if message is scheduled for future
        if (message.scheduledAt && message.scheduledAt > new Date()) {
          messages.push(message); // Put back in queue
          continue;
        }

        await this.deliverMessage(message);
        processed++;
        this.performanceMetrics.messages.sent++;
        
        message.processedAt = new Date();
        
      } catch (error) {
        logger.error('Failed to process message', { 
          error, 
          messageId: message.messageId,
          retryCount: message.retryCount 
        });

        message.retryCount++;
        message.errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Retry or move to DLQ
        if (message.retryCount < message.maxRetries) {
          messages.push(message); // Retry
        } else if (queue.dlqEnabled) {
          await this.moveToDeadLetterQueue(message);
        }

        this.performanceMetrics.messages.failed++;
      }
    }

    // Update queue
    this.queuedMessages.set(queue.queueId, messages);
    queue.currentSize = messages.length;
    queue.lastProcessed = new Date();

    return processed;
  }

  private async deliverMessage(message: QueuedMessage): Promise<void> {
    if (!this.io) {
      throw new Error('WebSocket server not initialized');
    }

    const startTime = Date.now();

    if (message.targetUsers?.length) {
      // Send to specific users
      for (const userId of message.targetUsers) {
        this.io.to(`user_${userId}`).emit(message.type, message.payload);
      }
    } else if (message.targetRooms?.length) {
      // Send to specific rooms
      for (const room of message.targetRooms) {
        this.io.to(room).emit(message.type, message.payload);
      }
    } else {
      // Broadcast to all
      this.io.emit(message.type, message.payload);
    }

    const latency = Date.now() - startTime;
    this.updateAvgLatency(latency);
  }

  private getQueuePriority(type: MessageQueue['type']): MessageQueue['priority'] {
    const priorityMap: Record<MessageQueue['type'], MessageQueue['priority']> = {
      system: 'critical',
      realtime: 'high',
      notification: 'medium',
      broadcast: 'low'
    };
    return priorityMap[type];
  }

  private selectOptimalQueue(messageType: string, priority?: QueuedMessage['priority']): string {
    // Select queue based on message type and priority
    const typeQueueMap: Record<string, string> = {
      'form_collaboration': 'realtime',
      'comment_notification': 'realtime',
      'system_alert': 'system',
      'user_activity': 'broadcast',
      'notification': 'notification'
    };

    const queueType = typeQueueMap[messageType] || 'broadcast';
    
    // Find queue of the right type
    for (const [queueId, queue] of this.messageQueues) {
      if (queue.name === queueType && queue.currentSize < queue.maxSize * 0.8) {
        return queueId;
      }
    }

    // Fallback to any available queue
    for (const [queueId, queue] of this.messageQueues) {
      if (queue.currentSize < queue.maxSize * 0.9) {
        return queueId;
      }
    }

    throw new Error('No available queues');
  }

  private async optimizeConnectionPools(): Promise<void> {
    for (const pool of this.connectionPools.values()) {
      // Optimize pool settings based on usage
      if (pool.activeConnections < pool.maxConnections * 0.5) {
        // Reduce idle timeout for better memory usage
        pool.idleTimeout = Math.max(pool.idleTimeout * 0.8, 60000);
      }
      
      pool.lastActivity = new Date();
    }
  }

  private async optimizeMessageQueues(): Promise<void> {
    for (const [queueId, queue] of this.messageQueues) {
      // Optimize processing rate based on queue size
      if (queue.currentSize > queue.maxSize * 0.7) {
        queue.processingRate = Math.min(queue.processingRate * 1.2, 500);
      } else if (queue.currentSize < queue.maxSize * 0.3) {
        queue.processingRate = Math.max(queue.processingRate * 0.9, 10);
      }
    }
  }

  private async optimizeRedisConnections(): Promise<void> {
    try {
      // Optimize Redis pipeline operations
      const pipeline = redisClient.pipeline();
      
      // Clean up expired keys
      const expiredKeys = await redisClient.keys('websocket_optimization:*:expired');
      if (expiredKeys.length > 0) {
        pipeline.del(...expiredKeys);
      }
      
      await pipeline.exec();
      
      this.performanceMetrics.redis.operations++;
      
    } catch (error) {
      logger.warn('Redis optimization failed', { error });
    }
  }

  private updateAvgConnectionTime(connectionTime: number): void {
    const metrics = this.performanceMetrics.connections;
    metrics.avgConnectionTime = (metrics.avgConnectionTime + connectionTime) / 2;
  }

  private updateAvgLatency(latency: number): void {
    const metrics = this.performanceMetrics.messages;
    metrics.avgLatency = (metrics.avgLatency + latency) / 2;
  }

  private async moveToDeadLetterQueue(message: QueuedMessage): Promise<void> {
    try {
      await redisClient.lpush('websocket_dlq', JSON.stringify(message));
      await redisClient.ltrim('websocket_dlq', 0, 999); // Keep last 1000
      
      logger.warn('Message moved to DLQ', {
        messageId: message.messageId,
        retryCount: message.retryCount,
        error: message.errorMessage
      });
      
    } catch (error) {
      logger.error('Failed to move message to DLQ', { error, messageId: message.messageId });
    }
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      connections: {
        total: 0,
        active: 0,
        idle: 0,
        failed: 0,
        avgConnectionTime: 0
      },
      messages: {
        sent: 0,
        received: 0,
        queued: 0,
        failed: 0,
        avgLatency: 0,
        throughput: 0
      },
      memory: {
        used: 0,
        available: 0,
        percentage: 0,
        bufferSize: 0
      },
      redis: {
        connections: 0,
        memory: 0,
        operations: 0,
        latency: 0
      }
    };
  }

  private startProcessingLoop(): void {
    this.processingInterval = setInterval(async () => {
      await this.processQueues();
    }, 100); // Process every 100ms
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, 5000); // Collect every 5 seconds
  }

  private startCleanupTasks(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.performCleanup();
    }, 60000); // Cleanup every minute
  }

  private collectMetrics(): void {
    const memUsage = process.memoryUsage();
    
    this.performanceMetrics.memory = {
      used: memUsage.heapUsed,
      available: memUsage.heapTotal,
      percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      bufferSize: memUsage.external
    };

    this.performanceMetrics.connections.total = this.performanceMetrics.connections.active + this.performanceMetrics.connections.idle;
  }

  private async performCleanup(): Promise<void> {
    try {
      const now = new Date();
      const maxAge = 60 * 60 * 1000; // 1 hour

      // Clean up old processed messages
      for (const [queueId, messages] of this.queuedMessages) {
        const filtered = messages.filter(msg => 
          !msg.processedAt || (now.getTime() - msg.processedAt.getTime() < maxAge)
        );
        this.queuedMessages.set(queueId, filtered);
        
        // Update queue size
        const queue = this.messageQueues.get(queueId);
        if (queue) {
          queue.currentSize = filtered.length;
        }
      }

      logger.debug('Cleanup completed');
      
    } catch (error) {
      logger.error('Cleanup failed', { error });
    }
  }

  private async storePoolInRedis(poolId: string, pool: ConnectionPool): Promise<void> {
    try {
      await redisClient.setex(
        `websocket_pool:${poolId}`,
        3600,
        JSON.stringify(pool)
      );
    } catch (error) {
      logger.warn('Failed to store pool in Redis', { error, poolId });
    }
  }

  private async storeQueueInRedis(queueId: string, queue: MessageQueue): Promise<void> {
    try {
      await redisClient.setex(
        `websocket_queue:${queueId}`,
        3600,
        JSON.stringify(queue)
      );
    } catch (error) {
      logger.warn('Failed to store queue in Redis', { error, queueId });
    }
  }

  private async storeMessageInRedis(message: QueuedMessage): Promise<void> {
    try {
      await redisClient.setex(
        `websocket_message:${message.messageId}`,
        1800, // 30 minutes
        JSON.stringify(message)
      );
    } catch (error) {
      logger.warn('Failed to store message in Redis', { error, messageId: message.messageId });
    }
  }
}

// Export singleton instance
export const webSocketOptimizationService = new WebSocketOptimizationService();
export default webSocketOptimizationService;