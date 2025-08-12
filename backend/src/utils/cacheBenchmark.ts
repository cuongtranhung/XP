import cacheService from '../services/cacheService';
import { pool } from '../config/database';
import { logger } from '../utils/logger';

interface BenchmarkResult {
  operation: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  opsPerSecond: number;
}

interface ComparisonResult {
  withCache: BenchmarkResult;
  withoutCache: BenchmarkResult;
  improvement: {
    percentage: number;
    speedup: number;
  };
}

/**
 * Cache Performance Benchmark Utility
 * Measures and compares performance with and without caching
 */
class CacheBenchmark {
  private results: BenchmarkResult[] = [];

  /**
   * Run comprehensive benchmark suite
   */
  async runFullBenchmark(): Promise<{
    results: BenchmarkResult[];
    comparisons: ComparisonResult[];
    summary: any;
  }> {
    logger.info('🏃 Starting cache performance benchmark...');
    
    const comparisons: ComparisonResult[] = [];

    // Test 1: Simple key-value operations
    await this.benchmarkSimpleOperations();

    // Test 2: User data fetching
    const userComparison = await this.benchmarkUserDataFetching();
    if (userComparison) comparisons.push(userComparison);

    // Test 3: Form data fetching
    const formComparison = await this.benchmarkFormDataFetching();
    if (formComparison) comparisons.push(formComparison);

    // Test 4: Complex query caching
    const queryComparison = await this.benchmarkComplexQuery();
    if (queryComparison) comparisons.push(queryComparison);

    // Test 5: Concurrent operations
    await this.benchmarkConcurrentOperations();

    // Generate summary
    const summary = this.generateSummary(comparisons);

    logger.info('✅ Benchmark completed');
    
    return {
      results: this.results,
      comparisons,
      summary
    };
  }

  /**
   * Benchmark simple cache operations
   */
  private async benchmarkSimpleOperations(): Promise<void> {
    const iterations = 1000;
    const testData = { id: 1, name: 'Test User', data: 'x'.repeat(1000) };
    
    // SET operations
    const setResult = await this.measure('Cache SET', iterations, async () => {
      const key = `benchmark:test:${Math.random()}`;
      await cacheService.set(key, testData, { ttl: 60 });
    });
    this.results.push(setResult);

    // GET operations
    const testKey = 'benchmark:test:static';
    await cacheService.set(testKey, testData, { ttl: 60 });
    
    const getResult = await this.measure('Cache GET', iterations, async () => {
      await cacheService.get(testKey);
    });
    this.results.push(getResult);

    // EXISTS operations
    const existsResult = await this.measure('Cache EXISTS', iterations, async () => {
      await cacheService.exists(testKey);
    });
    this.results.push(existsResult);

    // DELETE operations
    const deleteResult = await this.measure('Cache DELETE', iterations, async () => {
      const key = `benchmark:delete:${Math.random()}`;
      await cacheService.set(key, 'test', { ttl: 60 });
      await cacheService.del(key);
    });
    this.results.push(deleteResult);
  }

  /**
   * Benchmark user data fetching with and without cache
   */
  private async benchmarkUserDataFetching(): Promise<ComparisonResult | null> {
    const iterations = 100;
    const userId = 1; // Assuming user with ID 1 exists

    // Without cache (direct database)
    const withoutCache = await this.measure('User fetch (DB)', iterations, async () => {
      const result = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );
      return result.rows[0];
    });

    // With cache
    const cacheKey = `benchmark:user:${userId}`;
    const userData = (await pool.query('SELECT * FROM users WHERE id = $1', [userId])).rows[0];
    
    if (!userData) {
      logger.warn('User not found for benchmark');
      return null;
    }

    await cacheService.set(cacheKey, userData, { ttl: 60 });
    
    const withCache = await this.measure('User fetch (Cache)', iterations, async () => {
      const cached = await cacheService.get(cacheKey);
      if (!cached) {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        const data = result.rows[0];
        await cacheService.set(cacheKey, data, { ttl: 60 });
        return data;
      }
      return cached;
    });

    return this.compareResults(withCache, withoutCache);
  }

  /**
   * Benchmark form data fetching
   */
  private async benchmarkFormDataFetching(): Promise<ComparisonResult | null> {
    const iterations = 100;

    // Get a sample form ID
    const formResult = await pool.query('SELECT id FROM dynamic_forms LIMIT 1');
    if (formResult.rows.length === 0) {
      logger.warn('No forms found for benchmark');
      return null;
    }
    
    const formId = formResult.rows[0].id;

    // Without cache
    const withoutCache = await this.measure('Form fetch (DB)', iterations, async () => {
      const result = await pool.query(
        'SELECT * FROM dynamic_forms WHERE id = $1',
        [formId]
      );
      return result.rows[0];
    });

    // With cache
    const cacheKey = `benchmark:form:${formId}`;
    const formData = (await pool.query('SELECT * FROM dynamic_forms WHERE id = $1', [formId])).rows[0];
    await cacheService.set(cacheKey, formData, { ttl: 60 });
    
    const withCache = await this.measure('Form fetch (Cache)', iterations, async () => {
      const cached = await cacheService.get(cacheKey);
      if (!cached) {
        const result = await pool.query('SELECT * FROM dynamic_forms WHERE id = $1', [formId]);
        const data = result.rows[0];
        await cacheService.set(cacheKey, data, { ttl: 60 });
        return data;
      }
      return cached;
    });

    return this.compareResults(withCache, withoutCache);
  }

  /**
   * Benchmark complex query with caching
   */
  private async benchmarkComplexQuery(): Promise<ComparisonResult | null> {
    const iterations = 50;

    // Complex query
    const complexQuery = `
      SELECT u.id, u.email, u.full_name,
             COUNT(DISTINCT f.id) as form_count,
             COUNT(DISTINCT fs.id) as submission_count
      FROM users u
      LEFT JOIN dynamic_forms f ON u.id = f.created_by
      LEFT JOIN form_submissions fs ON f.id = fs.form_id
      WHERE u.is_active = true
      GROUP BY u.id
      ORDER BY submission_count DESC
      LIMIT 10
    `;

    // Without cache
    const withoutCache = await this.measure('Complex query (DB)', iterations, async () => {
      const result = await pool.query(complexQuery);
      return result.rows;
    });

    // With cache
    const cacheKey = 'benchmark:complex:query';
    const queryData = (await pool.query(complexQuery)).rows;
    await cacheService.set(cacheKey, queryData, { ttl: 60 });
    
    const withCache = await this.measure('Complex query (Cache)', iterations, async () => {
      const cached = await cacheService.get(cacheKey);
      if (!cached) {
        const result = await pool.query(complexQuery);
        const data = result.rows;
        await cacheService.set(cacheKey, data, { ttl: 60 });
        return data;
      }
      return cached;
    });

    return this.compareResults(withCache, withoutCache);
  }

  /**
   * Benchmark concurrent operations
   */
  private async benchmarkConcurrentOperations(): Promise<void> {
    const concurrency = 10;
    const operationsPerWorker = 100;

    const result = await this.measure(
      `Concurrent ops (${concurrency}x${operationsPerWorker})`,
      1,
      async () => {
        const promises = [];
        
        for (let i = 0; i < concurrency; i++) {
          promises.push(this.runConcurrentWorker(i, operationsPerWorker));
        }
        
        await Promise.all(promises);
      }
    );

    this.results.push({
      ...result,
      iterations: concurrency * operationsPerWorker,
      opsPerSecond: (concurrency * operationsPerWorker) / (result.totalTime / 1000)
    });
  }

  /**
   * Helper method for concurrent worker
   */
  private async runConcurrentWorker(workerId: number, operations: number): Promise<void> {
    for (let i = 0; i < operations; i++) {
      const key = `benchmark:concurrent:${workerId}:${i}`;
      const value = { workerId, operation: i, timestamp: Date.now() };
      
      // Mix of operations
      if (i % 3 === 0) {
        await cacheService.set(key, value, { ttl: 60 });
      } else if (i % 3 === 1) {
        await cacheService.get(key);
      } else {
        await cacheService.exists(key);
      }
    }
  }

  /**
   * Measure operation performance
   */
  private async measure(
    operation: string,
    iterations: number,
    fn: () => Promise<any>
  ): Promise<BenchmarkResult> {
    const times: number[] = [];
    
    logger.debug(`Running benchmark: ${operation} (${iterations} iterations)`);
    
    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      await fn();
      const end = process.hrtime.bigint();
      
      const timeMs = Number(end - start) / 1000000; // Convert to milliseconds
      times.push(timeMs);
    }

    const totalTime = times.reduce((a, b) => a + b, 0);
    const averageTime = totalTime / iterations;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const opsPerSecond = 1000 / averageTime;

    return {
      operation,
      iterations,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      opsPerSecond
    };
  }

  /**
   * Compare results with and without cache
   */
  private compareResults(
    withCache: BenchmarkResult,
    withoutCache: BenchmarkResult
  ): ComparisonResult {
    const improvement = ((withoutCache.averageTime - withCache.averageTime) / withoutCache.averageTime) * 100;
    const speedup = withoutCache.averageTime / withCache.averageTime;

    return {
      withCache,
      withoutCache,
      improvement: {
        percentage: improvement,
        speedup
      }
    };
  }

  /**
   * Generate benchmark summary
   */
  private generateSummary(comparisons: ComparisonResult[]): any {
    if (comparisons.length === 0) {
      return { message: 'No comparison data available' };
    }

    const avgImprovement = comparisons.reduce((sum, c) => sum + c.improvement.percentage, 0) / comparisons.length;
    const avgSpeedup = comparisons.reduce((sum, c) => sum + c.improvement.speedup, 0) / comparisons.length;

    const bestImprovement = comparisons.reduce((best, c) => 
      c.improvement.percentage > best.improvement.percentage ? c : best
    );

    return {
      averageImprovement: `${avgImprovement.toFixed(2)}%`,
      averageSpeedup: `${avgSpeedup.toFixed(2)}x`,
      bestCase: {
        operation: bestImprovement.withCache.operation,
        improvement: `${bestImprovement.improvement.percentage.toFixed(2)}%`,
        speedup: `${bestImprovement.improvement.speedup.toFixed(2)}x`
      },
      cacheEnabled: process.env.REDIS_ENABLED === 'true',
      recommendation: avgImprovement > 50 
        ? 'Cache is providing significant performance benefits'
        : avgImprovement > 20
        ? 'Cache is providing moderate performance benefits'
        : 'Cache benefits are limited, consider optimization'
    };
  }
}

// Export for use in routes or scripts
export default new CacheBenchmark();