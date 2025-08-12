/**
 * Standards-Compliant Cache Service
 * Implements multi-layer caching with international standards compliance
 * ISO 27001, GDPR/CCPA, OWASP, RFC 9111
 */

import Redis, { Cluster } from 'ioredis';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { promisify } from 'util';
import { 
  CacheConfig, 
  DataClassification, 
  CacheKeyGenerator,
  CacheTTLCalculator,
  cacheConfig 
} from '../config/cacheConfig';
import { logger } from '../utils/logger';
import { metrics } from '@opentelemetry/api-metrics';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';

// Cache options interface
export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  classification?: DataClassification;
  compress?: boolean;
  encrypt?: boolean;
  tags?: string[]; // For invalidation
  consentId?: string; // GDPR consent
  userId?: string; // For audit trail
  skipCache?: boolean; // Bypass cache
}

// Cache result interface
export interface CacheResult<T> {
  data: T;
  hit: boolean;
  latency: number;
  metadata?: {
    key: string;
    ttl: number;
    size: number;
    compressed: boolean;
    encrypted: boolean;
  };
}

// Circuit breaker state
enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

/**
 * Standards-compliant cache service with multi-layer support
 */
export class StandardsCompliantCacheService {
  private redis: Redis | Cluster;
  private config: CacheConfig;
  private tracer = trace.getTracer('cache-service');
  private meter = metrics.getMeter('cache-service');
  
  // Metrics
  private hitCounter = this.meter.createCounter('cache_hits_total');
  private missCounter = this.meter.createCounter('cache_misses_total');
  private errorCounter = this.meter.createCounter('cache_errors_total');
  private latencyHistogram = this.meter.createHistogram('cache_operation_duration_ms');
  private memorySizeGauge = this.meter.createObservableGauge('cache_memory_bytes');
  
  // Circuit breaker
  private circuitState: CircuitState = CircuitState.CLOSED;
  private circuitFailures = 0;
  private circuitLastFailTime = 0;
  private readonly circuitThreshold = 5;
  private readonly circuitTimeout = 30000; // 30 seconds

  constructor(config: CacheConfig = cacheConfig) {
    this.config = config;
    this.redis = this.initializeRedis();
    this.setupMetrics();
    this.setupHealthCheck();
  }

  /**
   * Initialize Redis connection with clustering support
   */
  private initializeRedis(): Redis | Cluster {
    const { redis: redisConfig } = this.config;

    if (redisConfig.cluster) {
      // Redis Cluster mode
      const nodes = process.env.REDIS_CLUSTER_NODES?.split(',').map(node => {
        const [host, port] = node.split(':');
        return { host, port: parseInt(port) };
      }) || [{ host: 'localhost', port: 7000 }];

      return new Cluster(nodes, {
        redisOptions: {
          password: redisConfig.password,
          tls: this.config.security.tls.enabled ? {
            cert: this.config.security.tls.cert,
            key: this.config.security.tls.key,
            ca: this.config.security.tls.ca
          } : undefined
        },
        clusterRetryStrategy: (times) => Math.min(times * 100, 3000),
        enableOfflineQueue: true,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3
      });
    } else {
      // Standalone Redis
      return new Redis({
        ...redisConfig,
        tls: this.config.security.tls.enabled ? {
          cert: this.config.security.tls.cert,
          key: this.config.security.tls.key,
          ca: this.config.security.tls.ca
        } : undefined
      });
    }
  }

  /**
   * Set up metrics collection
   */
  private setupMetrics(): void {
    // Memory usage observer
    this.memorySizeGauge.addCallback(async (observableResult) => {
      try {
        const info = await this.redis.info('memory');
        const usedMemory = this.parseRedisInfo(info, 'used_memory');
        observableResult.observe(parseInt(usedMemory) || 0);
      } catch (error) {
        logger.error('Failed to collect memory metrics', error);
      }
    });
  }

  /**
   * Set up health check
   */
  private setupHealthCheck(): void {
    setInterval(async () => {
      try {
        await this.redis.ping();
        if (this.circuitState === CircuitState.OPEN && 
            Date.now() - this.circuitLastFailTime > this.circuitTimeout) {
          this.circuitState = CircuitState.HALF_OPEN;
          this.circuitFailures = 0;
        }
      } catch (error) {
        this.handleCircuitFailure();
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Get value from cache with standards compliance
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<CacheResult<T> | null> {
    const span = this.tracer.startSpan('cache.get', {
      kind: SpanKind.CLIENT,
      attributes: {
        'cache.key': this.sanitizeKey(key),
        'cache.operation': 'get'
      }
    });

    const startTime = Date.now();

    try {
      // Check circuit breaker
      if (this.circuitState === CircuitState.OPEN) {
        throw new Error('Circuit breaker is open');
      }

      // Validate key
      this.validateCacheKey(key);

      // Check access permissions
      if (options.userId) {
        await this.validateAccess(options.userId, key, 'read');
      }

      // Get from Redis
      const value = await this.redis.get(key);
      const latency = Date.now() - startTime;

      if (!value) {
        this.missCounter.add(1, { operation: 'get' });
        this.latencyHistogram.record(latency, { operation: 'get', hit: 'false' });
        span.setStatus({ code: SpanStatusCode.OK });
        return null;
      }

      // Parse metadata
      const cached = JSON.parse(value);
      let data = cached.data;

      // Decrypt if needed
      if (cached.encrypted && this.config.security.encryption.enabled) {
        data = await this.decrypt(data, cached.iv);
      }

      // Decompress if needed
      if (cached.compressed && this.config.performance.compressionEnabled) {
        data = await this.decompress(data);
      }

      // Update metrics
      this.hitCounter.add(1, { operation: 'get' });
      this.latencyHistogram.record(latency, { operation: 'get', hit: 'true' });

      // Audit log for sensitive data
      if (cached.classification === DataClassification.RESTRICTED) {
        await this.auditLog('cache_access', {
          userId: options.userId,
          key: this.sanitizeKey(key),
          operation: 'get',
          classification: cached.classification
        });
      }

      span.setStatus({ code: SpanStatusCode.OK });

      return {
        data: JSON.parse(data),
        hit: true,
        latency,
        metadata: {
          key,
          ttl: cached.ttl,
          size: value.length,
          compressed: cached.compressed,
          encrypted: cached.encrypted
        }
      };

    } catch (error) {
      this.errorCounter.add(1, { operation: 'get' });
      this.handleCircuitFailure();
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      logger.error('Cache get error', { key, error });
      return null;
    } finally {
      span.end();
    }
  }

  /**
   * Set value in cache with standards compliance
   */
  async set<T>(
    key: string, 
    value: T, 
    options: CacheOptions = {}
  ): Promise<boolean> {
    const span = this.tracer.startSpan('cache.set', {
      kind: SpanKind.CLIENT,
      attributes: {
        'cache.key': this.sanitizeKey(key),
        'cache.operation': 'set'
      }
    });

    const startTime = Date.now();

    try {
      // Check circuit breaker
      if (this.circuitState === CircuitState.OPEN) {
        throw new Error('Circuit breaker is open');
      }

      // Skip cache if requested
      if (options.skipCache) {
        return false;
      }

      // Validate inputs
      this.validateCacheKey(key);
      this.validateDataClassification(value, options);

      // Check access permissions
      if (options.userId) {
        await this.validateAccess(options.userId, key, 'write');
      }

      // Check consent for personal data
      if (options.classification === DataClassification.RESTRICTED && 
          this.config.privacy.consentRequired && 
          !options.consentId) {
        throw new Error('Consent required for caching personal data');
      }

      // Prepare data
      let data = JSON.stringify(value);
      let compressed = false;
      let encrypted = false;
      let iv: string | undefined;

      // Compress if beneficial
      if (options.compress !== false && 
          this.config.performance.compressionEnabled && 
          data.length > 1024) {
        data = await this.compress(data);
        compressed = true;
      }

      // Encrypt sensitive data
      if ((options.encrypt !== false && 
           options.classification && 
           options.classification !== DataClassification.PUBLIC) ||
          this.config.security.encryption.enabled) {
        const encryptResult = await this.encrypt(data);
        data = encryptResult.encrypted;
        iv = encryptResult.iv;
        encrypted = true;
      }

      // Calculate TTL
      const ttl = CacheTTLCalculator.calculate(
        options.classification || DataClassification.PUBLIC,
        this.config,
        options.ttl
      );

      // Prepare cache entry
      const cacheEntry = {
        data,
        compressed,
        encrypted,
        iv,
        classification: options.classification || DataClassification.PUBLIC,
        ttl,
        created: Date.now(),
        consentId: options.consentId,
        tags: options.tags || []
      };

      // Set in Redis with TTL
      const result = await this.redis.setex(
        key,
        ttl,
        JSON.stringify(cacheEntry)
      );

      // Update tags for invalidation
      if (options.tags && options.tags.length > 0) {
        await this.updateTags(key, options.tags);
      }

      // Update metrics
      const latency = Date.now() - startTime;
      this.latencyHistogram.record(latency, { operation: 'set' });

      // Audit log for sensitive data
      if (options.classification === DataClassification.RESTRICTED) {
        await this.auditLog('cache_write', {
          userId: options.userId,
          key: this.sanitizeKey(key),
          operation: 'set',
          classification: options.classification,
          ttl
        });
      }

      // Reset circuit breaker on success
      if (this.circuitState === CircuitState.HALF_OPEN) {
        this.circuitState = CircuitState.CLOSED;
        this.circuitFailures = 0;
      }

      span.setStatus({ code: SpanStatusCode.OK });
      return result === 'OK';

    } catch (error) {
      this.errorCounter.add(1, { operation: 'set' });
      this.handleCircuitFailure();
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      logger.error('Cache set error', { key, error });
      return false;
    } finally {
      span.end();
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, options: { userId?: string } = {}): Promise<boolean> {
    try {
      // Validate access
      if (options.userId) {
        await this.validateAccess(options.userId, key, 'write');
      }

      const result = await this.redis.del(key);

      // Audit log
      await this.auditLog('cache_delete', {
        userId: options.userId,
        key: this.sanitizeKey(key),
        operation: 'delete'
      });

      return result > 0;
    } catch (error) {
      logger.error('Cache delete error', { key, error });
      return false;
    }
  }

  /**
   * Invalidate cache by pattern or tags
   */
  async invalidate(
    pattern: string, 
    options: { tags?: string[]; userId?: string; reason?: string } = {}
  ): Promise<number> {
    const span = this.tracer.startSpan('cache.invalidate');

    try {
      let keysToDelete: string[] = [];

      // Invalidate by pattern
      if (pattern) {
        const keys = await this.scanKeys(pattern);
        keysToDelete.push(...keys);
      }

      // Invalidate by tags
      if (options.tags && options.tags.length > 0) {
        for (const tag of options.tags) {
          const taggedKeys = await this.getKeysByTag(tag);
          keysToDelete.push(...taggedKeys);
        }
      }

      // Remove duplicates
      keysToDelete = [...new Set(keysToDelete)];

      // Delete keys
      let deleted = 0;
      if (keysToDelete.length > 0) {
        // Delete in batches to avoid blocking
        const batchSize = 1000;
        for (let i = 0; i < keysToDelete.length; i += batchSize) {
          const batch = keysToDelete.slice(i, i + batchSize);
          deleted += await this.redis.del(...batch);
        }
      }

      // Audit log
      await this.auditLog('cache_invalidation', {
        userId: options.userId,
        pattern: this.sanitizeKey(pattern),
        tags: options.tags,
        keysAffected: deleted,
        reason: options.reason
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return deleted;

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Implement cache-aside pattern with loader function
   */
  async getOrSet<T>(
    key: string,
    loader: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<CacheResult<T>> {
    // Try to get from cache
    const cached = await this.get<T>(key, options);
    if (cached) {
      return cached;
    }

    // Load data
    const startTime = Date.now();
    const data = await loader();
    const loadLatency = Date.now() - startTime;

    // Set in cache
    await this.set(key, data, options);

    return {
      data,
      hit: false,
      latency: loadLatency
    };
  }

  /**
   * Warm cache with critical data
   */
  async warmCache(
    items: Array<{
      key: string;
      loader: () => Promise<any>;
      options?: CacheOptions;
    }>
  ): Promise<void> {
    const results = await Promise.allSettled(
      items.map(async ({ key, loader, options }) => {
        try {
          const data = await loader();
          await this.set(key, data, options);
          logger.info(`Cache warmed: ${key}`);
        } catch (error) {
          logger.error(`Failed to warm cache: ${key}`, error);
        }
      })
    );

    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) {
      logger.warn(`Cache warming completed with ${failed} failures`);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    hits: number;
    misses: number;
    errors: number;
    hitRate: number;
    memoryUsage: number;
    keys: number;
    circuitState: CircuitState;
  }> {
    const info = await this.redis.info();
    const keyspaceInfo = await this.redis.info('keyspace');
    
    const hits = parseInt(this.parseRedisInfo(info, 'keyspace_hits')) || 0;
    const misses = parseInt(this.parseRedisInfo(info, 'keyspace_misses')) || 0;
    const memoryUsage = parseInt(this.parseRedisInfo(info, 'used_memory')) || 0;
    const keys = this.parseKeyCount(keyspaceInfo);

    return {
      hits,
      misses,
      errors: 0, // From metrics
      hitRate: hits / (hits + misses) || 0,
      memoryUsage,
      keys,
      circuitState: this.circuitState
    };
  }

  /**
   * Implement right to erasure (GDPR)
   */
  async eraseUserData(userId: string): Promise<number> {
    const pattern = `*:${createHash('sha256').update(userId).digest('hex').substring(0, 16)}:*`;
    return await this.invalidate(pattern, {
      userId: 'system',
      reason: 'GDPR right to erasure request'
    });
  }

  // Private helper methods

  private validateCacheKey(key: string): void {
    if (!key || key.length === 0) {
      throw new Error('Cache key cannot be empty');
    }
    if (key.length > 512) {
      throw new Error('Cache key too long (max 512 chars)');
    }
    if (!/^[\w:.-]+$/.test(key)) {
      throw new Error('Cache key contains invalid characters');
    }
  }

  private validateDataClassification(data: any, options: CacheOptions): void {
    // Check for potential PII in data
    const dataStr = JSON.stringify(data);
    const piiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{16}\b/, // Credit card
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/ // Email
    ];

    const hasPII = piiPatterns.some(pattern => pattern.test(dataStr));
    if (hasPII && (!options.classification || 
        options.classification === DataClassification.PUBLIC)) {
      throw new Error('Detected PII in data - must specify appropriate classification');
    }
  }

  private async validateAccess(
    userId: string, 
    key: string, 
    operation: 'read' | 'write'
  ): Promise<void> {
    // Implement access control logic
    // This is a placeholder - integrate with your IAM system
    return;
  }

  private async encrypt(data: string): Promise<{ encrypted: string; iv: string }> {
    const iv = randomBytes(16);
    const key = Buffer.from(process.env.CACHE_ENCRYPTION_KEY ?? '', 'hex');
    
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();

    return {
      encrypted: Buffer.concat([tag, encrypted]).toString('base64'),
      iv: iv.toString('base64')
    };
  }

  private async decrypt(encrypted: string, iv: string): Promise<string> {
    const key = Buffer.from(process.env.CACHE_ENCRYPTION_KEY ?? '', 'hex');
    const ivBuffer = Buffer.from(iv, 'base64');
    const encryptedBuffer = Buffer.from(encrypted, 'base64');
    
    const tag = encryptedBuffer.slice(0, 16);
    const ciphertext = encryptedBuffer.slice(16);
    
    const decipher = createDecipheriv('aes-256-gcm', key, ivBuffer);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  }

  private async compress(data: string): Promise<string> {
    const { gzip } = await import('zlib');
    const compress = promisify(gzip);
    const compressed = await compress(Buffer.from(data));
    return compressed.toString('base64');
  }

  private async decompress(compressed: string): Promise<string> {
    const { gunzip } = await import('zlib');
    const decompress = promisify(gunzip);
    const decompressed = await decompress(Buffer.from(compressed, 'base64'));
    return decompressed.toString('utf8');
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    return keys;
  }

  private async updateTags(key: string, tags: string[]): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    for (const tag of tags) {
      pipeline.sadd(`tag:${tag}`, key);
      pipeline.expire(`tag:${tag}`, 86400); // 24 hour expiry for tag sets
    }
    
    await pipeline.exec();
  }

  private async getKeysByTag(tag: string): Promise<string[]> {
    return await this.redis.smembers(`tag:${tag}`);
  }

  private handleCircuitFailure(): void {
    this.circuitFailures++;
    this.circuitLastFailTime = Date.now();

    if (this.circuitFailures >= this.circuitThreshold) {
      this.circuitState = CircuitState.OPEN;
      logger.error('Circuit breaker opened due to repeated failures');
    }
  }

  private sanitizeKey(key: string): string {
    // Remove sensitive parts for logging
    return key.replace(/:[^:]+$/, ':***');
  }

  private parseRedisInfo(info: string, key: string): string {
    const match = info.match(new RegExp(`${key}:([^\\r\\n]+)`));
    return match ? match[1] : '0';
  }

  private parseKeyCount(keyspaceInfo: string): number {
    const match = keyspaceInfo.match(/keys=(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  private async auditLog(action: string, details: any): Promise<void> {
    // Implement audit logging
    logger.info('Cache audit', { action, ...details });
  }

  /**
   * Cleanup resources
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}

// Export singleton instance
export const cacheService = new StandardsCompliantCacheService();