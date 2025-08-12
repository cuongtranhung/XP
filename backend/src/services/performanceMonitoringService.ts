/**
 * Performance Monitoring Dashboard Service
 * Real-time performance monitoring and alerting for cache infrastructure
 */

import cacheService from './cacheService';
import { loadTestingService } from './loadTestingService';
import { performanceBenchmarkService } from './performanceBenchmarkService';
import { cacheOptimizationService } from './cacheOptimizationService';
import { redisClusteringService } from './redisClusteringService';
import { cacheWarmingService } from './cacheWarmingService';
import { logger } from '../utils/logger';

// Monitoring types and interfaces
export interface PerformanceMetrics {
  timestamp: Date;
  system: {
    memory: NodeJS.MemoryUsage;
    cpu: NodeJS.CpuUsage;
    uptime: number;
    loadAverage: number[];
  };
  cache: {
    hitRate: number;
    missRate: number;
    totalKeys: number;
    memoryUsage: number;
    operationsPerSecond: number;
    averageLatency: number;
    errorRate: number;
  };
  custom: Record<string, any>;
}

export interface PerformanceAlert {
  id: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'critical';
  category: 'memory' | 'cpu' | 'cache' | 'latency' | 'errors' | 'custom';
  title: string;
  message: string;
  metrics: Partial<PerformanceMetrics>;
  acknowledged: boolean;
  resolvedAt?: Date;
  actions: string[];
}

export interface MonitoringConfig {
  enabled: boolean;
  collectionInterval: number; // milliseconds
  retentionPeriod: number; // hours
  alerting: {
    enabled: boolean;
    thresholds: {
      memoryUsage: number; // MB
      cpuUsage: number; // percentage
      cacheHitRate: number; // percentage (minimum)
      latency: number; // milliseconds (maximum)
      errorRate: number; // percentage (maximum)
    };
    channels: Array<{
      type: 'log' | 'webhook' | 'email';
      endpoint?: string;
      enabled: boolean;
    }>;
  };
  dashboard: {
    realTimeUpdates: boolean;
    historicalDataPoints: number;
    autoRefresh: boolean;
    refreshInterval: number; // milliseconds
  };
}

export interface DashboardData {
  currentMetrics: PerformanceMetrics;
  trends: {
    timeRange: string;
    dataPoints: PerformanceMetrics[];
    summary: {
      avgMemoryUsage: number;
      avgCpuUsage: number;
      avgCacheHitRate: number;
      avgLatency: number;
      totalErrors: number;
      peakMemory: number;
      peakCpu: number;
      minCacheHitRate: number;
      maxLatency: number;
    };
  };
  alerts: {
    active: PerformanceAlert[];
    recent: PerformanceAlert[];
    resolved: PerformanceAlert[];
    summary: {
      total: number;
      critical: number;
      warnings: number;
      info: number;
    };
  };
  services: {
    loadTesting: {
      status: 'idle' | 'running' | 'error';
      activeTests: number;
      lastResult?: any;
    };
    benchmarking: {
      status: 'idle' | 'running' | 'error';
      lastBenchmark?: any;
    };
    optimization: {
      status: 'active' | 'inactive';
      optimizations: string[];
      lastOptimization?: any;
    };
    warming: {
      status: 'active' | 'idle' | 'error';
      strategies: number;
      lastWarming?: any;
    };
    clustering: {
      status: 'active' | 'inactive';
      nodes: number;
      health: number;
    };
  };
}

/**
 * Performance Monitoring Dashboard Service
 */
class PerformanceMonitoringService {
  private config: MonitoringConfig;
  private isMonitoring = false;
  private metricsHistory: PerformanceMetrics[] = [];
  private activeAlerts = new Map<string, PerformanceAlert>();
  private alertHistory: PerformanceAlert[] = [];
  private monitoringTimer: NodeJS.Timeout | null = null;
  private alertCounter = 0;
  
  // Performance baselines for comparison
  private baselines = {
    memory: 0,
    cpu: 0,
    cacheHitRate: 95,
    latency: 50,
    errorRate: 1
  };

  constructor() {
    this.config = {
      enabled: true,
      collectionInterval: 10000, // 10 seconds
      retentionPeriod: 24, // 24 hours
      alerting: {
        enabled: true,
        thresholds: {
          memoryUsage: 500, // 500MB
          cpuUsage: 80, // 80%
          cacheHitRate: 85, // Minimum 85%
          latency: 100, // Maximum 100ms
          errorRate: 5 // Maximum 5%
        },
        channels: [
          { type: 'log', enabled: true },
          { type: 'webhook', endpoint: '/api/alerts/webhook', enabled: false },
          { type: 'email', enabled: false }
        ]
      },
      dashboard: {
        realTimeUpdates: true,
        historicalDataPoints: 288, // 48 hours at 10-second intervals
        autoRefresh: true,
        refreshInterval: 5000 // 5 seconds
      }
    };

    this.initializeMonitoring();
  }

  /**
   * Initialize monitoring service
   */
  private initializeMonitoring(): void {
    if (!this.config.enabled) {
      logger.info('Performance monitoring disabled');
      return;
    }

    this.startMonitoring();
    this.establishBaselines();

    logger.info('Performance monitoring initialized', {
      collectionInterval: this.config.collectionInterval,
      alertingEnabled: this.config.alerting.enabled,
      retentionPeriod: this.config.retentionPeriod
    });
  }

  /**
   * Start monitoring metrics collection
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      logger.warn('Monitoring is already active');
      return;
    }

    this.isMonitoring = true;
    
    this.monitoringTimer = setInterval(async () => {
      try {
        await this.collectMetrics();
        this.processAlerts();
        this.cleanupOldData();
      } catch (error) {
        logger.error('Metrics collection failed', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, this.config.collectionInterval);

    logger.info('Performance monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    logger.info('Performance monitoring stopped');
  }

  /**
   * Get dashboard data
   */
  async getDashboardData(timeRange: '1h' | '6h' | '24h' | '7d' = '6h'): Promise<DashboardData> {
    const timeRangeMs = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };

    const cutoffTime = new Date(Date.now() - timeRangeMs[timeRange]);
    const relevantMetrics = this.metricsHistory.filter(m => m.timestamp >= cutoffTime);

    // Get current metrics
    const currentMetrics = await this.collectCurrentMetrics();

    // Calculate trends
    const trends = this.calculateTrends(relevantMetrics, timeRange);

    // Get alerts
    const activeAlerts = Array.from(this.activeAlerts.values());
    const recentAlerts = this.alertHistory
      .filter(a => a.timestamp >= cutoffTime)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 20);

    const resolvedAlerts = this.alertHistory
      .filter(a => a.resolvedAt && a.resolvedAt >= cutoffTime)
      .slice(0, 10);

    // Get service statuses
    const services = await this.getServiceStatuses();

    return {
      currentMetrics,
      trends,
      alerts: {
        active: activeAlerts,
        recent: recentAlerts,
        resolved: resolvedAlerts,
        summary: {
          total: activeAlerts.length + recentAlerts.length,
          critical: activeAlerts.filter(a => a.severity === 'critical').length,
          warnings: activeAlerts.filter(a => a.severity === 'warning').length,
          info: activeAlerts.filter(a => a.severity === 'info').length
        }
      },
      services
    };
  }

  /**
   * Get real-time metrics stream
   */
  getMetricsStream(): {
    subscribe: (callback: (metrics: PerformanceMetrics) => void) => string;
    unsubscribe: (id: string) => void;
  } {
    const subscribers = new Map<string, (metrics: PerformanceMetrics) => void>();

    const originalCollectMetrics = this.collectMetrics.bind(this);
    this.collectMetrics = async () => {
      await originalCollectMetrics();
      const latest = this.metricsHistory[this.metricsHistory.length - 1];
      if (latest) {
        subscribers.forEach(callback => callback(latest));
      }
    };

    return {
      subscribe: (callback: (metrics: PerformanceMetrics) => void): string => {
        const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        subscribers.set(id, callback);
        return id;
      },
      unsubscribe: (id: string): void => {
        subscribers.delete(id);
      }
    };
  }

  /**
   * Create custom alert
   */
  createCustomAlert(
    category: PerformanceAlert['category'],
    severity: PerformanceAlert['severity'],
    title: string,
    message: string,
    actions: string[] = []
  ): string {
    const alertId = `alert_${++this.alertCounter}_${Date.now()}`;
    
    const alert: PerformanceAlert = {
      id: alertId,
      timestamp: new Date(),
      severity,
      category,
      title,
      message,
      metrics: this.metricsHistory[this.metricsHistory.length - 1] || {} as PerformanceMetrics,
      acknowledged: false,
      actions
    };

    this.activeAlerts.set(alertId, alert);
    this.alertHistory.push(alert);

    this.sendAlert(alert);

    logger.warn('Custom alert created', {
      alertId,
      severity,
      title,
      message
    });

    return alertId;
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string, userId?: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    alert.acknowledged = true;

    logger.info('Alert acknowledged', {
      alertId,
      acknowledgedBy: userId || 'system',
      title: alert.title
    });

    return true;
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string, userId?: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    alert.resolvedAt = new Date();
    this.activeAlerts.delete(alertId);

    logger.info('Alert resolved', {
      alertId,
      resolvedBy: userId || 'system',
      title: alert.title,
      duration: alert.resolvedAt.getTime() - alert.timestamp.getTime()
    });

    return true;
  }

  /**
   * Update monitoring configuration
   */
  updateConfiguration(updates: Partial<MonitoringConfig>): void {
    Object.assign(this.config, updates);

    // Restart monitoring if interval changed
    if (updates.collectionInterval && this.isMonitoring) {
      this.stopMonitoring();
      this.startMonitoring();
    }

    logger.info('Monitoring configuration updated', updates);
  }

  /**
   * Get monitoring configuration
   */
  getConfiguration(): MonitoringConfig {
    return { ...this.config };
  }

  /**
   * Export metrics data
   */
  exportMetrics(
    format: 'json' | 'csv' | 'prometheus',
    timeRange: '1h' | '6h' | '24h' | '7d' = '24h'
  ): string {
    const timeRangeMs = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };

    const cutoffTime = new Date(Date.now() - timeRangeMs[timeRange]);
    const relevantMetrics = this.metricsHistory.filter(m => m.timestamp >= cutoffTime);

    switch (format) {
      case 'json':
        return JSON.stringify(relevantMetrics, null, 2);
      
      case 'csv':
        return this.exportAsCSV(relevantMetrics);
      
      case 'prometheus':
        return this.exportAsPrometheus(relevantMetrics);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Private helper methods

  private async collectMetrics(): Promise<void> {
    const metrics = await this.collectCurrentMetrics();
    
    this.metricsHistory.push(metrics);
    
    // Limit history size
    if (this.metricsHistory.length > this.config.dashboard.historicalDataPoints) {
      this.metricsHistory = this.metricsHistory.slice(-this.config.dashboard.historicalDataPoints);
    }
  }

  private async collectCurrentMetrics(): Promise<PerformanceMetrics> {
    const systemMemory = process.memoryUsage();
    const systemCpu = process.cpuUsage();
    const uptime = process.uptime();

    // Get cache metrics
    let cacheMetrics;
    try {
      cacheMetrics = cacheOptimizationService.getCacheMetrics();
    } catch (error) {
      cacheMetrics = {
        hitRate: 0,
        missRate: 0,
        averageResponseTime: 0,
        throughput: 0,
        memoryUsage: 0,
        connectionCount: 0,
        hotKeys: [],
        compressionRatio: 0,
        batchEfficiency: 0
      };
    }

    const metrics: PerformanceMetrics = {
      timestamp: new Date(),
      system: {
        memory: systemMemory,
        cpu: systemCpu,
        uptime,
        loadAverage: [0, 0, 0] // Would use os.loadavg() in production
      },
      cache: {
        hitRate: cacheMetrics.hitRate || 0,
        missRate: cacheMetrics.missRate || 0,
        totalKeys: 0, // Would need Redis integration
        memoryUsage: cacheMetrics.memoryUsage || 0,
        operationsPerSecond: cacheMetrics.throughput || 0,
        averageLatency: cacheMetrics.averageResponseTime || 0,
        errorRate: 0 // Would need error tracking
      },
      custom: {
        compressionRatio: cacheMetrics.compressionRatio || 0,
        batchEfficiency: cacheMetrics.batchEfficiency || 0,
        connectionCount: cacheMetrics.connectionCount || 0,
        hotKeysCount: cacheMetrics.hotKeys?.length || 0
      }
    };

    return metrics;
  }

  private processAlerts(): void {
    if (!this.config.alerting.enabled || this.metricsHistory.length === 0) return;

    const latest = this.metricsHistory[this.metricsHistory.length - 1];
    const thresholds = this.config.alerting.thresholds;

    // Memory usage alert
    const memoryMB = latest.system.memory.heapUsed / 1024 / 1024;
    if (memoryMB > thresholds.memoryUsage) {
      this.createAlertIfNotExists(
        'memory-high',
        'critical',
        'memory',
        'High Memory Usage',
        `Memory usage is ${memoryMB.toFixed(1)}MB (threshold: ${thresholds.memoryUsage}MB)`,
        ['Check for memory leaks', 'Consider scaling', 'Enable garbage collection']
      );
    }

    // Cache hit rate alert
    if (latest.cache.hitRate < thresholds.cacheHitRate) {
      this.createAlertIfNotExists(
        'cache-hit-low',
        'warning',
        'cache',
        'Low Cache Hit Rate',
        `Cache hit rate is ${latest.cache.hitRate.toFixed(1)}% (threshold: ${thresholds.cacheHitRate}%)`,
        ['Enable cache warming', 'Review cache TTL settings', 'Check cache size limits']
      );
    }

    // Latency alert
    if (latest.cache.averageLatency > thresholds.latency) {
      this.createAlertIfNotExists(
        'latency-high',
        'warning',
        'latency',
        'High Response Latency',
        `Average latency is ${latest.cache.averageLatency.toFixed(1)}ms (threshold: ${thresholds.latency}ms)`,
        ['Enable connection pooling', 'Check network connectivity', 'Consider clustering']
      );
    }

    // Error rate alert
    if (latest.cache.errorRate > thresholds.errorRate) {
      this.createAlertIfNotExists(
        'errors-high',
        'critical',
        'errors',
        'High Error Rate',
        `Error rate is ${latest.cache.errorRate.toFixed(1)}% (threshold: ${thresholds.errorRate}%)`,
        ['Check logs for error patterns', 'Verify service health', 'Review recent changes']
      );
    }
  }

  private createAlertIfNotExists(
    alertKey: string,
    severity: PerformanceAlert['severity'],
    category: PerformanceAlert['category'],
    title: string,
    message: string,
    actions: string[]
  ): void {
    // Check if similar alert already exists
    const existingAlert = Array.from(this.activeAlerts.values())
      .find(a => a.title === title && !a.acknowledged);

    if (existingAlert) return;

    this.createCustomAlert(category, severity, title, message, actions);
  }

  private sendAlert(alert: PerformanceAlert): void {
    this.config.alerting.channels.forEach(channel => {
      if (!channel.enabled) return;

      switch (channel.type) {
        case 'log':
          logger.warn('Performance Alert', {
            alertId: alert.id,
            severity: alert.severity,
            category: alert.category,
            title: alert.title,
            message: alert.message
          });
          break;
        
        case 'webhook':
          // Would implement webhook sending in production
          logger.debug('Webhook alert would be sent', { 
            endpoint: channel.endpoint,
            alert: alert.title
          });
          break;
        
        case 'email':
          // Would implement email sending in production
          logger.debug('Email alert would be sent', { alert: alert.title });
          break;
      }
    });
  }

  private calculateTrends(metrics: PerformanceMetrics[], timeRange: string) {
    if (metrics.length === 0) {
      return {
        timeRange,
        dataPoints: [],
        summary: {
          avgMemoryUsage: 0,
          avgCpuUsage: 0,
          avgCacheHitRate: 0,
          avgLatency: 0,
          totalErrors: 0,
          peakMemory: 0,
          peakCpu: 0,
          minCacheHitRate: 0,
          maxLatency: 0
        }
      };
    }

    const memoryValues = metrics.map(m => m.system.memory.heapUsed / 1024 / 1024);
    const cpuValues = metrics.map(m => (m.system.cpu.user + m.system.cpu.system) / 1000000);
    const cacheHitRates = metrics.map(m => m.cache.hitRate);
    const latencyValues = metrics.map(m => m.cache.averageLatency);

    return {
      timeRange,
      dataPoints: metrics,
      summary: {
        avgMemoryUsage: memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length,
        avgCpuUsage: cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length,
        avgCacheHitRate: cacheHitRates.reduce((a, b) => a + b, 0) / cacheHitRates.length,
        avgLatency: latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length,
        totalErrors: metrics.reduce((sum, m) => sum + (m.cache.errorRate || 0), 0),
        peakMemory: Math.max(...memoryValues),
        peakCpu: Math.max(...cpuValues),
        minCacheHitRate: Math.min(...cacheHitRates),
        maxLatency: Math.max(...latencyValues)
      }
    };
  }

  private async getServiceStatuses() {
    return {
      loadTesting: {
        status: 'idle' as const,
        activeTests: 0,
        lastResult: undefined
      },
      benchmarking: {
        status: 'idle' as const,
        lastBenchmark: undefined
      },
      optimization: {
        status: 'active' as const,
        optimizations: ['compression', 'batching', 'connection-pooling'],
        lastOptimization: undefined
      },
      warming: {
        status: 'idle' as const,
        strategies: 8,
        lastWarming: undefined
      },
      clustering: {
        status: 'inactive' as const,
        nodes: 0,
        health: 0
      }
    };
  }

  private cleanupOldData(): void {
    const cutoffTime = new Date(Date.now() - (this.config.retentionPeriod * 60 * 60 * 1000));
    
    // Clean up metrics
    this.metricsHistory = this.metricsHistory.filter(m => m.timestamp >= cutoffTime);
    
    // Clean up alert history
    this.alertHistory = this.alertHistory.filter(a => a.timestamp >= cutoffTime);
  }

  private establishBaselines(): void {
    // Simple baseline establishment - would be more sophisticated in production
    setTimeout(async () => {
      if (this.metricsHistory.length > 10) {
        const recent = this.metricsHistory.slice(-10);
        this.baselines.memory = recent.reduce((sum, m) => sum + (m.system.memory.heapUsed / 1024 / 1024), 0) / recent.length;
        this.baselines.cacheHitRate = recent.reduce((sum, m) => sum + m.cache.hitRate, 0) / recent.length;
        this.baselines.latency = recent.reduce((sum, m) => sum + m.cache.averageLatency, 0) / recent.length;
        
        logger.info('Performance baselines established', this.baselines);
      }
    }, 60000); // After 1 minute
  }

  private exportAsCSV(metrics: PerformanceMetrics[]): string {
    const headers = [
      'timestamp', 'memory_heap_used', 'memory_heap_total', 'cpu_user', 'cpu_system',
      'cache_hit_rate', 'cache_miss_rate', 'cache_latency', 'cache_throughput'
    ];

    const rows = metrics.map(m => [
      m.timestamp.toISOString(),
      m.system.memory.heapUsed.toString(),
      m.system.memory.heapTotal.toString(),
      m.system.cpu.user.toString(),
      m.system.cpu.system.toString(),
      m.cache.hitRate.toString(),
      m.cache.missRate.toString(),
      m.cache.averageLatency.toString(),
      m.cache.operationsPerSecond.toString()
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  private exportAsPrometheus(metrics: PerformanceMetrics[]): string {
    if (metrics.length === 0) return '';

    const latest = metrics[metrics.length - 1];
    const timestamp = latest.timestamp.getTime();

    return [
      `# HELP cache_hit_rate Cache hit rate percentage`,
      `# TYPE cache_hit_rate gauge`,
      `cache_hit_rate ${latest.cache.hitRate} ${timestamp}`,
      ``,
      `# HELP cache_latency Average cache operation latency in milliseconds`,
      `# TYPE cache_latency gauge`,
      `cache_latency ${latest.cache.averageLatency} ${timestamp}`,
      ``,
      `# HELP memory_heap_used Heap memory used in bytes`,
      `# TYPE memory_heap_used gauge`,
      `memory_heap_used ${latest.system.memory.heapUsed} ${timestamp}`,
      ``
    ].join('\n');
  }
}

// Export singleton instance
export const performanceMonitoringService = new PerformanceMonitoringService();
export default performanceMonitoringService;