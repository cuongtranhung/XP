/**
 * Real-time Analytics Routes
 * REST API endpoints for form analytics dashboard
 */

import { Router, Request, Response } from 'express';
import { param, body, query } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { realTimeAnalyticsService } from '../services/realTimeAnalyticsService';
import { logger } from '../utils/logger';
import { validationResult } from 'express-validator';

const router = Router();

// Validation schemas
const formIdValidation = [
  param('formId')
    .isUUID()
    .withMessage('Form ID must be a valid UUID')
];

const subscriptionValidation = [
  body('formIds')
    .isArray()
    .withMessage('Form IDs must be an array'),
  
  body('formIds.*')
    .isUUID()
    .withMessage('Each form ID must be a valid UUID'),
  
  body('refreshInterval')
    .optional()
    .isInt({ min: 5, max: 300 })
    .withMessage('Refresh interval must be between 5 and 300 seconds')
];

const trackViewValidation = [
  ...formIdValidation,
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
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

/**
 * @route   POST /analytics/dashboard/subscribe
 * @desc    Subscribe to real-time analytics dashboard
 * @access  Private
 */
router.post('/analytics/dashboard/subscribe',
  authenticate,
  subscriptionValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { formIds, refreshInterval } = req.body;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      // For REST API, we don't have a socketId, so we'll use a placeholder
      const socketId = `rest_${user.id || user.userId}_${Date.now()}`;

      await realTimeAnalyticsService.subscribeToDashboard({
        userId: user.id || user.userId,
        socketId,
        formIds,
        refreshInterval
      });

      // Get initial analytics data
      const analyticsData = await realTimeAnalyticsService.getFormsAnalytics(formIds);

      res.json({
        success: true,
        data: {
          subscription: {
            socketId,
            formIds,
            refreshInterval: refreshInterval || 30
          },
          analytics: analyticsData
        },
        message: 'Successfully subscribed to analytics dashboard'
      });

      logger.info('User subscribed to analytics dashboard via REST API', {
        userId: user.id || user.userId,
        formIds,
        refreshInterval
      });

    } catch (error) {
      logger.error('Failed to subscribe to analytics dashboard', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to subscribe to analytics dashboard',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   POST /forms/:formId/analytics/track-view
 * @desc    Track form view event
 * @access  Public
 */
router.post('/forms/:formId/analytics/track-view',
  trackViewValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { formId } = req.params;
      const { metadata } = req.body;
      const user = (req as any).user; // May be null for public forms

      await realTimeAnalyticsService.trackFormView(
        formId,
        user?.id || user?.userId,
        {
          userAgent: req.get('User-Agent'),
          deviceType: req.body.deviceType || 'desktop',
          referrer: req.get('Referrer'),
          ...metadata
        }
      );

      res.json({
        success: true,
        message: 'Form view tracked successfully'
      });

      logger.debug('Form view tracked via REST API', {
        formId,
        userId: user?.id || user?.userId,
        userAgent: req.get('User-Agent')
      });

    } catch (error) {
      logger.error('Failed to track form view', { error, formId: req.params.formId });
      res.status(500).json({
        success: false,
        message: 'Failed to track form view',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   GET /forms/:formId/analytics
 * @desc    Get real-time analytics for a form
 * @access  Private
 */
router.get('/forms/:formId/analytics',
  authenticate,
  formIdValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { formId } = req.params;
      const analytics = await realTimeAnalyticsService.getFormAnalytics(formId);

      res.json({
        success: true,
        data: analytics,
        message: 'Form analytics retrieved successfully'
      });

      logger.debug('Form analytics retrieved via REST API', {
        formId,
        userId: (req as any).user?.id || (req as any).user?.userId
      });

    } catch (error) {
      logger.error('Failed to get form analytics', { error, formId: req.params.formId });
      res.status(500).json({
        success: false,
        message: 'Failed to get form analytics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   POST /analytics/forms
 * @desc    Get real-time analytics for multiple forms
 * @access  Private
 */
router.post('/analytics/forms',
  authenticate,
  [
    body('formIds')
      .isArray()
      .withMessage('Form IDs must be an array'),
    
    body('formIds.*')
      .isUUID()
      .withMessage('Each form ID must be a valid UUID')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { formIds } = req.body;
      const analytics = await realTimeAnalyticsService.getFormsAnalytics(formIds);

      res.json({
        success: true,
        data: analytics,
        message: 'Multi-form analytics retrieved successfully'
      });

      logger.debug('Multi-form analytics retrieved via REST API', {
        formCount: formIds.length,
        userId: (req as any).user?.id || (req as any).user?.userId
      });

    } catch (error) {
      logger.error('Failed to get multi-form analytics', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get multi-form analytics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   GET /analytics/global
 * @desc    Get global analytics dashboard
 * @access  Private (admin)
 */
router.get('/analytics/global',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;

      // Basic admin check - can be enhanced with proper role-based access
      if (!user || user.email !== process.env.ADMIN_EMAIL) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const globalAnalytics = await realTimeAnalyticsService.getGlobalAnalytics();
      const serviceStats = realTimeAnalyticsService.getStats();

      res.json({
        success: true,
        data: {
          analytics: globalAnalytics,
          serviceStats,
          timestamp: new Date().toISOString()
        },
        message: 'Global analytics retrieved successfully'
      });

      logger.info('Global analytics retrieved via REST API', {
        userId: user.id || user.userId,
        userEmail: user.email
      });

    } catch (error) {
      logger.error('Failed to get global analytics', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get global analytics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   POST /submissions/:submissionId/analytics/track-start
 * @desc    Track submission start event
 * @access  Public
 */
router.post('/submissions/:submissionId/analytics/track-start',
  [
    param('submissionId')
      .isUUID()
      .withMessage('Submission ID must be a valid UUID'),
    
    body('formId')
      .isUUID()
      .withMessage('Form ID must be a valid UUID')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { submissionId } = req.params;
      const { formId } = req.body;
      const user = (req as any).user; // May be null for public forms

      await realTimeAnalyticsService.trackSubmissionStart(
        formId,
        submissionId,
        user?.id || user?.userId
      );

      res.json({
        success: true,
        message: 'Submission start tracked successfully'
      });

      logger.debug('Submission start tracked via REST API', {
        submissionId,
        formId,
        userId: user?.id || user?.userId
      });

    } catch (error) {
      logger.error('Failed to track submission start', { error, submissionId: req.params.submissionId });
      res.status(500).json({
        success: false,
        message: 'Failed to track submission start',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   POST /submissions/:submissionId/analytics/track-complete
 * @desc    Track submission completion event
 * @access  Public
 */
router.post('/submissions/:submissionId/analytics/track-complete',
  [
    param('submissionId')
      .isUUID()
      .withMessage('Submission ID must be a valid UUID'),
    
    body('formId')
      .isUUID()
      .withMessage('Form ID must be a valid UUID'),
    
    body('completionTime')
      .isInt({ min: 0 })
      .withMessage('Completion time must be a non-negative integer'),
    
    body('fieldCount')
      .isInt({ min: 1 })
      .withMessage('Field count must be a positive integer'),
    
    body('deviceType')
      .optional()
      .isIn(['desktop', 'mobile', 'tablet'])
      .withMessage('Device type must be desktop, mobile, or tablet')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { submissionId } = req.params;
      const { formId, completionTime, fieldCount, deviceType } = req.body;
      const user = (req as any).user; // May be null for public forms

      await realTimeAnalyticsService.trackSubmissionComplete(formId, submissionId, {
        userId: user?.id || user?.userId,
        completionTime,
        fieldCount,
        deviceType
      });

      res.json({
        success: true,
        message: 'Submission completion tracked successfully'
      });

      logger.debug('Submission completion tracked via REST API', {
        submissionId,
        formId,
        completionTime,
        userId: user?.id || user?.userId
      });

    } catch (error) {
      logger.error('Failed to track submission completion', { error, submissionId: req.params.submissionId });
      res.status(500).json({
        success: false,
        message: 'Failed to track submission completion',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   GET /analytics/stats
 * @desc    Get analytics service statistics
 * @access  Private (admin)
 */
router.get('/analytics/stats',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;

      // Basic admin check
      if (!user || user.email !== process.env.ADMIN_EMAIL) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const stats = realTimeAnalyticsService.getStats();

      res.json({
        success: true,
        data: stats,
        message: 'Analytics service statistics retrieved successfully'
      });

    } catch (error) {
      logger.error('Failed to get analytics stats', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get analytics stats',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;