/**
 * Simple Notification Routes for Testing
 * Basic implementation to test API availability
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @route   GET /api/notifications
 * @desc    Get user notifications (simple mock)
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      
      // Mock notification data
      const mockNotifications = [
        {
          id: 'notif_1',
          userId,
          type: 'system',
          title: 'Welcome to XP!',
          message: 'Your account has been created successfully.',
          priority: 'medium',
          channels: ['in-app'],
          read: false,
          timestamp: new Date().toISOString(),
          metadata: {}
        },
        {
          id: 'notif_2',
          userId,
          type: 'transactional',
          title: 'Profile Updated',
          message: 'Your profile information has been updated.',
          priority: 'low',
          channels: ['email', 'in-app'],
          read: true,
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          metadata: {}
        }
      ];

      logger.info('Retrieved mock notifications', { userId, count: mockNotifications.length });
      
      res.json({
        success: true,
        notifications: mockNotifications
      });
      
    } catch (error) {
      logger.error('Failed to get notifications', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get notifications',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   GET /api/notifications/preferences
 * @desc    Get user notification preferences (simple mock)
 * @access  Private
 */
router.get(
  '/preferences',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      
      // Mock preferences data
      const mockPreferences = {
        userId,
        channels: {
          email: true,
          sms: false,
          push: true,
          'in-app': true
        },
        types: {
          system: true,
          marketing: false,
          transactional: true
        },
        frequency: {
          email: 'immediate',
          push: 'immediate'
        },
        quiet_hours: {
          enabled: false,
          start: '22:00',
          end: '08:00'
        },
        language: 'en',
        timezone: 'Asia/Ho_Chi_Minh'
      };

      logger.info('Retrieved mock notification preferences', { userId });
      
      res.json({
        success: true,
        preferences: mockPreferences
      });
      
    } catch (error) {
      logger.error('Failed to get preferences', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get preferences',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   PUT /api/notifications/preferences
 * @desc    Update user notification preferences (simple mock)
 * @access  Private
 */
router.put(
  '/preferences',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const preferences = req.body;
      
      logger.info('Updated mock notification preferences', { userId, preferences });
      
      res.json({
        success: true,
        message: 'Preferences updated',
        preferences: {
          ...preferences,
          userId,
          updatedAt: new Date().toISOString()
        }
      });
      
    } catch (error) {
      logger.error('Failed to update preferences', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to update preferences',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   POST /api/notifications/test
 * @desc    Send test notification (simple mock)
 * @access  Private
 */
router.post(
  '/test',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { channel } = req.body;
      
      logger.info('Sent test notification', { userId, channel });
      
      res.json({
        success: true,
        message: `Test ${channel} notification sent successfully`,
        notification: {
          id: `test_${Date.now()}`,
          userId,
          type: 'system',
          title: 'Test Notification',
          message: `This is a test ${channel} notification`,
          priority: 'low',
          channels: [channel],
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      logger.error('Failed to send test notification', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to send test notification',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;