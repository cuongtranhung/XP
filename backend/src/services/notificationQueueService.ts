/**
 * Notification Queue Service
 * Advanced queue management with priority handling, retry logic, and delivery orchestration
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import redisClient from '../config/redis';
import { 
  NotificationData, 
  NotificationChannel, 
  NotificationPriority,
  NotificationStatus 
} from './notificationService';

export interface QueueConfig {
  name: string;
  channel: NotificationChannel;
  priority: NotificationPriority;
  maxSize: number;
  processingRate: number; // messages per second
  batchSize: number;
  retryAttempts: number;
  retryDelay: number; // milliseconds
  dlqEnabled: boolean; // Dead Letter Queue
  throttling?: {
    maxPerMinute?: number;
    maxPerHour?: number;
    maxPerDay?: number;
  };
}

export interface QueueItem {
  itemId: string;
  notification: NotificationData;
  priority: number; // Numeric priority for sorting
  attempts: number;
  nextAttempt?: Date;
  errors: Array<{
    timestamp: Date;
    message: string;
    code?: string;
  }>;
  addedAt: Date;
  processingStartedAt?: Date;
  completedAt?: Date;
}

export interface QueueMetrics {
  queueName: string;
  channel: NotificationChannel;
  size: number;
  processing: number;
  processed: number;
  failed: number;
  averageProcessingTime: number;
  throughput: number;
  errorRate: number;
  lastProcessedAt?: Date;
  oldestItem?: Date;
}

export interface DeliveryResult {
  success: boolean;
  notificationId: string;
  channel: NotificationChannel;
  deliveredAt?: Date;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  metadata?: Record<string, any>;
}

export interface BatchDeliveryResult {
  batchId: string;
  totalItems: number;
  successful: number;
  failed: number;
  results: DeliveryResult[];
  processingTime: number;
}

/**
 * Notification Queue Service Class
 */
class NotificationQueueService extends EventEmitter {
  private queues = new Map<string, QueueConfig>();
  private queueItems = new Map<string, QueueItem[]>();
  private processingItems = new Map<string, Set<string>>();
  private deadLetterQueue: QueueItem[] = [];
  
  private deliveryHandlers = new Map<NotificationChannel, Function>();
  private processingIntervals = new Map<string, NodeJS.Timeout>();
  private metricsCache = new Map<string, QueueMetrics>();
  
  private readonly defaultConfig: Partial<QueueConfig> = {
    maxSize: 10000,
    processingRate: 100,
    batchSize: 50,
    retryAttempts: 3,
    retryDelay: 60000, // 1 minute
    dlqEnabled: true
  };

  constructor() {
    super();
    this.initializeService();
  }

  /**
   * Initialize queue service
   */
  private async initializeService(): Promise<void> {
    try {
      // Initialize default queues
      await this.initializeDefaultQueues();
      
      // Register delivery handlers
      this.registerDeliveryHandlers();
      
      // Load persisted queue items
      await this.loadPersistedQueues();
      
      // Start queue processors
      this.startQueueProcessors();
      
      // Start metrics collection
      this.startMetricsCollection();
      
      logger.info('✅ Notification queue service initialized');
      
    } catch (error) {
      logger.error('❌ Failed to initialize queue service', { error });
      throw error;
    }
  }

  /**
   * Create or update queue configuration
   */
  async configureQueue(config: Partial<QueueConfig> & { name: string; channel: NotificationChannel }): Promise<QueueConfig> {
    try {
      const fullConfig: QueueConfig = {
        ...this.defaultConfig,
        ...config,
        priority: config.priority || 'medium'
      } as QueueConfig;
      
      // Validate configuration
      this.validateQueueConfig(fullConfig);
      
      // Stop existing processor if updating
      const existingInterval = this.processingIntervals.get(config.name);
      if (existingInterval) {
        clearInterval(existingInterval);
      }
      
      // Store configuration
      this.queues.set(config.name, fullConfig);
      
      // Initialize queue items array
      if (!this.queueItems.has(config.name)) {
        this.queueItems.set(config.name, []);
      }
      
      // Initialize processing set
      if (!this.processingItems.has(config.name)) {
        this.processingItems.set(config.name, new Set());
      }
      
      // Start processor for this queue
      this.startQueueProcessor(config.name);
      
      // Persist configuration
      await this.persistQueueConfig(fullConfig);
      
      logger.info('Queue configured', {
        name: config.name,
        channel: config.channel,
        maxSize: fullConfig.maxSize
      });
      
      return fullConfig;
      
    } catch (error) {
      logger.error('Failed to configure queue', { error, config });
      throw error;
    }
  }

  /**
   * Add notification to queue
   */
  async enqueue(
    notification: NotificationData,
    options?: {
      priority?: number;
      delay?: number;
      deduplicate?: boolean;
    }
  ): Promise<string> {
    try {
      // Determine target queue
      const queueName = this.getQueueName(notification.channels[0], notification.priority);
      const queue = this.queues.get(queueName);
      
      if (!queue) {
        throw new Error(`Queue not found: ${queueName}`);
      }
      
      // Check queue capacity
      const items = this.queueItems.get(queueName) || [];
      if (items.length >= queue.maxSize) {
        throw new Error(`Queue ${queueName} is at capacity`);
      }
      
      // Check for duplicates if requested
      if (options?.deduplicate) {
        const duplicate = items.find(item =>
          item.notification.notificationId === notification.notificationId
        );
        
        if (duplicate) {
          logger.debug('Duplicate notification skipped', {
            notificationId: notification.notificationId,
            queueName
          });
          return duplicate.itemId;
        }
      }
      
      // Create queue item
      const itemId = this.generateItemId();
      const queueItem: QueueItem = {
        itemId,
        notification,
        priority: options?.priority || this.getPriorityValue(notification.priority),
        attempts: 0,
        errors: [],
        addedAt: new Date()
      };
      
      // Handle delayed delivery
      if (options?.delay) {
        queueItem.nextAttempt = new Date(Date.now() + options.delay);
      }
      
      // Add to queue
      items.push(queueItem);
      
      // Sort by priority and timestamp
      items.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        return a.addedAt.getTime() - b.addedAt.getTime(); // FIFO for same priority
      });
      
      this.queueItems.set(queueName, items);
      
      // Persist queue item
      await this.persistQueueItem(queueName, queueItem);
      
      // Update metrics
      this.updateQueueMetrics(queueName, 'enqueued');
      
      // Emit event
      this.emit('itemEnqueued', {
        itemId,
        queueName,
        notificationId: notification.notificationId
      });
      
      logger.debug('Notification enqueued', {
        itemId,
        queueName,
        notificationId: notification.notificationId,
        priority: notification.priority
      });
      
      return itemId;
      
    } catch (error) {
      logger.error('Failed to enqueue notification', { error, notification });
      throw error;
    }
  }

  /**
   * Process batch of notifications
   */
  async processBatch(
    channel: NotificationChannel,
    notifications: NotificationData[]
  ): Promise<BatchDeliveryResult> {
    try {
      const startTime = Date.now();
      const batchId = this.generateBatchId();
      const results: DeliveryResult[] = [];
      
      // Get delivery handler
      const handler = this.deliveryHandlers.get(channel);
      if (!handler) {
        throw new Error(`No delivery handler for channel: ${channel}`);
      }
      
      // Process notifications in parallel with concurrency limit
      const concurrencyLimit = 10;
      const chunks = this.chunkArray(notifications, concurrencyLimit);
      
      for (const chunk of chunks) {
        const chunkResults = await Promise.allSettled(
          chunk.map(notification => this.deliverNotification(notification, channel, handler))
        );
        
        chunkResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            results.push({
              success: false,
              notificationId: chunk[index].notificationId,
              channel,
              error: {
                code: 'DELIVERY_FAILED',
                message: result.reason?.message || 'Unknown error',
                retryable: true
              }
            });
          }
        });
      }
      
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      const batchResult: BatchDeliveryResult = {
        batchId,
        totalItems: notifications.length,
        successful,
        failed,
        results,
        processingTime: Date.now() - startTime
      };
      
      // Emit batch completion event
      this.emit('batchProcessed', batchResult);
      
      logger.info('Batch processed', {
        batchId,
        channel,
        total: notifications.length,
        successful,
        failed,
        processingTime: batchResult.processingTime
      });
      
      return batchResult;
      
    } catch (error) {
      logger.error('Failed to process batch', { error, channel });
      throw error;
    }
  }

  /**
   * Retry failed notification
   */
  async retryNotification(itemId: string, queueName: string): Promise<boolean> {
    try {
      const items = this.queueItems.get(queueName) || [];
      const itemIndex = items.findIndex(item => item.itemId === itemId);
      
      if (itemIndex === -1) {
        throw new Error(`Queue item not found: ${itemId}`);
      }
      
      const item = items[itemIndex];
      const queue = this.queues.get(queueName);
      
      if (!queue) {
        throw new Error(`Queue configuration not found: ${queueName}`);
      }
      
      // Check retry attempts
      if (item.attempts >= queue.retryAttempts) {
        // Move to DLQ
        if (queue.dlqEnabled) {
          await this.moveToDeadLetterQueue(item, queueName);
        }
        
        // Remove from main queue
        items.splice(itemIndex, 1);
        this.queueItems.set(queueName, items);
        
        return false;
      }
      
      // Schedule retry
      item.attempts++;
      item.nextAttempt = new Date(Date.now() + queue.retryDelay * item.attempts);
      
      // Update in queue
      items[itemIndex] = item;
      this.queueItems.set(queueName, items);
      
      // Persist update
      await this.persistQueueItem(queueName, item);
      
      logger.info('Notification scheduled for retry', {
        itemId,
        queueName,
        attempt: item.attempts,
        nextAttempt: item.nextAttempt
      });
      
      return true;
      
    } catch (error) {
      logger.error('Failed to retry notification', { error, itemId, queueName });
      throw error;
    }
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics(queueName?: string): Promise<QueueMetrics | QueueMetrics[]> {
    try {
      if (queueName) {
        const metrics = await this.calculateQueueMetrics(queueName);
        return metrics;
      }
      
      // Get metrics for all queues
      const allMetrics: QueueMetrics[] = [];
      
      for (const [name] of this.queues) {
        const metrics = await this.calculateQueueMetrics(name);
        allMetrics.push(metrics);
      }
      
      return allMetrics;
      
    } catch (error) {
      logger.error('Failed to get queue metrics', { error, queueName });
      throw error;
    }
  }

  /**
   * Clear queue
   */
  async clearQueue(queueName: string, options?: { force?: boolean }): Promise<number> {
    try {
      const items = this.queueItems.get(queueName) || [];
      const processingSet = this.processingItems.get(queueName);
      
      // Check if items are being processed
      if (!options?.force && processingSet && processingSet.size > 0) {
        throw new Error(`Queue ${queueName} has items being processed`);
      }
      
      const count = items.length;
      
      // Clear queue
      this.queueItems.set(queueName, []);
      
      // Clear from Redis
      await redisClient.del(`queue:${queueName}:items`);
      
      logger.info('Queue cleared', { queueName, itemsCleared: count });
      
      return count;
      
    } catch (error) {
      logger.error('Failed to clear queue', { error, queueName });
      throw error;
    }
  }

  /**
   * Get dead letter queue items
   */
  getDeadLetterQueue(limit: number = 100): QueueItem[] {
    return this.deadLetterQueue.slice(0, limit);
  }

  /**
   * Reprocess dead letter queue item
   */
  async reprocessDLQItem(itemId: string): Promise<boolean> {
    try {
      const itemIndex = this.deadLetterQueue.findIndex(item => item.itemId === itemId);
      
      if (itemIndex === -1) {
        throw new Error(`DLQ item not found: ${itemId}`);
      }
      
      const item = this.deadLetterQueue[itemIndex];
      
      // Reset attempts and errors
      item.attempts = 0;
      item.errors = [];
      item.nextAttempt = undefined;
      
      // Re-enqueue to appropriate queue
      const queueName = this.getQueueName(
        item.notification.channels[0],
        item.notification.priority
      );
      
      const items = this.queueItems.get(queueName) || [];
      items.push(item);
      this.queueItems.set(queueName, items);
      
      // Remove from DLQ
      this.deadLetterQueue.splice(itemIndex, 1);
      
      logger.info('DLQ item reprocessed', { itemId, queueName });
      
      return true;
      
    } catch (error) {
      logger.error('Failed to reprocess DLQ item', { error, itemId });
      throw error;
    }
  }

  // Private helper methods

  private async initializeDefaultQueues(): Promise<void> {
    const channels: NotificationChannel[] = ['email', 'in-app', 'push', 'sms', 'webhook'];
    const priorities: NotificationPriority[] = ['critical', 'high', 'medium', 'low'];
    
    for (const channel of channels) {
      for (const priority of priorities) {
        const queueName = `${channel}_${priority}`;
        
        await this.configureQueue({
          name: queueName,
          channel,
          priority,
          maxSize: priority === 'critical' ? 5000 : 10000,
          processingRate: priority === 'critical' ? 200 : 100,
          batchSize: priority === 'critical' ? 20 : 50,
          retryAttempts: priority === 'critical' ? 5 : 3,
          retryDelay: priority === 'critical' ? 30000 : 60000,
          dlqEnabled: true
        });
      }
    }
  }

  private registerDeliveryHandlers(): void {
    // Register channel-specific delivery handlers
    this.deliveryHandlers.set('email', this.deliverEmail.bind(this));
    this.deliveryHandlers.set('in-app', this.deliverInApp.bind(this));
    this.deliveryHandlers.set('push', this.deliverPush.bind(this));
    this.deliveryHandlers.set('sms', this.deliverSms.bind(this));
    this.deliveryHandlers.set('webhook', this.deliverWebhook.bind(this));
  }

  private startQueueProcessors(): void {
    for (const [queueName] of this.queues) {
      this.startQueueProcessor(queueName);
    }
  }

  private startQueueProcessor(queueName: string): void {
    const queue = this.queues.get(queueName);
    if (!queue) return;
    
    // Calculate processing interval based on rate
    const interval = Math.max(1000 / queue.processingRate, 10); // Minimum 10ms
    
    const processorInterval = setInterval(async () => {
      await this.processQueue(queueName);
    }, interval);
    
    this.processingIntervals.set(queueName, processorInterval);
  }

  private async processQueue(queueName: string): Promise<void> {
    try {
      const queue = this.queues.get(queueName);
      if (!queue) return;
      
      const items = this.queueItems.get(queueName) || [];
      const processingSet = this.processingItems.get(queueName) || new Set();
      
      // Skip if queue is empty or at processing capacity
      if (items.length === 0 || processingSet.size >= queue.batchSize) {
        return;
      }
      
      // Get items to process
      const now = new Date();
      const toProcess = items
        .filter(item => 
          !processingSet.has(item.itemId) &&
          (!item.nextAttempt || item.nextAttempt <= now)
        )
        .slice(0, queue.batchSize - processingSet.size);
      
      if (toProcess.length === 0) {
        return;
      }
      
      // Mark items as processing
      toProcess.forEach(item => {
        processingSet.add(item.itemId);
        item.processingStartedAt = new Date();
      });
      
      // Get delivery handler
      const handler = this.deliveryHandlers.get(queue.channel);
      if (!handler) {
        logger.error('No delivery handler for channel', { channel: queue.channel });
        return;
      }
      
      // Process items
      for (const item of toProcess) {
        try {
          const result = await this.deliverNotification(
            item.notification,
            queue.channel,
            handler
          );
          
          if (result.success) {
            // Remove from queue
            const index = items.findIndex(i => i.itemId === item.itemId);
            if (index !== -1) {
              items.splice(index, 1);
            }
            
            // Update metrics
            this.updateQueueMetrics(queueName, 'delivered');
            
            // Emit success event
            this.emit('notificationDelivered', result);
            
          } else {
            // Handle failure
            item.errors.push({
              timestamp: new Date(),
              message: result.error?.message || 'Delivery failed',
              code: result.error?.code
            });
            
            if (result.error?.retryable) {
              await this.retryNotification(item.itemId, queueName);
            } else {
              // Move to DLQ
              if (queue.dlqEnabled) {
                await this.moveToDeadLetterQueue(item, queueName);
              }
              
              // Remove from queue
              const index = items.findIndex(i => i.itemId === item.itemId);
              if (index !== -1) {
                items.splice(index, 1);
              }
            }
            
            // Update metrics
            this.updateQueueMetrics(queueName, 'failed');
          }
          
        } catch (error) {
          logger.error('Failed to process queue item', {
            error,
            itemId: item.itemId,
            queueName
          });
          
          item.errors.push({
            timestamp: new Date(),
            message: error instanceof Error ? error.message : 'Unknown error'
          });
          
          await this.retryNotification(item.itemId, queueName);
          
        } finally {
          // Remove from processing set
          processingSet.delete(item.itemId);
          item.completedAt = new Date();
        }
      }
      
      // Update queue items
      this.queueItems.set(queueName, items);
      
    } catch (error) {
      logger.error('Queue processing failed', { error, queueName });
    }
  }

  private async deliverNotification(
    notification: NotificationData,
    channel: NotificationChannel,
    handler: Function
  ): Promise<DeliveryResult> {
    try {
      const startTime = Date.now();
      
      // Call channel-specific handler
      await handler(notification);
      
      return {
        success: true,
        notificationId: notification.notificationId,
        channel,
        deliveredAt: new Date(),
        metadata: {
          deliveryTime: Date.now() - startTime
        }
      };
      
    } catch (error) {
      return {
        success: false,
        notificationId: notification.notificationId,
        channel,
        error: {
          code: error instanceof Error && 'code' in error ? (error as any).code : 'DELIVERY_ERROR',
          message: error instanceof Error ? error.message : 'Delivery failed',
          retryable: this.isRetryableError(error)
        }
      };
    }
  }

  // Channel-specific delivery methods

  private async deliverEmail(notification: NotificationData): Promise<void> {
    // Implementation would call email service
    logger.debug('Email notification delivered', { notificationId: notification.notificationId });
  }

  private async deliverInApp(notification: NotificationData): Promise<void> {
    // Implementation would use WebSocket service
    logger.debug('In-app notification delivered', { notificationId: notification.notificationId });
  }

  private async deliverPush(notification: NotificationData): Promise<void> {
    // Implementation would call push notification service
    logger.debug('Push notification delivered', { notificationId: notification.notificationId });
  }

  private async deliverSms(notification: NotificationData): Promise<void> {
    // Implementation would call SMS service
    logger.debug('SMS notification delivered', { notificationId: notification.notificationId });
  }

  private async deliverWebhook(notification: NotificationData): Promise<void> {
    // Implementation would make HTTP request
    logger.debug('Webhook notification delivered', { notificationId: notification.notificationId });
  }

  private isRetryableError(error: any): boolean {
    // Determine if error is retryable
    const nonRetryableCodes = ['INVALID_RECIPIENT', 'UNSUBSCRIBED', 'BLOCKED'];
    
    if (error && 'code' in error) {
      return !nonRetryableCodes.includes(error.code);
    }
    
    return true; // Default to retryable
  }

  private async moveToDeadLetterQueue(item: QueueItem, queueName: string): Promise<void> {
    this.deadLetterQueue.push({
      ...item,
      completedAt: new Date()
    });
    
    // Persist to Redis
    await redisClient.lpush('notification_dlq', JSON.stringify(item));
    
    // Trim DLQ to max size
    if (this.deadLetterQueue.length > 10000) {
      this.deadLetterQueue = this.deadLetterQueue.slice(-10000);
    }
    
    await redisClient.ltrim('notification_dlq', 0, 9999);
    
    logger.warn('Item moved to DLQ', {
      itemId: item.itemId,
      queueName,
      notificationId: item.notification.notificationId,
      attempts: item.attempts
    });
    
    // Emit DLQ event
    this.emit('itemMovedToDLQ', { itemId: item.itemId, queueName });
  }

  private validateQueueConfig(config: QueueConfig): void {
    if (!config.name) {
      throw new Error('Queue name is required');
    }
    
    if (!config.channel) {
      throw new Error('Queue channel is required');
    }
    
    if (config.maxSize <= 0) {
      throw new Error('Max size must be positive');
    }
    
    if (config.processingRate <= 0) {
      throw new Error('Processing rate must be positive');
    }
    
    if (config.batchSize <= 0) {
      throw new Error('Batch size must be positive');
    }
  }

  private getQueueName(channel: NotificationChannel, priority: NotificationPriority): string {
    return `${channel}_${priority}`;
  }

  private getPriorityValue(priority: NotificationPriority): number {
    const priorityMap: Record<NotificationPriority, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1
    };
    
    return priorityMap[priority];
  }

  private async calculateQueueMetrics(queueName: string): Promise<QueueMetrics> {
    const queue = this.queues.get(queueName);
    const items = this.queueItems.get(queueName) || [];
    const processingSet = this.processingItems.get(queueName) || new Set();
    
    // Get cached metrics
    let metrics = this.metricsCache.get(queueName);
    
    if (!metrics) {
      metrics = {
        queueName,
        channel: queue?.channel || 'in-app',
        size: 0,
        processing: 0,
        processed: 0,
        failed: 0,
        averageProcessingTime: 0,
        throughput: 0,
        errorRate: 0
      };
    }
    
    metrics.size = items.length;
    metrics.processing = processingSet.size;
    
    if (items.length > 0) {
      metrics.oldestItem = items[0].addedAt;
    }
    
    return metrics;
  }

  private updateQueueMetrics(queueName: string, event: 'enqueued' | 'delivered' | 'failed'): void {
    let metrics = this.metricsCache.get(queueName);
    
    if (!metrics) {
      const queue = this.queues.get(queueName);
      metrics = {
        queueName,
        channel: queue?.channel || 'in-app',
        size: 0,
        processing: 0,
        processed: 0,
        failed: 0,
        averageProcessingTime: 0,
        throughput: 0,
        errorRate: 0
      };
      this.metricsCache.set(queueName, metrics);
    }
    
    switch (event) {
      case 'enqueued':
        metrics.size++;
        break;
      case 'delivered':
        metrics.processed++;
        metrics.lastProcessedAt = new Date();
        break;
      case 'failed':
        metrics.failed++;
        break;
    }
    
    // Calculate error rate
    if (metrics.processed + metrics.failed > 0) {
      metrics.errorRate = metrics.failed / (metrics.processed + metrics.failed);
    }
  }

  private startMetricsCollection(): void {
    setInterval(async () => {
      for (const [queueName] of this.queues) {
        const metrics = await this.calculateQueueMetrics(queueName);
        this.metricsCache.set(queueName, metrics);
        
        // Persist metrics to Redis
        await redisClient.hset(
          'queue_metrics',
          queueName,
          JSON.stringify(metrics)
        );
      }
    }, 30000); // Every 30 seconds
  }

  private async loadPersistedQueues(): Promise<void> {
    try {
      // Load queue configurations
      const configKeys = await redisClient.keys('queue_config:*');
      
      for (const key of configKeys) {
        const data = await redisClient.get(key);
        if (data) {
          const config = JSON.parse(data);
          this.queues.set(config.name, config);
        }
      }
      
      // Load queue items
      for (const [queueName] of this.queues) {
        const itemsData = await redisClient.lrange(`queue:${queueName}:items`, 0, -1);
        const items: QueueItem[] = itemsData.map(data => JSON.parse(data));
        this.queueItems.set(queueName, items);
      }
      
      // Load DLQ
      const dlqData = await redisClient.lrange('notification_dlq', 0, -1);
      this.deadLetterQueue = dlqData.map(data => JSON.parse(data));
      
    } catch (error) {
      logger.error('Failed to load persisted queues', { error });
    }
  }

  private async persistQueueConfig(config: QueueConfig): Promise<void> {
    await redisClient.set(
      `queue_config:${config.name}`,
      JSON.stringify(config)
    );
  }

  private async persistQueueItem(queueName: string, item: QueueItem): Promise<void> {
    // Store in list for persistence
    await redisClient.rpush(
      `queue:${queueName}:items`,
      JSON.stringify(item)
    );
    
    // Trim to max size
    const queue = this.queues.get(queueName);
    if (queue) {
      await redisClient.ltrim(`queue:${queueName}:items`, -queue.maxSize, -1);
    }
  }

  private generateItemId(): string {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Public cleanup method
  async cleanup(): Promise<void> {
    // Stop all processors
    for (const [, interval] of this.processingIntervals) {
      clearInterval(interval);
    }
    
    this.processingIntervals.clear();
  }
}

// Export singleton instance
export const notificationQueueService = new NotificationQueueService();
export default notificationQueueService;