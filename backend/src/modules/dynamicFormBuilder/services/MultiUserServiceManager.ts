/**
 * Multi-User Service Manager
 * Manages all multi-user access services and their lifecycle
 * Created: 2025-01-12
 */

import { Pool } from 'pg';
import { FormSharingService } from './FormSharingService';
import { FormPermissionService } from './FormPermissionService';
import { FormCloneService } from './FormCloneService';
import { FormAuditService } from './FormAuditService';
import { logger } from '../../../utils/logger';

export class MultiUserServiceManager {
  private static instance: MultiUserServiceManager | null = null;
  
  public readonly sharingService: FormSharingService;
  public readonly permissionService: FormPermissionService;
  public readonly cloneService: FormCloneService;
  public readonly auditService: FormAuditService;
  
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL = 3600000; // 1 hour

  private constructor(dbPool: Pool) {
    // Initialize all services
    this.sharingService = new FormSharingService(dbPool);
    this.permissionService = new FormPermissionService(dbPool);
    this.cloneService = new FormCloneService(dbPool);
    this.auditService = new FormAuditService(dbPool);
    
    // Start cleanup tasks
    this.startCleanupTasks();
    
    logger.info('Multi-User Service Manager initialized');
  }

  /**
   * Get singleton instance
   */
  static getInstance(dbPool?: Pool): MultiUserServiceManager {
    if (!MultiUserServiceManager.instance) {
      if (!dbPool) {
        throw new Error('Database pool required for first initialization');
      }
      MultiUserServiceManager.instance = new MultiUserServiceManager(dbPool);
    }
    return MultiUserServiceManager.instance;
  }

  /**
   * Start periodic cleanup tasks
   */
  private startCleanupTasks(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        // Clean up expired shares
        const expiredShares = await this.sharingService.cleanupExpiredShares();
        if (expiredShares > 0) {
          logger.info(`Cleaned up ${expiredShares} expired shares`);
        }
        
        // Clean up old audit logs (keep 90 days)
        const oldLogs = await this.auditService.cleanupOldLogs(90);
        if (oldLogs > 0) {
          logger.info(`Cleaned up ${oldLogs} old audit logs`);
        }
      } catch (error: any) {
        logger.error('Error in cleanup tasks', { error: error.message });
      }
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Share a form with full audit logging
   */
  async shareFormWithAudit(
    formId: string,
    sharedWithUserId: number,
    sharedByUserId: number,
    permissionLevel: 'view' | 'submit' | 'edit' | 'admin',
    expiresAt?: Date,
    notes?: string,
    request?: { ip?: string; userAgent?: string; sessionId?: string }
  ): Promise<any> {
    try {
      // Share the form
      const result = await this.sharingService.shareForm(
        formId,
        sharedWithUserId,
        sharedByUserId,
        permissionLevel,
        expiresAt,
        notes
      );
      
      // Log the action
      await this.auditService.logAccess(
        formId,
        sharedByUserId,
        'share',
        {
          shared_with: sharedWithUserId,
          permission: permissionLevel,
          expires_at: expiresAt
        },
        result.success,
        result.error,
        request
      );
      
      return result;
    } catch (error: any) {
      logger.error('Error sharing form with audit', { error: error.message });
      throw error;
    }
  }

  /**
   * Clone a form with full audit logging
   */
  async cloneFormWithAudit(
    formId: string,
    userId: number,
    options?: any,
    request?: { ip?: string; userAgent?: string; sessionId?: string }
  ): Promise<any> {
    try {
      // Check permission first
      await this.permissionService.enforcePermission(formId, userId, 'view');
      
      // Clone the form
      const result = await this.cloneService.cloneForm(formId, userId, options);
      
      // Log the action (already logged in cloneForm, but add request details)
      if (result.success && result.cloned_form_id) {
        await this.auditService.logAccess(
          formId,
          userId,
          'clone',
          { cloned_form_id: result.cloned_form_id },
          true,
          undefined,
          request
        );
      }
      
      return result;
    } catch (error: any) {
      // Log failed attempt
      await this.auditService.logAccess(
        formId,
        userId,
        'clone',
        {},
        false,
        error.message,
        request
      );
      throw error;
    }
  }

  /**
   * Check and log form access
   */
  async checkAndLogAccess(
    formId: string,
    userId: number,
    action: 'view' | 'submit' | 'edit' | 'delete',
    request?: { ip?: string; userAgent?: string; sessionId?: string }
  ): Promise<boolean> {
    try {
      // Check permission
      await this.permissionService.enforcePermission(formId, userId, action);
      
      // Log successful access
      await this.auditService.logAccess(
        formId,
        userId,
        action,
        {},
        true,
        undefined,
        request
      );
      
      return true;
    } catch (error: any) {
      // Log denied access
      await this.auditService.logAccess(
        formId,
        userId,
        'access_denied',
        { attempted_action: action },
        false,
        error.message,
        request
      );
      
      return false;
    }
  }

  /**
   * Get comprehensive form statistics
   */
  async getFormStatistics(formId: string, userId: number): Promise<any> {
    try {
      // Check if user can view the form
      const canView = await this.permissionService.canView(formId, userId);
      if (!canView) {
        throw new Error('Permission denied');
      }
      
      // Get various statistics
      const [shares, cloneStats, auditStats] = await Promise.all([
        this.sharingService.getFormShares(formId, userId),
        this.cloneService.getCloneStatistics(formId),
        this.auditService.getFormAuditStatistics(formId)
      ]);
      
      return {
        shares: shares.length,
        clones: cloneStats,
        audit: auditStats
      };
    } catch (error: any) {
      logger.error('Error getting form statistics', { error: error.message });
      throw error;
    }
  }

  /**
   * Bulk operations with permissions
   */
  async bulkShareWithPermissionCheck(
    formId: string,
    userIds: number[],
    sharedBy: number,
    permissionLevel: 'view' | 'submit' | 'edit' | 'admin'
  ): Promise<any> {
    try {
      // Check if sharer owns the form
      await this.permissionService.enforcePermission(formId, sharedBy, 'delete');
      
      // Perform bulk share
      const result = await this.sharingService.bulkShareForm(
        formId,
        userIds,
        sharedBy,
        permissionLevel
      );
      
      // Log the bulk operation
      await this.auditService.logAccess(
        formId,
        sharedBy,
        'share',
        {
          bulk: true,
          user_count: userIds.length,
          succeeded: result.succeeded.length,
          failed: result.failed.length
        },
        true
      );
      
      return result;
    } catch (error: any) {
      logger.error('Error in bulk share', { error: error.message });
      throw error;
    }
  }

  /**
   * Get user's dashboard data
   */
  async getUserDashboardData(userId: number): Promise<any> {
    try {
      const [sharedForms, templates, activityLogs] = await Promise.all([
        this.sharingService.getUserSharedForms(userId),
        this.cloneService.getAvailableTemplates(userId),
        this.auditService.getUserActivityLogs(userId, 20)
      ]);
      
      return {
        shared_forms: sharedForms,
        available_templates: templates,
        recent_activity: activityLogs
      };
    } catch (error: any) {
      logger.error('Error getting user dashboard data', { error: error.message });
      return {
        shared_forms: [],
        available_templates: [],
        recent_activity: []
      };
    }
  }

  /**
   * Generate comprehensive audit report
   */
  async generateComprehensiveAuditReport(
    formId: string,
    requesterId: number,
    dateFrom: Date,
    dateTo: Date
  ): Promise<any> {
    try {
      // Check if requester owns the form
      const isOwner = await this.permissionService.getFormOwner(formId) === requesterId;
      if (!isOwner) {
        throw new Error('Only form owners can generate audit reports');
      }
      
      // Generate the report
      const report = await this.auditService.generateAuditReport(
        formId,
        dateFrom,
        dateTo
      );
      
      // Add sharing and clone information
      const [shares, cloneHistory] = await Promise.all([
        this.sharingService.getFormShares(formId, requesterId),
        this.cloneService.getCloneHistory(formId)
      ]);
      
      return {
        ...report,
        current_shares: shares,
        clone_history: cloneHistory
      };
    } catch (error: any) {
      logger.error('Error generating comprehensive audit report', { error: error.message });
      throw error;
    }
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    try {
      // Stop cleanup tasks
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }
      
      // Shutdown audit service (flushes batch queue)
      await this.auditService.shutdown();
      
      logger.info('Multi-User Service Manager shut down');
    } catch (error: any) {
      logger.error('Error shutting down service manager', { error: error.message });
    }
  }

  /**
   * Health check for all services
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    services: Record<string, boolean>;
    errors: string[];
  }> {
    const errors: string[] = [];
    const services: Record<string, boolean> = {
      sharing: false,
      permissions: false,
      clone: false,
      audit: false
    };
    
    try {
      // Test each service with a simple operation
      try {
        await this.sharingService.getUserSharedForms(-1);
        services.sharing = true;
      } catch (e: any) {
        errors.push(`Sharing service: ${e.message}`);
      }
      
      try {
        await this.permissionService.isFormPublic('test');
        services.permissions = true;
      } catch (e: any) {
        errors.push(`Permission service: ${e.message}`);
      }
      
      try {
        await this.cloneService.getAvailableTemplates(-1);
        services.clone = true;
      } catch (e: any) {
        errors.push(`Clone service: ${e.message}`);
      }
      
      try {
        await this.auditService.getUserActivityLogs(-1, 1);
        services.audit = true;
      } catch (e: any) {
        errors.push(`Audit service: ${e.message}`);
      }
      
      const healthy = Object.values(services).every(v => v);
      
      return { healthy, services, errors };
    } catch (error: any) {
      return {
        healthy: false,
        services,
        errors: [...errors, `General error: ${error.message}`]
      };
    }
  }
}