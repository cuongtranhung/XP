/**
 * Form Audit Service
 * Handles audit logging for form access and actions
 * Created: 2025-01-12
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../utils/logger';
import { 
  AuditAction,
  FormAccessLog
} from '../types/multiuser.types';

export class FormAuditService {
  private db: Pool;
  private batchQueue: Map<string, FormAccessLog[]> = new Map();
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 50;
  private readonly BATCH_INTERVAL = 5000; // 5 seconds

  constructor(dbPool: Pool) {
    this.db = dbPool;
  }

  /**
   * Log a form access or action
   */
  async logAccess(
    formId: string,
    userId: number | null,
    action: AuditAction,
    metadata?: Record<string, any>,
    success: boolean = true,
    errorMessage?: string,
    request?: {
      ip?: string;
      userAgent?: string;
      sessionId?: string;
    }
  ): Promise<void> {
    try {
      const log: FormAccessLog = {
        id: uuidv4(),
        form_id: formId,
        user_id: userId,
        session_id: request?.sessionId || null,
        action,
        ip_address: request?.ip || null,
        user_agent: request?.userAgent || null,
        metadata: metadata || null,
        success,
        error_message: errorMessage || null,
        created_at: new Date()
      };

      // Add to batch queue
      this.addToBatch(log);

      // Log critical actions immediately
      if (this.isCriticalAction(action) || !success) {
        await this.flushBatch();
      }

    } catch (error: any) {
      logger.error('Error logging form access', { 
        error: error.message, 
        formId, 
        action 
      });
    }
  }

  /**
   * Get form access logs with filters
   */
  async getFormAccessLogs(
    formId: string,
    filters?: {
      userId?: number;
      action?: AuditAction;
      dateFrom?: Date;
      dateTo?: Date;
      limit?: number;
      offset?: number;
      onlyFailures?: boolean;
    }
  ): Promise<FormAccessLog[]> {
    try {
      let query = `
        SELECT 
          fal.*,
          u.email as user_email,
          u.full_name as user_name
        FROM form_access_logs fal
        LEFT JOIN users u ON fal.user_id = u.id
        WHERE fal.form_id = $1
      `;
      const params: any[] = [formId];
      let paramIndex = 2;

      if (filters?.userId) {
        query += ` AND fal.user_id = $${paramIndex}`;
        params.push(filters.userId);
        paramIndex++;
      }

      if (filters?.action) {
        query += ` AND fal.action = $${paramIndex}`;
        params.push(filters.action);
        paramIndex++;
      }

      if (filters?.dateFrom) {
        query += ` AND fal.created_at >= $${paramIndex}`;
        params.push(filters.dateFrom);
        paramIndex++;
      }

      if (filters?.dateTo) {
        query += ` AND fal.created_at <= $${paramIndex}`;
        params.push(filters.dateTo);
        paramIndex++;
      }

      if (filters?.onlyFailures) {
        query += ` AND fal.success = false`;
      }

      query += ` ORDER BY fal.created_at DESC`;

      if (filters?.limit) {
        query += ` LIMIT $${paramIndex}`;
        params.push(filters.limit);
        paramIndex++;
      }

      if (filters?.offset) {
        query += ` OFFSET $${paramIndex}`;
        params.push(filters.offset);
      }

      const result = await this.db.query(query, params);
      return result.rows;

    } catch (error: any) {
      logger.error('Error getting form access logs', { 
        error: error.message, 
        formId 
      });
      return [];
    }
  }

  /**
   * Get user activity logs
   */
  async getUserActivityLogs(
    userId: number,
    limit: number = 100
  ): Promise<FormAccessLog[]> {
    try {
      const result = await this.db.query(
        `SELECT 
          fal.*,
          f.name as form_name
         FROM form_access_logs fal
         LEFT JOIN forms f ON fal.form_id = f.id
         WHERE fal.user_id = $1
         ORDER BY fal.created_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows;

    } catch (error: any) {
      logger.error('Error getting user activity logs', { 
        error: error.message, 
        userId 
      });
      return [];
    }
  }

  /**
   * Get audit statistics for a form
   */
  async getFormAuditStatistics(
    formId: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<any> {
    try {
      let query = `
        SELECT 
          action,
          COUNT(*) as count,
          COUNT(DISTINCT user_id) as unique_users,
          SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed,
          MIN(created_at) as first_occurrence,
          MAX(created_at) as last_occurrence
        FROM form_access_logs
        WHERE form_id = $1
      `;
      const params: any[] = [formId];
      let paramIndex = 2;

      if (dateFrom) {
        query += ` AND created_at >= $${paramIndex}`;
        params.push(dateFrom);
        paramIndex++;
      }

      if (dateTo) {
        query += ` AND created_at <= $${paramIndex}`;
        params.push(dateTo);
        paramIndex++;
      }

      query += ` GROUP BY action ORDER BY count DESC`;

      const result = await this.db.query(query, params);

      // Get overall statistics
      const overallQuery = `
        SELECT 
          COUNT(*) as total_actions,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT DATE(created_at)) as active_days,
          AVG(CASE WHEN success THEN 1 ELSE 0 END) * 100 as success_rate
        FROM form_access_logs
        WHERE form_id = $1
      `;
      const overallParams = [formId];

      if (dateFrom) {
        overallParams.push(dateFrom);
      }
      if (dateTo) {
        overallParams.push(dateTo);
      }

      const overallResult = await this.db.query(
        overallQuery + (dateFrom ? ' AND created_at >= $2' : '') + 
        (dateTo ? ` AND created_at <= $${dateFrom ? 3 : 2}` : ''),
        overallParams
      );

      return {
        overall: overallResult.rows[0],
        by_action: result.rows
      };

    } catch (error: any) {
      logger.error('Error getting form audit statistics', { 
        error: error.message, 
        formId 
      });
      return {
        overall: {},
        by_action: []
      };
    }
  }

  /**
   * Get security events (failed access attempts)
   */
  async getSecurityEvents(
    filters?: {
      formId?: string;
      userId?: number;
      dateFrom?: Date;
      limit?: number;
    }
  ): Promise<FormAccessLog[]> {
    try {
      let query = `
        SELECT 
          fal.*,
          f.name as form_name,
          u.email as user_email
        FROM form_access_logs fal
        LEFT JOIN forms f ON fal.form_id = f.id
        LEFT JOIN users u ON fal.user_id = u.id
        WHERE fal.success = false
          OR fal.action = 'access_denied'
      `;
      const params: any[] = [];
      let paramIndex = 1;

      if (filters?.formId) {
        query += ` AND fal.form_id = $${paramIndex}`;
        params.push(filters.formId);
        paramIndex++;
      }

      if (filters?.userId) {
        query += ` AND fal.user_id = $${paramIndex}`;
        params.push(filters.userId);
        paramIndex++;
      }

      if (filters?.dateFrom) {
        query += ` AND fal.created_at >= $${paramIndex}`;
        params.push(filters.dateFrom);
        paramIndex++;
      }

      query += ` ORDER BY fal.created_at DESC`;

      if (filters?.limit) {
        query += ` LIMIT $${paramIndex}`;
        params.push(filters.limit);
      }

      const result = await this.db.query(query, params);
      return result.rows;

    } catch (error: any) {
      logger.error('Error getting security events', { 
        error: error.message 
      });
      return [];
    }
  }

  /**
   * Clean up old audit logs
   */
  async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    try {
      const result = await this.db.query(
        `DELETE FROM form_access_logs 
         WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'`
      );

      if (result.rowCount > 0) {
        logger.info(`Cleaned up ${result.rowCount} old audit logs`);
      }

      return result.rowCount;

    } catch (error: any) {
      logger.error('Error cleaning up old logs', { 
        error: error.message 
      });
      return 0;
    }
  }

  /**
   * Generate audit report for a form
   */
  async generateAuditReport(
    formId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<any> {
    try {
      // Get statistics
      const statistics = await this.getFormAuditStatistics(
        formId, 
        dateFrom, 
        dateTo
      );

      // Get top users
      const topUsersResult = await this.db.query(
        `SELECT 
          user_id,
          u.email,
          u.full_name,
          COUNT(*) as action_count,
          ARRAY_AGG(DISTINCT action) as actions
         FROM form_access_logs fal
         LEFT JOIN users u ON fal.user_id = u.id
         WHERE form_id = $1 
           AND created_at >= $2 
           AND created_at <= $3
           AND user_id IS NOT NULL
         GROUP BY user_id, u.email, u.full_name
         ORDER BY action_count DESC
         LIMIT 10`,
        [formId, dateFrom, dateTo]
      );

      // Get daily activity
      const dailyActivityResult = await this.db.query(
        `SELECT 
          DATE(created_at) as date,
          COUNT(*) as total_actions,
          COUNT(DISTINCT user_id) as unique_users,
          ARRAY_AGG(DISTINCT action) as actions
         FROM form_access_logs
         WHERE form_id = $1 
           AND created_at >= $2 
           AND created_at <= $3
         GROUP BY DATE(created_at)
         ORDER BY date`,
        [formId, dateFrom, dateTo]
      );

      // Get security events
      const securityEvents = await this.getSecurityEvents({
        formId,
        dateFrom,
        limit: 50
      });

      return {
        form_id: formId,
        period: {
          from: dateFrom,
          to: dateTo
        },
        statistics,
        top_users: topUsersResult.rows,
        daily_activity: dailyActivityResult.rows,
        security_events: securityEvents
      };

    } catch (error: any) {
      logger.error('Error generating audit report', { 
        error: error.message, 
        formId 
      });
      throw error;
    }
  }

  /**
   * Export audit logs to CSV
   */
  async exportAuditLogs(
    formId: string,
    filters?: any
  ): Promise<string> {
    try {
      const logs = await this.getFormAccessLogs(formId, filters);
      
      // Create CSV header
      const headers = [
        'Date/Time',
        'User',
        'Action',
        'Success',
        'IP Address',
        'User Agent',
        'Error Message'
      ];
      
      // Create CSV rows
      const rows = logs.map(log => [
        log.created_at.toISOString(),
        (log as any).user_email || 'Anonymous',
        log.action,
        log.success ? 'Yes' : 'No',
        log.ip_address || '',
        log.user_agent || '',
        log.error_message || ''
      ]);
      
      // Combine into CSV string
      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');
      
      return csv;

    } catch (error: any) {
      logger.error('Error exporting audit logs', { 
        error: error.message, 
        formId 
      });
      throw error;
    }
  }

  /**
   * Helper: Add log to batch queue
   */
  private addToBatch(log: FormAccessLog): void {
    const key = log.form_id;
    
    if (!this.batchQueue.has(key)) {
      this.batchQueue.set(key, []);
    }
    
    this.batchQueue.get(key)!.push(log);
    
    // Flush if batch is full
    if (this.batchQueue.get(key)!.length >= this.BATCH_SIZE) {
      this.flushBatch();
    } else {
      // Schedule batch flush
      this.scheduleBatchFlush();
    }
  }

  /**
   * Helper: Schedule batch flush
   */
  private scheduleBatchFlush(): void {
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushBatch();
      }, this.BATCH_INTERVAL);
    }
  }

  /**
   * Helper: Flush batch queue to database
   */
  private async flushBatch(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.batchQueue.size === 0) {
      return;
    }

    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      for (const [formId, logs] of this.batchQueue.entries()) {
        if (logs.length === 0) continue;

        // Build bulk insert query
        const values = logs.map((log, index) => {
          const offset = index * 9;
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`;
        }).join(', ');

        const query = `
          INSERT INTO form_access_logs 
          (id, form_id, user_id, session_id, action, ip_address, user_agent, metadata, success, error_message, created_at)
          VALUES ${values}
        `;

        const params = logs.flatMap(log => [
          log.id,
          log.form_id,
          log.user_id,
          log.session_id,
          log.action,
          log.ip_address,
          log.user_agent,
          JSON.stringify(log.metadata),
          log.success,
          log.error_message,
          log.created_at
        ]);

        await client.query(query, params);
      }

      await client.query('COMMIT');
      
      // Clear the batch queue
      this.batchQueue.clear();

    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Error flushing audit log batch', { 
        error: error.message 
      });
    } finally {
      client.release();
    }
  }

  /**
   * Helper: Check if action is critical
   */
  private isCriticalAction(action: AuditAction): boolean {
    const criticalActions: AuditAction[] = [
      'delete',
      'share',
      'unshare',
      'permission_change',
      'access_denied'
    ];
    
    return criticalActions.includes(action);
  }

  /**
   * Cleanup on service shutdown
   */
  async shutdown(): Promise<void> {
    await this.flushBatch();
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }
}