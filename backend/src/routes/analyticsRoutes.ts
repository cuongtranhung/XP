import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { authorize } from '../middleware/authorization';
import { AnalyticsAggregationService } from '../services/analyticsAggregationService';
import { CustomMetricsService } from '../services/customMetricsService';
import RealTimeAnalyticsService from '../services/realTimeAnalyticsService';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types/common';

const router = Router();

/**
 * Analytics API Routes
 * 
 * Provides REST API endpoints for analytics dashboard, metrics management,
 * and real-time analytics data access.
 * 
 * Features:
 * - Dashboard analytics overview
 * - Custom metrics CRUD operations
 * - Real-time metrics and events
 * - System health monitoring
 * - Alert management
 * - Analytics reports and exports
 */

// Services (would be injected in production)
let analyticsService: AnalyticsAggregationService;
let customMetricsService: CustomMetricsService;
let realTimeService: RealTimeAnalyticsService;

// Initialize services
export const initializeAnalyticsRoutes = (
  analyticsAggService: AnalyticsAggregationService,
  customMetricsServ: CustomMetricsService,
  realTimeServ: RealTimeAnalyticsService
) => {
  analyticsService = analyticsAggService;
  customMetricsService = customMetricsServ;
  realTimeService = realTimeServ;
};

/**
 * Get dashboard overview analytics
 */
router.get('/dashboard/overview', 
  authenticateToken, 
  authorize(['admin', 'user']), 
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const overview = await analyticsService.getDashboardOverview();
      
      res.json({
        success: true,
        data: overview
      });

    } catch (error) {
      logger.error('Get dashboard overview error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard overview'
      });
    }
  }
);

/**
 * Get detailed analytics for specific date range
 */
router.get('/dashboard/detailed',
  authenticateToken,
  authorize(['admin', 'user']),
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('granularity').optional().isIn(['hourly', 'daily', 'weekly', 'monthly']),
    query('metrics').optional().isArray(),
    query('filters').optional().isJSON()
  ],
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const {
        startDate,
        endDate,
        granularity = 'daily',
        metrics,
        filters
      } = req.query;

      const dateRange = {
        startDate: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        endDate: endDate ? new Date(endDate as string) : new Date()
      };

      const parsedFilters = filters ? JSON.parse(filters as string) : {};
      const requestedMetrics = Array.isArray(metrics) ? metrics as string[] : [];

      const analytics = await analyticsService.getDetailedAnalytics({
        dateRange,
        granularity: granularity as 'hourly' | 'daily' | 'weekly' | 'monthly',
        metrics: requestedMetrics,
        filters: parsedFilters
      });

      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      logger.error('Get detailed analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch detailed analytics'
      });
    }
  }
);

/**
 * Get user analytics
 */
router.get('/users',
  authenticateToken,
  authorize(['admin']),
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('segment').optional().isIn(['new', 'returning', 'active', 'churned', 'all']),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    query('offset').optional().isInt({ min: 0 })
  ],
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const {
        startDate,
        endDate,
        segment = 'all',
        limit = 100,
        offset = 0
      } = req.query;

      const dateRange = startDate && endDate ? {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      } : undefined;

      const userAnalytics = await analyticsService.getUserAnalytics({
        dateRange,
        segment: segment as 'new' | 'returning' | 'active' | 'churned' | 'all',
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });

      res.json({
        success: true,
        data: userAnalytics
      });

    } catch (error) {
      logger.error('Get user analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user analytics'
      });
    }
  }
);

/**
 * Get performance analytics
 */
router.get('/performance',
  authenticateToken,
  authorize(['admin', 'user']),
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('type').optional().isIn(['api', 'database', 'cache', 'external', 'all'])
  ],
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const {
        startDate,
        endDate,
        type = 'all'
      } = req.query;

      const dateRange = startDate && endDate ? {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      } : undefined;

      const performanceData = await analyticsService.getPerformanceAnalytics({
        dateRange,
        type: type as 'api' | 'database' | 'cache' | 'external' | 'all'
      });

      res.json({
        success: true,
        data: performanceData
      });

    } catch (error) {
      logger.error('Get performance analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch performance analytics'
      });
    }
  }
);

/**
 * Custom Metrics Management
 */

/**
 * Get all custom metrics
 */
router.get('/metrics',
  authenticateToken,
  authorize(['admin', 'user']),
  [
    query('category').optional().isString(),
    query('active').optional().isBoolean(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 })
  ],
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const {
        category,
        active,
        limit = 50,
        offset = 0
      } = req.query;

      const filters = {
        category: category as string,
        isActive: active !== undefined ? active === 'true' : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      };

      const metrics = await customMetricsService.getMetrics(filters);

      res.json({
        success: true,
        data: metrics
      });

    } catch (error) {
      logger.error('Get custom metrics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch custom metrics'
      });
    }
  }
);

/**
 * Get specific custom metric
 */
router.get('/metrics/:metricId',
  authenticateToken,
  authorize(['admin', 'user']),
  [
    param('metricId').isString().notEmpty()
  ],
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { metricId } = req.params;

      const metric = await customMetricsService.getMetric(metricId);

      if (!metric) {
        return res.status(404).json({
          success: false,
          error: 'Metric not found'
        });
      }

      res.json({
        success: true,
        data: metric
      });

    } catch (error) {
      logger.error('Get custom metric error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch custom metric'
      });
    }
  }
);

/**
 * Create new custom metric
 */
router.post('/metrics',
  authenticateToken,
  authorize(['admin']),
  [
    body('name').isString().notEmpty().isLength({ min: 1, max: 255 }),
    body('description').optional().isString().isLength({ max: 1000 }),
    body('category').isString().notEmpty(),
    body('type').isIn(['counter', 'gauge', 'histogram', 'summary']),
    body('unit').optional().isString().isLength({ max: 50 }),
    body('dataSource').isObject(),
    body('displayConfig').optional().isObject(),
    body('tags').optional().isArray(),
    body('isActive').optional().isBoolean()
  ],
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const metricData = {
        ...req.body,
        createdBy: (req as any).user.userId
      };

      const metric = await customMetricsService.createMetric(metricData);

      res.status(201).json({
        success: true,
        data: metric
      });

    } catch (error) {
      logger.error('Create custom metric error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create custom metric'
      });
    }
  }
);

/**
 * Update custom metric
 */
router.put('/metrics/:metricId',
  authenticateToken,
  authorize(['admin']),
  [
    param('metricId').isString().notEmpty(),
    body('name').optional().isString().notEmpty().isLength({ min: 1, max: 255 }),
    body('description').optional().isString().isLength({ max: 1000 }),
    body('category').optional().isString().notEmpty(),
    body('type').optional().isIn(['counter', 'gauge', 'histogram', 'summary']),
    body('unit').optional().isString().isLength({ max: 50 }),
    body('dataSource').optional().isObject(),
    body('displayConfig').optional().isObject(),
    body('tags').optional().isArray(),
    body('isActive').optional().isBoolean()
  ],
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { metricId } = req.params;
      const updates = req.body;

      const metric = await customMetricsService.updateMetric(metricId, updates);

      if (!metric) {
        return res.status(404).json({
          success: false,
          error: 'Metric not found'
        });
      }

      res.json({
        success: true,
        data: metric
      });

    } catch (error) {
      logger.error('Update custom metric error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update custom metric'
      });
    }
  }
);

/**
 * Delete custom metric
 */
router.delete('/metrics/:metricId',
  authenticateToken,
  authorize(['admin']),
  [
    param('metricId').isString().notEmpty()
  ],
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { metricId } = req.params;

      await customMetricsService.deleteMetric(metricId);

      res.json({
        success: true,
        message: 'Metric deleted successfully'
      });

    } catch (error) {
      logger.error('Delete custom metric error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete custom metric'
      });
    }
  }
);

/**
 * Get metric values/history
 */
router.get('/metrics/:metricId/values',
  authenticateToken,
  authorize(['admin', 'user']),
  [
    param('metricId').isString().notEmpty(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('granularity').optional().isIn(['raw', 'hourly', 'daily', 'weekly', 'monthly']),
    query('aggregation').optional().isIn(['avg', 'sum', 'min', 'max', 'count'])
  ],
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { metricId } = req.params;
      const {
        startDate,
        endDate,
        granularity = 'daily',
        aggregation = 'avg'
      } = req.query;

      const dateRange = startDate && endDate ? {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      } : {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        endDate: new Date()
      };

      const values = await customMetricsService.getMetricValues(metricId, {
        dateRange,
        granularity: granularity as 'raw' | 'hourly' | 'daily' | 'weekly' | 'monthly',
        aggregation: aggregation as 'avg' | 'sum' | 'min' | 'max' | 'count'
      });

      res.json({
        success: true,
        data: values
      });

    } catch (error) {
      logger.error('Get metric values error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch metric values'
      });
    }
  }
);

/**
 * Manually trigger metric calculation
 */
router.post('/metrics/:metricId/calculate',
  authenticateToken,
  authorize(['admin']),
  [
    param('metricId').isString().notEmpty()
  ],
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { metricId } = req.params;

      const value = await customMetricsService.calculateMetricValue(metricId);

      res.json({
        success: true,
        data: {
          metricId,
          value,
          calculatedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Calculate metric error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate metric'
      });
    }
  }
);

/**
 * Real-time Analytics Endpoints
 */

/**
 * Get real-time metrics
 */
router.get('/realtime/metrics',
  authenticateToken,
  authorize(['admin', 'user']),
  [
    query('metricIds').optional().isArray()
  ],
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { metricIds } = req.query;
      const requestedMetrics = Array.isArray(metricIds) ? metricIds as string[] : [];

      const metrics = await realTimeService.getRealTimeMetrics(requestedMetrics);

      res.json({
        success: true,
        data: metrics
      });

    } catch (error) {
      logger.error('Get real-time metrics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch real-time metrics'
      });
    }
  }
);

/**
 * Get live events
 */
router.get('/realtime/events',
  authenticateToken,
  authorize(['admin', 'user']),
  [
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('type').optional().isString()
  ],
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { limit = 50, type } = req.query;

      const events = await realTimeService.getLiveEvents(parseInt(limit as string));

      // Filter by type if specified
      const filteredEvents = type ? 
        events.filter(event => event.type === type) : 
        events;

      res.json({
        success: true,
        data: filteredEvents
      });

    } catch (error) {
      logger.error('Get live events error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch live events'
      });
    }
  }
);

/**
 * Get active sessions
 */
router.get('/realtime/sessions',
  authenticateToken,
  authorize(['admin', 'user']),
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const sessions = await realTimeService.getActiveSessions();

      res.json({
        success: true,
        data: sessions
      });

    } catch (error) {
      logger.error('Get active sessions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch active sessions'
      });
    }
  }
);

/**
 * Get system health
 */
router.get('/realtime/health',
  authenticateToken,
  authorize(['admin', 'user']),
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const health = await realTimeService.getSystemHealth();

      res.json({
        success: true,
        data: health
      });

    } catch (error) {
      logger.error('Get system health error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch system health'
      });
    }
  }
);

/**
 * Dashboards Management
 */

/**
 * Get all dashboards
 */
router.get('/dashboards',
  authenticateToken,
  authorize(['admin', 'user']),
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const dashboards = await customMetricsService.getDashboards();

      res.json({
        success: true,
        data: dashboards
      });

    } catch (error) {
      logger.error('Get dashboards error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboards'
      });
    }
  }
);

/**
 * Get specific dashboard
 */
router.get('/dashboards/:dashboardId',
  authenticateToken,
  authorize(['admin', 'user']),
  [
    param('dashboardId').isString().notEmpty()
  ],
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { dashboardId } = req.params;

      const dashboard = await customMetricsService.getDashboard(dashboardId);

      if (!dashboard) {
        return res.status(404).json({
          success: false,
          error: 'Dashboard not found'
        });
      }

      res.json({
        success: true,
        data: dashboard
      });

    } catch (error) {
      logger.error('Get dashboard error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard'
      });
    }
  }
);

/**
 * Create new dashboard
 */
router.post('/dashboards',
  authenticateToken,
  authorize(['admin']),
  [
    body('name').isString().notEmpty().isLength({ min: 1, max: 255 }),
    body('description').optional().isString().isLength({ max: 1000 }),
    body('layout').isObject(),
    body('widgets').isArray(),
    body('isPublic').optional().isBoolean(),
    body('tags').optional().isArray()
  ],
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const dashboardData = {
        ...req.body,
        createdBy: (req as any).user.userId
      };

      const dashboard = await customMetricsService.createDashboard(dashboardData);

      res.status(201).json({
        success: true,
        data: dashboard
      });

    } catch (error) {
      logger.error('Create dashboard error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create dashboard'
      });
    }
  }
);

/**
 * Update dashboard
 */
router.put('/dashboards/:dashboardId',
  authenticateToken,
  authorize(['admin']),
  [
    param('dashboardId').isString().notEmpty(),
    body('name').optional().isString().notEmpty().isLength({ min: 1, max: 255 }),
    body('description').optional().isString().isLength({ max: 1000 }),
    body('layout').optional().isObject(),
    body('widgets').optional().isArray(),
    body('isPublic').optional().isBoolean(),
    body('tags').optional().isArray()
  ],
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { dashboardId } = req.params;
      const updates = req.body;

      const dashboard = await customMetricsService.updateDashboard(dashboardId, updates);

      if (!dashboard) {
        return res.status(404).json({
          success: false,
          error: 'Dashboard not found'
        });
      }

      res.json({
        success: true,
        data: dashboard
      });

    } catch (error) {
      logger.error('Update dashboard error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update dashboard'
      });
    }
  }
);

/**
 * Delete dashboard
 */
router.delete('/dashboards/:dashboardId',
  authenticateToken,
  authorize(['admin']),
  [
    param('dashboardId').isString().notEmpty()
  ],
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { dashboardId } = req.params;

      await customMetricsService.deleteDashboard(dashboardId);

      res.json({
        success: true,
        message: 'Dashboard deleted successfully'
      });

    } catch (error) {
      logger.error('Delete dashboard error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete dashboard'
      });
    }
  }
);

/**
 * Export analytics data
 */
router.post('/export',
  authenticateToken,
  authorize(['admin']),
  [
    body('type').isIn(['dashboard', 'metrics', 'events', 'users']),
    body('format').isIn(['json', 'csv', 'xlsx']),
    body('dateRange').optional().isObject(),
    body('filters').optional().isObject(),
    body('includeMetadata').optional().isBoolean()
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const {
        type,
        format,
        dateRange,
        filters,
        includeMetadata = false
      } = req.body;

      // Generate export data based on type
      let exportData;
      let filename;

      switch (type) {
        case 'dashboard':
          exportData = await analyticsService.getDashboardOverview();
          filename = `dashboard-export-${Date.now()}.${format}`;
          break;
        case 'metrics':
          exportData = await customMetricsService.getMetrics();
          filename = `metrics-export-${Date.now()}.${format}`;
          break;
        case 'events':
          exportData = await realTimeService.getLiveEvents(1000);
          filename = `events-export-${Date.now()}.${format}`;
          break;
        default:
          return res.status(400).json({
            success: false,
            error: 'Unsupported export type'
          });
      }

      // Set appropriate headers for download
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      switch (format) {
        case 'json':
          res.setHeader('Content-Type', 'application/json');
          res.json(exportData);
          break;
        case 'csv':
          res.setHeader('Content-Type', 'text/csv');
          // Convert to CSV format (simplified)
          const csv = JSON.stringify(exportData); // Would use proper CSV library
          res.send(csv);
          break;
        default:
          res.status(400).json({
            success: false,
            error: 'Unsupported export format'
          });
      }

    } catch (error) {
      logger.error('Export analytics data error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export analytics data'
      });
    }
  }
);

export default router;