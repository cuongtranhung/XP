/**
 * GPS Module Configuration Service
 * 
 * Modular GPS tracking system that can be enabled/disabled without affecting core system.
 * Similar architecture to UAL module with admin controls and health monitoring.
 */

import { logger } from '../../../utils/logger';
import { getClient } from '../../../utils/database';

interface GPSModuleSettings {
  enabled: boolean;
  enabledBy?: string; // Admin user ID who enabled/disabled
  enabledAt?: Date;
  disabledAt?: Date;
  autoDisableOnError?: boolean;
  maxErrorsBeforeDisable?: number;
  currentErrorCount?: number;
  lastHealthCheck?: Date;
  healthStatus?: 'healthy' | 'warning' | 'critical' | 'disabled';
  performanceImpact?: 'minimal' | 'moderate' | 'high';
}

interface GPSModuleConfig {
  // Core module settings
  module: GPSModuleSettings;
  
  // Feature-specific settings
  features: {
    locationTracking: boolean;
    realTimeTracking: boolean;
    backgroundTracking: boolean;
    locationHistory: boolean;
    locationAnalytics: boolean;
  };
  
  // Performance settings
  performance: {
    maxLocationsPerUser: number;
    locationRetentionDays: number;
    batchProcessingSize: number;
    cacheLocationData: boolean;
    throttleRequestsPerMinute: number;
  };
  
  // Security settings
  security: {
    requiresPermission: boolean;
    encryptLocationData: boolean;
    anonymizeAfterDays: number;
    restrictToAdmins: boolean;
  };
  
  // Monitoring settings
  monitoring: {
    trackPerformanceMetrics: boolean;
    alertOnErrors: boolean;
    logDetailedActivity: boolean;
    generateReports: boolean;
  };
}

class GPSModuleConfigService {
  private static instance: GPSModuleConfigService;
  private config: GPSModuleConfig | null = null;
  private lastConfigLoad: Date | null = null;
  private readonly CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): GPSModuleConfigService {
    if (!GPSModuleConfigService.instance) {
      GPSModuleConfigService.instance = new GPSModuleConfigService();
    }
    return GPSModuleConfigService.instance;
  }

  /**
   * Initialize GPS module configuration
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing GPS Module configuration...');
      
      // Create configuration table if it doesn't exist
      await this.createConfigTable();
      
      // Load configuration from database
      await this.loadConfiguration();
      
      // If no configuration exists, create default
      if (!this.config) {
        await this.createDefaultConfiguration();
      }
      
      logger.info('GPS Module configuration initialized successfully', {
        enabled: this.config?.module.enabled,
        healthStatus: this.config?.module.healthStatus
      });
      
    } catch (error) {
      logger.error('Failed to initialize GPS Module configuration', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Create minimal fallback configuration
      this.config = this.getDefaultConfig();
      this.config.module.enabled = false;
      this.config.module.healthStatus = 'critical';
    }
  }

  /**
   * Check if GPS module is enabled
   */
  async isEnabled(): Promise<boolean> {
    await this.ensureConfigLoaded();
    return this.config?.module.enabled || false;
  }

  /**
   * Enable GPS module
   */
  async enableModule(adminUserId: string, reason?: string): Promise<boolean> {
    try {
      await this.ensureConfigLoaded();
      
      if (!this.config) {
        throw new Error('GPS module configuration not loaded');
      }

      const client = await getClient();
      
      try {
        await client.query('BEGIN');
        
        // Update module settings
        this.config.module.enabled = true;
        this.config.module.enabledBy = adminUserId;
        this.config.module.enabledAt = new Date();
        this.config.module.healthStatus = 'healthy';
        this.config.module.currentErrorCount = 0;
        
        // Save to database
        await this.saveConfiguration();
        
        await client.query('COMMIT');
        
        logger.info('GPS Module enabled successfully', {
          adminUserId,
          reason,
          timestamp: new Date()
        });
        
        return true;
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      
    } catch (error) {
      logger.error('Failed to enable GPS Module', {
        adminUserId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Disable GPS module
   */
  async disableModule(adminUserId: string, reason?: string): Promise<boolean> {
    try {
      await this.ensureConfigLoaded();
      
      if (!this.config) {
        throw new Error('GPS module configuration not loaded');
      }

      const client = await getClient();
      
      try {
        await client.query('BEGIN');
        
        // Update module settings
        this.config.module.enabled = false;
        this.config.module.enabledBy = adminUserId;
        this.config.module.disabledAt = new Date();
        this.config.module.healthStatus = 'disabled';
        
        // Save to database
        await this.saveConfiguration();
        
        await client.query('COMMIT');
        
        logger.info('GPS Module disabled successfully', {
          adminUserId,
          reason,
          timestamp: new Date()
        });
        
        return true;
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      
    } catch (error) {
      logger.error('Failed to disable GPS Module', {
        adminUserId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Get current module configuration
   */
  async getConfiguration(): Promise<GPSModuleConfig | null> {
    await this.ensureConfigLoaded();
    return this.config ? JSON.parse(JSON.stringify(this.config)) : null;
  }

  /**
   * Update module configuration
   */
  async updateConfiguration(
    updates: Partial<GPSModuleConfig>,
    adminUserId: string
  ): Promise<boolean> {
    try {
      await this.ensureConfigLoaded();
      
      if (!this.config) {
        throw new Error('GPS module configuration not loaded');
      }

      // Merge updates
      this.config = { ...this.config, ...updates };
      
      // Save to database
      await this.saveConfiguration();
      
      logger.info('GPS Module configuration updated', {
        adminUserId,
        updates: Object.keys(updates),
        timestamp: new Date()
      });
      
      return true;
      
    } catch (error) {
      logger.error('Failed to update GPS Module configuration', {
        adminUserId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Record error and auto-disable if threshold reached
   */
  async recordError(error: Error): Promise<void> {
    try {
      await this.ensureConfigLoaded();
      
      if (!this.config) return;

      this.config.module.currentErrorCount = (this.config.module.currentErrorCount || 0) + 1;
      
      // Auto-disable if error threshold reached
      if (
        this.config.module.autoDisableOnError &&
        this.config.module.currentErrorCount >= (this.config.module.maxErrorsBeforeDisable || 10)
      ) {
        logger.warn('GPS Module auto-disabled due to error threshold', {
          errorCount: this.config.module.currentErrorCount,
          threshold: this.config.module.maxErrorsBeforeDisable
        });
        
        await this.disableModule('system', `Auto-disabled: ${this.config.module.currentErrorCount} consecutive errors`);
      }
      
      // Update health status
      if (this.config.module.currentErrorCount >= 5) {
        this.config.module.healthStatus = 'critical';
      } else if (this.config.module.currentErrorCount >= 2) {
        this.config.module.healthStatus = 'warning';
      }
      
      await this.saveConfiguration();
      
    } catch (configError) {
      logger.error('Failed to record GPS Module error', {
        originalError: error.message,
        configError: configError instanceof Error ? configError.message : 'Unknown error'
      });
    }
  }

  /**
   * Get module health status
   */
  async getHealthStatus(): Promise<{
    enabled: boolean;
    healthy: boolean;
    status: string;
    lastCheck: Date | null;
    errorCount: number;
    issues: string[];
    recommendations: string[];
  }> {
    await this.ensureConfigLoaded();
    
    if (!this.config) {
      return {
        enabled: false,
        healthy: false,
        status: 'critical',
        lastCheck: null,
        errorCount: 0,
        issues: ['Configuration not loaded'],
        recommendations: ['Restart GPS Module service']
      };
    }

    const issues: string[] = [];
    const recommendations: string[] = [];
    
    if (!this.config.module.enabled) {
      issues.push('GPS Module is disabled');
      recommendations.push('Enable GPS Module in admin settings');
    }
    
    if ((this.config.module.currentErrorCount || 0) > 0) {
      issues.push(`${this.config.module.currentErrorCount} recent errors`);
      recommendations.push('Check GPS Module logs for error details');
    }
    
    if (this.config.module.healthStatus === 'critical') {
      issues.push('Module health status is critical');
      recommendations.push('Review error logs and restart if necessary');
    }

    return {
      enabled: this.config.module.enabled,
      healthy: this.config.module.healthStatus === 'healthy',
      status: this.config.module.healthStatus || 'unknown',
      lastCheck: this.config.module.lastHealthCheck || null,
      errorCount: this.config.module.currentErrorCount || 0,
      issues,
      recommendations
    };
  }

  /**
   * Ensure configuration is loaded and fresh
   */
  private async ensureConfigLoaded(): Promise<void> {
    const now = new Date();
    const needsRefresh = !this.lastConfigLoad || 
      (now.getTime() - this.lastConfigLoad.getTime()) > this.CONFIG_CACHE_TTL;

    if (!this.config || needsRefresh) {
      await this.loadConfiguration();
    }
  }

  /**
   * Load configuration from database
   */
  private async loadConfiguration(): Promise<void> {
    const client = await getClient();
    
    try {
      const result = await client.query(
        'SELECT config_data FROM gps_module_config WHERE id = 1'
      );
      
      if (result.rows.length > 0) {
        const configData = result.rows[0].config_data;
        
        // Handle both JSON string and already parsed object
        if (typeof configData === 'string') {
          this.config = JSON.parse(configData);
        } else if (typeof configData === 'object' && configData !== null) {
          this.config = configData;
        } else {
          logger.warn('Invalid GPS config data type, using default', { 
            type: typeof configData, 
            value: configData 
          });
          this.config = this.getDefaultConfig();
        }
        
        this.lastConfigLoad = new Date();
      }
      
    } catch (error) {
      logger.warn('Could not load GPS Module configuration from database', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      client.release();
    }
  }

  /**
   * Save configuration to database
   */
  private async saveConfiguration(): Promise<void> {
    if (!this.config) return;

    const client = await getClient();
    
    try {
      await client.query(
        `INSERT INTO gps_module_config (id, config_data, updated_at)
         VALUES (1, $1, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET 
         config_data = $1, updated_at = CURRENT_TIMESTAMP`,
        [JSON.stringify(this.config)]
      );
      
      this.lastConfigLoad = new Date();
      
    } finally {
      client.release();
    }
  }

  /**
   * Create configuration table if it doesn't exist
   */
  private async createConfigTable(): Promise<void> {
    const client = await getClient();
    
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS gps_module_config (
          id INTEGER PRIMARY KEY,
          config_data JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
    } finally {
      client.release();
    }
  }

  /**
   * Create default configuration
   */
  private async createDefaultConfiguration(): Promise<void> {
    this.config = this.getDefaultConfig();
    await this.saveConfiguration();
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): GPSModuleConfig {
    return {
      module: {
        enabled: false, // Disabled by default for safety
        autoDisableOnError: true,
        maxErrorsBeforeDisable: 10,
        currentErrorCount: 0,
        healthStatus: 'healthy'
      },
      features: {
        locationTracking: true,
        realTimeTracking: true,
        backgroundTracking: false, // Disabled for privacy
        locationHistory: true,
        locationAnalytics: false
      },
      performance: {
        maxLocationsPerUser: 10000,
        locationRetentionDays: 30,
        batchProcessingSize: 50,
        cacheLocationData: true,
        throttleRequestsPerMinute: 100
      },
      security: {
        requiresPermission: true,
        encryptLocationData: false, // Could be enabled later
        anonymizeAfterDays: 90,
        restrictToAdmins: false
      },
      monitoring: {
        trackPerformanceMetrics: true,
        alertOnErrors: true,
        logDetailedActivity: false, // Disabled for performance
        generateReports: false
      }
    };
  }
}

// Export singleton instance
export const gpsModuleConfig = GPSModuleConfigService.getInstance();
export default gpsModuleConfig;