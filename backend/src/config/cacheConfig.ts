/**
 * Cache Configuration - ISO/IEC 27001:2022 Compliant
 * Implements multi-layer caching with international standards
 */

import { RedisOptions } from 'ioredis';
import * as crypto from 'crypto';

// Cache layer definitions
export enum CacheLayer {
  EDGE = 'edge',
  APPLICATION = 'application', 
  DISTRIBUTED = 'distributed',
  DATABASE = 'database'
}

// Data classification for GDPR/CCPA compliance
export enum DataClassification {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted' // PII, location data
}

// Cache configuration interface
export interface CacheConfig {
  // Redis connection
  redis: RedisOptions & {
    cluster?: boolean;
    sentinels?: Array<{ host: string; port: number }>;
  };

  // Security settings (ISO 27001)
  security: {
    encryption: {
      enabled: boolean;
      algorithm: 'AES-256-GCM' | 'AES-256-CBC';
      keyRotationDays: number;
      kmsKeyId?: string; // AWS KMS or HashiCorp Vault
    };
    acl: {
      enabled: boolean;
      defaultPolicy: 'deny' | 'allow';
      rules: Array<{
        user: string;
        permissions: string[];
        keys: string[];
      }>;
    };
    tls: {
      enabled: boolean;
      cert?: string;
      key?: string;
      ca?: string;
      rejectUnauthorized: boolean;
    };
  };

  // Privacy settings (GDPR/CCPA)
  privacy: {
    personalDataTTL: number; // seconds
    anonymizationEnabled: boolean;
    consentRequired: boolean;
    rightToErasure: boolean;
    dataRetention: {
      [key in DataClassification]: number; // retention in seconds
    };
  };

  // Performance settings (W3C standards)
  performance: {
    maxMemory: string; // e.g., '2GB'
    evictionPolicy: 'noeviction' | 'allkeys-lru' | 'volatile-lru' | 'allkeys-lfu';
    compressionEnabled: boolean;
    compressionLevel: number; // 1-9
    connectionPoolSize: number;
    commandTimeout: number; // milliseconds
  };

  // Monitoring (OpenTelemetry)
  monitoring: {
    enabled: boolean;
    metricsInterval: number; // seconds
    tracingEnabled: boolean;
    slowLogThreshold: number; // milliseconds
    exporters: Array<'prometheus' | 'datadog' | 'newrelic'>;
  };

  // Cache patterns
  patterns: {
    cacheAside: boolean;
    writeThrough: boolean;
    writeBehind: boolean;
    refreshAhead: boolean;
  };
}

// Default configuration following best practices
export const defaultCacheConfig: CacheConfig = {
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB ?? '0'),
    cluster: process.env.REDIS_CLUSTER === 'true',
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    enableReadyCheck: true,
    enableOfflineQueue: true,
    connectTimeout: 10000,
    disconnectTimeout: 2000,
    commandTimeout: 5000,
    lazyConnect: true
  },

  security: {
    encryption: {
      enabled: true,
      algorithm: 'AES-256-GCM',
      keyRotationDays: 30,
      kmsKeyId: process.env.KMS_KEY_ID
    },
    acl: {
      enabled: true,
      defaultPolicy: 'deny',
      rules: [
        {
          user: 'app_reader',
          permissions: ['+get', '+mget', '+exists', '+ttl', '+scan'],
          keys: ['cache:*', 'session:*']
        },
        {
          user: 'app_writer',
          permissions: ['~*', '+@all', '-@dangerous', '-flushdb', '-flushall'],
          keys: ['*']
        },
        {
          user: 'gps_service',
          permissions: ['+@all', '-@dangerous'],
          keys: ['gps:*', 'location:*', 'tracking:*']
        }
      ]
    },
    tls: {
      enabled: process.env.REDIS_TLS === 'true',
      cert: process.env.REDIS_TLS_CERT,
      key: process.env.REDIS_TLS_KEY,
      ca: process.env.REDIS_TLS_CA,
      rejectUnauthorized: true
    }
  },

  privacy: {
    personalDataTTL: 3600, // 1 hour for PII
    anonymizationEnabled: true,
    consentRequired: true,
    rightToErasure: true,
    dataRetention: {
      [DataClassification.PUBLIC]: 86400, // 24 hours
      [DataClassification.INTERNAL]: 3600, // 1 hour
      [DataClassification.CONFIDENTIAL]: 1800, // 30 minutes
      [DataClassification.RESTRICTED]: 300 // 5 minutes for PII/location
    }
  },

  performance: {
    maxMemory: process.env.REDIS_MAX_MEMORY ?? '2GB',
    evictionPolicy: 'allkeys-lru',
    compressionEnabled: true,
    compressionLevel: 6,
    connectionPoolSize: parseInt(process.env.REDIS_POOL_SIZE ?? '10'),
    commandTimeout: 5000
  },

  monitoring: {
    enabled: true,
    metricsInterval: 60, // 1 minute
    tracingEnabled: true,
    slowLogThreshold: 10, // 10ms
    exporters: ['prometheus']
  },

  patterns: {
    cacheAside: true,
    writeThrough: false,
    writeBehind: false,
    refreshAhead: true
  }
};

// Cache key generators with security considerations
export class CacheKeyGenerator {
  private static readonly NAMESPACE_SEPARATOR = ':';
  private static readonly KEY_MAX_LENGTH = 512; // Redis key limit

  /**
   * Generate secure cache key with namespace
   * @param namespace - Cache namespace (e.g., 'user', 'gps', 'session')
   * @param identifier - Unique identifier
   * @param attributes - Additional attributes for key generation
   */
  static generate(
    namespace: string,
    identifier: string,
    attributes?: Record<string, unknown>
  ): string {
    // Validate inputs
    if (!namespace || !identifier) {
      throw new Error('Namespace and identifier are required');
    }

    // Build key components
    const components = [namespace, identifier];

    // Add sorted attributes for consistent keys
    if (attributes) {
      const sortedAttrs = Object.keys(attributes)
        .sort()
        .map(key => `${key}=${String(attributes[key])}`)
        .join('&');
      
      if (sortedAttrs) {
        components.push(this.hash(sortedAttrs));
      }
    }

    // Construct key
    const key = components.join(this.NAMESPACE_SEPARATOR);

    // Validate key length
    if (key.length > this.KEY_MAX_LENGTH) {
      // Hash the key if too long
      return `${namespace}${this.NAMESPACE_SEPARATOR}${this.hash(key)}`;
    }

    return key;
  }

  /**
   * Generate hash for cache key components
   */
  private static hash(input: string): string {
    return crypto
      .createHash('sha256')
      .update(input)
      .digest('hex')
      .substring(0, 16); // Use first 16 chars for brevity
  }

  /**
   * Generate cache key for GPS/location data with privacy considerations
   */
  static generateLocationKey(
    userId: string,
    sessionId: string,
    timestamp?: number
  ): string {
    // Anonymize user ID for privacy
    const anonymizedUserId = this.hash(userId);
    
    const attributes = {
      session: sessionId.substring(0, 8), // Partial session ID
      ...(timestamp && { ts: Math.floor(timestamp / 60000) }) // Round to minute
    };

    return this.generate('location', anonymizedUserId, attributes);
  }

  /**
   * Generate pattern for cache invalidation
   */
  static generatePattern(namespace: string, identifier?: string): string {
    if (identifier) {
      return `${namespace}${this.NAMESPACE_SEPARATOR}${identifier}*`;
    }
    return `${namespace}${this.NAMESPACE_SEPARATOR}*`;
  }
}

// Cache TTL calculator based on data classification
export class CacheTTLCalculator {
  /**
   * Calculate TTL based on data classification and custom rules
   */
  static calculate(
    classification: DataClassification,
    config: CacheConfig,
    customTTL?: number
  ): number {
    // Use custom TTL if provided and valid
    if (customTTL && customTTL > 0) {
      // Ensure custom TTL doesn't exceed retention policy
      const maxTTL = config.privacy.dataRetention[classification];
      return Math.min(customTTL, maxTTL);
    }

    // Use default TTL based on classification
    return config.privacy.dataRetention[classification];
  }

  /**
   * Calculate TTL for GPS/location data with privacy rules
   */
  static calculateLocationTTL(
    isAnonymized: boolean,
    hasConsent: boolean
  ): number {
    if (!hasConsent) {
      return 0; // Don't cache without consent
    }

    if (isAnonymized) {
      return 3600; // 1 hour for anonymized data
    }

    return 300; // 5 minutes for PII location data
  }
}

// Export cache configuration
export const cacheConfig = defaultCacheConfig;