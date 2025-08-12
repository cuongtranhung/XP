import Redis from 'ioredis';
import { logger } from '../utils/logger';
import LOCATION_CONFIG from '../config/locationConfig';
import memoryCache from './memoryCache';

// Cache key constants
export const CACHE_KEYS = {
  USER_PREFERENCES: (userId: number) => `location:prefs:${userId}`,
  USER_SESSIONS: (userId: number) => `location:sessions:${userId}`,
  LOCATION_HISTORY: (userId: number, hash: string) => `location:history:${userId}:${hash}`,
  RECENT_LOCATIONS: (userId: number) => `location:recent:${userId}`,
  SESSION_DATA: (sessionId: string) => `location:session:${sessionId}`,
  USER_STATS: (userId: number) => `location:stats:${userId}`
} as const;

// Cache TTL constants (from config)
const TTL = LOCATION_CONFIG.CACHE;

interface CacheOptions {
  ttl?: number;
  serialize?: boolean;
}

class CacheService {
  private redis: Redis | null = null;
  private isEnabled: boolean = false;
  private useMemoryCache: boolean = false;
  private connectionAttempts: number = 0;
  private maxConnectionAttempts: number = 3;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Check if Redis is enabled via environment variable
    if (process.env.REDIS_ENABLED !== 'true' || process.env.ENABLE_CACHE !== 'true') {
      logger.info('Redis cache disabled by configuration');
      this.isEnabled = false;
      this.redis = null;
      return;
    }

    // Try to connect to Redis
    try {
      logger.info('Attempting to connect to Redis cache...');
      
      this.redis = new Redis({
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB ?? '0'),
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > 3) {
            logger.warn('Max Redis connection attempts reached');
            return null;
          }
          const delay = Math.min(times * 200, 2000);
          logger.info(`Retrying Redis connection in ${delay}ms...`);
          return delay;
        },
        lazyConnect: false,
        keyPrefix: 'xp:',
        connectTimeout: 5000,
        commandTimeout: 2000,
        enableReadyCheck: true,
        enableOfflineQueue: true
      });

      // Set up event handlers
      this.redis.on('connect', () => {
        logger.info('Redis cache connected successfully');
        this.isEnabled = true;
        this.connectionAttempts = 0;
      });

      this.redis.on('error', (error) => {
        logger.error('Redis cache connection error', { error: error.message });
        this.connectionAttempts++;
        
        if (this.connectionAttempts >= this.maxConnectionAttempts) {
          logger.warn('Max Redis connection attempts reached, operating without cache');
          this.isEnabled = false;
        }
      });

      this.redis.on('close', () => {
        logger.warn('Redis cache connection closed');
        this.isEnabled = false;
      });

      this.redis.on('reconnecting', () => {
        logger.info('Attempting to reconnect to Redis cache');
      });

      // Test connection
      await this.redis.ping();
      this.isEnabled = true;
      logger.info('Redis cache initialized and ready');

    } catch (error) {
      logger.warn('Redis not available, falling back to memory cache', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        host: process.env.REDIS_HOST ?? 'localhost',
        port: process.env.REDIS_PORT ?? '6379'
      });
      
      // Fall back to memory cache
      this.isEnabled = true;
      this.useMemoryCache = true;
      this.redis = null;
      logger.info('✅ Using in-memory cache as fallback');
    }
    return;

    // Original Redis code commented out
    /*
    // Only enable cache in production or when explicitly configured
    if (!TTL.ENABLE_CACHE && process.env.NODE_ENV !== 'production') {
      logger.info('Cache service disabled for development environment');
      return;
    }

    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB ?? '0'),
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keyPrefix: 'gps:',
        // Connection timeout settings
        connectTimeout: 10000,
        commandTimeout: 5000,
      });

      // Set up event handlers
      this.redis.on('connect', () => {
        logger.info('Redis cache connected successfully');
        this.isEnabled = true;
        this.connectionAttempts = 0;
      });

      this.redis.on('error', (error) => {
        logger.error('Redis cache connection error', { error: error.message });
        this.isEnabled = false;
        this.connectionAttempts++;
        
        if (this.connectionAttempts >= this.maxConnectionAttempts) {
          logger.warn('Max Redis connection attempts reached, operating without cache');
        }
      });

      this.redis.on('close', () => {
        logger.warn('Redis cache connection closed');
        this.isEnabled = false;
      });

      this.redis.on('reconnecting', () => {
        logger.info('Attempting to reconnect to Redis cache');
      });

      // Test connection
      await this.redis.connect();
      await this.redis.ping();

    } catch (error) {
      logger.error('Failed to initialize cache service', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      this.isEnabled = false;
    }
    */
  }

  // Generic cache operations
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    if (!this.isEnabled) {
      return null;
    }

    // Use memory cache if Redis not available
    if (this.useMemoryCache) {
      return memoryCache.get<T>(key);
    }

    if (!this.redis) {
      return null;
    }

    try {
      const value = await this.redis.get(key);
      if (!value) {
        return null;
      }

      if (options.serialize !== false) {
        return JSON.parse(value) as T;
      }

      return value as T;
    } catch (error) {
      logger.error('Cache get operation failed', { 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  async set(key: string, value: any, options: CacheOptions = {}): Promise<boolean> {
    if (!this.isEnabled) {
      return false;
    }

    // Use memory cache if Redis not available
    if (this.useMemoryCache) {
      const serializedValue = options.serialize !== false ? JSON.stringify(value) : value;
      return memoryCache.set(key, serializedValue, options);
    }

    if (!this.redis) {
      return false;
    }

    try {
      const ttl = options.ttl || TTL.PREFERENCES_TTL;
      const serializedValue = options.serialize !== false ? JSON.stringify(value) : value;
      
      await this.redis.setex(key, ttl, serializedValue);
      return true;
    } catch (error) {
      logger.error('Cache set operation failed', { 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async del(key: string | string[]): Promise<boolean> {
    if (!this.isEnabled) {
      return false;
    }

    // Use memory cache if Redis not available
    if (this.useMemoryCache) {
      return memoryCache.del(key);
    }

    if (!this.redis) {
      return false;
    }

    try {
      const keys = Array.isArray(key) ? key : [key];
      await this.redis.del(...keys);
      return true;
    } catch (error) {
      logger.error('Cache delete operation failed', { 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isEnabled) {
      return false;
    }

    // Use memory cache if Redis not available
    if (this.useMemoryCache) {
      return memoryCache.exists(key);
    }

    if (!this.redis) {
      return false;
    }

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists operation failed', { 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  // Location-specific cache operations
  async cacheUserPreferences(userId: number, preferences: any): Promise<void> {
    const key = CACHE_KEYS.USER_PREFERENCES(userId);
    await this.set(key, preferences, { ttl: TTL.PREFERENCES_TTL });
    
    logger.debug('Cached user location preferences', { userId, key });
  }

  async getCachedUserPreferences(userId: number): Promise<any | null> {
    const key = CACHE_KEYS.USER_PREFERENCES(userId);
    const preferences = await this.get(key);
    
    if (preferences) {
      logger.debug('Retrieved cached user preferences', { userId, key });
    }
    
    return preferences;
  }

  async invalidateUserPreferences(userId: number): Promise<void> {
    const key = CACHE_KEYS.USER_PREFERENCES(userId);
    await this.del(key);
    
    logger.debug('Invalidated user preferences cache', { userId, key });
  }

  async cacheLocationHistory(userId: number, queryHash: string, history: any[]): Promise<void> {
    const key = CACHE_KEYS.LOCATION_HISTORY(userId, queryHash);
    await this.set(key, history, { ttl: TTL.HISTORY_TTL });
    
    logger.debug('Cached location history', { userId, queryHash, recordCount: history.length });
  }

  async getCachedLocationHistory(userId: number, queryHash: string): Promise<any[] | null> {
    const key = CACHE_KEYS.LOCATION_HISTORY(userId, queryHash);
    const history = await this.get<any[]>(key);
    
    if (history) {
      logger.debug('Retrieved cached location history', { userId, queryHash, recordCount: history.length });
    }
    
    return history;
  }

  async cacheUserSessions(userId: number, sessions: any[]): Promise<void> {
    const key = CACHE_KEYS.USER_SESSIONS(userId);
    await this.set(key, sessions, { ttl: TTL.SESSION_TTL });
    
    logger.debug('Cached user tracking sessions', { userId, sessionCount: sessions.length });
  }

  async getCachedUserSessions(userId: number): Promise<any[] | null> {
    const key = CACHE_KEYS.USER_SESSIONS(userId);
    const sessions = await this.get<any[]>(key);
    
    if (sessions) {
      logger.debug('Retrieved cached user sessions', { userId, sessionCount: sessions.length });
    }
    
    return sessions;
  }

  async cacheRecentLocations(userId: number, locations: any[]): Promise<void> {
    const key = CACHE_KEYS.RECENT_LOCATIONS(userId);
    await this.set(key, locations, { ttl: TTL.HISTORY_TTL });
    
    logger.debug('Cached recent locations', { userId, locationCount: locations.length });
  }

  async getCachedRecentLocations(userId: number): Promise<any[] | null> {
    const key = CACHE_KEYS.RECENT_LOCATIONS(userId);
    return await this.get<any[]>(key);
  }

  async cacheSessionData(sessionId: string, sessionData: any): Promise<void> {
    const key = CACHE_KEYS.SESSION_DATA(sessionId);
    await this.set(key, sessionData, { ttl: TTL.SESSION_TTL });
    
    logger.debug('Cached session data', { sessionId });
  }

  async getCachedSessionData(sessionId: string): Promise<any | null> {
    const key = CACHE_KEYS.SESSION_DATA(sessionId);
    return await this.get(key);
  }

  async invalidateSessionData(sessionId: string): Promise<void> {
    const key = CACHE_KEYS.SESSION_DATA(sessionId);
    await this.del(key);
    
    logger.debug('Invalidated session data cache', { sessionId });
  }

  // Utility methods
  async generateQueryHash(query: any): Promise<string> {
    // Create a hash of query parameters for cache key uniqueness
    const queryString = JSON.stringify(query);
    const crypto = await import('crypto');
    return crypto.createHash('md5').update(queryString).digest('hex');
  }

  async invalidateUserCache(userId: number): Promise<void> {
    // Invalidate all cache entries for a user
    const keys = [
      CACHE_KEYS.USER_PREFERENCES(userId),
      CACHE_KEYS.USER_SESSIONS(userId),
      CACHE_KEYS.RECENT_LOCATIONS(userId),
      CACHE_KEYS.USER_STATS(userId)
    ];

    // Also find and invalidate location history cache entries
    if (this.redis) {
      try {
        const historyKeys = await this.redis.keys(`gps:${CACHE_KEYS.LOCATION_HISTORY(userId, '*')}`);
        keys.push(...historyKeys.map(key => key.replace('gps:', '')));
      } catch (error) {
        logger.error('Failed to find history cache keys for invalidation', { 
          userId, 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    await this.del(keys);
    logger.info('Invalidated all cache entries for user', { userId, keyCount: keys.length });
  }

  // Cache statistics and monitoring
  async getCacheStats(): Promise<{
    isEnabled: boolean;
    connected: boolean;
    hitRate?: number;
    keyCount?: number;
    memoryUsed?: string;
    type?: string;
  }> {
    // Use memory cache stats if Redis not available
    if (this.useMemoryCache) {
      return memoryCache.getCacheStats();
    }

    const stats = {
      isEnabled: this.isEnabled,
      connected: this.isEnabled && this.redis !== null,
      type: this.useMemoryCache ? 'memory' : 'redis'
    };

    if (!this.isEnabled || !this.redis) {
      return stats;
    }

    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      
      // Parse memory usage
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      if (memoryMatch) {
        Object.assign(stats, { memoryUsed: memoryMatch[1].trim() });
      }

      // Parse key count
      const keyspaceMatch = keyspace.match(/keys=(\d+)/);
      if (keyspaceMatch) {
        Object.assign(stats, { keyCount: parseInt(keyspaceMatch[1]) });
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get cache statistics', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return stats;
    }
  }

  // Cache warming (pre-populate frequently accessed data)
  async warmUserCache(userId: number): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    logger.info('Warming cache for user', { userId });

    try {
      // This would typically be called after user login
      // Implementation depends on your specific data access patterns
      // For now, we'll just log the intent
      logger.debug('Cache warming would pre-populate user preferences and recent data', { userId });
    } catch (error) {
      logger.error('Cache warming failed', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Cleanup and maintenance
  async cleanup(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.quit();
        logger.info('Cache service connection closed gracefully');
      } catch (error) {
        logger.error('Error closing cache service connection', { 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // Health check
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string; type?: string }> {
    // Use memory cache health check if Redis not available
    if (this.useMemoryCache) {
      const result = await memoryCache.healthCheck();
      return { ...result, type: 'memory' };
    }

    if (!this.isEnabled || !this.redis) {
      return { 
        healthy: false, 
        error: 'Cache service not enabled or not connected',
        type: 'none'
      };
    }

    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;

      return { healthy: true, latency, type: 'redis' };
    } catch (error) {
      return { 
        healthy: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'redis'
      };
    }
  }
}

// Export singleton instance
export default new CacheService();