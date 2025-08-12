/**
 * Notification Analytics Service
 * Comprehensive analytics and tracking for notifications
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import redisClient from '../config/redis';
import { 
  NotificationType,
  NotificationPriority,
  NotificationChannel,
  NotificationStatus
} from './notificationService';

export interface AnalyticsEvent {
  eventId: string;
  eventType: 'created' | 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 
             'dismissed' | 'failed' | 'bounced' | 'unsubscribed' | 'converted';
  notificationId: string;
  userId: string;
  channel?: NotificationChannel;
  timestamp: Date;
  metadata?: {
    deviceId?: string;
    platform?: string;
    location?: {
      country?: string;
      city?: string;
      region?: string;
    };
    userAgent?: string;
    ipAddress?: string;
    sessionId?: string;
    referrer?: string;
    customData?: Record<string, any>;
  };
  duration?: number; // Time to event in milliseconds
}

export interface NotificationAnalytics {
  notificationId: string;
  type: NotificationType;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  createdAt: Date;
  events: AnalyticsEvent[];
  metrics: {
    timeToDelivery?: number;
    timeToOpen?: number;
    timeToClick?: number;
    timeToConversion?: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    conversionRate: number;
    unsubscribeRate: number;
  };
  engagement: {
    opens: number;
    clicks: number;
    dismissals: number;
    conversions: number;
    interactions: number;
  };
  performance: {
    deliveryTime: number[];
    processingTime: number;
    queueTime: number;
  };
}

export interface AggregatedAnalytics {
  period: {
    start: Date;
    end: Date;
    duration: number; // milliseconds
  };
  summary: {
    totalNotifications: number;
    totalUsers: number;
    totalEvents: number;
    successRate: number;
    failureRate: number;
  };
  byType: Record<NotificationType, {
    count: number;
    delivered: number;
    opened: number;
    clicked: number;
    converted: number;
    failed: number;
  }>;
  byChannel: Record<NotificationChannel, {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    failed: number;
    avgDeliveryTime: number;
  }>;
  byPriority: Record<NotificationPriority, {
    count: number;
    deliveryRate: number;
    openRate: number;
  }>;
  engagement: {
    totalOpens: number;
    totalClicks: number;
    totalConversions: number;
    uniqueOpens: number;
    uniqueClicks: number;
    avgTimeToOpen: number;
    avgTimeToClick: number;
  };
  performance: {
    avgDeliveryTime: number;
    avgProcessingTime: number;
    avgQueueTime: number;
    p50DeliveryTime: number;
    p95DeliveryTime: number;
    p99DeliveryTime: number;
  };
  trends: {
    hourly: number[];
    daily: number[];
    weekly: number[];
  };
}

export interface UserEngagement {
  userId: string;
  period: { start: Date; end: Date };
  notifications: {
    received: number;
    opened: number;
    clicked: number;
    dismissed: number;
    converted: number;
  };
  engagement: {
    openRate: number;
    clickRate: number;
    conversionRate: number;
    avgTimeToOpen: number;
    avgTimeToClick: number;
    preferredChannel?: NotificationChannel;
    activeHours: number[]; // 24 hours
    activeDays: number[]; // 7 days
  };
  preferences: {
    optedOutChannels: NotificationChannel[];
    mutedTypes: NotificationType[];
    quietHours?: { start: string; end: string };
  };
  score: number; // Engagement score 0-100
}

export interface CampaignAnalytics {
  campaignId: string;
  name: string;
  startDate: Date;
  endDate?: Date;
  status: 'active' | 'completed' | 'paused';
  notifications: string[]; // Notification IDs
  metrics: {
    reach: number; // Unique users
    impressions: number; // Total notifications
    engagement: number; // Opens + clicks
    conversions: number;
    roi?: number;
  };
  funnel: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    converted: number;
  };
  segments?: Record<string, {
    users: number;
    engagement: number;
    conversionRate: number;
  }>;
}

export interface RealtimeMetrics {
  timestamp: Date;
  interval: number; // seconds
  notifications: {
    sent: number;
    delivered: number;
    failed: number;
    queued: number;
  };
  engagement: {
    opens: number;
    clicks: number;
    conversions: number;
  };
  performance: {
    avgDeliveryTime: number;
    errorRate: number;
    throughput: number; // notifications per second
  };
  activeUsers: number;
  activeChannels: NotificationChannel[];
}

/**
 * Notification Analytics Service Class
 */
class NotificationAnalyticsService extends EventEmitter {
  private events = new Map<string, AnalyticsEvent[]>();
  private notificationAnalytics = new Map<string, NotificationAnalytics>();
  private userEngagement = new Map<string, UserEngagement>();
  private campaigns = new Map<string, CampaignAnalytics>();
  private realtimeMetrics: RealtimeMetrics | null = null;
  
  private readonly eventRetentionDays = 90;
  private readonly aggregationInterval = 300000; // 5 minutes
  private readonly realtimeInterval = 10000; // 10 seconds
  
  private aggregationTimer: NodeJS.Timeout | null = null;
  private realtimeTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.initializeService();
  }

  /**
   * Initialize analytics service
   */
  private async initializeService(): Promise<void> {
    try {
      // Load historical data
      await this.loadHistoricalData();
      
      // Start aggregation timer
      this.startAggregationTimer();
      
      // Start realtime metrics collection
      this.startRealtimeMetrics();
      
      logger.info('✅ Notification analytics service initialized');
      
    } catch (error) {
      logger.error('❌ Failed to initialize analytics service', { error });
      throw error;
    }
  }

  /**
   * Track analytics event
   */
  async trackEvent(event: Omit<AnalyticsEvent, 'eventId'>): Promise<void> {
    try {
      const analyticsEvent: AnalyticsEvent = {
        ...event,
        eventId: this.generateEventId(),
        timestamp: event.timestamp || new Date()
      };
      
      // Store event
      await this.storeEvent(analyticsEvent);
      
      // Update notification analytics
      await this.updateNotificationAnalytics(analyticsEvent);
      
      // Update user engagement
      await this.updateUserEngagement(analyticsEvent);
      
      // Update realtime metrics
      this.updateRealtimeMetrics(analyticsEvent);
      
      // Emit event for real-time dashboards
      this.emit('analyticsEvent', analyticsEvent);
      
      logger.debug('Analytics event tracked', {
        eventType: analyticsEvent.eventType,
        notificationId: analyticsEvent.notificationId
      });
      
    } catch (error) {
      logger.error('Failed to track analytics event', { error, event });
    }
  }

  /**
   * Get notification analytics
   */
  async getNotificationAnalytics(
    notificationId: string
  ): Promise<NotificationAnalytics | null> {
    try {
      // Check cache
      let analytics = this.notificationAnalytics.get(notificationId);
      
      if (!analytics) {
        // Load from storage
        analytics = await this.loadNotificationAnalytics(notificationId);
        
        if (analytics) {
          this.notificationAnalytics.set(notificationId, analytics);
        }
      }
      
      return analytics;
      
    } catch (error) {
      logger.error('Failed to get notification analytics', { error, notificationId });
      return null;
    }
  }

  /**
   * Get aggregated analytics
   */
  async getAggregatedAnalytics(
    period: { start: Date; end: Date },
    options?: {
      groupBy?: 'hour' | 'day' | 'week' | 'month';
      types?: NotificationType[];
      channels?: NotificationChannel[];
      priorities?: NotificationPriority[];
    }
  ): Promise<AggregatedAnalytics> {
    try {
      const events = await this.getEventsForPeriod(period);
      
      // Apply filters
      let filteredEvents = events;
      
      if (options?.types) {
        filteredEvents = filteredEvents.filter(e => {
          const notification = this.notificationAnalytics.get(e.notificationId);
          return notification && options.types!.includes(notification.type);
        });
      }
      
      if (options?.channels) {
        filteredEvents = filteredEvents.filter(e => 
          e.channel && options.channels!.includes(e.channel)
        );
      }
      
      // Calculate aggregated metrics
      const aggregated = this.calculateAggregatedMetrics(filteredEvents, period);
      
      // Add trends
      aggregated.trends = await this.calculateTrends(period, options?.groupBy);
      
      return aggregated;
      
    } catch (error) {
      logger.error('Failed to get aggregated analytics', { error });
      throw error;
    }
  }

  /**
   * Get user engagement analytics
   */
  async getUserEngagement(
    userId: string,
    period?: { start: Date; end: Date }
  ): Promise<UserEngagement> {
    try {
      const effectivePeriod = period || {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days
        end: new Date()
      };
      
      // Get user events
      const userEvents = await this.getUserEvents(userId, effectivePeriod);
      
      // Calculate engagement metrics
      const engagement = this.calculateUserEngagement(userId, userEvents, effectivePeriod);
      
      // Cache result
      this.userEngagement.set(userId, engagement);
      
      return engagement;
      
    } catch (error) {
      logger.error('Failed to get user engagement', { error, userId });
      throw error;
    }
  }

  /**
   * Create campaign
   */
  async createCampaign(campaign: {
    name: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<CampaignAnalytics> {
    try {
      const campaignId = this.generateCampaignId();
      
      const newCampaign: CampaignAnalytics = {
        campaignId,
        name: campaign.name,
        startDate: campaign.startDate || new Date(),
        endDate: campaign.endDate,
        status: 'active',
        notifications: [],
        metrics: {
          reach: 0,
          impressions: 0,
          engagement: 0,
          conversions: 0
        },
        funnel: {
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          converted: 0
        }
      };
      
      this.campaigns.set(campaignId, newCampaign);
      await this.storeCampaign(newCampaign);
      
      logger.info('Campaign created', { campaignId, name: campaign.name });
      
      return newCampaign;
      
    } catch (error) {
      logger.error('Failed to create campaign', { error });
      throw error;
    }
  }

  /**
   * Add notification to campaign
   */
  async addToCampaign(
    campaignId: string,
    notificationId: string
  ): Promise<void> {
    try {
      const campaign = this.campaigns.get(campaignId);
      
      if (!campaign) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }
      
      if (!campaign.notifications.includes(notificationId)) {
        campaign.notifications.push(notificationId);
        await this.storeCampaign(campaign);
        
        // Update campaign metrics
        await this.updateCampaignMetrics(campaign);
      }
      
      logger.debug('Notification added to campaign', { campaignId, notificationId });
      
    } catch (error) {
      logger.error('Failed to add to campaign', { error, campaignId, notificationId });
      throw error;
    }
  }

  /**
   * Get campaign analytics
   */
  async getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics | null> {
    try {
      const campaign = this.campaigns.get(campaignId);
      
      if (!campaign) {
        return null;
      }
      
      // Update metrics
      await this.updateCampaignMetrics(campaign);
      
      return campaign;
      
    } catch (error) {
      logger.error('Failed to get campaign analytics', { error, campaignId });
      return null;
    }
  }

  /**
   * Get realtime metrics
   */
  getRealtimeMetrics(): RealtimeMetrics | null {
    return this.realtimeMetrics;
  }

  /**
   * Generate funnel report
   */
  async generateFunnelReport(
    notificationIds: string[]
  ): Promise<{
    stages: Array<{
      name: string;
      count: number;
      percentage: number;
      dropoff: number;
    }>;
    conversionRate: number;
    avgTimeToConversion: number;
  }> {
    try {
      const stages = [
        { name: 'Sent', key: 'sent' },
        { name: 'Delivered', key: 'delivered' },
        { name: 'Opened', key: 'opened' },
        { name: 'Clicked', key: 'clicked' },
        { name: 'Converted', key: 'converted' }
      ];
      
      const counts: Record<string, Set<string>> = {
        sent: new Set(),
        delivered: new Set(),
        opened: new Set(),
        clicked: new Set(),
        converted: new Set()
      };
      
      // Count events for each stage
      for (const notificationId of notificationIds) {
        const analytics = await this.getNotificationAnalytics(notificationId);
        
        if (analytics) {
          counts.sent.add(notificationId);
          
          const hasEvent = (type: string) => 
            analytics.events.some(e => e.eventType === type);
          
          if (hasEvent('delivered')) counts.delivered.add(notificationId);
          if (hasEvent('opened')) counts.opened.add(notificationId);
          if (hasEvent('clicked')) counts.clicked.add(notificationId);
          if (hasEvent('converted')) counts.converted.add(notificationId);
        }
      }
      
      // Calculate funnel metrics
      const funnelStages = stages.map((stage, index) => {
        const count = counts[stage.key].size;
        const percentage = counts.sent.size > 0 ? 
          (count / counts.sent.size) * 100 : 0;
        
        const previousCount = index > 0 ? 
          counts[stages[index - 1].key].size : count;
        
        const dropoff = previousCount > 0 ? 
          ((previousCount - count) / previousCount) * 100 : 0;
        
        return {
          name: stage.name,
          count,
          percentage,
          dropoff
        };
      });
      
      const conversionRate = counts.sent.size > 0 ? 
        (counts.converted.size / counts.sent.size) * 100 : 0;
      
      // Calculate average time to conversion
      let totalTime = 0;
      let conversionCount = 0;
      
      for (const notificationId of counts.converted) {
        const analytics = await this.getNotificationAnalytics(notificationId);
        if (analytics?.metrics.timeToConversion) {
          totalTime += analytics.metrics.timeToConversion;
          conversionCount++;
        }
      }
      
      const avgTimeToConversion = conversionCount > 0 ? 
        totalTime / conversionCount : 0;
      
      return {
        stages: funnelStages,
        conversionRate,
        avgTimeToConversion
      };
      
    } catch (error) {
      logger.error('Failed to generate funnel report', { error });
      throw error;
    }
  }

  /**
   * Get top performing notifications
   */
  async getTopPerformers(
    metric: 'opens' | 'clicks' | 'conversions',
    period: { start: Date; end: Date },
    limit: number = 10
  ): Promise<Array<{
    notificationId: string;
    type: NotificationType;
    value: number;
    rate: number;
  }>> {
    try {
      const notifications = await this.getNotificationsForPeriod(period);
      
      const performers = notifications
        .map(notification => {
          let value = 0;
          let rate = 0;
          
          switch (metric) {
            case 'opens':
              value = notification.engagement.opens;
              rate = notification.metrics.openRate;
              break;
            case 'clicks':
              value = notification.engagement.clicks;
              rate = notification.metrics.clickRate;
              break;
            case 'conversions':
              value = notification.engagement.conversions;
              rate = notification.metrics.conversionRate;
              break;
          }
          
          return {
            notificationId: notification.notificationId,
            type: notification.type,
            value,
            rate
          };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, limit);
      
      return performers;
      
    } catch (error) {
      logger.error('Failed to get top performers', { error });
      throw error;
    }
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(
    period: { start: Date; end: Date },
    format: 'json' | 'csv'
  ): Promise<string> {
    try {
      const analytics = await this.getAggregatedAnalytics(period);
      
      if (format === 'json') {
        return JSON.stringify(analytics, null, 2);
      } else if (format === 'csv') {
        return this.convertToCSV(analytics);
      }
      
      throw new Error(`Unsupported format: ${format}`);
      
    } catch (error) {
      logger.error('Failed to export analytics', { error });
      throw error;
    }
  }

  // Private helper methods

  private async updateNotificationAnalytics(event: AnalyticsEvent): Promise<void> {
    let analytics = this.notificationAnalytics.get(event.notificationId);
    
    if (!analytics) {
      // Create new analytics entry
      analytics = {
        notificationId: event.notificationId,
        type: 'system' as NotificationType, // Default, should be updated
        priority: 'medium' as NotificationPriority, // Default
        channels: [],
        createdAt: new Date(),
        events: [],
        metrics: {
          deliveryRate: 0,
          openRate: 0,
          clickRate: 0,
          conversionRate: 0,
          unsubscribeRate: 0
        },
        engagement: {
          opens: 0,
          clicks: 0,
          dismissals: 0,
          conversions: 0,
          interactions: 0
        },
        performance: {
          deliveryTime: [],
          processingTime: 0,
          queueTime: 0
        }
      };
    }
    
    // Add event
    analytics.events.push(event);
    
    // Update metrics based on event type
    switch (event.eventType) {
      case 'delivered':
        if (event.duration) {
          analytics.metrics.timeToDelivery = event.duration;
          analytics.performance.deliveryTime.push(event.duration);
        }
        break;
        
      case 'opened':
        analytics.engagement.opens++;
        if (event.duration) {
          analytics.metrics.timeToOpen = event.duration;
        }
        break;
        
      case 'clicked':
        analytics.engagement.clicks++;
        analytics.engagement.interactions++;
        if (event.duration) {
          analytics.metrics.timeToClick = event.duration;
        }
        break;
        
      case 'converted':
        analytics.engagement.conversions++;
        if (event.duration) {
          analytics.metrics.timeToConversion = event.duration;
        }
        break;
        
      case 'dismissed':
        analytics.engagement.dismissals++;
        break;
    }
    
    // Calculate rates
    const totalSent = analytics.events.filter(e => e.eventType === 'sent').length;
    
    if (totalSent > 0) {
      const delivered = analytics.events.filter(e => e.eventType === 'delivered').length;
      const opened = analytics.engagement.opens;
      const clicked = analytics.engagement.clicks;
      const converted = analytics.engagement.conversions;
      const unsubscribed = analytics.events.filter(e => e.eventType === 'unsubscribed').length;
      
      analytics.metrics.deliveryRate = delivered / totalSent;
      analytics.metrics.openRate = opened / totalSent;
      analytics.metrics.clickRate = clicked / totalSent;
      analytics.metrics.conversionRate = converted / totalSent;
      analytics.metrics.unsubscribeRate = unsubscribed / totalSent;
    }
    
    // Store updated analytics
    this.notificationAnalytics.set(event.notificationId, analytics);
    await this.storeNotificationAnalytics(analytics);
  }

  private async updateUserEngagement(event: AnalyticsEvent): Promise<void> {
    const userId = event.userId;
    let engagement = this.userEngagement.get(userId);
    
    if (!engagement) {
      engagement = {
        userId,
        period: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date()
        },
        notifications: {
          received: 0,
          opened: 0,
          clicked: 0,
          dismissed: 0,
          converted: 0
        },
        engagement: {
          openRate: 0,
          clickRate: 0,
          conversionRate: 0,
          avgTimeToOpen: 0,
          avgTimeToClick: 0,
          activeHours: new Array(24).fill(0),
          activeDays: new Array(7).fill(0)
        },
        preferences: {
          optedOutChannels: [],
          mutedTypes: []
        },
        score: 0
      };
    }
    
    // Update based on event type
    switch (event.eventType) {
      case 'sent':
        engagement.notifications.received++;
        break;
      case 'opened':
        engagement.notifications.opened++;
        break;
      case 'clicked':
        engagement.notifications.clicked++;
        break;
      case 'dismissed':
        engagement.notifications.dismissed++;
        break;
      case 'converted':
        engagement.notifications.converted++;
        break;
    }
    
    // Update active times
    const hour = event.timestamp.getHours();
    const day = event.timestamp.getDay();
    engagement.engagement.activeHours[hour]++;
    engagement.engagement.activeDays[day]++;
    
    // Calculate rates
    if (engagement.notifications.received > 0) {
      engagement.engagement.openRate = 
        engagement.notifications.opened / engagement.notifications.received;
      engagement.engagement.clickRate = 
        engagement.notifications.clicked / engagement.notifications.received;
      engagement.engagement.conversionRate = 
        engagement.notifications.converted / engagement.notifications.received;
    }
    
    // Calculate engagement score (0-100)
    engagement.score = this.calculateEngagementScore(engagement);
    
    // Store updated engagement
    this.userEngagement.set(userId, engagement);
    await this.storeUserEngagement(engagement);
  }

  private updateRealtimeMetrics(event: AnalyticsEvent): void {
    if (!this.realtimeMetrics) {
      this.realtimeMetrics = {
        timestamp: new Date(),
        interval: this.realtimeInterval / 1000,
        notifications: {
          sent: 0,
          delivered: 0,
          failed: 0,
          queued: 0
        },
        engagement: {
          opens: 0,
          clicks: 0,
          conversions: 0
        },
        performance: {
          avgDeliveryTime: 0,
          errorRate: 0,
          throughput: 0
        },
        activeUsers: 0,
        activeChannels: []
      };
    }
    
    // Update based on event type
    switch (event.eventType) {
      case 'sent':
        this.realtimeMetrics.notifications.sent++;
        break;
      case 'delivered':
        this.realtimeMetrics.notifications.delivered++;
        break;
      case 'failed':
        this.realtimeMetrics.notifications.failed++;
        break;
      case 'opened':
        this.realtimeMetrics.engagement.opens++;
        break;
      case 'clicked':
        this.realtimeMetrics.engagement.clicks++;
        break;
      case 'converted':
        this.realtimeMetrics.engagement.conversions++;
        break;
    }
    
    // Update active channels
    if (event.channel && !this.realtimeMetrics.activeChannels.includes(event.channel)) {
      this.realtimeMetrics.activeChannels.push(event.channel);
    }
  }

  private async updateCampaignMetrics(campaign: CampaignAnalytics): Promise<void> {
    const uniqueUsers = new Set<string>();
    let totalEngagement = 0;
    
    campaign.funnel = {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      converted: 0
    };
    
    for (const notificationId of campaign.notifications) {
      const analytics = await this.getNotificationAnalytics(notificationId);
      
      if (analytics) {
        // Count unique users
        analytics.events.forEach(e => uniqueUsers.add(e.userId));
        
        // Update funnel
        const hasSent = analytics.events.some(e => e.eventType === 'sent');
        const hasDelivered = analytics.events.some(e => e.eventType === 'delivered');
        const hasOpened = analytics.events.some(e => e.eventType === 'opened');
        const hasClicked = analytics.events.some(e => e.eventType === 'clicked');
        const hasConverted = analytics.events.some(e => e.eventType === 'converted');
        
        if (hasSent) campaign.funnel.sent++;
        if (hasDelivered) campaign.funnel.delivered++;
        if (hasOpened) campaign.funnel.opened++;
        if (hasClicked) campaign.funnel.clicked++;
        if (hasConverted) campaign.funnel.converted++;
        
        totalEngagement += analytics.engagement.opens + analytics.engagement.clicks;
      }
    }
    
    campaign.metrics.reach = uniqueUsers.size;
    campaign.metrics.impressions = campaign.notifications.length;
    campaign.metrics.engagement = totalEngagement;
    campaign.metrics.conversions = campaign.funnel.converted;
    
    await this.storeCampaign(campaign);
  }

  private calculateAggregatedMetrics(
    events: AnalyticsEvent[],
    period: { start: Date; end: Date }
  ): AggregatedAnalytics {
    const uniqueUsers = new Set<string>();
    const uniqueNotifications = new Set<string>();
    
    const aggregated: AggregatedAnalytics = {
      period: {
        start: period.start,
        end: period.end,
        duration: period.end.getTime() - period.start.getTime()
      },
      summary: {
        totalNotifications: 0,
        totalUsers: 0,
        totalEvents: events.length,
        successRate: 0,
        failureRate: 0
      },
      byType: {} as any,
      byChannel: {} as any,
      byPriority: {} as any,
      engagement: {
        totalOpens: 0,
        totalClicks: 0,
        totalConversions: 0,
        uniqueOpens: 0,
        uniqueClicks: 0,
        avgTimeToOpen: 0,
        avgTimeToClick: 0
      },
      performance: {
        avgDeliveryTime: 0,
        avgProcessingTime: 0,
        avgQueueTime: 0,
        p50DeliveryTime: 0,
        p95DeliveryTime: 0,
        p99DeliveryTime: 0
      },
      trends: {
        hourly: [],
        daily: [],
        weekly: []
      }
    };
    
    // Process events
    const deliveryTimes: number[] = [];
    let totalTimeToOpen = 0;
    let openCount = 0;
    let totalTimeToClick = 0;
    let clickCount = 0;
    
    for (const event of events) {
      uniqueUsers.add(event.userId);
      uniqueNotifications.add(event.notificationId);
      
      // Count by event type
      switch (event.eventType) {
        case 'opened':
          aggregated.engagement.totalOpens++;
          if (event.duration) {
            totalTimeToOpen += event.duration;
            openCount++;
          }
          break;
        case 'clicked':
          aggregated.engagement.totalClicks++;
          if (event.duration) {
            totalTimeToClick += event.duration;
            clickCount++;
          }
          break;
        case 'converted':
          aggregated.engagement.totalConversions++;
          break;
        case 'delivered':
          if (event.duration) {
            deliveryTimes.push(event.duration);
          }
          break;
      }
      
      // Count by channel
      if (event.channel) {
        if (!aggregated.byChannel[event.channel]) {
          aggregated.byChannel[event.channel] = {
            sent: 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
            failed: 0,
            avgDeliveryTime: 0
          };
        }
        
        switch (event.eventType) {
          case 'sent':
            aggregated.byChannel[event.channel].sent++;
            break;
          case 'delivered':
            aggregated.byChannel[event.channel].delivered++;
            break;
          case 'opened':
            aggregated.byChannel[event.channel].opened++;
            break;
          case 'clicked':
            aggregated.byChannel[event.channel].clicked++;
            break;
          case 'failed':
            aggregated.byChannel[event.channel].failed++;
            break;
        }
      }
    }
    
    // Update summary
    aggregated.summary.totalNotifications = uniqueNotifications.size;
    aggregated.summary.totalUsers = uniqueUsers.size;
    
    // Calculate averages
    if (openCount > 0) {
      aggregated.engagement.avgTimeToOpen = totalTimeToOpen / openCount;
    }
    
    if (clickCount > 0) {
      aggregated.engagement.avgTimeToClick = totalTimeToClick / clickCount;
    }
    
    // Calculate delivery time percentiles
    if (deliveryTimes.length > 0) {
      deliveryTimes.sort((a, b) => a - b);
      
      aggregated.performance.avgDeliveryTime = 
        deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length;
      
      aggregated.performance.p50DeliveryTime = 
        this.getPercentile(deliveryTimes, 50);
      
      aggregated.performance.p95DeliveryTime = 
        this.getPercentile(deliveryTimes, 95);
      
      aggregated.performance.p99DeliveryTime = 
        this.getPercentile(deliveryTimes, 99);
    }
    
    return aggregated;
  }

  private calculateUserEngagement(
    userId: string,
    events: AnalyticsEvent[],
    period: { start: Date; end: Date }
  ): UserEngagement {
    const engagement: UserEngagement = {
      userId,
      period,
      notifications: {
        received: 0,
        opened: 0,
        clicked: 0,
        dismissed: 0,
        converted: 0
      },
      engagement: {
        openRate: 0,
        clickRate: 0,
        conversionRate: 0,
        avgTimeToOpen: 0,
        avgTimeToClick: 0,
        activeHours: new Array(24).fill(0),
        activeDays: new Array(7).fill(0)
      },
      preferences: {
        optedOutChannels: [],
        mutedTypes: []
      },
      score: 0
    };
    
    let totalTimeToOpen = 0;
    let openCount = 0;
    let totalTimeToClick = 0;
    let clickCount = 0;
    
    for (const event of events) {
      switch (event.eventType) {
        case 'sent':
          engagement.notifications.received++;
          break;
        case 'opened':
          engagement.notifications.opened++;
          if (event.duration) {
            totalTimeToOpen += event.duration;
            openCount++;
          }
          break;
        case 'clicked':
          engagement.notifications.clicked++;
          if (event.duration) {
            totalTimeToClick += event.duration;
            clickCount++;
          }
          break;
        case 'dismissed':
          engagement.notifications.dismissed++;
          break;
        case 'converted':
          engagement.notifications.converted++;
          break;
      }
      
      // Track active times
      const hour = event.timestamp.getHours();
      const day = event.timestamp.getDay();
      engagement.engagement.activeHours[hour]++;
      engagement.engagement.activeDays[day]++;
    }
    
    // Calculate rates
    if (engagement.notifications.received > 0) {
      engagement.engagement.openRate = 
        engagement.notifications.opened / engagement.notifications.received;
      engagement.engagement.clickRate = 
        engagement.notifications.clicked / engagement.notifications.received;
      engagement.engagement.conversionRate = 
        engagement.notifications.converted / engagement.notifications.received;
    }
    
    // Calculate average times
    if (openCount > 0) {
      engagement.engagement.avgTimeToOpen = totalTimeToOpen / openCount;
    }
    
    if (clickCount > 0) {
      engagement.engagement.avgTimeToClick = totalTimeToClick / clickCount;
    }
    
    // Determine preferred channel
    const channelCounts = new Map<NotificationChannel, number>();
    
    for (const event of events) {
      if (event.channel && event.eventType === 'opened') {
        channelCounts.set(
          event.channel,
          (channelCounts.get(event.channel) || 0) + 1
        );
      }
    }
    
    if (channelCounts.size > 0) {
      const sorted = Array.from(channelCounts.entries())
        .sort((a, b) => b[1] - a[1]);
      engagement.engagement.preferredChannel = sorted[0][0];
    }
    
    // Calculate engagement score
    engagement.score = this.calculateEngagementScore(engagement);
    
    return engagement;
  }

  private calculateEngagementScore(engagement: UserEngagement): number {
    // Weighted scoring based on engagement metrics
    const weights = {
      openRate: 30,
      clickRate: 40,
      conversionRate: 30
    };
    
    const score = 
      (engagement.engagement.openRate * weights.openRate) +
      (engagement.engagement.clickRate * weights.clickRate) +
      (engagement.engagement.conversionRate * weights.conversionRate);
    
    return Math.min(100, Math.round(score));
  }

  private async calculateTrends(
    period: { start: Date; end: Date },
    groupBy?: 'hour' | 'day' | 'week' | 'month'
  ): Promise<{ hourly: number[]; daily: number[]; weekly: number[] }> {
    // Implementation would calculate trends based on historical data
    return {
      hourly: new Array(24).fill(0),
      daily: new Array(7).fill(0),
      weekly: new Array(4).fill(0)
    };
  }

  private getPercentile(values: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[Math.max(0, index)];
  }

  private convertToCSV(analytics: AggregatedAnalytics): string {
    // Simple CSV conversion
    const rows: string[] = [];
    
    rows.push('Metric,Value');
    rows.push(`Total Notifications,${analytics.summary.totalNotifications}`);
    rows.push(`Total Users,${analytics.summary.totalUsers}`);
    rows.push(`Total Events,${analytics.summary.totalEvents}`);
    rows.push(`Total Opens,${analytics.engagement.totalOpens}`);
    rows.push(`Total Clicks,${analytics.engagement.totalClicks}`);
    rows.push(`Total Conversions,${analytics.engagement.totalConversions}`);
    rows.push(`Average Delivery Time,${analytics.performance.avgDeliveryTime}`);
    
    return rows.join('\n');
  }

  private startAggregationTimer(): void {
    this.aggregationTimer = setInterval(() => {
      this.aggregateMetrics();
    }, this.aggregationInterval);
  }

  private startRealtimeMetrics(): void {
    this.realtimeTimer = setInterval(() => {
      this.resetRealtimeMetrics();
    }, this.realtimeInterval);
  }

  private async aggregateMetrics(): Promise<void> {
    try {
      // Aggregate and store metrics periodically
      const period = {
        start: new Date(Date.now() - this.aggregationInterval),
        end: new Date()
      };
      
      const aggregated = await this.getAggregatedAnalytics(period);
      await this.storeAggregatedAnalytics(aggregated);
      
    } catch (error) {
      logger.error('Failed to aggregate metrics', { error });
    }
  }

  private resetRealtimeMetrics(): void {
    if (this.realtimeMetrics) {
      // Calculate throughput
      const interval = this.realtimeInterval / 1000;
      this.realtimeMetrics.performance.throughput = 
        this.realtimeMetrics.notifications.sent / interval;
      
      // Calculate error rate
      const total = this.realtimeMetrics.notifications.sent;
      if (total > 0) {
        this.realtimeMetrics.performance.errorRate = 
          this.realtimeMetrics.notifications.failed / total;
      }
      
      // Emit realtime metrics
      this.emit('realtimeMetrics', this.realtimeMetrics);
      
      // Reset for next interval
      this.realtimeMetrics = {
        timestamp: new Date(),
        interval,
        notifications: {
          sent: 0,
          delivered: 0,
          failed: 0,
          queued: 0
        },
        engagement: {
          opens: 0,
          clicks: 0,
          conversions: 0
        },
        performance: {
          avgDeliveryTime: 0,
          errorRate: 0,
          throughput: 0
        },
        activeUsers: 0,
        activeChannels: []
      };
    }
  }

  private async loadHistoricalData(): Promise<void> {
    // Load recent events
    const events = await redisClient.lrange('analytics_events', 0, 999);
    
    for (const eventData of events) {
      const event = JSON.parse(eventData);
      event.timestamp = new Date(event.timestamp);
      
      if (!this.events.has(event.notificationId)) {
        this.events.set(event.notificationId, []);
      }
      
      this.events.get(event.notificationId)!.push(event);
    }
    
    // Load campaigns
    const campaigns = await redisClient.hgetall('analytics_campaigns');
    
    for (const [campaignId, data] of Object.entries(campaigns)) {
      const campaign = JSON.parse(data);
      campaign.startDate = new Date(campaign.startDate);
      if (campaign.endDate) {
        campaign.endDate = new Date(campaign.endDate);
      }
      
      this.campaigns.set(campaignId, campaign);
    }
    
    logger.info('Historical analytics data loaded', {
      events: this.events.size,
      campaigns: this.campaigns.size
    });
  }

  private async storeEvent(event: AnalyticsEvent): Promise<void> {
    // Add to in-memory collection
    if (!this.events.has(event.notificationId)) {
      this.events.set(event.notificationId, []);
    }
    
    this.events.get(event.notificationId)!.push(event);
    
    // Store in Redis
    await redisClient.lpush('analytics_events', JSON.stringify(event));
    
    // Trim to keep only recent events
    await redisClient.ltrim('analytics_events', 0, 9999);
    
    // Set expiry for event data
    const key = `analytics_event:${event.eventId}`;
    await redisClient.set(key, JSON.stringify(event));
    await redisClient.expire(key, this.eventRetentionDays * 24 * 60 * 60);
  }

  private async loadNotificationAnalytics(
    notificationId: string
  ): Promise<NotificationAnalytics | null> {
    const data = await redisClient.hget('notification_analytics', notificationId);
    
    if (data) {
      const analytics = JSON.parse(data);
      analytics.createdAt = new Date(analytics.createdAt);
      analytics.events = analytics.events.map((e: any) => ({
        ...e,
        timestamp: new Date(e.timestamp)
      }));
      
      return analytics;
    }
    
    return null;
  }

  private async storeNotificationAnalytics(analytics: NotificationAnalytics): Promise<void> {
    await redisClient.hset(
      'notification_analytics',
      analytics.notificationId,
      JSON.stringify(analytics)
    );
  }

  private async storeUserEngagement(engagement: UserEngagement): Promise<void> {
    await redisClient.hset(
      'user_engagement',
      engagement.userId,
      JSON.stringify(engagement)
    );
  }

  private async storeCampaign(campaign: CampaignAnalytics): Promise<void> {
    await redisClient.hset(
      'analytics_campaigns',
      campaign.campaignId,
      JSON.stringify(campaign)
    );
  }

  private async storeAggregatedAnalytics(analytics: AggregatedAnalytics): Promise<void> {
    const key = `aggregated_analytics:${analytics.period.start.getTime()}`;
    await redisClient.set(key, JSON.stringify(analytics));
    await redisClient.expire(key, 30 * 24 * 60 * 60); // 30 days
  }

  private async getEventsForPeriod(
    period: { start: Date; end: Date }
  ): Promise<AnalyticsEvent[]> {
    const allEvents: AnalyticsEvent[] = [];
    
    for (const events of this.events.values()) {
      const periodEvents = events.filter(e => 
        e.timestamp >= period.start && e.timestamp <= period.end
      );
      
      allEvents.push(...periodEvents);
    }
    
    return allEvents;
  }

  private async getUserEvents(
    userId: string,
    period: { start: Date; end: Date }
  ): Promise<AnalyticsEvent[]> {
    const userEvents: AnalyticsEvent[] = [];
    
    for (const events of this.events.values()) {
      const filtered = events.filter(e => 
        e.userId === userId &&
        e.timestamp >= period.start && 
        e.timestamp <= period.end
      );
      
      userEvents.push(...filtered);
    }
    
    return userEvents;
  }

  private async getNotificationsForPeriod(
    period: { start: Date; end: Date }
  ): Promise<NotificationAnalytics[]> {
    const notifications: NotificationAnalytics[] = [];
    
    for (const analytics of this.notificationAnalytics.values()) {
      if (analytics.createdAt >= period.start && analytics.createdAt <= period.end) {
        notifications.push(analytics);
      }
    }
    
    return notifications;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCampaignId(): string {
    return `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public cleanup method
  async cleanup(): Promise<void> {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
    }
    
    if (this.realtimeTimer) {
      clearInterval(this.realtimeTimer);
      this.realtimeTimer = null;
    }
  }
}

// Export singleton instance
export const notificationAnalyticsService = new NotificationAnalyticsService();
export default notificationAnalyticsService;