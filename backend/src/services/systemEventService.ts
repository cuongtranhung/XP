/**
 * System Event Service for Real-time System Monitoring and Broadcasting
 * Handles user activity, system health, security alerts, and performance monitoring events
 */

import { webSocketService } from './webSocketService';
import { logger } from '../utils/logger';
import redisClient from '../config/redis';
import { EventEmitter } from 'events';

export interface UserActivity {
  activityId: string;
  userId: string;
  userEmail: string;
  activityType: 'login' | 'logout' | 'form_created' | 'form_published' | 'submission_created' | 'comment_added' | 'file_uploaded' | 'permission_changed';
  entityType?: 'form' | 'submission' | 'comment' | 'user' | 'system';
  entityId?: string;
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    deviceType?: string;
    location?: string;
    duration?: number;
    success?: boolean;
    errorCode?: string;
  };
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface SystemHealthAlert {
  alertId: string;
  alertType: 'cpu_usage' | 'memory_usage' | 'disk_usage' | 'database_connection' | 'redis_connection' | 'service_down' | 'response_time';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  metrics: {
    currentValue: number;
    threshold: number;
    unit: string;
    trend?: 'up' | 'down' | 'stable';
  };
  affectedServices?: string[];
  resolvedAt?: Date;
  timestamp: Date;
}

export interface SecurityAlert {
  alertId: string;
  alertType: 'failed_login' | 'suspicious_activity' | 'unauthorized_access' | 'data_breach' | 'malware_detected' | 'ddos_attack' | 'brute_force';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  sourceIp?: string;
  targetUserId?: string;
  targetResource?: string;
  attackVector?: string;
  riskScore: number; // 0-100
  mitigationActions?: string[];
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface PerformanceMetric {
  metricId: string;
  metricType: 'response_time' | 'throughput' | 'error_rate' | 'active_users' | 'database_queries' | 'cache_hit_rate' | 'memory_usage' | 'cpu_usage';
  service: 'api' | 'database' | 'redis' | 'websocket' | 'forms' | 'comments' | 'auth' | 'system';
  value: number;
  unit: string;
  threshold?: {
    warning: number;
    critical: number;
  };
  trend: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
    timeframe: string;
  };
  timestamp: Date;
}

export interface ActivitySubscription {
  userId: string;
  socketId: string;
  filters: {
    activityTypes?: string[];
    userIds?: string[];
    entityTypes?: string[];
    severities?: string[];
    timeRange?: {
      from: Date;
      to: Date;
    };
  };
  isAdmin: boolean;
  subscribedAt: Date;
}

/**
 * System Event Service
 */
class SystemEventService extends EventEmitter {
  private activitySubscriptions = new Map<string, ActivitySubscription>();
  private systemHealthSubscriptions = new Set<string>(); // socketIds
  private securitySubscriptions = new Set<string>(); // socketIds  
  private performanceSubscriptions = new Set<string>(); // socketIds
  private recentActivities: UserActivity[] = [];
  private activeAlerts = new Map<string, SystemHealthAlert | SecurityAlert>();
  private performanceBuffer = new Map<string, PerformanceMetric[]>();

  private readonly maxRecentActivities = 1000;
  private readonly maxPerformanceBufferSize = 100;

  constructor() {
    super();
    this.setupSystemMonitoring();
    this.setupCleanupInterval();
  }

  /**
   * Subscribe to user activity broadcasts
   */
  async subscribeToUserActivity(subscription: {
    userId: string;
    socketId: string;
    filters?: ActivitySubscription['filters'];
    isAdmin?: boolean;
  }): Promise<{
    subscription: ActivitySubscription;
    recentActivities: UserActivity[];
  }> {
    try {
      const activitySub: ActivitySubscription = {
        userId: subscription.userId,
        socketId: subscription.socketId,
        filters: subscription.filters || {},
        isAdmin: subscription.isAdmin || false,
        subscribedAt: new Date()
      };

      this.activitySubscriptions.set(subscription.socketId, activitySub);

      // Store in Redis for clustering
      await this.storeSubscriptionInRedis('activity', subscription.socketId, activitySub);

      // Get filtered recent activities
      const recentActivities = this.getFilteredActivities(activitySub.filters, activitySub.isAdmin ? 100 : 20);

      logger.info('User subscribed to activity broadcasts', {
        userId: subscription.userId,
        isAdmin: activitySub.isAdmin,
        filterCount: Object.keys(activitySub.filters).length
      });

      return {
        subscription: activitySub,
        recentActivities
      };

    } catch (error) {
      logger.error('Failed to subscribe to user activity', { error, userId: subscription.userId });
      throw error;
    }
  }

  /**
   * Subscribe to system health alerts
   */
  async subscribeToSystemHealth(userId: string, socketId: string): Promise<{
    activeAlerts: SystemHealthAlert[];
    systemStatus: 'healthy' | 'warning' | 'critical';
  }> {
    try {
      this.systemHealthSubscriptions.add(socketId);
      await this.storeSubscriptionInRedis('health', socketId, { userId, subscribedAt: new Date() });

      const activeHealthAlerts = Array.from(this.activeAlerts.values())
        .filter(alert => 'alertType' in alert && alert.alertType !== undefined) as SystemHealthAlert[];

      const systemStatus = this.calculateSystemStatus(activeHealthAlerts);

      logger.info('User subscribed to system health alerts', { userId, alertCount: activeHealthAlerts.length });

      return {
        activeAlerts: activeHealthAlerts,
        systemStatus
      };

    } catch (error) {
      logger.error('Failed to subscribe to system health', { error, userId });
      throw error;
    }
  }

  /**
   * Subscribe to security alerts
   */
  async subscribeToSecurityAlerts(userId: string, socketId: string): Promise<{
    activeAlerts: SecurityAlert[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }> {
    try {
      this.securitySubscriptions.add(socketId);
      await this.storeSubscriptionInRedis('security', socketId, { userId, subscribedAt: new Date() });

      const activeSecurityAlerts = Array.from(this.activeAlerts.values())
        .filter(alert => 'riskScore' in alert && !alert.resolved) as SecurityAlert[];

      const riskLevel = this.calculateRiskLevel(activeSecurityAlerts);

      logger.info('User subscribed to security alerts', { userId, alertCount: activeSecurityAlerts.length });

      return {
        activeAlerts: activeSecurityAlerts,
        riskLevel
      };

    } catch (error) {
      logger.error('Failed to subscribe to security alerts', { error, userId });
      throw error;
    }
  }

  /**
   * Subscribe to performance monitoring
   */
  async subscribeToPerformanceMonitoring(userId: string, socketId: string): Promise<{
    currentMetrics: PerformanceMetric[];
    systemOverview: {
      responseTime: number;
      throughput: number;
      errorRate: number;
      activeUsers: number;
    };
  }> {
    try {
      this.performanceSubscriptions.add(socketId);
      await this.storeSubscriptionInRedis('performance', socketId, { userId, subscribedAt: new Date() });

      const currentMetrics = this.getCurrentPerformanceMetrics();
      const systemOverview = this.calculateSystemOverview(currentMetrics);

      logger.info('User subscribed to performance monitoring', { userId, metricCount: currentMetrics.length });

      return {
        currentMetrics,
        systemOverview
      };

    } catch (error) {
      logger.error('Failed to subscribe to performance monitoring', { error, userId });
      throw error;
    }
  }

  /**
   * Broadcast user activity
   */
  async broadcastUserActivity(activity: Omit<UserActivity, 'activityId' | 'timestamp'>): Promise<void> {
    try {
      const fullActivity: UserActivity = {
        ...activity,
        activityId: this.generateId('activity'),
        timestamp: new Date()
      };

      // Add to recent activities buffer
      this.recentActivities.unshift(fullActivity);
      if (this.recentActivities.length > this.maxRecentActivities) {
        this.recentActivities = this.recentActivities.slice(0, this.maxRecentActivities);
      }

      // Store in Redis for persistence
      await this.storeActivityInRedis(fullActivity);

      // Broadcast to subscribers
      await this.broadcastToSubscribers('activity', {
        type: 'user_activity',
        activity: fullActivity,
        timestamp: new Date().toISOString()
      });

      // Emit event for other services
      this.emit('userActivity', fullActivity);

      logger.debug('User activity broadcasted', {
        activityType: activity.activityType,
        userId: activity.userId,
        severity: activity.severity
      });

    } catch (error) {
      logger.error('Failed to broadcast user activity', { error, activity });
    }
  }

  /**
   * Send system health alert
   */
  async sendSystemHealthAlert(alert: Omit<SystemHealthAlert, 'alertId' | 'timestamp'>): Promise<void> {
    try {
      const fullAlert: SystemHealthAlert = {
        ...alert,
        alertId: this.generateId('health'),
        timestamp: new Date()
      };

      // Store active alert
      this.activeAlerts.set(fullAlert.alertId, fullAlert);

      // Store in Redis
      await this.storeAlertInRedis('health', fullAlert);

      // Broadcast to subscribers
      await this.broadcastToSubscribers('health', {
        type: 'system_health_alert',
        alert: fullAlert,
        systemStatus: this.calculateSystemStatus([fullAlert]),
        timestamp: new Date().toISOString()
      });

      // Emit event for other services
      this.emit('systemHealthAlert', fullAlert);

      logger.warn('System health alert sent', {
        alertType: alert.alertType,
        severity: alert.severity,
        currentValue: alert.metrics.currentValue,
        threshold: alert.metrics.threshold
      });

    } catch (error) {
      logger.error('Failed to send system health alert', { error, alert });
    }
  }

  /**
   * Send security alert
   */
  async sendSecurityAlert(alert: Omit<SecurityAlert, 'alertId' | 'timestamp' | 'resolved'>): Promise<void> {
    try {
      const fullAlert: SecurityAlert = {
        ...alert,
        alertId: this.generateId('security'),
        timestamp: new Date(),
        resolved: false
      };

      // Store active alert
      this.activeAlerts.set(fullAlert.alertId, fullAlert);

      // Store in Redis
      await this.storeAlertInRedis('security', fullAlert);

      // Broadcast to subscribers
      await this.broadcastToSubscribers('security', {
        type: 'security_alert',
        alert: fullAlert,
        riskLevel: this.calculateRiskLevel([fullAlert]),
        timestamp: new Date().toISOString()
      });

      // Emit event for other services
      this.emit('securityAlert', fullAlert);

      logger.error('Security alert sent', {
        alertType: alert.alertType,
        severity: alert.severity,
        riskScore: alert.riskScore,
        sourceIp: alert.sourceIp
      });

    } catch (error) {
      logger.error('Failed to send security alert', { error, alert });
    }
  }

  /**
   * Update performance metrics
   */
  async updatePerformanceMetrics(metrics: PerformanceMetric[]): Promise<void> {
    try {
      for (const metric of metrics) {
        const serviceMetrics = this.performanceBuffer.get(metric.service) || [];
        serviceMetrics.unshift(metric);
        
        if (serviceMetrics.length > this.maxPerformanceBufferSize) {
          serviceMetrics.splice(this.maxPerformanceBufferSize);
        }
        
        this.performanceBuffer.set(metric.service, serviceMetrics);
      }

      // Store in Redis
      await this.storeMetricsInRedis(metrics);

      // Broadcast to subscribers
      await this.broadcastToSubscribers('performance', {
        type: 'performance_update',
        metrics,
        systemOverview: this.calculateSystemOverview(metrics),
        timestamp: new Date().toISOString()
      });

      // Emit event for other services
      this.emit('performanceUpdate', metrics);

      logger.debug('Performance metrics updated', { metricCount: metrics.length });

    } catch (error) {
      logger.error('Failed to update performance metrics', { error });
    }
  }

  /**
   * Get filtered activities
   */
  getFilteredActivities(filters: ActivitySubscription['filters'], limit: number = 50): UserActivity[] {
    let activities = [...this.recentActivities];

    // Apply filters
    if (filters.activityTypes?.length) {
      activities = activities.filter(a => filters.activityTypes!.includes(a.activityType));
    }

    if (filters.userIds?.length) {
      activities = activities.filter(a => filters.userIds!.includes(a.userId));
    }

    if (filters.entityTypes?.length) {
      activities = activities.filter(a => a.entityType && filters.entityTypes!.includes(a.entityType));
    }

    if (filters.severities?.length) {
      activities = activities.filter(a => filters.severities!.includes(a.severity));
    }

    if (filters.timeRange) {
      activities = activities.filter(a => 
        a.timestamp >= filters.timeRange!.from && a.timestamp <= filters.timeRange!.to
      );
    }

    return activities.slice(0, limit);
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string): Promise<boolean> {
    try {
      const alert = this.activeAlerts.get(alertId);
      if (!alert) return false;

      if ('resolved' in alert) {
        // Security alert
        (alert as SecurityAlert).resolved = true;
        (alert as SecurityAlert).resolvedAt = new Date();
      } else {
        // System health alert
        (alert as SystemHealthAlert).resolvedAt = new Date();
      }

      // Update in Redis
      await this.storeAlertInRedis(
        'riskScore' in alert ? 'security' : 'health',
        alert
      );

      // Broadcast resolution
      await this.broadcastToSubscribers(
        'riskScore' in alert ? 'security' : 'health',
        {
          type: 'alert_resolved',
          alertId,
          resolvedAt: new Date().toISOString()
        }
      );

      logger.info('Alert resolved', { alertId });
      return true;

    } catch (error) {
      logger.error('Failed to resolve alert', { error, alertId });
      return false;
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    activitySubscriptions: number;
    healthSubscriptions: number;
    securitySubscriptions: number;
    performanceSubscriptions: number;
    activeAlerts: number;
    recentActivities: number;
    systemStatus: 'healthy' | 'warning' | 'critical';
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  } {
    const healthAlerts = Array.from(this.activeAlerts.values())
      .filter(alert => 'alertType' in alert) as SystemHealthAlert[];
    
    const securityAlerts = Array.from(this.activeAlerts.values())
      .filter(alert => 'riskScore' in alert && !alert.resolved) as SecurityAlert[];

    return {
      activitySubscriptions: this.activitySubscriptions.size,
      healthSubscriptions: this.systemHealthSubscriptions.size,
      securitySubscriptions: this.securitySubscriptions.size,
      performanceSubscriptions: this.performanceSubscriptions.size,
      activeAlerts: this.activeAlerts.size,
      recentActivities: this.recentActivities.length,
      systemStatus: this.calculateSystemStatus(healthAlerts),
      riskLevel: this.calculateRiskLevel(securityAlerts)
    };
  }

  // Private helper methods

  private async broadcastToSubscribers(type: 'activity' | 'health' | 'security' | 'performance', data: any): Promise<void> {
    let targetSockets: Set<string> | Map<string, ActivitySubscription>;

    switch (type) {
      case 'activity':
        targetSockets = this.activitySubscriptions;
        break;
      case 'health':
        targetSockets = this.systemHealthSubscriptions;
        break;
      case 'security':
        targetSockets = this.securitySubscriptions;
        break;
      case 'performance':
        targetSockets = this.performanceSubscriptions;
        break;
    }

    const eventData = {
      type: 'system_event',
      category: type,
      data,
      timestamp: new Date().toISOString()
    };

    if (targetSockets instanceof Map) {
      // Activity subscriptions with filtering
      for (const [socketId, subscription] of targetSockets) {
        if (type === 'activity' && data.activity) {
          // Apply activity filters
          const filtered = this.getFilteredActivities(subscription.filters, 1);
          if (filtered.length === 0) continue;
        }

        const userId = subscription.userId;
        await webSocketService.sendCacheUpdateToUser(userId, {
          type: 'realtime_update',
          entity: 'system_event',
          entityId: type,
          userId,
          data: eventData,
          timestamp: new Date(),
          metadata: { category: type }
        });
      }
    } else {
      // Simple subscriptions
      for (const socketId of targetSockets) {
        // Get userId from subscription data (would need to be stored)
        // For now, broadcast to all WebSocket connections
        await this.broadcastToAllConnections(eventData);
      }
    }
  }

  private async broadcastToAllConnections(data: any): Promise<void> {
    // This would use WebSocket service to broadcast to all connections
    // Implementation depends on WebSocket service architecture
    logger.debug('Broadcasting system event to all connections', { type: data.category });
  }

  private calculateSystemStatus(alerts: SystemHealthAlert[]): 'healthy' | 'warning' | 'critical' {
    if (alerts.some(a => a.severity === 'critical')) return 'critical';
    if (alerts.some(a => a.severity === 'error' || a.severity === 'warning')) return 'warning';
    return 'healthy';
  }

  private calculateRiskLevel(alerts: SecurityAlert[]): 'low' | 'medium' | 'high' | 'critical' {
    if (alerts.some(a => a.severity === 'critical')) return 'critical';
    if (alerts.some(a => a.severity === 'high')) return 'high';
    if (alerts.some(a => a.severity === 'medium')) return 'medium';
    return 'low';
  }

  private getCurrentPerformanceMetrics(): PerformanceMetric[] {
    const allMetrics: PerformanceMetric[] = [];
    for (const metrics of this.performanceBuffer.values()) {
      if (metrics.length > 0) {
        allMetrics.push(metrics[0]); // Latest metric for each service
      }
    }
    return allMetrics;
  }

  private calculateSystemOverview(metrics: PerformanceMetric[]): {
    responseTime: number;
    throughput: number;
    errorRate: number;
    activeUsers: number;
  } {
    const responseTimeMetric = metrics.find(m => m.metricType === 'response_time');
    const throughputMetric = metrics.find(m => m.metricType === 'throughput');
    const errorRateMetric = metrics.find(m => m.metricType === 'error_rate');
    const activeUsersMetric = metrics.find(m => m.metricType === 'active_users');

    return {
      responseTime: responseTimeMetric?.value || 0,
      throughput: throughputMetric?.value || 0,
      errorRate: errorRateMetric?.value || 0,
      activeUsers: activeUsersMetric?.value || 0
    };
  }

  private generateId(type: string): string {
    return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async storeSubscriptionInRedis(type: string, socketId: string, data: any): Promise<void> {
    try {
      await redisClient.setex(
        `system_subscription:${type}:${socketId}`,
        3600, // 1 hour TTL
        JSON.stringify(data)
      );
    } catch (error) {
      logger.warn('Failed to store subscription in Redis', { error, type, socketId });
    }
  }

  private async storeActivityInRedis(activity: UserActivity): Promise<void> {
    try {
      await redisClient.lpush('system_activities', JSON.stringify(activity));
      await redisClient.ltrim('system_activities', 0, 999); // Keep last 1000
    } catch (error) {
      logger.warn('Failed to store activity in Redis', { error });
    }
  }

  private async storeAlertInRedis(type: 'health' | 'security', alert: SystemHealthAlert | SecurityAlert): Promise<void> {
    try {
      await redisClient.setex(
        `system_alert:${type}:${alert.alertId}`,
        86400, // 24 hours TTL
        JSON.stringify(alert)
      );
    } catch (error) {
      logger.warn('Failed to store alert in Redis', { error, type });
    }
  }

  private async storeMetricsInRedis(metrics: PerformanceMetric[]): Promise<void> {
    try {
      for (const metric of metrics) {
        await redisClient.lpush(`system_metrics:${metric.service}`, JSON.stringify(metric));
        await redisClient.ltrim(`system_metrics:${metric.service}`, 0, 99); // Keep last 100
      }
    } catch (error) {
      logger.warn('Failed to store metrics in Redis', { error });
    }
  }

  private setupSystemMonitoring(): void {
    // Monitor system health every 30 seconds
    setInterval(async () => {
      await this.collectSystemMetrics();
    }, 30 * 1000);

    // Monitor security events every 10 seconds
    setInterval(async () => {
      await this.checkSecurityEvents();
    }, 10 * 1000);
  }

  private async collectSystemMetrics(): Promise<void> {
    try {
      const metrics: PerformanceMetric[] = [];

      // CPU usage
      const cpuUsage = process.cpuUsage();
      metrics.push({
        metricId: this.generateId('metric'),
        metricType: 'cpu_usage',
        service: 'system',
        value: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
        unit: 'percent',
        threshold: { warning: 70, critical: 90 },
        trend: { direction: 'stable', percentage: 0, timeframe: '5m' },
        timestamp: new Date()
      });

      // Memory usage
      const memUsage = process.memoryUsage();
      metrics.push({
        metricId: this.generateId('metric'),
        metricType: 'memory_usage',
        service: 'system',
        value: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
        unit: 'percent',
        threshold: { warning: 80, critical: 95 },
        trend: { direction: 'stable', percentage: 0, timeframe: '5m' },
        timestamp: new Date()
      });

      await this.updatePerformanceMetrics(metrics);

    } catch (error) {
      logger.error('Failed to collect system metrics', { error });
    }
  }

  private async checkSecurityEvents(): Promise<void> {
    // This would check for security events in logs, database, etc.
    // For now, it's a placeholder
    logger.debug('Security event check completed');
  }

  private setupCleanupInterval(): void {
    // Clean up old data every hour
    setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000);
  }

  private cleanupOldData(): void {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean up old activities
    this.recentActivities = this.recentActivities.filter(
      activity => now.getTime() - activity.timestamp.getTime() < maxAge
    );

    // Clean up resolved alerts
    for (const [alertId, alert] of this.activeAlerts) {
      if ('resolved' in alert && alert.resolved && alert.resolvedAt) {
        if (now.getTime() - alert.resolvedAt.getTime() > maxAge) {
          this.activeAlerts.delete(alertId);
        }
      } else if ('resolvedAt' in alert && alert.resolvedAt) {
        if (now.getTime() - alert.resolvedAt.getTime() > maxAge) {
          this.activeAlerts.delete(alertId);
        }
      }
    }

    logger.debug('System event cleanup completed', {
      activitiesCount: this.recentActivities.length,
      alertsCount: this.activeAlerts.size
    });
  }
}

// Export singleton instance
export const systemEventService = new SystemEventService();
export default systemEventService;