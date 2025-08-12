/**
 * Real-time Cache Routes
 * API endpoints for managing real-time cache subscriptions and monitoring
 */

import { Router } from 'express';
import { Request, Response } from 'express';
import { auth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import realTimeCacheService, { CacheUpdateEvent } from '../services/realTimeCacheService';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(auth);

/**
 * POST /api/realtime-cache/subscribe
 * Subscribe to real-time cache updates
 */
router.post('/subscribe', asyncHandler(async (req: Request, res: Response) => {
  const { entities, filters, callbackUrl } = req.body;
  const userId = req.user?.id!;

  if (!entities || !Array.isArray(entities) || entities.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'entities array is required and cannot be empty'
    });
  }

  // Validate entities
  const validEntities = ['user', 'form', 'submission', 'location', 'preference', 'session'];
  const invalidEntities = entities.filter(e => !validEntities.includes(e));
  
  if (invalidEntities.length > 0) {
    return res.status(400).json({
      success: false,
      error: `Invalid entities: ${invalidEntities.join(', ')}`,
      validEntities
    });
  }

  // Create callback function (in real implementation, this would be WebSocket or webhook)
  const callback = async (event: CacheUpdateEvent) => {
    logger.debug('Cache update event for subscription', {
      userId,
      event: {
        type: event.type,
        entity: event.entity,
        entityId: event.entityId
      }
    });

    // In real implementation, send to WebSocket or call webhook
    if (callbackUrl) {
      // Would make HTTP POST to callbackUrl with event data
      logger.info('Would notify webhook', { callbackUrl, event });
    }
  };

  const subscriptionId = realTimeCacheService.subscribe({
    userId,
    entities,
    filters,
    callback
  });

  res.status(201).json({
    success: true,
    data: {
      subscriptionId,
      entities,
      filters,
      userId,
      createdAt: new Date().toISOString(),
      message: 'Successfully subscribed to real-time cache updates'
    }
  });
}));

/**
 * DELETE /api/realtime-cache/subscribe/:subscriptionId
 * Unsubscribe from real-time cache updates
 */
router.delete('/subscribe/:subscriptionId', asyncHandler(async (req: Request, res: Response) => {
  const { subscriptionId } = req.params;
  const userId = req.user?.id!;

  // Verify subscription belongs to user
  const userSubscriptions = realTimeCacheService.getUserSubscriptions(userId);
  const subscription = userSubscriptions.find(sub => sub.id === subscriptionId);

  if (!subscription) {
    return res.status(404).json({
      success: false,
      error: 'Subscription not found or access denied'
    });
  }

  const removed = realTimeCacheService.unsubscribe(subscriptionId);

  if (removed) {
    res.json({
      success: true,
      data: {
        subscriptionId,
        message: 'Successfully unsubscribed from real-time cache updates'
      }
    });
  } else {
    res.status(500).json({
      success: false,
      error: 'Failed to remove subscription'
    });
  }
}));

/**
 * GET /api/realtime-cache/subscriptions
 * Get user's active subscriptions
 */
router.get('/subscriptions', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id!;
  const subscriptions = realTimeCacheService.getUserSubscriptions(userId);

  res.json({
    success: true,
    data: {
      subscriptions: subscriptions.map(sub => ({
        id: sub.id,
        entities: sub.entities,
        filters: sub.filters,
        createdAt: sub.createdAt,
        lastActivity: sub.lastActivity
      })),
      totalCount: subscriptions.length
    }
  });
}));

/**
 * POST /api/realtime-cache/trigger-update
 * Manually trigger a cache update event (for testing/admin)
 */
router.post('/trigger-update', asyncHandler(async (req: Request, res: Response) => {
  const { type, entity, entityId, data, priority = 'normal' } = req.body;
  const userId = req.user?.id!;

  // Validate required fields
  if (!type || !entity || !entityId) {
    return res.status(400).json({
      success: false,
      error: 'type, entity, and entityId are required'
    });
  }

  // Validate enum values
  const validTypes = ['create', 'update', 'delete', 'invalidate', 'refresh'];
  const validEntities = ['user', 'form', 'submission', 'location', 'preference', 'session'];
  const validPriorities = ['low', 'normal', 'high', 'critical'];

  if (!validTypes.includes(type)) {
    return res.status(400).json({
      success: false,
      error: `Invalid type: ${type}`,
      validTypes
    });
  }

  if (!validEntities.includes(entity)) {
    return res.status(400).json({
      success: false,
      error: `Invalid entity: ${entity}`,
      validEntities
    });
  }

  if (!validPriorities.includes(priority)) {
    return res.status(400).json({
      success: false,
      error: `Invalid priority: ${priority}`,
      validPriorities
    });
  }

  const updateEvent: CacheUpdateEvent = {
    type,
    entity,
    entityId,
    userId,
    data,
    metadata: {
      timestamp: new Date(),
      source: 'manual_api',
      reason: 'user_triggered',
      priority
    }
  };

  await realTimeCacheService.triggerUpdate(updateEvent);

  logger.info('Manual cache update triggered', {
    userId,
    event: updateEvent
  });

  res.json({
    success: true,
    data: {
      event: updateEvent,
      message: 'Cache update event triggered successfully'
    }
  });
}));

/**
 * POST /api/realtime-cache/batch-update
 * Trigger multiple cache updates in batch
 */
router.post('/batch-update', asyncHandler(async (req: Request, res: Response) => {
  const { events } = req.body;
  const userId = req.user?.id!;

  if (!events || !Array.isArray(events) || events.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'events array is required and cannot be empty'
    });
  }

  if (events.length > 100) {
    return res.status(400).json({
      success: false,
      error: 'Maximum 100 events per batch'
    });
  }

  // Validate all events
  const validTypes = ['create', 'update', 'delete', 'invalidate', 'refresh'];
  const validEntities = ['user', 'form', 'submission', 'location', 'preference', 'session'];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    
    if (!event.type || !event.entity || !event.entityId) {
      return res.status(400).json({
        success: false,
        error: `Event at index ${i}: type, entity, and entityId are required`
      });
    }

    if (!validTypes.includes(event.type)) {
      return res.status(400).json({
        success: false,
        error: `Event at index ${i}: invalid type: ${event.type}`
      });
    }

    if (!validEntities.includes(event.entity)) {
      return res.status(400).json({
        success: false,
        error: `Event at index ${i}: invalid entity: ${event.entity}`
      });
    }
  }

  // Add metadata to all events
  const processedEvents: CacheUpdateEvent[] = events.map((event, index) => ({
    ...event,
    userId,
    metadata: {
      timestamp: new Date(),
      source: 'batch_api',
      reason: `batch_update_${index}`,
      priority: event.priority || 'normal'
    }
  }));

  await realTimeCacheService.triggerBatchUpdate(processedEvents);

  logger.info('Batch cache update triggered', {
    userId,
    eventCount: events.length
  });

  res.json({
    success: true,
    data: {
      eventsProcessed: events.length,
      message: 'Batch cache update triggered successfully'
    }
  });
}));

/**
 * POST /api/realtime-cache/force-refresh
 * Force refresh cache for specific entity
 */
router.post('/force-refresh', asyncHandler(async (req: Request, res: Response) => {
  const { entity, entityId } = req.body;
  const userId = req.user?.id!;

  if (!entity || !entityId) {
    return res.status(400).json({
      success: false,
      error: 'entity and entityId are required'
    });
  }

  await realTimeCacheService.forceRefresh(entity, entityId, userId);

  logger.info('Cache force refresh triggered', {
    userId,
    entity,
    entityId
  });

  res.json({
    success: true,
    data: {
      entity,
      entityId,
      userId,
      message: 'Cache force refresh triggered successfully'
    }
  });
}));

/**
 * GET /api/realtime-cache/stats
 * Get real-time cache statistics
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const stats = realTimeCacheService.getStats();
  const userId = req.user?.id!;
  const userSubscriptions = realTimeCacheService.getUserSubscriptions(userId);

  res.json({
    success: true,
    data: {
      systemStats: stats,
      userStats: {
        subscriptionsCount: userSubscriptions.length,
        subscriptions: userSubscriptions.map(sub => ({
          id: sub.id,
          entities: sub.entities,
          createdAt: sub.createdAt,
          lastActivity: sub.lastActivity
        }))
      },
      timestamp: new Date().toISOString()
    }
  });
}));

/**
 * GET /api/realtime-cache/health
 * Health check for real-time cache service
 */
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  const stats = realTimeCacheService.getStats();
  const isHealthy = stats.subscriptions >= 0 && stats.averageProcessingTime < 5000; // < 5 seconds

  const healthData = {
    healthy: isHealthy,
    stats,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  };

  if (isHealthy) {
    res.json({
      success: true,
      data: healthData
    });
  } else {
    res.status(503).json({
      success: false,
      error: 'Real-time cache service unhealthy',
      data: healthData
    });
  }
}));

export default router;