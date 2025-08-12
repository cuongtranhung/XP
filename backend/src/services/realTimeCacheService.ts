/**
 * Real-time Cache Update Service
 * Handles real-time cache synchronization using WebSocket and event-driven updates
 */

import { EventEmitter } from 'events';
import cacheService from './cacheService';
import { logger } from '../utils/logger';
import { createCachedRepository } from './cachedRepositoryService';

// Cache update event types
export type CacheUpdateEvent = {
  type: 'create' | 'update' | 'delete' | 'invalidate' | 'refresh';
  entity: 'user' | 'form' | 'submission' | 'location' | 'preference' | 'session';
  entityId: string;
  userId?: string;
  data?: any;
  metadata?: {
    timestamp: Date;
    source: string;
    reason?: string;
    priority: 'low' | 'normal' | 'high' | 'critical';
  };
};

export type CacheSubscription = {
  id: string;
  userId: string;
  entities: string[];
  callback: (event: CacheUpdateEvent) => void | Promise<void>;
  filters?: {
    entityIds?: string[];
    eventTypes?: string[];
    priority?: string[];
  };
  createdAt: Date;
  lastActivity: Date;
};

/**
 * Real-time Cache Service with Event-driven Updates
 */
class RealTimeCacheService extends EventEmitter {
  private subscriptions = new Map<string, CacheSubscription>();
  private updateQueues = new Map<string, CacheUpdateEvent[]>();
  private processingInProgress = new Set<string>();
  private batchUpdateTimer: NodeJS.Timeout | null = null;
  private updateStats = {
    eventsProcessed: 0,
    subscriptionsActive: 0,
    lastUpdateTime: new Date(),
    averageProcessingTime: 0
  };

  // Cache update strategies
  private updateStrategies = createCachedRepository('update_strategies', {
    ttl: 3600,
    keyPrefix: 'realtime:strategy',
    enableCache: true
  });

  constructor() {
    super();
    this.setupEventHandlers();
    this.startBatchProcessor();
  }

  /**
   * Subscribe to real-time cache updates
   */
  subscribe(subscription: Omit<CacheSubscription, 'id' | 'createdAt' | 'lastActivity'>): string {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const fullSubscription: CacheSubscription = {
      ...subscription,
      id: subscriptionId,
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.subscriptions.set(subscriptionId, fullSubscription);
    this.updateStats.subscriptionsActive = this.subscriptions.size;

    logger.info('Real-time cache subscription created', {
      subscriptionId,
      userId: subscription.userId,
      entities: subscription.entities
    });

    return subscriptionId;
  }

  /**
   * Unsubscribe from real-time updates
   */
  unsubscribe(subscriptionId: string): boolean {
    const removed = this.subscriptions.delete(subscriptionId);
    this.updateStats.subscriptionsActive = this.subscriptions.size;

    if (removed) {
      logger.info('Real-time cache subscription removed', { subscriptionId });
    }

    return removed;
  }

  /**
   * Trigger real-time cache update
   */
  async triggerUpdate(event: CacheUpdateEvent): Promise<void> {
    const startTime = Date.now();

    try {
      // Validate event
      if (!this.validateUpdateEvent(event)) {
        logger.warn('Invalid cache update event', { event });
        return;
      }

      // Add metadata if missing
      if (!event.metadata) {
        event.metadata = {
          timestamp: new Date(),
          source: 'system',
          priority: 'normal'
        };
      }

      // Process immediate updates for critical priority
      if (event.metadata.priority === 'critical') {
        await this.processUpdateImmediate(event);
      } else {
        // Queue for batch processing
        this.queueUpdate(event);
      }

      // Update cache based on event type
      await this.handleCacheUpdate(event);

      // Notify subscribers
      await this.notifySubscribers(event);

      // Update statistics
      this.updateStats.eventsProcessed++;
      const processingTime = Date.now() - startTime;
      this.updateStats.averageProcessingTime = 
        (this.updateStats.averageProcessingTime + processingTime) / 2;
      this.updateStats.lastUpdateTime = new Date();

      logger.debug('Real-time cache update processed', {
        event: event.type,
        entity: event.entity,
        entityId: event.entityId,
        processingTime: `${processingTime}ms`
      });

    } catch (error) {
      logger.error('Failed to process real-time cache update', {
        error: error instanceof Error ? error.message : 'Unknown error',
        event
      });
    }
  }

  /**
   * Batch trigger multiple updates
   */
  async triggerBatchUpdate(events: CacheUpdateEvent[]): Promise<void> {
    logger.info(`Processing batch cache update: ${events.length} events`);

    const batchId = `batch_${Date.now()}`;
    const startTime = Date.now();

    try {
      // Group events by entity for optimal processing
      const groupedEvents = this.groupEventsByEntity(events);

      for (const [entity, entityEvents] of groupedEvents.entries()) {
        await this.processBatchForEntity(entity, entityEvents);
      }

      // Batch notify subscribers
      for (const event of events) {
        await this.notifySubscribers(event);
      }

      const processingTime = Date.now() - startTime;
      logger.info('Batch cache update completed', {
        batchId,
        eventCount: events.length,
        processingTime: `${processingTime}ms`
      });

    } catch (error) {
      logger.error('Failed to process batch cache update', {
        batchId,
        error: error instanceof Error ? error.message : 'Unknown error',
        eventCount: events.length
      });
    }
  }

  /**
   * Get active subscriptions for user
   */
  getUserSubscriptions(userId: string): CacheSubscription[] {
    return Array.from(this.subscriptions.values())
      .filter(sub => sub.userId === userId);
  }

  /**
   * Get real-time cache statistics
   */
  getStats(): {
    subscriptions: number;
    eventsProcessed: number;
    queuedUpdates: number;
    averageProcessingTime: number;
    lastUpdateTime: Date;
    uptime: number;
  } {
    const queuedUpdates = Array.from(this.updateQueues.values())
      .reduce((total, queue) => total + queue.length, 0);

    return {
      subscriptions: this.updateStats.subscriptionsActive,
      eventsProcessed: this.updateStats.eventsProcessed,
      queuedUpdates,
      averageProcessingTime: Math.round(this.updateStats.averageProcessingTime),
      lastUpdateTime: this.updateStats.lastUpdateTime,
      uptime: process.uptime()
    };
  }

  /**
   * Force refresh cache for entity
   */
  async forceRefresh(entity: string, entityId: string, userId?: string): Promise<void> {
    const refreshEvent: CacheUpdateEvent = {
      type: 'refresh',
      entity: entity as any,
      entityId,
      userId,
      metadata: {
        timestamp: new Date(),
        source: 'manual',
        reason: 'force_refresh',
        priority: 'high'
      }
    };

    await this.triggerUpdate(refreshEvent);
  }

  // Private helper methods

  private setupEventHandlers(): void {
    // Handle cache service events
    this.on('cache:invalidated', async (data) => {
      await this.triggerUpdate({
        type: 'invalidate',
        entity: data.entity,
        entityId: data.entityId,
        userId: data.userId,
        metadata: {
          timestamp: new Date(),
          source: 'cache_service',
          priority: 'normal'
        }
      });
    });

    // Handle database change events
    this.on('db:changed', async (data) => {
      await this.triggerUpdate({
        type: data.operation,
        entity: data.table,
        entityId: data.id,
        data: data.newData,
        metadata: {
          timestamp: new Date(),
          source: 'database',
          priority: 'normal'
        }
      });
    });
  }

  private startBatchProcessor(): void {
    // Process queued updates every 5 seconds
    this.batchUpdateTimer = setInterval(async () => {
      await this.processBatchedUpdates();
    }, 5000);

    logger.info('Real-time cache batch processor started');
  }

  private validateUpdateEvent(event: CacheUpdateEvent): boolean {
    const requiredFields = ['type', 'entity', 'entityId'];
    const validTypes = ['create', 'update', 'delete', 'invalidate', 'refresh'];
    const validEntities = ['user', 'form', 'submission', 'location', 'preference', 'session'];

    // Check required fields
    for (const field of requiredFields) {
      if (!event[field as keyof CacheUpdateEvent]) {
        return false;
      }
    }

    // Validate enum values
    if (!validTypes.includes(event.type)) {
      return false;
    }

    if (!validEntities.includes(event.entity)) {
      return false;
    }

    return true;
  }

  private queueUpdate(event: CacheUpdateEvent): void {
    const queueKey = `${event.entity}:${event.userId || 'global'}`;
    
    if (!this.updateQueues.has(queueKey)) {
      this.updateQueues.set(queueKey, []);
    }

    this.updateQueues.get(queueKey)!.push(event);
  }

  private async processUpdateImmediate(event: CacheUpdateEvent): Promise<void> {
    logger.info('Processing immediate cache update', {
      type: event.type,
      entity: event.entity,
      entityId: event.entityId,
      priority: event.metadata?.priority
    });

    await this.handleCacheUpdate(event);
  }

  private async handleCacheUpdate(event: CacheUpdateEvent): Promise<void> {
    const cacheKey = `${event.entity}:${event.entityId}`;

    switch (event.type) {
      case 'create':
      case 'update':
        if (event.data) {
          await cacheService.set(cacheKey, event.data, { ttl: 3600 });
        }
        break;

      case 'delete':
      case 'invalidate':
        await cacheService.del(cacheKey);
        // Also invalidate related patterns
        await this.invalidateRelatedCache(event);
        break;

      case 'refresh':
        await cacheService.del(cacheKey);
        // Cache will be repopulated on next access
        break;
    }
  }

  private async invalidateRelatedCache(event: CacheUpdateEvent): Promise<void> {
    // Invalidate related cache entries based on entity type
    const relatedPatterns: string[] = [];

    switch (event.entity) {
      case 'user':
        relatedPatterns.push(
          `user:preferences:${event.entityId}`,
          `user:sessions:${event.entityId}`,
          `geo:user:${event.entityId}`,
          `user:history:${event.entityId}:*`
        );
        break;

      case 'form':
        relatedPatterns.push(
          `forms:list:*`,
          `form:fields:${event.entityId}`,
          `form:analytics:${event.entityId}`
        );
        break;

      case 'submission':
        relatedPatterns.push(
          `submissions:form:*`,
          `submissions:user:${event.userId}:*`
        );
        break;

      case 'location':
        relatedPatterns.push(
          `geo:user:${event.userId}`,
          `geo:recent:${event.userId}`,
          `geo:clusters:${event.userId}:*`
        );
        break;
    }

    // Invalidate related patterns
    for (const pattern of relatedPatterns) {
      try {
        if (pattern.includes('*')) {
          // Pattern-based invalidation would need Redis KEYS command
          logger.debug('Pattern invalidation requested', { pattern });
        } else {
          await cacheService.del(pattern);
        }
      } catch (error) {
        logger.error('Failed to invalidate related cache', { pattern, error });
      }
    }
  }

  private async notifySubscribers(event: CacheUpdateEvent): Promise<void> {
    const relevantSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => this.shouldNotifySubscription(sub, event));

    const notifications = relevantSubscriptions.map(async (subscription) => {
      try {
        subscription.lastActivity = new Date();
        await subscription.callback(event);
      } catch (error) {
        logger.error('Subscription callback failed', {
          subscriptionId: subscription.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    await Promise.allSettled(notifications);

    if (relevantSubscriptions.length > 0) {
      logger.debug('Notified subscribers', {
        event: event.type,
        entity: event.entity,
        subscribersNotified: relevantSubscriptions.length
      });
    }
  }

  private shouldNotifySubscription(subscription: CacheSubscription, event: CacheUpdateEvent): boolean {
    // Check entity filter
    if (!subscription.entities.includes(event.entity)) {
      return false;
    }

    // Check user scope (only notify user's own data or public data)
    if (event.userId && event.userId !== subscription.userId) {
      return false;
    }

    // Check filters if provided
    if (subscription.filters) {
      const { entityIds, eventTypes, priority } = subscription.filters;

      if (entityIds && !entityIds.includes(event.entityId)) {
        return false;
      }

      if (eventTypes && !eventTypes.includes(event.type)) {
        return false;
      }

      if (priority && event.metadata?.priority && !priority.includes(event.metadata.priority)) {
        return false;
      }
    }

    return true;
  }

  private groupEventsByEntity(events: CacheUpdateEvent[]): Map<string, CacheUpdateEvent[]> {
    const grouped = new Map<string, CacheUpdateEvent[]>();

    for (const event of events) {
      const key = event.entity;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(event);
    }

    return grouped;
  }

  private async processBatchForEntity(entity: string, events: CacheUpdateEvent[]): Promise<void> {
    // Optimize batch processing by entity type
    logger.debug(`Processing batch for entity: ${entity}`, { eventCount: events.length });

    // Deduplicate events by entityId, keeping the latest
    const deduped = new Map<string, CacheUpdateEvent>();
    for (const event of events) {
      const key = event.entityId;
      const existing = deduped.get(key);
      
      if (!existing || 
          (event.metadata?.timestamp && existing.metadata?.timestamp && 
           event.metadata.timestamp > existing.metadata.timestamp)) {
        deduped.set(key, event);
      }
    }

    // Process deduplicated events
    for (const event of deduped.values()) {
      await this.handleCacheUpdate(event);
    }
  }

  private async processBatchedUpdates(): Promise<void> {
    if (this.updateQueues.size === 0) {
      return;
    }

    const allEvents: CacheUpdateEvent[] = [];
    
    // Collect all queued events
    for (const [queueKey, events] of this.updateQueues.entries()) {
      if (events.length > 0) {
        allEvents.push(...events);
        this.updateQueues.set(queueKey, []); // Clear queue
      }
    }

    if (allEvents.length > 0) {
      await this.triggerBatchUpdate(allEvents);
    }
  }
}

// Export singleton instance
export const realTimeCacheService = new RealTimeCacheService();
export default realTimeCacheService;