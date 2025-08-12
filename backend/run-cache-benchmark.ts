#!/usr/bin/env node

import dotenv from 'dotenv';
import cacheBenchmark from './src/utils/cacheBenchmark';
import { logger } from './src/utils/logger';

// Load environment variables
dotenv.config();

/**
 * Run cache performance benchmark
 */
async function runBenchmark() {
  console.log('🚀 Cache Performance Benchmark Tool');
  console.log('====================================\n');
  
  console.log('Configuration:');
  console.log(`  Redis Enabled: ${process.env.REDIS_ENABLED === 'true' ? '✅' : '❌'}`);
  console.log(`  Redis Host: ${process.env.REDIS_HOST || 'localhost'}`);
  console.log(`  Redis Port: ${process.env.REDIS_PORT || '6379'}`);
  console.log('');

  try {
    console.log('Running benchmark suite...\n');
    
    const results = await cacheBenchmark.runFullBenchmark();
    
    // Display results
    console.log('\n📊 Benchmark Results:');
    console.log('===================\n');
    
    // Simple operations
    console.log('Cache Operations:');
    results.results.forEach(result => {
      console.log(`  ${result.operation}:`);
      console.log(`    Average: ${result.averageTime.toFixed(3)}ms`);
      console.log(`    Min: ${result.minTime.toFixed(3)}ms`);
      console.log(`    Max: ${result.maxTime.toFixed(3)}ms`);
      console.log(`    Ops/sec: ${result.opsPerSecond.toFixed(0)}`);
      console.log('');
    });
    
    // Comparisons
    if (results.comparisons.length > 0) {
      console.log('\n🔄 Cache vs Database Comparison:');
      console.log('================================\n');
      
      results.comparisons.forEach(comparison => {
        console.log(`${comparison.withCache.operation.replace(' (Cache)', '')}:`);
        console.log(`  Without Cache: ${comparison.withoutCache.averageTime.toFixed(3)}ms`);
        console.log(`  With Cache: ${comparison.withCache.averageTime.toFixed(3)}ms`);
        console.log(`  Improvement: ${comparison.improvement.percentage.toFixed(1)}%`);
        console.log(`  Speedup: ${comparison.improvement.speedup.toFixed(1)}x faster`);
        console.log('');
      });
    }
    
    // Summary
    console.log('\n📈 Summary:');
    console.log('==========\n');
    console.log(`  Average Improvement: ${results.summary.averageImprovement || 'N/A'}`);
    console.log(`  Average Speedup: ${results.summary.averageSpeedup || 'N/A'}`);
    
    if (results.summary.bestCase) {
      console.log(`  Best Case: ${results.summary.bestCase.operation}`);
      console.log(`    - Improvement: ${results.summary.bestCase.improvement}`);
      console.log(`    - Speedup: ${results.summary.bestCase.speedup}`);
    }
    
    console.log(`\n  💡 ${results.summary.recommendation || 'Enable Redis for performance benefits'}`);
    
  } catch (error) {
    console.error('\n❌ Benchmark failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run if executed directly
if (require.main === module) {
  runBenchmark();
}

export default runBenchmark;