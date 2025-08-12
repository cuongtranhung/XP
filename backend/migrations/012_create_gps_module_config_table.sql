-- Migration: Create GPS Module Configuration Table
-- Version: 012
-- Description: Create configuration table for GPS module enable/disable functionality

BEGIN;

-- Create GPS module configuration table
CREATE TABLE IF NOT EXISTS gps_module_config (
    id INTEGER PRIMARY KEY,
    config_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on updated_at for better performance
CREATE INDEX IF NOT EXISTS idx_gps_module_config_updated_at ON gps_module_config(updated_at);

-- Insert default configuration (disabled by default for safety)
INSERT INTO gps_module_config (id, config_data) VALUES (1, '{
  "module": {
    "enabled": false,
    "autoDisableOnError": true,
    "maxErrorsBeforeDisable": 10,
    "currentErrorCount": 0,
    "healthStatus": "healthy"
  },
  "features": {
    "locationTracking": true,
    "realTimeTracking": true,
    "backgroundTracking": false,
    "locationHistory": true,
    "locationAnalytics": false
  },
  "performance": {
    "maxLocationsPerUser": 10000,
    "locationRetentionDays": 30,
    "batchProcessingSize": 50,
    "cacheLocationData": true,
    "throttleRequestsPerMinute": 100
  },
  "security": {
    "requiresPermission": true,
    "encryptLocationData": false,
    "anonymizeAfterDays": 90,
    "restrictToAdmins": false
  },
  "monitoring": {
    "trackPerformanceMetrics": true,
    "alertOnErrors": true,
    "logDetailedActivity": false,
    "generateReports": false
  }
}') ON CONFLICT (id) DO NOTHING;

COMMIT;