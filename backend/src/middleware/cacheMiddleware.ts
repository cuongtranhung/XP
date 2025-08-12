import { Request, Response, NextFunction } from 'express';
import cacheService from '../services/cacheService';
import { logger } from '../utils/logger';

// Cache configuration interface
interface CacheOptions {
  ttl?: number;
  userSpecific?: boolean;
  skipCache?: boolean;
  keyPrefix?: string;
  varyBy?: string[];
}

// Default cache settings by endpoint type
const DEFAULT_CACHE_CONFIG: Record<string, CacheOptions> = {
  '/api/forms': { ttl: 3600, userSpecific: true }, // 1 hour
  '/api/users': { ttl: 600, userSpecific: true },  // 10 minutes
  '/api/comments': { ttl: 300, userSpecific: true }, // 5 minutes
  '/api/activities': { ttl: 300, userSpecific: true }, // 5 minutes
  '/api/locations': { ttl: 1800 }, // 30 minutes, not user-specific
  '/api/permissions': { ttl: 3600 }, // 1 hour, not user-specific
  '/api/health': { ttl: 60 }, // 1 minute
};

/**
 * Generate cache key based on request parameters
 */
function generateCacheKey(req: Request, options: CacheOptions): string {
  const baseKey = options.keyPrefix || 'api';
  const path = req.route?.path || req.path;
  const method = req.method.toLowerCase();
  
  let key = `${baseKey}:${method}:${path}`;
  
  // Add user ID for user-specific caching
  if (options.userSpecific && req.user?.id) {
    key += `:user:${req.user.id}`;
  }
  
  // Add query parameters for GET requests
  if (method === 'get' && Object.keys(req.query).length > 0) {
    const sortedQuery = Object.keys(req.query)
      .sort()
      .map(k => `${k}:${req.query[k]}`)
      .join(',');
    key += `:query:${Buffer.from(sortedQuery).toString('base64')}`;
  }
  
  // Add specific parameters to vary by
  if (options.varyBy) {
    const varyValues = options.varyBy
      .map(field => {
        const value = req.params[field] || req.query[field] || req.body[field];
        return value ? `${field}:${value}` : null;
      })
      .filter(Boolean)
      .join(',');
    if (varyValues) {
      key += `:vary:${varyValues}`;
    }
  }
  
  return key;
}

/**
 * Check if response should be cached
 */
function shouldCacheResponse(res: Response, options: CacheOptions): boolean {
  // Don't cache error responses
  if (res.statusCode >= 400) {
    return false;
  }
  
  // Don't cache if explicitly disabled
  if (options.skipCache) {
    return false;
  }
  
  // Only cache successful responses
  return res.statusCode >= 200 && res.statusCode < 300;
}

/**
 * API Response Cache Middleware
 */
export const cacheMiddleware = (customOptions: CacheOptions = {}) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Skip caching for non-GET requests by default
      if (req.method !== 'GET' && !customOptions.keyPrefix) {
        return next();
      }

      // Get cache configuration
      const routePattern = req.route?.path || req.path;
      const defaultConfig = DEFAULT_CACHE_CONFIG[routePattern] || {};
      const options: CacheOptions = { ...defaultConfig, ...customOptions };

      // Skip if caching disabled
      if (options.skipCache) {
        return next();
      }

      const cacheKey = generateCacheKey(req, options);
      
      // Try to get from cache
      const cachedData = await cacheService.get(cacheKey);
      
      if (cachedData) {
        logger.debug(`Cache HIT for key: ${cacheKey}`);
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        return res.json(cachedData);
      }

      logger.debug(`Cache MISS for key: ${cacheKey}`);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Cache-Key', cacheKey);

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache response
      res.json = function(data: any) {
        // Cache the response if it should be cached
        if (shouldCacheResponse(res, options)) {
          cacheService.set(cacheKey, data, { ttl: options.ttl })
            .then(() => {
              logger.debug(`Cached response for key: ${cacheKey}`);
            })
            .catch(error => {
              logger.warn(`Failed to cache response for key: ${cacheKey}`, error);
            });
        }

        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      // Continue without caching on error
      next();
    }
  };
};

/**
 * Cache invalidation middleware for write operations
 */
export const cacheInvalidationMiddleware = (patterns: string[] = []) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Store original response methods
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);

      // Function to invalidate cache after successful response
      const invalidateCache = async () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          for (const pattern of patterns) {
            try {
              // Simple pattern-based invalidation
              if (pattern.includes('*')) {
                // For now, we'll implement simple wildcard invalidation
                // In a full Redis implementation, we'd use SCAN with pattern matching
                logger.debug(`Would invalidate pattern: ${pattern}`);
              } else {
                await cacheService.del(pattern);
                logger.debug(`Invalidated cache key: ${pattern}`);
              }
            } catch (error) {
              logger.warn(`Failed to invalidate cache pattern: ${pattern}`, error);
            }
          }
        }
      };

      // Override response methods
      res.json = function(data: any) {
        invalidateCache();
        return originalJson(data);
      };

      res.send = function(data: any) {
        invalidateCache();
        return originalSend(data);
      };

      next();
    } catch (error) {
      logger.error('Cache invalidation middleware error:', error);
      next();
    }
  };
};

/**
 * Specific middleware for different endpoint types
 */
export const cachingStrategies = {
  // Forms - High TTL, user-specific
  forms: cacheMiddleware({ ttl: 3600, userSpecific: true, keyPrefix: 'forms' }),
  
  // Users - Medium TTL, user-specific  
  users: cacheMiddleware({ ttl: 600, userSpecific: true, keyPrefix: 'users' }),
  
  // Comments - Low TTL, user-specific
  comments: cacheMiddleware({ ttl: 300, userSpecific: true, keyPrefix: 'comments' }),
  
  // Activities - Low TTL, user-specific
  activities: cacheMiddleware({ ttl: 300, userSpecific: true, keyPrefix: 'activities' }),
  
  // Locations - Medium TTL, global
  locations: cacheMiddleware({ ttl: 1800, userSpecific: false, keyPrefix: 'locations' }),
  
  // Permissions - High TTL, global
  permissions: cacheMiddleware({ ttl: 3600, userSpecific: false, keyPrefix: 'permissions' }),
  
  // Health checks - Very low TTL
  health: cacheMiddleware({ ttl: 60, userSpecific: false, keyPrefix: 'health' })
};

/**
 * Cache invalidation patterns for different operations
 */
export const invalidationStrategies = {
  // User operations
  userUpdate: cacheInvalidationMiddleware(['users:*', 'activities:*']),
  
  // Form operations  
  formUpdate: cacheInvalidationMiddleware(['forms:*', 'comments:*']),
  
  // Comment operations
  commentUpdate: cacheInvalidationMiddleware(['comments:*', 'activities:*']),
  
  // Location operations
  locationUpdate: cacheInvalidationMiddleware(['locations:*']),
  
  // Permission operations
  permissionUpdate: cacheInvalidationMiddleware(['permissions:*', 'users:*'])
};

export default cacheMiddleware;