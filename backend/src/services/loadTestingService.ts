/**
 * Comprehensive Load Testing Service
 * Advanced performance testing suite for Redis cache infrastructure
 */

import cacheService from './cacheService';
import { multiUserSessionService } from './multiUserSessionService';
import { realTimeCacheService } from './realTimeCacheService';
import { locationCacheService } from './locationCacheService';
import cacheInvalidationService from './cacheInvalidationService';
import { logger } from '../utils/logger';

// Load testing configuration types
export interface LoadTestConfig {
  testName: string;
  duration: number; // seconds
  concurrentUsers: number;
  requestsPerSecond: number;
  operationMix: {
    read: number; // percentage
    write: number;
    delete: number;
    invalidate: number;
  };
  cacheTypes: string[];
  warmupTime?: number; // seconds
  cooldownTime?: number; // seconds
}

export interface LoadTestMetrics {
  testName: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  medianResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  requestsPerSecond: number;
  errorsPerSecond: number;
  cacheHitRate: number;
  cacheMissRate: number;
  memoryUsage: {
    before: NodeJS.MemoryUsage;
    after: NodeJS.MemoryUsage;
    peak: NodeJS.MemoryUsage;
  };
  operationBreakdown: {
    read: LoadTestOperationMetrics;
    write: LoadTestOperationMetrics;
    delete: LoadTestOperationMetrics;
    invalidate: LoadTestOperationMetrics;
  };
  errorBreakdown: Record<string, number>;
  customMetrics?: Record<string, any>;
}

export interface LoadTestOperationMetrics {
  count: number;
  successCount: number;
  failureCount: number;
  averageTime: number;
  maxTime: number;
  minTime: number;
}

/**
 * Load Testing Service with Advanced Performance Analysis
 */
class LoadTestingService {
  private activeTests = new Map<string, LoadTestRunner>();
  private testHistory: LoadTestMetrics[] = [];
  private performanceBaseline: Map<string, LoadTestMetrics> = new Map();

  // Predefined test configurations
  private testConfigs: Record<string, LoadTestConfig> = {
    'basic-cache-load': {
      testName: 'Basic Cache Load Test',
      duration: 30,
      concurrentUsers: 10,
      requestsPerSecond: 100,
      operationMix: { read: 70, write: 20, delete: 5, invalidate: 5 },
      cacheTypes: ['user', 'form', 'session'],
      warmupTime: 5,
      cooldownTime: 3
    },
    'high-concurrency': {
      testName: 'High Concurrency Test',
      duration: 60,
      concurrentUsers: 50,
      requestsPerSecond: 500,
      operationMix: { read: 80, write: 15, delete: 3, invalidate: 2 },
      cacheTypes: ['user', 'form', 'session', 'location'],
      warmupTime: 10,
      cooldownTime: 5
    },
    'write-heavy': {
      testName: 'Write Heavy Load Test',
      duration: 45,
      concurrentUsers: 25,
      requestsPerSecond: 300,
      operationMix: { read: 40, write: 50, delete: 5, invalidate: 5 },
      cacheTypes: ['user', 'form', 'submission'],
      warmupTime: 7,
      cooldownTime: 3
    },
    'invalidation-stress': {
      testName: 'Invalidation Stress Test',
      duration: 30,
      concurrentUsers: 20,
      requestsPerSecond: 200,
      operationMix: { read: 50, write: 20, delete: 10, invalidate: 20 },
      cacheTypes: ['user', 'form', 'session', 'location'],
      warmupTime: 5,
      cooldownTime: 5
    },
    'session-management-load': {
      testName: 'Multi-User Session Load Test',
      duration: 40,
      concurrentUsers: 30,
      requestsPerSecond: 250,
      operationMix: { read: 60, write: 30, delete: 5, invalidate: 5 },
      cacheTypes: ['session', 'user'],
      warmupTime: 8,
      cooldownTime: 4
    },
    'geospatial-load': {
      testName: 'Geospatial Cache Load Test',
      duration: 35,
      concurrentUsers: 15,
      requestsPerSecond: 150,
      operationMix: { read: 85, write: 10, delete: 3, invalidate: 2 },
      cacheTypes: ['location'],
      warmupTime: 6,
      cooldownTime: 3
    },
    'extreme-load': {
      testName: 'Extreme Load Test',
      duration: 120,
      concurrentUsers: 100,
      requestsPerSecond: 1000,
      operationMix: { read: 75, write: 20, delete: 3, invalidate: 2 },
      cacheTypes: ['user', 'form', 'session', 'location', 'submission'],
      warmupTime: 15,
      cooldownTime: 10
    }
  };

  /**
   * Start load test with specified configuration
   */
  async startLoadTest(configName: string | LoadTestConfig): Promise<string> {
    const config = typeof configName === 'string' ? this.testConfigs[configName] : configName;
    
    if (!config) {
      throw new Error(`Load test configuration '${configName}' not found`);
    }

    const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const runner = new LoadTestRunner(testId, config);
    
    this.activeTests.set(testId, runner);

    logger.info('Load test started', {
      testId,
      testName: config.testName,
      duration: config.duration,
      concurrentUsers: config.concurrentUsers,
      requestsPerSecond: config.requestsPerSecond
    });

    // Start the test asynchronously
    runner.execute().then(metrics => {
      this.testHistory.push(metrics);
      this.activeTests.delete(testId);
      
      logger.info('Load test completed', {
        testId,
        testName: metrics.testName,
        totalRequests: metrics.totalRequests,
        successRate: (metrics.successfulRequests / metrics.totalRequests * 100).toFixed(2) + '%',
        averageResponseTime: metrics.averageResponseTime + 'ms'
      });
    }).catch(error => {
      logger.error('Load test failed', {
        testId,
        testName: config.testName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      this.activeTests.delete(testId);
    });

    return testId;
  }

  /**
   * Get test status and real-time metrics
   */
  getTestStatus(testId: string): {
    isActive: boolean;
    progress?: number;
    currentMetrics?: Partial<LoadTestMetrics>;
  } {
    const runner = this.activeTests.get(testId);
    if (!runner) {
      return { isActive: false };
    }

    return {
      isActive: true,
      progress: runner.getProgress(),
      currentMetrics: runner.getCurrentMetrics()
    };
  }

  /**
   * Stop active test
   */
  async stopLoadTest(testId: string): Promise<boolean> {
    const runner = this.activeTests.get(testId);
    if (!runner) {
      return false;
    }

    await runner.stop();
    this.activeTests.delete(testId);
    
    logger.info('Load test stopped manually', { testId });
    return true;
  }

  /**
   * Get test results
   */
  getTestResults(testId?: string): LoadTestMetrics | LoadTestMetrics[] {
    if (testId) {
      const result = this.testHistory.find(test => test.testName.includes(testId));
      if (!result) {
        throw new Error(`Test results for '${testId}' not found`);
      }
      return result;
    }

    return this.testHistory.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  /**
   * Run comprehensive test suite
   */
  async runTestSuite(suiteType: 'basic' | 'comprehensive' | 'stress' = 'basic'): Promise<LoadTestMetrics[]> {
    const suites = {
      basic: ['basic-cache-load', 'session-management-load'],
      comprehensive: ['basic-cache-load', 'high-concurrency', 'write-heavy', 'session-management-load', 'geospatial-load'],
      stress: ['high-concurrency', 'write-heavy', 'invalidation-stress', 'extreme-load']
    };

    const testConfigs = suites[suiteType];
    const results: LoadTestMetrics[] = [];

    logger.info('Starting load test suite', {
      suiteType,
      testCount: testConfigs.length,
      estimatedDuration: testConfigs.reduce((sum, name) => sum + this.testConfigs[name].duration, 0)
    });

    for (const configName of testConfigs) {
      logger.info(`Running test: ${configName}`);
      
      const testId = await this.startLoadTest(configName);
      
      // Wait for test completion
      await this.waitForTestCompletion(testId);
      
      const result = this.testHistory[this.testHistory.length - 1];
      results.push(result);
      
      // Brief pause between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    logger.info('Load test suite completed', {
      suiteType,
      testsCompleted: results.length,
      overallSuccessRate: this.calculateOverallSuccessRate(results)
    });

    return results;
  }

  /**
   * Set performance baseline from test results
   */
  setPerformanceBaseline(testName: string, metrics: LoadTestMetrics): void {
    this.performanceBaseline.set(testName, metrics);
    logger.info('Performance baseline set', {
      testName,
      baselineResponseTime: metrics.averageResponseTime,
      baselineSuccessRate: (metrics.successfulRequests / metrics.totalRequests * 100).toFixed(2)
    });
  }

  /**
   * Compare current performance against baseline
   */
  compareWithBaseline(testName: string, currentMetrics: LoadTestMetrics): {
    responseTimeRatio: number;
    successRateChange: number;
    throughputRatio: number;
    isRegression: boolean;
    recommendations: string[];
  } {
    const baseline = this.performanceBaseline.get(testName);
    if (!baseline) {
      throw new Error(`No baseline found for test: ${testName}`);
    }

    const responseTimeRatio = currentMetrics.averageResponseTime / baseline.averageResponseTime;
    const currentSuccessRate = currentMetrics.successfulRequests / currentMetrics.totalRequests * 100;
    const baselineSuccessRate = baseline.successfulRequests / baseline.totalRequests * 100;
    const successRateChange = currentSuccessRate - baselineSuccessRate;
    const throughputRatio = currentMetrics.requestsPerSecond / baseline.requestsPerSecond;

    const isRegression = responseTimeRatio > 1.1 || successRateChange < -5 || throughputRatio < 0.9;
    
    const recommendations: string[] = [];
    if (responseTimeRatio > 1.2) {
      recommendations.push('Response time degraded significantly - check cache hit rates and system resources');
    }
    if (successRateChange < -10) {
      recommendations.push('Success rate dropped - investigate error patterns and system stability');
    }
    if (throughputRatio < 0.8) {
      recommendations.push('Throughput decreased - analyze bottlenecks and scaling requirements');
    }

    return {
      responseTimeRatio,
      successRateChange,
      throughputRatio,
      isRegression,
      recommendations
    };
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): {
    summary: {
      totalTests: number;
      averageSuccessRate: number;
      averageResponseTime: number;
      totalRequestsProcessed: number;
    };
    trends: {
      responseTimeTrend: number[];
      successRateTrend: number[];
      throughputTrend: number[];
    };
    recommendations: string[];
  } {
    const recentTests = this.testHistory.slice(-10);
    
    const totalRequests = recentTests.reduce((sum, test) => sum + test.totalRequests, 0);
    const totalSuccessful = recentTests.reduce((sum, test) => sum + test.successfulRequests, 0);
    const averageSuccessRate = totalSuccessful / totalRequests * 100;
    const averageResponseTime = recentTests.reduce((sum, test) => sum + test.averageResponseTime, 0) / recentTests.length;

    const responseTimeTrend = recentTests.map(test => test.averageResponseTime);
    const successRateTrend = recentTests.map(test => test.successfulRequests / test.totalRequests * 100);
    const throughputTrend = recentTests.map(test => test.requestsPerSecond);

    const recommendations: string[] = [];
    if (averageResponseTime > 100) {
      recommendations.push('Consider implementing cache warming strategies to reduce response times');
    }
    if (averageSuccessRate < 95) {
      recommendations.push('Investigate error patterns and improve system resilience');
    }

    return {
      summary: {
        totalTests: recentTests.length,
        averageSuccessRate: Math.round(averageSuccessRate * 100) / 100,
        averageResponseTime: Math.round(averageResponseTime * 100) / 100,
        totalRequestsProcessed: totalRequests
      },
      trends: {
        responseTimeTrend,
        successRateTrend,
        throughputTrend
      },
      recommendations
    };
  }

  /**
   * Get available test configurations
   */
  getAvailableTests(): Array<{name: string; config: LoadTestConfig}> {
    return Object.entries(this.testConfigs).map(([name, config]) => ({
      name,
      config
    }));
  }

  // Private helper methods

  private async waitForTestCompletion(testId: string): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const status = this.getTestStatus(testId);
        if (!status.isActive) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000);
    });
  }

  private calculateOverallSuccessRate(results: LoadTestMetrics[]): number {
    const totalRequests = results.reduce((sum, result) => sum + result.totalRequests, 0);
    const totalSuccessful = results.reduce((sum, result) => sum + result.successfulRequests, 0);
    return Math.round(totalSuccessful / totalRequests * 10000) / 100; // 2 decimal places
  }
}

/**
 * Load Test Runner - Executes individual load tests
 */
class LoadTestRunner {
  private config: LoadTestConfig;
  private testId: string;
  private startTime?: Date;
  private endTime?: Date;
  private isRunning = false;
  private shouldStop = false;
  private requests: Array<{
    timestamp: Date;
    operation: string;
    success: boolean;
    responseTime: number;
    error?: string;
  }> = [];
  private workers: Array<NodeJS.Timer> = [];

  constructor(testId: string, config: LoadTestConfig) {
    this.testId = testId;
    this.config = config;
  }

  async execute(): Promise<LoadTestMetrics> {
    this.isRunning = true;
    this.startTime = new Date();
    
    const memoryBefore = process.memoryUsage();
    let memoryPeak = memoryBefore;

    logger.info('Load test execution started', {
      testId: this.testId,
      config: this.config
    });

    // Warmup phase
    if (this.config.warmupTime) {
      await this.runWarmup();
    }

    // Main test execution
    await this.runMainTest();

    // Cooldown phase
    if (this.config.cooldownTime) {
      await this.runCooldown();
    }

    this.endTime = new Date();
    this.isRunning = false;

    const memoryAfter = process.memoryUsage();
    
    // Calculate metrics
    const metrics = this.calculateMetrics({
      before: memoryBefore,
      after: memoryAfter,
      peak: memoryPeak
    });

    return metrics;
  }

  async stop(): Promise<void> {
    this.shouldStop = true;
    this.workers.forEach(worker => clearInterval(worker));
    this.workers = [];
    this.isRunning = false;
  }

  getProgress(): number {
    if (!this.startTime) return 0;
    if (this.endTime) return 100;
    
    const elapsed = Date.now() - this.startTime.getTime();
    const total = this.config.duration * 1000;
    return Math.min(elapsed / total * 100, 100);
  }

  getCurrentMetrics(): Partial<LoadTestMetrics> {
    if (this.requests.length === 0) return {};

    const successful = this.requests.filter(r => r.success).length;
    const responseTimes = this.requests.map(r => r.responseTime);
    const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;

    return {
      totalRequests: this.requests.length,
      successfulRequests: successful,
      failedRequests: this.requests.length - successful,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100
    };
  }

  private async runWarmup(): Promise<void> {
    logger.info('Starting warmup phase', {
      testId: this.testId,
      duration: this.config.warmupTime
    });

    // Warm up cache with sample data
    for (let i = 0; i < 100; i++) {
      await cacheService.set(`warmup:${i}`, { data: `sample_${i}` }, { ttl: 300 });
    }

    await new Promise(resolve => setTimeout(resolve, (this.config.warmupTime || 0) * 1000));
  }

  private async runMainTest(): Promise<void> {
    const requestInterval = 1000 / this.config.requestsPerSecond;
    const endTime = Date.now() + (this.config.duration * 1000);

    logger.info('Starting main test phase', {
      testId: this.testId,
      duration: this.config.duration,
      requestInterval
    });

    // Create concurrent workers
    const workersPromises: Promise<void>[] = [];
    
    for (let i = 0; i < this.config.concurrentUsers; i++) {
      const workerPromise = this.createWorker(i, endTime, requestInterval);
      workersPromises.push(workerPromise);
    }

    // Wait for all workers to complete
    await Promise.all(workersPromises);
  }

  private async createWorker(workerId: number, endTime: number, baseInterval: number): Promise<void> {
    const interval = baseInterval + (Math.random() * 10); // Add jitter
    
    return new Promise((resolve) => {
      const executeRequest = async () => {
        if (Date.now() > endTime || this.shouldStop) {
          resolve();
          return;
        }

        const operation = this.selectOperation();
        const startTime = Date.now();
        
        try {
          await this.executeOperation(operation, workerId);
          
          const responseTime = Date.now() - startTime;
          this.requests.push({
            timestamp: new Date(),
            operation,
            success: true,
            responseTime
          });
        } catch (error) {
          const responseTime = Date.now() - startTime;
          this.requests.push({
            timestamp: new Date(),
            operation,
            success: false,
            responseTime,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }

        setTimeout(executeRequest, interval);
      };

      executeRequest();
    });
  }

  private selectOperation(): string {
    const rand = Math.random() * 100;
    const mix = this.config.operationMix;
    
    if (rand < mix.read) return 'read';
    if (rand < mix.read + mix.write) return 'write';
    if (rand < mix.read + mix.write + mix.delete) return 'delete';
    return 'invalidate';
  }

  private async executeOperation(operation: string, workerId: number): Promise<void> {
    const cacheType = this.config.cacheTypes[Math.floor(Math.random() * this.config.cacheTypes.length)];
    const key = `${cacheType}:test:${workerId}:${Math.floor(Math.random() * 1000)}`;
    
    switch (operation) {
      case 'read':
        await cacheService.get(key);
        break;
        
      case 'write':
        await cacheService.set(key, { data: `test_data_${Date.now()}` }, { ttl: 300 });
        break;
        
      case 'delete':
        await cacheService.del(key);
        break;
        
      case 'invalidate':
        await cacheInvalidationService.invalidateByType(cacheType, workerId.toString());
        break;
    }
  }

  private async runCooldown(): Promise<void> {
    logger.info('Starting cooldown phase', {
      testId: this.testId,
      duration: this.config.cooldownTime
    });

    await new Promise(resolve => setTimeout(resolve, (this.config.cooldownTime || 0) * 1000));
  }

  private calculateMetrics(memoryUsage: LoadTestMetrics['memoryUsage']): LoadTestMetrics {
    const successful = this.requests.filter(r => r.success);
    const failed = this.requests.filter(r => !r.success);
    const responseTimes = this.requests.map(r => r.responseTime).sort((a, b) => a - b);
    
    const duration = this.endTime!.getTime() - this.startTime!.getTime();
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);
    
    // Calculate operation breakdown
    const operationBreakdown: LoadTestMetrics['operationBreakdown'] = {
      read: this.calculateOperationMetrics('read'),
      write: this.calculateOperationMetrics('write'),
      delete: this.calculateOperationMetrics('delete'),
      invalidate: this.calculateOperationMetrics('invalidate')
    };

    // Calculate error breakdown
    const errorBreakdown: Record<string, number> = {};
    failed.forEach(req => {
      const error = req.error || 'Unknown error';
      errorBreakdown[error] = (errorBreakdown[error] || 0) + 1;
    });

    return {
      testName: this.config.testName,
      startTime: this.startTime!,
      endTime: this.endTime!,
      duration: duration / 1000,
      totalRequests: this.requests.length,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      averageResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
      medianResponseTime: responseTimes[Math.floor(responseTimes.length / 2)],
      p95ResponseTime: responseTimes[p95Index] || 0,
      p99ResponseTime: responseTimes[p99Index] || 0,
      maxResponseTime: Math.max(...responseTimes),
      minResponseTime: Math.min(...responseTimes),
      requestsPerSecond: this.requests.length / (duration / 1000),
      errorsPerSecond: failed.length / (duration / 1000),
      cacheHitRate: 0, // Would need cache service integration
      cacheMissRate: 0, // Would need cache service integration
      memoryUsage,
      operationBreakdown,
      errorBreakdown
    };
  }

  private calculateOperationMetrics(operation: string): LoadTestOperationMetrics {
    const operationRequests = this.requests.filter(r => r.operation === operation);
    const successful = operationRequests.filter(r => r.success);
    const responseTimes = operationRequests.map(r => r.responseTime);

    return {
      count: operationRequests.length,
      successCount: successful.length,
      failureCount: operationRequests.length - successful.length,
      averageTime: responseTimes.length > 0 ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0,
      maxTime: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
      minTime: responseTimes.length > 0 ? Math.min(...responseTimes) : 0
    };
  }
}

// Export singleton instance
export const loadTestingService = new LoadTestingService();
export default loadTestingService;