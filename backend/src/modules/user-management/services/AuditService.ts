import { query } from '../config/database';
import { AuditLog, ServiceResponse, PaginatedResponse, PaginationParams } from '../types';

export interface AuditLogEntry {
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
}

export interface AuditFilter {
  user_id?: string;
  action?: string;
  entity_type?: string;
  entity_id?: string;
  start_date?: Date;
  end_date?: Date;
}

export class AuditService {
  /**
   * Log an audit entry
   */
  async logAction(entry: AuditLogEntry): Promise<ServiceResponse<AuditLog>> {
    try {
      const result = await query(
        `INSERT INTO audit_logs (
          user_id, action, entity_type, entity_id,
          old_values, new_values, ip_address, user_agent,
          session_id, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()
        ) RETURNING *`,
        [
          entry.user_id || null,
          entry.action,
          entry.entity_type,
          entry.entity_id || null,
          entry.old_values ? JSON.stringify(entry.old_values) : null,
          entry.new_values ? JSON.stringify(entry.new_values) : null,
          entry.ip_address || null,
          entry.user_agent || null,
          entry.session_id || null
        ]
      );

      return {
        success: true,
        data: result.rows[0]
      };
    } catch (error: any) {
      console.error('Error logging audit entry:', error);
      return {
        success: false,
        error: error.message || 'Failed to log audit entry'
      };
    }
  }

  /**
   * Get audit logs with filters
   */
  async getAuditLogs(
    filters: AuditFilter = {},
    pagination: PaginationParams = {}
  ): Promise<ServiceResponse<PaginatedResponse<AuditLog>>> {
    try {
      const page = pagination.page || 1;
      const limit = pagination.limit || 50;
      const offset = (page - 1) * limit;

      let whereConditions: string[] = [];
      let params: any[] = [];
      let paramCount = 1;

      // Build filter conditions
      if (filters.user_id) {
        whereConditions.push(`user_id = $${paramCount++}`);
        params.push(filters.user_id);
      }
      if (filters.action) {
        whereConditions.push(`action = $${paramCount++}`);
        params.push(filters.action);
      }
      if (filters.entity_type) {
        whereConditions.push(`entity_type = $${paramCount++}`);
        params.push(filters.entity_type);
      }
      if (filters.entity_id) {
        whereConditions.push(`entity_id = $${paramCount++}`);
        params.push(filters.entity_id);
      }
      if (filters.start_date) {
        whereConditions.push(`created_at >= $${paramCount++}`);
        params.push(filters.start_date);
      }
      if (filters.end_date) {
        whereConditions.push(`created_at <= $${paramCount++}`);
        params.push(filters.end_date);
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : '';

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) FROM audit_logs ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      // Get paginated results
      params.push(limit, offset);
      const result = await query(
        `SELECT * FROM audit_logs 
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramCount++} OFFSET $${paramCount}`,
        params
      );

      return {
        success: true,
        data: {
          items: result.rows,
          total,
          page,
          limit,
          total_pages: Math.ceil(total / limit)
        }
      };
    } catch (error: any) {
      console.error('Error fetching audit logs:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch audit logs'
      };
    }
  }

  /**
   * Get audit logs for a specific entity
   */
  async getEntityAuditLogs(
    entityType: string,
    entityId: string,
    pagination: PaginationParams = {}
  ): Promise<ServiceResponse<PaginatedResponse<AuditLog>>> {
    return this.getAuditLogs(
      { entity_type: entityType, entity_id: entityId },
      pagination
    );
  }

  /**
   * Get user activity logs
   */
  async getUserActivityLogs(
    userId: string,
    pagination: PaginationParams = {}
  ): Promise<ServiceResponse<PaginatedResponse<AuditLog>>> {
    return this.getAuditLogs(
      { user_id: userId },
      pagination
    );
  }

  /**
   * Get recent actions
   */
  async getRecentActions(
    limit: number = 10
  ): Promise<ServiceResponse<AuditLog[]>> {
    try {
      const result = await query(
        `SELECT al.*, u.email, u.full_name 
         FROM audit_logs al
         LEFT JOIN users u ON al.user_id = u.id
         ORDER BY al.created_at DESC
         LIMIT $1`,
        [limit]
      );

      return {
        success: true,
        data: result.rows
      };
    } catch (error: any) {
      console.error('Error fetching recent actions:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch recent actions'
      };
    }
  }

  /**
   * Get audit statistics
   */
  async getAuditStatistics(
    startDate?: Date,
    endDate?: Date
  ): Promise<ServiceResponse<any>> {
    try {
      let dateFilter = '';
      const params: any[] = [];
      
      if (startDate && endDate) {
        dateFilter = 'WHERE created_at BETWEEN $1 AND $2';
        params.push(startDate, endDate);
      } else if (startDate) {
        dateFilter = 'WHERE created_at >= $1';
        params.push(startDate);
      } else if (endDate) {
        dateFilter = 'WHERE created_at <= $1';
        params.push(endDate);
      }

      // Get action counts
      const actionCounts = await query(
        `SELECT action, COUNT(*) as count
         FROM audit_logs
         ${dateFilter}
         GROUP BY action
         ORDER BY count DESC`,
        params
      );

      // Get entity type counts
      const entityCounts = await query(
        `SELECT entity_type, COUNT(*) as count
         FROM audit_logs
         ${dateFilter}
         GROUP BY entity_type
         ORDER BY count DESC`,
        params
      );

      // Get most active users
      const activeUsers = await query(
        `SELECT 
          al.user_id,
          u.email,
          u.full_name,
          COUNT(*) as action_count
         FROM audit_logs al
         LEFT JOIN users u ON al.user_id = u.id
         ${dateFilter}
         ${dateFilter ? 'AND' : 'WHERE'} al.user_id IS NOT NULL
         GROUP BY al.user_id, u.email, u.full_name
         ORDER BY action_count DESC
         LIMIT 10`,
        params
      );

      return {
        success: true,
        data: {
          action_counts: actionCounts.rows,
          entity_counts: entityCounts.rows,
          most_active_users: activeUsers.rows
        }
      };
    } catch (error: any) {
      console.error('Error fetching audit statistics:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch audit statistics'
      };
    }
  }

  /**
   * Clean old audit logs (for maintenance)
   */
  async cleanOldAuditLogs(
    retentionDays: number = 90
  ): Promise<ServiceResponse<number>> {
    try {
      const result = await query(
        `DELETE FROM audit_logs 
         WHERE created_at < NOW() - INTERVAL '${retentionDays} days'
         RETURNING id`
      );

      const deletedCount = result.rowCount || 0;

      // Log the cleanup action itself
      await this.logAction({
        action: 'CLEANUP_AUDIT_LOGS',
        entity_type: 'system',
        new_values: {
          deleted_count: deletedCount,
          retention_days: retentionDays
        }
      });

      return {
        success: true,
        data: deletedCount,
        message: `Deleted ${deletedCount} old audit log entries`
      };
    } catch (error: any) {
      console.error('Error cleaning audit logs:', error);
      return {
        success: false,
        error: error.message || 'Failed to clean audit logs'
      };
    }
  }
}