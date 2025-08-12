/**
 * GPS Module Entry Point
 * 
 * Central initialization and management for the GPS tracking module.
 * Handles module startup, configuration, and graceful shutdown.
 */

import { gpsModuleConfig } from './config/gpsModuleConfig';
import { GPSModuleService } from './services/gpsModuleService';
import { logger } from '../../utils/logger';

export class GPSModule {
  private static instance: GPSModule;
  private initialized = false;
  private enabled = false;

  private constructor() {}

  static getInstance(): GPSModule {
    if (!GPSModule.instance) {
      GPSModule.instance = new GPSModule();
    }
    return GPSModule.instance;
  }

  /**
   * Initialize GPS module
   */
  async initialize(): Promise<boolean> {
    try {
      logger.info('🛰️  Initializing GPS Tracking Module...');

      // Initialize configuration
      await gpsModuleConfig.initialize();

      // Check if module should be enabled
      this.enabled = await gpsModuleConfig.isEnabled();
      
      this.initialized = true;
      
      logger.info('✅ GPS Tracking Module initialized successfully', {
        enabled: this.enabled,
        initialized: this.initialized
      });

      return true;

    } catch (error) {
      logger.error('❌ Failed to initialize GPS Tracking Module', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // Set as initialized but disabled on error
      this.initialized = true;
      this.enabled = false;
      
      return false;
    }
  }

  /**
   * Check if module is ready to use
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Check if module is enabled
   */
  isEnabled(): boolean {
    return this.enabled && this.initialized;
  }

  /**
   * Get module health status
   */
  async getHealthStatus(): Promise<{
    initialized: boolean;
    enabled: boolean;
    healthy: boolean;
    status: string;
    issues: string[];
    recommendations: string[];
  }> {
    if (!this.initialized) {
      return {
        initialized: false,
        enabled: false,
        healthy: false,
        status: 'not_initialized',
        issues: ['GPS Module not initialized'],
        recommendations: ['Initialize GPS Module at application startup']
      };
    }

    try {
      const health = await gpsModuleConfig.getHealthStatus();
      
      return {
        initialized: this.initialized,
        enabled: this.enabled,
        healthy: health.healthy,
        status: health.status,
        issues: health.issues,
        recommendations: health.recommendations
      };

    } catch (error) {
      return {
        initialized: this.initialized,
        enabled: false,
        healthy: false,
        status: 'error',
        issues: ['Failed to retrieve module health status'],
        recommendations: ['Check module configuration and restart if necessary']
      };
    }
  }

  /**
   * Refresh module status (for when admin enables/disables)
   */
  async refresh(): Promise<void> {
    try {
      this.enabled = await gpsModuleConfig.isEnabled();
      logger.info('GPS Module status refreshed', {
        enabled: this.enabled
      });
    } catch (error) {
      logger.error('Failed to refresh GPS Module status', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down GPS Tracking Module...');
      
      // No active connections to close for now
      // Future: close any active tracking sessions, flush caches, etc.
      
      this.initialized = false;
      this.enabled = false;
      
      logger.info('GPS Tracking Module shut down successfully');
      
    } catch (error) {
      logger.error('Error during GPS Module shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// Export singleton instance
export const gpsModule = GPSModule.getInstance();

// Export all services and types for convenience
export { GPSModuleService } from './services/gpsModuleService';
export { GPSModuleController } from './controllers/gpsModuleController';
export { gpsModuleConfig } from './config/gpsModuleConfig';
export { default as gpsModuleRoutes } from './routes/gpsModuleRoutes';

// Re-export location types for convenience
export {
  LocationData,
  LocationPreferences,
  LocationHistoryOptions,
  LocationRecord,
  DeviceInfo,
  LocationMetadata,
  LocationTrackingError
} from '../../services/locationService';