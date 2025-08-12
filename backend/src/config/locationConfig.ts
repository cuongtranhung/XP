// Location service configuration
export const LOCATION_CONFIG = {
  // Validation limits
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

  // Default values
  DEFAULTS: {
    TRACKING_INTERVAL: 60, // seconds
    TRACKING_INTERVAL_MIN: 10,
    TRACKING_INTERVAL_MAX: 3600,
    MAX_TRACKING_DURATION: 28800, // 8 hours
    MAX_TRACKING_DURATION_MIN: 300, // 5 minutes
    MAX_TRACKING_DURATION_MAX: 86400, // 24 hours
    HIGH_ACCURACY: false,
    BACKGROUND_TRACKING: false
  },

  // Performance limits
  LIMITS: {
    MAX_HISTORY_RECORDS: 10000,
    DEFAULT_HISTORY_LIMIT: 100,
    MAX_BATCH_SIZE: 50,
    CONNECTION_POOL_SIZE: 10,
    QUERY_TIMEOUT: 30000 // ms
  },

  // Caching configuration
  CACHE: {
    PREFERENCES_TTL: 3600, // 1 hour (extended for geospatial)
    HISTORY_TTL: 86400, // 24 hours (extended for location history)
    SESSION_TTL: 1800, // 30 minutes
    GEOSPATIAL_TTL: 7200, // 2 hours for geospatial data
    CLUSTER_TTL: 14400, // 4 hours for location clusters
    ENABLE_CACHE: process.env.ENABLE_CACHE === 'true' || true
  },

  // Rate limiting
  RATE_LIMITS: {
    RECORD_LOCATION: {
      WINDOW_MS: 60 * 1000, // 1 minute
      MAX_REQUESTS: 100
    },
    GET_HISTORY: {
      WINDOW_MS: 60 * 1000, // 1 minute
      MAX_REQUESTS: 30
    },
    SESSION_MANAGEMENT: {
      WINDOW_MS: 60 * 1000, // 1 minute
      MAX_REQUESTS: 10
    }
  },

  // Data retention
  RETENTION: {
    DEFAULT_DAYS: 30,
    MAX_DAYS: 365,
    CLEANUP_INTERVAL: 24 * 60 * 60 * 1000 // 24 hours
  },

  // Monitoring
  MONITORING: {
    ENABLE_METRICS: true,
    SLOW_QUERY_THRESHOLD: 1000, // ms
    ERROR_THRESHOLD: 0.05 // 5% error rate
  },

  // Geospatial configuration
  GEOSPATIAL: {
    DEFAULT_RADIUS: 5, // km
    MAX_RADIUS: 100, // km
    DEFAULT_LIMIT: 50,
    MAX_LIMIT: 500,
    MIN_ACCURACY: 100, // meters
    CLUSTERING: {
      MIN_POINTS: 2,
      MAX_DISTANCE: 10000, // meters
      DEFAULT_MIN_POINTS: 3,
      DEFAULT_MAX_DISTANCE: 200 // meters
    }
  }
};

// Environment-specific overrides
if (process.env.NODE_ENV === 'development') {
  LOCATION_CONFIG.CACHE.ENABLE_CACHE = false;
  LOCATION_CONFIG.MONITORING.ENABLE_METRICS = false;
}

export default LOCATION_CONFIG;