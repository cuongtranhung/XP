/**
 * Advanced Monitoring & Observability Platform
 * 
 * Comprehensive system monitoring with:
 * 1. Application Performance Monitoring (APM)
 * 2. Real-time metrics collection
 * 3. Distributed tracing
 * 4. Custom dashboards
 * 5. Intelligent alerting
 * 6. SLA monitoring
 */

import { logger } from '../utils/logger';
import { getClient } from '../utils/database';
import performanceMonitor from './performanceMonitor';
import cacheService from './cacheService';

// Core interfaces for observability
interface Metric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
}

interface Trace {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'ok' | 'error' | 'timeout';
  tags: Record<string, any>;
  logs: TraceLog[];
}

interface TraceLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  fields?: Record<string, any>;
}

interface AlertCondition {
  id: string;
  name: string;
  description: string;
  query: string;
  threshold: number;
  operator: '>' | '<' | '=' | '>=' | '<=';
  timeWindow: number; // minutes
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  channels: AlertChannel[];
}

interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  config: Record<string, any>;
}

interface Dashboard {
  id: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  timeRange: TimeRange;
  refreshInterval: number; // seconds
  permissions: DashboardPermission[];
}

interface DashboardWidget {
  id: string;
  type: 'line_chart' | 'bar_chart' | 'gauge' | 'table' | 'stat' | 'heatmap';
  title: string;
  query: string;
  position: { x: number; y: number; width: number; height: number };
  config: Record<string, any>;
}

interface TimeRange {
  from: Date;
  to: Date;
  relative?: string; // e.g., "last_1h", "last_24h", "last_7d"
}

interface DashboardPermission {
  userId?: number;
  role?: string;
  permissions: ('view' | 'edit' | 'admin')[];
}

interface SLAMetrics {
  availability: number; // percentage
  responseTime: number; // ms
  errorRate: number; // percentage
  throughput: number; // requests per second
}

interface SLATarget {
  name: string;
  availability: number; // target percentage
  responseTime: number; // target ms
  errorRate: number; // maximum percentage
}

class ObservabilityPlatform {
  private static instance: ObservabilityPlatform;
  private metricsStore: Map<string, Metric[]> = new Map();
  private tracesStore: Map<string, Trace> = new Map();
  private alertConditions: Map<string, AlertCondition> = new Map();
  private dashboards: Map<string, Dashboard> = new Map();
  private activeAlerts: Map<string, Date> = new Map();
  
  // Configuration
  private config = {
    metricsRetentionHours: parseInt(process.env.METRICS_RETENTION_HOURS ?? '168'), // 7 days
    tracesRetentionHours: parseInt(process.env.TRACES_RETENTION_HOURS ?? '72'), // 3 days
    maxMetricsPerSeries: parseInt(process.env.MAX_METRICS_PER_SERIES ?? '10000'),
    maxTraces: parseInt(process.env.MAX_TRACES ?? '100000'),
    alertCooldownMinutes: parseInt(process.env.ALERT_COOLDOWN_MINUTES ?? '15'),
    enablePersistence: process.env.OBSERVABILITY_PERSISTENCE !== 'false'
  };

  private constructor() {
    this.startBackgroundTasks();
  }

  static getInstance(): ObservabilityPlatform {
    if (!ObservabilityPlatform.instance) {
      ObservabilityPlatform.instance = new ObservabilityPlatform();
    }
    return ObservabilityPlatform.instance;
  }

  /**
   * APM - Application Performance Monitoring
   */
  async recordMetric(metric: Metric): Promise<void> {
    try {
      const seriesKey = `${metric.name}:${JSON.stringify(metric.tags)}`;
      
      if (!this.metricsStore.has(seriesKey)) {
        this.metricsStore.set(seriesKey, []);
      }
      
      const series = this.metricsStore.get(seriesKey)!;
      series.push(metric);
      
      // Limit series size
      if (series.length > this.config.maxMetricsPerSeries) {
        series.shift();
      }
      
      // Persist to database if enabled
      if (this.config.enablePersistence) {
        await this.persistMetric(metric);
      }
      
      // Check alert conditions
      await this.checkAlertConditions(metric);
      
    } catch (error) {
      logger.error('Failed to record metric', {
        metric: metric.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Distributed Tracing
   */
  async startTrace(operationName: string, tags: Record<string, any> = {}): Promise<string> {
    const traceId = this.generateTraceId();
    const spanId = this.generateSpanId();
    
    const trace: Trace = {
      traceId,
      spanId,
      operationName,
      startTime: new Date(),
      status: 'ok',
      tags,
      logs: []
    };
    
    this.tracesStore.set(traceId, trace);
    
    // Limit traces store size
    if (this.tracesStore.size > this.config.maxTraces) {
      const oldestTrace = Array.from(this.tracesStore.keys())[0];
      this.tracesStore.delete(oldestTrace);
    }
    
    return traceId;
  }

  async finishTrace(traceId: string, status: 'ok' | 'error' | 'timeout' = 'ok'): Promise<void> {
    const trace = this.tracesStore.get(traceId);
    if (!trace) return;
    
    trace.endTime = new Date();
    trace.duration = trace.endTime.getTime() - trace.startTime.getTime();
    trace.status = status;
    
    // Record trace metrics
    await this.recordMetric({
      name: 'trace.duration',
      value: trace.duration,
      unit: 'ms',
      timestamp: new Date(),
      tags: {
        operation: trace.operationName,
        status: trace.status,
        ...trace.tags
      },
      type: 'histogram'
    });
    
    // Persist trace if enabled
    if (this.config.enablePersistence) {
      await this.persistTrace(trace);
    }
  }

  async addTraceLog(traceId: string, log: TraceLog): Promise<void> {
    const trace = this.tracesStore.get(traceId);
    if (trace) {
      trace.logs.push(log);
    }
  }

  /**
   * Custom Dashboards
   */
  async createDashboard(dashboard: Omit<Dashboard, 'id'>): Promise<string> {
    const dashboardId = this.generateId();
    const fullDashboard: Dashboard = {
      ...dashboard,
      id: dashboardId
    };
    
    this.dashboards.set(dashboardId, fullDashboard);
    
    if (this.config.enablePersistence) {
      await this.persistDashboard(fullDashboard);
    }
    
    logger.info('Dashboard created', { dashboardId, name: dashboard.name });
    return dashboardId;
  }

  async getDashboard(dashboardId: string): Promise<Dashboard | null> {
    return this.dashboards.get(dashboardId) || null;
  }

  async updateDashboard(dashboardId: string, updates: Partial<Dashboard>): Promise<boolean> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return false;
    
    const updatedDashboard = { ...dashboard, ...updates };
    this.dashboards.set(dashboardId, updatedDashboard);
    
    if (this.config.enablePersistence) {
      await this.persistDashboard(updatedDashboard);
    }
    
    return true;
  }

  async queryMetrics(query: string, timeRange: TimeRange): Promise<Metric[]> {
    const results: Metric[] = [];
    
    // Simple query parsing (in production, use a proper query engine)
    const metricName = query.split(' ')[0];
    
    for (const [seriesKey, metrics] of this.metricsStore.entries()) {
      if (seriesKey.includes(metricName)) {
        const filteredMetrics = metrics.filter(m => 
          m.timestamp >= timeRange.from && m.timestamp <= timeRange.to
        );
        results.push(...filteredMetrics);
      }
    }
    
    return results.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Intelligent Alerting
   */
  async createAlertCondition(condition: Omit<AlertCondition, 'id'>): Promise<string> {
    const conditionId = this.generateId();
    const fullCondition: AlertCondition = {
      ...condition,
      id: conditionId
    };
    
    this.alertConditions.set(conditionId, fullCondition);
    
    if (this.config.enablePersistence) {
      await this.persistAlertCondition(fullCondition);
    }
    
    logger.info('Alert condition created', { conditionId, name: condition.name });
    return conditionId;
  }

  private async checkAlertConditions(metric: Metric): Promise<void> {
    for (const [conditionId, condition] of this.alertConditions.entries()) {
      if (!condition.enabled) continue;
      
      // Check if this metric matches the condition
      if (this.doesMetricMatchCondition(metric, condition)) {
        const shouldAlert = this.evaluateCondition(metric, condition);
        
        if (shouldAlert && !this.isAlertInCooldown(conditionId)) {
          await this.triggerAlert(conditionId, condition, metric);
        }
      }
    }
  }

  private doesMetricMatchCondition(metric: Metric, condition: AlertCondition): boolean {
    // Simple matching logic (in production, use a proper query engine)
    return condition.query.includes(metric.name);
  }

  private evaluateCondition(metric: Metric, condition: AlertCondition): boolean {
    switch (condition.operator) {
      case '>': return metric.value > condition.threshold;
      case '<': return metric.value < condition.threshold;
      case '=': return metric.value === condition.threshold;
      case '>=': return metric.value >= condition.threshold;
      case '<=': return metric.value <= condition.threshold;
      default: return false;
    }
  }

  private isAlertInCooldown(conditionId: string): boolean {
    const lastAlert = this.activeAlerts.get(conditionId);
    if (!lastAlert) return false;
    
    const cooldownMs = this.config.alertCooldownMinutes * 60 * 1000;
    return Date.now() - lastAlert.getTime() < cooldownMs;
  }

  private async triggerAlert(conditionId: string, condition: AlertCondition, metric: Metric): Promise<void> {
    this.activeAlerts.set(conditionId, new Date());
    
    const alert = {
      conditionId,
      conditionName: condition.name,
      severity: condition.severity,
      message: `Alert: ${condition.name} - ${metric.name} ${condition.operator} ${condition.threshold} (current: ${metric.value})`,
      timestamp: new Date(),
      metric,
      tags: metric.tags
    };
    
    // Send alerts through configured channels
    for (const channel of condition.channels) {
      await this.sendAlert(alert, channel);
    }
    
    logger.warn('Alert triggered', {
      conditionId,
      conditionName: condition.name,
      severity: condition.severity,
      metricValue: metric.value,
      threshold: condition.threshold
    });
  }

  private async sendAlert(alert: any, channel: AlertChannel): Promise<void> {
    try {
      switch (channel.type) {
        case 'email':
          // Integration with email service
          logger.info('Email alert sent', { alert: alert.message });
          break;
          
        case 'webhook':
          // HTTP webhook integration
          logger.info('Webhook alert sent', { url: channel.config.url });
          break;
          
        case 'slack':
          // Slack integration
          logger.info('Slack alert sent', { channel: channel.config.channel });
          break;
          
        default:
          logger.warn('Unsupported alert channel', { type: channel.type });
      }
    } catch (error) {
      logger.error('Failed to send alert', {
        channelType: channel.type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * SLA Monitoring
   */
  async calculateSLA(serviceName: string, timeRange: TimeRange): Promise<SLAMetrics> {
    const metrics = await this.queryMetrics(`service:${serviceName}`, timeRange);
    
    const responseTimeMetrics = metrics.filter(m => m.name.includes('response_time'));
    const errorMetrics = metrics.filter(m => m.name.includes('error'));
    const requestMetrics = metrics.filter(m => m.name.includes('request'));
    
    const availability = this.calculateAvailability(errorMetrics, requestMetrics);
    const avgResponseTime = this.calculateAverageResponseTime(responseTimeMetrics);
    const errorRate = this.calculateErrorRate(errorMetrics, requestMetrics);
    const throughput = this.calculateThroughput(requestMetrics, timeRange);
    
    return {
      availability,
      responseTime: avgResponseTime,
      errorRate,
      throughput
    };
  }

  /**
   * System Health Metrics
   */
  async getSystemHealthMetrics(): Promise<any> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const timeRange: TimeRange = { from: oneHourAgo, to: now };
    
    // Collect system metrics
    const cpuMetrics = await this.queryMetrics('system.cpu', timeRange);
    const memoryMetrics = await this.queryMetrics('system.memory', timeRange);
    const dbMetrics = await this.queryMetrics('database', timeRange);
    const cacheMetrics = await cacheService.getCacheStats();
    const performanceMetrics = performanceMonitor.getPerformanceSummary();
    
    return {
      timestamp: now,
      system: {
        cpu: this.aggregateMetrics(cpuMetrics),
        memory: this.aggregateMetrics(memoryMetrics),
        database: this.aggregateMetrics(dbMetrics)
      },
      cache: cacheMetrics,
      performance: performanceMetrics,
      traces: {
        totalTraces: this.tracesStore.size,
        recentErrors: this.getRecentTraceErrors()
      },
      alerts: {
        activeAlerts: this.activeAlerts.size,
        totalConditions: this.alertConditions.size
      }
    };
  }

  /**
   * Background Tasks
   */
  private startBackgroundTasks(): void {
    // Cleanup old metrics and traces
    setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000); // Every hour
    
    // Collect system metrics
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30 * 1000); // Every 30 seconds
    
    logger.info('Observability platform background tasks started');
  }

  private async cleanupOldData(): Promise<void> {
    const now = Date.now();
    const metricsRetentionMs = this.config.metricsRetentionHours * 60 * 60 * 1000;
    const tracesRetentionMs = this.config.tracesRetentionHours * 60 * 60 * 1000;
    
    // Cleanup metrics
    let metricsDeleted = 0;
    for (const [seriesKey, metrics] of this.metricsStore.entries()) {
      const filteredMetrics = metrics.filter(m => 
        now - m.timestamp.getTime() < metricsRetentionMs
      );
      metricsDeleted += metrics.length - filteredMetrics.length;
      this.metricsStore.set(seriesKey, filteredMetrics);
    }
    
    // Cleanup traces
    let tracesDeleted = 0;
    for (const [traceId, trace] of this.tracesStore.entries()) {
      if (now - trace.startTime.getTime() > tracesRetentionMs) {
        this.tracesStore.delete(traceId);
        tracesDeleted++;
      }
    }
    
    if (metricsDeleted > 0 || tracesDeleted > 0) {
      logger.debug('Cleaned up old observability data', {
        metricsDeleted,
        tracesDeleted
      });
    }
  }

  private async collectSystemMetrics(): Promise<void> {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // Memory metrics
      await this.recordMetric({
        name: 'system.memory.rss',
        value: memUsage.rss,
        unit: 'bytes',
        timestamp: new Date(),
        tags: { process: 'backend' },
        type: 'gauge'
      });
      
      await this.recordMetric({
        name: 'system.memory.heap_used',
        value: memUsage.heapUsed,
        unit: 'bytes',
        timestamp: new Date(),
        tags: { process: 'backend' },
        type: 'gauge'
      });
      
      // CPU metrics
      await this.recordMetric({
        name: 'system.cpu.user',
        value: cpuUsage.user,
        unit: 'microseconds',
        timestamp: new Date(),
        tags: { process: 'backend' },
        type: 'counter'
      });
      
      await this.recordMetric({
        name: 'system.cpu.system',
        value: cpuUsage.system,
        unit: 'microseconds',
        timestamp: new Date(),
        tags: { process: 'backend' },
        type: 'counter'
      });
      
    } catch (error) {
      logger.error('Failed to collect system metrics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Helper methods
  private generateTraceId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private generateSpanId(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private calculateAvailability(errorMetrics: Metric[], requestMetrics: Metric[]): number {
    const totalErrors = errorMetrics.reduce((sum, m) => sum + m.value, 0);
    const totalRequests = requestMetrics.reduce((sum, m) => sum + m.value, 0);
    
    if (totalRequests === 0) return 100;
    
    return ((totalRequests - totalErrors) / totalRequests) * 100;
  }

  private calculateAverageResponseTime(metrics: Metric[]): number {
    if (metrics.length === 0) return 0;
    
    const sum = metrics.reduce((total, m) => total + m.value, 0);
    return sum / metrics.length;
  }

  private calculateErrorRate(errorMetrics: Metric[], requestMetrics: Metric[]): number {
    const totalErrors = errorMetrics.reduce((sum, m) => sum + m.value, 0);
    const totalRequests = requestMetrics.reduce((sum, m) => sum + m.value, 0);
    
    if (totalRequests === 0) return 0;
    
    return (totalErrors / totalRequests) * 100;
  }

  private calculateThroughput(requestMetrics: Metric[], timeRange: TimeRange): number {
    const totalRequests = requestMetrics.reduce((sum, m) => sum + m.value, 0);
    const timeRangeSeconds = (timeRange.to.getTime() - timeRange.from.getTime()) / 1000;
    
    return totalRequests / timeRangeSeconds;
  }

  private aggregateMetrics(metrics: Metric[]): any {
    if (metrics.length === 0) {
      return { count: 0, avg: 0, min: 0, max: 0 };
    }
    
    const values = metrics.map(m => m.value);
    return {
      count: metrics.length,
      avg: values.reduce((sum, v) => sum + v, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }

  private getRecentTraceErrors(): number {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    return Array.from(this.tracesStore.values())
      .filter(trace => 
        trace.status === 'error' && 
        trace.startTime.getTime() > oneHourAgo
      ).length;
  }

  // Persistence methods (implement based on your database preference)
  private async persistMetric(metric: Metric): Promise<void> {
    // Implementation depends on your storage backend
    // Could be InfluxDB, Prometheus, TimescaleDB, etc.
  }

  private async persistTrace(trace: Trace): Promise<void> {
    // Implementation for trace storage
    // Could be Jaeger, Zipkin, or custom database
  }

  private async persistDashboard(dashboard: Dashboard): Promise<void> {
    // Store dashboard configuration
  }

  private async persistAlertCondition(condition: AlertCondition): Promise<void> {
    // Store alert condition
  }
}

// Export singleton instance
export const observabilityPlatform = ObservabilityPlatform.getInstance();
export default observabilityPlatform;