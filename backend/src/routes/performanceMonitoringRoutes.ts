/**
 * Performance Monitoring Dashboard Routes
 * API endpoints for real-time performance monitoring and alerting
 */

import { Router, Request, Response } from 'express';
import { performanceMonitoringService } from '../services/performanceMonitoringService';
import auth from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Async handler for route error handling
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: Function) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Get dashboard data
 * GET /api/monitoring/dashboard
 */
router.get('/dashboard', auth, asyncHandler(async (req: Request, res: Response) => {
  const requestingUser = req.user as any;

  // Only admin users can access monitoring dashboard
  if (requestingUser.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Admin access required for monitoring dashboard'
    });
  }

  const { timeRange = '6h' } = req.query;
  
  if (!['1h', '6h', '24h', '7d'].includes(timeRange as string)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid time range. Must be: 1h, 6h, 24h, or 7d'
    });
  }

  try {
    const dashboardData = await performanceMonitoringService.getDashboardData(timeRange as '1h' | '6h' | '24h' | '7d');

    res.json({
      success: true,
      data: {
        dashboard: dashboardData,
        retrievedAt: new Date(),
        timeRange
      }
    });

  } catch (error) {
    logger.error('Failed to get dashboard data', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestedBy: requestingUser.userId,
      timeRange
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard data: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
}));

/**
 * Get current metrics
 * GET /api/monitoring/metrics
 */
router.get('/metrics', auth, asyncHandler(async (req: Request, res: Response) => {
  const requestingUser = req.user as any;

  // Only admin users can access metrics
  if (requestingUser.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Admin access required'
    });
  }

  const { format = 'json' } = req.query;

  try {
    const dashboardData = await performanceMonitoringService.getDashboardData('1h');

    if (format === 'prometheus') {
      res.set('Content-Type', 'text/plain');
      const prometheusData = performanceMonitoringService.exportMetrics('prometheus', '1h');
      return res.send(prometheusData);
    }

    res.json({
      success: true,
      data: {
        current: dashboardData.currentMetrics,
        timestamp: new Date()
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get metrics'
    });
  }
}));

/**
 * Export metrics data
 * GET /api/monitoring/export
 */
router.get('/export', auth, asyncHandler(async (req: Request, res: Response) => {
  const requestingUser = req.user as any;

  // Only admin users can export data
  if (requestingUser.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Admin access required'
    });
  }

  const { format = 'json', timeRange = '24h' } = req.query;

  if (!['json', 'csv', 'prometheus'].includes(format as string)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid format. Must be: json, csv, or prometheus'
    });
  }

  if (!['1h', '6h', '24h', '7d'].includes(timeRange as string)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid time range. Must be: 1h, 6h, 24h, or 7d'
    });
  }

  try {
    const exportData = performanceMonitoringService.exportMetrics(
      format as 'json' | 'csv' | 'prometheus',
      timeRange as '1h' | '6h' | '24h' | '7d'
    );

    // Set appropriate content type and filename
    const contentTypes = {
      json: 'application/json',
      csv: 'text/csv',
      prometheus: 'text/plain'
    };

    const extensions = {
      json: 'json',
      csv: 'csv',
      prometheus: 'txt'
    };

    const filename = `performance-metrics-${timeRange}.${extensions[format as keyof typeof extensions]}`;

    res.set({
      'Content-Type': contentTypes[format as keyof typeof contentTypes],
      'Content-Disposition': `attachment; filename="${filename}"`
    });

    res.send(exportData);

    logger.info('Metrics exported', {
      format,
      timeRange,
      exportedBy: requestingUser.userId
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Export failed'
    });
  }
}));

/**
 * Get alerts
 * GET /api/monitoring/alerts
 */
router.get('/alerts', auth, asyncHandler(async (req: Request, res: Response) => {
  const requestingUser = req.user as any;

  // Only admin users can view alerts
  if (requestingUser.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Admin access required'
    });
  }

  const { status = 'all', limit = 50 } = req.query;

  try {
    const dashboardData = await performanceMonitoringService.getDashboardData('24h');
    let alerts = [];

    switch (status) {
      case 'active':
        alerts = dashboardData.alerts.active;
        break;
      case 'resolved':
        alerts = dashboardData.alerts.resolved;
        break;
      case 'recent':
        alerts = dashboardData.alerts.recent.slice(0, Number(limit));
        break;
      default:
        alerts = [
          ...dashboardData.alerts.active,
          ...dashboardData.alerts.recent.slice(0, Number(limit) - dashboardData.alerts.active.length)
        ];
    }

    res.json({
      success: true,
      data: {
        alerts,
        summary: dashboardData.alerts.summary,
        total: alerts.length,
        retrievedAt: new Date()
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get alerts'
    });
  }
}));

/**
 * Create custom alert
 * POST /api/monitoring/alerts
 */
router.post('/alerts', auth, asyncHandler(async (req: Request, res: Response) => {
  const requestingUser = req.user as any;

  // Only admin users can create alerts
  if (requestingUser.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Admin access required'
    });
  }

  const { category, severity, title, message, actions = [] } = req.body;

  if (!category || !severity || !title || !message) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: category, severity, title, message'
    });
  }

  const validCategories = ['memory', 'cpu', 'cache', 'latency', 'errors', 'custom'];
  const validSeverities = ['info', 'warning', 'critical'];

  if (!validCategories.includes(category)) {
    return res.status(400).json({
      success: false,
      error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
    });
  }

  if (!validSeverities.includes(severity)) {
    return res.status(400).json({
      success: false,
      error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}`
    });
  }

  try {
    const alertId = performanceMonitoringService.createCustomAlert(
      category,
      severity,
      title,
      message,
      actions
    );

    logger.info('Custom alert created via API', {
      alertId,
      category,
      severity,
      title,
      createdBy: requestingUser.userId
    });

    res.status(201).json({
      success: true,
      data: {
        alertId,
        message: 'Alert created successfully',
        createdAt: new Date()
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create alert'
    });
  }
}));

/**
 * Acknowledge alert
 * POST /api/monitoring/alerts/:alertId/acknowledge
 */
router.post('/alerts/:alertId/acknowledge', auth, asyncHandler(async (req: Request, res: Response) => {
  const requestingUser = req.user as any;

  // Only admin users can acknowledge alerts
  if (requestingUser.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Admin access required'
    });
  }

  const { alertId } = req.params;

  try {
    const success = performanceMonitoringService.acknowledgeAlert(alertId, requestingUser.userId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found or already acknowledged'
      });
    }

    res.json({
      success: true,
      data: {
        alertId,
        message: 'Alert acknowledged successfully',
        acknowledgedAt: new Date(),
        acknowledgedBy: requestingUser.userId
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to acknowledge alert'
    });
  }
}));

/**
 * Resolve alert
 * POST /api/monitoring/alerts/:alertId/resolve
 */
router.post('/alerts/:alertId/resolve', auth, asyncHandler(async (req: Request, res: Response) => {
  const requestingUser = req.user as any;

  // Only admin users can resolve alerts
  if (requestingUser.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Admin access required'
    });
  }

  const { alertId } = req.params;

  try {
    const success = performanceMonitoringService.resolveAlert(alertId, requestingUser.userId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found or already resolved'
      });
    }

    res.json({
      success: true,
      data: {
        alertId,
        message: 'Alert resolved successfully',
        resolvedAt: new Date(),
        resolvedBy: requestingUser.userId
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resolve alert'
    });
  }
}));

/**
 * Get service statuses
 * GET /api/monitoring/services
 */
router.get('/services', auth, asyncHandler(async (req: Request, res: Response) => {
  const requestingUser = req.user as any;

  // Only admin users can view service status
  if (requestingUser.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Admin access required'
    });
  }

  try {
    const dashboardData = await performanceMonitoringService.getDashboardData('1h');

    res.json({
      success: true,
      data: {
        services: dashboardData.services,
        timestamp: new Date()
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get service status'
    });
  }
}));

/**
 * Update monitoring configuration
 * PUT /api/monitoring/config
 */
router.put('/config', auth, asyncHandler(async (req: Request, res: Response) => {
  const requestingUser = req.user as any;

  // Only admin users can update configuration
  if (requestingUser.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Admin access required'
    });
  }

  try {
    performanceMonitoringService.updateConfiguration(req.body);

    logger.info('Monitoring configuration updated', {
      updatedBy: requestingUser.userId,
      updates: req.body
    });

    res.json({
      success: true,
      data: {
        message: 'Configuration updated successfully',
        updatedAt: new Date(),
        updatedBy: requestingUser.userId
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update configuration'
    });
  }
}));

/**
 * Get monitoring configuration
 * GET /api/monitoring/config
 */
router.get('/config', auth, asyncHandler(async (req: Request, res: Response) => {
  const requestingUser = req.user as any;

  // Only admin users can view configuration
  if (requestingUser.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Admin access required'
    });
  }

  try {
    const config = performanceMonitoringService.getConfiguration();

    res.json({
      success: true,
      data: {
        config,
        retrievedAt: new Date()
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get configuration'
    });
  }
}));

/**
 * Health check for monitoring service
 * GET /api/monitoring/health
 */
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  try {
    const config = performanceMonitoringService.getConfiguration();
    const dashboardData = await performanceMonitoringService.getDashboardData('1h');
    
    const healthStatus = {
      status: 'healthy',
      service: 'performance-monitoring',
      monitoring: {
        enabled: config.enabled,
        collectionInterval: config.collectionInterval,
        alertingEnabled: config.alerting.enabled,
        activeAlerts: dashboardData.alerts.active.length
      },
      systemResources: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        cpuUsage: process.cpuUsage()
      },
      timestamp: new Date()
    };

    res.json({
      success: true,
      data: healthStatus
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Health check failed'
    });
  }
}));

export default router;