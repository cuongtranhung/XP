/**
 * Multi-User Dashboard API Routes
 * Provides dashboard data and statistics for users
 * Created: 2025-01-12
 */

import express from 'express';
import { Pool } from 'pg';
import { authenticateToken } from '../../../middleware/auth';
import { MultiUserServiceManager } from '../services/MultiUserServiceManager';
import { logger } from '../../../utils/logger';

const router = express.Router();

/**
 * Initialize the service manager
 */
let serviceManager: MultiUserServiceManager;

export const initializeDashboardRoutes = (dbPool: Pool) => {
  serviceManager = MultiUserServiceManager.getInstance(dbPool);
  return router;
};

/**
 * Get user dashboard data
 * GET /api/dashboard/user
 */
router.get('/user', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const dashboardData = await serviceManager.getUserDashboardData(userId);

    res.status(200).json({
      success: true,
      data: {
        user_id: userId,
        ...dashboardData,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error: any) {
    logger.error('Error getting user dashboard data', {
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
 * Get comprehensive form statistics for form owners
 * GET /api/dashboard/form/:formId/stats
 */
router.get('/form/:formId/stats', authenticateToken, async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check if user owns the form
    const formOwner = await serviceManager.permissionService.getFormOwner(formId);
    if (formOwner !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only form owners can view comprehensive statistics'
      });
    }

    const statistics = await serviceManager.getFormStatistics(formId, userId);

    res.status(200).json({
      success: true,
      data: {
        form_id: formId,
        ...statistics,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error: any) {
    logger.error('Error getting form statistics', {
      error: error.message,
      formId: req.params.formId,
      userId: (req as any).user?.id
    });

    if (error.message.includes('Permission denied')) {
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
 * Get user's form access summary
 * GET /api/dashboard/access-summary
 */
router.get('/access-summary', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Get accessible forms
    const accessibleForms = await serviceManager.permissionService.getUserAccessibleForms(
      userId,
      true
    );

    // Group by access type
    const summary = {
      owned: accessibleForms.filter(form => form.access_type === 'owned').length,
      shared: accessibleForms.filter(form => form.access_type === 'shared').length,
      public: accessibleForms.filter(form => form.access_type === 'public').length,
      total: accessibleForms.length
    };

    // Get permission breakdown for shared forms
    const sharedForms = accessibleForms.filter(form => form.access_type === 'shared');
    const permissionBreakdown = {
      view: sharedForms.filter(form => form.permission_level === 'view').length,
      submit: sharedForms.filter(form => form.permission_level === 'submit').length,
      edit: sharedForms.filter(form => form.permission_level === 'edit').length,
      admin: sharedForms.filter(form => form.permission_level === 'admin').length
    };

    res.status(200).json({
      success: true,
      data: {
        user_id: userId,
        access_summary: summary,
        shared_permission_breakdown: permissionBreakdown,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error: any) {
    logger.error('Error getting access summary', {
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
 * Get user's recent activity summary
 * GET /api/dashboard/activity-summary
 */
router.get('/activity-summary', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { days = 7 } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const daysNumber = Math.min(parseInt(days as string) || 7, 30);
    
    // Get recent activity logs
    const recentLogs = await serviceManager.auditService.getUserActivityLogs(
      userId,
      1000 // Get more logs to analyze
    );

    // Filter logs from the specified period
    const cutoffDate = new Date(Date.now() - (daysNumber * 24 * 60 * 60 * 1000));
    const periodLogs = recentLogs.filter(log => 
      new Date(log.created_at) >= cutoffDate
    );

    // Analyze activity
    const activitySummary = {
      period_days: daysNumber,
      total_actions: periodLogs.length,
      unique_forms: new Set(periodLogs.map(log => log.form_id)).size,
      action_breakdown: periodLogs.reduce((acc: any, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      }, {}),
      daily_activity: {} as Record<string, number>,
      most_active_forms: [] as any[]
    };

    // Calculate daily activity
    for (let i = 0; i < daysNumber; i++) {
      const date = new Date(Date.now() - (i * 24 * 60 * 60 * 1000));
      const dateStr = date.toISOString().split('T')[0];
      const dayLogs = periodLogs.filter(log => 
        log.created_at.toISOString().split('T')[0] === dateStr
      );
      activitySummary.daily_activity[dateStr] = dayLogs.length;
    }

    // Find most active forms
    const formActivity = periodLogs.reduce((acc: any, log) => {
      if (!acc[log.form_id]) {
        acc[log.form_id] = {
          form_id: log.form_id,
          form_name: (log as any).form_name || 'Unknown',
          action_count: 0
        };
      }
      acc[log.form_id].action_count++;
      return acc;
    }, {});

    activitySummary.most_active_forms = Object.values(formActivity)
      .sort((a: any, b: any) => b.action_count - a.action_count)
      .slice(0, 5);

    res.status(200).json({
      success: true,
      data: {
        user_id: userId,
        activity_summary: activitySummary,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error: any) {
    logger.error('Error getting activity summary', {
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
 * Get system health and statistics (for admin dashboards)
 * GET /api/dashboard/system-health
 */
router.get('/system-health', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // TODO: Add admin role check when role system is implemented
    // For now, any authenticated user can view basic system health

    const healthCheck = await serviceManager.healthCheck();

    // Get basic system statistics (without sensitive data)
    const systemStats = {
      services_healthy: healthCheck.healthy,
      service_status: healthCheck.services,
      timestamp: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      data: {
        system_health: systemStats,
        errors: healthCheck.errors,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error: any) {
    logger.error('Error getting system health', {
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
 * Get quick stats for navigation/header display
 * GET /api/dashboard/quick-stats
 */
router.get('/quick-stats', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Get basic counts quickly
    const [accessibleForms, sharedForms, recentActivity] = await Promise.all([
      serviceManager.permissionService.getUserAccessibleForms(userId, true),
      serviceManager.sharingService.getUserSharedForms(userId),
      serviceManager.auditService.getUserActivityLogs(userId, 10)
    ]);

    const quickStats = {
      total_accessible_forms: accessibleForms.length,
      owned_forms: accessibleForms.filter(f => f.access_type === 'owned').length,
      shared_with_me: sharedForms.length,
      recent_activity_count: recentActivity.length,
      last_activity: recentActivity.length > 0 ? recentActivity[0].created_at : null
    };

    res.status(200).json({
      success: true,
      data: quickStats
    });

  } catch (error: any) {
    logger.error('Error getting quick stats', {
      error: error.message,
      userId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;