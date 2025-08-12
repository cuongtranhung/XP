/**
 * GPS Module Routes
 * 
 * Modular routing system with admin controls for enabling/disabling GPS functionality.
 * All location endpoints are wrapped with module status checks.
 */

import { Router } from 'express';
import { body, query } from 'express-validator';
import { GPSModuleController } from '../controllers/gpsModuleController';
import authMiddleware from '../../../middleware/auth';
import rateLimiter from '../../../middleware/rateLimiter';

const router = Router();

// Location validation (same as original)
const locationValidation = [
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Valid latitude required'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Valid longitude required'),
  body('accuracy')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Accuracy must be positive'),
  body('altitude')
    .optional()
    .isFloat()
    .withMessage('Altitude must be a number'),
  body('altitudeAccuracy')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Altitude accuracy must be positive'),
  body('heading')
    .optional()
    .isFloat({ min: 0, max: 360 })
    .withMessage('Heading must be between 0 and 360'),
  body('speed')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Speed must be positive'),
  body('batteryLevel')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Battery level must be between 0 and 100'),
  body('isBackground')
    .optional()
    .isBoolean()
    .withMessage('isBackground must be boolean'),
  body('deviceId')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Device ID too long'),
  body('networkType')
    .optional()
    .isIn(['wifi', 'cellular', '4g', '5g', 'ethernet', 'unknown'])
    .withMessage('Invalid network type')
];

const preferencesValidation = [
  body('trackingEnabled')
    .optional()
    .isBoolean()
    .withMessage('trackingEnabled must be boolean'),
  body('trackingInterval')
    .optional()
    .isInt({ min: 10, max: 3600 })
    .withMessage('Tracking interval must be between 10 and 3600 seconds'),
  body('backgroundTrackingEnabled')
    .optional()
    .isBoolean()
    .withMessage('backgroundTrackingEnabled must be boolean'),
  body('highAccuracyMode')
    .optional()
    .isBoolean()
    .withMessage('highAccuracyMode must be boolean'),
  body('maxTrackingDuration')
    .optional()
    .isInt({ min: 300, max: 86400 })
    .withMessage('Max tracking duration must be between 5 minutes and 24 hours')
];

// Rate limiters
const locationRateLimit = rateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  message: 'Too many location updates, please try again later'
});

const generalRateLimit = rateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60,
  message: 'Too many requests, please try again later'
});

const sessionRateLimit = rateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many session requests, please try again later'
});

const adminRateLimit = rateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20,
  message: 'Too many admin requests, please try again later'
});

// Apply authentication to all routes
router.use(authMiddleware);

// ===== ADMIN ROUTES (Module Management) =====

/**
 * GET /api/gps-module/admin/status
 * Get GPS module status and configuration (admin only)
 */
router.get('/admin/status', adminRateLimit, GPSModuleController.getModuleStatus);

/**
 * POST /api/gps-module/admin/enable
 * Enable GPS module (admin only)
 */
router.post(
  '/admin/enable',
  adminRateLimit,
  [
    body('reason')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Reason must be a string with max 500 characters')
  ],
  GPSModuleController.enableModule
);

/**
 * POST /api/gps-module/admin/disable
 * Disable GPS module (admin only)
 */
router.post(
  '/admin/disable',
  adminRateLimit,
  [
    body('reason')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Reason must be a string with max 500 characters')
  ],
  GPSModuleController.disableModule
);

/**
 * PUT /api/gps-module/admin/config
 * Update GPS module configuration (admin only)
 */
router.put(
  '/admin/config',
  adminRateLimit,
  [
    body('features')
      .optional()
      .isObject()
      .withMessage('Features must be an object'),
    body('performance')
      .optional()
      .isObject()
      .withMessage('Performance settings must be an object'),
    body('security')
      .optional()
      .isObject()
      .withMessage('Security settings must be an object'),
    body('monitoring')
      .optional()
      .isObject()
      .withMessage('Monitoring settings must be an object')
  ],
  GPSModuleController.updateModuleConfig
);

// ===== USER ROUTES (Location Tracking) =====
// All routes below are protected by module status check middleware

/**
 * POST /api/gps-module/location/record
 * Record GPS location (requires module to be enabled)
 */
router.post(
  '/location/record',
  GPSModuleController.checkModuleEnabled, // Check module status first
  locationRateLimit,
  locationValidation,
  GPSModuleController.recordLocation
);

/**
 * GET /api/gps-module/location/preferences
 * Get user location preferences
 */
router.get(
  '/location/preferences',
  GPSModuleController.checkModuleEnabled,
  generalRateLimit,
  GPSModuleController.getPreferences
);

/**
 * PUT /api/gps-module/location/preferences
 * Update user location preferences
 */
router.put(
  '/location/preferences',
  GPSModuleController.checkModuleEnabled,
  generalRateLimit,
  preferencesValidation,
  GPSModuleController.updatePreferences
);

/**
 * GET /api/gps-module/location/history
 * Get location history
 */
router.get(
  '/location/history',
  GPSModuleController.checkModuleEnabled,
  generalRateLimit,
  [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid start date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid end date'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Limit must be between 1 and 1000'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be positive')
  ],
  GPSModuleController.getLocationHistory
);

/**
 * POST /api/gps-module/location/session/start
 * Start tracking session
 */
router.post(
  '/location/session/start',
  GPSModuleController.checkModuleEnabled,
  sessionRateLimit,
  [
    body('deviceInfo')
      .optional()
      .isObject()
      .withMessage('Device info must be object')
  ],
  GPSModuleController.startSession
);

/**
 * POST /api/gps-module/location/session/:sessionId/end
 * End tracking session
 */
router.post(
  '/location/session/:sessionId/end',
  GPSModuleController.checkModuleEnabled,
  sessionRateLimit,
  GPSModuleController.endSession
);

/**
 * GET /api/gps-module/location/current
 * Get current location
 */
router.get(
  '/location/current',
  GPSModuleController.checkModuleEnabled,
  generalRateLimit,
  GPSModuleController.getCurrentLocation
);

export default router;