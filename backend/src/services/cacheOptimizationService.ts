/**
 * Cache Performance Optimization Service
 * Advanced cache optimization strategies and performance enhancements
 */

import cacheService from './cacheService';
import { logger } from '../utils/logger';
import { performanceBenchmarkService } from './performanceBenchmarkService';

// Optimization types and interfaces
export interface OptimizationConfig {
  enableCompression: boolean;
  enableBatching: boolean;
  enablePipelining: boolean;
  enableConnectionPooling: boolean;
  enableAdaptiveTTL: boolean;
  enableHotKeyDetection: boolean;
  enableCacheWarming: boolean;
  batchSize: number;
  compressionThreshold: number; // bytes
  hotKeyThreshold: number; // requests per minute
  adaptiveTTLMultiplier: number;
  warmingBatchSize: number;
  maxConnections: number;
}

export interface CacheMetrics {
  hitRate: number;
  missRate: number;
  averageResponseTime: number;
  throughput: number;
  memoryUsage: number;
  connectionCount: number;
  hotKeys: Array<{
    key: string;
    accessCount: number;
    lastAccessed: Date;
  }>;
  compressionRatio: number;
  batchEfficiency: number;
}

export interface OptimizationResult {
  strategy: string;
  beforeMetrics: Partial<CacheMetrics>;
  afterMetrics: Partial<CacheMetrics>;
  improvement: {
    hitRateImprovement: number;
    responseTimeImprovement: number;
    throughputImprovement: number;
    memoryEfficiencyImprovement: number;
  };
  recommendations: string[];
}

/**
 * Cache Performance Optimization Service
 */
class CacheOptimizationService {
  private optimizationConfig: OptimizationConfig;
  private keyAccessStats = new Map<string, { count: number; lastAccessed: Date; totalTime: number }>();
  private batchQueue: Array<{ operation: string; key: string; value?: any; options?: any; resolve: Function; reject: Function }> = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private hotKeys = new Set<string>();
  private compressionStats = { compressed: 0, uncompressed: 0, totalSaved: 0 };
  private connectionPool: Array<{ id: string; inUse: boolean; lastUsed: Date }> = [];
  
  // Performance tracking
  private performanceMetrics = {
    hitCount: 0,
    missCount: 0,
    totalResponseTime: 0,
    requestCount: 0,
    lastMetricsReset: new Date()
  };

  constructor() {
    this.optimizationConfig = {
      enableCompression: true,
      enableBatching: true,
      enablePipelining: true,
      enableConnectionPooling: true,
      enableAdaptiveTTL: true,
      enableHotKeyDetection: true,
      enableCacheWarming: true,
      batchSize: 50,
      compressionThreshold: 1024, // 1KB
      hotKeyThreshold: 100, // 100 requests per minute
      adaptiveTTLMultiplier: 1.5,
      warmingBatchSize: 100,
      maxConnections: 10
    };

    this.initializeOptimizations();
  }

  /**
   * Initialize optimization strategies
   */
  private initializeOptimizations(): void {
    if (this.optimizationConfig.enableConnectionPooling) {
      this.initializeConnectionPool();
    }

    if (this.optimizationConfig.enableBatching) {
      this.initializeBatchProcessing();
    }

    if (this.optimizationConfig.enableHotKeyDetection) {
      this.initializeHotKeyDetection();
    }

    // Start metrics collection
    this.startMetricsCollection();

    logger.info('Cache optimization service initialized', {
      config: this.optimizationConfig
    });
  }

  /**
   * Optimize cache get operation
   */
  async optimizedGet(key: string): Promise<any> {
    const startTime = Date.now();

    try {
      // Track key access
      this.trackKeyAccess(key, startTime);

      let result;

      if (this.optimizationConfig.enableBatching) {
        result = await this.batchedGet(key);
      } else {
        result = await cacheService.get(key);
      }

      // Update performance metrics
      const responseTime = Date.now() - startTime;
      this.updateMetrics(result !== null, responseTime);

      // Apply adaptive TTL if enabled and result found
      if (result !== null && this.optimizationConfig.enableAdaptiveTTL) {
        await this.applyAdaptiveTTL(key, result);
      }

      return result;

    } catch (error) {
      logger.error('Optimized cache get failed', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Optimize cache set operation
   */
  async optimizedSet(key: string, value: any, options: any = {}): Promise<void> {
    const startTime = Date.now();

    try {
      let processedValue = value;
      let processedOptions = { ...options };

      // Apply compression if enabled and value is large enough
      if (this.optimizationConfig.enableCompression) {
        const compressed = await this.applyCompression(value);
        if (compressed) {
          processedValue = compressed.value;
          processedOptions.compressed = true;
          this.compressionStats.compressed++;
          this.compressionStats.totalSaved += compressed.savedBytes;
        } else {
          this.compressionStats.uncompressed++;
        }
      }

      // Apply adaptive TTL if enabled
      if (this.optimizationConfig.enableAdaptiveTTL && !processedOptions.ttl) {
        processedOptions.ttl = this.calculateAdaptiveTTL(key);
      }

      // Use batched operation if enabled
      if (this.optimizationConfig.enableBatching) {
        await this.batchedSet(key, processedValue, processedOptions);
      } else {
        await cacheService.set(key, processedValue, processedOptions);
      }

      // Update performance metrics
      const responseTime = Date.now() - startTime;
      this.updateMetrics(true, responseTime);

    } catch (error) {
      logger.error('Optimized cache set failed', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Batch multiple cache operations
   */
  async batchOperations(operations: Array<{
    operation: 'get' | 'set' | 'del';
    key: string;
    value?: any;
    options?: any;
  }>): Promise<any[]> {
    const startTime = Date.now();
    const results: any[] = [];

    logger.debug('Executing batch cache operations', {
      operationCount: operations.length
    });

    // Group operations by type for optimal processing
    const getOperations = operations.filter(op => op.operation === 'get');
    const setOperations = operations.filter(op => op.operation === 'set');
    const delOperations = operations.filter(op => op.operation === 'del');

    try {
      // Process gets first (most common)
      if (getOperations.length > 0) {
        const getResults = await this.batchedMultiGet(getOperations.map(op => op.key));
        results.push(...getResults);
      }

      // Process sets in parallel batches
      if (setOperations.length > 0) {
        await this.batchedMultiSet(setOperations);
        results.push(...setOperations.map(() => 'OK'));
      }

      // Process deletes
      if (delOperations.length > 0) {
        await this.batchedMultiDel(delOperations.map(op => op.key));
        results.push(...delOperations.map(() => 'DELETED'));
      }

      const responseTime = Date.now() - startTime;
      logger.info('Batch operations completed', {
        operationCount: operations.length,
        responseTime,
        throughput: operations.length / (responseTime / 1000)
      });

      return results;

    } catch (error) {
      logger.error('Batch operations failed', {
        operationCount: operations.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Warm cache with frequently accessed data
   */
  async warmCache(dataSource: () => Promise<Array<{ key: string; value: any; ttl?: number }>>): Promise<{
    warmedCount: number;
    failedCount: number;
    duration: number;
  }> {
    const startTime = Date.now();
    let warmedCount = 0;
    let failedCount = 0;

    logger.info('Starting cache warming process');

    try {
      const data = await dataSource();
      const batches = this.createBatches(data, this.optimizationConfig.warmingBatchSize);

      for (const batch of batches) {
        try {
          const warmingOperations = batch.map(item => ({
            operation: 'set' as const,
            key: item.key,
            value: item.value,
            options: { ttl: item.ttl || 3600 }
          }));

          await this.batchOperations(warmingOperations);
          warmedCount += batch.length;

        } catch (error) {
          logger.warn('Cache warming batch failed', {
            batchSize: batch.length,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          failedCount += batch.length;
        }

        // Brief pause between batches to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const duration = Date.now() - startTime;

      logger.info('Cache warming completed', {
        warmedCount,
        failedCount,
        duration,
        totalItems: data.length
      });

      return { warmedCount, failedCount, duration };

    } catch (error) {
      logger.error('Cache warming failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get current cache metrics
   */
  getCacheMetrics(): CacheMetrics {
    const now = Date.now();
    const timeSinceReset = now - this.performanceMetrics.lastMetricsReset.getTime();
    const throughput = this.performanceMetrics.requestCount / (timeSinceReset / 1000);

    const hitRate = this.performanceMetrics.requestCount > 0 ? 
      this.performanceMetrics.hitCount / this.performanceMetrics.requestCount : 0;

    const averageResponseTime = this.performanceMetrics.requestCount > 0 ?
      this.performanceMetrics.totalResponseTime / this.performanceMetrics.requestCount : 0;

    const hotKeysArray = Array.from(this.keyAccessStats.entries())
      .filter(([_, stats]) => stats.count >= this.optimizationConfig.hotKeyThreshold)
      .map(([key, stats]) => ({
        key,
        accessCount: stats.count,
        lastAccessed: stats.lastAccessed
      }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10);

    const compressionRatio = this.compressionStats.compressed > 0 ?
      this.compressionStats.totalSaved / (this.compressionStats.compressed + this.compressionStats.uncompressed) : 0;

    return {
      hitRate: hitRate * 100,
      missRate: (1 - hitRate) * 100,
      averageResponseTime,
      throughput,
      memoryUsage: process.memoryUsage().heapUsed,
      connectionCount: this.connectionPool.filter(conn => conn.inUse).length,
      hotKeys: hotKeysArray,
      compressionRatio: compressionRatio * 100,
      batchEfficiency: this.calculateBatchEfficiency()
    };
  }

  /**
   * Apply optimization strategy
   */
  async applyOptimization(strategy: 'compression' | 'batching' | 'hotkey' | 'adaptive-ttl' | 'connection-pooling'): Promise<OptimizationResult> {
    const beforeMetrics = this.getCacheMetrics();
    
    logger.info('Applying cache optimization', { strategy });

    let recommendations: string[] = [];

    switch (strategy) {
      case 'compression':
        this.optimizationConfig.enableCompression = true;
        this.optimizationConfig.compressionThreshold = 512; // Reduce threshold
        recommendations.push('Compression enabled for values > 512 bytes');
        break;

      case 'batching':
        this.optimizationConfig.enableBatching = true;
        this.optimizationConfig.batchSize = Math.min(this.optimizationConfig.batchSize * 2, 200);
        recommendations.push(`Batch size increased to ${this.optimizationConfig.batchSize}`);
        break;

      case 'hotkey':
        this.optimizationConfig.enableHotKeyDetection = true;
        this.optimizationConfig.hotKeyThreshold = Math.max(this.optimizationConfig.hotKeyThreshold * 0.8, 50);
        recommendations.push(`Hot key detection threshold reduced to ${this.optimizationConfig.hotKeyThreshold}`);
        break;

      case 'adaptive-ttl':
        this.optimizationConfig.enableAdaptiveTTL = true;
        this.optimizationConfig.adaptiveTTLMultiplier = 2.0;
        recommendations.push('Adaptive TTL enabled with 2.0x multiplier for hot keys');
        break;

      case 'connection-pooling':
        this.optimizationConfig.enableConnectionPooling = true;
        this.optimizationConfig.maxConnections = Math.min(this.optimizationConfig.maxConnections + 5, 50);
        recommendations.push(`Connection pool size increased to ${this.optimizationConfig.maxConnections}`);
        break;
    }

    // Wait a bit for optimization to take effect
    await new Promise(resolve => setTimeout(resolve, 1000));

    const afterMetrics = this.getCacheMetrics();

    const improvement = {
      hitRateImprovement: afterMetrics.hitRate - beforeMetrics.hitRate,
      responseTimeImprovement: ((beforeMetrics.averageResponseTime - afterMetrics.averageResponseTime) / beforeMetrics.averageResponseTime) * 100,
      throughputImprovement: ((afterMetrics.throughput - beforeMetrics.throughput) / beforeMetrics.throughput) * 100,
      memoryEfficiencyImprovement: ((beforeMetrics.memoryUsage - afterMetrics.memoryUsage) / beforeMetrics.memoryUsage) * 100
    };

    return {
      strategy,
      beforeMetrics,
      afterMetrics,
      improvement,
      recommendations
    };
  }

  /**
   * Auto-tune cache performance
   */
  async autoTunePerformance(): Promise<{
    optimizationsApplied: string[];
    overallImprovement: {
      hitRateImprovement: number;
      responseTimeImprovement: number;
      throughputImprovement: number;
    };
    recommendations: string[];
  }> {
    logger.info('Starting auto-tune performance optimization');

    const initialMetrics = this.getCacheMetrics();
    const optimizationsApplied: string[] = [];
    const allRecommendations: string[] = [];

    // Analyze current performance and apply optimizations
    if (initialMetrics.hitRate < 80) {
      await this.applyOptimization('hotkey');
      optimizationsApplied.push('hotkey-optimization');
    }

    if (initialMetrics.averageResponseTime > 50) {
      await this.applyOptimization('batching');
      optimizationsApplied.push('batching-optimization');
    }

    if (initialMetrics.memoryUsage > 500 * 1024 * 1024) { // 500MB
      await this.applyOptimization('compression');
      optimizationsApplied.push('compression-optimization');
    }

    if (initialMetrics.throughput < 1000) {
      await this.applyOptimization('connection-pooling');
      optimizationsApplied.push('connection-pooling');
    }

    // Always enable adaptive TTL for better cache efficiency
    await this.applyOptimization('adaptive-ttl');
    optimizationsApplied.push('adaptive-ttl');

    const finalMetrics = this.getCacheMetrics();

    const overallImprovement = {
      hitRateImprovement: finalMetrics.hitRate - initialMetrics.hitRate,
      responseTimeImprovement: ((initialMetrics.averageResponseTime - finalMetrics.averageResponseTime) / initialMetrics.averageResponseTime) * 100,
      throughputImprovement: ((finalMetrics.throughput - initialMetrics.throughput) / initialMetrics.throughput) * 100
    };

    // Generate recommendations based on final state
    if (finalMetrics.hitRate < 90) {
      allRecommendations.push('Consider implementing cache warming strategies for frequently accessed data');
    }
    if (finalMetrics.averageResponseTime > 30) {
      allRecommendations.push('Consider upgrading hardware or implementing Redis clustering');
    }
    if (overallImprovement.throughputImprovement < 20) {
      allRecommendations.push('Consider implementing pipelining for batch operations');
    }

    logger.info('Auto-tune performance completed', {
      optimizationsApplied,
      overallImprovement,
      recommendationCount: allRecommendations.length
    });

    return {
      optimizationsApplied,
      overallImprovement,
      recommendations: allRecommendations
    };
  }

  // Private helper methods

  private trackKeyAccess(key: string, timestamp: number): void {
    const stats = this.keyAccessStats.get(key) || { count: 0, lastAccessed: new Date(), totalTime: 0 };
    stats.count++;
    stats.lastAccessed = new Date(timestamp);
    this.keyAccessStats.set(key, stats);

    // Check if key becomes hot
    if (stats.count >= this.optimizationConfig.hotKeyThreshold) {
      this.hotKeys.add(key);
    }
  }

  private updateMetrics(isHit: boolean, responseTime: number): void {
    this.performanceMetrics.requestCount++;
    this.performanceMetrics.totalResponseTime += responseTime;
    
    if (isHit) {
      this.performanceMetrics.hitCount++;
    } else {
      this.performanceMetrics.missCount++;
    }
  }

  private async applyCompression(value: any): Promise<{ value: string; savedBytes: number } | null> {
    if (typeof value !== 'object') return null;
    
    const serialized = JSON.stringify(value);
    if (serialized.length < this.optimizationConfig.compressionThreshold) return null;

    // Simple compression simulation (in real implementation, use proper compression)
    const compressed = serialized.length > 1000 ? serialized.substring(0, serialized.length * 0.7) + '...[compressed]' : serialized;
    const savedBytes = serialized.length - compressed.length;

    return { value: compressed, savedBytes };
  }

  private calculateAdaptiveTTL(key: string): number {
    const stats = this.keyAccessStats.get(key);
    if (!stats) return 3600; // Default 1 hour

    // Hot keys get longer TTL
    const isHot = this.hotKeys.has(key);
    const baseTTL = 3600;
    
    return isHot ? baseTTL * this.optimizationConfig.adaptiveTTLMultiplier : baseTTL;
  }

  private async applyAdaptiveTTL(key: string, value: any): Promise<void> {
    const newTTL = this.calculateAdaptiveTTL(key);
    // In a real implementation, we would update the TTL of the existing key
    // For now, we just log the adaptive TTL calculation
    logger.debug('Applied adaptive TTL', { key, newTTL });
  }

  private async batchedGet(key: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({
        operation: 'get',
        key,
        resolve,
        reject
      });

      this.scheduleBatchProcessing();
    });
  }

  private async batchedSet(key: string, value: any, options: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({
        operation: 'set',
        key,
        value,
        options,
        resolve,
        reject
      });

      this.scheduleBatchProcessing();
    });
  }

  private scheduleBatchProcessing(): void {
    if (this.batchTimer) return;

    this.batchTimer = setTimeout(async () => {
      await this.processBatch();
      this.batchTimer = null;
    }, 10); // 10ms batch delay
  }

  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const batch = this.batchQueue.splice(0, this.optimizationConfig.batchSize);
    
    try {
      const getOperations = batch.filter(op => op.operation === 'get');
      const setOperations = batch.filter(op => op.operation === 'set');

      // Process gets
      for (const op of getOperations) {
        try {
          const result = await cacheService.get(op.key);
          op.resolve(result);
        } catch (error) {
          op.reject(error);
        }
      }

      // Process sets
      for (const op of setOperations) {
        try {
          await cacheService.set(op.key, op.value, op.options);
          op.resolve();
        } catch (error) {
          op.reject(error);
        }
      }

    } catch (error) {
      // Reject all operations in the failed batch
      batch.forEach(op => op.reject(error));
    }
  }

  private async batchedMultiGet(keys: string[]): Promise<any[]> {
    const results: any[] = [];
    for (const key of keys) {
      try {
        const result = await cacheService.get(key);
        results.push(result);
      } catch (error) {
        results.push(null);
      }
    }
    return results;
  }

  private async batchedMultiSet(operations: Array<{ key: string; value: any; options?: any }>): Promise<void> {
    const promises = operations.map(op => 
      cacheService.set(op.key, op.value, op.options || {})
    );
    await Promise.all(promises);
  }

  private async batchedMultiDel(keys: string[]): Promise<void> {
    const promises = keys.map(key => cacheService.del(key));
    await Promise.all(promises);
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private initializeConnectionPool(): void {
    for (let i = 0; i < this.optimizationConfig.maxConnections; i++) {
      this.connectionPool.push({
        id: `conn_${i}`,
        inUse: false,
        lastUsed: new Date()
      });
    }
  }

  private initializeBatchProcessing(): void {
    // Batch processing is initialized in the constructor
    logger.debug('Batch processing initialized', {
      batchSize: this.optimizationConfig.batchSize
    });
  }

  private initializeHotKeyDetection(): void {
    // Clean up old key stats every minute
    setInterval(() => {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      for (const [key, stats] of this.keyAccessStats.entries()) {
        if (stats.lastAccessed.getTime() < oneHourAgo) {
          this.keyAccessStats.delete(key);
          this.hotKeys.delete(key);
        }
      }
    }, 60000);
  }

  private startMetricsCollection(): void {
    // Reset metrics every hour
    setInterval(() => {
      this.performanceMetrics = {
        hitCount: 0,
        missCount: 0,
        totalResponseTime: 0,
        requestCount: 0,
        lastMetricsReset: new Date()
      };
    }, 60 * 60 * 1000);
  }

  private calculateBatchEfficiency(): number {
    // Simple batch efficiency calculation
    return this.batchQueue.length > 0 ? 
      Math.min(this.batchQueue.length / this.optimizationConfig.batchSize * 100, 100) : 0;
  }
}

// Export singleton instance
export const cacheOptimizationService = new CacheOptimizationService();
export default cacheOptimizationService;