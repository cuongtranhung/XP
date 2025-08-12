import { Pool, PoolClient, PoolConfig } from 'pg';

// Database configuration with support for both URL and individual parameters
export const getDatabaseConfig = (): PoolConfig => {
  // Optimized connection pool configuration for better performance
  const dbConfig: PoolConfig = {
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    
    // Connection Pool Settings - Optimized for high concurrency
    max: parseInt(process.env.DB_POOL_MAX ?? '50'),              // Increased to handle more concurrent requests
    min: parseInt(process.env.DB_POOL_MIN ?? '10'),              // Keep more connections warm for faster response
    
    // Timeout Settings - Balanced for performance and resource management
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT ?? '30000'),        // 30s - keep connections alive longer
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT ?? '5000'), // 5s - faster fail for connection issues
    
    // Query Timeout Settings
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT ?? '30000'),    // 30s for complex queries
    query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT ?? '30000'),           // 30s query timeout
    
    // Connection Health Settings
    keepAlive: true,                                              // Keep connections alive
    keepAliveInitialDelayMillis: 10000,                          // 10s initial delay
    
    // Additional Performance Settings
    allowExitOnIdle: false                                       // Don't exit on idle
  };

  // Primary: Use DATABASE_URL if provided
  if (process.env.DATABASE_URL) {
    dbConfig.connectionString = process.env.DATABASE_URL;
  } else {
    // Secondary: Construct from individual parts
    dbConfig.host = process.env.DB_HOST ?? '172.26.240.1';
    dbConfig.port = parseInt(process.env.DB_PORT ?? '5432');
    dbConfig.database = process.env.DB_NAME ?? 'postgres';
    dbConfig.user = process.env.DB_USER ?? 'postgres';
    dbConfig.password = process.env.DB_PASSWORD ?? '@abcd1234';
  }

  return dbConfig;
};

// Database connection pool
export const pool = new Pool(getDatabaseConfig());

// Pool monitoring metrics
const poolMetrics = {
  totalConnections: 0,
  idleConnections: 0,
  waitingRequests: 0,
  activeQueries: 0,
  errors: 0,
  lastError: null as any
};

// Pool event handlers for monitoring
pool.on('connect', (_client) => {
  poolMetrics.totalConnections = pool.totalCount;
  poolMetrics.idleConnections = pool.idleCount;
  poolMetrics.waitingRequests = pool.waitingCount;
  
  if (process.env.LOG_LEVEL === 'debug') {
    console.log('🔗 New client connected to database', {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount
    });
  }
});

pool.on('error', (err, _client) => {
  poolMetrics.errors++;
  poolMetrics.lastError = err;
  console.error('❌ Unexpected error on idle database client:', err);
  
  // Log pool state on error
  console.error('Pool state:', {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount
  });
});

pool.on('remove', (_client) => {
  poolMetrics.totalConnections = pool.totalCount;
  poolMetrics.idleConnections = pool.idleCount;
  
  if (process.env.LOG_LEVEL === 'debug') {
    console.log('🔌 Client removed from pool', {
      total: pool.totalCount,
      idle: pool.idleCount
    });
  }
});

// Export pool metrics for monitoring
export const getPoolMetrics = () => {
  const metrics = {
    ...poolMetrics,
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingRequests: pool.waitingCount
  };
  
  // Calculate utilization
  const maxConnections = parseInt(process.env.DB_POOL_MAX ?? '50');
  const utilization = (metrics.totalConnections / maxConnections) * 100;
  
  // Enhanced monitoring with alerts
  if (utilization > 85) {
    console.warn('🚨 HIGH DATABASE POOL UTILIZATION', {
      utilization: Math.round(utilization),
      total: metrics.totalConnections,
      max: maxConnections,
      waiting: metrics.waitingRequests,
      recommendation: 'Consider increasing pool size or investigating slow queries'
    });
  } else if (utilization > 70) {
    console.warn('⚠️ Moderate database pool utilization', {
      utilization: Math.round(utilization),
      total: metrics.totalConnections,
      max: maxConnections
    });
  }
  
  // Memory leak detection for connections
  if (metrics.totalConnections > maxConnections * 0.8 && metrics.idleConnections < 2) {
    console.warn('🔍 Possible connection leak detected', {
      total: metrics.totalConnections,
      idle: metrics.idleConnections,
      active: metrics.totalConnections - metrics.idleConnections
    });
  }
  
  return {
    ...metrics,
    utilization: Math.round(utilization * 100) / 100,
    maxConnections,
    activeConnections: metrics.totalConnections - metrics.idleConnections
  };
};

// Test database connection
export const testConnection = async (): Promise<void> => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};

// Execute query with error handling and retry logic
export const query = async (text: string, params?: any[], retries = 3): Promise<any> => {
  const start = Date.now();
  poolMetrics.activeQueries++;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      
      poolMetrics.activeQueries--;
      
      // Log slow queries
      if (duration > 1000) {
        console.warn('⚠️ Slow query detected:', {
          query: text.substring(0, 100) + '...',
          duration,
          rows: res.rowCount
        });
      }
      
      if (process.env.LOG_LEVEL === 'debug') {
        console.log('Executed query', { text, duration, rows: res.rowCount, attempt });
      }
      
      return res;
    } catch (error: any) {
      const duration = Date.now() - start;
      
      // Log error with context
      console.error('Database query error:', { 
        text: text.substring(0, 100) + '...', 
        params: params?.length || 0,
        attempt,
        duration,
        error: error.message,
        code: error.code,
        poolState: {
          total: pool.totalCount,
          idle: pool.idleCount,
          waiting: pool.waitingCount
        }
      });
      
      // Don't retry on certain errors (logical errors)
      if (error.code === '23505' || // Unique constraint violation
          error.code === '23503' || // Foreign key constraint violation
          error.code === '23502' || // Not null violation
          error.code === '23514' || // Check constraint violation
          error.code === '42P01' || // Table does not exist
          error.code === '42703' || // Column does not exist
          error.code === '42883') { // Function does not exist
        poolMetrics.activeQueries--;
        throw error;
      }
      
      // Connection pool errors - check if we need to reset
      if (error.code === 'ECONNREFUSED' || 
          error.code === 'ETIMEDOUT' ||
          error.message.includes('Connection terminated') ||
          error.message.includes('connection timeout')) {
        console.warn('⚠️ Connection issue detected, pool may need reset');
      }
      
      // Last attempt - throw error
      if (attempt === retries) {
        poolMetrics.activeQueries--;
        throw new Error(`Database query failed after ${retries} attempts: ${error.message}`);
      }
      
      // Wait before retry with faster initial retry for connection issues
      const waitTime = error.message.includes('timeout') || error.message.includes('connect') 
        ? Math.min(250 * attempt, 1000)  // Faster retry for timeout/connection issues (250ms, 500ms, 1000ms)
        : Math.min(500 * Math.pow(2, attempt - 1), 3000); // Exponential backoff for other errors
      
      console.log(`Retrying query in ${waitTime}ms (attempt ${attempt + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  poolMetrics.activeQueries--;
};

// Get a client from the pool for transactions with timeout
export const getClient = async (timeoutMs: number = 10000): Promise<PoolClient> => {
  return new Promise(async (resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Database client acquisition timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    
    try {
      const client = await pool.connect();
      clearTimeout(timeoutId);
      resolve(client);
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error);
    }
  });
};

// Execute query with custom timeout
export const queryWithTimeout = async (
  text: string, 
  params?: any[], 
  timeoutMs: number = 30000
): Promise<any> => {
  const client = await getClient();
  
  try {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Query timeout after ${timeoutMs}ms: ${text.substring(0, 100)}...`));
      }, timeoutMs);
      
      try {
        const result = await client.query(text, params);
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  } finally {
    client.release();
  }
};

// Transaction wrapper with timeout
export const withTransaction = async <T>(
  callback: (client: PoolClient) => Promise<T>,
  timeoutMs: number = 60000
): Promise<T> => {
  const client = await getClient(timeoutMs);
  
  try {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Transaction timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      
      try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('Failed to rollback transaction:', rollbackError);
        }
        reject(error);
      }
    });
  } finally {
    client.release();
  }
};

// Graceful shutdown
export const closePool = async (): Promise<void> => {
  try {
    await pool.end();
    console.log('✅ Database pool closed');
  } catch (error) {
    console.error('❌ Error closing database pool:', error);
  }
};