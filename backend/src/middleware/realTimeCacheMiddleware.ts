/**
 * Real-time Cache Middleware
 * Automatically triggers cache updates on database operations
 */

import { Request, Response, NextFunction } from 'express';
import realTimeCacheService, { CacheUpdateEvent } from '../services/realTimeCacheService';
import { logger } from '../utils/logger';

// Request context for tracking cache updates
export interface CacheContext {
  entity?: string;
  entityId?: string;
  operation?: 'create' | 'update' | 'delete';
  userId?: string;
  skipCacheUpdate?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      cacheContext?: CacheContext;
    }
  }
}

/**
 * Middleware to set cache context for requests
 */
export function setCacheContext(context: CacheContext) {
  return (req: Request, res: Response, next: NextFunction) => {
    req.cacheContext = { ...req.cacheContext, ...context };
    next();
  };
}

/**
 * Middleware to trigger cache updates after successful operations
 */
export function triggerCacheUpdate() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    const originalJson = res.json;

    // Override response methods to catch successful operations
    res.send = function(data: any) {
      triggerUpdateIfNeeded(req, res, data);
      return originalSend.call(this, data);
    };

    res.json = function(data: any) {
      triggerUpdateIfNeeded(req, res, data);
      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * Auto-cache middleware that automatically detects entity and operation
 */
export function autoCacheMiddleware() {
  return [
    setCacheContextFromRoute(),
    triggerCacheUpdate()
  ];
}

/**
 * Set cache context based on route patterns
 */
function setCacheContextFromRoute() {
  return (req: Request, res: Response, next: NextFunction) => {
    const { method, path, params } = req;
    const context: CacheContext = {};

    // Parse entity from route path
    if (path.includes('/api/users')) {
      context.entity = 'user';
      context.entityId = params.userId || params.id;
    } else if (path.includes('/api/forms') || path.includes('/api/formbuilder')) {
      context.entity = 'form';
      context.entityId = params.formId || params.id;
    } else if (path.includes('/api/submissions')) {
      context.entity = 'submission';
      context.entityId = params.submissionId || params.id;
    } else if (path.includes('/api/geo') || path.includes('/api/locations')) {
      context.entity = 'location';
      context.entityId = params.locationId || params.id;
    }

    // Parse operation from HTTP method
    switch (method.toUpperCase()) {
      case 'POST':
        context.operation = 'create';
        break;
      case 'PUT':
      case 'PATCH':
        context.operation = 'update';
        break;
      case 'DELETE':
        context.operation = 'delete';
        break;
    }

    // Get user ID from auth middleware
    context.userId = req.user?.id;

    req.cacheContext = { ...req.cacheContext, ...context };
    next();
  };
}

/**
 * Trigger cache update if conditions are met
 */
async function triggerUpdateIfNeeded(req: Request, res: Response, data: any) {
  const context = req.cacheContext;
  
  if (!context || context.skipCacheUpdate) {
    return;
  }

  // Only trigger on successful responses (2xx status codes)
  if (res.statusCode < 200 || res.statusCode >= 300) {
    return;
  }

  // Skip GET requests (read operations)
  if (req.method === 'GET') {
    return;
  }

  if (!context.entity || !context.operation) {
    logger.debug('Cache update skipped: missing entity or operation', { context });
    return;
  }

  try {
    // Extract entity ID from response data if not in context
    const entityId = context.entityId || extractEntityIdFromResponse(data, context.entity);
    
    if (!entityId) {
      logger.debug('Cache update skipped: no entity ID found', { context });
      return;
    }

    const updateEvent: CacheUpdateEvent = {
      type: context.operation,
      entity: context.entity as any,
      entityId,
      userId: context.userId,
      data: extractRelevantData(data, context.entity),
      metadata: {
        timestamp: new Date(),
        source: 'middleware',
        priority: getPriorityFromOperation(context.operation),
        reason: `${context.operation}_via_api`
      }
    };

    await realTimeCacheService.triggerUpdate(updateEvent);

    logger.debug('Real-time cache update triggered', {
      operation: context.operation,
      entity: context.entity,
      entityId,
      userId: context.userId
    });

  } catch (error) {
    logger.error('Failed to trigger cache update from middleware', {
      error: error instanceof Error ? error.message : 'Unknown error',
      context
    });
  }
}

/**
 * Extract entity ID from response data
 */
function extractEntityIdFromResponse(data: any, entity: string): string | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }

  // Try common patterns for entity ID
  const possibleKeys = [
    'id',
    `${entity}Id`,
    `${entity}_id`,
    'data.id',
    'result.id'
  ];

  for (const key of possibleKeys) {
    const value = getNestedValue(data, key);
    if (value && (typeof value === 'string' || typeof value === 'number')) {
      return String(value);
    }
  }

  return undefined;
}

/**
 * Extract relevant data for caching based on entity type
 */
function extractRelevantData(responseData: any, entity: string): any {
  if (!responseData || typeof responseData !== 'object') {
    return responseData;
  }

  // Extract the main data object
  const mainData = responseData.data || responseData.result || responseData;

  switch (entity) {
    case 'user':
      return {
        id: mainData.id,
        email: mainData.email,
        fullName: mainData.fullName || mainData.full_name,
        isActive: mainData.isActive || mainData.is_active,
        updatedAt: mainData.updatedAt || new Date()
      };

    case 'form':
      return {
        id: mainData.id,
        name: mainData.name,
        status: mainData.status,
        ownerId: mainData.ownerId || mainData.owner_id,
        visibility: mainData.visibility,
        updatedAt: mainData.updatedAt || new Date()
      };

    case 'submission':
      return {
        id: mainData.id,
        formId: mainData.formId || mainData.form_id,
        status: mainData.status,
        submitterId: mainData.submitterId || mainData.submitter_id,
        updatedAt: mainData.updatedAt || new Date()
      };

    case 'location':
      return {
        id: mainData.id,
        userId: mainData.userId || mainData.user_id,
        latitude: mainData.latitude,
        longitude: mainData.longitude,
        address: mainData.address,
        city: mainData.city,
        country: mainData.country,
        updatedAt: mainData.updatedAt || new Date()
      };

    default:
      return mainData;
  }
}

/**
 * Get priority level based on operation type
 */
function getPriorityFromOperation(operation: string): 'low' | 'normal' | 'high' | 'critical' {
  switch (operation) {
    case 'create':
      return 'high';
    case 'update':
      return 'normal';
    case 'delete':
      return 'high';
    default:
      return 'normal';
  }
}

/**
 * Get nested object value using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

/**
 * Specific cache middleware for different entities
 */
export const cacheMiddleware = {
  // User operations
  users: setCacheContext({ entity: 'user' }),
  
  // Form operations
  forms: setCacheContext({ entity: 'form' }),
  
  // Submission operations
  submissions: setCacheContext({ entity: 'submission' }),
  
  // Location operations
  locations: setCacheContext({ entity: 'location' }),

  // Generic auto-detection
  auto: autoCacheMiddleware()
};

/**
 * Manual cache invalidation helpers
 */
export const invalidateCache = {
  user: (userId: string) => realTimeCacheService.triggerUpdate({
    type: 'invalidate',
    entity: 'user',
    entityId: userId,
    metadata: {
      timestamp: new Date(),
      source: 'manual',
      priority: 'normal'
    }
  }),

  form: (formId: string) => realTimeCacheService.triggerUpdate({
    type: 'invalidate',
    entity: 'form',
    entityId: formId,
    metadata: {
      timestamp: new Date(),
      source: 'manual',
      priority: 'normal'
    }
  }),

  submission: (submissionId: string, userId?: string) => realTimeCacheService.triggerUpdate({
    type: 'invalidate',
    entity: 'submission',
    entityId: submissionId,
    userId,
    metadata: {
      timestamp: new Date(),
      source: 'manual',
      priority: 'normal'
    }
  }),

  location: (locationId: string, userId?: string) => realTimeCacheService.triggerUpdate({
    type: 'invalidate',
    entity: 'location',
    entityId: locationId,
    userId,
    metadata: {
      timestamp: new Date(),
      source: 'manual',
      priority: 'normal'
    }
  })
};