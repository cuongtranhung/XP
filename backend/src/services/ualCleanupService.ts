/**
 * UAL (User Activity Logging) Cleanup Service
 * 
 * Prevents database growth and maintains performance by:
 * 1. Automatic cleanup of old activity logs
 * 2. Index maintenance
 * 3. Performance monitoring
 * 4. Resource management
 */

import { getClient } from '../utils/database';
import { logger } from '../utils/logger';
import { getUALConfig } from '../config/ualConfig';

interface CleanupMetrics {
  totalRecordsDeleted: number;
  cleanupDuration: number;
  lastCleanupTime: Date;
  nextCleanupTime: Date;
  averageRecordsPerDay: number;
  databaseSizeMB: number;
  indexHealthy: boolean;
}

class UALCleanupService {
  private static instance: UALCleanupService;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private config = getUALConfig();
  private metrics: CleanupMetrics = {
    totalRecordsDeleted: 0,
    cleanupDuration: 0,
    lastCleanupTime: new Date(0),
    nextCleanupTime: new Date(),
    averageRecordsPerDay: 0,
    databaseSizeMB: 0,
    indexHealthy: false
  };

  private constructor() {}

  static getInstance(): UALCleanupService {
    if (!UALCleanupService.instance) {
      UALCleanupService.instance = new UALCleanupService();
    }
    return UALCleanupService.instance;
  }

  /**
   * Start the cleanup service
   */
  start(): void {
    if (!this.config.enableAutoCleanup) {
      logger.info('UAL cleanup service disabled by configuration');
      return;
    }

    if (this.cleanupTimer) {
      logger.warn('UAL cleanup service already running');
      return;
    }

    const intervalMs = this.config.cleanupIntervalHours * 60 * 60 * 1000;
    
    // Run initial cleanup after a short delay
    setTimeout(() => {
      this.runCleanup().catch(error => {
        logger.error('Initial UAL cleanup failed', { error: error.message });
      });
    }, 60000); // 1 minute delay

    // Schedule regular cleanups
    this.cleanupTimer = setInterval(async () => {
      try {
        await this.runCleanup();
      } catch (error) {
        logger.error('Scheduled UAL cleanup failed', { 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, intervalMs);

    this.updateNextCleanupTime();
    
    logger.info('UAL cleanup service started', {
      intervalHours: this.config.cleanupIntervalHours,
      retentionDays: this.config.retentionDays,
      nextCleanup: this.metrics.nextCleanupTime
    });
  }

  /**
   * Stop the cleanup service
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      logger.info('UAL cleanup service stopped');
    }
  }

  /**
   * Run cleanup process with comprehensive error handling
   */
  private async runCleanup(): Promise<void> {
    if (this.isRunning) {
      logger.warn('UAL cleanup already in progress, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('Starting UAL cleanup process', {
        retentionDays: this.config.retentionDays
      });

      // Pre-cleanup metrics
      const preCleanupMetrics = await this.gatherPreCleanupMetrics();
      
      // Main cleanup operations
      const deletedRecords = await this.cleanupOldRecords();
      await this.maintainIndexes();
      await this.analyzeTableStatistics();
      
      // Post-cleanup metrics
      const postCleanupMetrics = await this.gatherPostCleanupMetrics();
      
      // Update metrics
      this.metrics.totalRecordsDeleted += deletedRecords;
      this.metrics.lastCleanupTime = new Date();
      this.metrics.cleanupDuration = Date.now() - startTime;
      this.metrics.databaseSizeMB = postCleanupMetrics.sizeMB;
      this.updateNextCleanupTime();

      logger.info('UAL cleanup completed successfully', {
        deletedRecords,
        durationMs: this.metrics.cleanupDuration,
        sizeBefore: preCleanupMetrics.sizeMB,
        sizeAfter: postCleanupMetrics.sizeMB,
        sizeReduced: preCleanupMetrics.sizeMB - postCleanupMetrics.sizeMB,
        nextCleanup: this.metrics.nextCleanupTime
      });

    } catch (error) {
      logger.error('UAL cleanup process failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime
      });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Clean up old activity log records
   */
  private async cleanupOldRecords(): Promise<number> {
    const client = await getClient();
    
    try {
      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      // Use batch deletion to prevent long-running transactions
      const batchSize = 1000;
      let totalDeleted = 0;
      let batchDeleted: number;

      do {
        const result = await client.query(`
          DELETE FROM user_activity_logs 
          WHERE id IN (
            SELECT id FROM user_activity_logs 
            WHERE created_at < $1 
            ORDER BY created_at ASC 
            LIMIT $2
          )
          RETURNING id
        `, [cutoffDate, batchSize]);
        
        batchDeleted = result.rowCount || 0;
        totalDeleted += batchDeleted;

        // Small delay between batches to prevent overwhelming the database
        if (batchDeleted === batchSize) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        logger.debug('UAL cleanup batch completed', {
          batchDeleted,
          totalDeleted,
          cutoffDate
        });

      } while (batchDeleted === batchSize);

      return totalDeleted;

    } catch (error) {
      logger.error('Failed to cleanup old UAL records', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Maintain database indexes for optimal performance
   */
  private async maintainIndexes(): Promise<void> {
    const client = await getClient();
    
    try {
      // Check index health
      const indexCheck = await client.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes 
        WHERE tablename = 'user_activity_logs'
      `);

      // Reindex if necessary (low usage indexes)
      for (const index of indexCheck.rows) {
        if (index.idx_scan < 10 && index.indexname.includes('user_activity_logs')) {
          logger.info('Reindexing UAL table for optimal performance', {
            indexName: index.indexname,
            usage: index.idx_scan
          });
          
          try {
            await client.query(`REINDEX INDEX CONCURRENTLY ${index.indexname}`);
          } catch (reindexError) {
            // CONCURRENTLY might not be supported, try without
            await client.query(`REINDEX INDEX ${index.indexname}`);
          }
        }
      }

      // Update table statistics
      await client.query('ANALYZE user_activity_logs');
      
      this.metrics.indexHealthy = true;
      
    } catch (error) {
      this.metrics.indexHealthy = false;
      logger.error('Failed to maintain UAL indexes', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      client.release();
    }
  }

  /**
   * Analyze table statistics for monitoring
   */
  private async analyzeTableStatistics(): Promise<void> {
    const client = await getClient();
    
    try {
      // Get recent activity patterns
      const activityStats = await client.query(`
        SELECT 
          COUNT(*) as total_records,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7d,
          AVG(EXTRACT(EPOCH FROM (NOW() - created_at))) as avg_age_seconds
        FROM user_activity_logs
      `);

      const stats = activityStats.rows[0];
      this.metrics.averageRecordsPerDay = stats.last_7d / 7;

      logger.debug('UAL table statistics analyzed', {
        totalRecords: stats.total_records,
        last24Hours: stats.last_24h,
        last7Days: stats.last_7d,
        averageRecordsPerDay: this.metrics.averageRecordsPerDay,
        averageAgeHours: stats.avg_age_seconds / 3600
      });

    } catch (error) {
      logger.error('Failed to analyze UAL table statistics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      client.release();
    }
  }

  /**
   * Gather pre-cleanup metrics
   */
  private async gatherPreCleanupMetrics(): Promise<{ sizeMB: number; recordCount: number }> {
    const client = await getClient();
    
    try {
      const sizeQuery = await client.query(`
        SELECT pg_size_pretty(pg_total_relation_size('user_activity_logs')) as size_pretty,
               pg_total_relation_size('user_activity_logs') as size_bytes
      `);

      const countQuery = await client.query('SELECT COUNT(*) as record_count FROM user_activity_logs');

      return {
        sizeMB: parseInt(sizeQuery.rows[0].size_bytes) / (1024 * 1024),
        recordCount: parseInt(countQuery.rows[0].record_count)
      };

    } finally {
      client.release();
    }
  }

  /**
   * Gather post-cleanup metrics
   */
  private async gatherPostCleanupMetrics(): Promise<{ sizeMB: number; recordCount: number }> {
    return await this.gatherPreCleanupMetrics();
  }

  /**
   * Update next cleanup time
   */
  private updateNextCleanupTime(): void {
    this.metrics.nextCleanupTime = new Date(
      Date.now() + (this.config.cleanupIntervalHours * 60 * 60 * 1000)
    );
  }

  /**
   * Get cleanup metrics for monitoring
   */
  getMetrics(): CleanupMetrics {
    return { ...this.metrics };
  }

  /**
   * Get cleanup service health status
   */
  getHealthStatus(): {
    healthy: boolean;
    enabled: boolean;
    isRunning: boolean;
    issues: string[];
    metrics: CleanupMetrics;
  } {
    const issues: string[] = [];
    
    if (!this.config.enableAutoCleanup) {
      issues.push('Auto cleanup is disabled');
    }
    
    if (!this.metrics.indexHealthy) {
      issues.push('Database indexes need maintenance');
    }
    
    const timeSinceLastCleanup = Date.now() - this.metrics.lastCleanupTime.getTime();
    const expectedInterval = this.config.cleanupIntervalHours * 60 * 60 * 1000;
    
    if (timeSinceLastCleanup > expectedInterval * 1.5) {
      issues.push('Cleanup is overdue');
    }
    
    if (this.metrics.averageRecordsPerDay > 10000) {
      issues.push('High activity volume - consider shorter retention period');
    }

    return {
      healthy: issues.length === 0,
      enabled: this.config.enableAutoCleanup,
      isRunning: this.isRunning,
      issues,
      metrics: this.metrics
    };
  }

  /**
   * Manual cleanup trigger (for admin use)
   */
  async triggerCleanup(): Promise<{ success: boolean; message: string; metrics?: any }> {
    if (this.isRunning) {
      return {
        success: false,
        message: 'Cleanup is already in progress'
      };
    }

    try {
      await this.runCleanup();
      return {
        success: true,
        message: 'Manual cleanup completed successfully',
        metrics: this.getMetrics()
      };
    } catch (error) {
      return {
        success: false,
        message: `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// Export singleton instance
export const ualCleanupService = UALCleanupService.getInstance();
export default ualCleanupService;