import { logger } from '../utils/logger';
import cacheService from './cacheService';
import LOCATION_CONFIG from '../config/locationConfig';

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: Date;
  context?: any;
}

interface QueryPerformance {
  operation: string;
  duration: number;
  cached: boolean;
  userId?: number;
  timestamp: Date;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  errors: number;
  totalRequests: number;
  hitRate: number;
}

class PerformanceMonitor {
  private isEnabled: boolean;
  private metrics: PerformanceMetric[] = [];
  private queryMetrics: QueryPerformance[] = [];
  private cacheMetrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    errors: 0,
    totalRequests: 0,
    hitRate: 0
  };
  
  // Performance thresholds from config
  private readonly slowQueryThreshold = LOCATION_CONFIG.MONITORING.SLOW_QUERY_THRESHOLD;
  private readonly errorThreshold = LOCATION_CONFIG.MONITORING.ERROR_THRESHOLD;
  
  // Metric retention settings
  private readonly maxMetrics = 1000;
  private readonly cleanupInterval = 5 * 60 * 1000; // 5 minutes
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.isEnabled = LOCATION_CONFIG.MONITORING.ENABLE_METRICS;
    
    if (this.isEnabled) {
      this.startCleanupTimer();
      logger.info('Performance monitoring enabled');
    }
  }

  // Core monitoring methods
  recordMetric(name: string, value: number, context?: any): void {
    if (!this.isEnabled) {return;}

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: new Date(),
      context
    };

    this.metrics.push(metric);
    
    // Log slow operations
    if (name.includes('_duration') && value > this.slowQueryThreshold) {
      logger.warn('Slow operation detected', {
        operation: name,
        duration: value,
        threshold: this.slowQueryThreshold,
        context
      });
    }

    // Cleanup old metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  recordQueryPerformance(operation: string, duration: number, cached: boolean, userId?: number): void {
    if (!this.isEnabled) {return;}

    const queryMetric: QueryPerformance = {
      operation,
      duration,
      cached,
      userId,
      timestamp: new Date()
    };

    this.queryMetrics.push(queryMetric);

    // Update cache metrics
    this.cacheMetrics.totalRequests++;
    if (cached) {
      this.cacheMetrics.hits++;
    } else {
      this.cacheMetrics.misses++;
    }
    
    this.cacheMetrics.hitRate = this.cacheMetrics.hits / this.cacheMetrics.totalRequests * 100;

    // Record as general metric
    this.recordMetric(`${operation}_duration`, duration, { cached, userId });

    // Cleanup old query metrics
    if (this.queryMetrics.length > this.maxMetrics) {
      this.queryMetrics = this.queryMetrics.slice(-this.maxMetrics);
    }
  }

  recordCacheError(): void {
    if (!this.isEnabled) {return;}
    
    this.cacheMetrics.errors++;
    this.recordMetric('cache_error', 1);
  }

  // Performance analysis methods
  getAverageQueryTime(operation?: string, timeWindow?: number): number {
    if (!this.isEnabled) {return 0;}

    const cutoff = timeWindow ? new Date(Date.now() - timeWindow) : null;
    const relevantMetrics = this.queryMetrics.filter(metric => {
      if (operation && metric.operation !== operation) {return false;}
      if (cutoff && metric.timestamp < cutoff) {return false;}
      return true;
    });

    if (relevantMetrics.length === 0) {return 0;}

    const totalDuration = relevantMetrics.reduce((sum, metric) => sum + metric.duration, 0);
    return totalDuration / relevantMetrics.length;
  }

  getCacheHitRate(timeWindow?: number): number {
    if (!this.isEnabled) {return 0;}

    const cutoff = timeWindow ? new Date(Date.now() - timeWindow) : null;
    const relevantMetrics = this.queryMetrics.filter(metric => {
      return !cutoff || metric.timestamp >= cutoff;
    });

    if (relevantMetrics.length === 0) {return 0;}

    const cacheHits = relevantMetrics.filter(metric => metric.cached).length;
    return (cacheHits / relevantMetrics.length) * 100;
  }

  getSlowQueries(threshold?: number): QueryPerformance[] {
    if (!this.isEnabled) {return [];}

    const slowThreshold = threshold || this.slowQueryThreshold;
    return this.queryMetrics.filter(metric => metric.duration > slowThreshold);
  }

  getPerformanceSummary(timeWindow: number = 60 * 60 * 1000): {
    averageQueryTime: number;
    cacheHitRate: number;
    slowQueryCount: number;
    errorRate: number;
    totalQueries: number;
    cacheStats: CacheMetrics;
  } {
    if (!this.isEnabled) {
      return {
        averageQueryTime: 0,
        cacheHitRate: 0,
        slowQueryCount: 0,
        errorRate: 0,
        totalQueries: 0,
        cacheStats: this.cacheMetrics
      };
    }

    const cutoff = new Date(Date.now() - timeWindow);
    const recentQueries = this.queryMetrics.filter(metric => metric.timestamp >= cutoff);
    
    return {
      averageQueryTime: this.getAverageQueryTime(undefined, timeWindow),
      cacheHitRate: this.getCacheHitRate(timeWindow),
      slowQueryCount: this.getSlowQueries().filter(q => q.timestamp >= cutoff).length,
      errorRate: this.calculateErrorRate(timeWindow),
      totalQueries: recentQueries.length,
      cacheStats: this.cacheMetrics
    };
  }

  private calculateErrorRate(timeWindow: number): number {
    const cutoff = new Date(Date.now() - timeWindow);
    const recentMetrics = this.metrics.filter(metric => 
      metric.timestamp >= cutoff && metric.name.includes('error')
    );
    
    const totalOperations = this.queryMetrics.filter(metric => metric.timestamp >= cutoff).length;
    
    if (totalOperations === 0) {return 0;}
    
    return (recentMetrics.length / totalOperations) * 100;
  }

  // Monitoring utilities
  async startTransaction(operation: string, userId?: number): Promise<{
    end: (cached?: boolean) => void;
    recordError: (error: Error) => void;
  }> {
    const startTime = Date.now();
    
    return {
      end: (cached: boolean = false) => {
        const duration = Date.now() - startTime;
        this.recordQueryPerformance(operation, duration, cached, userId);
      },
      recordError: (error: Error) => {
        const duration = Date.now() - startTime;
        this.recordMetric(`${operation}_error`, duration, { error: error.message, userId });
        logger.error(`Operation failed: ${operation}`, {
          duration,
          error: error.message,
          userId
        });
      }
    };
  }

  // Wrapper for database operations
  async monitorDatabaseOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    userId?: number
  ): Promise<T> {
    if (!this.isEnabled) {
      return await fn();
    }

    const transaction = await this.startTransaction(operation, userId);
    
    try {
      const result = await fn();
      transaction.end(false); // Database operations are not cached
      return result;
    } catch (error) {
      transaction.recordError(error instanceof Error ? error : new Error('Unknown error'));
      throw error;
    }
  }

  // Wrapper for cached operations
  async monitorCachedOperation<T>(
    operation: string,
    cacheKey: string,
    fetchFn: () => Promise<T>,
    userId?: number
  ): Promise<T> {
    if (!this.isEnabled) {
      return await fetchFn();
    }

    const transaction = await this.startTransaction(operation, userId);
    
    try {
      // This would be called by the service layer to indicate cache hit/miss
      const result = await fetchFn();
      // Note: The actual cache hit/miss is recorded in the service layer
      return result;
    } catch (error) {
      transaction.recordError(error instanceof Error ? error : new Error('Unknown error'));
      this.recordCacheError();
      throw error;
    }
  }

  // Health check and alerts
  async checkPerformanceHealth(): Promise<{
    healthy: boolean;
    issues: string[];
    metrics: any;
  }> {
    const issues: string[] = [];
    const summary = this.getPerformanceSummary();
    
    // Check average query time
    if (summary.averageQueryTime > this.slowQueryThreshold) {
      issues.push(`Average query time (${summary.averageQueryTime}ms) exceeds threshold (${this.slowQueryThreshold}ms)`);
    }
    
    // Check error rate
    if (summary.errorRate > this.errorThreshold * 100) {
      issues.push(`Error rate (${summary.errorRate.toFixed(2)}%) exceeds threshold (${this.errorThreshold * 100}%)`);
    }
    
    // Check cache performance
    if (summary.cacheHitRate < 70) { // 70% minimum cache hit rate
      issues.push(`Cache hit rate (${summary.cacheHitRate.toFixed(2)}%) is below optimal threshold (70%)`);
    }
    
    // Check cache service health
    const cacheHealth = await cacheService.healthCheck();
    if (!cacheHealth.healthy) {
      issues.push(`Cache service unhealthy: ${cacheHealth.error}`);
    }

    return {
      healthy: issues.length === 0,
      issues,
      metrics: {
        ...summary,
        cacheServiceHealth: cacheHealth
      }
    };
  }

  // Reporting methods
  generatePerformanceReport(): {
    timestamp: Date;
    summary: any;
    topSlowOperations: QueryPerformance[];
    cacheEffectiveness: any;
    recommendations: string[];
  } {
    const summary = this.getPerformanceSummary();
    const slowQueries = this.getSlowQueries().slice(0, 10); // Top 10 slow queries
    const recommendations: string[] = [];

    // Generate recommendations
    if (summary.cacheHitRate < 80) {
      recommendations.push('Consider caching more frequently accessed data to improve performance');
    }
    
    if (summary.slowQueryCount > 5) {
      recommendations.push('Review and optimize slow database queries');
    }
    
    if (summary.errorRate > 1) {
      recommendations.push('Investigate and fix recurring errors in the system');
    }

    return {
      timestamp: new Date(),
      summary,
      topSlowOperations: slowQueries,
      cacheEffectiveness: {
        hitRate: summary.cacheHitRate,
        totalRequests: this.cacheMetrics.totalRequests,
        errorRate: (this.cacheMetrics.errors / this.cacheMetrics.totalRequests * 100) || 0
      },
      recommendations
    };
  }

  // Cleanup and maintenance
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldMetrics();
    }, this.cleanupInterval);
  }

  private cleanupOldMetrics(): void {
    const cutoff = new Date(Date.now() - (24 * 60 * 60 * 1000)); // 24 hours
    
    const initialMetricsCount = this.metrics.length;
    const initialQueryCount = this.queryMetrics.length;
    
    this.metrics = this.metrics.filter(metric => metric.timestamp > cutoff);
    this.queryMetrics = this.queryMetrics.filter(metric => metric.timestamp > cutoff);
    
    const cleanedMetrics = initialMetricsCount - this.metrics.length;
    const cleanedQueries = initialQueryCount - this.queryMetrics.length;
    
    if (cleanedMetrics > 0 || cleanedQueries > 0) {
      logger.debug('Cleaned up old performance metrics', {
        cleanedMetrics,
        cleanedQueries,
        remaining: {
          metrics: this.metrics.length,
          queries: this.queryMetrics.length
        }
      });
    }
  }

  // Shutdown
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    logger.info('Performance monitor shut down', {
      totalMetricsRecorded: this.metrics.length,
      totalQueriesRecorded: this.queryMetrics.length
    });
  }

  // Getters for external access
  get enabled(): boolean {
    return this.isEnabled;
  }

  get currentMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  get currentQueryMetrics(): QueryPerformance[] {
    return [...this.queryMetrics];
  }
}

// Export singleton instance
export default new PerformanceMonitor();