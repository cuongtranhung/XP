/**
 * Performance tests for real-time collaboration
 */

import { io, Socket } from 'socket.io-client';
import { performance } from 'perf_hooks';
import { v4 as uuidv4 } from 'uuid';

// Test configuration
const SERVER_URL = process.env.SERVER_URL ?? 'http://localhost:5000';
const NUM_CONCURRENT_USERS = 50;
const TEST_DURATION_MS = 60000; // 1 minute
const OPERATIONS_PER_USER = 100;

interface TestMetrics {
  connectionTime: number[];
  fieldAddTime: number[];
  fieldUpdateTime: number[];
  fieldDeleteTime: number[];
  cursorMoveTime: number[];
  totalOperations: number;
  failedOperations: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
}

class CollaborationPerformanceTest {
  private metrics: TestMetrics = {
    connectionTime: [],
    fieldAddTime: [],
    fieldUpdateTime: [],
    fieldDeleteTime: [],
    cursorMoveTime: [],
    totalOperations: 0,
    failedOperations: 0,
    averageLatency: 0,
    p95Latency: 0,
    p99Latency: 0,
  };

  private sockets: Socket[] = [];
  private testFormId: string = uuidv4();

  /**
   * Create mock user tokens
   */
  private createMockToken(userId: string): string {
    // In real test, this would create actual JWT tokens
    return `mock-token-${userId}`;
  }

  /**
   * Create a socket connection
   */
  private async createConnection(userId: string): Promise<Socket> {
    const startTime = performance.now();
    
    return new Promise((resolve, reject) => {
      const socket = io(SERVER_URL, {
        auth: {
          token: this.createMockToken(userId),
        },
        transports: ['websocket'],
      });

      socket.on('connect', () => {
        const connectionTime = performance.now() - startTime;
        this.metrics.connectionTime.push(connectionTime);
        resolve(socket);
      });

      socket.on('connect_error', (error) => {
        this.metrics.failedOperations++;
        reject(error);
      });

      // Timeout after 5 seconds
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  }

  /**
   * Simulate user operations
   */
  private async simulateUserOperations(socket: Socket, userId: string): Promise<void> {
    // Join form room
    await this.measureOperation(socket, 'form:join', this.testFormId);

    for (let i = 0; i < OPERATIONS_PER_USER; i++) {
      const operationType = Math.floor(Math.random() * 5);

      switch (operationType) {
        case 0: // Add field
          await this.measureOperation(
            socket,
            'form:field:add',
            {
              formId: this.testFormId,
              field: {
                id: uuidv4(),
                type: 'text',
                label: `Field ${i}`,
                key: `field_${i}`,
                position: i,
              },
              position: i,
            },
            'fieldAddTime'
          );
          break;

        case 1: // Update field
          await this.measureOperation(
            socket,
            'form:field:update',
            {
              formId: this.testFormId,
              fieldId: uuidv4(),
              updates: {
                label: `Updated Field ${i}`,
                required: Math.random() > 0.5,
              },
            },
            'fieldUpdateTime'
          );
          break;

        case 2: // Delete field
          await this.measureOperation(
            socket,
            'form:field:delete',
            {
              formId: this.testFormId,
              fieldId: uuidv4(),
            },
            'fieldDeleteTime'
          );
          break;

        case 3: // Cursor movement
          await this.measureOperation(
            socket,
            'form:cursor:move',
            {
              formId: this.testFormId,
              x: Math.random() * 1000,
              y: Math.random() * 1000,
            },
            'cursorMoveTime'
          );
          break;

        case 4: // Field reorder
          await this.measureOperation(
            socket,
            'form:field:reorder',
            {
              formId: this.testFormId,
              fromIndex: Math.floor(Math.random() * 10),
              toIndex: Math.floor(Math.random() * 10),
            }
          );
          break;
      }

      // Add small delay between operations
      await this.delay(50 + Math.random() * 100);
    }
  }

  /**
   * Measure operation latency
   */
  private async measureOperation(
    socket: Socket,
    event: string,
    data: any,
    metricKey?: keyof TestMetrics
  ): Promise<void> {
    const startTime = performance.now();

    return new Promise((resolve) => {
      this.metrics.totalOperations++;

      // Set up response listener
      const responseEvent = event.replace(':', '_') + '_response';
      const errorEvent = 'form:error';

      const cleanup = () => {
        socket.off(responseEvent);
        socket.off(errorEvent);
      };

      socket.once(responseEvent, () => {
        const latency = performance.now() - startTime;
        if (metricKey && Array.isArray(this.metrics[metricKey])) {
          (this.metrics[metricKey] as number[]).push(latency);
        }
        cleanup();
        resolve();
      });

      socket.once(errorEvent, () => {
        this.metrics.failedOperations++;
        cleanup();
        resolve();
      });

      // Send the event
      socket.emit(event, data);

      // Timeout after 2 seconds
      setTimeout(() => {
        this.metrics.failedOperations++;
        cleanup();
        resolve();
      }, 2000);
    });
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  /**
   * Calculate final metrics
   */
  private calculateFinalMetrics(): void {
    const allLatencies = [
      ...this.metrics.fieldAddTime,
      ...this.metrics.fieldUpdateTime,
      ...this.metrics.fieldDeleteTime,
      ...this.metrics.cursorMoveTime,
    ];

    if (allLatencies.length > 0) {
      this.metrics.averageLatency = 
        allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length;
      this.metrics.p95Latency = this.calculatePercentile(allLatencies, 95);
      this.metrics.p99Latency = this.calculatePercentile(allLatencies, 99);
    }
  }

  /**
   * Run the performance test
   */
  async run(): Promise<TestMetrics> {
    console.log(`Starting collaboration performance test with ${NUM_CONCURRENT_USERS} users...`);

    try {
      // Create concurrent connections
      const connectionPromises = [];
      for (let i = 0; i < NUM_CONCURRENT_USERS; i++) {
        const userId = uuidv4();
        connectionPromises.push(this.createConnection(userId));
      }

      this.sockets = await Promise.all(connectionPromises);
      console.log(`${this.sockets.length} users connected successfully`);

      // Run user simulations concurrently
      const simulationPromises = this.sockets.map((socket, index) => 
        this.simulateUserOperations(socket, `user-${index}`)
      );

      // Wait for all simulations to complete or timeout
      await Promise.race([
        Promise.all(simulationPromises),
        this.delay(TEST_DURATION_MS),
      ]);

      // Calculate final metrics
      this.calculateFinalMetrics();

      return this.metrics;

    } finally {
      // Cleanup connections
      this.sockets.forEach(socket => socket.disconnect());
    }
  }

  /**
   * Print test results
   */
  printResults(): void {
    console.log('\n=== Collaboration Performance Test Results ===\n');
    
    console.log('Connection Metrics:');
    console.log(`  - Average connection time: ${this.calculateAverage(this.metrics.connectionTime).toFixed(2)}ms`);
    console.log(`  - P95 connection time: ${this.calculatePercentile(this.metrics.connectionTime, 95).toFixed(2)}ms`);
    
    console.log('\nOperation Metrics:');
    console.log(`  - Total operations: ${this.metrics.totalOperations}`);
    console.log(`  - Failed operations: ${this.metrics.failedOperations} (${((this.metrics.failedOperations / this.metrics.totalOperations) * 100).toFixed(2)}%)`);
    console.log(`  - Average latency: ${this.metrics.averageLatency.toFixed(2)}ms`);
    console.log(`  - P95 latency: ${this.metrics.p95Latency.toFixed(2)}ms`);
    console.log(`  - P99 latency: ${this.metrics.p99Latency.toFixed(2)}ms`);
    
    console.log('\nOperation Type Breakdown:');
    console.log(`  - Field Add: avg ${this.calculateAverage(this.metrics.fieldAddTime).toFixed(2)}ms`);
    console.log(`  - Field Update: avg ${this.calculateAverage(this.metrics.fieldUpdateTime).toFixed(2)}ms`);
    console.log(`  - Field Delete: avg ${this.calculateAverage(this.metrics.fieldDeleteTime).toFixed(2)}ms`);
    console.log(`  - Cursor Move: avg ${this.calculateAverage(this.metrics.cursorMoveTime).toFixed(2)}ms`);
    
    console.log('\nThroughput:');
    const duration = TEST_DURATION_MS / 1000; // Convert to seconds
    const throughput = this.metrics.totalOperations / duration;
    console.log(`  - Operations per second: ${throughput.toFixed(2)}`);
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
}

// Run the test
describe('Real-time Collaboration Performance', () => {
  jest.setTimeout(TEST_DURATION_MS + 30000); // Add buffer for setup/teardown

  it('should handle concurrent users efficiently', async () => {
    const test = new CollaborationPerformanceTest();
    const metrics = await test.run();
    test.printResults();

    // Performance assertions
    expect(metrics.averageLatency).toBeLessThan(100); // Average latency under 100ms
    expect(metrics.p95Latency).toBeLessThan(200); // P95 latency under 200ms
    expect(metrics.p99Latency).toBeLessThan(500); // P99 latency under 500ms
    expect(metrics.failedOperations / metrics.totalOperations).toBeLessThan(0.01); // Less than 1% failure rate
  });

  it('should scale with increasing users', async () => {
    const results = [];
    
    for (const userCount of [10, 25, 50, 100]) {
      const test = new CollaborationPerformanceTest();
      // Override user count
      Object.defineProperty(test, 'NUM_CONCURRENT_USERS', { value: userCount });
      
      const metrics = await test.run();
      results.push({
        users: userCount,
        avgLatency: metrics.averageLatency,
        p95Latency: metrics.p95Latency,
        failureRate: metrics.failedOperations / metrics.totalOperations,
      });
    }

    // Print scaling results
    console.log('\n=== Scaling Test Results ===\n');
    results.forEach(result => {
      console.log(`${result.users} users: avg ${result.avgLatency.toFixed(2)}ms, p95 ${result.p95Latency.toFixed(2)}ms, failure ${(result.failureRate * 100).toFixed(2)}%`);
    });

    // Verify reasonable scaling
    const latencyIncrease = results[results.length - 1].avgLatency / results[0].avgLatency;
    expect(latencyIncrease).toBeLessThan(3); // Latency should not increase more than 3x
  });
});