// Monitoring Configuration
// Centralized configuration for all monitoring services

export interface MonitoringConfig {
  sentry: {
    dsn: string;
    environment: string;
    tracesSampleRate: number;
    profilesSampleRate: number;
    integrations: string[];
  };
  logrocket: {
    appId: string;
    enabled: boolean;
    network: {
      requestSanitizer: boolean;
      responseSanitizer: boolean;
    };
  };
  performance: {
    enableWebVitals: boolean;
    enableUserTiming: boolean;
    enableNavigationTiming: boolean;
    sampleRate: number;
  };
  errorTracking: {
    enableConsoleCapture: boolean;
    enableUnhandledRejection: boolean;
    enableWindowError: boolean;
    maxBreadcrumbs: number;
  };
}

// Environment-based configuration (Vite compatible)
const isDevelopment = import.meta.env.MODE === 'development';
const isProduction = import.meta.env.PROD;

export const monitoringConfig: MonitoringConfig = {
  sentry: {
    dsn: import.meta.env.VITE_SENTRY_DSN || '',
    environment: import.meta.env.MODE || 'development',
    tracesSampleRate: isDevelopment ? 1.0 : 0.1, // 100% in dev, 10% in prod
    profilesSampleRate: isDevelopment ? 1.0 : 0.1,
    integrations: [
      'BrowserTracing',
      'React',
      'HttpContext',
      'ReportingObserver'
    ]
  },
  
  logrocket: {
    appId: import.meta.env.VITE_LOGROCKET_APP_ID || '',
    enabled: isProduction, // Only enable in production
    network: {
      requestSanitizer: true,
      responseSanitizer: true
    }
  },
  
  performance: {
    enableWebVitals: true,
    enableUserTiming: true,
    enableNavigationTiming: true,
    sampleRate: isDevelopment ? 1.0 : 0.2 // 100% in dev, 20% in prod
  },
  
  errorTracking: {
    enableConsoleCapture: true,
    enableUnhandledRejection: true,
    enableWindowError: true,
    maxBreadcrumbs: 50
  }
};

// Feature flags for monitoring
export const monitoringFeatures = {
  SENTRY_ENABLED: Boolean(monitoringConfig.sentry.dsn),
  LOGROCKET_ENABLED: Boolean(monitoringConfig.logrocket.appId && monitoringConfig.logrocket.enabled),
  PERFORMANCE_MONITORING_ENABLED: isProduction || isDevelopment,
  ERROR_BOUNDARY_ENABLED: true,
  SESSION_RECORDING_ENABLED: isProduction,
  REAL_USER_MONITORING: isProduction
};

// Sanitization rules for sensitive data
export const dataSanitization = {
  // Fields to exclude from error reports
  sensitiveFields: [
    'password',
    'token',
    'api_key',
    'secret',
    'authorization',
    'credit_card',
    'ssn',
    'email' // Only in production
  ],
  
  // URL patterns to exclude from tracking
  excludeUrls: [
    /localhost/,
    /127\.0\.0\.1/,
    /chrome-extension/,
    /moz-extension/
  ],
  
  // Error messages to ignore
  ignoreErrors: [
    'Network Error',
    'ChunkLoadError',
    'Loading chunk',
    'Non-Error promise rejection captured'
  ]
};

export default monitoringConfig;