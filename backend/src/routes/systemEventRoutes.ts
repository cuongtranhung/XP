/**
 * System Event Routes
 * REST API endpoints for system monitoring: user activity, health alerts, security alerts, performance metrics
 */

import { Router, Request, Response } from 'express';
import { param, body, query } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { systemEventService } from '../services/systemEventService';
import { logger } from '../utils/logger';
import { validationResult } from 'express-validator';

const router = Router();

// Validation schemas
const activitySubscriptionValidation = [
  body('filters')
    .optional()
    .isObject()
    .withMessage('Filters must be an object'),
  
  body('filters.activityTypes')
    .optional()
    .isArray()
    .withMessage('Activity types must be an array'),
  
  body('filters.activityTypes.*')
    .optional()
    .isIn(['login', 'logout', 'form_created', 'form_published', 'submission_created', 'comment_added', 'file_uploaded', 'permission_changed'])
    .withMessage('Invalid activity type'),
  
  body('filters.severities')
    .optional()
    .isArray()
    .withMessage('Severities must be an array'),
  
  body('filters.severities.*')
    .optional()
    .isIn(['info', 'warning', 'error', 'critical'])
    .withMessage('Invalid severity level')
];

const userActivityValidation = [
  body('activityType')
    .isIn(['login', 'logout', 'form_created', 'form_published', 'submission_created', 'comment_added', 'file_uploaded', 'permission_changed'])
    .withMessage('Invalid activity type'),
  
  body('userId')
    .isString()
    .withMessage('User ID is required'),
  
  body('userEmail')
    .isEmail()
    .withMessage('Valid email is required'),
  
  body('entityType')
    .optional()
    .isIn(['form', 'submission', 'comment', 'user', 'system'])
    .withMessage('Invalid entity type'),
  
  body('entityId')
    .optional()
    .isUUID()
    .withMessage('Entity ID must be a valid UUID'),
  
  body('severity')
    .isIn(['info', 'warning', 'error', 'critical'])
    .withMessage('Invalid severity level'),
  
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
];

const healthAlertValidation = [
  body('alertType')
    .isIn(['cpu_usage', 'memory_usage', 'disk_usage', 'database_connection', 'redis_connection', 'service_down', 'response_time'])
    .withMessage('Invalid alert type'),
  
  body('severity')
    .isIn(['info', 'warning', 'error', 'critical'])
    .withMessage('Invalid severity level'),
  
  body('title')
    .isString()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title is required and must be 1-200 characters'),
  
  body('message')
    .isString()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message is required and must be 1-1000 characters'),
  
  body('metrics')
    .isObject()
    .withMessage('Metrics object is required'),
  
  body('metrics.currentValue')
    .isNumeric()
    .withMessage('Current value must be a number'),
  
  body('metrics.threshold')
    .isNumeric()
    .withMessage('Threshold must be a number'),
  
  body('metrics.unit')
    .isString()
    .withMessage('Unit is required')
];

const securityAlertValidation = [
  body('alertType')
    .isIn(['failed_login', 'suspicious_activity', 'unauthorized_access', 'data_breach', 'malware_detected', 'ddos_attack', 'brute_force'])
    .withMessage('Invalid alert type'),
  
  body('severity')
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid severity level'),
  
  body('title')
    .isString()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title is required and must be 1-200 characters'),
  
  body('description')
    .isString()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Description is required and must be 1-1000 characters'),
  
  body('riskScore')
    .isInt({ min: 0, max: 100 })
    .withMessage('Risk score must be between 0 and 100'),
  
  body('sourceIp')
    .optional()
    .isIP()
    .withMessage('Source IP must be valid'),
  
  body('targetUserId')
    .optional()
    .isString()
    .withMessage('Target user ID must be a string')
];

const performanceMetricsValidation = [
  body('metrics')
    .isArray()
    .withMessage('Metrics must be an array'),
  
  body('metrics.*.metricType')
    .isIn(['response_time', 'throughput', 'error_rate', 'active_users', 'database_queries', 'cache_hit_rate', 'memory_usage', 'cpu_usage'])
    .withMessage('Invalid metric type'),
  
  body('metrics.*.service')
    .isIn(['api', 'database', 'redis', 'websocket', 'forms', 'comments', 'auth', 'system'])
    .withMessage('Invalid service'),
  
  body('metrics.*.value')
    .isNumeric()
    .withMessage('Metric value must be a number'),
  
  body('metrics.*.unit')
    .isString()
    .withMessage('Unit is required')
];

// Validation error handler
const handleValidationErrors = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Admin access check middleware
const requireAdmin = (req: Request, res: Response, next: any) => {
  const user = (req as any).user;
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

/**
 * @route   POST /system/activity/subscribe
 * @desc    Subscribe to user activity broadcasts
 * @access  Private
 */
router.post('/system/activity/subscribe',
  authenticate,
  activitySubscriptionValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { filters } = req.body;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      // For REST API, we'll use a placeholder socketId
      const socketId = `rest_activity_${user.id || user.userId}_${Date.now()}`;

      const result = await systemEventService.subscribeToUserActivity({
        userId: user.id || user.userId,
        socketId,
        filters,
        isAdmin: user.email === process.env.ADMIN_EMAIL
      });

      res.json({
        success: true,
        data: {
          subscription: {
            socketId,
            filters: result.subscription.filters,
            isAdmin: result.subscription.isAdmin
          },
          recentActivities: result.recentActivities
        },
        message: 'Successfully subscribed to user activity broadcasts'
      });

      logger.info('User subscribed to activity broadcasts via REST API', {
        userId: user.id || user.userId,
        isAdmin: result.subscription.isAdmin
      });

    } catch (error) {
      logger.error('Failed to subscribe to activity broadcasts', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to subscribe to activity broadcasts',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   POST /system/activity/broadcast
 * @desc    Broadcast user activity (internal use)
 * @access  Private (admin)
 */
router.post('/system/activity/broadcast',
  authenticate,
  requireAdmin,
  userActivityValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const {
        activityType,
        userId,
        userEmail,
        entityType,
        entityId,
        severity,
        metadata
      } = req.body;

      await systemEventService.broadcastUserActivity({
        activityType,
        userId,
        userEmail,
        entityType,
        entityId,
        severity,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          ...metadata
        }
      });

      res.json({
        success: true,
        message: 'User activity broadcasted successfully'
      });

      logger.info('User activity broadcasted via REST API', {
        activityType,
        userId,
        severity
      });

    } catch (error) {
      logger.error('Failed to broadcast user activity', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to broadcast user activity',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   POST /system/health/subscribe
 * @desc    Subscribe to system health alerts
 * @access  Private (admin)
 */
router.post('/system/health/subscribe',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const socketId = `rest_health_${user.id || user.userId}_${Date.now()}`;

      const result = await systemEventService.subscribeToSystemHealth(
        user.id || user.userId,
        socketId
      );

      res.json({
        success: true,
        data: {
          subscription: { socketId },
          activeAlerts: result.activeAlerts,
          systemStatus: result.systemStatus
        },
        message: 'Successfully subscribed to system health alerts'
      });

      logger.info('User subscribed to system health alerts via REST API', {
        userId: user.id || user.userId,
        alertCount: result.activeAlerts.length
      });

    } catch (error) {
      logger.error('Failed to subscribe to system health alerts', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to subscribe to system health alerts',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   POST /system/health/alert
 * @desc    Send system health alert
 * @access  Private (admin)
 */
router.post('/system/health/alert',
  authenticate,
  requireAdmin,
  healthAlertValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const {
        alertType,
        severity,
        title,
        message,
        metrics,
        affectedServices
      } = req.body;

      await systemEventService.sendSystemHealthAlert({
        alertType,
        severity,
        title,
        message,
        metrics,
        affectedServices
      });

      res.json({
        success: true,
        message: 'System health alert sent successfully'
      });

      logger.info('System health alert sent via REST API', {
        alertType,
        severity,
        currentValue: metrics.currentValue
      });

    } catch (error) {
      logger.error('Failed to send system health alert', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to send system health alert',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   POST /system/security/subscribe
 * @desc    Subscribe to security alerts
 * @access  Private (admin)
 */
router.post('/system/security/subscribe',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const socketId = `rest_security_${user.id || user.userId}_${Date.now()}`;

      const result = await systemEventService.subscribeToSecurityAlerts(
        user.id || user.userId,
        socketId
      );

      res.json({
        success: true,
        data: {
          subscription: { socketId },
          activeAlerts: result.activeAlerts,
          riskLevel: result.riskLevel
        },
        message: 'Successfully subscribed to security alerts'
      });

      logger.info('User subscribed to security alerts via REST API', {
        userId: user.id || user.userId,
        alertCount: result.activeAlerts.length
      });

    } catch (error) {
      logger.error('Failed to subscribe to security alerts', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to subscribe to security alerts',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   POST /system/security/alert
 * @desc    Send security alert
 * @access  Private (admin)
 */
router.post('/system/security/alert',
  authenticate,
  requireAdmin,
  securityAlertValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const {
        alertType,
        severity,
        title,
        description,
        riskScore,
        sourceIp,
        targetUserId,
        targetResource,
        attackVector,
        mitigationActions
      } = req.body;

      await systemEventService.sendSecurityAlert({
        alertType,
        severity,
        title,
        description,
        riskScore,
        sourceIp,
        targetUserId,
        targetResource,
        attackVector,
        mitigationActions
      });

      res.json({
        success: true,
        message: 'Security alert sent successfully'
      });

      logger.warn('Security alert sent via REST API', {
        alertType,
        severity,
        riskScore,
        sourceIp
      });

    } catch (error) {
      logger.error('Failed to send security alert', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to send security alert',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   POST /system/performance/subscribe
 * @desc    Subscribe to performance monitoring
 * @access  Private (admin)
 */
router.post('/system/performance/subscribe',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const socketId = `rest_performance_${user.id || user.userId}_${Date.now()}`;

      const result = await systemEventService.subscribeToPerformanceMonitoring(
        user.id || user.userId,
        socketId
      );

      res.json({
        success: true,
        data: {
          subscription: { socketId },
          currentMetrics: result.currentMetrics,
          systemOverview: result.systemOverview
        },
        message: 'Successfully subscribed to performance monitoring'
      });

      logger.info('User subscribed to performance monitoring via REST API', {
        userId: user.id || user.userId,
        metricCount: result.currentMetrics.length
      });

    } catch (error) {
      logger.error('Failed to subscribe to performance monitoring', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to subscribe to performance monitoring',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   POST /system/performance/metrics
 * @desc    Update performance metrics
 * @access  Private (admin)
 */
router.post('/system/performance/metrics',
  authenticate,
  requireAdmin,
  performanceMetricsValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { metrics } = req.body;

      // Add timestamp if not provided
      const metricsWithTimestamp = metrics.map((metric: any) => ({
        ...metric,
        metricId: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: metric.timestamp ? new Date(metric.timestamp) : new Date()
      }));

      await systemEventService.updatePerformanceMetrics(metricsWithTimestamp);

      res.json({
        success: true,
        message: 'Performance metrics updated successfully'
      });

      logger.debug('Performance metrics updated via REST API', {
        metricCount: metrics.length
      });

    } catch (error) {
      logger.error('Failed to update performance metrics', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to update performance metrics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   POST /system/alerts/:alertId/resolve
 * @desc    Resolve an alert
 * @access  Private (admin)
 */
router.post('/system/alerts/:alertId/resolve',
  authenticate,
  requireAdmin,
  [
    param('alertId')
      .isString()
      .withMessage('Alert ID is required')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { alertId } = req.params;

      const resolved = await systemEventService.resolveAlert(alertId);

      if (!resolved) {
        return res.status(404).json({
          success: false,
          message: 'Alert not found'
        });
      }

      res.json({
        success: true,
        message: 'Alert resolved successfully'
      });

      logger.info('Alert resolved via REST API', { alertId });

    } catch (error) {
      logger.error('Failed to resolve alert', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to resolve alert',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   GET /system/activity
 * @desc    Get filtered user activities
 * @access  Private
 */
router.get('/system/activity',
  authenticate,
  [
    query('activityTypes')
      .optional()
      .isString()
      .withMessage('Activity types must be a comma-separated string'),
    
    query('severities')
      .optional()
      .isString()
      .withMessage('Severities must be a comma-separated string'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const isAdmin = user.email === process.env.ADMIN_EMAIL;
      
      const filters: any = {};
      
      if (req.query.activityTypes) {
        filters.activityTypes = (req.query.activityTypes as string).split(',');
      }
      
      if (req.query.severities) {
        filters.severities = (req.query.severities as string).split(',');
      }

      const limit = parseInt(req.query.limit as string) || (isAdmin ? 50 : 20);
      const activities = systemEventService.getFilteredActivities(filters, limit);

      res.json({
        success: true,
        data: {
          activities,
          totalCount: activities.length,
          filters,
          isAdmin
        },
        message: 'User activities retrieved successfully'
      });

    } catch (error) {
      logger.error('Failed to get user activities', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get user activities',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   GET /system/stats
 * @desc    Get system event service statistics
 * @access  Private (admin)
 */
router.get('/system/stats',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const stats = systemEventService.getStats();

      res.json({
        success: true,
        data: {
          stats,
          timestamp: new Date().toISOString()
        },
        message: 'System event statistics retrieved successfully'
      });

    } catch (error) {
      logger.error('Failed to get system event stats', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get system event stats',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;