/**
 * Performance Benchmark Service
 * Advanced benchmarking tools for cache performance analysis
 */

import cacheService from './cacheService';
import { multiUserSessionService } from './multiUserSessionService';
import { realTimeCacheService } from './realTimeCacheService';
import { locationCacheService } from './locationCacheService';
import cacheInvalidationService from './cacheInvalidationService';
import { logger } from '../utils/logger';

// Benchmark types and interfaces
export interface BenchmarkConfig {
  name: string;
  description: string;
  iterations: number;
  warmupIterations: number;
  dataSize: 'small' | 'medium' | 'large' | 'xlarge';
  concurrency: number;
  measureMemory: boolean;
  measureCpu: boolean;
}

export interface BenchmarkResult {
  name: string;
  config: BenchmarkConfig;
  startTime: Date;
  endTime: Date;
  iterations: number;
  totalDuration: number; // milliseconds
  averageLatency: number; // milliseconds
  medianLatency: number;
  p95Latency: number;
  p99Latency: number;
  minLatency: number;
  maxLatency: number;
  throughput: number; // operations per second
  memoryUsage: {
    before: NodeJS.MemoryUsage;
    after: NodeJS.MemoryUsage;
    peak: NodeJS.MemoryUsage;
    delta: Partial<NodeJS.MemoryUsage>;
  };
  cpuUsage: {
    before: NodeJS.CpuUsage;
    after: NodeJS.CpuUsage;
    delta: NodeJS.CpuUsage;
  };
  customMetrics: Record<string, any>;
  errors: Array<{
    iteration: number;
    error: string;
    timestamp: Date;
  }>;
}

export interface BenchmarkSuite {
  name: string;
  description: string;
  benchmarks: string[];
  results: BenchmarkResult[];
  summary: {
    totalDuration: number;
    averageThroughput: number;
    averageLatency: number;
    totalErrors: number;
    memoryEfficiency: number;
    cpuEfficiency: number;
  };
}

/**
 * Performance Benchmark Service
 */
class PerformanceBenchmarkService {
  private benchmarkConfigs: Map<string, BenchmarkConfig> = new Map();
  private benchmarkHistory: BenchmarkResult[] = [];
  private activeBenchmarks: Map<string, Promise<BenchmarkResult>> = new Map();

  constructor() {
    this.initializeBenchmarkConfigs();
  }

  /**
   * Initialize predefined benchmark configurations
   */
  private initializeBenchmarkConfigs(): void {
    const configs: BenchmarkConfig[] = [
      {
        name: 'cache-basic-operations',
        description: 'Basic cache operations (get, set, delete)',
        iterations: 10000,
        warmupIterations: 1000,
        dataSize: 'small',
        concurrency: 1,
        measureMemory: true,
        measureCpu: true
      },
      {
        name: 'cache-concurrent-reads',
        description: 'Concurrent cache read operations',
        iterations: 5000,
        warmupIterations: 500,
        dataSize: 'medium',
        concurrency: 10,
        measureMemory: true,
        measureCpu: true
      },
      {
        name: 'cache-concurrent-writes',
        description: 'Concurrent cache write operations',
        iterations: 3000,
        warmupIterations: 300,
        dataSize: 'medium',
        concurrency: 10,
        measureMemory: true,
        measureCpu: true
      },
      {
        name: 'cache-mixed-operations',
        description: 'Mixed read/write operations with realistic ratios',
        iterations: 8000,
        warmupIterations: 800,
        dataSize: 'medium',
        concurrency: 5,
        measureMemory: true,
        measureCpu: true
      },
      {
        name: 'invalidation-patterns',
        description: 'Cache invalidation pattern performance',
        iterations: 2000,
        warmupIterations: 200,
        dataSize: 'small',
        concurrency: 3,
        measureMemory: true,
        measureCpu: true
      },
      {
        name: 'session-management',
        description: 'Multi-user session management operations',
        iterations: 1500,
        warmupIterations: 150,
        dataSize: 'medium',
        concurrency: 8,
        measureMemory: true,
        measureCpu: true
      },
      {
        name: 'geospatial-queries',
        description: 'Geospatial cache query performance',
        iterations: 1000,
        warmupIterations: 100,
        dataSize: 'large',
        concurrency: 5,
        measureMemory: true,
        measureCpu: true
      },
      {
        name: 'realtime-updates',
        description: 'Real-time cache update performance',
        iterations: 2500,
        warmupIterations: 250,
        dataSize: 'small',
        concurrency: 15,
        measureMemory: true,
        measureCpu: true
      },
      {
        name: 'memory-stress-test',
        description: 'Memory usage under stress conditions',
        iterations: 50000,
        warmupIterations: 5000,
        dataSize: 'xlarge',
        concurrency: 1,
        measureMemory: true,
        measureCpu: true
      },
      {
        name: 'high-concurrency-stress',
        description: 'High concurrency stress test',
        iterations: 10000,
        warmupIterations: 1000,
        dataSize: 'medium',
        concurrency: 50,
        measureMemory: true,
        measureCpu: true
      }
    ];

    configs.forEach(config => {
      this.benchmarkConfigs.set(config.name, config);
    });

    logger.info('Performance benchmark configurations initialized', {
      configCount: configs.length
    });
  }

  /**
   * Run single benchmark
   */
  async runBenchmark(configName: string): Promise<BenchmarkResult> {
    const config = this.benchmarkConfigs.get(configName);
    if (!config) {
      throw new Error(`Benchmark configuration '${configName}' not found`);
    }

    // Check if benchmark is already running
    if (this.activeBenchmarks.has(configName)) {
      throw new Error(`Benchmark '${configName}' is already running`);
    }

    logger.info('Starting performance benchmark', {
      name: config.name,
      iterations: config.iterations,
      concurrency: config.concurrency
    });

    const benchmarkPromise = this.executeBenchmark(config);
    this.activeBenchmarks.set(configName, benchmarkPromise);

    try {
      const result = await benchmarkPromise;
      this.benchmarkHistory.push(result);
      
      logger.info('Benchmark completed', {
        name: result.name,
        duration: result.totalDuration,
        throughput: result.throughput,
        averageLatency: result.averageLatency
      });

      return result;
    } finally {
      this.activeBenchmarks.delete(configName);
    }
  }

  /**
   * Run benchmark suite
   */
  async runBenchmarkSuite(suiteType: 'quick' | 'comprehensive' | 'stress'): Promise<BenchmarkSuite> {
    const suites = {
      quick: [
        'cache-basic-operations',
        'cache-concurrent-reads',
        'invalidation-patterns'
      ],
      comprehensive: [
        'cache-basic-operations',
        'cache-concurrent-reads',
        'cache-concurrent-writes',
        'cache-mixed-operations',
        'session-management',
        'geospatial-queries',
        'realtime-updates'
      ],
      stress: [
        'cache-mixed-operations',
        'session-management',
        'realtime-updates',
        'memory-stress-test',
        'high-concurrency-stress'
      ]
    };

    const benchmarkNames = suites[suiteType];
    const results: BenchmarkResult[] = [];
    const startTime = Date.now();

    logger.info('Starting benchmark suite', {
      suiteType,
      benchmarkCount: benchmarkNames.length
    });

    for (const benchmarkName of benchmarkNames) {
      try {
        const result = await this.runBenchmark(benchmarkName);
        results.push(result);
        
        // Brief pause between benchmarks
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        logger.error('Benchmark failed in suite', {
          benchmarkName,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    const summary = this.calculateSuiteSummary(results, totalDuration);

    const suite: BenchmarkSuite = {
      name: `${suiteType}-suite`,
      description: `${suiteType.charAt(0).toUpperCase() + suiteType.slice(1)} benchmark suite`,
      benchmarks: benchmarkNames,
      results,
      summary
    };

    logger.info('Benchmark suite completed', {
      suiteType,
      totalDuration,
      benchmarksCompleted: results.length,
      averageThroughput: summary.averageThroughput
    });

    return suite;
  }

  /**
   * Get benchmark results
   */
  getBenchmarkResults(benchmarkName?: string): BenchmarkResult | BenchmarkResult[] {
    if (benchmarkName) {
      const result = this.benchmarkHistory
        .filter(result => result.name === benchmarkName)
        .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0];
      
      if (!result) {
        throw new Error(`No results found for benchmark: ${benchmarkName}`);
      }
      
      return result;
    }

    return this.benchmarkHistory.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  /**
   * Compare benchmark results
   */
  compareBenchmarks(benchmark1: string, benchmark2: string): {
    benchmark1: BenchmarkResult;
    benchmark2: BenchmarkResult;
    comparison: {
      throughputRatio: number;
      latencyRatio: number;
      memoryRatio: number;
      cpuRatio: number;
      winner: string;
      improvements: string[];
      regressions: string[];
    };
  } {
    const result1 = this.getBenchmarkResults(benchmark1) as BenchmarkResult;
    const result2 = this.getBenchmarkResults(benchmark2) as BenchmarkResult;

    const throughputRatio = result2.throughput / result1.throughput;
    const latencyRatio = result2.averageLatency / result1.averageLatency;
    const memoryRatio = result2.memoryUsage.after.heapUsed / result1.memoryUsage.after.heapUsed;
    const cpuRatio = (result2.cpuUsage.delta.user + result2.cpuUsage.delta.system) / 
                    (result1.cpuUsage.delta.user + result1.cpuUsage.delta.system);

    const improvements: string[] = [];
    const regressions: string[] = [];

    if (throughputRatio > 1.1) improvements.push(`Throughput improved by ${((throughputRatio - 1) * 100).toFixed(1)}%`);
    else if (throughputRatio < 0.9) regressions.push(`Throughput decreased by ${((1 - throughputRatio) * 100).toFixed(1)}%`);

    if (latencyRatio < 0.9) improvements.push(`Latency improved by ${((1 - latencyRatio) * 100).toFixed(1)}%`);
    else if (latencyRatio > 1.1) regressions.push(`Latency increased by ${((latencyRatio - 1) * 100).toFixed(1)}%`);

    if (memoryRatio < 0.9) improvements.push(`Memory usage improved by ${((1 - memoryRatio) * 100).toFixed(1)}%`);
    else if (memoryRatio > 1.1) regressions.push(`Memory usage increased by ${((memoryRatio - 1) * 100).toFixed(1)}%`);

    const winner = throughputRatio > 1 && latencyRatio < 1 ? benchmark2 : 
                  throughputRatio < 1 && latencyRatio > 1 ? benchmark1 : 
                  'mixed';

    return {
      benchmark1: result1,
      benchmark2: result2,
      comparison: {
        throughputRatio,
        latencyRatio,
        memoryRatio,
        cpuRatio,
        winner,
        improvements,
        regressions
      }
    };
  }

  /**
   * Get available benchmark configurations
   */
  getAvailableBenchmarks(): Array<{name: string; config: BenchmarkConfig}> {
    return Array.from(this.benchmarkConfigs.entries()).map(([name, config]) => ({
      name,
      config
    }));
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): {
    summary: {
      totalBenchmarks: number;
      averageThroughput: number;
      averageLatency: number;
      memoryEfficiency: number;
      cpuEfficiency: number;
    };
    topPerformers: Array<{
      name: string;
      metric: string;
      value: number;
    }>;
    recommendations: string[];
    trends: {
      throughputTrend: number[];
      latencyTrend: number[];
      memoryTrend: number[];
    };
  } {
    const recentResults = this.benchmarkHistory.slice(-20);
    
    if (recentResults.length === 0) {
      return {
        summary: { totalBenchmarks: 0, averageThroughput: 0, averageLatency: 0, memoryEfficiency: 0, cpuEfficiency: 0 },
        topPerformers: [],
        recommendations: ['No benchmark data available - run benchmarks to get performance insights'],
        trends: { throughputTrend: [], latencyTrend: [], memoryTrend: [] }
      };
    }

    const averageThroughput = recentResults.reduce((sum, r) => sum + r.throughput, 0) / recentResults.length;
    const averageLatency = recentResults.reduce((sum, r) => sum + r.averageLatency, 0) / recentResults.length;
    const averageMemory = recentResults.reduce((sum, r) => sum + r.memoryUsage.after.heapUsed, 0) / recentResults.length;

    const topPerformers = [
      {
        name: recentResults.sort((a, b) => b.throughput - a.throughput)[0].name,
        metric: 'Highest Throughput',
        value: Math.max(...recentResults.map(r => r.throughput))
      },
      {
        name: recentResults.sort((a, b) => a.averageLatency - b.averageLatency)[0].name,
        metric: 'Lowest Latency',
        value: Math.min(...recentResults.map(r => r.averageLatency))
      },
      {
        name: recentResults.sort((a, b) => a.memoryUsage.delta.heapUsed! - b.memoryUsage.delta.heapUsed!)[0].name,
        metric: 'Most Memory Efficient',
        value: Math.min(...recentResults.map(r => r.memoryUsage.delta.heapUsed || 0))
      }
    ];

    const recommendations: string[] = [];
    if (averageLatency > 50) {
      recommendations.push('Average latency is high - consider optimizing cache access patterns');
    }
    if (averageMemory > 500 * 1024 * 1024) { // 500MB
      recommendations.push('Memory usage is high - implement cache size limits and cleanup strategies');
    }
    
    const throughputTrend = recentResults.map(r => r.throughput);
    const latencyTrend = recentResults.map(r => r.averageLatency);
    const memoryTrend = recentResults.map(r => r.memoryUsage.after.heapUsed);

    return {
      summary: {
        totalBenchmarks: recentResults.length,
        averageThroughput: Math.round(averageThroughput),
        averageLatency: Math.round(averageLatency * 100) / 100,
        memoryEfficiency: Math.round((1 - averageMemory / (1024 * 1024 * 1024)) * 100), // % of 1GB
        cpuEfficiency: 85 // Placeholder - would need more sophisticated calculation
      },
      topPerformers,
      recommendations,
      trends: {
        throughputTrend,
        latencyTrend,
        memoryTrend
      }
    };
  }

  // Private methods

  private async executeBenchmark(config: BenchmarkConfig): Promise<BenchmarkResult> {
    const startTime = new Date();
    const memoryBefore = config.measureMemory ? process.memoryUsage() : {} as NodeJS.MemoryUsage;
    const cpuBefore = config.measureCpu ? process.cpuUsage() : {} as NodeJS.CpuUsage;
    let memoryPeak = memoryBefore;

    const latencies: number[] = [];
    const errors: Array<{ iteration: number; error: string; timestamp: Date }> = [];

    // Warmup phase
    if (config.warmupIterations > 0) {
      await this.runBenchmarkIterations(config, config.warmupIterations, false);
    }

    // Main benchmark execution
    const benchmarkStartTime = Date.now();

    if (config.concurrency === 1) {
      // Sequential execution
      for (let i = 0; i < config.iterations; i++) {
        try {
          const iterationStart = Date.now();
          await this.executeBenchmarkOperation(config, i);
          const latency = Date.now() - iterationStart;
          latencies.push(latency);

          // Track memory peak
          if (config.measureMemory) {
            const currentMemory = process.memoryUsage();
            if (currentMemory.heapUsed > memoryPeak.heapUsed) {
              memoryPeak = currentMemory;
            }
          }
        } catch (error) {
          errors.push({
            iteration: i,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date()
          });
        }
      }
    } else {
      // Concurrent execution
      const iterationsPerWorker = Math.ceil(config.iterations / config.concurrency);
      const workers: Promise<void>[] = [];

      for (let worker = 0; worker < config.concurrency; worker++) {
        const workerPromise = this.runConcurrentWorker(
          config,
          worker,
          iterationsPerWorker,
          latencies,
          errors
        );
        workers.push(workerPromise);
      }

      await Promise.all(workers);
    }

    const benchmarkEndTime = Date.now();
    const totalDuration = benchmarkEndTime - benchmarkStartTime;

    const memoryAfter = config.measureMemory ? process.memoryUsage() : {} as NodeJS.MemoryUsage;
    const cpuAfter = config.measureCpu ? process.cpuUsage(cpuBefore) : {} as NodeJS.CpuUsage;

    const endTime = new Date();

    // Calculate statistics
    latencies.sort((a, b) => a - b);
    const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
    const medianLatency = latencies[Math.floor(latencies.length / 2)];
    const p95Latency = latencies[Math.floor(latencies.length * 0.95)];
    const p99Latency = latencies[Math.floor(latencies.length * 0.99)];

    const result: BenchmarkResult = {
      name: config.name,
      config,
      startTime,
      endTime,
      iterations: latencies.length,
      totalDuration,
      averageLatency,
      medianLatency,
      p95Latency,
      p99Latency,
      minLatency: latencies[0] || 0,
      maxLatency: latencies[latencies.length - 1] || 0,
      throughput: (latencies.length / totalDuration) * 1000, // ops per second
      memoryUsage: {
        before: memoryBefore,
        after: memoryAfter,
        peak: memoryPeak,
        delta: {
          heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
          heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
          external: memoryAfter.external - memoryBefore.external,
          rss: memoryAfter.rss - memoryBefore.rss
        }
      },
      cpuUsage: {
        before: cpuBefore,
        after: cpuAfter,
        delta: cpuAfter
      },
      customMetrics: {},
      errors
    };

    return result;
  }

  private async runBenchmarkIterations(config: BenchmarkConfig, iterations: number, recordMetrics: boolean): Promise<void> {
    for (let i = 0; i < iterations; i++) {
      await this.executeBenchmarkOperation(config, i);
    }
  }

  private async runConcurrentWorker(
    config: BenchmarkConfig,
    workerId: number,
    iterations: number,
    latencies: number[],
    errors: Array<{ iteration: number; error: string; timestamp: Date }>
  ): Promise<void> {
    for (let i = 0; i < iterations; i++) {
      try {
        const iterationStart = Date.now();
        await this.executeBenchmarkOperation(config, workerId * iterations + i);
        const latency = Date.now() - iterationStart;
        latencies.push(latency);
      } catch (error) {
        errors.push({
          iteration: workerId * iterations + i,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        });
      }
    }
  }

  private async executeBenchmarkOperation(config: BenchmarkConfig, iteration: number): Promise<void> {
    const key = `benchmark:${config.name}:${iteration}`;
    const data = this.generateTestData(config.dataSize, iteration);

    switch (config.name) {
      case 'cache-basic-operations':
        await cacheService.set(key, data, { ttl: 300 });
        await cacheService.get(key);
        if (iteration % 10 === 0) {
          await cacheService.del(key);
        }
        break;

      case 'cache-concurrent-reads':
        await cacheService.set(key, data, { ttl: 300 });
        for (let i = 0; i < 5; i++) {
          await cacheService.get(key);
        }
        break;

      case 'cache-concurrent-writes':
        for (let i = 0; i < 3; i++) {
          await cacheService.set(`${key}:${i}`, data, { ttl: 300 });
        }
        break;

      case 'cache-mixed-operations':
        if (iteration % 4 === 0) {
          await cacheService.set(key, data, { ttl: 300 });
        } else {
          await cacheService.get(key);
        }
        break;

      case 'invalidation-patterns':
        await cacheService.set(key, data, { ttl: 300 });
        if (iteration % 5 === 0) {
          await cacheInvalidationService.invalidateByType('user', iteration.toString());
        }
        break;

      case 'session-management':
        if (iteration % 3 === 0) {
          await multiUserSessionService.createSession({
            userId: `benchmark_user_${iteration}`,
            deviceType: 'desktop',
            browser: 'Chrome',
            ipAddress: '127.0.0.1',
            userAgent: 'Benchmark',
            lastActivity: new Date()
          });
        } else {
          await multiUserSessionService.updateSessionActivity(`session_${iteration}`);
        }
        break;

      case 'geospatial-queries':
        if (iteration % 2 === 0) {
          await locationCacheService.findNearbyLocations({
            latitude: 37.7749 + (Math.random() - 0.5) * 0.1,
            longitude: -122.4194 + (Math.random() - 0.5) * 0.1,
            radius: 5,
            unit: 'km',
            limit: 10
          });
        }
        break;

      case 'realtime-updates':
        await realTimeCacheService.triggerUpdate({
          type: 'update',
          entity: 'user',
          entityId: `benchmark_entity_${iteration}`,
          data: data,
          metadata: {
            timestamp: new Date(),
            source: 'benchmark',
            priority: 'normal'
          }
        });
        break;

      default:
        // Default to basic cache operations
        await cacheService.set(key, data, { ttl: 300 });
        await cacheService.get(key);
        break;
    }
  }

  private generateTestData(size: 'small' | 'medium' | 'large' | 'xlarge', iteration: number): any {
    const baseData = {
      id: iteration,
      timestamp: Date.now(),
      benchmark: true
    };

    switch (size) {
      case 'small':
        return baseData;

      case 'medium':
        return {
          ...baseData,
          data: 'x'.repeat(1024), // 1KB
          metadata: {
            version: 1,
            tags: ['benchmark', 'test', 'medium'],
            properties: { a: 1, b: 2, c: 3 }
          }
        };

      case 'large':
        return {
          ...baseData,
          data: 'x'.repeat(10240), // 10KB
          largeArray: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item_${i}` })),
          metadata: {
            version: 1,
            tags: ['benchmark', 'test', 'large'],
            properties: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`prop_${i}`, `value_${i}`]))
          }
        };

      case 'xlarge':
        return {
          ...baseData,
          data: 'x'.repeat(102400), // 100KB
          largeArray: Array.from({ length: 10000 }, (_, i) => ({ 
            id: i, 
            value: `item_${i}`,
            data: 'x'.repeat(50)
          })),
          metadata: {
            version: 1,
            tags: ['benchmark', 'test', 'xlarge'],
            properties: Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`prop_${i}`, `value_${i}`]))
          }
        };

      default:
        return baseData;
    }
  }

  private calculateSuiteSummary(results: BenchmarkResult[], totalDuration: number): BenchmarkSuite['summary'] {
    if (results.length === 0) {
      return {
        totalDuration,
        averageThroughput: 0,
        averageLatency: 0,
        totalErrors: 0,
        memoryEfficiency: 0,
        cpuEfficiency: 0
      };
    }

    const averageThroughput = results.reduce((sum, r) => sum + r.throughput, 0) / results.length;
    const averageLatency = results.reduce((sum, r) => sum + r.averageLatency, 0) / results.length;
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
    const memoryEfficiency = Math.round((1 - results.reduce((sum, r) => sum + (r.memoryUsage.delta.heapUsed || 0), 0) / (results.length * 100 * 1024 * 1024)) * 100);
    const cpuEfficiency = 85; // Placeholder

    return {
      totalDuration,
      averageThroughput: Math.round(averageThroughput),
      averageLatency: Math.round(averageLatency * 100) / 100,
      totalErrors,
      memoryEfficiency,
      cpuEfficiency
    };
  }
}

// Export singleton instance
export const performanceBenchmarkService = new PerformanceBenchmarkService();
export default performanceBenchmarkService;