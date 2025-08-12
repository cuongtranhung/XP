/**
 * Dynamic Form Builder Module Configuration
 */

import { z } from 'zod';

// Configuration schema
const configSchema = z.object({
  // Database
  database: z.object({
    schema: z.string().default('formbuilder'),
    poolSize: z.number().min(1).max(100).default(10),
  }),

  // File upload
  upload: z.object({
    directory: z.string().default('./uploads/forms'),
    maxFileSize: z.number().default(10 * 1024 * 1024), // 10MB
    allowedMimeTypes: z.array(z.string()).default([
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]),
    imageProcessing: z.object({
      thumbnailSize: z.number().default(200),
      quality: z.number().min(1).max(100).default(80),
    }),
  }),

  // WebSocket
  websocket: z.object({
    port: z.number().default(5001),
    pingInterval: z.number().default(30000), // 30 seconds
    pingTimeout: z.number().default(60000), // 60 seconds
    maxConnections: z.number().default(1000),
  }),

  // Webhooks
  webhooks: z.object({
    timeout: z.number().default(30000), // 30 seconds
    maxRetries: z.number().default(3),
    retryDelay: z.number().default(1000), // 1 second
    maxConcurrent: z.number().default(10),
  }),

  // Analytics
  analytics: z.object({
    enabled: z.boolean().default(true),
    retentionDays: z.number().default(365),
    aggregationInterval: z.number().default(3600000), // 1 hour
  }),

  // Security
  security: z.object({
    rateLimit: z.object({
      windowMs: z.number().default(60000), // 1 minute
      maxRequests: z.number().default(100),
      skipSuccessfulRequests: z.boolean().default(false),
    }),
    submission: z.object({
      requireAuth: z.boolean().default(false),
      captchaEnabled: z.boolean().default(false),
      honeypotEnabled: z.boolean().default(true),
    }),
    encryption: z.object({
      algorithm: z.string().default('aes-256-gcm'),
      keyRotationDays: z.number().default(90),
    }),
  }),

  // Performance
  performance: z.object({
    cache: z.object({
      enabled: z.boolean().default(process.env.ENABLE_CACHE !== 'false'),
      ttl: z.number().default(3600), // 1 hour
      maxSize: z.number().default(1000),
    }),
    pagination: z.object({
      defaultLimit: z.number().default(20),
      maxLimit: z.number().default(100),
    }),
  }),

  // Features
  features: z.object({
    collaboration: z.boolean().default(true),
    fileUpload: z.boolean().default(true),
    webhooks: z.boolean().default(true),
    analytics: z.boolean().default(true),
    versioning: z.boolean().default(true),
    export: z.boolean().default(true),
  }),

  // Monitoring
  monitoring: z.object({
    enabled: z.boolean().default(true),
    metrics: z.object({
      collectInterval: z.number().default(60000), // 1 minute
      endpoint: z.string().optional(),
    }),
    logging: z.object({
      level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
      maxFiles: z.number().default(30),
      maxSize: z.string().default('20m'),
    }),
  }),
});

// Type for the configuration
export type FormBuilderConfig = z.infer<typeof configSchema>;

// Default configuration
const defaultConfig: FormBuilderConfig = {
  database: {
    schema: 'formbuilder',
    poolSize: 10,
  },
  upload: {
    directory: process.env.UPLOAD_DIR ?? './uploads/forms',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE ?? '10485760'),
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    imageProcessing: {
      thumbnailSize: 200,
      quality: 80,
    },
  },
  websocket: {
    port: parseInt(process.env.WS_PORT ?? '5001'),
    pingInterval: 30000,
    pingTimeout: 60000,
    maxConnections: 1000,
  },
  webhooks: {
    timeout: parseInt(process.env.WEBHOOK_TIMEOUT ?? '30000'),
    maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES ?? '3'),
    retryDelay: 1000,
    maxConcurrent: 10,
  },
  analytics: {
    enabled: process.env.ANALYTICS_ENABLED !== 'false',
    retentionDays: 365,
    aggregationInterval: 3600000,
  },
  security: {
    rateLimit: {
      windowMs: 60000,
      maxRequests: 100,
      skipSuccessfulRequests: false,
    },
    submission: {
      requireAuth: false,
      captchaEnabled: false,
      honeypotEnabled: true,
    },
    encryption: {
      algorithm: 'aes-256-gcm',
      keyRotationDays: 90,
    },
  },
  performance: {
    cache: {
      enabled: process.env.ENABLE_CACHE !== 'false',
      ttl: parseInt(process.env.CACHE_TTL ?? '3600'),
      maxSize: 1000,
    },
    pagination: {
      defaultLimit: 20,
      maxLimit: 100,
    },
  },
  features: {
    collaboration: process.env.FEATURE_COLLABORATION !== 'false',
    fileUpload: process.env.FEATURE_FILE_UPLOAD !== 'false',
    webhooks: process.env.FEATURE_WEBHOOKS !== 'false',
    analytics: process.env.FEATURE_ANALYTICS !== 'false',
    versioning: process.env.FEATURE_VERSIONING !== 'false',
    export: process.env.FEATURE_EXPORT !== 'false',
  },
  monitoring: {
    enabled: process.env.MONITORING_ENABLED !== 'false',
    metrics: {
      collectInterval: 60000,
      endpoint: process.env.METRICS_ENDPOINT,
    },
    logging: {
      level: (process.env.LOG_LEVEL as any) || 'info',
      maxFiles: 30,
      maxSize: '20m',
    },
  },
};

// Configuration class
export class FormBuilderConfiguration {
  private config: FormBuilderConfig;

  constructor(customConfig?: Partial<FormBuilderConfig>) {
    // Merge with default config
    const mergedConfig = this.deepMerge(defaultConfig, customConfig || {});
    
    // Validate configuration
    const result = configSchema.safeParse(mergedConfig);
    if (!result.success) {
      throw new Error(`Invalid configuration: ${result.error.message}`);
    }

    this.config = result.data;
  }

  /**
   * Get the current configuration
   */
  get(): FormBuilderConfig {
    return this.config;
  }

  /**
   * Update configuration
   */
  update(updates: Partial<FormBuilderConfig>): void {
    const mergedConfig = this.deepMerge(this.config, updates);
    const result = configSchema.safeParse(mergedConfig);
    
    if (!result.success) {
      throw new Error(`Invalid configuration update: ${result.error.message}`);
    }

    this.config = result.data;
  }

  /**
   * Get a specific configuration value
   */
  getValue<K extends keyof FormBuilderConfig>(key: K): FormBuilderConfig[K] {
    return this.config[key];
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(feature: keyof FormBuilderConfig['features']): boolean {
    return this.config.features[feature];
  }

  /**
   * Deep merge objects
   */
  private deepMerge(target: any, source: any): any {
    const output = { ...target };
    
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    
    return output;
  }

  /**
   * Check if value is object
   */
  private isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * Validate file upload
   */
  validateFileUpload(file: { mimetype: string; size: number }): { valid: boolean; error?: string } {
    const config = this.config.upload;

    if (!config.allowedMimeTypes.includes(file.mimetype)) {
      return { valid: false, error: 'File type not allowed' };
    }

    if (file.size > config.maxFileSize) {
      return { valid: false, error: `File size exceeds limit of ${config.maxFileSize} bytes` };
    }

    return { valid: true };
  }

  /**
   * Get rate limit configuration for specific endpoint
   */
  getRateLimitConfig(endpoint: string): any {
    const baseConfig = this.config.security.rateLimit;

    // Custom limits for specific endpoints
    const customLimits: Record<string, any> = {
      '/api/forms/*/submit': {
        windowMs: 60000, // 1 minute
        maxRequests: 10, // More restrictive for submissions
      },
      '/api/forms/*/export': {
        windowMs: 300000, // 5 minutes
        maxRequests: 5, // Limit exports
      },
    };

    return customLimits[endpoint] || baseConfig;
  }
}

// Export singleton instance
export const formBuilderConfig = new FormBuilderConfiguration();

// Export configuration utilities
export const getConfig = () => formBuilderConfig.get();
export const updateConfig = (updates: Partial<FormBuilderConfig>) => formBuilderConfig.update(updates);
export const isFeatureEnabled = (feature: keyof FormBuilderConfig['features']) => 
  formBuilderConfig.isFeatureEnabled(feature);