/**
 * Form Audit API Routes
 * Handles audit logging and security monitoring
 * Created: 2025-01-12
 */

import express from 'express';
import { Pool } from 'pg';
import { authenticateToken } from '../../../middleware/auth';
import { MultiUserServiceManager } from '../services/MultiUserServiceManager';
import { logger } from '../../../utils/logger';
import { AuditAction } from '../types/multiuser.types';

const router = express.Router();

/**
 * Initialize the service manager
 */
let serviceManager: MultiUserServiceManager;

export const initializeAuditRoutes = (dbPool: Pool) => {
  serviceManager = MultiUserServiceManager.getInstance(dbPool);
  return router;
};

/**
 * Get form access logs
 * GET /api/forms/:formId/audit-logs
 */
router.get('/:formId/audit-logs', authenticateToken, async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = (req as any).user?.id;
    
    // Query parameters
    const {
      action,
      user_id,
      date_from,
      date_to,
      limit = 50,
      offset = 0,
      only_failures = false
    } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check if user can view audit logs (only owner can see detailed logs)
    const formOwner = await serviceManager.permissionService.getFormOwner(formId);
    if (formOwner !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only form owners can view audit logs'
      });
    }

    // Build filters
    const filters: any = {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      onlyFailures: only_failures === 'true'
    };

    if (action) {
      const validActions: AuditAction[] = [
        'view', 'submit', 'edit', 'delete', 'share', 'unshare', 
        'clone', 'export', 'publish', 'unpublish', 'permission_change', 'access_denied'
      ];
      if (validActions.includes(action as AuditAction)) {
        filters.action = action as AuditAction;
      }
    }

    if (user_id) {
      filters.userId = parseInt(user_id as string);
    }

    if (date_from) {
      filters.dateFrom = new Date(date_from as string);
      if (isNaN(filters.dateFrom.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date_from format'
        });
      }
    }

    if (date_to) {
      filters.dateTo = new Date(date_to as string);
      if (isNaN(filters.dateTo.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date_to format'
        });
      }
    }

    const logs = await serviceManager.auditService.getFormAccessLogs(formId, filters);

    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: logs.length
      }
    });

  } catch (error: any) {
    logger.error('Error getting audit logs', {
      error: error.message,
      formId: req.params.formId,
      userId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get user activity logs
 * GET /api/users/my-activity
 */
router.get('/my-activity', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { limit = 50 } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const logs = await serviceManager.auditService.getUserActivityLogs(
      userId,
      parseInt(limit as string)
    );

    res.status(200).json({
      success: true,
      data: logs,
      total: logs.length
    });

  } catch (error: any) {
    logger.error('Error getting user activity logs', {
      error: error.message,
      userId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get form audit statistics
 * GET /api/forms/:formId/audit-stats
 */
router.get('/:formId/audit-stats', authenticateToken, async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = (req as any).user?.id;
    const { date_from, date_to } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check if user can view stats (only owner can see detailed stats)
    const formOwner = await serviceManager.permissionService.getFormOwner(formId);
    if (formOwner !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only form owners can view audit statistics'
      });
    }

    // Parse dates
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;

    if (date_from) {
      dateFrom = new Date(date_from as string);
      if (isNaN(dateFrom.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date_from format'
        });
      }
    }

    if (date_to) {
      dateTo = new Date(date_to as string);
      if (isNaN(dateTo.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date_to format'
        });
      }
    }

    const statistics = await serviceManager.auditService.getFormAuditStatistics(
      formId,
      dateFrom,
      dateTo
    );

    res.status(200).json({
      success: true,
      data: {
        form_id: formId,
        period: {
          from: dateFrom,
          to: dateTo
        },
        ...statistics
      }
    });

  } catch (error: any) {
    logger.error('Error getting audit statistics', {
      error: error.message,
      formId: req.params.formId,
      userId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get security events
 * GET /api/security/events
 */
router.get('/security/events', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { form_id, user_id, date_from, limit = 50 } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // If form_id is specified, check ownership
    if (form_id) {
      const formOwner = await serviceManager.permissionService.getFormOwner(form_id as string);
      if (formOwner !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Only form owners can view security events for their forms'
        });
      }
    }

    // Build filters
    const filters: any = {
      limit: parseInt(limit as string)
    };

    if (form_id) {
      filters.formId = form_id as string;
    }

    if (user_id) {
      filters.userId = parseInt(user_id as string);
    }

    if (date_from) {
      filters.dateFrom = new Date(date_from as string);
      if (isNaN(filters.dateFrom.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date_from format'
        });
      }
    }

    const events = await serviceManager.auditService.getSecurityEvents(filters);

    res.status(200).json({
      success: true,
      data: events,
      total: events.length
    });

  } catch (error: any) {
    logger.error('Error getting security events', {
      error: error.message,
      userId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Generate comprehensive audit report
 * POST /api/forms/:formId/audit-report
 */
router.post('/:formId/audit-report', authenticateToken, async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = (req as any).user?.id;
    const { date_from, date_to } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!date_from || !date_to) {
      return res.status(400).json({
        success: false,
        error: 'date_from and date_to are required'
      });
    }

    // Parse dates
    const dateFrom = new Date(date_from);
    const dateTo = new Date(date_to);

    if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format'
      });
    }

    if (dateFrom >= dateTo) {
      return res.status(400).json({
        success: false,
        error: 'date_from must be before date_to'
      });
    }

    const report = await serviceManager.generateComprehensiveAuditReport(
      formId,
      userId,
      dateFrom,
      dateTo
    );

    res.status(200).json({
      success: true,
      data: report
    });

  } catch (error: any) {
    logger.error('Error generating audit report', {
      error: error.message,
      formId: req.params.formId,
      userId: (req as any).user?.id
    });

    if (error.message.includes('Only form owners')) {
      return res.status(403).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Export audit logs to CSV
 * GET /api/forms/:formId/audit-logs/export
 */
router.get('/:formId/audit-logs/export', authenticateToken, async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = (req as any).user?.id;
    
    // Query parameters (same as audit logs endpoint)
    const {
      action,
      user_id,
      date_from,
      date_to,
      only_failures = false
    } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check ownership
    const formOwner = await serviceManager.permissionService.getFormOwner(formId);
    if (formOwner !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only form owners can export audit logs'
      });
    }

    // Build filters (same as above)
    const filters: any = {
      onlyFailures: only_failures === 'true'
    };

    if (action) {
      const validActions: AuditAction[] = [
        'view', 'submit', 'edit', 'delete', 'share', 'unshare', 
        'clone', 'export', 'publish', 'unpublish', 'permission_change', 'access_denied'
      ];
      if (validActions.includes(action as AuditAction)) {
        filters.action = action as AuditAction;
      }
    }

    if (user_id) filters.userId = parseInt(user_id as string);
    if (date_from) filters.dateFrom = new Date(date_from as string);
    if (date_to) filters.dateTo = new Date(date_to as string);

    const csvData = await serviceManager.auditService.exportAuditLogs(formId, filters);

    // Set CSV headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="form-${formId}-audit-logs.csv"`);
    
    // Log export action
    await serviceManager.auditService.logAccess(
      formId,
      userId,
      'export',
      { 
        action: 'export_audit_logs',
        filters 
      },
      true,
      undefined,
      {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId: (req as any).sessionId
      }
    );

    res.status(200).send(csvData);

  } catch (error: any) {
    logger.error('Error exporting audit logs', {
      error: error.message,
      formId: req.params.formId,
      userId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Clean up old audit logs (admin only)
 * DELETE /api/audit/cleanup
 */
router.delete('/cleanup', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { days_to_keep = 90 } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // TODO: Add admin role check when role system is implemented
    // For now, only allow specific admin users (this should be replaced with proper role check)
    // const isAdmin = await checkAdminRole(userId);
    // if (!isAdmin) {
    //   return res.status(403).json({
    //     success: false,
    //     error: 'Admin access required'
    //   });
    // }

    const deletedCount = await serviceManager.auditService.cleanupOldLogs(
      parseInt(days_to_keep)
    );

    // Log cleanup action
    await serviceManager.auditService.logAccess(
      'system',
      userId,
      'delete',
      {
        action: 'cleanup_audit_logs',
        days_to_keep: days_to_keep,
        deleted_count: deletedCount
      },
      true,
      undefined,
      {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId: (req as any).sessionId
      }
    );

    res.status(200).json({
      success: true,
      data: {
        deleted_count: deletedCount,
        days_kept: days_to_keep
      },
      message: `Cleaned up ${deletedCount} old audit log entries`
    });

  } catch (error: any) {
    logger.error('Error cleaning up audit logs', {
      error: error.message,
      userId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get service health check
 * GET /api/audit/health
 */
router.get('/health', async (req, res) => {
  try {
    const healthCheck = await serviceManager.healthCheck();

    const statusCode = healthCheck.healthy ? 200 : 503;
    
    res.status(statusCode).json({
      success: healthCheck.healthy,
      data: healthCheck
    });

  } catch (error: any) {
    logger.error('Error checking service health', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;