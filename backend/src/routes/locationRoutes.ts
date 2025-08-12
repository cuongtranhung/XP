import { Router } from 'express';
import { body, query } from 'express-validator';
import { LocationController } from '../controllers/locationController';
import authMiddleware from '../middleware/auth';
import rateLimiter from '../middleware/rateLimiter';
import { cachingStrategies, invalidationStrategies } from '../middleware/cacheMiddleware';

const router = Router();

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

const locationRateLimit = rateLimiter({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: 'Too many location updates, please try again later'
});

const generalRateLimit = rateLimiter({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: 'Too many requests, please try again later'
});

const sessionRateLimit = rateLimiter({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: 'Too many session requests, please try again later'
});

router.use(authMiddleware);

router.post(
  '/record',
  locationRateLimit,
  locationValidation,
  LocationController.recordLocation
);

router.get('/preferences', generalRateLimit, cachingStrategies.locations, LocationController.getPreferences);

router.put(
  '/preferences',
  generalRateLimit,
  preferencesValidation,
  invalidationStrategies.locationUpdate,
  LocationController.updatePreferences
);

router.get(
  '/history',
  generalRateLimit,
  cachingStrategies.locations,
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
  LocationController.getLocationHistory
);

router.post(
  '/session/start',
  sessionRateLimit,
  [
    body('deviceInfo')
      .optional()
      .isObject()
      .withMessage('Device info must be object')
  ],
  LocationController.startSession
);

router.post(
  '/session/:sessionId/end',
  sessionRateLimit,
  LocationController.endSession
);

router.get('/current', generalRateLimit, cachingStrategies.locations, LocationController.getCurrentLocation);

export default router;