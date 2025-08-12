/**
 * Custom Metrics Service
 * Flexible custom metrics definition, collection, and visualization system
 */

import { EventEmitter } from 'events';
import * as schedule from 'node-cron';
import { Pool } from 'pg';
import redisClient from '../config/redis';
import logger from '../utils/logger';
import analyticsAggregationService from './analyticsAggregationService';

// Types
export interface CustomMetric {
  metricId: string;
  name: string;
  displayName: string;
  description?: string;
  category: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary' | 'rate' | 'percentage';
  unit: string;
  source: MetricSource;
  aggregation: AggregationConfig;
  visualization: VisualizationConfig;
  alerts?: AlertConfig[];
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  tags: Record<string, string>;
}

export interface MetricSource {
  type: 'database' | 'api' | 'event' | 'formula' | 'external';
  config: DatabaseSource | APISource | EventSource | FormulaSource | ExternalSource;
}

export interface DatabaseSource {
  type: 'database';
  query: string;
  parameters?: Record<string, any>;
  refreshInterval: number; // seconds
  connectionId?: string;
}

export interface APISource {
  type: 'api';
  endpoint: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: Record<string, any>;
  responseParser: string; // JSONPath expression
  refreshInterval: number;
  timeout: number;
}

export interface EventSource {
  type: 'event';
  eventTypes: string[];
  filters?: Record<string, any>;
  aggregationFunction: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct';
  valueField?: string;
  timeWindow: number; // seconds
}

export interface FormulaSource {
  type: 'formula';
  formula: string; // Mathematical expression with metric references
  dependencies: string[]; // Other metric IDs
  refreshInterval: number;
}

export interface ExternalSource {
  type: 'external';
  provider: string; // 'prometheus', 'datadog', 'newrelic', etc.
  query: string;
  refreshInterval: number;
  credentials?: Record<string, any>;
}

export interface AggregationConfig {
  functions: ('sum' | 'avg' | 'min' | 'max' | 'count' | 'distinct')[];
  timeWindows: ('1m' | '5m' | '15m' | '1h' | '6h' | '24h' | '7d' | '30d')[];
  groupBy?: string[];
  filters?: Record<string, any>;
}

export interface VisualizationConfig {
  chartType: 'line' | 'bar' | 'area' | 'pie' | 'gauge' | 'number' | 'table' | 'heatmap';
  defaultTimeRange: '1h' | '6h' | '24h' | '7d' | '30d' | '90d';
  yAxisConfig?: {
    min?: number;
    max?: number;
    unit?: string;
    scale?: 'linear' | 'logarithmic';
  };
  colors?: string[];
  thresholds?: Array<{
    value: number;
    color: string;
    label?: string;
  }>;
  formatting?: {
    decimals?: number;
    prefix?: string;
    suffix?: string;
    humanize?: boolean;
  };
}

export interface AlertConfig {
  alertId: string;
  name: string;
  condition: AlertCondition;
  notification: NotificationConfig;
  isActive: boolean;
  cooldown: number; // seconds
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface AlertCondition {
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=' | 'range' | 'no_data';
  value: number | number[]; // array for range
  timeWindow: number; // seconds
  evaluationInterval: number; // seconds
  consecutiveBreaches?: number;
}

export interface NotificationConfig {
  channels: ('email' | 'slack' | 'webhook' | 'sms')[];
  recipients: string[];
  template?: string;
  webhookUrl?: string;
}

export interface MetricValue {
  metricId: string;
  timestamp: Date;
  value: number;
  tags?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface MetricDataPoint {
  timestamp: Date;
  value: number;
  aggregation?: string;
  tags?: Record<string, string>;
}

export interface MetricSeries {
  metricId: string;
  name: string;
  unit: string;
  data: MetricDataPoint[];
  aggregation: string;
  timeRange: {
    start: Date;
    end: Date;
  };
}

export interface Dashboard {
  dashboardId: string;
  name: string;
  description?: string;
  layout: DashboardLayout;
  widgets: DashboardWidget[];
  filters: DashboardFilter[];
  refreshInterval: number;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
}

export interface DashboardLayout {
  columns: number;
  rows: number;
  widgets: Array<{
    widgetId: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

export interface DashboardWidget {
  widgetId: string;
  title: string;
  type: 'metric' | 'chart' | 'table' | 'text' | 'iframe';
  config: WidgetConfig;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface WidgetConfig {
  metricIds?: string[];
  chartType?: string;
  timeRange?: string;
  aggregation?: string;
  groupBy?: string[];
  filters?: Record<string, any>;
  formatting?: Record<string, any>;
  customQuery?: string;
  textContent?: string;
  iframeUrl?: string;
}

export interface DashboardFilter {
  filterId: string;
  name: string;
  type: 'dropdown' | 'multiselect' | 'daterange' | 'text' | 'number';
  field: string;
  defaultValue?: any;
  options?: Array<{ label: string; value: any }>;
}

export interface MetricExecutionResult {
  metricId: string;
  success: boolean;
  value?: number;
  error?: string;
  executionTime: number;
  timestamp: Date;
}

class CustomMetricsService extends EventEmitter {
  private metrics: Map<string, CustomMetric> = new Map();
  private dashboards: Map<string, Dashboard> = new Map();
  private metricJobs: Map<string, schedule.ScheduledTask> = new Map();
  private alertStates: Map<string, any> = new Map();
  private pool: Pool;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  /**
   * Initialize custom metrics service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Create database tables
      await this.createTables();
      
      // Load existing metrics and dashboards
      await this.loadMetrics();
      await this.loadDashboards();
      
      // Setup metric collection jobs
      await this.setupMetricJobs();
      
      this.isInitialized = true;
      logger.info('Custom metrics service initialized');
    } catch (error) {
      logger.error('Failed to initialize custom metrics service:', error);
      throw error;
    }
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    const queries = [
      `
        CREATE TABLE IF NOT EXISTS custom_metrics (
          metric_id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          display_name VARCHAR(255) NOT NULL,
          description TEXT,
          category VARCHAR(100) NOT NULL,
          type VARCHAR(50) NOT NULL,
          unit VARCHAR(50) NOT NULL,
          source JSONB NOT NULL,
          aggregation JSONB NOT NULL,
          visualization JSONB NOT NULL,
          alerts JSONB,
          is_active BOOLEAN DEFAULT true,
          created_by VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          tags JSONB DEFAULT '{}'
        );
        
        CREATE INDEX IF NOT EXISTS idx_custom_metrics_category ON custom_metrics(category);
        CREATE INDEX IF NOT EXISTS idx_custom_metrics_type ON custom_metrics(type);
        CREATE INDEX IF NOT EXISTS idx_custom_metrics_active ON custom_metrics(is_active);
        CREATE INDEX IF NOT EXISTS idx_custom_metrics_tags ON custom_metrics USING GIN(tags);
      `,
      `
        CREATE TABLE IF NOT EXISTS metric_values (
          value_id BIGSERIAL PRIMARY KEY,
          metric_id VARCHAR(255) NOT NULL,
          timestamp TIMESTAMP NOT NULL,
          value NUMERIC NOT NULL,
          tags JSONB,
          metadata JSONB,
          FOREIGN KEY (metric_id) REFERENCES custom_metrics(metric_id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS idx_metric_values_metric_time ON metric_values(metric_id, timestamp);
        CREATE INDEX IF NOT EXISTS idx_metric_values_timestamp ON metric_values(timestamp);
        CREATE INDEX IF NOT EXISTS idx_metric_values_tags ON metric_values USING GIN(tags);
      `,
      `
        CREATE TABLE IF NOT EXISTS dashboards (
          dashboard_id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          layout JSONB NOT NULL,
          widgets JSONB NOT NULL,
          filters JSONB DEFAULT '[]',
          refresh_interval INTEGER DEFAULT 300,
          is_public BOOLEAN DEFAULT false,
          created_by VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          tags TEXT[] DEFAULT '{}'
        );
        
        CREATE INDEX IF NOT EXISTS idx_dashboards_created_by ON dashboards(created_by);
        CREATE INDEX IF NOT EXISTS idx_dashboards_public ON dashboards(is_public);
        CREATE INDEX IF NOT EXISTS idx_dashboards_tags ON dashboards USING GIN(tags);
      `,
      `
        CREATE TABLE IF NOT EXISTS metric_alerts (
          alert_id VARCHAR(255) PRIMARY KEY,
          metric_id VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          condition JSONB NOT NULL,
          notification JSONB NOT NULL,
          is_active BOOLEAN DEFAULT true,
          cooldown INTEGER DEFAULT 300,
          severity VARCHAR(20) DEFAULT 'warning',
          last_triggered TIMESTAMP,
          trigger_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (metric_id) REFERENCES custom_metrics(metric_id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS idx_metric_alerts_metric ON metric_alerts(metric_id);
        CREATE INDEX IF NOT EXISTS idx_metric_alerts_active ON metric_alerts(is_active);
      `,
      `
        CREATE TABLE IF NOT EXISTS metric_executions (
          execution_id BIGSERIAL PRIMARY KEY,
          metric_id VARCHAR(255) NOT NULL,
          success BOOLEAN NOT NULL,
          value NUMERIC,
          error_message TEXT,
          execution_time INTEGER NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (metric_id) REFERENCES custom_metrics(metric_id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS idx_metric_executions_metric ON metric_executions(metric_id);
        CREATE INDEX IF NOT EXISTS idx_metric_executions_timestamp ON metric_executions(timestamp);
      `
    ];

    for (const query of queries) {
      await this.pool.query(query);
    }
  }

  /**
   * Create custom metric
   */
  async createMetric(
    metricData: Omit<CustomMetric, 'metricId' | 'createdAt' | 'updatedAt'>
  ): Promise<CustomMetric> {
    try {
      const metricId = this.generateMetricId();
      const metric: CustomMetric = {
        ...metricData,
        metricId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Validate metric
      this.validateMetric(metric);

      // Save to database
      await this.saveMetric(metric);
      
      // Store in memory
      this.metrics.set(metricId, metric);
      
      // Setup collection job
      if (metric.isActive) {
        await this.setupMetricJob(metric);
      }

      this.emit('metricCreated', { metricId, name: metric.name });
      
      return metric;
    } catch (error) {
      logger.error('Failed to create metric:', error);
      throw error;
    }
  }

  /**
   * Update custom metric
   */
  async updateMetric(
    metricId: string,
    updates: Partial<Omit<CustomMetric, 'metricId' | 'createdAt' | 'createdBy'>>
  ): Promise<CustomMetric | null> {
    try {
      const existingMetric = this.metrics.get(metricId);
      if (!existingMetric) {
        throw new Error('Metric not found');
      }

      const updatedMetric: CustomMetric = {
        ...existingMetric,
        ...updates,
        updatedAt: new Date()
      };

      // Validate updated metric
      this.validateMetric(updatedMetric);

      // Update in database
      await this.updateMetricInDB(updatedMetric);
      
      // Update in memory
      this.metrics.set(metricId, updatedMetric);
      
      // Update collection job
      await this.updateMetricJob(updatedMetric);

      this.emit('metricUpdated', { metricId, name: updatedMetric.name });
      
      return updatedMetric;
    } catch (error) {
      logger.error('Failed to update metric:', error);
      throw error;
    }
  }

  /**
   * Delete custom metric
   */
  async deleteMetric(metricId: string): Promise<boolean> {
    try {
      const metric = this.metrics.get(metricId);
      if (!metric) {
        return false;
      }

      // Stop collection job
      const job = this.metricJobs.get(metricId);
      if (job) {
        job.stop();
        this.metricJobs.delete(metricId);
      }

      // Delete from database
      await this.pool.query(
        'DELETE FROM custom_metrics WHERE metric_id = $1',
        [metricId]
      );

      // Remove from memory
      this.metrics.delete(metricId);

      this.emit('metricDeleted', { metricId, name: metric.name });
      
      return true;
    } catch (error) {
      logger.error('Failed to delete metric:', error);
      return false;
    }
  }

  /**
   * Execute metric collection
   */
  async executeMetric(metricId: string): Promise<MetricExecutionResult> {
    const startTime = Date.now();
    
    try {
      const metric = this.metrics.get(metricId);
      if (!metric) {
        throw new Error('Metric not found');
      }

      let value: number;
      
      switch (metric.source.type) {
        case 'database':
          value = await this.executeDatabaseMetric(metric.source.config as DatabaseSource);
          break;
        case 'api':
          value = await this.executeAPIMetric(metric.source.config as APISource);
          break;
        case 'event':
          value = await this.executeEventMetric(metric.source.config as EventSource);
          break;
        case 'formula':
          value = await this.executeFormulaMetric(metric.source.config as FormulaSource);
          break;
        case 'external':
          value = await this.executeExternalMetric(metric.source.config as ExternalSource);
          break;
        default:
          throw new Error(`Unsupported metric source type: ${metric.source.type}`);
      }

      const executionTime = Date.now() - startTime;
      const timestamp = new Date();

      // Store metric value
      await this.storeMetricValue({
        metricId,
        timestamp,
        value,
        tags: metric.tags
      });

      // Record execution
      const result: MetricExecutionResult = {
        metricId,
        success: true,
        value,
        executionTime,
        timestamp
      };

      await this.recordExecution(result);

      // Check alerts
      await this.checkAlerts(metricId, value, timestamp);

      this.emit('metricExecuted', result);
      
      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const result: MetricExecutionResult = {
        metricId,
        success: false,
        error: error.message,
        executionTime,
        timestamp: new Date()
      };

      await this.recordExecution(result);
      
      logger.error(`Metric execution failed for ${metricId}:`, error);
      
      return result;
    }
  }

  /**
   * Get metric data
   */
  async getMetricData(
    metricId: string,
    startTime: Date,
    endTime: Date,
    aggregation: string = 'avg',
    granularity: string = '5m'
  ): Promise<MetricSeries | null> {
    try {
      const metric = this.metrics.get(metricId);
      if (!metric) {
        return null;
      }

      // Calculate time bucket size
      const bucketSize = this.parseDuration(granularity);
      
      const query = `
        SELECT 
          date_trunc('${this.getDurationUnit(granularity)}', timestamp) as bucket,
          ${this.getAggregationFunction(aggregation)}(value) as value
        FROM metric_values
        WHERE metric_id = $1 
        AND timestamp >= $2 
        AND timestamp <= $3
        GROUP BY bucket
        ORDER BY bucket ASC
      `;

      const result = await this.pool.query(query, [metricId, startTime, endTime]);
      
      const data: MetricDataPoint[] = result.rows.map(row => ({
        timestamp: row.bucket,
        value: parseFloat(row.value),
        aggregation
      }));

      return {
        metricId,
        name: metric.name,
        unit: metric.unit,
        data,
        aggregation,
        timeRange: { start: startTime, end: endTime }
      };
    } catch (error) {
      logger.error('Failed to get metric data:', error);
      return null;
    }
  }

  /**
   * Create dashboard
   */
  async createDashboard(
    dashboardData: Omit<Dashboard, 'dashboardId' | 'createdAt' | 'updatedAt'>
  ): Promise<Dashboard> {
    try {
      const dashboardId = this.generateDashboardId();
      const dashboard: Dashboard = {
        ...dashboardData,
        dashboardId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to database
      await this.saveDashboard(dashboard);
      
      // Store in memory
      this.dashboards.set(dashboardId, dashboard);

      this.emit('dashboardCreated', { dashboardId, name: dashboard.name });
      
      return dashboard;
    } catch (error) {
      logger.error('Failed to create dashboard:', error);
      throw error;
    }
  }

  /**
   * Get dashboard data
   */
  async getDashboardData(
    dashboardId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<{
    dashboard: Dashboard;
    data: Record<string, MetricSeries>;
  } | null> {
    try {
      const dashboard = this.dashboards.get(dashboardId);
      if (!dashboard) {
        return null;
      }

      const data: Record<string, MetricSeries> = {};
      
      // Get data for all metrics used in widgets
      const metricIds = new Set<string>();
      for (const widget of dashboard.widgets) {
        if (widget.config.metricIds) {
          widget.config.metricIds.forEach(id => metricIds.add(id));
        }
      }

      const defaultTimeRange = timeRange || this.getDefaultTimeRange('24h');
      
      for (const metricId of metricIds) {
        const metricData = await this.getMetricData(
          metricId,
          defaultTimeRange.start,
          defaultTimeRange.end
        );
        
        if (metricData) {
          data[metricId] = metricData;
        }
      }

      return { dashboard, data };
    } catch (error) {
      logger.error('Failed to get dashboard data:', error);
      return null;
    }
  }

  /**
   * Execute database metric
   */
  private async executeDatabaseMetric(source: DatabaseSource): Promise<number> {
    try {
      const result = await this.pool.query(source.query, Object.values(source.parameters || {}));
      
      if (result.rows.length === 0) {
        throw new Error('No data returned from query');
      }

      // Return first column of first row
      const value = Object.values(result.rows[0])[0];
      return parseFloat(value as string);
    } catch (error) {
      logger.error('Database metric execution failed:', error);
      throw error;
    }
  }

  /**
   * Execute API metric
   */
  private async executeAPIMetric(source: APISource): Promise<number> {
    try {
      const fetch = require('node-fetch');
      const response = await fetch(source.endpoint, {
        method: source.method,
        headers: source.headers,
        body: source.body ? JSON.stringify(source.body) : undefined,
        timeout: source.timeout || 5000
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Parse response using JSONPath
      const jsonpath = require('jsonpath');
      const value = jsonpath.value(data, source.responseParser);
      
      return parseFloat(value);
    } catch (error) {
      logger.error('API metric execution failed:', error);
      throw error;
    }
  }

  /**
   * Execute event metric
   */
  private async executeEventMetric(source: EventSource): Promise<number> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - source.timeWindow * 1000);
      
      let query = `
        SELECT ${this.getAggregationFunction(source.aggregationFunction)}(${source.valueField || '1'}) as value
        FROM analytics_events
        WHERE timestamp >= $1 AND timestamp <= $2
        AND event_type = ANY($3)
      `;

      const params = [startTime, endTime, source.eventTypes];
      
      // Add filters
      if (source.filters) {
        let paramIndex = 4;
        for (const [key, value] of Object.entries(source.filters)) {
          query += ` AND properties->>'${key}' = $${paramIndex}`;
          params.push(value);
          paramIndex++;
        }
      }

      const result = await this.pool.query(query, params);
      
      return parseFloat(result.rows[0].value || '0');
    } catch (error) {
      logger.error('Event metric execution failed:', error);
      throw error;
    }
  }

  /**
   * Execute formula metric
   */
  private async executeFormulaMetric(source: FormulaSource): Promise<number> {
    try {
      // Get values for dependent metrics
      const values: Record<string, number> = {};
      
      for (const depMetricId of source.dependencies) {
        const depResult = await this.executeMetric(depMetricId);
        if (!depResult.success || depResult.value === undefined) {
          throw new Error(`Dependency metric ${depMetricId} failed`);
        }
        values[depMetricId] = depResult.value;
      }

      // Evaluate formula
      const mathjs = require('mathjs');
      const result = mathjs.evaluate(source.formula, values);
      
      return parseFloat(result);
    } catch (error) {
      logger.error('Formula metric execution failed:', error);
      throw error;
    }
  }

  /**
   * Execute external metric
   */
  private async executeExternalMetric(source: ExternalSource): Promise<number> {
    try {
      // Placeholder for external provider integration
      switch (source.provider) {
        case 'prometheus':
          return await this.executePrometheusQuery(source);
        case 'datadog':
          return await this.executeDatadogQuery(source);
        default:
          throw new Error(`Unsupported external provider: ${source.provider}`);
      }
    } catch (error) {
      logger.error('External metric execution failed:', error);
      throw error;
    }
  }

  /**
   * Execute Prometheus query (placeholder)
   */
  private async executePrometheusQuery(source: ExternalSource): Promise<number> {
    // Placeholder implementation
    return 0;
  }

  /**
   * Execute Datadog query (placeholder)
   */
  private async executeDatadogQuery(source: ExternalSource): Promise<number> {
    // Placeholder implementation
    return 0;
  }

  /**
   * Store metric value
   */
  private async storeMetricValue(value: MetricValue): Promise<void> {
    await this.pool.query(
      `INSERT INTO metric_values (metric_id, timestamp, value, tags, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        value.metricId,
        value.timestamp,
        value.value,
        JSON.stringify(value.tags || {}),
        JSON.stringify(value.metadata || {})
      ]
    );

    // Also send to analytics aggregation service
    await analyticsAggregationService.recordMetric({
      metricName: value.metricId,
      value: value.value,
      tags: value.tags || {},
      unit: 'custom'
    });
  }

  /**
   * Record execution result
   */
  private async recordExecution(result: MetricExecutionResult): Promise<void> {
    await this.pool.query(
      `INSERT INTO metric_executions (metric_id, success, value, error_message, execution_time)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        result.metricId,
        result.success,
        result.value,
        result.error,
        result.executionTime
      ]
    );
  }

  /**
   * Check alerts for metric
   */
  private async checkAlerts(metricId: string, value: number, timestamp: Date): Promise<void> {
    const metric = this.metrics.get(metricId);
    if (!metric || !metric.alerts) return;

    for (const alert of metric.alerts) {
      if (!alert.isActive) continue;

      const shouldTrigger = this.evaluateAlertCondition(alert.condition, value);
      
      if (shouldTrigger) {
        const lastTriggered = this.alertStates.get(alert.alertId);
        const now = Date.now();
        
        // Check cooldown
        if (lastTriggered && (now - lastTriggered) < alert.cooldown * 1000) {
          continue;
        }

        // Trigger alert
        await this.triggerAlert(alert, metric, value, timestamp);
        this.alertStates.set(alert.alertId, now);
      }
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateAlertCondition(condition: AlertCondition, value: number): boolean {
    switch (condition.operator) {
      case '>':
        return value > condition.value as number;
      case '<':
        return value < condition.value as number;
      case '>=':
        return value >= condition.value as number;
      case '<=':
        return value <= condition.value as number;
      case '==':
        return value === condition.value as number;
      case '!=':
        return value !== condition.value as number;
      case 'range':
        const [min, max] = condition.value as number[];
        return value < min || value > max;
      default:
        return false;
    }
  }

  /**
   * Trigger alert
   */
  private async triggerAlert(
    alert: AlertConfig,
    metric: CustomMetric,
    value: number,
    timestamp: Date
  ): Promise<void> {
    try {
      // Update alert stats
      await this.pool.query(
        `UPDATE metric_alerts 
         SET last_triggered = $1, trigger_count = trigger_count + 1
         WHERE alert_id = $2`,
        [timestamp, alert.alertId]
      );

      // Send notifications
      for (const channel of alert.notification.channels) {
        await this.sendAlertNotification(channel, alert, metric, value, timestamp);
      }

      this.emit('alertTriggered', {
        alertId: alert.alertId,
        metricId: metric.metricId,
        value,
        severity: alert.severity
      });
    } catch (error) {
      logger.error('Failed to trigger alert:', error);
    }
  }

  /**
   * Send alert notification
   */
  private async sendAlertNotification(
    channel: string,
    alert: AlertConfig,
    metric: CustomMetric,
    value: number,
    timestamp: Date
  ): Promise<void> {
    const message = `Alert: ${alert.name}
Metric: ${metric.displayName}
Current Value: ${value} ${metric.unit}
Threshold: ${alert.condition.operator} ${alert.condition.value}
Time: ${timestamp.toISOString()}
Severity: ${alert.severity.toUpperCase()}`;

    switch (channel) {
      case 'email':
        // Send email notification
        break;
      case 'slack':
        // Send Slack notification
        break;
      case 'webhook':
        // Send webhook notification
        if (alert.notification.webhookUrl) {
          await this.sendWebhookNotification(alert.notification.webhookUrl, {
            alert: alert.name,
            metric: metric.name,
            value,
            threshold: alert.condition,
            timestamp,
            severity: alert.severity
          });
        }
        break;
      case 'sms':
        // Send SMS notification
        break;
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(url: string, payload: any): Promise<void> {
    try {
      const fetch = require('node-fetch');
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeout: 5000
      });
    } catch (error) {
      logger.error('Webhook notification failed:', error);
    }
  }

  /**
   * Setup metric collection jobs
   */
  private async setupMetricJobs(): Promise<void> {
    for (const [metricId, metric] of this.metrics) {
      if (metric.isActive) {
        await this.setupMetricJob(metric);
      }
    }
  }

  /**
   * Setup single metric job
   */
  private async setupMetricJob(metric: CustomMetric): Promise<void> {
    try {
      // Stop existing job if any
      const existingJob = this.metricJobs.get(metric.metricId);
      if (existingJob) {
        existingJob.stop();
      }

      // Get refresh interval based on source type
      const refreshInterval = this.getMetricRefreshInterval(metric);
      
      if (refreshInterval <= 0) return;

      // Create cron expression
      const cronExpression = this.createCronExpression(refreshInterval);
      
      // Schedule job
      const job = schedule.schedule(cronExpression, async () => {
        await this.executeMetric(metric.metricId);
      });

      this.metricJobs.set(metric.metricId, job);
      job.start();

      logger.info(`Scheduled metric collection for ${metric.name} (${cronExpression})`);
    } catch (error) {
      logger.error(`Failed to setup job for metric ${metric.metricId}:`, error);
    }
  }

  /**
   * Update metric job
   */
  private async updateMetricJob(metric: CustomMetric): Promise<void> {
    // Remove existing job
    const existingJob = this.metricJobs.get(metric.metricId);
    if (existingJob) {
      existingJob.stop();
      this.metricJobs.delete(metric.metricId);
    }

    // Setup new job if active
    if (metric.isActive) {
      await this.setupMetricJob(metric);
    }
  }

  /**
   * Get metric refresh interval
   */
  private getMetricRefreshInterval(metric: CustomMetric): number {
    const source = metric.source.config;
    
    if ('refreshInterval' in source) {
      return (source as any).refreshInterval;
    }
    
    return 300; // Default 5 minutes
  }

  /**
   * Create cron expression from interval
   */
  private createCronExpression(intervalSeconds: number): string {
    if (intervalSeconds < 60) {
      return `*/${intervalSeconds} * * * * *`; // Every N seconds
    } else if (intervalSeconds < 3600) {
      const minutes = Math.floor(intervalSeconds / 60);
      return `*/${minutes} * * * *`; // Every N minutes
    } else {
      const hours = Math.floor(intervalSeconds / 3600);
      return `0 */${hours} * * *`; // Every N hours
    }
  }

  /**
   * Utility functions
   */
  private validateMetric(metric: CustomMetric): void {
    if (!metric.name || !metric.displayName || !metric.category) {
      throw new Error('Metric name, display name, and category are required');
    }

    if (!['counter', 'gauge', 'histogram', 'summary', 'rate', 'percentage'].includes(metric.type)) {
      throw new Error('Invalid metric type');
    }

    if (!metric.source || !metric.source.type) {
      throw new Error('Metric source is required');
    }
  }

  private generateMetricId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDashboardId(): string {
    return `dashboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 300; // Default 5 minutes

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 300;
    }
  }

  private getDurationUnit(duration: string): string {
    if (duration.endsWith('s')) return 'second';
    if (duration.endsWith('m')) return 'minute';
    if (duration.endsWith('h')) return 'hour';
    if (duration.endsWith('d')) return 'day';
    return 'minute';
  }

  private getAggregationFunction(aggregation: string): string {
    const functionMap: Record<string, string> = {
      'count': 'COUNT',
      'sum': 'SUM',
      'avg': 'AVG',
      'min': 'MIN',
      'max': 'MAX',
      'distinct': 'COUNT(DISTINCT'
    };
    
    return functionMap[aggregation] || 'AVG';
  }

  private getDefaultTimeRange(range: string): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();
    
    const duration = this.parseDuration(range);
    start.setTime(end.getTime() - duration * 1000);
    
    return { start, end };
  }

  /**
   * Database operations
   */
  private async loadMetrics(): Promise<void> {
    const result = await this.pool.query(
      'SELECT * FROM custom_metrics WHERE is_active = true'
    );

    for (const row of result.rows) {
      const metric: CustomMetric = {
        metricId: row.metric_id,
        name: row.name,
        displayName: row.display_name,
        description: row.description,
        category: row.category,
        type: row.type,
        unit: row.unit,
        source: row.source,
        aggregation: row.aggregation,
        visualization: row.visualization,
        alerts: row.alerts,
        isActive: row.is_active,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        tags: row.tags || {}
      };

      this.metrics.set(metric.metricId, metric);
    }

    logger.info(`Loaded ${this.metrics.size} custom metrics`);
  }

  private async loadDashboards(): Promise<void> {
    const result = await this.pool.query('SELECT * FROM dashboards');

    for (const row of result.rows) {
      const dashboard: Dashboard = {
        dashboardId: row.dashboard_id,
        name: row.name,
        description: row.description,
        layout: row.layout,
        widgets: row.widgets,
        filters: row.filters,
        refreshInterval: row.refresh_interval,
        isPublic: row.is_public,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        tags: row.tags || []
      };

      this.dashboards.set(dashboard.dashboardId, dashboard);
    }

    logger.info(`Loaded ${this.dashboards.size} dashboards`);
  }

  private async saveMetric(metric: CustomMetric): Promise<void> {
    await this.pool.query(
      `INSERT INTO custom_metrics (
        metric_id, name, display_name, description, category, type, unit,
        source, aggregation, visualization, alerts, is_active, created_by, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        metric.metricId,
        metric.name,
        metric.displayName,
        metric.description,
        metric.category,
        metric.type,
        metric.unit,
        JSON.stringify(metric.source),
        JSON.stringify(metric.aggregation),
        JSON.stringify(metric.visualization),
        JSON.stringify(metric.alerts),
        metric.isActive,
        metric.createdBy,
        JSON.stringify(metric.tags)
      ]
    );
  }

  private async updateMetricInDB(metric: CustomMetric): Promise<void> {
    await this.pool.query(
      `UPDATE custom_metrics SET
        display_name = $1, description = $2, category = $3, type = $4, unit = $5,
        source = $6, aggregation = $7, visualization = $8, alerts = $9,
        is_active = $10, updated_at = CURRENT_TIMESTAMP, tags = $11
       WHERE metric_id = $12`,
      [
        metric.displayName,
        metric.description,
        metric.category,
        metric.type,
        metric.unit,
        JSON.stringify(metric.source),
        JSON.stringify(metric.aggregation),
        JSON.stringify(metric.visualization),
        JSON.stringify(metric.alerts),
        metric.isActive,
        JSON.stringify(metric.tags),
        metric.metricId
      ]
    );
  }

  private async saveDashboard(dashboard: Dashboard): Promise<void> {
    await this.pool.query(
      `INSERT INTO dashboards (
        dashboard_id, name, description, layout, widgets, filters,
        refresh_interval, is_public, created_by, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        dashboard.dashboardId,
        dashboard.name,
        dashboard.description,
        JSON.stringify(dashboard.layout),
        JSON.stringify(dashboard.widgets),
        JSON.stringify(dashboard.filters),
        dashboard.refreshInterval,
        dashboard.isPublic,
        dashboard.createdBy,
        dashboard.tags
      ]
    );
  }

  /**
   * Get service statistics
   */
  async getStatistics(): Promise<{
    totalMetrics: number;
    activeMetrics: number;
    totalDashboards: number;
    executionsToday: number;
    avgExecutionTime: number;
    alertsTriggered24h: number;
    topCategories: Array<{ category: string; count: number }>;
  }> {
    const [metricStats, executionStats, alertStats, categoryStats] = await Promise.all([
      this.pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_active = true) as active
        FROM custom_metrics
      `),
      this.pool.query(`
        SELECT 
          COUNT(*) as executions,
          AVG(execution_time) as avg_time
        FROM metric_executions
        WHERE timestamp >= CURRENT_DATE
      `),
      this.pool.query(`
        SELECT COUNT(*) as alerts
        FROM metric_alerts
        WHERE last_triggered >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
      `),
      this.pool.query(`
        SELECT 
          category,
          COUNT(*) as count
        FROM custom_metrics
        GROUP BY category
        ORDER BY count DESC
        LIMIT 10
      `)
    ]);

    return {
      totalMetrics: parseInt(metricStats.rows[0].total),
      activeMetrics: parseInt(metricStats.rows[0].active),
      totalDashboards: this.dashboards.size,
      executionsToday: parseInt(executionStats.rows[0].executions || '0'),
      avgExecutionTime: Math.round(parseFloat(executionStats.rows[0].avg_time || '0')),
      alertsTriggered24h: parseInt(alertStats.rows[0].alerts || '0'),
      topCategories: categoryStats.rows.map(row => ({
        category: row.category,
        count: parseInt(row.count)
      }))
    };
  }
}

// Export singleton instance
const customMetricsService = new CustomMetricsService();
export default customMetricsService;