import { EventEmitter } from 'events';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { AnalyticsAggregationService } from './analyticsAggregationService';
import { CustomMetricsService } from './customMetricsService';
import { pool } from '../config/database';

// Types and interfaces
export interface RealTimeMetric {
  metricId: string;
  name: string;
  value: number;
  previousValue?: number;
  change?: number;
  changePercent?: number;
  timestamp: Date;
  unit?: string;
  formatType?: 'number' | 'percentage' | 'currency' | 'bytes' | 'duration';
  trend?: 'up' | 'down' | 'stable';
}

export interface LiveEvent {
  eventId: string;
  type: string;
  userId?: string;
  sessionId?: string;
  data: Record<string, any>;
  timestamp: Date;
  metadata?: {
    ip?: string;
    userAgent?: string;
    location?: string;
    device?: string;
    browser?: string;
  };
}

export interface AlertEvent {
  alertId: string;
  metricId: string;
  metricName: string;
  currentValue: number;
  threshold: number;
  condition: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
}

export interface DashboardSubscription {
  socketId: string;
  userId: string;
  dashboardId?: string;
  metrics: string[];
  lastUpdate: Date;
}

export interface StreamingConfig {
  batchSize: number;
  flushInterval: number; // milliseconds
  retentionPeriod: number; // seconds
  enableCompression: boolean;
  maxConnections: number;
  rateLimitPerSecond: number;
}

export interface ActiveSession {
  sessionId: string;
  userId: string;
  startTime: Date;
  lastActivity: Date;
  pageViews: number;
  events: number;
  device?: string;
  browser?: string;
  location?: string;
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    load: number[];
  };
  database: {
    connections: number;
    activeQueries: number;
    slowQueries: number;
  };
  redis: {
    connected: boolean;
    memory: number;
    clients: number;
  };
  api: {
    requestsPerSecond: number;
    averageResponseTime: number;
    errorRate: number;
  };
}

/**
 * Real-time Analytics Service
 * 
 * Provides real-time data streaming, live metrics updates, and instant
 * notifications for the analytics dashboard. Handles WebSocket connections,
 * Redis streams, and live event processing.
 * 
 * Features:
 * - Real-time metric streaming via WebSocket
 * - Live event tracking and processing
 * - Dashboard subscriptions and updates
 * - System health monitoring
 * - Active session tracking
 * - Alert notifications
 * - Performance optimization with batching
 * - Auto-scaling connection management
 */
export class RealTimeAnalyticsService extends EventEmitter {
  private redis: Redis;
  private io: Server;
  private analyticsService: AnalyticsAggregationService;
  private customMetricsService: CustomMetricsService;
  private subscriptions: Map<string, DashboardSubscription> = new Map();
  private activeSessions: Map<string, ActiveSession> = new Map();
  private eventBuffer: LiveEvent[] = [];
  private metricsBuffer: RealTimeMetric[] = [];
  private isProcessing = false;
  private config: StreamingConfig;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(
    io: Server,
    redis: Redis,
    analyticsService: AnalyticsAggregationService,
    customMetricsService: CustomMetricsService,
    config: Partial<StreamingConfig> = {}
  ) {
    super();

    this.io = io;
    this.redis = redis;
    this.analyticsService = analyticsService;
    this.customMetricsService = customMetricsService;

    // Default configuration
    this.config = {
      batchSize: 100,
      flushInterval: 2000, // 2 seconds
      retentionPeriod: 3600, // 1 hour
      enableCompression: true,
      maxConnections: 1000,
      rateLimitPerSecond: 100,
      ...config
    };

    this.initializeSocketHandlers();
    this.startPeriodicTasks();
  }

  /**
   * Initialize WebSocket connection handlers
   */
  private initializeSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      logger.info(`New analytics connection: ${socket.id}`);

      // Handle dashboard subscription
      socket.on('subscribe_dashboard', async (data) => {
        try {
          const { userId, dashboardId, metrics } = data;
          
          const subscription: DashboardSubscription = {
            socketId: socket.id,
            userId,
            dashboardId,
            metrics: metrics || [],
            lastUpdate: new Date()
          };

          this.subscriptions.set(socket.id, subscription);
          
          // Send initial data
          const initialData = await this.getInitialDashboardData(dashboardId, metrics);
          socket.emit('dashboard_data', initialData);

          logger.info(`Dashboard subscribed: ${socket.id} for user ${userId}`);
        } catch (error) {
          logger.error('Dashboard subscription error:', error);
          socket.emit('error', { message: 'Subscription failed' });
        }
      });

      // Handle metric subscription
      socket.on('subscribe_metrics', async (data) => {
        try {
          const { metricIds } = data;
          const currentData = await this.getCurrentMetricsData(metricIds);
          socket.emit('metrics_data', currentData);
        } catch (error) {
          logger.error('Metrics subscription error:', error);
        }
      });

      // Handle real-time events
      socket.on('track_event', (eventData) => {
        this.trackEvent(eventData);
      });

      // Handle session updates
      socket.on('session_update', (sessionData) => {
        this.updateActiveSession(sessionData);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.subscriptions.delete(socket.id);
        logger.info(`Analytics connection closed: ${socket.id}`);
      });
    });
  }

  /**
   * Start periodic background tasks
   */
  private startPeriodicTasks(): void {
    // Flush buffers periodically
    this.flushInterval = setInterval(() => {
      this.flushBuffers();
    }, this.config.flushInterval);

    // Health check every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000);

    // Clean up old data every hour
    setInterval(() => {
      this.cleanupOldData();
    }, 3600000);
  }

  /**
   * Track real-time events
   */
  async trackEvent(eventData: Partial<LiveEvent>): Promise<void> {
    try {
      const event: LiveEvent = {
        eventId: this.generateEventId(),
        type: eventData.type || 'custom',
        userId: eventData.userId,
        sessionId: eventData.sessionId,
        data: eventData.data || {},
        timestamp: new Date(),
        metadata: eventData.metadata
      };

      // Add to buffer
      this.eventBuffer.push(event);

      // Store in Redis for real-time access
      await this.redis.zadd(
        'live_events',
        Date.now(),
        JSON.stringify(event)
      );

      // Emit to subscribers
      this.io.emit('live_event', event);

      // Update relevant metrics
      await this.updateRealTimeMetrics(event);

      // Process if buffer is full
      if (this.eventBuffer.length >= this.config.batchSize) {
        await this.flushBuffers();
      }

    } catch (error) {
      logger.error('Event tracking error:', error);
    }
  }

  /**
   * Update active session data
   */
  async updateActiveSession(sessionData: Partial<ActiveSession>): Promise<void> {
    try {
      const sessionId = sessionData.sessionId;
      if (!sessionId) return;

      const existingSession = this.activeSessions.get(sessionId);
      
      const session: ActiveSession = {
        sessionId,
        userId: sessionData.userId || existingSession?.userId || '',
        startTime: existingSession?.startTime || new Date(),
        lastActivity: new Date(),
        pageViews: existingSession?.pageViews || 0,
        events: (existingSession?.events || 0) + 1,
        device: sessionData.device || existingSession?.device,
        browser: sessionData.browser || existingSession?.browser,
        location: sessionData.location || existingSession?.location
      };

      this.activeSessions.set(sessionId, session);

      // Store in Redis with TTL
      await this.redis.setex(
        `session:${sessionId}`,
        1800, // 30 minutes
        JSON.stringify(session)
      );

      // Broadcast active sessions count
      const activeCount = this.activeSessions.size;
      this.io.emit('active_sessions', { count: activeCount });

    } catch (error) {
      logger.error('Session update error:', error);
    }
  }

  /**
   * Get real-time metrics for dashboard
   */
  async getRealTimeMetrics(metricIds: string[]): Promise<RealTimeMetric[]> {
    try {
      const metrics: RealTimeMetric[] = [];

      for (const metricId of metricIds) {
        const cachedValue = await this.redis.get(`metric:${metricId}`);
        
        if (cachedValue) {
          const metric = JSON.parse(cachedValue);
          metrics.push(metric);
        } else {
          // Fetch from database if not cached
          const metric = await this.fetchMetricFromDB(metricId);
          if (metric) {
            metrics.push(metric);
            // Cache for future requests
            await this.redis.setex(
              `metric:${metricId}`,
              300, // 5 minutes
              JSON.stringify(metric)
            );
          }
        }
      }

      return metrics;

    } catch (error) {
      logger.error('Get real-time metrics error:', error);
      return [];
    }
  }

  /**
   * Get live events stream
   */
  async getLiveEvents(limit: number = 50): Promise<LiveEvent[]> {
    try {
      const events = await this.redis.zrevrange(
        'live_events',
        0,
        limit - 1
      );

      return events.map(event => JSON.parse(event));

    } catch (error) {
      logger.error('Get live events error:', error);
      return [];
    }
  }

  /**
   * Get active sessions
   */
  async getActiveSessions(): Promise<ActiveSession[]> {
    try {
      const sessions: ActiveSession[] = [];
      const keys = await this.redis.keys('session:*');

      for (const key of keys) {
        const sessionData = await this.redis.get(key);
        if (sessionData) {
          sessions.push(JSON.parse(sessionData));
        }
      }

      return sessions.sort((a, b) => 
        b.lastActivity.getTime() - a.lastActivity.getTime()
      );

    } catch (error) {
      logger.error('Get active sessions error:', error);
      return [];
    }
  }

  /**
   * Get system health metrics
   */
  async getSystemHealth(): Promise<SystemHealth> {
    try {
      const memUsage = process.memoryUsage();
      const uptime = process.uptime();
      
      // Get database stats
      const dbResult = await pool.query(`
        SELECT 
          numbackends as connections,
          xact_commit + xact_rollback as active_queries
        FROM pg_stat_database 
        WHERE datname = current_database()
      `);

      // Get Redis stats
      const redisInfo = await this.redis.info('memory');
      const redisClients = await this.redis.client('list');

      const health: SystemHealth = {
        status: 'healthy',
        uptime,
        memory: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
        },
        cpu: {
          usage: 0, // Would need additional monitoring
          load: [] // Would need additional monitoring
        },
        database: {
          connections: dbResult.rows[0]?.connections || 0,
          activeQueries: dbResult.rows[0]?.active_queries || 0,
          slowQueries: 0 // Would need query log analysis
        },
        redis: {
          connected: this.redis.status === 'ready',
          memory: this.parseRedisMemory(redisInfo),
          clients: redisClients.length
        },
        api: {
          requestsPerSecond: await this.getAPIMetrics('rps'),
          averageResponseTime: await this.getAPIMetrics('avg_response'),
          errorRate: await this.getAPIMetrics('error_rate')
        }
      };

      // Determine overall health status
      if (health.memory.percentage > 90 || health.api.errorRate > 5) {
        health.status = 'critical';
      } else if (health.memory.percentage > 75 || health.api.errorRate > 2) {
        health.status = 'warning';
      }

      return health;

    } catch (error) {
      logger.error('System health check error:', error);
      return {
        status: 'critical',
        uptime: 0,
        memory: { used: 0, total: 0, percentage: 0 },
        cpu: { usage: 0, load: [] },
        database: { connections: 0, activeQueries: 0, slowQueries: 0 },
        redis: { connected: false, memory: 0, clients: 0 },
        api: { requestsPerSecond: 0, averageResponseTime: 0, errorRate: 100 }
      };
    }
  }

  /**
   * Send alert notification
   */
  async sendAlert(alert: AlertEvent): Promise<void> {
    try {
      // Store alert in Redis
      await this.redis.zadd(
        'alerts',
        Date.now(),
        JSON.stringify(alert)
      );

      // Emit to all subscribers
      this.io.emit('alert', alert);

      // Log based on severity
      const logMessage = `Alert: ${alert.metricName} - ${alert.message}`;
      
      switch (alert.severity) {
        case 'critical':
          logger.error(logMessage);
          break;
        case 'high':
          logger.warn(logMessage);
          break;
        default:
          logger.info(logMessage);
      }

    } catch (error) {
      logger.error('Send alert error:', error);
    }
  }

  /**
   * Flush event and metrics buffers
   */
  private async flushBuffers(): Promise<void> {
    if (this.isProcessing) return;

    try {
      this.isProcessing = true;

      // Process events buffer
      if (this.eventBuffer.length > 0) {
        const events = [...this.eventBuffer];
        this.eventBuffer = [];
        
        await this.processEventsBatch(events);
      }

      // Process metrics buffer
      if (this.metricsBuffer.length > 0) {
        const metrics = [...this.metricsBuffer];
        this.metricsBuffer = [];
        
        await this.processMetricsBatch(metrics);
      }

    } catch (error) {
      logger.error('Buffer flush error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process events batch
   */
  private async processEventsBatch(events: LiveEvent[]): Promise<void> {
    try {
      // Insert events into database
      const values = events.map(event => 
        `('${event.eventId}', '${event.type}', ${event.userId ? `'${event.userId}'` : 'NULL'}, ${event.sessionId ? `'${event.sessionId}'` : 'NULL'}, '${JSON.stringify(event.data)}', '${event.timestamp.toISOString()}', ${event.metadata ? `'${JSON.stringify(event.metadata)}'` : 'NULL'})`
      ).join(', ');

      await pool.query(`
        INSERT INTO analytics_events (
          event_id, event_type, user_id, session_id, 
          event_data, created_at, metadata
        ) VALUES ${values}
        ON CONFLICT (event_id) DO NOTHING
      `);

    } catch (error) {
      logger.error('Process events batch error:', error);
    }
  }

  /**
   * Process metrics batch
   */
  private async processMetricsBatch(metrics: RealTimeMetric[]): Promise<void> {
    try {
      // Update metrics in Redis
      for (const metric of metrics) {
        await this.redis.setex(
          `metric:${metric.metricId}`,
          300, // 5 minutes
          JSON.stringify(metric)
        );
      }

      // Emit updated metrics to subscribers
      this.io.emit('metrics_update', metrics);

    } catch (error) {
      logger.error('Process metrics batch error:', error);
    }
  }

  /**
   * Update real-time metrics based on events
   */
  private async updateRealTimeMetrics(event: LiveEvent): Promise<void> {
    try {
      // Update basic metrics
      const now = new Date();
      const todayKey = now.toISOString().split('T')[0];

      // Page views
      if (event.type === 'page_view') {
        await this.redis.incr(`metric:page_views:${todayKey}`);
        await this.redis.incr('metric:page_views:total');
      }

      // Events count
      await this.redis.incr(`metric:events:${todayKey}`);
      await this.redis.incr('metric:events:total');

      // Active users (using HyperLogLog for unique counting)
      if (event.userId) {
        await this.redis.pfadd(`metric:active_users:${todayKey}`, event.userId);
      }

    } catch (error) {
      logger.error('Update real-time metrics error:', error);
    }
  }

  /**
   * Get initial dashboard data
   */
  private async getInitialDashboardData(dashboardId?: string, metrics: string[] = []): Promise<any> {
    try {
      const data: any = {};

      // Get basic analytics overview
      data.overview = await this.analyticsService.getDashboardOverview();

      // Get specific metrics if requested
      if (metrics.length > 0) {
        data.metrics = await this.getRealTimeMetrics(metrics);
      }

      // Get live events
      data.liveEvents = await this.getLiveEvents(20);

      // Get active sessions
      data.activeSessions = await this.getActiveSessions();

      // Get system health
      data.systemHealth = await this.getSystemHealth();

      return data;

    } catch (error) {
      logger.error('Get initial dashboard data error:', error);
      return {};
    }
  }

  /**
   * Get current metrics data
   */
  private async getCurrentMetricsData(metricIds: string[]): Promise<RealTimeMetric[]> {
    return await this.getRealTimeMetrics(metricIds);
  }

  /**
   * Fetch metric from database
   */
  private async fetchMetricFromDB(metricId: string): Promise<RealTimeMetric | null> {
    try {
      // This would integrate with your custom metrics service
      const customMetric = await this.customMetricsService.getMetric(metricId);
      if (!customMetric) return null;

      const currentValue = await this.customMetricsService.calculateMetricValue(metricId);
      
      return {
        metricId,
        name: customMetric.name,
        value: currentValue,
        timestamp: new Date(),
        unit: customMetric.unit,
        formatType: customMetric.displayConfig?.formatType
      };

    } catch (error) {
      logger.error('Fetch metric from DB error:', error);
      return null;
    }
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const health = await this.getSystemHealth();
      
      // Emit health status to all subscribers
      this.io.emit('system_health', health);

      // Check for critical issues
      if (health.status === 'critical') {
        await this.sendAlert({
          alertId: this.generateEventId(),
          metricId: 'system_health',
          metricName: 'System Health',
          currentValue: 0,
          threshold: 1,
          condition: 'system_critical',
          severity: 'critical',
          message: 'System is in critical state',
          timestamp: new Date()
        });
      }

    } catch (error) {
      logger.error('Health check error:', error);
    }
  }

  /**
   * Clean up old data
   */
  private async cleanupOldData(): Promise<void> {
    try {
      const cutoffTime = Date.now() - (this.config.retentionPeriod * 1000);

      // Clean up old events
      await this.redis.zremrangebyscore('live_events', 0, cutoffTime);

      // Clean up old alerts
      await this.redis.zremrangebyscore('alerts', 0, cutoffTime);

      // Clean up old sessions
      const sessionKeys = await this.redis.keys('session:*');
      for (const key of sessionKeys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -1) { // No expiration set
          await this.redis.expire(key, 1800); // Set 30 minutes TTL
        }
      }

      logger.info('Old data cleanup completed');

    } catch (error) {
      logger.error('Cleanup old data error:', error);
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Parse Redis memory usage from info string
   */
  private parseRedisMemory(info: string): number {
    const match = info.match(/used_memory:(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Get API metrics (placeholder - would integrate with API monitoring)
   */
  private async getAPIMetrics(type: string): Promise<number> {
    try {
      const key = `api_metrics:${type}`;
      const value = await this.redis.get(key);
      return value ? parseFloat(value) : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Shutdown service gracefully
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down real-time analytics service...');

      // Clear intervals
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      if (this.flushInterval) {
        clearInterval(this.flushInterval);
      }

      // Flush remaining buffers
      await this.flushBuffers();

      // Close connections
      this.subscriptions.clear();
      this.activeSessions.clear();

      logger.info('Real-time analytics service shut down complete');

    } catch (error) {
      logger.error('Shutdown error:', error);
    }
  }
}

export default RealTimeAnalyticsService;