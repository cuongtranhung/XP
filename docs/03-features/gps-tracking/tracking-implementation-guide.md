# 📍 GPS Tracking Implementation Guide for XP Project

## 📋 Overview
This document provides complete implementation instructions for adding GPS location tracking functionality to the XP authentication system. The feature tracks user location every minute, including background tracking when the app is minimized.

---

## 🎯 Implementation Steps

### Step 1: Database Migration
Create file: `backend/migrations/010_create_user_locations_table.sql`

```sql
-- Migration: 010_create_user_locations_table.sql
-- Purpose: Create tables for GPS location tracking system

-- Main table for storing GPS locations
CREATE TABLE user_locations (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(10, 2),
    altitude DECIMAL(10, 2),
    altitude_accuracy DECIMAL(10, 2),
    heading DECIMAL(5, 2),
    speed DECIMAL(10, 2),
    device_id VARCHAR(255),
    ip_address INET,
    network_type VARCHAR(50),
    battery_level INTEGER,
    tracking_session_id VARCHAR(128),
    is_background BOOLEAN DEFAULT FALSE,
    is_moving BOOLEAN DEFAULT FALSE,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- Create indexes for performance
CREATE INDEX idx_user_locations_user_id_recorded_at 
    ON user_locations(user_id, recorded_at DESC);
CREATE INDEX idx_user_locations_user_id_created_at 
    ON user_locations(user_id, created_at DESC);
CREATE INDEX idx_user_locations_tracking_session 
    ON user_locations(tracking_session_id);
CREATE INDEX idx_user_locations_coordinates 
    ON user_locations(latitude, longitude);

-- Table for tracking sessions
CREATE TABLE location_tracking_sessions (
    id VARCHAR(128) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    total_points INTEGER DEFAULT 0,
    device_info JSONB,
    metadata JSONB
);

CREATE INDEX idx_tracking_sessions_user_id ON location_tracking_sessions(user_id);
CREATE INDEX idx_tracking_sessions_active ON location_tracking_sessions(is_active);

-- Table for user location preferences
CREATE TABLE user_location_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    tracking_enabled BOOLEAN DEFAULT FALSE,
    tracking_interval INTEGER DEFAULT 60,
    background_tracking_enabled BOOLEAN DEFAULT FALSE,
    high_accuracy_mode BOOLEAN DEFAULT FALSE,
    max_tracking_duration INTEGER DEFAULT 28800,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Function to cleanup old location data
CREATE OR REPLACE FUNCTION cleanup_old_locations(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_locations 
    WHERE created_at < NOW() - INTERVAL '1 day' * retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    UPDATE location_tracking_sessions 
    SET is_active = FALSE 
    WHERE is_active = TRUE 
    AND started_at < NOW() - INTERVAL '1 day' * retention_days;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- View for latest user locations
CREATE VIEW latest_user_locations AS
SELECT DISTINCT ON (user_id) 
    ul.*,
    u.email,
    u.full_name
FROM user_locations ul
JOIN users u ON ul.user_id = u.id
ORDER BY user_id, recorded_at DESC;
```

### Step 2: Backend Service
Create file: `backend/src/services/locationService.ts`

```typescript
import { getClient } from '../utils/database';
import { v4 as uuidv4 } from 'uuid';
import MinimalActivityLogger from './minimalActivityLogger';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
  deviceId?: string;
  networkType?: string;
  batteryLevel?: number;
  isBackground?: boolean;
  metadata?: any;
}

interface LocationPreferences {
  trackingEnabled: boolean;
  trackingInterval: number;
  backgroundTrackingEnabled: boolean;
  highAccuracyMode: boolean;
  maxTrackingDuration: number;
}

export class LocationService {
  static async recordLocation(
    userId: number, 
    sessionId: string,
    locationData: LocationData,
    req?: any
  ): Promise<void> {
    const client = await getClient();
    
    try {
      const prefsResult = await client.query(
        'SELECT tracking_enabled, background_tracking_enabled FROM user_location_preferences WHERE user_id = $1',
        [userId]
      );
      
      if (prefsResult.rows.length === 0) {
        throw new Error('Location tracking not configured for user');
      }
      
      const prefs = prefsResult.rows[0];
      
      if (locationData.isBackground && !prefs.background_tracking_enabled) {
        throw new Error('Background tracking not enabled for user');
      }
      
      if (!prefs.tracking_enabled) {
        throw new Error('Location tracking disabled for user');
      }
      
      const sessionResult = await client.query(
        'SELECT id FROM location_tracking_sessions WHERE id = $1 AND is_active = true',
        [sessionId]
      );
      
      if (sessionResult.rows.length === 0) {
        await client.query(
          `INSERT INTO location_tracking_sessions 
           (id, user_id, device_info, metadata) 
           VALUES ($1, $2, $3, $4)`,
          [
            sessionId,
            userId,
            { deviceId: locationData.deviceId },
            locationData.metadata || {}
          ]
        );
      }
      
      await client.query(
        `INSERT INTO user_locations 
         (user_id, latitude, longitude, accuracy, altitude, altitude_accuracy,
          heading, speed, device_id, ip_address, network_type, battery_level,
          tracking_session_id, is_background, recorded_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          userId,
          locationData.latitude,
          locationData.longitude,
          locationData.accuracy || null,
          locationData.altitude || null,
          locationData.altitudeAccuracy || null,
          locationData.heading || null,
          locationData.speed || null,
          locationData.deviceId || null,
          req?.ip || null,
          locationData.networkType || null,
          locationData.batteryLevel || null,
          sessionId,
          locationData.isBackground || false,
          new Date(),
          locationData.metadata || {}
        ]
      );
      
      await client.query(
        'UPDATE location_tracking_sessions SET total_points = total_points + 1 WHERE id = $1',
        [sessionId]
      );
      
      if (req) {
        MinimalActivityLogger.logCustom(userId, sessionId, req, {
          actionType: 'LOCATION_UPDATE',
          actionCategory: 'TRACKING',
          metadata: {
            isBackground: locationData.isBackground,
            accuracy: locationData.accuracy
          }
        });
      }
      
    } catch (error) {
      console.error('Error recording location:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  static async getPreferences(userId: number): Promise<LocationPreferences | null> {
    const client = await getClient();
    
    try {
      const result = await client.query(
        `SELECT tracking_enabled, tracking_interval, background_tracking_enabled,
                high_accuracy_mode, max_tracking_duration
         FROM user_location_preferences
         WHERE user_id = $1`,
        [userId]
      );
      
      if (result.rows.length === 0) {
        await this.createDefaultPreferences(userId);
        return {
          trackingEnabled: false,
          trackingInterval: 60,
          backgroundTrackingEnabled: false,
          highAccuracyMode: false,
          maxTrackingDuration: 28800
        };
      }
      
      return result.rows[0];
    } finally {
      client.release();
    }
  }
  
  static async updatePreferences(
    userId: number, 
    preferences: Partial<LocationPreferences>
  ): Promise<LocationPreferences> {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      await this.createDefaultPreferences(userId);
      
      const updateFields = [];
      const values = [];
      let paramCount = 1;
      
      Object.entries(preferences).forEach(([key, value]) => {
        if (value !== undefined) {
          updateFields.push(`${this.camelToSnake(key)} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      });
      
      if (updateFields.length > 0) {
        values.push(userId);
        const query = `
          UPDATE user_location_preferences 
          SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $${paramCount}
          RETURNING *
        `;
        
        const result = await client.query(query, values);
        await client.query('COMMIT');
        
        return this.snakeToCamel(result.rows[0]);
      }
      
      await client.query('COMMIT');
      return await this.getPreferences(userId);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  static async getLocationHistory(
    userId: number,
    options: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const client = await getClient();
    
    try {
      let query = `
        SELECT ul.*, lts.started_at as session_started_at
        FROM user_locations ul
        LEFT JOIN location_tracking_sessions lts ON ul.tracking_session_id = lts.id
        WHERE ul.user_id = $1
      `;
      
      const params: any[] = [userId];
      let paramCount = 2;
      
      if (options.startDate) {
        query += ` AND ul.recorded_at >= $${paramCount}`;
        params.push(options.startDate);
        paramCount++;
      }
      
      if (options.endDate) {
        query += ` AND ul.recorded_at <= $${paramCount}`;
        params.push(options.endDate);
        paramCount++;
      }
      
      query += ' ORDER BY ul.recorded_at DESC';
      
      if (options.limit) {
        query += ` LIMIT $${paramCount}`;
        params.push(options.limit);
        paramCount++;
      }
      
      if (options.offset) {
        query += ` OFFSET $${paramCount}`;
        params.push(options.offset);
      }
      
      const result = await client.query(query, params);
      return result.rows;
      
    } finally {
      client.release();
    }
  }
  
  static async startTrackingSession(
    userId: number,
    deviceInfo?: any
  ): Promise<string> {
    const client = await getClient();
    const sessionId = uuidv4();
    
    try {
      await client.query(
        `UPDATE location_tracking_sessions 
         SET is_active = false, ended_at = CURRENT_TIMESTAMP 
         WHERE user_id = $1 AND is_active = true`,
        [userId]
      );
      
      await client.query(
        `INSERT INTO location_tracking_sessions 
         (id, user_id, device_info) 
         VALUES ($1, $2, $3)`,
        [sessionId, userId, deviceInfo || {}]
      );
      
      return sessionId;
      
    } finally {
      client.release();
    }
  }
  
  static async endTrackingSession(sessionId: string): Promise<void> {
    const client = await getClient();
    
    try {
      await client.query(
        `UPDATE location_tracking_sessions 
         SET is_active = false, ended_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [sessionId]
      );
    } finally {
      client.release();
    }
  }
  
  private static async createDefaultPreferences(userId: number): Promise<void> {
    const client = await getClient();
    
    await client.query(
      `INSERT INTO user_location_preferences (user_id) 
       VALUES ($1) 
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
    
    client.release();
  }
  
  private static camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
  
  private static snakeToCamel(obj: any): any {
    const newObj: any = {};
    Object.keys(obj).forEach(key => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      newObj[camelKey] = obj[key];
    });
    return newObj;
  }
}
```

### Step 3: Backend Controller
Create file: `backend/src/controllers/locationController.ts`

```typescript
import { Request, Response } from 'express';
import { LocationService } from '../services/locationService';
import { validationResult } from 'express-validator';

export class LocationController {
  static async recordLocation(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
      }
      
      const userId = (req as any).userId;
      const sessionId = req.body.sessionId || req.headers['x-tracking-session'];
      
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Tracking session ID required'
        });
      }
      
      await LocationService.recordLocation(
        userId,
        sessionId,
        req.body,
        req
      );
      
      res.json({
        success: true,
        message: 'Location recorded successfully'
      });
      
    } catch (error: any) {
      console.error('Location recording error:', error);
      res.status(error.message.includes('not enabled') ? 403 : 500).json({
        success: false,
        message: error.message || 'Failed to record location'
      });
    }
  }
  
  static async getPreferences(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const preferences = await LocationService.getPreferences(userId);
      
      res.json({
        success: true,
        data: preferences
      });
      
    } catch (error) {
      console.error('Get preferences error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get location preferences'
      });
    }
  }
  
  static async updatePreferences(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const preferences = await LocationService.updatePreferences(
        userId,
        req.body
      );
      
      res.json({
        success: true,
        message: 'Preferences updated successfully',
        data: preferences
      });
      
    } catch (error) {
      console.error('Update preferences error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update preferences'
      });
    }
  }
  
  static async getLocationHistory(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const { startDate, endDate, limit = 100, offset = 0 } = req.query;
      
      const history = await LocationService.getLocationHistory(userId, {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
      
      res.json({
        success: true,
        data: history
      });
      
    } catch (error) {
      console.error('Get history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get location history'
      });
    }
  }
  
  static async startSession(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const sessionId = await LocationService.startTrackingSession(
        userId,
        req.body.deviceInfo
      );
      
      res.json({
        success: true,
        data: { sessionId }
      });
      
    } catch (error) {
      console.error('Start session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start tracking session'
      });
    }
  }
  
  static async endSession(req: Request, res: Response) {
    try {
      const sessionId = req.params.sessionId;
      await LocationService.endTrackingSession(sessionId);
      
      res.json({
        success: true,
        message: 'Tracking session ended'
      });
      
    } catch (error) {
      console.error('End session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to end tracking session'
      });
    }
  }
  
  static async getCurrentLocation(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const history = await LocationService.getLocationHistory(userId, { limit: 1 });
      
      if (history.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No location data found'
        });
      }
      
      res.json({
        success: true,
        data: history[0]
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get current location'
      });
    }
  }
}
```

### Step 4: Backend Routes
Create file: `backend/src/routes/locationRoutes.ts`

```typescript
import { Router } from 'express';
import { body, query } from 'express-validator';
import { LocationController } from '../controllers/locationController';
import authMiddleware from '../middleware/auth';
import rateLimiter from '../middleware/rateLimiter';

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

router.use(authMiddleware);

router.post(
  '/record',
  locationRateLimit,
  locationValidation,
  LocationController.recordLocation
);

router.get('/preferences', LocationController.getPreferences);

router.put(
  '/preferences',
  preferencesValidation,
  LocationController.updatePreferences
);

router.get(
  '/history',
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
  LocationController.endSession
);

router.get('/current', LocationController.getCurrentLocation);

export default router;
```

### Step 5: Update Backend Routes Index
Update file: `backend/src/routes/index.ts`

```typescript
// Add these imports at the top
import locationRoutes from './locationRoutes';

// Add this line where other routes are registered
app.use('/api/location', locationRoutes);
```

### Step 6: Frontend Location Service
Create file: `frontend/src/services/locationService.ts`

```typescript
import api from './api';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
  deviceId?: string;
  networkType?: string;
  batteryLevel?: number;
  isBackground?: boolean;
  metadata?: any;
}

export interface LocationPreferences {
  trackingEnabled: boolean;
  trackingInterval: number;
  backgroundTrackingEnabled: boolean;
  highAccuracyMode: boolean;
  maxTrackingDuration: number;
}

class LocationService {
  private trackingSessionId: string | null = null;
  private watchId: number | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private lastLocation: LocationData | null = null;
  private isTracking: boolean = false;
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;

  async initialize(): Promise<void> {
    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported by this browser');
    }

    const permission = await this.requestLocationPermission();
    if (permission !== 'granted') {
      throw new Error('Location permission denied');
    }

    if ('serviceWorker' in navigator) {
      await this.registerServiceWorker();
    }
  }

  private async requestLocationPermission(): Promise<PermissionState> {
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return result.state;
    } catch (error) {
      console.error('Error checking location permission:', error);
      return 'denied';
    }
  }

  private async registerServiceWorker(): Promise<void> {
    try {
      this.serviceWorkerRegistration = await navigator.serviceWorker.register(
        '/location-tracking-sw.js'
      );
      console.log('Service Worker registered for location tracking');
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  async startTracking(preferences?: Partial<LocationPreferences>): Promise<void> {
    if (this.isTracking) {
      console.warn('Location tracking already active');
      return;
    }

    try {
      const currentPrefs = await this.getPreferences();
      
      if (!currentPrefs.trackingEnabled) {
        throw new Error('Location tracking is disabled in user preferences');
      }

      const response = await api.post('/api/location/session/start', {
        deviceInfo: this.getDeviceInfo()
      });
      
      this.trackingSessionId = response.data.data.sessionId;
      this.isTracking = true;

      this.startForegroundTracking(currentPrefs);

      if (currentPrefs.backgroundTrackingEnabled) {
        await this.setupBackgroundTracking(currentPrefs);
      }

      console.log('Location tracking started', { sessionId: this.trackingSessionId });
    } catch (error) {
      console.error('Failed to start tracking:', error);
      throw error;
    }
  }

  private startForegroundTracking(preferences: LocationPreferences): void {
    const options: PositionOptions = {
      enableHighAccuracy: preferences.highAccuracyMode,
      timeout: 30000,
      maximumAge: 0
    };

    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handleLocationUpdate(position),
      (error) => this.handleLocationError(error),
      options
    );

    this.intervalId = setInterval(
      () => this.getCurrentLocationAndRecord(),
      preferences.trackingInterval * 1000
    );
  }

  private async setupBackgroundTracking(preferences: LocationPreferences): Promise<void> {
    if (!this.serviceWorkerRegistration) {
      console.warn('Service Worker not available for background tracking');
      return;
    }

    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'START_BACKGROUND_TRACKING',
        config: {
          sessionId: this.trackingSessionId,
          interval: preferences.trackingInterval * 1000,
          highAccuracy: preferences.highAccuracyMode
        }
      });
    }
  }

  private async handleLocationUpdate(position: GeolocationPosition): Promise<void> {
    const locationData: LocationData = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude || undefined,
      altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
      heading: position.coords.heading || undefined,
      speed: position.coords.speed || undefined,
      deviceId: this.getDeviceId(),
      networkType: this.getNetworkType(),
      batteryLevel: await this.getBatteryLevel(),
      isBackground: document.hidden,
      metadata: {
        timestamp: position.timestamp
      }
    };

    if (this.hasLocationChangedSignificantly(locationData)) {
      this.lastLocation = locationData;
      await this.recordLocation(locationData);
    }
  }

  async recordLocation(location: LocationData): Promise<void> {
    if (!this.trackingSessionId) {
      console.error('No active tracking session');
      return;
    }

    try {
      await api.post('/api/location/record', {
        ...location,
        sessionId: this.trackingSessionId
      });
    } catch (error) {
      console.error('Failed to record location:', error);
      this.storeFailedLocation(location);
    }
  }

  async stopTracking(): Promise<void> {
    if (!this.isTracking) {
      return;
    }

    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'STOP_BACKGROUND_TRACKING'
      });
    }

    if (this.trackingSessionId) {
      try {
        await api.post(`/api/location/session/${this.trackingSessionId}/end`);
      } catch (error) {
        console.error('Failed to end tracking session:', error);
      }
    }

    this.isTracking = false;
    this.trackingSessionId = null;
    this.lastLocation = null;
  }

  async getPreferences(): Promise<LocationPreferences> {
    const response = await api.get('/api/location/preferences');
    return response.data.data;
  }

  async updatePreferences(preferences: Partial<LocationPreferences>): Promise<LocationPreferences> {
    const response = await api.put('/api/location/preferences', preferences);
    return response.data.data;
  }

  async getLocationHistory(params?: any): Promise<any[]> {
    const response = await api.get('/api/location/history', { params });
    return response.data.data;
  }

  async getCurrentLocation(): Promise<LocationData | null> {
    const response = await api.get('/api/location/current');
    return response.data.data;
  }

  // Helper methods
  private getCurrentLocationAndRecord(): void {
    navigator.geolocation.getCurrentPosition(
      (position) => this.handleLocationUpdate(position),
      (error) => this.handleLocationError(error),
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0
      }
    );
  }

  private handleLocationError(error: GeolocationPositionError): void {
    console.error('Location error:', error);
  }

  private hasLocationChangedSignificantly(newLocation: LocationData): boolean {
    if (!this.lastLocation) return true;
    
    const R = 6371e3;
    const φ1 = this.lastLocation.latitude * Math.PI / 180;
    const φ2 = newLocation.latitude * Math.PI / 180;
    const Δφ = (newLocation.latitude - this.lastLocation.latitude) * Math.PI / 180;
    const Δλ = (newLocation.longitude - this.lastLocation.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    return distance > 10;
  }

  private getDeviceId(): string {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = this.generateDeviceId();
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  private generateDeviceId(): string {
    return 'web-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  private getNetworkType(): string {
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    if (connection) {
      return connection.effectiveType || connection.type || 'unknown';
    }
    
    return 'unknown';
  }

  private async getBatteryLevel(): Promise<number | undefined> {
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();
        return Math.round(battery.level * 100);
      } catch (error) {
        console.error('Failed to get battery level:', error);
      }
    }
    return undefined;
  }

  private getDeviceInfo(): any {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }

  private storeFailedLocation(location: LocationData): void {
    const failedLocations = JSON.parse(
      localStorage.getItem('failedLocations') || '[]'
    );
    failedLocations.push({
      ...location,
      failedAt: new Date().toISOString()
    });
    localStorage.setItem('failedLocations', JSON.stringify(failedLocations));
  }
}

export default new LocationService();
```

### Step 7: Service Worker
Create file: `frontend/public/location-tracking-sw.js`

```javascript
let trackingConfig = null;
let trackingInterval = null;

self.addEventListener('message', (event) => {
  const { type, config } = event.data;
  
  switch (type) {
    case 'START_BACKGROUND_TRACKING':
      startBackgroundTracking(config);
      break;
    case 'STOP_BACKGROUND_TRACKING':
      stopBackgroundTracking();
      break;
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'location-sync') {
    event.waitUntil(syncOfflineLocations());
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'location-tracking') {
    event.waitUntil(trackLocationInBackground());
  }
});

function startBackgroundTracking(config) {
  trackingConfig = config;
  
  if (trackingInterval) {
    clearInterval(trackingInterval);
  }
  
  trackingInterval = setInterval(() => {
    trackLocationInBackground();
  }, config.interval);
  
  console.log('Background tracking started', config);
}

function stopBackgroundTracking() {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
  trackingConfig = null;
  console.log('Background tracking stopped');
}

async function trackLocationInBackground() {
  if (!trackingConfig) return;
  
  try {
    const position = await getCurrentPosition();
    
    const locationData = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      isBackground: true,
      deviceId: await getDeviceId(),
      metadata: {
        timestamp: position.timestamp,
        serviceWorker: true
      }
    };
    
    await sendLocationToServer(locationData);
    
  } catch (error) {
    console.error('Background location tracking error:', error);
    await storeFailedLocation(locationData);
  }
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      {
        enableHighAccuracy: trackingConfig?.highAccuracy || true,
        timeout: 30000,
        maximumAge: 0
      }
    );
  });
}

async function sendLocationToServer(locationData) {
  const token = await getAuthToken();
  
  if (!token) {
    throw new Error('No auth token available');
  }
  
  const response = await fetch('/api/location/record', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Tracking-Session': trackingConfig.sessionId
    },
    body: JSON.stringify(locationData)
  });
  
  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
  }
  
  return response.json();
}

async function getAuthToken() {
  return new Promise((resolve) => {
    self.clients.matchAll().then(clients => {
      if (clients.length > 0) {
        clients[0].postMessage({ type: 'GET_AUTH_TOKEN' });
        
        self.addEventListener('message', function handler(event) {
          if (event.data.type === 'AUTH_TOKEN_RESPONSE') {
            self.removeEventListener('message', handler);
            resolve(event.data.token);
          }
        });
      } else {
        resolve(null);
      }
    });
  });
}

async function getDeviceId() {
  return 'sw-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

console.log('Location tracking service worker loaded');
```

### Step 8: Frontend Component
Create file: `frontend/src/pages/LocationSettingsPage.tsx`

Use the React component from the previous artifact (location-settings-component).

### Step 9: Add Route in Frontend
Update file: `frontend/src/App.tsx`

```typescript
// Add import
import LocationSettingsPage from './pages/LocationSettingsPage';

// Add route in Routes section (inside ProtectedRoute)
<Route path="/location-settings" element={
  <ProtectedRoute>
    <LocationSettingsPage />
  </ProtectedRoute>
} />
```

### Step 10: Add Navigation Link
Update file: `frontend/src/components/layout/Navigation.tsx` or similar

```typescript
// Add navigation link
<Link to="/location-settings" className="nav-link">
  <MapPin className="h-5 w-5 mr-2" />
  Location Settings
</Link>
```

### Step 11: Update UAL Actions (Optional)
Update file: `backend/migrations/011_add_location_tracking_actions.sql`

```sql
-- Add new action types for location tracking
ALTER TABLE user_activity_logs DROP CONSTRAINT IF EXISTS chk_action_type;
ALTER TABLE user_activity_logs ADD CONSTRAINT chk_action_type 
CHECK (action_type IN (
    'LOGIN', 'LOGOUT', 'TOKEN_REFRESH', 'FAILED_LOGIN',
    'VIEW_PROFILE', 'UPDATE_PROFILE', 'CHANGE_PASSWORD', 'UPLOAD_AVATAR',
    'VIEW_SETTINGS', 'UPDATE_SETTINGS',
    'VIEW_DASHBOARD', 'VIEW_PAGE',
    'API_CALL',
    'SUSPICIOUS_ACTIVITY', 'ERROR_OCCURRED',
    'LOCATION_UPDATE', 'LOCATION_SESSION_START', 'LOCATION_SESSION_END'
));

-- Add TRACKING category
ALTER TABLE user_activity_logs DROP CONSTRAINT IF EXISTS chk_action_category;
ALTER TABLE user_activity_logs ADD CONSTRAINT chk_action_category 
CHECK (action_category IN ('AUTH', 'PROFILE', 'SETTINGS', 'NAVIGATION', 'SECURITY', 'SYSTEM', 'TRACKING'));
```

### Step 12: Install Dependencies
```bash
# Backend
cd backend
npm install uuid

# Frontend - no additional dependencies needed
```

---

## 🚀 Deployment Instructions

### 1. Run Database Migration
```bash
cd backend
psql -U postgres -d xp_development < migrations/010_create_user_locations_table.sql
psql -U postgres -d xp_development < migrations/011_add_location_tracking_actions.sql
```

### 2. Update Backend
- Add the LocationService, LocationController, and locationRoutes files
- Update routes/index.ts to include location routes
- Restart backend server

### 3. Update Frontend
- Add locationService.ts
- Add LocationSettingsPage.tsx
- Copy Service Worker to public folder
- Update App.tsx with new route
- Restart frontend server

### 4. Test the Feature
1. Login with test account
2. Navigate to /location-settings
3. Enable tracking and configure preferences
4. Click "Start Tracking"
5. Allow browser location permission
6. Check database for location records

---

## ⚠️ Important Notes

1. **HTTPS Required**: Service Worker and Geolocation API require HTTPS in production
2. **Browser Permissions**: Users must grant location permission
3. **Battery Optimization**: Mobile devices may kill background tracking
4. **iOS Limitations**: Safari has limited Service Worker support
5. **Privacy Compliance**: Ensure GDPR/privacy policy compliance
6. **Data Retention**: Configure cleanup_old_locations() function schedule

---

## 🔒 Security Considerations

1. **Authentication**: All endpoints require JWT authentication
2. **User Consent**: Explicit opt-in via preferences
3. **Data Encryption**: Use HTTPS for all transmissions
4. **Rate Limiting**: Configured to prevent abuse
5. **Data Minimization**: Only collect necessary location data
6. **Access Control**: Users can only access their own location data

---

## 📱 Mobile Optimization

For mobile web apps:
1. Add PWA manifest for installable app
2. Configure background sync permissions
3. Handle network offline scenarios
4. Optimize battery usage with reduced accuracy when appropriate
5. Implement wake lock API to prevent sleep during tracking

---

## 🧪 Testing Checklist

- [ ] Database migration successful
- [ ] Backend endpoints responding
- [ ] Frontend can request location permission
- [ ] Location recording works
- [ ] Background tracking initiates
- [ ] Session management works
- [ ] Preferences save correctly
- [ ] History displays properly
- [ ] Service Worker registers
- [ ] Offline sync works

---

## 📞 Support

For issues or questions:
1. Check browser console for errors
2. Verify HTTPS is enabled
3. Check location permissions in browser settings
4. Review PostgreSQL logs for database errors
5. Ensure JWT token is valid

---

**Document Version**: 1.0  
**Created**: 2025-01-06  
**Status**: Ready for Implementation