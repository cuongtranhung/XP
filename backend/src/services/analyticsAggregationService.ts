/**
 * Analytics Aggregation Service
 * Collects, processes, and aggregates system metrics and user analytics
 */

import { EventEmitter } from 'events';
import * as schedule from 'node-cron';
import { Pool } from 'pg';
import redisClient from '../config/redis';
import logger from '../utils/logger';

// Types
export interface AnalyticsEvent {
  eventId: string;
  eventType: 'page_view' | 'user_action' | 'api_call' | 'file_operation' | 
            'search_query' | 'notification_sent' | 'error_occurred' | 'login' | 'logout';
  userId?: string;
  sessionId?: string;
  timestamp: Date;
  properties: Record<string, any>;
  context: {
    userAgent?: string;
    ipAddress?: string;
    referer?: string;
    device?: string;
    browser?: string;
    os?: string;
  };
}

export interface MetricData {
  metricName: string;
  value: number;
  timestamp: Date;
  tags: Record<string, string>;
  unit?: 'count' | 'bytes' | 'milliseconds' | 'percentage' | 'rate';
}

export interface AggregatedMetric {
  metricName: string;
  timeframe: 'hour' | 'day' | 'week' | 'month';
  period: Date;
  value: number;
  count: number;
  min: number;
  max: number;
  avg: number;
  sum: number;
  tags: Record<string, string>;
}

export interface UserAnalytics {
  userId: string;
  period: Date;
  pageViews: number;
  uniqueSessions: number;
  totalSessions: number;
  avgSessionDuration: number;
  bounceRate: number;
  actionsCount: number;
  lastActiveAt: Date;
  firstSeenAt: Date;
  deviceInfo: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
  browserInfo: Record<string, number>;
  topPages: Array<{ page: string; count: number }>;
}

export interface SystemAnalytics {
  period: Date;
  timeframe: 'hour' | 'day' | 'week' | 'month';
  users: {
    total: number;
    active: number;
    new: number;
    returning: number;
  };
  sessions: {
    total: number;
    avgDuration: number;
    bounceRate: number;
  };
  pageViews: {
    total: number;
    unique: number;
    avgPerSession: number;
  };
  api: {
    totalRequests: number;
    avgResponseTime: number;
    errorRate: number;
    topEndpoints: Array<{ endpoint: string; count: number; avgTime: number }>;
  };
  files: {
    totalUploads: number;
    totalSize: number;
    avgSize: number;
    topTypes: Array<{ type: string; count: number; size: number }>;
  };
  search: {
    totalQueries: number;
    avgResults: number;
    topQueries: Array<{ query: string; count: number; avgResults: number }>;
  };
  notifications: {
    totalSent: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    byChannel: Record<string, { sent: number; delivered: number; opened: number }>;
  };
}

export interface RealTimeMetrics {
  timestamp: Date;
  activeUsers: number;
  activeSessions: number;
  currentPageViews: number;
  apiRequestsPerMinute: number;
  errorRate: number;
  avgResponseTime: number;
  systemLoad: {
    cpu: number;
    memory: number;
    disk: number;
  };
  queueSizes: {
    notifications: number;
    files: number;
    search: number;
    images: number;
  };
}

export interface AnalyticsQuery {
  metrics: string[];
  timeframe: 'hour' | 'day' | 'week' | 'month';
  startDate: Date;
  endDate: Date;
  groupBy?: string[];
  filters?: Record<string, any>;
  limit?: number;
}

class AnalyticsAggregationService extends EventEmitter {
  private pool: Pool;
  private aggregationJobs: Map<string, schedule.ScheduledTask> = new Map();
  private realtimeMetrics: RealTimeMetrics;
  private isInitialized: boolean = false;
  private eventBuffer: AnalyticsEvent[] = [];
  private bufferFlushInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    this.realtimeMetrics = {
      timestamp: new Date(),
      activeUsers: 0,
      activeSessions: 0,
      currentPageViews: 0,
      apiRequestsPerMinute: 0,
      errorRate: 0,
      avgResponseTime: 0,
      systemLoad: { cpu: 0, memory: 0, disk: 0 },
      queueSizes: { notifications: 0, files: 0, search: 0, images: 0 }
    };
  }

  /**
   * Initialize analytics service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Create database tables
      await this.createTables();
      
      // Setup aggregation jobs
      await this.setupAggregationJobs();
      
      // Start event buffer flushing
      this.startEventBuffering();
      
      // Initialize real-time metrics
      await this.initializeRealTimeMetrics();
      
      this.isInitialized = true;
      logger.info('Analytics aggregation service initialized');
    } catch (error) {
      logger.error('Failed to initialize analytics aggregation service:', error);
      throw error;
    }
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    const queries = [
      `
        CREATE TABLE IF NOT EXISTS analytics_events (
          event_id VARCHAR(255) PRIMARY KEY,
          event_type VARCHAR(50) NOT NULL,
          user_id VARCHAR(255),
          session_id VARCHAR(255),
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          properties JSONB,
          context JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
        CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id);
        CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp);
        CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events(session_id);
      `,
      `
        CREATE TABLE IF NOT EXISTS metrics_raw (
          metric_id BIGSERIAL PRIMARY KEY,
          metric_name VARCHAR(255) NOT NULL,
          value NUMERIC NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          tags JSONB,
          unit VARCHAR(50)
        );
        
        CREATE INDEX IF NOT EXISTS idx_metrics_raw_name ON metrics_raw(metric_name);
        CREATE INDEX IF NOT EXISTS idx_metrics_raw_timestamp ON metrics_raw(timestamp);
        CREATE INDEX IF NOT EXISTS idx_metrics_raw_tags ON metrics_raw USING GIN(tags);
      `,
      `
        CREATE TABLE IF NOT EXISTS metrics_aggregated (
          aggregation_id BIGSERIAL PRIMARY KEY,
          metric_name VARCHAR(255) NOT NULL,
          timeframe VARCHAR(20) NOT NULL,
          period TIMESTAMP NOT NULL,
          value NUMERIC NOT NULL,
          count INTEGER NOT NULL,
          min_value NUMERIC NOT NULL,
          max_value NUMERIC NOT NULL,
          avg_value NUMERIC NOT NULL,
          sum_value NUMERIC NOT NULL,
          tags JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(metric_name, timeframe, period, tags)
        );
        
        CREATE INDEX IF NOT EXISTS idx_metrics_agg_name_time ON metrics_aggregated(metric_name, timeframe);
        CREATE INDEX IF NOT EXISTS idx_metrics_agg_period ON metrics_aggregated(period);
      `,
      `
        CREATE TABLE IF NOT EXISTS user_analytics (
          user_id VARCHAR(255),
          period DATE,
          timeframe VARCHAR(20) DEFAULT 'day',
          page_views INTEGER DEFAULT 0,
          unique_sessions INTEGER DEFAULT 0,
          total_sessions INTEGER DEFAULT 0,
          avg_session_duration NUMERIC DEFAULT 0,
          bounce_rate NUMERIC DEFAULT 0,
          actions_count INTEGER DEFAULT 0,
          last_active_at TIMESTAMP,
          first_seen_at TIMESTAMP,
          device_info JSONB,
          browser_info JSONB,
          top_pages JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY(user_id, period, timeframe)
        );
        
        CREATE INDEX IF NOT EXISTS idx_user_analytics_period ON user_analytics(period);
        CREATE INDEX IF NOT EXISTS idx_user_analytics_active ON user_analytics(last_active_at);
      `,
      `
        CREATE TABLE IF NOT EXISTS system_analytics (
          period TIMESTAMP,
          timeframe VARCHAR(20),
          users_data JSONB,
          sessions_data JSONB,
          pageviews_data JSONB,
          api_data JSONB,
          files_data JSONB,
          search_data JSONB,
          notifications_data JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY(period, timeframe)
        );
        
        CREATE INDEX IF NOT EXISTS idx_system_analytics_period ON system_analytics(period);
      `,
      `
        CREATE TABLE IF NOT EXISTS realtime_metrics (
          timestamp TIMESTAMP PRIMARY KEY,
          active_users INTEGER DEFAULT 0,
          active_sessions INTEGER DEFAULT 0,
          current_pageviews INTEGER DEFAULT 0,
          api_requests_per_minute NUMERIC DEFAULT 0,
          error_rate NUMERIC DEFAULT 0,
          avg_response_time NUMERIC DEFAULT 0,
          system_load JSONB,
          queue_sizes JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `
    ];

    for (const query of queries) {
      await this.pool.query(query);
    }
  }

  /**
   * Track analytics event
   */
  async trackEvent(event: Omit<AnalyticsEvent, 'eventId' | 'timestamp'>): Promise<void> {
    try {
      const analyticsEvent: AnalyticsEvent = {
        ...event,
        eventId: this.generateEventId(),
        timestamp: new Date()
      };

      // Add to buffer for batch processing
      this.eventBuffer.push(analyticsEvent);

      // Also track real-time metrics
      await this.updateRealTimeMetrics(analyticsEvent);

      this.emit('eventTracked', analyticsEvent);
    } catch (error) {
      logger.error('Failed to track event:', error);
    }
  }

  /**
   * Record metric value
   */
  async recordMetric(metric: Omit<MetricData, 'timestamp'>): Promise<void> {
    try {
      const metricData: MetricData = {
        ...metric,
        timestamp: new Date()
      };

      // Save to raw metrics table
      await this.pool.query(
        `INSERT INTO metrics_raw (metric_name, value, timestamp, tags, unit)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          metricData.metricName,
          metricData.value,
          metricData.timestamp,
          JSON.stringify(metricData.tags),
          metricData.unit
        ]
      );

      // Cache in Redis for real-time access
      const cacheKey = `metric:${metricData.metricName}:latest`;
      await redisClient.setex(cacheKey, 300, JSON.stringify(metricData));

      this.emit('metricRecorded', metricData);
    } catch (error) {
      logger.error('Failed to record metric:', error);
    }
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(
    userId: string,
    timeframe: 'day' | 'week' | 'month' = 'day',
    startDate: Date,
    endDate: Date
  ): Promise<UserAnalytics[]> {
    try {
      const query = `
        SELECT * FROM user_analytics
        WHERE user_id = $1 
        AND timeframe = $2
        AND period >= $3 
        AND period <= $4
        ORDER BY period ASC
      `;

      const result = await this.pool.query(query, [userId, timeframe, startDate, endDate]);
      
      return result.rows.map(this.mapRowToUserAnalytics);
    } catch (error) {
      logger.error('Failed to get user analytics:', error);
      return [];
    }
  }

  /**
   * Get system analytics
   */
  async getSystemAnalytics(
    timeframe: 'hour' | 'day' | 'week' | 'month' = 'day',
    startDate: Date,
    endDate: Date
  ): Promise<SystemAnalytics[]> {
    try {
      const query = `
        SELECT * FROM system_analytics
        WHERE timeframe = $1
        AND period >= $2 
        AND period <= $3
        ORDER BY period ASC
      `;

      const result = await this.pool.query(query, [timeframe, startDate, endDate]);
      
      return result.rows.map(this.mapRowToSystemAnalytics);
    } catch (error) {
      logger.error('Failed to get system analytics:', error);
      return [];
    }
  }

  /**
   * Get aggregated metrics
   */
  async getAggregatedMetrics(query: AnalyticsQuery): Promise<AggregatedMetric[]> {
    try {
      let sqlQuery = `
        SELECT 
          metric_name,
          timeframe,
          period,
          value,
          count,
          min_value as min,
          max_value as max,
          avg_value as avg,
          sum_value as sum,
          tags
        FROM metrics_aggregated
        WHERE timeframe = $1
        AND period >= $2 
        AND period <= $3
      `;

      const params: any[] = [query.timeframe, query.startDate, query.endDate];
      let paramIndex = 4;

      // Add metric name filter
      if (query.metrics.length > 0) {
        sqlQuery += ` AND metric_name = ANY($${paramIndex})`;
        params.push(query.metrics);
        paramIndex++;
      }

      // Add filters
      if (query.filters) {
        for (const [key, value] of Object.entries(query.filters)) {
          sqlQuery += ` AND tags->>'${key}' = $${paramIndex}`;
          params.push(value);
          paramIndex++;
        }
      }

      sqlQuery += ` ORDER BY period ASC`;

      if (query.limit) {
        sqlQuery += ` LIMIT $${paramIndex}`;
        params.push(query.limit);
      }

      const result = await this.pool.query(sqlQuery, params);
      
      return result.rows.map(row => ({
        metricName: row.metric_name,
        timeframe: row.timeframe,
        period: row.period,
        value: parseFloat(row.value),
        count: row.count,
        min: parseFloat(row.min),
        max: parseFloat(row.max),
        avg: parseFloat(row.avg),
        sum: parseFloat(row.sum),
        tags: row.tags || {}
      }));
    } catch (error) {
      logger.error('Failed to get aggregated metrics:', error);
      return [];
    }
  }

  /**
   * Get real-time metrics
   */
  getRealTimeMetrics(): RealTimeMetrics {
    return { ...this.realtimeMetrics };
  }

  /**
   * Get dashboard overview
   */
  async getDashboardOverview(): Promise<{
    users: { total: number; active24h: number; new24h: number };
    sessions: { total24h: number; avgDuration: number; bounceRate: number };
    pageViews: { total24h: number; unique24h: number };
    api: { requests24h: number; avgResponse: number; errorRate: number };
    files: { uploaded24h: number; totalSize: string };
    realtime: RealTimeMetrics;
  }> {
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [userStats, sessionStats, pageViewStats, apiStats, fileStats] = await Promise.all([
        this.pool.query(`
          SELECT 
            COUNT(DISTINCT user_id) as total_users,
            COUNT(DISTINCT CASE WHEN timestamp >= $1 THEN user_id END) as active_24h,
            COUNT(DISTINCT CASE WHEN timestamp >= $1 AND event_type = 'login' THEN user_id END) as new_24h
          FROM analytics_events
          WHERE timestamp >= $2
        `, [yesterday, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)]),
        
        this.pool.query(`
          SELECT 
            COUNT(DISTINCT session_id) as total_sessions,
            AVG(EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp)))) as avg_duration,
            COUNT(DISTINCT CASE WHEN event_count = 1 THEN session_id END)::float / COUNT(DISTINCT session_id) as bounce_rate
          FROM (
            SELECT 
              session_id,
              COUNT(*) as event_count,
              MIN(timestamp) as start_time,
              MAX(timestamp) as end_time
            FROM analytics_events
            WHERE timestamp >= $1 AND session_id IS NOT NULL
            GROUP BY session_id
          ) sessions
        `, [yesterday]),
        
        this.pool.query(`
          SELECT 
            COUNT(*) as total_pageviews,
            COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN session_id END) as unique_pageviews
          FROM analytics_events
          WHERE timestamp >= $1 AND event_type = 'page_view'
        `, [yesterday]),
        
        this.pool.query(`
          SELECT 
            COUNT(*) as total_requests,
            AVG(CASE WHEN properties->>'responseTime' IS NOT NULL 
                THEN (properties->>'responseTime')::numeric ELSE NULL END) as avg_response,
            COUNT(*) FILTER (WHERE event_type = 'error_occurred')::float / COUNT(*) as error_rate
          FROM analytics_events
          WHERE timestamp >= $1 AND event_type IN ('api_call', 'error_occurred')
        `, [yesterday]),
        
        this.pool.query(`
          SELECT 
            COUNT(*) as files_uploaded,
            SUM((properties->>'fileSize')::bigint) as total_size
          FROM analytics_events
          WHERE timestamp >= $1 AND event_type = 'file_operation' 
          AND properties->>'action' = 'upload'
        `, [yesterday])
      ]);

      return {
        users: {
          total: parseInt(userStats.rows[0].total_users || '0'),
          active24h: parseInt(userStats.rows[0].active_24h || '0'),
          new24h: parseInt(userStats.rows[0].new_24h || '0')
        },
        sessions: {
          total24h: parseInt(sessionStats.rows[0].total_sessions || '0'),
          avgDuration: Math.round(parseFloat(sessionStats.rows[0].avg_duration || '0')),
          bounceRate: Math.round((parseFloat(sessionStats.rows[0].bounce_rate || '0')) * 100)
        },
        pageViews: {
          total24h: parseInt(pageViewStats.rows[0].total_pageviews || '0'),
          unique24h: parseInt(pageViewStats.rows[0].unique_pageviews || '0')
        },
        api: {
          requests24h: parseInt(apiStats.rows[0].total_requests || '0'),
          avgResponse: Math.round(parseFloat(apiStats.rows[0].avg_response || '0')),
          errorRate: Math.round((parseFloat(apiStats.rows[0].error_rate || '0')) * 100)
        },
        files: {
          uploaded24h: parseInt(fileStats.rows[0].files_uploaded || '0'),
          totalSize: this.formatBytes(parseInt(fileStats.rows[0].total_size || '0'))
        },
        realtime: this.getRealTimeMetrics()
      };
    } catch (error) {
      logger.error('Failed to get dashboard overview:', error);
      throw error;
    }
  }

  /**
   * Setup aggregation jobs
   */
  private async setupAggregationJobs(): Promise<void> {
    // Hourly aggregation - every hour at minute 0
    const hourlyJob = schedule.schedule('0 * * * *', async () => {
      await this.runHourlyAggregation();
    });
    this.aggregationJobs.set('hourly', hourlyJob);

    // Daily aggregation - every day at 1:00 AM
    const dailyJob = schedule.schedule('0 1 * * *', async () => {
      await this.runDailyAggregation();
    });
    this.aggregationJobs.set('daily', dailyJob);

    // Weekly aggregation - every Monday at 2:00 AM
    const weeklyJob = schedule.schedule('0 2 * * 1', async () => {
      await this.runWeeklyAggregation();
    });
    this.aggregationJobs.set('weekly', weeklyJob);

    // Monthly aggregation - first day of month at 3:00 AM
    const monthlyJob = schedule.schedule('0 3 1 * *', async () => {
      await this.runMonthlyAggregation();
    });
    this.aggregationJobs.set('monthly', monthlyJob);

    // Real-time metrics update - every minute
    const realtimeJob = schedule.schedule('* * * * *', async () => {
      await this.updateRealTimeMetricsFromDB();
    });
    this.aggregationJobs.set('realtime', realtimeJob);

    // Start all jobs
    for (const [name, job] of this.aggregationJobs) {
      job.start();
      logger.info(`Started ${name} aggregation job`);
    }
  }

  /**
   * Start event buffering
   */
  private startEventBuffering(): void {
    // Flush event buffer every 30 seconds
    this.bufferFlushInterval = setInterval(async () => {
      await this.flushEventBuffer();
    }, 30000);
  }

  /**
   * Flush event buffer to database
   */
  private async flushEventBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    try {
      const events = [...this.eventBuffer];
      this.eventBuffer = [];

      // Batch insert events
      const values = events.map(event => [
        event.eventId,
        event.eventType,
        event.userId,
        event.sessionId,
        event.timestamp,
        JSON.stringify(event.properties),
        JSON.stringify(event.context)
      ]);

      const query = `
        INSERT INTO analytics_events (
          event_id, event_type, user_id, session_id, timestamp, properties, context
        ) VALUES ${values.map((_, i) => `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`).join(', ')}
      `;

      await this.pool.query(query, values.flat());
      
      logger.info(`Flushed ${events.length} events to database`);
    } catch (error) {
      logger.error('Failed to flush event buffer:', error);
    }
  }

  /**
   * Run hourly aggregation
   */
  private async runHourlyAggregation(): Promise<void> {
    try {
      const now = new Date();
      const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - 1);
      const hourEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());

      await this.aggregateMetrics('hour', hourStart, hourEnd);
      await this.aggregateUserAnalytics('hour', hourStart);
      await this.aggregateSystemAnalytics('hour', hourStart, hourEnd);

      logger.info(`Completed hourly aggregation for ${hourStart.toISOString()}`);
    } catch (error) {
      logger.error('Hourly aggregation failed:', error);
    }
  }

  /**
   * Run daily aggregation
   */
  private async runDailyAggregation(): Promise<void> {
    try {
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      await this.aggregateMetrics('day', dayStart, dayEnd);
      await this.aggregateUserAnalytics('day', dayStart);
      await this.aggregateSystemAnalytics('day', dayStart, dayEnd);

      logger.info(`Completed daily aggregation for ${dayStart.toISOString()}`);
    } catch (error) {
      logger.error('Daily aggregation failed:', error);
    }
  }

  /**
   * Run weekly aggregation
   */
  private async runWeeklyAggregation(): Promise<void> {
    try {
      const now = new Date();
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      await this.aggregateMetrics('week', weekStart, weekEnd);
      await this.aggregateSystemAnalytics('week', weekStart, weekEnd);

      logger.info(`Completed weekly aggregation for ${weekStart.toISOString()}`);
    } catch (error) {
      logger.error('Weekly aggregation failed:', error);
    }
  }

  /**
   * Run monthly aggregation
   */
  private async runMonthlyAggregation(): Promise<void> {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

      await this.aggregateMetrics('month', monthStart, monthEnd);
      await this.aggregateSystemAnalytics('month', monthStart, monthEnd);

      logger.info(`Completed monthly aggregation for ${monthStart.toISOString()}`);
    } catch (error) {
      logger.error('Monthly aggregation failed:', error);
    }
  }

  /**
   * Aggregate metrics
   */
  private async aggregateMetrics(
    timeframe: 'hour' | 'day' | 'week' | 'month',
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    const query = `
      INSERT INTO metrics_aggregated (
        metric_name, timeframe, period, value, count, min_value, max_value, avg_value, sum_value, tags
      )
      SELECT 
        metric_name,
        $1 as timeframe,
        $2 as period,
        AVG(value) as value,
        COUNT(*) as count,
        MIN(value) as min_value,
        MAX(value) as max_value,
        AVG(value) as avg_value,
        SUM(value) as sum_value,
        tags
      FROM metrics_raw
      WHERE timestamp >= $3 AND timestamp < $4
      GROUP BY metric_name, tags
      ON CONFLICT (metric_name, timeframe, period, tags) DO UPDATE SET
        value = EXCLUDED.value,
        count = EXCLUDED.count,
        min_value = EXCLUDED.min_value,
        max_value = EXCLUDED.max_value,
        avg_value = EXCLUDED.avg_value,
        sum_value = EXCLUDED.sum_value
    `;

    await this.pool.query(query, [timeframe, startDate, startDate, endDate]);
  }

  /**
   * Aggregate user analytics
   */
  private async aggregateUserAnalytics(
    timeframe: 'hour' | 'day',
    period: Date
  ): Promise<void> {
    if (timeframe !== 'day') return; // Only daily user analytics for now

    const nextDay = new Date(period.getTime() + 24 * 60 * 60 * 1000);

    const query = `
      INSERT INTO user_analytics (
        user_id, period, timeframe, page_views, unique_sessions, total_sessions,
        avg_session_duration, bounce_rate, actions_count, last_active_at, first_seen_at,
        device_info, browser_info, top_pages
      )
      SELECT 
        user_id,
        $1::date as period,
        'day' as timeframe,
        COUNT(*) FILTER (WHERE event_type = 'page_view') as page_views,
        COUNT(DISTINCT session_id) as unique_sessions,
        COUNT(DISTINCT session_id) as total_sessions,
        0 as avg_session_duration, -- Calculate separately
        0 as bounce_rate, -- Calculate separately
        COUNT(*) FILTER (WHERE event_type = 'user_action') as actions_count,
        MAX(timestamp) as last_active_at,
        MIN(timestamp) as first_seen_at,
        '{}' as device_info, -- Aggregate separately
        '{}' as browser_info, -- Aggregate separately
        '[]' as top_pages -- Aggregate separately
      FROM analytics_events
      WHERE timestamp >= $1 AND timestamp < $2 AND user_id IS NOT NULL
      GROUP BY user_id
      ON CONFLICT (user_id, period, timeframe) DO UPDATE SET
        page_views = EXCLUDED.page_views,
        unique_sessions = EXCLUDED.unique_sessions,
        total_sessions = EXCLUDED.total_sessions,
        actions_count = EXCLUDED.actions_count,
        last_active_at = EXCLUDED.last_active_at,
        updated_at = CURRENT_TIMESTAMP
    `;

    await this.pool.query(query, [period, nextDay]);
  }

  /**
   * Aggregate system analytics
   */
  private async aggregateSystemAnalytics(
    timeframe: 'hour' | 'day' | 'week' | 'month',
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    // Get various system metrics
    const [userStats, sessionStats, pageViewStats, apiStats] = await Promise.all([
      this.pool.query(`
        SELECT 
          COUNT(DISTINCT user_id) as total_users,
          COUNT(DISTINCT CASE WHEN timestamp >= $1 - INTERVAL '1 ${timeframe}' THEN user_id END) as returning_users,
          COUNT(DISTINCT CASE WHEN event_type = 'login' THEN user_id END) as new_users
        FROM analytics_events
        WHERE timestamp >= $1 AND timestamp < $2
      `, [startDate, endDate]),
      
      this.pool.query(`
        SELECT 
          COUNT(DISTINCT session_id) as total_sessions,
          AVG(session_duration) as avg_duration,
          COUNT(*) FILTER (WHERE session_duration <= 30)::float / COUNT(*) as bounce_rate
        FROM (
          SELECT 
            session_id,
            EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) as session_duration
          FROM analytics_events
          WHERE timestamp >= $1 AND timestamp < $2 AND session_id IS NOT NULL
          GROUP BY session_id
        ) sessions
      `, [startDate, endDate]),
      
      this.pool.query(`
        SELECT 
          COUNT(*) as total_pageviews,
          COUNT(DISTINCT session_id) as unique_pageviews
        FROM analytics_events
        WHERE timestamp >= $1 AND timestamp < $2 AND event_type = 'page_view'
      `, [startDate, endDate]),
      
      this.pool.query(`
        SELECT 
          COUNT(*) as total_requests,
          AVG((properties->>'responseTime')::numeric) as avg_response_time,
          COUNT(*) FILTER (WHERE event_type = 'error_occurred')::float / COUNT(*) as error_rate
        FROM analytics_events
        WHERE timestamp >= $1 AND timestamp < $2 
        AND event_type IN ('api_call', 'error_occurred')
      `, [startDate, endDate])
    ]);

    const systemAnalytics: SystemAnalytics = {
      period: startDate,
      timeframe,
      users: {
        total: parseInt(userStats.rows[0].total_users || '0'),
        active: parseInt(userStats.rows[0].total_users || '0'),
        new: parseInt(userStats.rows[0].new_users || '0'),
        returning: parseInt(userStats.rows[0].returning_users || '0')
      },
      sessions: {
        total: parseInt(sessionStats.rows[0].total_sessions || '0'),
        avgDuration: Math.round(parseFloat(sessionStats.rows[0].avg_duration || '0')),
        bounceRate: parseFloat(sessionStats.rows[0].bounce_rate || '0')
      },
      pageViews: {
        total: parseInt(pageViewStats.rows[0].total_pageviews || '0'),
        unique: parseInt(pageViewStats.rows[0].unique_pageviews || '0'),
        avgPerSession: sessionStats.rows[0].total_sessions > 0 
          ? Math.round(parseInt(pageViewStats.rows[0].total_pageviews || '0') / parseInt(sessionStats.rows[0].total_sessions))
          : 0
      },
      api: {
        totalRequests: parseInt(apiStats.rows[0].total_requests || '0'),
        avgResponseTime: Math.round(parseFloat(apiStats.rows[0].avg_response_time || '0')),
        errorRate: parseFloat(apiStats.rows[0].error_rate || '0'),
        topEndpoints: [] // Would need separate query
      },
      files: {
        totalUploads: 0,
        totalSize: 0,
        avgSize: 0,
        topTypes: []
      },
      search: {
        totalQueries: 0,
        avgResults: 0,
        topQueries: []
      },
      notifications: {
        totalSent: 0,
        deliveryRate: 0,
        openRate: 0,
        clickRate: 0,
        byChannel: {}
      }
    };

    // Save to database
    await this.pool.query(`
      INSERT INTO system_analytics (
        period, timeframe, users_data, sessions_data, pageviews_data, 
        api_data, files_data, search_data, notifications_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (period, timeframe) DO UPDATE SET
        users_data = EXCLUDED.users_data,
        sessions_data = EXCLUDED.sessions_data,
        pageviews_data = EXCLUDED.pageviews_data,
        api_data = EXCLUDED.api_data,
        files_data = EXCLUDED.files_data,
        search_data = EXCLUDED.search_data,
        notifications_data = EXCLUDED.notifications_data
    `, [
      startDate,
      timeframe,
      JSON.stringify(systemAnalytics.users),
      JSON.stringify(systemAnalytics.sessions),
      JSON.stringify(systemAnalytics.pageViews),
      JSON.stringify(systemAnalytics.api),
      JSON.stringify(systemAnalytics.files),
      JSON.stringify(systemAnalytics.search),
      JSON.stringify(systemAnalytics.notifications)
    ]);
  }

  /**
   * Update real-time metrics
   */
  private async updateRealTimeMetrics(event: AnalyticsEvent): Promise<void> {
    try {
      // Update based on event type
      switch (event.eventType) {
        case 'page_view':
          this.realtimeMetrics.currentPageViews++;
          break;
        case 'api_call':
          this.realtimeMetrics.apiRequestsPerMinute++;
          if (event.properties.responseTime) {
            const currentAvg = this.realtimeMetrics.avgResponseTime;
            const newTime = event.properties.responseTime;
            this.realtimeMetrics.avgResponseTime = (currentAvg + newTime) / 2;
          }
          break;
        case 'error_occurred':
          // Update error rate
          break;
      }

      this.realtimeMetrics.timestamp = new Date();
      
      // Cache in Redis
      await redisClient.setex(
        'analytics:realtime',
        60,
        JSON.stringify(this.realtimeMetrics)
      );
    } catch (error) {
      logger.error('Failed to update real-time metrics:', error);
    }
  }

  /**
   * Update real-time metrics from database
   */
  private async updateRealTimeMetricsFromDB(): Promise<void> {
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

      const [activeUsers, activeSessions, apiRequests] = await Promise.all([
        this.pool.query(`
          SELECT COUNT(DISTINCT user_id) as count
          FROM analytics_events
          WHERE timestamp >= $1 AND user_id IS NOT NULL
        `, [fiveMinutesAgo]),
        
        this.pool.query(`
          SELECT COUNT(DISTINCT session_id) as count
          FROM analytics_events
          WHERE timestamp >= $1 AND session_id IS NOT NULL
        `, [fiveMinutesAgo]),
        
        this.pool.query(`
          SELECT COUNT(*) as count
          FROM analytics_events
          WHERE timestamp >= $1 AND event_type = 'api_call'
        `, [oneMinuteAgo])
      ]);

      this.realtimeMetrics = {
        ...this.realtimeMetrics,
        timestamp: now,
        activeUsers: parseInt(activeUsers.rows[0].count),
        activeSessions: parseInt(activeSessions.rows[0].count),
        apiRequestsPerMinute: parseInt(apiRequests.rows[0].count)
      };

      // Save to database every minute
      await this.pool.query(`
        INSERT INTO realtime_metrics (
          timestamp, active_users, active_sessions, current_pageviews,
          api_requests_per_minute, error_rate, avg_response_time,
          system_load, queue_sizes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (timestamp) DO UPDATE SET
          active_users = EXCLUDED.active_users,
          active_sessions = EXCLUDED.active_sessions,
          api_requests_per_minute = EXCLUDED.api_requests_per_minute
      `, [
        new Date(Math.floor(now.getTime() / 60000) * 60000), // Round to minute
        this.realtimeMetrics.activeUsers,
        this.realtimeMetrics.activeSessions,
        this.realtimeMetrics.currentPageViews,
        this.realtimeMetrics.apiRequestsPerMinute,
        this.realtimeMetrics.errorRate,
        this.realtimeMetrics.avgResponseTime,
        JSON.stringify(this.realtimeMetrics.systemLoad),
        JSON.stringify(this.realtimeMetrics.queueSizes)
      ]);
    } catch (error) {
      logger.error('Failed to update real-time metrics from DB:', error);
    }
  }

  /**
   * Initialize real-time metrics
   */
  private async initializeRealTimeMetrics(): Promise<void> {
    try {
      // Try to load from Redis first
      const cached = await redisClient.get('analytics:realtime');
      if (cached) {
        this.realtimeMetrics = JSON.parse(cached);
        return;
      }

      // Initialize with current data
      await this.updateRealTimeMetricsFromDB();
    } catch (error) {
      logger.error('Failed to initialize real-time metrics:', error);
    }
  }

  /**
   * Generate event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Map database rows to objects
   */
  private mapRowToUserAnalytics(row: any): UserAnalytics {
    return {
      userId: row.user_id,
      period: row.period,
      pageViews: row.page_views,
      uniqueSessions: row.unique_sessions,
      totalSessions: row.total_sessions,
      avgSessionDuration: parseFloat(row.avg_session_duration),
      bounceRate: parseFloat(row.bounce_rate),
      actionsCount: row.actions_count,
      lastActiveAt: row.last_active_at,
      firstSeenAt: row.first_seen_at,
      deviceInfo: row.device_info || { desktop: 0, mobile: 0, tablet: 0 },
      browserInfo: row.browser_info || {},
      topPages: row.top_pages || []
    };
  }

  private mapRowToSystemAnalytics(row: any): SystemAnalytics {
    return {
      period: row.period,
      timeframe: row.timeframe,
      users: row.users_data,
      sessions: row.sessions_data,
      pageViews: row.pageviews_data,
      api: row.api_data,
      files: row.files_data,
      search: row.search_data,
      notifications: row.notifications_data
    };
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Cleanup old data
   */
  async cleanupOldData(daysToKeep: number = 90): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    await Promise.all([
      this.pool.query('DELETE FROM analytics_events WHERE timestamp < $1', [cutoffDate]),
      this.pool.query('DELETE FROM metrics_raw WHERE timestamp < $1', [cutoffDate]),
      this.pool.query('DELETE FROM realtime_metrics WHERE timestamp < $1', [cutoffDate])
    ]);

    logger.info(`Cleaned up analytics data older than ${daysToKeep} days`);
  }
}

// Export singleton instance
const analyticsAggregationService = new AnalyticsAggregationService();
export default analyticsAggregationService;