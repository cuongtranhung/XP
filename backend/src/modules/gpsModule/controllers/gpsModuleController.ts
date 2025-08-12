/**
 * GPS Module Controller
 * 
 * Modular controller that wraps LocationController with module status checks.
 * Returns module disabled errors when GPS tracking is turned off.
 */

import { Request, Response } from 'express';
import { LocationController } from '../../../controllers/locationController';
import { gpsModuleConfig } from '../config/gpsModuleConfig';
import { logger } from '../../../utils/logger';

export class GPSModuleController {
  /**
   * Middleware to check if GPS module is enabled
   */
  static async checkModuleEnabled(req: Request, res: Response, next: any): Promise<void> {
    try {
      const isEnabled = await gpsModuleConfig.isEnabled();
      
      if (!isEnabled) {
        const health = await gpsModuleConfig.getHealthStatus();
        
        res.status(503).json({
          success: false,
          message: 'GPS Tracking module is currently disabled',
          code: 'GPS_MODULE_DISABLED',
          moduleStatus: {
            enabled: false,
            healthStatus: health.status,
            issues: health.issues,
            recommendations: health.recommendations
          }
        });
        return;
      }
      
      next();
    } catch (error) {
      logger.error('Failed to check GPS module status', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to verify GPS module status',
        code: 'MODULE_CHECK_ERROR'
      });
    }
  }

  /**
   * Get GPS module status and configuration (admin only)
   */
  static async getModuleStatus(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).userId;
      
      // Check if user is admin
      if (!(await GPSModuleController.isUserAdmin(userId))) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required',
          code: 'ADMIN_REQUIRED'
        });
      }

      const config = await gpsModuleConfig.getConfiguration();
      const health = await gpsModuleConfig.getHealthStatus();
      
      return res.json({
        success: true,
        data: {
          module: {
            enabled: health.enabled,
            healthy: health.healthy,
            status: health.status,
            lastCheck: health.lastCheck,
            errorCount: health.errorCount
          },
          configuration: config,
          health: {
            issues: health.issues,
            recommendations: health.recommendations
          }
        }
      });
      
    } catch (error) {
      logger.error('Failed to get GPS module status', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve GPS module status',
        code: 'STATUS_ERROR'
      });
    }
  }

  /**
   * Enable GPS module (admin only)
   */
  static async enableModule(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).userId;
      const { reason } = req.body;
      
      // Check if user is admin
      if (!(await GPSModuleController.isUserAdmin(userId))) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required',
          code: 'ADMIN_REQUIRED'
        });
      }

      const success = await gpsModuleConfig.enableModule(userId, reason);
      
      if (success) {
        logger.info('GPS module enabled by admin', {
          adminId: userId,
          reason
        });
        
        return res.json({
          success: true,
          message: 'GPS module enabled successfully'
        });
      } else {
        return res.status(500).json({
          success: false,
          message: 'Failed to enable GPS module',
          code: 'ENABLE_ERROR'
        });
      }
      
    } catch (error) {
      logger.error('Failed to enable GPS module', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return res.status(500).json({
        success: false,
        message: 'Failed to enable GPS module',
        code: 'ENABLE_ERROR'
      });
    }
  }

  /**
   * Disable GPS module (admin only)
   */
  static async disableModule(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).userId;
      const { reason } = req.body;
      
      // Check if user is admin
      if (!(await GPSModuleController.isUserAdmin(userId))) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required',
          code: 'ADMIN_REQUIRED'
        });
      }

      const success = await gpsModuleConfig.disableModule(userId, reason);
      
      if (success) {
        logger.info('GPS module disabled by admin', {
          adminId: userId,
          reason
        });
        
        return res.json({
          success: true,
          message: 'GPS module disabled successfully'
        });
      } else {
        return res.status(500).json({
          success: false,
          message: 'Failed to disable GPS module',
          code: 'DISABLE_ERROR'
        });
      }
      
    } catch (error) {
      logger.error('Failed to disable GPS module', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return res.status(500).json({
        success: false,
        message: 'Failed to disable GPS module',
        code: 'DISABLE_ERROR'
      });
    }
  }

  /**
   * Update GPS module configuration (admin only)
   */
  static async updateModuleConfig(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).userId;
      const updates = req.body;
      
      // Check if user is admin
      if (!(await GPSModuleController.isUserAdmin(userId))) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required',
          code: 'ADMIN_REQUIRED'
        });
      }

      const success = await gpsModuleConfig.updateConfiguration(updates, userId);
      
      if (success) {
        logger.info('GPS module configuration updated', {
          adminId: userId,
          updatedFields: Object.keys(updates)
        });
        
        return res.json({
          success: true,
          message: 'GPS module configuration updated successfully'
        });
      } else {
        return res.status(500).json({
          success: false,
          message: 'Failed to update GPS module configuration',
          code: 'UPDATE_ERROR'
        });
      }
      
    } catch (error) {
      logger.error('Failed to update GPS module configuration', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return res.status(500).json({
        success: false,
        message: 'Failed to update GPS module configuration',
        code: 'UPDATE_ERROR'
      });
    }
  }

  /**
   * Check if user is admin
   */
  private static async isUserAdmin(userId: string): Promise<boolean> {
    try {
      const { getClient } = require('../../../utils/database');
      const client = await getClient();
      
      try {
        const result = await client.query(
          'SELECT email FROM users WHERE id = $1',
          [userId]
        );
        
        if (result.rows.length > 0) {
          // Check if user is admin (cuongtranhung@gmail.com)
          return result.rows[0].email === 'cuongtranhung@gmail.com';
        }
        
        return false;
        
      } finally {
        client.release();
      }
      
    } catch (error) {
      logger.error('Failed to check admin status', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  // Delegate all location operations to the original controller
  // These will be wrapped with module check middleware
  static recordLocation = LocationController.recordLocation;
  static getPreferences = LocationController.getPreferences;
  static updatePreferences = LocationController.updatePreferences;
  static getLocationHistory = LocationController.getLocationHistory;
  static startSession = LocationController.startSession;
  static endSession = LocationController.endSession;
  static getCurrentLocation = LocationController.getCurrentLocation;
}