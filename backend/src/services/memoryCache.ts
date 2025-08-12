import { logger } from '../utils/logger';

interface CacheEntry {
  value: any;
  expires: number;
}

/**
 * In-Memory Cache Service
 * Fallback cache implementation when Redis is not available
 * Provides Redis-like API for development and testing
 */
class MemoryCache {
  private cache: Map<string, CacheEntry> = new Map();
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0
  };

  constructor() {
    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
    logger.info('📦 In-memory cache initialized (Redis fallback)');
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (entry.expires > 0 && entry.expires < Date.now()) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.value as T;
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, options: { ttl?: number } = {}): Promise<boolean> {
    const ttl = options.ttl || 300; // Default 5 minutes
    const expires = ttl > 0 ? Date.now() + (ttl * 1000) : 0;

    this.cache.set(key, { value, expires });
    this.stats.sets++;
    
    // Limit cache size to prevent memory issues
    if (this.cache.size > 10000) {
      this.evictOldest();
    }

    return true;
  }

  /**
   * Set with expiration (Redis SETEX compatible)
   */
  async setex(key: string, ttl: number, value: any): Promise<boolean> {
    return this.set(key, value, { ttl });
  }

  /**
   * Delete from cache
   */
  async del(keys: string | string[]): Promise<boolean> {
    const keysArray = Array.isArray(keys) ? keys : [keys];
    
    for (const key of keysArray) {
      this.cache.delete(key);
      this.stats.deletes++;
    }

    return true;
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check expiration
    if (entry.expires > 0 && entry.expires < Date.now()) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Ping (Redis compatible)
   */
  async ping(): Promise<string> {
    return 'PONG';
  }

  /**
   * Get all keys matching pattern
   */
  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    const matchingKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      // Skip expired entries
      if (entry.expires > 0 && entry.expires < Date.now()) {
        continue;
      }

      if (regex.test(key)) {
        matchingKeys.push(key);
      }
    }

    return matchingKeys;
  }

  /**
   * Get cache info (Redis INFO compatible)
   */
  async info(section?: string): Promise<string> {
    const info = [
      '# Memory Cache Stats',
      `cache_entries:${this.cache.size}`,
      `cache_hits:${this.stats.hits}`,
      `cache_misses:${this.stats.misses}`,
      `cache_sets:${this.stats.sets}`,
      `cache_deletes:${this.stats.deletes}`,
      `hit_rate:${this.getHitRate()}%`,
      `memory_used:${this.getMemoryUsage()}`,
      'redis_emulation:true'
    ];

    return info.join('\n');
  }

  /**
   * Clear all cache
   */
  async flushall(): Promise<boolean> {
    this.cache.clear();
    logger.info('Memory cache flushed');
    return true;
  }

  /**
   * Get TTL for key
   */
  async ttl(key: string): Promise<number> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return -2; // Key doesn't exist
    }

    if (entry.expires === 0) {
      return -1; // No expiration
    }

    const ttl = Math.floor((entry.expires - Date.now()) / 1000);
    return ttl > 0 ? ttl : -2;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): any {
    return {
      isEnabled: true,
      connected: true,
      type: 'memory',
      entries: this.cache.size,
      ...this.stats,
      hitRate: this.getHitRate(),
      memoryUsed: this.getMemoryUsage()
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    const start = Date.now();
    await this.ping();
    const latency = Date.now() - start;

    return {
      healthy: true,
      latency
    };
  }

  /**
   * Disconnect (no-op for memory cache)
   */
  disconnect(): void {
    logger.info('Memory cache disconnected');
  }

  /**
   * Quit (no-op for memory cache)
   */
  async quit(): Promise<void> {
    logger.info('Memory cache quit');
  }

  /**
   * Private helper methods
   */

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires > 0 && entry.expires < now) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned ${cleaned} expired cache entries`);
    }
  }

  private evictOldest(): void {
    // Simple LRU: Remove first 10% of entries
    const toRemove = Math.floor(this.cache.size * 0.1);
    const keys = Array.from(this.cache.keys()).slice(0, toRemove);
    
    for (const key of keys) {
      this.cache.delete(key);
    }

    logger.debug(`Evicted ${toRemove} cache entries`);
  }

  private getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    if (total === 0) return 0;
    return Math.round((this.stats.hits / total) * 100);
  }

  private getMemoryUsage(): string {
    // Rough estimation of memory usage
    const size = this.cache.size;
    const avgEntrySize = 1024; // Assume 1KB average per entry
    const totalBytes = size * avgEntrySize;

    if (totalBytes < 1024) return `${totalBytes}B`;
    if (totalBytes < 1024 * 1024) return `${(totalBytes / 1024).toFixed(2)}KB`;
    return `${(totalBytes / (1024 * 1024)).toFixed(2)}MB`;
  }
}

// Export singleton instance
export default new MemoryCache();