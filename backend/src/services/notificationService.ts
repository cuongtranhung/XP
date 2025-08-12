/**
 * Core Notification Service
 * Multi-channel notification system with templating, personalization, and delivery management
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import redisClient from '../config/redis';
import { webSocketService } from './webSocketService';
import { emailService } from './emailService';

export type NotificationChannel = 'email' | 'in-app' | 'push' | 'sms' | 'webhook';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';
export type NotificationStatus = 'pending' | 'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'cancelled';
export type NotificationType = 
  | 'system' | 'security' | 'account' | 'transaction' 
  | 'comment' | 'form' | 'submission' | 'collaboration'
  | 'reminder' | 'announcement' | 'marketing' | 'custom';

export interface NotificationRecipient {
  userId: string;
  email?: string;
  phone?: string;
  deviceTokens?: string[];
  metadata?: Record<string, any>;
}

export interface NotificationTemplate {
  templateId: string;
  name: string;
  type: NotificationType;
  channels: NotificationChannel[];
  subject?: string;
  title?: string;
  body: string;
  htmlBody?: string;
  variables: string[];
  defaultValues?: Record<string, any>;
  localization?: Record<string, {
    subject?: string;
    title?: string;
    body: string;
    htmlBody?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationData {
  notificationId: string;
  type: NotificationType;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  recipient: NotificationRecipient;
  template?: NotificationTemplate;
  subject?: string;
  title?: string;
  body: string;
  htmlBody?: string;
  data?: Record<string, any>;
  variables?: Record<string, any>;
  actions?: NotificationAction[];
  groupId?: string;
  batchId?: string;
  scheduledAt?: Date;
  expiresAt?: Date;
  metadata: {
    source: string;
    correlationId?: string;
    locale?: string;
    timezone?: string;
    userAgent?: string;
    ipAddress?: string;
  };
  status: NotificationStatus;
  attempts: number;
  lastAttemptAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  clickedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationAction {
  actionId: string;
  type: 'link' | 'button' | 'deep-link' | 'api-call';
  label: string;
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  payload?: Record<string, any>;
  style?: 'primary' | 'secondary' | 'danger' | 'success';
  icon?: string;
}

export interface NotificationPreferences {
  userId: string;
  channels: {
    email: {
      enabled: boolean;
      types: NotificationType[];
      frequency?: 'instant' | 'hourly' | 'daily' | 'weekly';
      quietHours?: {
        start: string; // HH:mm format
        end: string;
        timezone: string;
      };
    };
    inApp: {
      enabled: boolean;
      types: NotificationType[];
      showBadge: boolean;
      playSound: boolean;
    };
    push: {
      enabled: boolean;
      types: NotificationType[];
      deviceTokens: string[];
    };
    sms: {
      enabled: boolean;
      types: NotificationType[];
      phone?: string;
    };
  };
  doNotDisturb: {
    enabled: boolean;
    until?: Date;
  };
  language: string;
  timezone: string;
  updatedAt: Date;
}

export interface NotificationQueue {
  queueId: string;
  channel: NotificationChannel;
  priority: NotificationPriority;
  notifications: NotificationData[];
  processing: boolean;
  lastProcessedAt?: Date;
  errorCount: number;
  createdAt: Date;
}

export interface NotificationBatch {
  batchId: string;
  type: NotificationType;
  recipients: NotificationRecipient[];
  template?: NotificationTemplate;
  data: Record<string, any>;
  channels: NotificationChannel[];
  scheduledAt?: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: Date;
  completedAt?: Date;
}

export interface NotificationStats {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
  failed: number;
  byChannel: Record<NotificationChannel, {
    sent: number;
    delivered: number;
    failed: number;
  }>;
  byType: Record<NotificationType, number>;
  byPriority: Record<NotificationPriority, number>;
  avgDeliveryTime: number;
  successRate: number;
}

/**
 * Core Notification Service Class
 */
class NotificationService extends EventEmitter {
  private templates = new Map<string, NotificationTemplate>();
  private preferences = new Map<string, NotificationPreferences>();
  private queues = new Map<string, NotificationQueue>();
  private batches = new Map<string, NotificationBatch>();
  private activeNotifications = new Map<string, NotificationData>();
  
  private processingInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;

  private readonly maxRetries = 3;
  private readonly retryDelay = 60000; // 1 minute
  private readonly batchSize = 100;
  private readonly queueProcessingInterval = 5000; // 5 seconds

  constructor() {
    super();
    this.initializeService();
  }

  /**
   * Initialize notification service
   */
  private async initializeService(): Promise<void> {
    try {
      // Load templates from storage
      await this.loadTemplates();
      
      // Load user preferences
      await this.loadPreferences();
      
      // Initialize notification queues
      this.initializeQueues();
      
      // Start queue processing
      this.startQueueProcessing();
      
      // Start cleanup tasks
      this.startCleanupTasks();
      
      // Start metrics collection
      this.startMetricsCollection();
      
      logger.info('✅ Notification service initialized successfully');
      
    } catch (error) {
      logger.error('❌ Failed to initialize notification service', { error });
      throw error;
    }
  }

  /**
   * Send notification to recipient
   */
  async sendNotification(params: {
    type: NotificationType;
    priority?: NotificationPriority;
    recipient: NotificationRecipient;
    templateId?: string;
    subject?: string;
    title?: string;
    body?: string;
    data?: Record<string, any>;
    variables?: Record<string, any>;
    channels?: NotificationChannel[];
    actions?: NotificationAction[];
    groupId?: string;
    scheduledAt?: Date;
    expiresAt?: Date;
    metadata?: Partial<NotificationData['metadata']>;
  }): Promise<string> {
    try {
      const notificationId = this.generateNotificationId();
      
      // Get user preferences
      const preferences = await this.getUserPreferences(params.recipient.userId);
      
      // Determine channels to use
      const channels = this.determineChannels(
        params.channels || ['in-app', 'email'],
        preferences,
        params.type
      );
      
      // Get template if specified
      let template: NotificationTemplate | undefined;
      if (params.templateId) {
        template = this.templates.get(params.templateId);
        if (!template) {
          throw new Error(`Template not found: ${params.templateId}`);
        }
      }
      
      // Process template and personalize content
      const processedContent = this.processTemplate(
        template || {
          body: params.body || '',
          htmlBody: params.body,
          subject: params.subject,
          title: params.title
        },
        params.variables || {},
        preferences.language
      );
      
      // Create notification object
      const notification: NotificationData = {
        notificationId,
        type: params.type,
        priority: params.priority || 'medium',
        channels,
        recipient: params.recipient,
        template,
        subject: processedContent.subject || params.subject,
        title: processedContent.title || params.title,
        body: processedContent.body,
        htmlBody: processedContent.htmlBody,
        data: params.data,
        variables: params.variables,
        actions: params.actions,
        groupId: params.groupId,
        scheduledAt: params.scheduledAt,
        expiresAt: params.expiresAt,
        metadata: {
          source: 'notification-service',
          correlationId: params.metadata?.correlationId,
          locale: preferences.language,
          timezone: preferences.timezone,
          ...params.metadata
        },
        status: 'pending',
        attempts: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Check for Do Not Disturb
      if (this.isDoNotDisturb(preferences)) {
        notification.status = 'cancelled';
        notification.errorMessage = 'User has Do Not Disturb enabled';
        await this.storeNotification(notification);
        return notificationId;
      }
      
      // Check for scheduled notification
      if (params.scheduledAt && params.scheduledAt > new Date()) {
        await this.scheduleNotification(notification);
        return notificationId;
      }
      
      // Add to appropriate queues
      await this.queueNotification(notification);
      
      // Store notification
      await this.storeNotification(notification);
      
      // Emit event
      this.emit('notificationCreated', notification);
      
      logger.info('Notification created successfully', {
        notificationId,
        type: params.type,
        channels,
        recipient: params.recipient.userId
      });
      
      return notificationId;
      
    } catch (error) {
      logger.error('Failed to send notification', { error, params });
      throw error;
    }
  }

  /**
   * Send batch notifications
   */
  async sendBatchNotifications(params: {
    type: NotificationType;
    recipients: NotificationRecipient[];
    templateId?: string;
    data?: Record<string, any>;
    channels?: NotificationChannel[];
    scheduledAt?: Date;
  }): Promise<string> {
    try {
      const batchId = this.generateBatchId();
      
      const batch: NotificationBatch = {
        batchId,
        type: params.type,
        recipients: params.recipients,
        template: params.templateId ? this.templates.get(params.templateId) : undefined,
        data: params.data || {},
        channels: params.channels || ['in-app', 'email'],
        scheduledAt: params.scheduledAt,
        status: 'pending',
        totalCount: params.recipients.length,
        sentCount: 0,
        failedCount: 0,
        createdAt: new Date()
      };
      
      this.batches.set(batchId, batch);
      
      // Process batch in chunks
      await this.processBatch(batch);
      
      logger.info('Batch notifications initiated', {
        batchId,
        recipientCount: params.recipients.length,
        type: params.type
      });
      
      return batchId;
      
    } catch (error) {
      logger.error('Failed to send batch notifications', { error, params });
      throw error;
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    try {
      const existingPrefs = await this.getUserPreferences(userId);
      
      const updatedPrefs: NotificationPreferences = {
        ...existingPrefs,
        ...preferences,
        userId,
        updatedAt: new Date()
      };
      
      // Validate preferences
      this.validatePreferences(updatedPrefs);
      
      // Store preferences
      this.preferences.set(userId, updatedPrefs);
      await this.storePreferences(updatedPrefs);
      
      // Emit event
      this.emit('preferencesUpdated', { userId, preferences: updatedPrefs });
      
      logger.info('User notification preferences updated', { userId });
      
      return updatedPrefs;
      
    } catch (error) {
      logger.error('Failed to update user preferences', { error, userId });
      throw error;
    }
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      // Check cache
      let preferences = this.preferences.get(userId);
      
      if (!preferences) {
        // Load from storage
        preferences = await this.loadUserPreferences(userId);
        
        if (!preferences) {
          // Create default preferences
          preferences = this.createDefaultPreferences(userId);
          await this.storePreferences(preferences);
        }
        
        this.preferences.set(userId, preferences);
      }
      
      return preferences;
      
    } catch (error) {
      logger.error('Failed to get user preferences', { error, userId });
      return this.createDefaultPreferences(userId);
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      const notification = this.activeNotifications.get(notificationId);
      
      if (!notification) {
        throw new Error(`Notification not found: ${notificationId}`);
      }
      
      if (notification.recipient.userId !== userId) {
        throw new Error('Unauthorized access to notification');
      }
      
      notification.readAt = new Date();
      notification.updatedAt = new Date();
      
      await this.storeNotification(notification);
      
      // Update analytics
      await this.updateAnalytics(notificationId, 'read');
      
      // Emit event
      this.emit('notificationRead', { notificationId, userId });
      
      logger.debug('Notification marked as read', { notificationId, userId });
      
    } catch (error) {
      logger.error('Failed to mark notification as read', { error, notificationId });
      throw error;
    }
  }

  /**
   * Mark notification as clicked
   */
  async markAsClicked(notificationId: string, actionId?: string): Promise<void> {
    try {
      const notification = this.activeNotifications.get(notificationId);
      
      if (!notification) {
        throw new Error(`Notification not found: ${notificationId}`);
      }
      
      notification.clickedAt = new Date();
      notification.updatedAt = new Date();
      
      await this.storeNotification(notification);
      
      // Update analytics
      await this.updateAnalytics(notificationId, 'clicked', { actionId });
      
      // Emit event
      this.emit('notificationClicked', { notificationId, actionId });
      
      logger.debug('Notification marked as clicked', { notificationId, actionId });
      
    } catch (error) {
      logger.error('Failed to mark notification as clicked', { error, notificationId });
      throw error;
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(
    userId: string,
    filters?: {
      status?: NotificationStatus[];
      types?: NotificationType[];
      channels?: NotificationChannel[];
      read?: boolean;
      fromDate?: Date;
      toDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<{
    notifications: NotificationData[];
    total: number;
    unreadCount: number;
  }> {
    try {
      // Load notifications from storage
      const allNotifications = await this.loadUserNotifications(userId);
      
      // Apply filters
      let filtered = allNotifications;
      
      if (filters) {
        if (filters.status) {
          filtered = filtered.filter(n => filters.status!.includes(n.status));
        }
        
        if (filters.types) {
          filtered = filtered.filter(n => filters.types!.includes(n.type));
        }
        
        if (filters.channels) {
          filtered = filtered.filter(n => 
            n.channels.some(c => filters.channels!.includes(c))
          );
        }
        
        if (filters.read !== undefined) {
          filtered = filtered.filter(n => filters.read ? !!n.readAt : !n.readAt);
        }
        
        if (filters.fromDate) {
          filtered = filtered.filter(n => n.createdAt >= filters.fromDate!);
        }
        
        if (filters.toDate) {
          filtered = filtered.filter(n => n.createdAt <= filters.toDate!);
        }
      }
      
      // Sort by creation date (newest first)
      filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      // Apply pagination
      const offset = filters?.offset || 0;
      const limit = filters?.limit || 50;
      const paginated = filtered.slice(offset, offset + limit);
      
      // Count unread
      const unreadCount = allNotifications.filter(n => !n.readAt).length;
      
      return {
        notifications: paginated,
        total: filtered.length,
        unreadCount
      };
      
    } catch (error) {
      logger.error('Failed to get user notifications', { error, userId });
      throw error;
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(
    filters?: {
      userId?: string;
      fromDate?: Date;
      toDate?: Date;
      type?: NotificationType;
      channel?: NotificationChannel;
    }
  ): Promise<NotificationStats> {
    try {
      const stats = await this.calculateStats(filters);
      return stats;
      
    } catch (error) {
      logger.error('Failed to get notification stats', { error, filters });
      throw error;
    }
  }

  /**
   * Create notification template
   */
  async createTemplate(template: Omit<NotificationTemplate, 'templateId' | 'createdAt' | 'updatedAt'>): Promise<NotificationTemplate> {
    try {
      const templateId = this.generateTemplateId();
      
      const fullTemplate: NotificationTemplate = {
        ...template,
        templateId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Validate template
      this.validateTemplate(fullTemplate);
      
      // Store template
      this.templates.set(templateId, fullTemplate);
      await this.storeTemplate(fullTemplate);
      
      logger.info('Notification template created', {
        templateId,
        name: template.name,
        type: template.type
      });
      
      return fullTemplate;
      
    } catch (error) {
      logger.error('Failed to create template', { error, template });
      throw error;
    }
  }

  /**
   * Update notification template
   */
  async updateTemplate(
    templateId: string,
    updates: Partial<NotificationTemplate>
  ): Promise<NotificationTemplate> {
    try {
      const existing = this.templates.get(templateId);
      
      if (!existing) {
        throw new Error(`Template not found: ${templateId}`);
      }
      
      const updated: NotificationTemplate = {
        ...existing,
        ...updates,
        templateId,
        updatedAt: new Date()
      };
      
      // Validate template
      this.validateTemplate(updated);
      
      // Store template
      this.templates.set(templateId, updated);
      await this.storeTemplate(updated);
      
      logger.info('Notification template updated', { templateId });
      
      return updated;
      
    } catch (error) {
      logger.error('Failed to update template', { error, templateId });
      throw error;
    }
  }

  /**
   * Get all templates
   */
  getTemplates(type?: NotificationType): NotificationTemplate[] {
    const templates = Array.from(this.templates.values());
    
    if (type) {
      return templates.filter(t => t.type === type);
    }
    
    return templates;
  }

  // Private helper methods

  private initializeQueues(): void {
    const channels: NotificationChannel[] = ['email', 'in-app', 'push', 'sms', 'webhook'];
    const priorities: NotificationPriority[] = ['critical', 'high', 'medium', 'low'];
    
    for (const channel of channels) {
      for (const priority of priorities) {
        const queueId = `${channel}_${priority}`;
        this.queues.set(queueId, {
          queueId,
          channel,
          priority,
          notifications: [],
          processing: false,
          errorCount: 0,
          createdAt: new Date()
        });
      }
    }
  }

  private async queueNotification(notification: NotificationData): Promise<void> {
    notification.status = 'queued';
    
    for (const channel of notification.channels) {
      const queueId = `${channel}_${notification.priority}`;
      const queue = this.queues.get(queueId);
      
      if (queue) {
        queue.notifications.push(notification);
      }
    }
  }

  private startQueueProcessing(): void {
    this.processingInterval = setInterval(async () => {
      await this.processQueues();
    }, this.queueProcessingInterval);
  }

  private async processQueues(): Promise<void> {
    // Process queues by priority
    const priorities: NotificationPriority[] = ['critical', 'high', 'medium', 'low'];
    
    for (const priority of priorities) {
      for (const [queueId, queue] of this.queues) {
        if (queue.priority === priority && !queue.processing && queue.notifications.length > 0) {
          await this.processQueue(queue);
        }
      }
    }
  }

  private async processQueue(queue: NotificationQueue): Promise<void> {
    queue.processing = true;
    
    try {
      const batch = queue.notifications.splice(0, this.batchSize);
      
      for (const notification of batch) {
        await this.deliverNotification(notification, queue.channel);
      }
      
      queue.lastProcessedAt = new Date();
      queue.errorCount = 0;
      
    } catch (error) {
      logger.error('Queue processing failed', { error, queueId: queue.queueId });
      queue.errorCount++;
    } finally {
      queue.processing = false;
    }
  }

  private async deliverNotification(notification: NotificationData, channel: NotificationChannel): Promise<void> {
    try {
      notification.status = 'sending';
      notification.attempts++;
      notification.lastAttemptAt = new Date();
      
      switch (channel) {
        case 'email':
          await this.sendEmailNotification(notification);
          break;
        case 'in-app':
          await this.sendInAppNotification(notification);
          break;
        case 'push':
          await this.sendPushNotification(notification);
          break;
        case 'sms':
          await this.sendSmsNotification(notification);
          break;
        case 'webhook':
          await this.sendWebhookNotification(notification);
          break;
      }
      
      notification.status = 'delivered';
      notification.deliveredAt = new Date();
      
      // Store updated notification
      await this.storeNotification(notification);
      
      // Emit event
      this.emit('notificationDelivered', { notificationId: notification.notificationId, channel });
      
    } catch (error) {
      logger.error('Failed to deliver notification', {
        error,
        notificationId: notification.notificationId,
        channel
      });
      
      notification.errorMessage = error instanceof Error ? error.message : 'Delivery failed';
      
      if (notification.attempts < this.maxRetries) {
        // Retry later
        notification.status = 'queued';
        setTimeout(() => {
          this.queueNotification(notification);
        }, this.retryDelay * notification.attempts);
      } else {
        notification.status = 'failed';
      }
      
      await this.storeNotification(notification);
    }
  }

  private async sendEmailNotification(notification: NotificationData): Promise<void> {
    if (!notification.recipient.email) {
      throw new Error('Email address not provided');
    }
    
    await emailService.sendEmail({
      to: notification.recipient.email,
      subject: notification.subject || notification.title || 'Notification',
      html: notification.htmlBody || notification.body,
      text: notification.body
    });
  }

  private async sendInAppNotification(notification: NotificationData): Promise<void> {
    await webSocketService.sendCacheUpdateToUser(notification.recipient.userId, {
      type: 'notification',
      entity: 'notification',
      entityId: notification.notificationId,
      userId: notification.recipient.userId,
      data: {
        notificationId: notification.notificationId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        actions: notification.actions,
        priority: notification.priority,
        data: notification.data
      },
      timestamp: new Date(),
      metadata: notification.metadata
    });
  }

  private async sendPushNotification(notification: NotificationData): Promise<void> {
    // Implementation would integrate with push notification service (FCM, APNS, etc.)
    logger.info('Push notification would be sent', { notificationId: notification.notificationId });
  }

  private async sendSmsNotification(notification: NotificationData): Promise<void> {
    // Implementation would integrate with SMS service (Twilio, etc.)
    logger.info('SMS notification would be sent', { notificationId: notification.notificationId });
  }

  private async sendWebhookNotification(notification: NotificationData): Promise<void> {
    // Implementation would send webhook to configured URL
    logger.info('Webhook notification would be sent', { notificationId: notification.notificationId });
  }

  private async processBatch(batch: NotificationBatch): Promise<void> {
    batch.status = 'processing';
    
    const chunks = this.chunkArray(batch.recipients, this.batchSize);
    
    for (const chunk of chunks) {
      const promises = chunk.map(recipient =>
        this.sendNotification({
          type: batch.type,
          recipient,
          templateId: batch.template?.templateId,
          data: batch.data,
          channels: batch.channels,
          scheduledAt: batch.scheduledAt
        }).then(() => {
          batch.sentCount++;
        }).catch((error) => {
          batch.failedCount++;
          logger.error('Batch notification failed', { error, recipient });
        })
      );
      
      await Promise.allSettled(promises);
    }
    
    batch.status = 'completed';
    batch.completedAt = new Date();
  }

  private processTemplate(
    template: any,
    variables: Record<string, any>,
    locale: string
  ): {
    subject?: string;
    title?: string;
    body: string;
    htmlBody?: string;
  } {
    // Get localized template if available
    const localized = template.localization?.[locale] || template;
    
    // Replace variables
    const replaceVariables = (text: string): string => {
      return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return variables[key] || template.defaultValues?.[key] || match;
      });
    };
    
    return {
      subject: localized.subject ? replaceVariables(localized.subject) : undefined,
      title: localized.title ? replaceVariables(localized.title) : undefined,
      body: replaceVariables(localized.body),
      htmlBody: localized.htmlBody ? replaceVariables(localized.htmlBody) : undefined
    };
  }

  private determineChannels(
    requestedChannels: NotificationChannel[],
    preferences: NotificationPreferences,
    type: NotificationType
  ): NotificationChannel[] {
    const enabledChannels: NotificationChannel[] = [];
    
    for (const channel of requestedChannels) {
      const channelPrefs = preferences.channels[channel];
      
      if (channelPrefs?.enabled && channelPrefs.types?.includes(type)) {
        enabledChannels.push(channel);
      }
    }
    
    // Default to in-app if no channels are enabled
    if (enabledChannels.length === 0) {
      enabledChannels.push('in-app');
    }
    
    return enabledChannels;
  }

  private isDoNotDisturb(preferences: NotificationPreferences): boolean {
    if (preferences.doNotDisturb.enabled) {
      if (!preferences.doNotDisturb.until || preferences.doNotDisturb.until > new Date()) {
        return true;
      }
    }
    
    // Check quiet hours for email
    const emailPrefs = preferences.channels.email;
    if (emailPrefs.quietHours) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      if (currentTime >= emailPrefs.quietHours.start && currentTime <= emailPrefs.quietHours.end) {
        return true;
      }
    }
    
    return false;
  }

  private createDefaultPreferences(userId: string): NotificationPreferences {
    return {
      userId,
      channels: {
        email: {
          enabled: true,
          types: ['system', 'security', 'account', 'transaction'],
          frequency: 'instant'
        },
        inApp: {
          enabled: true,
          types: Object.values(['system', 'security', 'account', 'transaction', 'comment', 'form', 'submission', 'collaboration', 'reminder', 'announcement']) as NotificationType[],
          showBadge: true,
          playSound: true
        },
        push: {
          enabled: false,
          types: [],
          deviceTokens: []
        },
        sms: {
          enabled: false,
          types: []
        }
      },
      doNotDisturb: {
        enabled: false
      },
      language: 'en',
      timezone: 'UTC',
      updatedAt: new Date()
    };
  }

  private validatePreferences(preferences: NotificationPreferences): void {
    // Validate structure and values
    if (!preferences.userId) {
      throw new Error('User ID is required');
    }
    
    if (!preferences.channels) {
      throw new Error('Channel preferences are required');
    }
    
    // Additional validation as needed
  }

  private validateTemplate(template: NotificationTemplate): void {
    if (!template.name) {
      throw new Error('Template name is required');
    }
    
    if (!template.body) {
      throw new Error('Template body is required');
    }
    
    if (!template.type) {
      throw new Error('Template type is required');
    }
    
    if (!template.channels || template.channels.length === 0) {
      throw new Error('At least one channel is required');
    }
  }

  private async scheduleNotification(notification: NotificationData): Promise<void> {
    notification.status = 'pending';
    
    const delay = notification.scheduledAt!.getTime() - Date.now();
    
    setTimeout(() => {
      this.queueNotification(notification);
    }, delay);
    
    // Store scheduled notification
    await this.storeNotification(notification);
  }

  private async storeNotification(notification: NotificationData): Promise<void> {
    this.activeNotifications.set(notification.notificationId, notification);
    
    // Store in Redis
    await redisClient.setex(
      `notification:${notification.notificationId}`,
      86400 * 30, // 30 days
      JSON.stringify(notification)
    );
    
    // Store user notification reference
    await redisClient.lpush(
      `user_notifications:${notification.recipient.userId}`,
      notification.notificationId
    );
    
    // Trim to keep only recent notifications
    await redisClient.ltrim(`user_notifications:${notification.recipient.userId}`, 0, 999);
  }

  private async loadUserNotifications(userId: string): Promise<NotificationData[]> {
    const notificationIds = await redisClient.lrange(`user_notifications:${userId}`, 0, -1);
    const notifications: NotificationData[] = [];
    
    for (const id of notificationIds) {
      const data = await redisClient.get(`notification:${id}`);
      if (data) {
        notifications.push(JSON.parse(data));
      }
    }
    
    return notifications;
  }

  private async loadTemplates(): Promise<void> {
    // Load from Redis or database
    const templateKeys = await redisClient.keys('notification_template:*');
    
    for (const key of templateKeys) {
      const data = await redisClient.get(key);
      if (data) {
        const template = JSON.parse(data);
        this.templates.set(template.templateId, template);
      }
    }
  }

  private async storeTemplate(template: NotificationTemplate): Promise<void> {
    await redisClient.set(
      `notification_template:${template.templateId}`,
      JSON.stringify(template)
    );
  }

  private async loadPreferences(): Promise<void> {
    // Load from Redis or database
    const prefKeys = await redisClient.keys('notification_preferences:*');
    
    for (const key of prefKeys) {
      const data = await redisClient.get(key);
      if (data) {
        const prefs = JSON.parse(data);
        this.preferences.set(prefs.userId, prefs);
      }
    }
  }

  private async loadUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    const data = await redisClient.get(`notification_preferences:${userId}`);
    return data ? JSON.parse(data) : null;
  }

  private async storePreferences(preferences: NotificationPreferences): Promise<void> {
    await redisClient.set(
      `notification_preferences:${preferences.userId}`,
      JSON.stringify(preferences)
    );
  }

  private async updateAnalytics(notificationId: string, action: string, data?: any): Promise<void> {
    await redisClient.hincrby('notification_analytics', action, 1);
    
    // Store detailed analytics
    await redisClient.lpush(
      'notification_analytics_events',
      JSON.stringify({
        notificationId,
        action,
        data,
        timestamp: new Date()
      })
    );
    
    // Trim to keep only recent events
    await redisClient.ltrim('notification_analytics_events', 0, 9999);
  }

  private async calculateStats(filters?: any): Promise<NotificationStats> {
    // Implementation would calculate stats from stored data
    const stats: NotificationStats = {
      total: 0,
      sent: 0,
      delivered: 0,
      read: 0,
      clicked: 0,
      failed: 0,
      byChannel: {
        email: { sent: 0, delivered: 0, failed: 0 },
        'in-app': { sent: 0, delivered: 0, failed: 0 },
        push: { sent: 0, delivered: 0, failed: 0 },
        sms: { sent: 0, delivered: 0, failed: 0 },
        webhook: { sent: 0, delivered: 0, failed: 0 }
      },
      byType: {} as any,
      byPriority: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      },
      avgDeliveryTime: 0,
      successRate: 0
    };
    
    // Calculate from active notifications
    for (const notification of this.activeNotifications.values()) {
      stats.total++;
      
      if (notification.status === 'sent' || notification.status === 'delivered') {
        stats.sent++;
      }
      
      if (notification.status === 'delivered') {
        stats.delivered++;
      }
      
      if (notification.readAt) {
        stats.read++;
      }
      
      if (notification.clickedAt) {
        stats.clicked++;
      }
      
      if (notification.status === 'failed') {
        stats.failed++;
      }
    }
    
    stats.successRate = stats.total > 0 ? (stats.delivered / stats.total) * 100 : 0;
    
    return stats;
  }

  private startCleanupTasks(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupOldNotifications();
    }, 60 * 60 * 1000); // Every hour
  }

  private async cleanupOldNotifications(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    for (const [id, notification] of this.activeNotifications) {
      if (notification.createdAt < thirtyDaysAgo) {
        this.activeNotifications.delete(id);
      }
    }
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      await this.collectMetrics();
    }, 60 * 1000); // Every minute
  }

  private async collectMetrics(): Promise<void> {
    const stats = await this.calculateStats();
    
    logger.debug('Notification metrics collected', {
      total: stats.total,
      delivered: stats.delivered,
      successRate: stats.successRate
    });
  }

  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTemplateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Public cleanup method
  async cleanup(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
export default notificationService;