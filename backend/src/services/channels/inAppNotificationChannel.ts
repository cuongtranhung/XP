/**
 * In-App Notification Channel
 * Real-time WebSocket-based notification delivery
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import redisClient from '../../config/redis';
import { 
  NotificationData,
  NotificationChannel,
  NotificationPriority 
} from '../notificationService';
import { getIO } from '../webSocketService';
import notificationTemplateService, { 
  PersonalizationContext,
  TemplateRenderResult 
} from '../notificationTemplateService';

export interface InAppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  icon?: string;
  image?: string;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
    primary?: boolean;
  }>;
  data?: Record<string, any>;
  priority: NotificationPriority;
  timestamp: Date;
  read: boolean;
  readAt?: Date;
  dismissed: boolean;
  dismissedAt?: Date;
  expiresAt?: Date;
  category?: string;
  sound?: string;
  vibrate?: number[];
  badge?: number;
  tag?: string;
  requireInteraction?: boolean;
  renotify?: boolean;
  silent?: boolean;
}

export interface InAppDeliveryResult {
  success: boolean;
  notificationId: string;
  deliveredTo: string[];
  failedTo: string[];
  timestamp: Date;
  realtime: boolean;
  stored: boolean;
  error?: {
    code: string;
    message: string;
  };
}

export interface InAppChannelConfig {
  maxNotificationsPerUser: number;
  retentionDays: number;
  enableRealtime: boolean;
  enablePersistence: boolean;
  enableBadges: boolean;
  enableSounds: boolean;
  groupingStrategy: 'none' | 'category' | 'type' | 'smart';
  autoMarkAsRead: boolean;
  autoMarkAsReadDelay: number; // milliseconds
  maxRealtimeRetries: number;
  fallbackToPersistence: boolean;
}

export interface InAppMetrics {
  delivered: number;
  read: number;
  dismissed: number;
  expired: number;
  interacted: number;
  failed: number;
  avgTimeToRead: number;
  avgTimeToInteract: number;
  readRate: number;
  interactionRate: number;
}

/**
 * In-App Notification Channel Class
 */
class InAppNotificationChannel extends EventEmitter {
  private config: InAppChannelConfig = {
    maxNotificationsPerUser: 100,
    retentionDays: 30,
    enableRealtime: true,
    enablePersistence: true,
    enableBadges: true,
    enableSounds: true,
    groupingStrategy: 'smart',
    autoMarkAsRead: false,
    autoMarkAsReadDelay: 0,
    maxRealtimeRetries: 3,
    fallbackToPersistence: true
  };
  
  private metrics: InAppMetrics = {
    delivered: 0,
    read: 0,
    dismissed: 0,
    expired: 0,
    interacted: 0,
    failed: 0,
    avgTimeToRead: 0,
    avgTimeToInteract: 0,
    readRate: 0,
    interactionRate: 0
  };
  
  private readonly channel: NotificationChannel = 'in-app';
  private badgeCache = new Map<string, number>();

  constructor() {
    super();
    this.initializeService();
  }

  /**
   * Initialize in-app notification channel
   */
  private async initializeService(): Promise<void> {
    try {
      // Load configuration
      await this.loadConfiguration();
      
      // Load metrics
      await this.loadMetrics();
      
      // Setup expiry checker
      this.setupExpiryChecker();
      
      // Setup WebSocket handlers
      this.setupWebSocketHandlers();
      
      logger.info('✅ In-app notification channel initialized');
      
    } catch (error) {
      logger.error('❌ Failed to initialize in-app channel', { error });
      throw error;
    }
  }

  /**
   * Send in-app notification
   */
  async sendNotification(
    notification: NotificationData,
    options?: {
      realtime?: boolean;
      persist?: boolean;
      template?: boolean;
    }
  ): Promise<InAppDeliveryResult> {
    try {
      const startTime = Date.now();
      
      // Prepare notification
      const inAppNotification = await this.prepareNotification(notification, options);
      
      const deliveredTo: string[] = [];
      const failedTo: string[] = [];
      let realtimeDelivered = false;
      let persistenceDelivered = false;
      
      // Try real-time delivery first
      if (this.config.enableRealtime && options?.realtime !== false) {
        realtimeDelivered = await this.deliverRealtime(inAppNotification);
        
        if (realtimeDelivered) {
          deliveredTo.push(notification.userId);
        } else if (!this.config.fallbackToPersistence) {
          failedTo.push(notification.userId);
        }
      }
      
      // Persist notification
      if (this.config.enablePersistence && options?.persist !== false) {
        if (!realtimeDelivered || this.config.fallbackToPersistence) {
          persistenceDelivered = await this.persistNotification(inAppNotification);
          
          if (persistenceDelivered && !realtimeDelivered) {
            deliveredTo.push(notification.userId);
          } else if (!persistenceDelivered && !realtimeDelivered) {
            failedTo.push(notification.userId);
          }
        }
      }
      
      // Update badge count
      if (this.config.enableBadges) {
        await this.updateBadgeCount(notification.userId, 1);
      }
      
      // Update metrics
      this.updateMetrics('delivered', Date.now() - startTime);
      
      const result: InAppDeliveryResult = {
        success: deliveredTo.length > 0,
        notificationId: notification.notificationId,
        deliveredTo,
        failedTo,
        timestamp: new Date(),
        realtime: realtimeDelivered,
        stored: persistenceDelivered
      };
      
      // Emit delivery event
      this.emit('inAppDelivered', result);
      
      // Setup auto-read if configured
      if (this.config.autoMarkAsRead && realtimeDelivered) {
        setTimeout(() => {
          this.markAsRead(inAppNotification.id, notification.userId);
        }, this.config.autoMarkAsReadDelay);
      }
      
      logger.debug('In-app notification delivered', {
        notificationId: notification.notificationId,
        realtime: realtimeDelivered,
        stored: persistenceDelivered
      });
      
      return result;
      
    } catch (error) {
      this.updateMetrics('failed');
      
      logger.error('Failed to send in-app notification', {
        error,
        notificationId: notification.notificationId
      });
      
      return {
        success: false,
        notificationId: notification.notificationId,
        deliveredTo: [],
        failedTo: [notification.userId],
        timestamp: new Date(),
        realtime: false,
        stored: false,
        error: {
          code: 'DELIVERY_ERROR',
          message: error instanceof Error ? error.message : 'Delivery failed'
        }
      };
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
      category?: string;
      type?: string;
      from?: Date;
      to?: Date;
    }
  ): Promise<{
    notifications: InAppNotification[];
    total: number;
    unread: number;
    badge: number;
  }> {
    try {
      const key = `in_app_notifications:${userId}`;
      
      // Get all notifications for user
      const notificationIds = await redisClient.zrevrange(
        key,
        options?.offset || 0,
        (options?.offset || 0) + (options?.limit || 50) - 1
      );
      
      const notifications: InAppNotification[] = [];
      
      for (const id of notificationIds) {
        const data = await redisClient.hget(`notification:${id}`, 'data');
        if (data) {
          const notification = JSON.parse(data);
          
          // Apply filters
          if (options?.unreadOnly && notification.read) continue;
          if (options?.category && notification.category !== options.category) continue;
          if (options?.type && notification.type !== options.type) continue;
          if (options?.from && new Date(notification.timestamp) < options.from) continue;
          if (options?.to && new Date(notification.timestamp) > options.to) continue;
          
          notifications.push(notification);
        }
      }
      
      // Get counts
      const total = await redisClient.zcard(key);
      const unread = await this.getUnreadCount(userId);
      const badge = await this.getBadgeCount(userId);
      
      return {
        notifications,
        total,
        unread,
        badge
      };
      
    } catch (error) {
      logger.error('Failed to get user notifications', { error, userId });
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      const key = `notification:${notificationId}`;
      const data = await redisClient.hget(key, 'data');
      
      if (!data) {
        throw new Error(`Notification not found: ${notificationId}`);
      }
      
      const notification = JSON.parse(data);
      
      if (notification.read) {
        return; // Already read
      }
      
      // Update notification
      notification.read = true;
      notification.readAt = new Date();
      
      await redisClient.hset(key, 'data', JSON.stringify(notification));
      
      // Update unread count
      await this.decrementUnreadCount(userId);
      
      // Update badge
      if (this.config.enableBadges) {
        await this.updateBadgeCount(userId, -1);
      }
      
      // Update metrics
      const timeToRead = Date.now() - new Date(notification.timestamp).getTime();
      this.updateMetrics('read', timeToRead);
      
      // Emit read event
      this.emit('notificationRead', {
        notificationId,
        userId,
        readAt: notification.readAt
      });
      
      // Send real-time update
      this.sendRealtimeUpdate(userId, {
        type: 'notification_read',
        notificationId,
        timestamp: notification.readAt
      });
      
      logger.debug('Notification marked as read', { notificationId, userId });
      
    } catch (error) {
      logger.error('Failed to mark notification as read', { error, notificationId });
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<number> {
    try {
      const key = `in_app_notifications:${userId}`;
      const notificationIds = await redisClient.zrange(key, 0, -1);
      
      let count = 0;
      
      for (const id of notificationIds) {
        const data = await redisClient.hget(`notification:${id}`, 'data');
        if (data) {
          const notification = JSON.parse(data);
          
          if (!notification.read) {
            notification.read = true;
            notification.readAt = new Date();
            
            await redisClient.hset(`notification:${id}`, 'data', JSON.stringify(notification));
            count++;
          }
        }
      }
      
      // Reset unread count
      await redisClient.set(`unread_count:${userId}`, '0');
      
      // Reset badge
      if (this.config.enableBadges) {
        await this.resetBadgeCount(userId);
      }
      
      // Update metrics
      this.metrics.read += count;
      
      // Send real-time update
      this.sendRealtimeUpdate(userId, {
        type: 'all_notifications_read',
        count,
        timestamp: new Date()
      });
      
      logger.info('All notifications marked as read', { userId, count });
      
      return count;
      
    } catch (error) {
      logger.error('Failed to mark all as read', { error, userId });
      throw error;
    }
  }

  /**
   * Dismiss notification
   */
  async dismissNotification(notificationId: string, userId: string): Promise<void> {
    try {
      const key = `notification:${notificationId}`;
      const data = await redisClient.hget(key, 'data');
      
      if (!data) {
        throw new Error(`Notification not found: ${notificationId}`);
      }
      
      const notification = JSON.parse(data);
      
      // Update notification
      notification.dismissed = true;
      notification.dismissedAt = new Date();
      
      await redisClient.hset(key, 'data', JSON.stringify(notification));
      
      // Remove from user's list
      await redisClient.zrem(`in_app_notifications:${userId}`, notificationId);
      
      // Update unread count if needed
      if (!notification.read) {
        await this.decrementUnreadCount(userId);
        
        if (this.config.enableBadges) {
          await this.updateBadgeCount(userId, -1);
        }
      }
      
      // Update metrics
      this.updateMetrics('dismissed');
      
      // Emit dismiss event
      this.emit('notificationDismissed', {
        notificationId,
        userId,
        dismissedAt: notification.dismissedAt
      });
      
      // Send real-time update
      this.sendRealtimeUpdate(userId, {
        type: 'notification_dismissed',
        notificationId,
        timestamp: notification.dismissedAt
      });
      
      logger.debug('Notification dismissed', { notificationId, userId });
      
    } catch (error) {
      logger.error('Failed to dismiss notification', { error, notificationId });
      throw error;
    }
  }

  /**
   * Handle notification interaction
   */
  async handleInteraction(
    notificationId: string,
    userId: string,
    action: string,
    data?: any
  ): Promise<void> {
    try {
      const key = `notification:${notificationId}`;
      const notificationData = await redisClient.hget(key, 'data');
      
      if (!notificationData) {
        throw new Error(`Notification not found: ${notificationId}`);
      }
      
      const notification = JSON.parse(notificationData);
      
      // Mark as read if not already
      if (!notification.read) {
        await this.markAsRead(notificationId, userId);
      }
      
      // Store interaction
      await redisClient.hset(
        `notification_interactions:${notificationId}`,
        Date.now().toString(),
        JSON.stringify({
          userId,
          action,
          data,
          timestamp: new Date()
        })
      );
      
      // Update metrics
      const timeToInteract = Date.now() - new Date(notification.timestamp).getTime();
      this.updateMetrics('interacted', timeToInteract);
      
      // Emit interaction event
      this.emit('notificationInteraction', {
        notificationId,
        userId,
        action,
        data,
        timestamp: new Date()
      });
      
      logger.debug('Notification interaction handled', {
        notificationId,
        userId,
        action
      });
      
    } catch (error) {
      logger.error('Failed to handle interaction', {
        error,
        notificationId,
        action
      });
      throw error;
    }
  }

  /**
   * Get notification statistics
   */
  async getStatistics(
    userId?: string,
    period?: { from: Date; to: Date }
  ): Promise<{
    total: number;
    unread: number;
    read: number;
    dismissed: number;
    expired: number;
    byCategory: Record<string, number>;
    byType: Record<string, number>;
    metrics: InAppMetrics;
  }> {
    try {
      if (userId) {
        // Get user-specific stats
        const key = `in_app_notifications:${userId}`;
        const total = await redisClient.zcard(key);
        const unread = await this.getUnreadCount(userId);
        
        // Get category and type breakdown
        const notificationIds = await redisClient.zrange(key, 0, -1);
        const byCategory: Record<string, number> = {};
        const byType: Record<string, number> = {};
        let read = 0;
        let dismissed = 0;
        let expired = 0;
        
        for (const id of notificationIds) {
          const data = await redisClient.hget(`notification:${id}`, 'data');
          if (data) {
            const notification = JSON.parse(data);
            
            if (notification.read) read++;
            if (notification.dismissed) dismissed++;
            if (notification.expiresAt && new Date(notification.expiresAt) < new Date()) expired++;
            
            if (notification.category) {
              byCategory[notification.category] = (byCategory[notification.category] || 0) + 1;
            }
            
            byType[notification.type] = (byType[notification.type] || 0) + 1;
          }
        }
        
        return {
          total,
          unread,
          read,
          dismissed,
          expired,
          byCategory,
          byType,
          metrics: this.metrics
        };
        
      } else {
        // Get global stats
        return {
          total: this.metrics.delivered,
          unread: this.metrics.delivered - this.metrics.read,
          read: this.metrics.read,
          dismissed: this.metrics.dismissed,
          expired: this.metrics.expired,
          byCategory: {},
          byType: {},
          metrics: this.metrics
        };
      }
      
    } catch (error) {
      logger.error('Failed to get statistics', { error, userId });
      throw error;
    }
  }

  /**
   * Clean up expired notifications
   */
  async cleanupExpired(): Promise<number> {
    try {
      const now = Date.now();
      let cleaned = 0;
      
      // Get all notification keys
      const keys = await redisClient.keys('notification:*');
      
      for (const key of keys) {
        const data = await redisClient.hget(key, 'data');
        if (data) {
          const notification = JSON.parse(data);
          
          // Check if expired
          if (notification.expiresAt && new Date(notification.expiresAt).getTime() < now) {
            // Remove from user's list
            await redisClient.zrem(
              `in_app_notifications:${notification.userId}`,
              notification.id
            );
            
            // Delete notification
            await redisClient.del(key);
            
            cleaned++;
          }
        }
      }
      
      // Update metrics
      this.metrics.expired += cleaned;
      
      logger.info('Expired notifications cleaned', { count: cleaned });
      
      return cleaned;
      
    } catch (error) {
      logger.error('Failed to cleanup expired notifications', { error });
      throw error;
    }
  }

  // Private helper methods

  private async prepareNotification(
    notification: NotificationData,
    options?: any
  ): Promise<InAppNotification> {
    // Render template if available
    let title = notification.title || 'Notification';
    let message = notification.message;
    let icon = notification.metadata?.icon;
    let image = notification.metadata?.image;
    
    if (notification.metadata?.templateId && options?.template !== false) {
      try {
        const context: PersonalizationContext = {
          user: {
            id: notification.userId,
            email: notification.metadata.recipientEmail || '',
            name: notification.metadata.recipientName
          },
          context: {
            timestamp: new Date(),
            timezone: notification.metadata.timezone || 'UTC',
            locale: notification.metadata.locale || 'en'
          },
          data: notification.metadata.templateData || {}
        };
        
        const rendered = await notificationTemplateService.renderTemplate(
          notification.metadata.templateId,
          context,
          { channel: 'in-app' }
        );
        
        title = rendered.title || title;
        message = rendered.body;
        
      } catch (error) {
        logger.error('Failed to render in-app template', {
          error,
          templateId: notification.metadata.templateId
        });
      }
    }
    
    // Build in-app notification
    const inAppNotification: InAppNotification = {
      id: notification.notificationId,
      userId: notification.userId,
      type: notification.type,
      title,
      message,
      icon,
      image,
      actions: notification.actions?.map(action => ({
        action: action.action,
        title: action.label,
        primary: action.primary
      })),
      data: notification.metadata,
      priority: notification.priority,
      timestamp: new Date(),
      read: false,
      dismissed: false,
      expiresAt: notification.expiresAt,
      category: notification.metadata?.category,
      sound: this.config.enableSounds ? notification.metadata?.sound : undefined,
      vibrate: notification.metadata?.vibrate,
      badge: notification.metadata?.badge,
      tag: notification.metadata?.tag,
      requireInteraction: notification.priority === 'critical',
      renotify: notification.metadata?.renotify,
      silent: notification.metadata?.silent || !this.config.enableSounds
    };
    
    return inAppNotification;
  }

  private async deliverRealtime(notification: InAppNotification): Promise<boolean> {
    try {
      const io = getIO();
      if (!io) {
        logger.warn('WebSocket not available for real-time delivery');
        return false;
      }
      
      // Send to user's room
      const roomName = `user:${notification.userId}`;
      const sockets = await io.in(roomName).fetchSockets();
      
      if (sockets.length === 0) {
        logger.debug('User not connected for real-time delivery', {
          userId: notification.userId
        });
        return false;
      }
      
      // Emit notification
      io.to(roomName).emit('notification', {
        type: 'new_notification',
        notification: this.sanitizeForClient(notification)
      });
      
      // Play sound if enabled
      if (this.config.enableSounds && notification.sound) {
        io.to(roomName).emit('notification_sound', {
          sound: notification.sound,
          volume: notification.data?.soundVolume || 0.5
        });
      }
      
      logger.debug('Real-time notification delivered', {
        notificationId: notification.id,
        userId: notification.userId,
        sockets: sockets.length
      });
      
      return true;
      
    } catch (error) {
      logger.error('Failed to deliver real-time notification', {
        error,
        notificationId: notification.id
      });
      return false;
    }
  }

  private async persistNotification(notification: InAppNotification): Promise<boolean> {
    try {
      const key = `notification:${notification.id}`;
      const userKey = `in_app_notifications:${notification.userId}`;
      
      // Store notification
      await redisClient.hset(key, 'data', JSON.stringify(notification));
      
      // Add to user's sorted set (sorted by timestamp)
      await redisClient.zadd(
        userKey,
        notification.timestamp.getTime(),
        notification.id
      );
      
      // Trim to max notifications per user
      const count = await redisClient.zcard(userKey);
      if (count > this.config.maxNotificationsPerUser) {
        // Remove oldest notifications
        const toRemove = await redisClient.zrange(
          userKey,
          0,
          count - this.config.maxNotificationsPerUser - 1
        );
        
        for (const id of toRemove) {
          await redisClient.del(`notification:${id}`);
        }
        
        await redisClient.zremrangebyrank(
          userKey,
          0,
          count - this.config.maxNotificationsPerUser - 1
        );
      }
      
      // Set expiry
      const ttl = this.config.retentionDays * 24 * 60 * 60;
      await redisClient.expire(key, ttl);
      
      // Increment unread count
      await this.incrementUnreadCount(notification.userId);
      
      logger.debug('Notification persisted', {
        notificationId: notification.id,
        userId: notification.userId
      });
      
      return true;
      
    } catch (error) {
      logger.error('Failed to persist notification', {
        error,
        notificationId: notification.id
      });
      return false;
    }
  }

  private sanitizeForClient(notification: InAppNotification): Partial<InAppNotification> {
    // Remove sensitive data before sending to client
    const { data, ...sanitized } = notification;
    
    return {
      ...sanitized,
      data: data ? this.sanitizeData(data) : undefined
    };
  }

  private sanitizeData(data: Record<string, any>): Record<string, any> {
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth'];
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (!sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  private async getUnreadCount(userId: string): Promise<number> {
    const count = await redisClient.get(`unread_count:${userId}`);
    return count ? parseInt(count) : 0;
  }

  private async incrementUnreadCount(userId: string): Promise<void> {
    await redisClient.incr(`unread_count:${userId}`);
  }

  private async decrementUnreadCount(userId: string): Promise<void> {
    const current = await this.getUnreadCount(userId);
    if (current > 0) {
      await redisClient.decr(`unread_count:${userId}`);
    }
  }

  private async getBadgeCount(userId: string): Promise<number> {
    return this.badgeCache.get(userId) || await this.getUnreadCount(userId);
  }

  private async updateBadgeCount(userId: string, delta: number): Promise<void> {
    const current = await this.getBadgeCount(userId);
    const newCount = Math.max(0, current + delta);
    
    this.badgeCache.set(userId, newCount);
    
    // Send badge update
    this.sendRealtimeUpdate(userId, {
      type: 'badge_update',
      badge: newCount,
      timestamp: new Date()
    });
  }

  private async resetBadgeCount(userId: string): Promise<void> {
    this.badgeCache.set(userId, 0);
    
    // Send badge update
    this.sendRealtimeUpdate(userId, {
      type: 'badge_update',
      badge: 0,
      timestamp: new Date()
    });
  }

  private sendRealtimeUpdate(userId: string, data: any): void {
    try {
      const io = getIO();
      if (io) {
        io.to(`user:${userId}`).emit('notification_update', data);
      }
    } catch (error) {
      logger.error('Failed to send real-time update', { error, userId });
    }
  }

  private setupWebSocketHandlers(): void {
    // WebSocket handlers would be set up when WebSocket service is initialized
    logger.debug('WebSocket handlers for in-app notifications configured');
  }

  private setupExpiryChecker(): void {
    // Run cleanup every hour
    setInterval(() => {
      this.cleanupExpired();
    }, 60 * 60 * 1000);
  }

  private updateMetrics(event: string, time?: number): void {
    switch (event) {
      case 'delivered':
        this.metrics.delivered++;
        break;
      case 'read':
        this.metrics.read++;
        if (time) {
          const totalTime = this.metrics.avgTimeToRead * (this.metrics.read - 1);
          this.metrics.avgTimeToRead = (totalTime + time) / this.metrics.read;
        }
        break;
      case 'dismissed':
        this.metrics.dismissed++;
        break;
      case 'interacted':
        this.metrics.interacted++;
        if (time) {
          const totalTime = this.metrics.avgTimeToInteract * (this.metrics.interacted - 1);
          this.metrics.avgTimeToInteract = (totalTime + time) / this.metrics.interacted;
        }
        break;
      case 'failed':
        this.metrics.failed++;
        break;
    }
    
    // Calculate rates
    if (this.metrics.delivered > 0) {
      this.metrics.readRate = this.metrics.read / this.metrics.delivered;
      this.metrics.interactionRate = this.metrics.interacted / this.metrics.delivered;
    }
    
    // Persist metrics
    this.persistMetrics();
  }

  private async persistMetrics(): Promise<void> {
    await redisClient.hset(
      'in_app_metrics',
      'current',
      JSON.stringify(this.metrics)
    );
  }

  private async loadMetrics(): Promise<void> {
    const data = await redisClient.hget('in_app_metrics', 'current');
    if (data) {
      this.metrics = JSON.parse(data);
    }
  }

  private async loadConfiguration(): Promise<void> {
    // Load configuration from environment or database
    const configData = await redisClient.hget('notification_config', 'in_app');
    if (configData) {
      this.config = { ...this.config, ...JSON.parse(configData) };
    }
  }
}

// Export singleton instance
export const inAppNotificationChannel = new InAppNotificationChannel();
export default inAppNotificationChannel;