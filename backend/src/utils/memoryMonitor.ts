import { logger } from './logger';

interface MemoryMetrics {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
  heapUtilization: number;
  timestamp: Date;
}

class MemoryMonitor {
  private static instance: MemoryMonitor;
  private readonly thresholds = {
    heapUsed: 500 * 1024 * 1024, // 500MB
    rss: 1024 * 1024 * 1024, // 1GB
    heapUtilization: 0.85 // 85%
  };
  
  private monitoringInterval?: NodeJS.Timeout;
  private readonly intervalMs = 60000; // 1 minute
  private metrics: MemoryMetrics[] = [];
  private readonly maxMetricsHistory = 60; // Keep 1 hour of data

  static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }

  start(): void {
    if (this.monitoringInterval) {
      console.log('Memory monitoring already started');
      return;
    }

    console.log('🧠 Starting memory monitoring...');
    
    // Initial check
    this.checkMemory();
    
    // Periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.checkMemory();
    }, this.intervalMs);
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      console.log('Memory monitoring stopped');
    }
  }

  private checkMemory(): void {
    const memoryUsage = process.memoryUsage();
    const metrics: MemoryMetrics = {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
      arrayBuffers: memoryUsage.arrayBuffers,
      heapUtilization: memoryUsage.heapUsed / memoryUsage.heapTotal,
      timestamp: new Date()
    };

    // Store metrics
    this.metrics.push(metrics);
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics.shift(); // Remove oldest entry
    }

    // Check thresholds and alert
    this.checkThresholds(metrics);
  }

  private checkThresholds(metrics: MemoryMetrics): void {
    const rssInMB = Math.round(metrics.rss / 1024 / 1024);
    const heapUsedInMB = Math.round(metrics.heapUsed / 1024 / 1024);
    const utilizationPercent = Math.round(metrics.heapUtilization * 100);

    // Critical memory usage
    if (metrics.heapUsed > this.thresholds.heapUsed) {
      logger.error('🚨 CRITICAL MEMORY USAGE DETECTED', {
        heapUsedMB: heapUsedInMB,
        heapUtilization: utilizationPercent,
        rssMB: rssInMB,
        recommendation: 'Investigate memory leaks, consider restart'
      });
      
      // Force garbage collection if available
      if (global.gc) {
        console.log('🗑️ Forcing garbage collection...');
        global.gc();
      }
    }
    
    // High memory usage warning
    else if (metrics.heapUsed > this.thresholds.heapUsed * 0.8) {
      console.warn('⚠️ High memory usage detected', {
        heapUsedMB: heapUsedInMB,
        heapUtilization: utilizationPercent,
        rssMB: rssInMB
      });
    }

    // Memory leak detection (rapid growth)
    if (this.metrics.length >= 5) {
      const recentMetrics = this.metrics.slice(-5);
      const growthRate = this.calculateGrowthRate(recentMetrics);
      
      if (growthRate > 20) { // 20MB/minute growth
        console.warn('🔍 Possible memory leak detected', {
          growthRateMBPerMinute: Math.round(growthRate),
          currentHeapMB: heapUsedInMB,
          recommendation: 'Monitor closely, investigate recent changes'
        });
      }
    }

    // Log normal status periodically (every 10 minutes)
    if (Date.now() % (10 * 60 * 1000) < this.intervalMs) {
      console.log('💾 Memory status', {
        heapUsedMB: heapUsedInMB,
        heapUtilization: utilizationPercent,
        rssMB: rssInMB,
        status: 'healthy'
      });
    }
  }

  private calculateGrowthRate(metrics: MemoryMetrics[]): number {
    if (metrics.length < 2) return 0;
    
    const first = metrics[0];
    const last = metrics[metrics.length - 1];
    const timeDiffMs = last.timestamp.getTime() - first.timestamp.getTime();
    const heapDiffMB = (last.heapUsed - first.heapUsed) / 1024 / 1024;
    
    // Convert to MB per minute
    return (heapDiffMB / timeDiffMs) * 60000;
  }

  getCurrentMetrics(): MemoryMetrics {
    const memoryUsage = process.memoryUsage();
    return {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
      arrayBuffers: memoryUsage.arrayBuffers,
      heapUtilization: memoryUsage.heapUsed / memoryUsage.heapTotal,
      timestamp: new Date()
    };
  }

  getMetricsHistory(): MemoryMetrics[] {
    return [...this.metrics];
  }

  getMemoryReport(): {
    current: MemoryMetrics;
    thresholds: any;
    status: 'healthy' | 'warning' | 'critical';
    recommendations: string[];
  } {
    const current = this.getCurrentMetrics();
    const recommendations: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    if (current.heapUsed > this.thresholds.heapUsed) {
      status = 'critical';
      recommendations.push('Immediate memory optimization required');
      recommendations.push('Consider restarting the application');
    } else if (current.heapUsed > this.thresholds.heapUsed * 0.8) {
      status = 'warning';
      recommendations.push('Monitor memory usage closely');
      recommendations.push('Investigate potential memory leaks');
    }

    if (current.heapUtilization > this.thresholds.heapUtilization) {
      recommendations.push('High heap utilization detected');
    }

    return {
      current,
      thresholds: this.thresholds,
      status,
      recommendations: recommendations.length > 0 ? recommendations : ['System memory is healthy']
    };
  }
}

// Export singleton instance
export const memoryMonitor = MemoryMonitor.getInstance();

// Auto-start monitoring in production
if (process.env.NODE_ENV === 'production' || process.env.MEMORY_MONITORING === 'true') {
  memoryMonitor.start();
}