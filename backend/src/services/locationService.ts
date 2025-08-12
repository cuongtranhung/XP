import { getClient } from '../utils/database';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import cacheService from './cacheService';
import performanceMonitor from './performanceMonitor';
// import MinimalActivityLogger from './minimalActivityLogger';

// Custom error classes for better error handling
class LocationTrackingError extends Error {
  constructor(message: string, public code: string, public statusCode: number = 400) {
    super(message);
    this.name = 'LocationTrackingError';
  }
}

class LocationPermissionError extends LocationTrackingError {
  constructor(message: string = 'Location tracking not permitted') {
    super(message, 'LOCATION_PERMISSION_DENIED', 403);
  }
}

class LocationConfigurationError extends LocationTrackingError {
  constructor(message: string = 'Location tracking not configured') {
    super(message, 'LOCATION_NOT_CONFIGURED', 400);
  }
}

class LocationSessionError extends LocationTrackingError {
  constructor(message: string = 'Invalid or expired tracking session') {
    super(message, 'INVALID_SESSION', 400);
  }
}

// Configuration constants
const LOCATION_CONFIG = {
  VALIDATION: {
    LATITUDE_MIN: -90,
    LATITUDE_MAX: 90,
    LONGITUDE_MIN: -180,
    LONGITUDE_MAX: 180,
    ACCURACY_MAX: 50000, // meters
    SPEED_MAX: 200, // m/s (720 km/h)
    HEADING_MIN: 0,
    HEADING_MAX: 360,
    BATTERY_MIN: 0,
    BATTERY_MAX: 100
  },
  DEFAULTS: {
    TRACKING_INTERVAL: 60,
    MAX_TRACKING_DURATION: 28800, // 8 hours
    HIGH_ACCURACY: false,
    BACKGROUND_TRACKING: false
  },
  LIMITS: {
    MAX_HISTORY_RECORDS: 10000,
    DEFAULT_HISTORY_LIMIT: 100
  }
};

interface LocationMetadata {
  timestamp?: number;
  serviceWorker?: boolean;
  source?: 'gps' | 'network' | 'passive';
  [key: string]: any;
}

interface DeviceInfo {
  userAgent?: string;
  platform?: string;
  language?: string;
  screenResolution?: string;
  timezone?: string;
  deviceId?: string;
}

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
  deviceId?: string;
  networkType?: 'wifi' | 'cellular' | '4g' | '5g' | 'ethernet' | 'unknown';
  batteryLevel?: number;
  isBackground?: boolean;
  metadata?: LocationMetadata;
}

interface LocationHistoryOptions {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

interface LocationRecord extends LocationData {
  id: number;
  userId: number;
  trackingSessionId: string;
  recordedAt: Date;
  createdAt: Date;
  ipAddress?: string;
}

interface LocationPreferences {
  trackingEnabled: boolean;
  trackingInterval: number; // seconds, 10-3600
  backgroundTrackingEnabled: boolean;
  highAccuracyMode: boolean;
  maxTrackingDuration: number; // seconds, 300-86400
  createdAt?: Date;
  updatedAt?: Date;
}

export class LocationService {
  // Input validation methods
  private static validateLocationData(data: LocationData): void {
    const { latitude, longitude, accuracy, speed, heading, batteryLevel } = data;
    
    if (!this.isValidNumber(latitude, LOCATION_CONFIG.VALIDATION.LATITUDE_MIN, LOCATION_CONFIG.VALIDATION.LATITUDE_MAX)) {
      throw new LocationTrackingError('Invalid latitude value', 'INVALID_LATITUDE', 400);
    }
    
    if (!this.isValidNumber(longitude, LOCATION_CONFIG.VALIDATION.LONGITUDE_MIN, LOCATION_CONFIG.VALIDATION.LONGITUDE_MAX)) {
      throw new LocationTrackingError('Invalid longitude value', 'INVALID_LONGITUDE', 400);
    }
    
    if (accuracy !== undefined && (accuracy < 0 || accuracy > LOCATION_CONFIG.VALIDATION.ACCURACY_MAX)) {
      throw new LocationTrackingError('Invalid accuracy value', 'INVALID_ACCURACY', 400);
    }
    
    if (speed !== undefined && (speed < 0 || speed > LOCATION_CONFIG.VALIDATION.SPEED_MAX)) {
      throw new LocationTrackingError('Invalid speed value', 'INVALID_SPEED', 400);
    }
    
    if (heading !== undefined && !this.isValidNumber(heading, LOCATION_CONFIG.VALIDATION.HEADING_MIN, LOCATION_CONFIG.VALIDATION.HEADING_MAX)) {
      throw new LocationTrackingError('Invalid heading value', 'INVALID_HEADING', 400);
    }
    
    if (batteryLevel !== undefined && !this.isValidNumber(batteryLevel, LOCATION_CONFIG.VALIDATION.BATTERY_MIN, LOCATION_CONFIG.VALIDATION.BATTERY_MAX)) {
      throw new LocationTrackingError('Invalid battery level', 'INVALID_BATTERY', 400);
    }
  }
  
  private static isValidNumber(value: number, min: number, max: number): boolean {
    return typeof value === 'number' && !isNaN(value) && value >= min && value <= max;
  }
  
  private static validateHistoryOptions(options: LocationHistoryOptions): void {
    if (options.limit && (options.limit < 1 || options.limit > LOCATION_CONFIG.LIMITS.MAX_HISTORY_RECORDS)) {
      throw new LocationTrackingError('Invalid limit value', 'INVALID_LIMIT', 400);
    }
    
    if (options.offset && options.offset < 0) {
      throw new LocationTrackingError('Invalid offset value', 'INVALID_OFFSET', 400);
    }
    
    if (options.startDate && options.endDate && options.startDate > options.endDate) {
      throw new LocationTrackingError('Start date must be before end date', 'INVALID_DATE_RANGE', 400);
    }
  }
  static async recordLocation(
    userId: number, 
    sessionId: string,
    locationData: LocationData,
    req?: any,
    userSessionId?: string
  ): Promise<void> {
    // Validate input data
    this.validateLocationData(locationData);
    
    // Start performance monitoring
    const transaction = await performanceMonitor.startTransaction('record_location', userId);
    
    const client = await getClient();
    const startTime = Date.now();
    
    try {
      // Check user preferences with single query
      const prefsResult = await client.query(
        'SELECT tracking_enabled, background_tracking_enabled FROM user_location_preferences WHERE user_id = $1',
        [userId]
      );
      
      if (prefsResult.rows.length === 0) {
        throw new LocationConfigurationError('Location tracking preferences not found');
      }
      
      const prefs = prefsResult.rows[0];
      
      // Validate permissions
      if (!prefs.tracking_enabled) {
        throw new LocationPermissionError('Location tracking is disabled');
      }
      
      if (locationData.isBackground && !prefs.background_tracking_enabled) {
        throw new LocationPermissionError('Background tracking is not enabled');
      }
      
      // Check and create session if needed
      const sessionResult = await client.query(
        'SELECT id, user_id FROM location_tracking_sessions WHERE id = $1 AND is_active = true',
        [sessionId]
      );
      
      if (sessionResult.rows.length === 0) {
        // Create new session with user_session_id link
        await client.query(
          `INSERT INTO location_tracking_sessions 
           (id, user_id, user_session_id, device_info, metadata) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            sessionId,
            userId,
            userSessionId || null, // Link to authentication session if provided
            { deviceId: locationData.deviceId },
            locationData.metadata || {}
          ]
        );
        
        logger.info('Created new tracking session', {
          userId,
          sessionId,
          deviceId: locationData.deviceId
        });
      } else if (sessionResult.rows[0].user_id !== userId) {
        throw new LocationSessionError('Session belongs to different user');
      }
      
      // Record location data with user_session_id
      const insertResult = await client.query(
        `INSERT INTO user_locations 
         (user_id, latitude, longitude, accuracy, altitude, altitude_accuracy,
          heading, speed, device_id, ip_address, network_type, battery_level,
          tracking_session_id, user_session_id, is_background, recorded_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         RETURNING id`,
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
          userSessionId || null, // Link location to authentication session
          locationData.isBackground || false,
          new Date(),
          locationData.metadata || {}
        ]
      );
      
      // Update session statistics
      await client.query(
        'UPDATE location_tracking_sessions SET total_points = total_points + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [sessionId]
      );
      
      const processingTime = Date.now() - startTime;
      
      // Log successful location recording
      logger.info('Location recorded successfully', {
        userId,
        sessionId,
        locationId: insertResult.rows[0].id,
        isBackground: locationData.isBackground,
        accuracy: locationData.accuracy,
        processingTimeMs: processingTime
      });
      
      // End performance monitoring (not cached)
      transaction.end(false);
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Log error with context
      logger.error('Failed to record location', {
        userId,
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: processingTime,
        isBackground: locationData.isBackground
      });
      
      // Record error in performance monitoring
      transaction.recordError(error instanceof Error ? error : new Error('Unknown error'));
      
      // Re-throw with proper error type
      if (error instanceof LocationTrackingError) {
        throw error;
      }
      
      throw new LocationTrackingError('Failed to record location data', 'RECORD_FAILED', 500);
    } finally {
      client.release();
    }
  }
  
  static async getPreferences(userId: number): Promise<LocationPreferences | null> {
    // Start performance monitoring
    const transaction = await performanceMonitor.startTransaction('get_preferences', userId);
    
    // Try to get from cache first
    const cachedPrefs = await cacheService.getCachedUserPreferences(userId);
    if (cachedPrefs) {
      logger.debug('Retrieved preferences from cache', { userId });
      transaction.end(true); // Cached result
      return cachedPrefs;
    }

    const client = await getClient();
    
    try {
      const result = await client.query(
        `SELECT tracking_enabled, tracking_interval, background_tracking_enabled,
                high_accuracy_mode, max_tracking_duration
         FROM user_location_preferences
         WHERE user_id = $1`,
        [userId]
      );
      
      let preferences: LocationPreferences;
      
      if (result.rows.length === 0) {
        await this.createDefaultPreferences(userId);
        preferences = {
          trackingEnabled: false,
          trackingInterval: 60,
          backgroundTrackingEnabled: false,
          highAccuracyMode: false,
          maxTrackingDuration: 28800
        };
      } else {
        preferences = this.snakeToCamel(result.rows[0]);
      }
      
      // Cache the preferences
      await cacheService.cacheUserPreferences(userId, preferences);
      
      // End performance monitoring (not cached)
      transaction.end(false);
      
      return preferences;
    } catch (error) {
      transaction.recordError(error instanceof Error ? error : new Error('Unknown error'));
      throw error;
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
      await this.createDefaultPreferencesWithClient(client, userId);
      
      const updateFields: string[] = [];
      const values: any[] = [];
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
        
        const updatedPreferences = this.snakeToCamel(result.rows[0]) as LocationPreferences;
        
        // Update cache with new preferences
        await cacheService.cacheUserPreferences(userId, updatedPreferences);
        
        return updatedPreferences;
      }
      
      await client.query('COMMIT');
      const prefs = await this.getPreferences(userId);
      return prefs!;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  static async getLocationHistory(
    userId: number,
    options: LocationHistoryOptions = {}
  ): Promise<LocationRecord[]> {
    // Validate input options
    this.validateHistoryOptions(options);
    
    // Generate cache key hash from query parameters
    const queryHash = await cacheService.generateQueryHash(options);
    
    // Try to get from cache first
    const cachedHistory = await cacheService.getCachedLocationHistory(userId, queryHash);
    if (cachedHistory) {
      logger.debug('Retrieved location history from cache', { userId, queryHash });
      return cachedHistory;
    }
    
    const client = await getClient();
    const startTime = Date.now();
    
    try {
      // Set defaults
      const limit = Math.min(options.limit || LOCATION_CONFIG.LIMITS.DEFAULT_HISTORY_LIMIT, LOCATION_CONFIG.LIMITS.MAX_HISTORY_RECORDS);
      const offset = options.offset || 0;
      
      let query = `
        SELECT 
          ul.id,
          ul.user_id,
          ul.latitude,
          ul.longitude,
          ul.accuracy,
          ul.altitude,
          ul.altitude_accuracy,
          ul.heading,
          ul.speed,
          ul.device_id,
          ul.network_type,
          ul.battery_level,
          ul.tracking_session_id,
          ul.is_background,
          ul.recorded_at,
          ul.created_at,
          ul.metadata,
          lts.started_at as session_started_at
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
      
      query += ` ORDER BY ul.recorded_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit, offset);
      
      const result = await client.query(query, params);
      const processingTime = Date.now() - startTime;
      
      logger.info('Location history retrieved', {
        userId,
        recordCount: result.rows.length,
        limit,
        offset,
        processingTimeMs: processingTime
      });
      
      const locationHistory = result.rows.map(this.mapLocationRecord);
      
      // Cache the results
      await cacheService.cacheLocationHistory(userId, queryHash, locationHistory);
      
      return locationHistory;
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Failed to retrieve location history', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: processingTime
      });
      
      throw new LocationTrackingError('Failed to retrieve location history', 'HISTORY_FAILED', 500);
    } finally {
      client.release();
    }
  }
  
  private static mapLocationRecord(row: any): LocationRecord {
    return {
      id: row.id,
      userId: row.user_id,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      accuracy: row.accuracy ? parseFloat(row.accuracy) : undefined,
      altitude: row.altitude ? parseFloat(row.altitude) : undefined,
      altitudeAccuracy: row.altitude_accuracy ? parseFloat(row.altitude_accuracy) : undefined,
      heading: row.heading ? parseFloat(row.heading) : undefined,
      speed: row.speed ? parseFloat(row.speed) : undefined,
      deviceId: row.device_id,
      networkType: row.network_type,
      batteryLevel: row.battery_level,
      trackingSessionId: row.tracking_session_id,
      isBackground: row.is_background,
      recordedAt: new Date(row.recorded_at),
      createdAt: new Date(row.created_at),
      metadata: row.metadata
    };
  }
  
  static async startTrackingSession(
    userId: number,
    deviceInfo?: DeviceInfo,
    userSessionId?: string
  ): Promise<string> {
    const client = await getClient();
    const sessionId = uuidv4();
    const startTime = Date.now();
    
    try {
      await client.query('BEGIN');
      
      // End any existing active sessions for this user
      const endResult = await client.query(
        `UPDATE location_tracking_sessions 
         SET is_active = false, ended_at = CURRENT_TIMESTAMP 
         WHERE user_id = $1 AND is_active = true
         RETURNING id`,
        [userId]
      );
      
      if (endResult.rows.length > 0) {
        logger.info('Ended previous tracking sessions', {
          userId,
          endedSessions: endResult.rows.map(row => row.id)
        });
      }
      
      // Create new session with user_session_id link
      await client.query(
        `INSERT INTO location_tracking_sessions 
         (id, user_id, user_session_id, device_info, metadata) 
         VALUES ($1, $2, $3, $4, $5)`,
        [sessionId, userId, userSessionId || null, deviceInfo || {}, { startedAt: new Date().toISOString() }]
      );
      
      await client.query('COMMIT');
      
      const processingTime = Date.now() - startTime;
      
      logger.info('Tracking session started', {
        userId,
        sessionId,
        deviceInfo,
        processingTimeMs: processingTime
      });
      
      // Cache session data
      await cacheService.cacheSessionData(sessionId, {
        userId,
        deviceInfo,
        startedAt: new Date().toISOString(),
        isActive: true
      });
      
      return sessionId;
      
    } catch (error) {
      await client.query('ROLLBACK');
      
      const processingTime = Date.now() - startTime;
      
      logger.error('Failed to start tracking session', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: processingTime
      });
      
      throw new LocationTrackingError('Failed to start tracking session', 'SESSION_START_FAILED', 500);
    } finally {
      client.release();
    }
  }
  
  static async endTrackingSession(sessionId: string, userId?: number): Promise<void> {
    const client = await getClient();
    const startTime = Date.now();
    
    try {
      let query = `
        UPDATE location_tracking_sessions 
        SET is_active = false, ended_at = CURRENT_TIMESTAMP 
        WHERE id = $1
      `;
      const params = [sessionId];
      
      // If userId provided, ensure session belongs to user
      if (userId) {
        query += ' AND user_id = $2';
        params.push(userId.toString());
      }
      
      query += ' RETURNING user_id, total_points';
      
      const result = await client.query(query, params);
      
      if (result.rows.length === 0) {
        throw new LocationSessionError('Session not found or already ended');
      }
      
      const processingTime = Date.now() - startTime;
      const session = result.rows[0];
      
      logger.info('Tracking session ended', {
        sessionId,
        userId: session.user_id,
        totalPoints: session.total_points,
        processingTimeMs: processingTime
      });
      
      // Invalidate session cache
      await cacheService.invalidateSessionData(sessionId);
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Failed to end tracking session', {
        sessionId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: processingTime
      });
      
      if (error instanceof LocationTrackingError) {
        throw error;
      }
      
      throw new LocationTrackingError('Failed to end tracking session', 'SESSION_END_FAILED', 500);
    } finally {
      client.release();
    }
  }
  
  private static async createDefaultPreferences(userId: number): Promise<void> {
    const client = await getClient();
    
    try {
      await client.query(
        `INSERT INTO user_location_preferences (user_id) 
         VALUES ($1) 
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );
    } finally {
      client.release();
    }
  }

  // Version that uses existing client connection (prevents nested connection deadlock)
  private static async createDefaultPreferencesWithClient(client: any, userId: number): Promise<void> {
    await client.query(
      `INSERT INTO user_location_preferences (user_id) 
       VALUES ($1) 
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
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

// Export error classes for use in controllers
export {
  LocationTrackingError,
  LocationPermissionError,
  LocationConfigurationError,
  LocationSessionError,
  LocationData,
  LocationPreferences,
  LocationHistoryOptions,
  LocationRecord,
  DeviceInfo,
  LocationMetadata
};