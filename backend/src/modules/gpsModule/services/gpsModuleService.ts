/**
 * GPS Module Service
 * 
 * Wrapper service that checks module status before delegating to LocationService.
 * Ensures GPS functionality can be disabled without affecting core system.
 */

import { 
  LocationService, 
  LocationData, 
  LocationPreferences, 
  LocationHistoryOptions,
  LocationRecord,
  DeviceInfo,
  LocationTrackingError
} from '../../../services/locationService';
import { gpsModuleConfig } from '../config/gpsModuleConfig';
import { logger } from '../../../utils/logger';

class GPSModuleDisabledError extends Error {
  constructor(message: string = 'GPS Module is currently disabled') {
    super(message);
    this.name = 'GPSModuleDisabledError';
  }
}

export class GPSModuleService {
  /**
   * Check if module is enabled before executing any operation
   */
  private static async checkModuleEnabled(): Promise<void> {
    const isEnabled = await gpsModuleConfig.isEnabled();
    if (!isEnabled) {
      throw new GPSModuleDisabledError();
    }
  }

  /**
   * Wrap operation with error handling and module status check
   */
  private static async executeWithModuleCheck<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    try {
      // Check if module is enabled
      await this.checkModuleEnabled();
      
      // Execute the operation
      const result = await operation();
      
      // Operation successful, reset error count
      const config = await gpsModuleConfig.getConfiguration();
      if (config && config.module.currentErrorCount && config.module.currentErrorCount > 0) {
        config.module.currentErrorCount = 0;
        config.module.healthStatus = 'healthy';
        await gpsModuleConfig.updateConfiguration({ module: config.module }, 'system');
      }
      
      return result;
      
    } catch (error) {
      // Log error
      logger.error(`GPS Module operation failed: ${operationName}`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Record error in module config (except for disabled errors)
      if (!(error instanceof GPSModuleDisabledError)) {
        await gpsModuleConfig.recordError(error as Error);
      }
      
      throw error;
    }
  }

  /**
   * Record location with module check
   */
  static async recordLocation(
    userId: number,
    sessionId: string,
    locationData: LocationData,
    req?: any,
    userSessionId?: string
  ): Promise<void> {
    return this.executeWithModuleCheck(
      () => LocationService.recordLocation(userId, sessionId, locationData, req, userSessionId),
      'recordLocation'
    );
  }

  /**
   * Get preferences with module check
   */
  static async getPreferences(userId: number): Promise<LocationPreferences | null> {
    return this.executeWithModuleCheck(
      () => LocationService.getPreferences(userId),
      'getPreferences'
    );
  }

  /**
   * Update preferences with module check
   */
  static async updatePreferences(
    userId: number,
    preferences: Partial<LocationPreferences>
  ): Promise<LocationPreferences> {
    return this.executeWithModuleCheck(
      () => LocationService.updatePreferences(userId, preferences),
      'updatePreferences'
    );
  }

  /**
   * Get location history with module check
   */
  static async getLocationHistory(
    userId: number,
    options: LocationHistoryOptions = {}
  ): Promise<LocationRecord[]> {
    return this.executeWithModuleCheck(
      () => LocationService.getLocationHistory(userId, options),
      'getLocationHistory'
    );
  }

  /**
   * Start tracking session with module check
   */
  static async startTrackingSession(
    userId: number,
    deviceInfo?: DeviceInfo,
    userSessionId?: string
  ): Promise<string> {
    return this.executeWithModuleCheck(
      () => LocationService.startTrackingSession(userId, deviceInfo, userSessionId),
      'startTrackingSession'
    );
  }

  /**
   * End tracking session with module check
   */
  static async endTrackingSession(sessionId: string, userId?: number): Promise<void> {
    return this.executeWithModuleCheck(
      () => LocationService.endTrackingSession(sessionId, userId),
      'endTrackingSession'
    );
  }

  /**
   * Check if GPS module is available and enabled
   */
  static async isAvailable(): Promise<boolean> {
    try {
      return await gpsModuleConfig.isEnabled();
    } catch (error) {
      logger.error('Failed to check GPS module availability', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Get module health status
   */
  static async getModuleHealth(): Promise<any> {
    return await gpsModuleConfig.getHealthStatus();
  }
}

// Export everything from LocationService for backward compatibility
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
} from '../../../services/locationService';