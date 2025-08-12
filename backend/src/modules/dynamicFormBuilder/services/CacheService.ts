/**
 * Cache Service for Dynamic Form Builder
 * Provides caching functionality using Redis
 */

import Redis from 'ioredis';
import { logger } from '../../../utils/logger';

interface CacheOptions {
  ttl: number; // Time to live in seconds
  maxSize?: number; // Maximum number of cached items
}

export class CacheService {
  private redis: Redis;
  private options: CacheOptions;
  private keyPrefix = 'formbuilder:';

  constructor(redis: Redis, options: CacheOptions) {
    this.redis = redis;
    this.options = options;
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.keyPrefix + key;
      const value = await this.redis.get(fullKey);
      
      if (!value) {
        return null;
      }
      
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache get error:', error as Record<string, any>);
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const fullKey = this.keyPrefix + key;
      const serialized = JSON.stringify(value);
      const expiry = ttl || this.options.ttl;
      
      await this.redis.setex(fullKey, expiry, serialized);
    } catch (error) {
      logger.error('Cache set error:', error as Record<string, any>);
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      const fullKey = this.keyPrefix + key;
      await this.redis.del(fullKey);
    } catch (error) {
      logger.error('Cache delete error:', error as Record<string, any>);
    }
  }

  /**
   * Delete multiple values by pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      const fullPattern = this.keyPrefix + pattern;
      const keys = await this.redis.keys(fullPattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      logger.error('Cache delete pattern error:', error as Record<string, any>);
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const fullKey = this.keyPrefix + key;
      const exists = await this.redis.exists(fullKey);
      return exists === 1;
    } catch (error) {
      logger.error('Cache exists error:', error as Record<string, any>);
      return false;
    }
  }

  /**
   * Get multiple values
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const fullKeys = keys.map(k => this.keyPrefix + k);
      const values = await this.redis.mget(...fullKeys);
      
      return values.map(v => {
        if (!v) return null;
        try {
          return JSON.parse(v) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      logger.error('Cache mget error:', error as Record<string, any>);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple values
   */
  async mset<T>(items: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      
      for (const item of items) {
        const fullKey = this.keyPrefix + item.key;
        const serialized = JSON.stringify(item.value);
        const expiry = item.ttl || this.options.ttl;
        
        pipeline.setex(fullKey, expiry, serialized);
      }
      
      await pipeline.exec();
    } catch (error) {
      logger.error('Cache mset error:', error as Record<string, any>);
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      const keys = await this.redis.keys(this.keyPrefix + '*');
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      
      logger.info(`Cleared ${keys.length} cache entries`);
    } catch (error) {
      logger.error('Cache clear error:', error as Record<string, any>);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    size: number;
    memory: string;
    hits: number;
    misses: number;
  }> {
    try {
      const keys = await this.redis.keys(this.keyPrefix + '*');
      const info = await this.redis.info('stats');
      
      // Parse Redis info
      const stats = info.split('\n').reduce((acc, line) => {
        const [key, value] = line.split(':');
        if (key) acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
      
      return {
        size: keys.length,
        memory: stats.used_memory_human || '0',
        hits: parseInt(stats.keyspace_hits || '0'),
        misses: parseInt(stats.keyspace_misses || '0'),
      };
    } catch (error) {
      logger.error('Cache stats error:', error as Record<string, any>);
      return {
        size: 0,
        memory: '0',
        hits: 0,
        misses: 0,
      };
    }
  }

  /**
   * Implement cache-aside pattern
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    // Generate value
    const value = await factory();
    
    // Store in cache
    await this.set(key, value, ttl);
    
    return value;
  }

  /**
   * Invalidate cache for a form
   */
  async invalidateForm(formId: string): Promise<void> {
    const patterns = [
      `form:${formId}`,
      `form:${formId}:*`,
      `submissions:${formId}:*`,
      `analytics:${formId}:*`,
    ];
    
    for (const pattern of patterns) {
      await this.deletePattern(pattern);
    }
  }

  /**
   * Invalidate cache for a user
   */
  async invalidateUser(userId: string): Promise<void> {
    await this.deletePattern(`user:${userId}:*`);
  }
}