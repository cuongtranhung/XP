import { Request, Response } from 'express';
import { 
  LocationService, 
  LocationTrackingError
} from '../services/locationService';
import { validationResult } from 'express-validator';
import { logger } from '../utils/logger';

// Response helper functions
function createSuccessResponse(data?: any, message?: string) {
  return {
    success: true,
    ...(message && { message }),
    ...(data && { data })
  };
}

function createErrorResponse(error: Error, _context?: string) {
  if (error instanceof LocationTrackingError) {
    return {
      success: false,
      message: error.message,
      code: error.code
    };
  }
  
  // Don't leak internal errors
  return {
    success: false,
    message: 'An internal error occurred',
    code: 'INTERNAL_ERROR'
  };
}

// Request context helper
function getRequestContext(req: Request) {
  return {
    userId: (req as any).userId,
    userSessionId: (req as any).sessionId, // Extract session ID from JWT token - set by auth middleware
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  };
}

export class LocationController {
  static async recordLocation(req: Request, res: Response): Promise<Response> {
    const context = getRequestContext(req);
    const startTime = Date.now();
    
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Location recording validation failed', {
          ...context,
          errors: errors.array()
        });
        
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid input data',
          errors: errors.array() 
        });
      }
      
      const userId = context.userId;
      const sessionId = req.body.sessionId || req.headers['x-tracking-session'];
      
      if (!sessionId) {
        logger.warn('Location recording missing session ID', context);
        
        return res.status(400).json({
          success: false,
          message: 'Tracking session ID required',
          code: 'MISSING_SESSION_ID'
        });
      }
      
      // Record location with user session ID for multi-device support
      await LocationService.recordLocation(
        userId,
        sessionId as string,
        req.body,
        req,
        context.userSessionId // Link location to authentication session
      );
      
      const processingTime = Date.now() - startTime;
      
      logger.info('Location recorded successfully', {
        ...context,
        sessionId,
        processingTimeMs: processingTime
      });
      
      return res.json(createSuccessResponse(null, 'Location recorded successfully'));
      
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Location recording failed', {
        ...context,
        error: error.message,
        processingTimeMs: processingTime
      });
      
      const errorResponse = createErrorResponse(error, 'record-location');
      const statusCode = error instanceof LocationTrackingError ? error.statusCode : 500;
      
      return res.status(statusCode).json(errorResponse);
    }
  }
  
  static async getPreferences(req: Request, res: Response): Promise<Response> {
    const context = getRequestContext(req);
    const startTime = Date.now();
    
    try {
      const preferences = await LocationService.getPreferences(context.userId);
      const processingTime = Date.now() - startTime;
      
      logger.info('Location preferences retrieved', {
        ...context,
        processingTimeMs: processingTime
      });
      
      return res.json(createSuccessResponse(preferences));
      
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Failed to get preferences', {
        ...context,
        error: error.message,
        processingTimeMs: processingTime
      });
      
      const errorResponse = createErrorResponse(error, 'get-preferences');
      const statusCode = error instanceof LocationTrackingError ? error.statusCode : 500;
      
      return res.status(statusCode).json(errorResponse);
    }
  }
  
  static async updatePreferences(req: Request, res: Response): Promise<Response> {
    const context = getRequestContext(req);
    const startTime = Date.now();
    
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Preferences update validation failed', {
          ...context,
          errors: errors.array()
        });
        
        return res.status(400).json({
          success: false,
          message: 'Invalid preferences data',
          errors: errors.array()
        });
      }
      
      const preferences = await LocationService.updatePreferences(
        context.userId,
        req.body
      );
      
      const processingTime = Date.now() - startTime;
      
      logger.info('Location preferences updated', {
        ...context,
        updatedFields: Object.keys(req.body),
        processingTimeMs: processingTime
      });
      
      return res.json(createSuccessResponse(preferences, 'Preferences updated successfully'));
      
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Failed to update preferences', {
        ...context,
        error: error.message,
        processingTimeMs: processingTime
      });
      
      const errorResponse = createErrorResponse(error, 'update-preferences');
      const statusCode = error instanceof LocationTrackingError ? error.statusCode : 500;
      
      return res.status(statusCode).json(errorResponse);
    }
  }
  
  static async getLocationHistory(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).userId;
      const { startDate, endDate, limit = 100, offset = 0 } = req.query;
      
      const options: any = {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      };
      
      if (startDate) {
        options.startDate = new Date(startDate as string);
      }
      
      if (endDate) {
        options.endDate = new Date(endDate as string);
      }
      
      const history = await LocationService.getLocationHistory(userId, options);
      
      return res.json({
        success: true,
        data: history
      });
      
    } catch (error) {
      console.error('Get history error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get location history'
      });
    }
  }
  
  static async startSession(req: Request, res: Response): Promise<Response> {
    try {
      const context = getRequestContext(req);
      const sessionId = await LocationService.startTrackingSession(
        context.userId,
        req.body.deviceInfo,
        context.userSessionId // Link tracking session to authentication session
      );
      
      return res.json({
        success: true,
        data: { sessionId }
      });
      
    } catch (error) {
      console.error('Start session error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to start tracking session'
      });
    }
  }
  
  static async endSession(req: Request, res: Response): Promise<Response> {
    try {
      const sessionId = req.params.sessionId;
      await LocationService.endTrackingSession(sessionId);
      
      return res.json({
        success: true,
        message: 'Tracking session ended'
      });
      
    } catch (error) {
      console.error('End session error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to end tracking session'
      });
    }
  }
  
  static async getCurrentLocation(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).userId;
      const history = await LocationService.getLocationHistory(userId, { limit: 1 });
      
      if (history.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No location data found'
        });
      }
      
      return res.json({
        success: true,
        data: history[0]
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get current location'
      });
    }
  }
}