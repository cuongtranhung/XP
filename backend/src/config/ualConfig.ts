/**
 * User Activity Logging (UAL) Configuration
 * 
 * Centralized configuration to prevent backend hanging and optimize performance
 */

export interface UALConfig {
  // Core settings
  enabled: boolean;
  asyncProcessing: boolean;
  
  // Performance settings
  maxQueueSize: number;
  maxLogsPerSecond: number;
  batchSize: number;
  batchIntervalMs: number;
  
  // Timeout and reliability settings
  connectionTimeoutMs: number;
  queryTimeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
  
  // Circuit breaker settings
  circuitBreakerEnabled: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerResetTimeMs: number;
  
  // Resource management
  maxConnectionsPerSecond: number;
  connectionPoolLimit: number;
  memoryThresholdMB: number;
  
  // Monitoring
  enableHealthCheck: boolean;
  healthCheckIntervalMs: number;
  logMetrics: boolean;
  
  // Data retention
  enableAutoCleanup: boolean;
  retentionDays: number;
  cleanupIntervalHours: number;
}

/**
 * Production-optimized UAL configuration
 */
export const PRODUCTION_UAL_CONFIG: UALConfig = {
  // Core settings
  enabled: process.env.ACTIVITY_LOGGING_ENABLED !== 'false',
  asyncProcessing: true,
  
  // Performance settings - Conservative for stability
  maxQueueSize: parseInt(process.env.UAL_MAX_QUEUE_SIZE ?? '1000'),
  maxLogsPerSecond: parseInt(process.env.UAL_MAX_LOGS_PER_SEC ?? '30'),
  batchSize: parseInt(process.env.UAL_BATCH_SIZE ?? '10'),
  batchIntervalMs: parseInt(process.env.UAL_BATCH_INTERVAL ?? '5000'),
  
  // Timeout settings - Aggressive to prevent hanging
  connectionTimeoutMs: parseInt(process.env.UAL_CONNECTION_TIMEOUT ?? '2000'),
  queryTimeoutMs: parseInt(process.env.UAL_QUERY_TIMEOUT ?? '3000'),
  maxRetries: parseInt(process.env.UAL_MAX_RETRIES ?? '2'),
  retryDelayMs: parseInt(process.env.UAL_RETRY_DELAY ?? '1000'),
  
  // Circuit breaker - Enabled by default for stability
  circuitBreakerEnabled: process.env.UAL_CIRCUIT_BREAKER !== 'false',
  circuitBreakerThreshold: parseInt(process.env.UAL_CB_THRESHOLD ?? '3'),
  circuitBreakerResetTimeMs: parseInt(process.env.UAL_CB_RESET ?? '30000'),
  
  // Resource management
  maxConnectionsPerSecond: parseInt(process.env.UAL_MAX_CONN_PER_SEC ?? '10'),
  connectionPoolLimit: parseInt(process.env.UAL_POOL_LIMIT ?? '5'),
  memoryThresholdMB: parseInt(process.env.UAL_MEMORY_THRESHOLD ?? '100'),
  
  // Monitoring
  enableHealthCheck: process.env.UAL_HEALTH_CHECK !== 'false',
  healthCheckIntervalMs: parseInt(process.env.UAL_HEALTH_INTERVAL ?? '60000'),
  logMetrics: process.env.UAL_LOG_METRICS !== 'false',
  
  // Data retention
  enableAutoCleanup: process.env.UAL_AUTO_CLEANUP !== 'false',
  retentionDays: parseInt(process.env.UAL_RETENTION_DAYS ?? '30'),
  cleanupIntervalHours: parseInt(process.env.UAL_CLEANUP_INTERVAL ?? '24')
};

/**
 * Development-optimized UAL configuration
 */
export const DEVELOPMENT_UAL_CONFIG: UALConfig = {
  // Core settings - More permissive for development
  enabled: process.env.ACTIVITY_LOGGING_ENABLED !== 'false',
  asyncProcessing: process.env.UAL_SYNC_MODE !== 'true',
  
  // Performance settings - Higher limits for development
  maxQueueSize: parseInt(process.env.UAL_MAX_QUEUE_SIZE ?? '2000'),
  maxLogsPerSecond: parseInt(process.env.UAL_MAX_LOGS_PER_SEC ?? '100'),
  batchSize: parseInt(process.env.UAL_BATCH_SIZE ?? '20'),
  batchIntervalMs: parseInt(process.env.UAL_BATCH_INTERVAL ?? '3000'),
  
  // Timeout settings - More lenient for development
  connectionTimeoutMs: parseInt(process.env.UAL_CONNECTION_TIMEOUT ?? '5000'),
  queryTimeoutMs: parseInt(process.env.UAL_QUERY_TIMEOUT ?? '10000'),
  maxRetries: parseInt(process.env.UAL_MAX_RETRIES ?? '3'),
  retryDelayMs: parseInt(process.env.UAL_RETRY_DELAY ?? '500'),
  
  // Circuit breaker - Optional in development
  circuitBreakerEnabled: process.env.UAL_CIRCUIT_BREAKER === 'true',
  circuitBreakerThreshold: parseInt(process.env.UAL_CB_THRESHOLD ?? '5'),
  circuitBreakerResetTimeMs: parseInt(process.env.UAL_CB_RESET ?? '15000'),
  
  // Resource management - More permissive
  maxConnectionsPerSecond: parseInt(process.env.UAL_MAX_CONN_PER_SEC ?? '50'),
  connectionPoolLimit: parseInt(process.env.UAL_POOL_LIMIT ?? '10'),
  memoryThresholdMB: parseInt(process.env.UAL_MEMORY_THRESHOLD ?? '200'),
  
  // Monitoring
  enableHealthCheck: process.env.UAL_HEALTH_CHECK !== 'false',
  healthCheckIntervalMs: parseInt(process.env.UAL_HEALTH_INTERVAL ?? '30000'),
  logMetrics: process.env.UAL_LOG_METRICS !== 'false',
  
  // Data retention - Shorter for development
  enableAutoCleanup: process.env.UAL_AUTO_CLEANUP !== 'false',
  retentionDays: parseInt(process.env.UAL_RETENTION_DAYS ?? '7'),
  cleanupIntervalHours: parseInt(process.env.UAL_CLEANUP_INTERVAL ?? '12')
};

/**
 * Get configuration based on environment
 */
export function getUALConfig(): UALConfig {
  const env = process.env.NODE_ENV ?? 'development';
  
  switch (env) {
    case 'production':
      return PRODUCTION_UAL_CONFIG;
    case 'development':
    case 'test':
      return DEVELOPMENT_UAL_CONFIG;
    default:
      return DEVELOPMENT_UAL_CONFIG;
  }
}

/**
 * Validate UAL configuration
 */
export function validateUALConfig(config: UALConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate timeouts
  if (config.connectionTimeoutMs < 1000) {
    errors.push('Connection timeout should be at least 1000ms to prevent premature failures');
  }
  
  if (config.queryTimeoutMs < config.connectionTimeoutMs) {
    errors.push('Query timeout should be greater than connection timeout');
  }
  
  // Validate queue settings
  if (config.maxQueueSize < 100) {
    errors.push('Max queue size should be at least 100 for proper buffering');
  }
  
  if (config.batchSize > config.maxQueueSize) {
    errors.push('Batch size cannot be larger than max queue size');
  }
  
  // Validate rate limiting
  if (config.maxLogsPerSecond < 1) {
    errors.push('Max logs per second must be at least 1');
  }
  
  // Validate circuit breaker
  if (config.circuitBreakerEnabled && config.circuitBreakerThreshold < 1) {
    errors.push('Circuit breaker threshold must be at least 1');
  }
  
  // Validate resource limits
  if (config.memoryThresholdMB < 50) {
    errors.push('Memory threshold should be at least 50MB');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get optimal configuration based on system resources
 */
export function getOptimalUALConfig(): UALConfig {
  const baseConfig = getUALConfig();
  const totalMemoryMB = process.memoryUsage().heapTotal / 1024 / 1024;
  
  // Adjust configuration based on available memory
  if (totalMemoryMB < 256) {
    // Low memory system - very conservative settings
    return {
      ...baseConfig,
      maxQueueSize: Math.min(baseConfig.maxQueueSize, 500),
      maxLogsPerSecond: Math.min(baseConfig.maxLogsPerSecond, 20),
      batchSize: Math.min(baseConfig.batchSize, 5),
      batchIntervalMs: Math.max(baseConfig.batchIntervalMs, 10000),
      connectionTimeoutMs: Math.min(baseConfig.connectionTimeoutMs, 2000),
      memoryThresholdMB: 50
    };
  } else if (totalMemoryMB < 512) {
    // Medium memory system - balanced settings
    return {
      ...baseConfig,
      maxQueueSize: Math.min(baseConfig.maxQueueSize, 1000),
      maxLogsPerSecond: Math.min(baseConfig.maxLogsPerSecond, 50),
      batchSize: Math.min(baseConfig.batchSize, 10)
    };
  }
  
  // High memory system - can use full configuration
  return baseConfig;
}

/**
 * Environment variable documentation
 */
export const UAL_ENV_DOCS = {
  // Core settings
  'ACTIVITY_LOGGING_ENABLED': 'Enable/disable activity logging (default: true)',
  'UAL_SYNC_MODE': 'Force synchronous logging in development (default: false)',
  
  // Performance settings
  'UAL_MAX_QUEUE_SIZE': 'Maximum number of logs in queue (prod: 1000, dev: 2000)',
  'UAL_MAX_LOGS_PER_SEC': 'Rate limit for logs per second (prod: 30, dev: 100)',
  'UAL_BATCH_SIZE': 'Number of logs processed per batch (prod: 10, dev: 20)',
  'UAL_BATCH_INTERVAL': 'Batch processing interval in ms (prod: 5000, dev: 3000)',
  
  // Timeout settings
  'UAL_CONNECTION_TIMEOUT': 'Database connection timeout in ms (prod: 2000, dev: 5000)',
  'UAL_QUERY_TIMEOUT': 'Database query timeout in ms (prod: 3000, dev: 10000)',
  'UAL_MAX_RETRIES': 'Maximum retry attempts (prod: 2, dev: 3)',
  'UAL_RETRY_DELAY': 'Delay between retries in ms (prod: 1000, dev: 500)',
  
  // Circuit breaker
  'UAL_CIRCUIT_BREAKER': 'Enable circuit breaker (prod: true, dev: false)',
  'UAL_CB_THRESHOLD': 'Circuit breaker failure threshold (prod: 3, dev: 5)',
  'UAL_CB_RESET': 'Circuit breaker reset time in ms (prod: 30000, dev: 15000)',
  
  // Resource management
  'UAL_MAX_CONN_PER_SEC': 'Max database connections per second (prod: 10, dev: 50)',
  'UAL_POOL_LIMIT': 'Database connection pool limit (prod: 5, dev: 10)',
  'UAL_MEMORY_THRESHOLD': 'Memory threshold in MB (prod: 100, dev: 200)',
  
  // Monitoring
  'UAL_HEALTH_CHECK': 'Enable health monitoring (default: true)',
  'UAL_HEALTH_INTERVAL': 'Health check interval in ms (prod: 60000, dev: 30000)',
  'UAL_LOG_METRICS': 'Enable metrics logging (default: true)',
  
  // Data retention
  'UAL_AUTO_CLEANUP': 'Enable automatic data cleanup (default: true)',
  'UAL_RETENTION_DAYS': 'Data retention period in days (prod: 30, dev: 7)',
  'UAL_CLEANUP_INTERVAL': 'Cleanup interval in hours (prod: 24, dev: 12)'
};

export default getUALConfig();