/**
 * Database adapter for Dynamic Form Builder module
 * Uses the shared XP database connection pool
 */

import { pool, query, getClient, withTransaction, queryWithTimeout } from '../../../utils/database';
import { PoolClient } from 'pg';
import { logger } from '../../../utils/logger';

// Re-export shared database functions for module use
export { query, getClient, withTransaction, queryWithTimeout };

/**
 * Get the shared database pool
 */
export const getDb = () => pool;

/**
 * Execute a query within the formbuilder schema
 */
export const querySchema = async (text: string, params?: any[]): Promise<any> => {
  // Prepend schema to query if not already specified
  const schemaQuery = text.includes('formbuilder.') || text.includes('SET search_path') 
    ? text 
    : `SET search_path TO formbuilder, public; ${text}`;
  
  return query(schemaQuery, params);
};

/**
 * Execute a transaction within the formbuilder schema
 */
export const withSchemaTransaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  return withTransaction(async (client) => {
    // Set schema for transaction
    await client.query('SET search_path TO formbuilder, public');
    return callback(client);
  });
};

/**
 * Check if formbuilder schema exists
 */
export const checkSchemaExists = async (): Promise<boolean> => {
  try {
    const result = await query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'formbuilder'"
    );
    return result.rows.length > 0;
  } catch (error) {
    logger.error('Error checking formbuilder schema', { error });
    return false;
  }
};

/**
 * Create formbuilder schema if it doesn't exist
 */
export const createSchemaIfNotExists = async (): Promise<void> => {
  try {
    await query('CREATE SCHEMA IF NOT EXISTS formbuilder');
    logger.info('Formbuilder schema created or already exists');
  } catch (error) {
    logger.error('Error creating formbuilder schema', { error });
    throw error;
  }
};

/**
 * Get table statistics for formbuilder schema
 */
export const getTableStats = async (): Promise<any[]> => {
  const result = await query(`
    SELECT 
      schemaname,
      tablename,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
      n_live_tup AS row_count
    FROM pg_stat_user_tables
    WHERE schemaname = 'formbuilder'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
  `);
  
  return result.rows;
};

/**
 * Execute batch queries efficiently
 */
export const batchQuery = async (queries: Array<{ text: string; params?: any[] }>): Promise<any[]> => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    await client.query('SET search_path TO formbuilder, public');
    
    const results: any[] = [];
    for (const { text, params } of queries) {
      const result = await client.query(text, params);
      results.push(result);
    }
    
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Monitor query performance
 */
export const monitorQuery = async (
  queryName: string,
  text: string,
  params?: any[]
): Promise<any> => {
  const start = Date.now();
  
  try {
    const result = await querySchema(text, params);
    const duration = Date.now() - start;
    
    if (duration > 1000) {
      logger.warn('Slow query detected', {
        queryName,
        duration,
        rowCount: result.rowCount,
      });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('Query failed', {
      queryName,
      duration,
      error,
    });
    throw error;
  }
};