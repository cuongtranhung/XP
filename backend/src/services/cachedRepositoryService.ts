import cacheService from './cacheService';
import { logger } from '../utils/logger';

// Cache configuration for different entity types
interface CacheConfig {
  ttl: number;
  keyPrefix: string;
  enableCache: boolean;
}

const DEFAULT_CACHE_CONFIGS: Record<string, CacheConfig> = {
  user: { ttl: 600, keyPrefix: 'user', enableCache: true }, // 10 minutes
  form: { ttl: 3600, keyPrefix: 'form', enableCache: true }, // 1 hour  
  submission: { ttl: 1800, keyPrefix: 'submission', enableCache: true }, // 30 minutes
  comment: { ttl: 300, keyPrefix: 'comment', enableCache: true }, // 5 minutes
  location: { ttl: 1800, keyPrefix: 'location', enableCache: true }, // 30 minutes
  session: { ttl: 1800, keyPrefix: 'session', enableCache: true }, // 30 minutes
  permission: { ttl: 3600, keyPrefix: 'permission', enableCache: true }, // 1 hour
  group: { ttl: 1800, keyPrefix: 'group', enableCache: true }, // 30 minutes
};

/**
 * Generic cached repository wrapper
 * Provides caching layer for any repository/service
 */
export class CachedRepository<T = any> {
  private config: CacheConfig;
  
  constructor(
    private entityType: string,
    customConfig?: Partial<CacheConfig>
  ) {
    const defaultConfig = DEFAULT_CACHE_CONFIGS[entityType] || DEFAULT_CACHE_CONFIGS.user;
    this.config = { ...defaultConfig, ...customConfig };
  }

  /**
   * Generate cache key for entity
   */
  private generateKey(id: string, suffix?: string): string {
    const key = `${this.config.keyPrefix}:${id}`;
    return suffix ? `${key}:${suffix}` : key;
  }

  /**
   * Get cached entity by ID
   */
  async getById<TResult = T>(
    id: string,
    fetchFunction: () => Promise<TResult | null>,
    suffix?: string
  ): Promise<TResult | null> {
    if (!this.config.enableCache) {
      return await fetchFunction();
    }

    const cacheKey = this.generateKey(id, suffix);
    
    try {
      // Try to get from cache
      const cached = await cacheService.get<TResult>(cacheKey);
      if (cached !== null) {
        logger.debug(`Cache HIT for ${this.entityType}:${id}`);
        return cached;
      }

      logger.debug(`Cache MISS for ${this.entityType}:${id}`);
      
      // Fetch from database
      const result = await fetchFunction();
      
      // Cache the result if not null
      if (result !== null) {
        await cacheService.set(cacheKey, result, { ttl: this.config.ttl });
      }
      
      return result;
    } catch (error) {
      logger.error(`Cache error for ${this.entityType}:${id}:`, error);
      // Fallback to direct database call
      return await fetchFunction();
    }
  }

  /**
   * Get cached list with query parameters
   */
  async getList<TResult = T[]>(
    queryKey: string,
    fetchFunction: () => Promise<TResult>,
    ttlOverride?: number
  ): Promise<TResult> {
    if (!this.config.enableCache) {
      return await fetchFunction();
    }

    const cacheKey = `${this.config.keyPrefix}:list:${queryKey}`;
    
    try {
      // Try to get from cache
      const cached = await cacheService.get<TResult>(cacheKey);
      if (cached !== null) {
        logger.debug(`Cache HIT for ${this.entityType} list:${queryKey}`);
        return cached;
      }

      logger.debug(`Cache MISS for ${this.entityType} list:${queryKey}`);
      
      // Fetch from database
      const result = await fetchFunction();
      
      // Cache the result
      const ttl = ttlOverride || this.config.ttl;
      await cacheService.set(cacheKey, result, { ttl });
      
      return result;
    } catch (error) {
      logger.error(`Cache error for ${this.entityType} list:${queryKey}:`, error);
      // Fallback to direct database call
      return await fetchFunction();
    }
  }

  /**
   * Cache custom query with automatic key generation
   */
  async cacheQuery<TResult = any>(
    operation: string,
    params: Record<string, any>,
    fetchFunction: () => Promise<TResult>,
    ttlOverride?: number
  ): Promise<TResult> {
    if (!this.config.enableCache) {
      return await fetchFunction();
    }

    // Generate cache key from parameters
    const paramString = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');
    
    const queryHash = Buffer.from(paramString).toString('base64').substring(0, 16);
    const cacheKey = `${this.config.keyPrefix}:${operation}:${queryHash}`;
    
    try {
      // Try to get from cache
      const cached = await cacheService.get<TResult>(cacheKey);
      if (cached !== null) {
        logger.debug(`Cache HIT for ${this.entityType} ${operation}:${queryHash}`);
        return cached;
      }

      logger.debug(`Cache MISS for ${this.entityType} ${operation}:${queryHash}`);
      
      // Fetch from database
      const result = await fetchFunction();
      
      // Cache the result
      const ttl = ttlOverride || this.config.ttl;
      await cacheService.set(cacheKey, result, { ttl });
      
      return result;
    } catch (error) {
      logger.error(`Cache error for ${this.entityType} ${operation}:`, error);
      // Fallback to direct database call
      return await fetchFunction();
    }
  }

  /**
   * Invalidate cache for specific entity
   */
  async invalidate(id: string, suffix?: string): Promise<void> {
    if (!this.config.enableCache) return;

    const cacheKey = this.generateKey(id, suffix);
    
    try {
      await cacheService.del(cacheKey);
      logger.debug(`Invalidated cache for ${this.entityType}:${id}`);
    } catch (error) {
      logger.error(`Failed to invalidate cache for ${this.entityType}:${id}:`, error);
    }
  }

  /**
   * Invalidate cache patterns (simple wildcard support)
   */
  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.config.enableCache) return;

    try {
      // For memory cache, we can't use pattern matching efficiently
      // In a full Redis implementation, we'd use SCAN with pattern
      logger.debug(`Would invalidate pattern: ${this.config.keyPrefix}:${pattern}`);
      // TODO: Implement pattern-based invalidation when Redis is available
    } catch (error) {
      logger.error(`Failed to invalidate pattern ${pattern}:`, error);
    }
  }

  /**
   * Update cache after entity modification
   */
  async updateCache(id: string, newData: T, suffix?: string): Promise<void> {
    if (!this.config.enableCache) return;

    const cacheKey = this.generateKey(id, suffix);
    
    try {
      await cacheService.set(cacheKey, newData, { ttl: this.config.ttl });
      logger.debug(`Updated cache for ${this.entityType}:${id}`);
    } catch (error) {
      logger.error(`Failed to update cache for ${this.entityType}:${id}:`, error);
    }
  }

  /**
   * Warm cache with frequently accessed data
   */
  async warmCache(idsToWarm: string[], fetchFunction: (ids: string[]) => Promise<T[]>): Promise<void> {
    if (!this.config.enableCache || idsToWarm.length === 0) return;

    try {
      const entities = await fetchFunction(idsToWarm);
      
      for (const entity of entities) {
        if (entity && typeof entity === 'object' && 'id' in entity) {
          const id = (entity as any).id;
          const cacheKey = this.generateKey(id);
          await cacheService.set(cacheKey, entity, { ttl: this.config.ttl });
        }
      }
      
      logger.info(`Warmed cache for ${entities.length} ${this.entityType} entities`);
    } catch (error) {
      logger.error(`Failed to warm cache for ${this.entityType}:`, error);
    }
  }

  /**
   * Get cache statistics for this entity type
   */
  async getCacheStats(): Promise<{
    entityType: string;
    config: CacheConfig;
    estimatedKeys: number;
  }> {
    return {
      entityType: this.entityType,
      config: this.config,
      estimatedKeys: 0 // TODO: Implement key counting when Redis available
    };
  }
}

/**
 * Pre-configured cached repositories for common entities
 */
export const cachedRepositories = {
  users: new CachedRepository('user'),
  forms: new CachedRepository('form'),
  submissions: new CachedRepository('submission'),
  comments: new CachedRepository('comment'), 
  locations: new CachedRepository('location'),
  sessions: new CachedRepository('session'),
  permissions: new CachedRepository('permission'),
  groups: new CachedRepository('group'),
};

/**
 * Factory function to create custom cached repository
 */
export function createCachedRepository<T>(
  entityType: string, 
  customConfig?: Partial<CacheConfig>
): CachedRepository<T> {
  return new CachedRepository<T>(entityType, customConfig);
}

export default CachedRepository;