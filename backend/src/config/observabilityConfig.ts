/**
 * Observability Configuration
 * 
 * Setup and initialization for Advanced Monitoring & Observability Platform
 */

import { observabilityPlatform } from '../services/observabilityPlatform';
import { logger } from '../utils/logger';

/**
 * Default alert conditions for system monitoring
 */
const DEFAULT_ALERT_CONDITIONS = [
  {
    name: 'High Memory Usage',
    description: 'System memory usage exceeds 85%',
    query: 'system.memory.heap_used',
    threshold: 85,
    operator: '>' as const,
    timeWindow: 5,
    severity: 'high' as const,
    channels: [
      {
        type: 'webhook' as const,
        config: { url: process.env.ALERT_WEBHOOK_URL ?? '' }
      }
    ]
  },
  {
    name: 'High Error Rate',
    description: 'HTTP error rate exceeds 5%',
    query: 'http.errors',
    threshold: 5,
    operator: '>' as const,
    timeWindow: 10,
    severity: 'critical' as const,
    channels: [
      {
        type: 'email' as const,
        config: { recipients: [process.env.ALERT_EMAIL ?? 'admin@example.com'] }
      }
    ]
  },
  {
    name: 'Slow Response Time',
    description: 'Average response time exceeds 2 seconds',
    query: 'http.response_time',
    threshold: 2000,
    operator: '>' as const,
    timeWindow: 15,
    severity: 'medium' as const,
    channels: [
      {
        type: 'webhook' as const,
        config: { url: process.env.ALERT_WEBHOOK_URL ?? '' }
      }
    ]
  },
  {
    name: 'Circuit Breaker Open',
    description: 'Database circuit breaker is open',
    query: 'database.circuit_breaker',
    threshold: 1,
    operator: '>=' as const,
    timeWindow: 1,
    severity: 'critical' as const,
    channels: [
      {
        type: 'email' as const,
        config: { recipients: [process.env.ALERT_EMAIL ?? 'admin@example.com'] }
      }
    ]
  },
  {
    name: 'High Database Connection Usage',
    description: 'Database connection pool usage exceeds 80%',
    query: 'database.pool_utilization',
    threshold: 80,
    operator: '>' as const,
    timeWindow: 5,
    severity: 'medium' as const,
    channels: [
      {
        type: 'webhook' as const,
        config: { url: process.env.ALERT_WEBHOOK_URL ?? '' }
      }
    ]
  }
];

/**
 * Default dashboard configuration
 */
const DEFAULT_DASHBOARD_CONFIG = {
  name: 'System Overview',
  description: 'Main system monitoring dashboard',
  widgets: [
    {
      id: 'system-metrics',
      type: 'line_chart' as const,
      title: 'System Metrics',
      query: 'system.memory.heap_used system.cpu.user',
      position: { x: 0, y: 0, width: 6, height: 4 },
      config: {
        yAxis: { label: 'Usage %' },
        xAxis: { label: 'Time' },
        legend: true
      }
    },
    {
      id: 'http-metrics',
      type: 'line_chart' as const,
      title: 'HTTP Request Metrics',
      query: 'http.response_time http.requests',
      position: { x: 6, y: 0, width: 6, height: 4 },
      config: {
        yAxis: { label: 'Response Time (ms)' },
        xAxis: { label: 'Time' },
        legend: true
      }
    },
    {
      id: 'database-metrics',
      type: 'gauge' as const,
      title: 'Database Performance',
      query: 'database.query_time',
      position: { x: 0, y: 4, width: 4, height: 3 },
      config: {
        min: 0,
        max: 1000,
        thresholds: [
          { value: 500, color: 'yellow' },
          { value: 800, color: 'red' }
        ]
      }
    },
    {
      id: 'error-rate',
      type: 'stat' as const,
      title: 'Error Rate',
      query: 'http.errors',
      position: { x: 4, y: 4, width: 4, height: 3 },
      config: {
        unit: '%',
        decimals: 2,
        thresholds: [
          { value: 1, color: 'yellow' },
          { value: 5, color: 'red' }
        ]
      }
    },
    {
      id: 'active-traces',
      type: 'table' as const,
      title: 'Recent Traces',
      query: 'traces.recent_errors',
      position: { x: 8, y: 4, width: 4, height: 3 },
      config: {
        columns: ['timestamp', 'operation', 'duration', 'status'],
        pageSize: 10
      }
    }
  ],
  timeRange: {
    from: new Date(Date.now() - 24 * 60 * 60 * 1000),
    to: new Date(),
    relative: 'last_24h'
  },
  refreshInterval: 30,
  permissions: []
};

/**
 * Initialize observability platform with default configuration
 */
export const initializeObservabilityPlatform = async (): Promise<void> => {
  try {
    logger.info('Initializing Advanced Monitoring & Observability Platform...');

    // Create default alert conditions
    logger.info('Setting up default alert conditions...');
    for (const condition of DEFAULT_ALERT_CONDITIONS) {
      try {
        const conditionId = await observabilityPlatform.createAlertCondition(condition);
        logger.debug('Created alert condition', { 
          conditionId, 
          name: condition.name,
          severity: condition.severity 
        });
      } catch (error) {
        logger.warn('Failed to create alert condition', {
          condition: condition.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Create default dashboard
    logger.info('Creating default system dashboard...');
    try {
      const dashboardId = await observabilityPlatform.createDashboard(DEFAULT_DASHBOARD_CONFIG);
      logger.info('Default dashboard created successfully', { dashboardId });
    } catch (error) {
      logger.warn('Failed to create default dashboard', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Record initialization metrics
    await observabilityPlatform.recordMetric({
      name: 'system.initialization',
      value: 1,
      unit: 'event',
      timestamp: new Date(),
      tags: {
        component: 'observability_platform',
        status: 'initialized'
      },
      type: 'counter'
    });

    // Start collecting baseline system metrics
    await collectBaselineMetrics();

    logger.info('✅ Advanced Monitoring & Observability Platform initialized successfully');

  } catch (error) {
    logger.error('❌ Failed to initialize observability platform', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
};

/**
 * Collect baseline system metrics on startup
 */
const collectBaselineMetrics = async (): Promise<void> => {
  try {
    const startupTime = Date.now();
    
    // Record startup metrics
    await observabilityPlatform.recordMetric({
      name: 'system.startup_time',
      value: process.uptime() * 1000,
      unit: 'ms',
      timestamp: new Date(),
      tags: {
        process: 'backend',
        environment: process.env.NODE_ENV ?? 'development'
      },
      type: 'gauge'
    });

    // Record initial resource usage
    const memUsage = process.memoryUsage();
    await observabilityPlatform.recordMetric({
      name: 'system.startup_memory',
      value: memUsage.heapUsed,
      unit: 'bytes',
      timestamp: new Date(),
      tags: {
        process: 'backend',
        type: 'heap_used'
      },
      type: 'gauge'
    });

    // Record Node.js version
    await observabilityPlatform.recordMetric({
      name: 'system.node_version',
      value: parseInt(process.version.replace('v', '').split('.')[0]),
      unit: 'version',
      timestamp: new Date(),
      tags: {
        full_version: process.version,
        platform: process.platform,
        arch: process.arch
      },
      type: 'gauge'
    });

    logger.debug('Baseline system metrics collected', {
      startup_time: process.uptime() * 1000,
      heap_used: memUsage.heapUsed,
      node_version: process.version
    });

  } catch (error) {
    logger.warn('Failed to collect baseline metrics', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Configuration for different environments
 */
export const observabilityConfig = {
  development: {
    enablePersistence: false,
    metricsRetentionHours: 24,
    tracesRetentionHours: 12,
    alertCooldownMinutes: 5,
    maxMetricsPerSeries: 1000,
    maxTraces: 10000
  },
  
  production: {
    enablePersistence: true,
    metricsRetentionHours: 168, // 7 days
    tracesRetentionHours: 72,   // 3 days
    alertCooldownMinutes: 15,
    maxMetricsPerSeries: 10000,
    maxTraces: 100000
  },
  
  test: {
    enablePersistence: false,
    metricsRetentionHours: 1,
    tracesRetentionHours: 1,
    alertCooldownMinutes: 1,
    maxMetricsPerSeries: 100,
    maxTraces: 1000
  }
};

/**
 * Get environment-specific configuration
 */
export const getObservabilityConfig = () => {
  const env = process.env.NODE_ENV ?? 'development';
  return observabilityConfig[env as keyof typeof observabilityConfig] || observabilityConfig.development;
};