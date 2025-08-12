/**
 * WebSocket Optimization Load Testing Suite
 * Comprehensive load testing validation for WebSocket optimization service
 */

import { performance } from 'perf_hooks';
import axios from 'axios';
import { WebSocket } from 'ws';
import { logger } from '../../utils/logger';

interface LoadTestConfig {
  baseUrl: string;
  adminToken: string;
  concurrentConnections: number;
  messagesPerConnection: number;
  testDurationMs: number;
  rampUpTimeMs: number;
}

interface LoadTestMetrics {
  totalConnections: number;
  successfulConnections: number;
  failedConnections: number;
  totalMessages: number;
  successfulMessages: number;
  failedMessages: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  avgThroughput: number;
  memoryUsageBefore: number;
  memoryUsageAfter: number;
  cpuUsageBefore: number;
  cpuUsageAfter: number;
  errors: Array<{ type: string; message: string; count: number }>;
}

interface TestScenario {
  name: string;
  description: string;
  config: Partial<LoadTestConfig>;
  expectedResults: {
    minSuccessRate: number;
    maxResponseTime: number;
    minThroughput: number;
  };
}

class WebSocketOptimizationLoadTest {
  private config: LoadTestConfig;
  private metrics: LoadTestMetrics;
  private startTime: number = 0;
  private activeConnections: WebSocket[] = [];
  private responseTimes: number[] = [];

  constructor(config: LoadTestConfig) {
    this.config = config;
    this.metrics = this.initializeMetrics();
  }

  /**
   * Run comprehensive load testing suite
   */
  async runLoadTestSuite(): Promise<{
    scenarioResults: Array<{ scenario: TestScenario; metrics: LoadTestMetrics; passed: boolean }>;
    overallResults: {
      totalScenarios: number;
      passedScenarios: number;
      failedScenarios: number;
      overallHealthScore: number;
    };
  }> {
    logger.info('Starting WebSocket Optimization Load Testing Suite');

    const scenarios: TestScenario[] = [
      {
        name: 'Basic Connection Load',
        description: 'Test basic connection handling with moderate load',
        config: {
          concurrentConnections: 100,
          messagesPerConnection: 10,
          testDurationMs: 30000,
          rampUpTimeMs: 5000
        },
        expectedResults: {
          minSuccessRate: 95,
          maxResponseTime: 500,
          minThroughput: 50
        }
      },
      {
        name: 'High Concurrency Test',
        description: 'Test system under high concurrent connection load',
        config: {
          concurrentConnections: 500,
          messagesPerConnection: 5,
          testDurationMs: 60000,
          rampUpTimeMs: 10000
        },
        expectedResults: {
          minSuccessRate: 90,
          maxResponseTime: 1000,
          minThroughput: 100
        }
      },
      {
        name: 'Message Queue Stress Test',
        description: 'Test message queuing under heavy load',
        config: {
          concurrentConnections: 200,
          messagesPerConnection: 50,
          testDurationMs: 45000,
          rampUpTimeMs: 5000
        },
        expectedResults: {
          minSuccessRate: 92,
          maxResponseTime: 800,
          minThroughput: 200
        }
      },
      {
        name: 'Sustained Load Test',
        description: 'Test system stability under sustained load',
        config: {
          concurrentConnections: 300,
          messagesPerConnection: 20,
          testDurationMs: 120000,
          rampUpTimeMs: 15000
        },
        expectedResults: {
          minSuccessRate: 88,
          maxResponseTime: 1200,
          minThroughput: 80
        }
      },
      {
        name: 'Optimization Validation',
        description: 'Validate optimization features under load',
        config: {
          concurrentConnections: 400,
          messagesPerConnection: 15,
          testDurationMs: 90000,
          rampUpTimeMs: 10000
        },
        expectedResults: {
          minSuccessRate: 85,
          maxResponseTime: 1500,
          minThroughput: 120
        }
      }
    ];

    const scenarioResults = [];
    let passedScenarios = 0;

    for (const scenario of scenarios) {
      logger.info(`Running scenario: ${scenario.name}`);
      
      // Merge scenario config with base config
      const testConfig = { ...this.config, ...scenario.config };
      
      // Reset metrics for each scenario
      this.metrics = this.initializeMetrics();
      
      // Run the scenario
      const metrics = await this.runSingleScenario(testConfig);
      
      // Validate results
      const passed = this.validateScenarioResults(metrics, scenario.expectedResults);
      if (passed) passedScenarios++;
      
      scenarioResults.push({
        scenario,
        metrics,
        passed
      });

      // Cool down between scenarios
      await this.delay(5000);
      
      logger.info(`Scenario ${scenario.name} ${passed ? 'PASSED' : 'FAILED'}`);
    }

    const overallHealthScore = this.calculateOverallHealthScore(scenarioResults);

    const overallResults = {
      totalScenarios: scenarios.length,
      passedScenarios,
      failedScenarios: scenarios.length - passedScenarios,
      overallHealthScore
    };

    logger.info('WebSocket Optimization Load Testing Suite completed', {
      passed: passedScenarios,
      failed: overallResults.failedScenarios,
      healthScore: overallHealthScore
    });

    return { scenarioResults, overallResults };
  }

  /**
   * Run single load test scenario
   */
  private async runSingleScenario(config: LoadTestConfig): Promise<LoadTestMetrics> {
    this.startTime = performance.now();
    this.metrics.memoryUsageBefore = process.memoryUsage().heapUsed;
    this.metrics.cpuUsageBefore = process.cpuUsage().user + process.cpuUsage().system;

    try {
      // Create connection pools and queues for testing
      await this.setupTestInfrastructure();

      // Phase 1: Ramp up connections
      await this.rampUpConnections(config);

      // Phase 2: Send messages and measure performance
      await this.sendTestMessages(config);

      // Phase 3: Monitor and collect metrics
      await this.monitorPerformance(config.testDurationMs);

      // Phase 4: Optimize and re-test
      await this.testOptimization();

    } catch (error) {
      logger.error('Load test scenario failed', { error });
      this.addError('scenario_failure', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      // Cleanup connections
      await this.cleanupConnections();
    }

    this.metrics.memoryUsageAfter = process.memoryUsage().heapUsed;
    this.metrics.cpuUsageAfter = process.cpuUsage().user + process.cpuUsage().system;

    // Calculate final metrics
    this.calculateFinalMetrics();

    return this.metrics;
  }

  /**
   * Setup test infrastructure
   */
  private async setupTestInfrastructure(): Promise<void> {
    try {
      // Create test connection pool
      const poolResponse = await axios.post(`${this.config.baseUrl}/api/websocket/pools`, {
        name: `load_test_pool_${Date.now()}`,
        maxConnections: this.config.concurrentConnections * 2,
        connectionTimeout: 30000,
        idleTimeout: 300000
      }, {
        headers: { Authorization: `Bearer ${this.config.adminToken}` }
      });

      // Create test message queues
      const queueTypes = ['realtime', 'broadcast', 'notification', 'system'];
      for (const type of queueTypes) {
        await axios.post(`${this.config.baseUrl}/api/websocket/queues`, {
          name: `load_test_${type}_${Date.now()}`,
          type,
          maxSize: 10000,
          processingRate: 200,
          retryAttempts: 3,
          dlqEnabled: true
        }, {
          headers: { Authorization: `Bearer ${this.config.adminToken}` }
        });
      }

      logger.info('Test infrastructure setup completed');

    } catch (error) {
      logger.error('Failed to setup test infrastructure', { error });
      this.addError('infrastructure_setup', error instanceof Error ? error.message : 'Setup failed');
    }
  }

  /**
   * Ramp up connections gradually
   */
  private async rampUpConnections(config: LoadTestConfig): Promise<void> {
    const rampUpInterval = config.rampUpTimeMs / config.concurrentConnections;
    
    for (let i = 0; i < config.concurrentConnections; i++) {
      try {
        const startTime = performance.now();
        
        // Simulate WebSocket connection (using HTTP for testing)
        const response = await axios.get(`${config.baseUrl}/api/websocket/health`, {
          headers: { Authorization: `Bearer ${this.config.adminToken}` }
        });

        const responseTime = performance.now() - startTime;
        this.responseTimes.push(responseTime);

        if (response.status === 200) {
          this.metrics.successfulConnections++;
        } else {
          this.metrics.failedConnections++;
          this.addError('connection_failed', `HTTP ${response.status}`);
        }

      } catch (error) {
        this.metrics.failedConnections++;
        this.addError('connection_error', error instanceof Error ? error.message : 'Unknown error');
      }

      this.metrics.totalConnections++;

      // Wait for ramp-up interval
      if (i < config.concurrentConnections - 1) {
        await this.delay(rampUpInterval);
      }
    }

    logger.info('Connection ramp-up completed', {
      successful: this.metrics.successfulConnections,
      failed: this.metrics.failedConnections
    });
  }

  /**
   * Send test messages
   */
  private async sendTestMessages(config: LoadTestConfig): Promise<void> {
    const messagePromises = [];

    for (let i = 0; i < config.messagesPerConnection; i++) {
      for (let j = 0; j < this.metrics.successfulConnections; j++) {
        const messagePromise = this.sendSingleMessage(j, i);
        messagePromises.push(messagePromise);

        // Batch messages to avoid overwhelming the system
        if (messagePromises.length >= 50) {
          await Promise.allSettled(messagePromises.splice(0, 50));
        }
      }
    }

    // Send remaining messages
    if (messagePromises.length > 0) {
      await Promise.allSettled(messagePromises);
    }

    logger.info('Message sending completed', {
      total: this.metrics.totalMessages,
      successful: this.metrics.successfulMessages,
      failed: this.metrics.failedMessages
    });
  }

  /**
   * Send single test message
   */
  private async sendSingleMessage(connectionIndex: number, messageIndex: number): Promise<void> {
    try {
      const startTime = performance.now();

      const response = await axios.post(`${this.config.baseUrl}/api/websocket/messages/queue`, {
        type: 'load_test_message',
        priority: 'medium',
        payload: {
          connectionIndex,
          messageIndex,
          timestamp: new Date().toISOString(),
          data: `Load test message ${messageIndex} from connection ${connectionIndex}`
        },
        targetUsers: [`test_user_${connectionIndex}`]
      }, {
        headers: { Authorization: `Bearer ${this.config.adminToken}` }
      });

      const responseTime = performance.now() - startTime;
      this.responseTimes.push(responseTime);

      if (response.status === 200) {
        this.metrics.successfulMessages++;
      } else {
        this.metrics.failedMessages++;
        this.addError('message_failed', `HTTP ${response.status}`);
      }

    } catch (error) {
      this.metrics.failedMessages++;
      this.addError('message_error', error instanceof Error ? error.message : 'Unknown error');
    }

    this.metrics.totalMessages++;
  }

  /**
   * Monitor performance during test
   */
  private async monitorPerformance(durationMs: number): Promise<void> {
    const monitoringInterval = 5000; // Monitor every 5 seconds
    const iterations = Math.floor(durationMs / monitoringInterval);

    for (let i = 0; i < iterations; i++) {
      try {
        const metricsResponse = await axios.get(`${this.config.baseUrl}/api/websocket/metrics`, {
          headers: { Authorization: `Bearer ${this.config.adminToken}` }
        });

        if (metricsResponse.status === 200) {
          const systemMetrics = metricsResponse.data.data.metrics;
          
          // Log key metrics
          logger.debug('Performance monitoring checkpoint', {
            iteration: i + 1,
            memoryUsage: systemMetrics.memory.percentage,
            activeConnections: systemMetrics.connections.active,
            messagesThroughput: systemMetrics.messages.throughput,
            avgLatency: systemMetrics.messages.avgLatency
          });

          // Check for performance degradation
          if (systemMetrics.memory.percentage > 90) {
            this.addError('high_memory_usage', `Memory usage: ${systemMetrics.memory.percentage}%`);
          }

          if (systemMetrics.messages.avgLatency > 1000) {
            this.addError('high_latency', `Average latency: ${systemMetrics.messages.avgLatency}ms`);
          }
        }

      } catch (error) {
        this.addError('monitoring_error', error instanceof Error ? error.message : 'Monitoring failed');
      }

      await this.delay(monitoringInterval);
    }
  }

  /**
   * Test optimization features
   */
  private async testOptimization(): Promise<void> {
    try {
      logger.info('Testing optimization features');

      const optimizationResponse = await axios.post(`${this.config.baseUrl}/api/websocket/optimize`, {}, {
        headers: { Authorization: `Bearer ${this.config.adminToken}` }
      });

      if (optimizationResponse.status === 200) {
        const optimizationData = optimizationResponse.data.data;
        
        logger.info('Optimization completed', {
          optimizations: optimizationData.optimizations,
          memoryReduction: optimizationData.performanceImprovement.memoryReduction,
          latencyImprovement: optimizationData.performanceImprovement.messageLatencyImprovement
        });

        // Wait for optimization to take effect
        await this.delay(5000);

        // Send additional messages to test optimization impact
        await this.sendOptimizationTestMessages();

      } else {
        this.addError('optimization_failed', `HTTP ${optimizationResponse.status}`);
      }

    } catch (error) {
      this.addError('optimization_error', error instanceof Error ? error.message : 'Optimization failed');
    }
  }

  /**
   * Send messages to test optimization impact
   */
  private async sendOptimizationTestMessages(): Promise<void> {
    const optimizationMessages = 20;
    const optimizationPromises = [];

    for (let i = 0; i < optimizationMessages; i++) {
      const messagePromise = axios.post(`${this.config.baseUrl}/api/websocket/messages/queue`, {
        type: 'optimization_test_message',
        priority: 'high',
        payload: {
          messageIndex: i,
          timestamp: new Date().toISOString(),
          data: `Optimization test message ${i}`
        }
      }, {
        headers: { Authorization: `Bearer ${this.config.adminToken}` }
      });

      optimizationPromises.push(messagePromise);
    }

    const results = await Promise.allSettled(optimizationPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    logger.info('Optimization test messages completed', {
      total: optimizationMessages,
      successful,
      failed: optimizationMessages - successful
    });
  }

  /**
   * Cleanup connections and resources
   */
  private async cleanupConnections(): Promise<void> {
    // Close all active connections
    this.activeConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    this.activeConnections = [];
    
    // Allow time for cleanup
    await this.delay(2000);
    
    logger.info('Connection cleanup completed');
  }

  /**
   * Calculate final metrics
   */
  private calculateFinalMetrics(): void {
    if (this.responseTimes.length > 0) {
      this.metrics.avgResponseTime = this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
      this.metrics.minResponseTime = Math.min(...this.responseTimes);
      this.metrics.maxResponseTime = Math.max(...this.responseTimes);
    }

    const testDurationSeconds = (performance.now() - this.startTime) / 1000;
    this.metrics.avgThroughput = this.metrics.successfulMessages / testDurationSeconds;
  }

  /**
   * Validate scenario results
   */
  private validateScenarioResults(metrics: LoadTestMetrics, expected: TestScenario['expectedResults']): boolean {
    const successRate = (metrics.successfulMessages / metrics.totalMessages) * 100;
    
    const validations = [
      successRate >= expected.minSuccessRate,
      metrics.avgResponseTime <= expected.maxResponseTime,
      metrics.avgThroughput >= expected.minThroughput
    ];

    return validations.every(validation => validation);
  }

  /**
   * Calculate overall health score
   */
  private calculateOverallHealthScore(results: Array<{ passed: boolean; metrics: LoadTestMetrics }>): number {
    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;
    
    const baseScore = (passedCount / totalCount) * 100;
    
    // Adjust score based on performance metrics
    const avgSuccessRate = results.reduce((sum, r) => {
      const successRate = (r.metrics.successfulMessages / r.metrics.totalMessages) * 100;
      return sum + successRate;
    }, 0) / results.length;
    
    const avgResponseTime = results.reduce((sum, r) => sum + r.metrics.avgResponseTime, 0) / results.length;
    
    // Penalties for poor performance
    let adjustedScore = baseScore;
    if (avgSuccessRate < 90) adjustedScore -= 10;
    if (avgResponseTime > 1000) adjustedScore -= 15;
    
    return Math.max(0, Math.min(100, adjustedScore));
  }

  /**
   * Helper methods
   */
  private initializeMetrics(): LoadTestMetrics {
    return {
      totalConnections: 0,
      successfulConnections: 0,
      failedConnections: 0,
      totalMessages: 0,
      successfulMessages: 0,
      failedMessages: 0,
      avgResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      avgThroughput: 0,
      memoryUsageBefore: 0,
      memoryUsageAfter: 0,
      cpuUsageBefore: 0,
      cpuUsageAfter: 0,
      errors: []
    };
  }

  private addError(type: string, message: string): void {
    const existingError = this.metrics.errors.find(e => e.type === type && e.message === message);
    if (existingError) {
      existingError.count++;
    } else {
      this.metrics.errors.push({ type, message, count: 1 });
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Main load test execution function
 */
export async function runWebSocketOptimizationLoadTest(config: LoadTestConfig): Promise<void> {
  try {
    logger.info('Starting WebSocket Optimization Load Test Suite');

    const loadTest = new WebSocketOptimizationLoadTest(config);
    const results = await loadTest.runLoadTestSuite();

    // Generate comprehensive report
    const report = {
      testSuite: 'WebSocket Optimization Load Test',
      timestamp: new Date().toISOString(),
      configuration: config,
      results: results.overallResults,
      scenarios: results.scenarioResults.map(result => ({
        name: result.scenario.name,
        description: result.scenario.description,
        passed: result.passed,
        metrics: {
          successRate: (result.metrics.successfulMessages / result.metrics.totalMessages) * 100,
          avgResponseTime: result.metrics.avgResponseTime,
          throughput: result.metrics.avgThroughput,
          memoryDelta: result.metrics.memoryUsageAfter - result.metrics.memoryUsageBefore,
          errorCount: result.metrics.errors.length
        }
      })),
      recommendations: generateRecommendations(results)
    };

    logger.info('WebSocket Optimization Load Test completed', report);

    // Save detailed report
    const fs = require('fs').promises;
    const reportPath = `/tmp/websocket-optimization-load-test-${Date.now()}.json`;
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    logger.info(`Detailed report saved to: ${reportPath}`);

  } catch (error) {
    logger.error('Load test suite failed', { error });
    throw error;
  }
}

/**
 * Generate recommendations based on test results
 */
function generateRecommendations(results: any): string[] {
  const recommendations: string[] = [];
  
  if (results.overallResults.overallHealthScore < 70) {
    recommendations.push('Overall system performance below acceptable threshold. Consider infrastructure scaling.');
  }
  
  if (results.overallResults.failedScenarios > 0) {
    recommendations.push('Some test scenarios failed. Review failed scenarios and optimize accordingly.');
  }
  
  if (results.overallResults.overallHealthScore >= 85) {
    recommendations.push('Excellent performance. System is well-optimized for WebSocket operations.');
  }
  
  return recommendations;
}

export default WebSocketOptimizationLoadTest;