/**
 * Push Notification Channel
 * FCM/APNS push notification delivery system
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import redisClient from '../../config/redis';
import { 
  NotificationData,
  NotificationChannel,
  NotificationPriority 
} from '../notificationService';
import notificationTemplateService, { 
  PersonalizationContext,
  TemplateRenderResult 
} from '../notificationTemplateService';

export interface PushToken {
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceId: string;
  userId: string;
  appVersion?: string;
  osVersion?: string;
  model?: string;
  locale?: string;
  timezone?: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
  failureCount: number;
  lastFailureAt?: Date;
  lastFailureReason?: string;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  image?: string;
  badge?: number;
  sound?: string | boolean;
  vibrate?: number[];
  data?: Record<string, any>;
  clickAction?: string;
  color?: string;
  tag?: string;
  requireInteraction?: boolean;
  renotify?: boolean;
  silent?: boolean;
  timestamp?: number;
  ttl?: number; // Time to live in seconds
  priority?: 'high' | 'normal';
  contentAvailable?: boolean;
  mutableContent?: boolean;
  category?: string;
  threadId?: string;
  // iOS specific
  subtitle?: string;
  launchImage?: string;
  attachments?: Array<{
    url: string;
    type: string;
  }>;
  // Android specific
  channelId?: string;
  ticker?: string;
  visibility?: 'private' | 'public' | 'secret';
  localOnly?: boolean;
  lights?: {
    color: string;
    onMs: number;
    offMs: number;
  };
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export interface PushDeliveryResult {
  success: boolean;
  notificationId: string;
  messageId?: string;
  platform: 'ios' | 'android' | 'web';
  token: string;
  timestamp: Date;
  error?: {
    code: string;
    message: string;
    shouldRetry: boolean;
    shouldRemoveToken: boolean;
  };
}

export interface PushChannelConfig {
  fcm?: {
    projectId: string;
    privateKey: string;
    clientEmail: string;
    databaseUrl?: string;
  };
  apns?: {
    teamId: string;
    keyId: string;
    key: string;
    bundleId: string;
    production: boolean;
  };
  vapid?: {
    publicKey: string;
    privateKey: string;
    subject: string;
  };
  maxTokensPerUser: number;
  tokenExpiryDays: number;
  maxRetries: number;
  retryDelay: number;
  batchSize: number;
  ttl: number; // Default TTL in seconds
  dryRun: boolean;
  priority: 'high' | 'normal';
  sound: {
    ios: string;
    android: string;
  };
  collapseKey?: string;
}

export interface PushMetrics {
  sent: number;
  delivered: number;
  failed: number;
  opened: number;
  dismissed: number;
  tokenRegistrations: number;
  tokenUnregistrations: number;
  tokenFailures: number;
  avgDeliveryTime: number;
  deliveryRate: number;
  openRate: number;
  byPlatform: {
    ios: { sent: number; delivered: number; failed: number };
    android: { sent: number; delivered: number; failed: number };
    web: { sent: number; delivered: number; failed: number };
  };
}

/**
 * Push Notification Channel Class
 */
class PushNotificationChannel extends EventEmitter {
  private config: PushChannelConfig = {
    maxTokensPerUser: 10,
    tokenExpiryDays: 90,
    maxRetries: 3,
    retryDelay: 1000,
    batchSize: 500,
    ttl: 86400, // 24 hours
    dryRun: false,
    priority: 'high',
    sound: {
      ios: 'default',
      android: 'default'
    }
  };
  
  private metrics: PushMetrics = {
    sent: 0,
    delivered: 0,
    failed: 0,
    opened: 0,
    dismissed: 0,
    tokenRegistrations: 0,
    tokenUnregistrations: 0,
    tokenFailures: 0,
    avgDeliveryTime: 0,
    deliveryRate: 0,
    openRate: 0,
    byPlatform: {
      ios: { sent: 0, delivered: 0, failed: 0 },
      android: { sent: 0, delivered: 0, failed: 0 },
      web: { sent: 0, delivered: 0, failed: 0 }
    }
  };
  
  private fcmClient: any = null;
  private apnsClient: any = null;
  private readonly channel: NotificationChannel = 'push';

  constructor() {
    super();
  }

  /**
   * Initialize push notification channel
   */
  async initialize(config: PushChannelConfig): Promise<void> {
    try {
      this.config = { ...this.config, ...config };
      
      // Initialize FCM client
      if (config.fcm) {
        await this.initializeFCM(config.fcm);
      }
      
      // Initialize APNS client
      if (config.apns) {
        await this.initializeAPNS(config.apns);
      }
      
      // Load metrics
      await this.loadMetrics();
      
      // Setup token cleanup
      this.setupTokenCleanup();
      
      logger.info('✅ Push notification channel initialized', {
        fcm: !!config.fcm,
        apns: !!config.apns,
        vapid: !!config.vapid
      });
      
    } catch (error) {
      logger.error('❌ Failed to initialize push channel', { error });
      throw error;
    }
  }

  /**
   * Register push token
   */
  async registerToken(tokenData: {
    token: string;
    platform: 'ios' | 'android' | 'web';
    deviceId: string;
    userId: string;
    appVersion?: string;
    osVersion?: string;
    model?: string;
    locale?: string;
    timezone?: string;
  }): Promise<PushToken> {
    try {
      // Validate token
      if (!this.validateToken(tokenData.token, tokenData.platform)) {
        throw new Error('Invalid push token');
      }
      
      // Check if token already exists
      const existingToken = await this.getTokenByValue(tokenData.token);
      
      if (existingToken) {
        // Update existing token
        existingToken.userId = tokenData.userId;
        existingToken.updatedAt = new Date();
        existingToken.lastUsedAt = new Date();
        
        await this.storeToken(existingToken);
        
        logger.debug('Push token updated', {
          userId: tokenData.userId,
          platform: tokenData.platform
        });
        
        return existingToken;
      }
      
      // Create new token
      const pushToken: PushToken = {
        ...tokenData,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        failureCount: 0
      };
      
      // Check token limit per user
      await this.enforceTokenLimit(tokenData.userId);
      
      // Store token
      await this.storeToken(pushToken);
      
      // Update metrics
      this.metrics.tokenRegistrations++;
      
      // Emit registration event
      this.emit('tokenRegistered', pushToken);
      
      logger.info('Push token registered', {
        userId: tokenData.userId,
        platform: tokenData.platform,
        deviceId: tokenData.deviceId
      });
      
      return pushToken;
      
    } catch (error) {
      logger.error('Failed to register push token', { error, tokenData });
      throw error;
    }
  }

  /**
   * Unregister push token
   */
  async unregisterToken(token: string): Promise<void> {
    try {
      const pushToken = await this.getTokenByValue(token);
      
      if (!pushToken) {
        logger.warn('Token not found for unregistration', { token });
        return;
      }
      
      // Delete token
      await this.deleteToken(token);
      
      // Update metrics
      this.metrics.tokenUnregistrations++;
      
      // Emit unregistration event
      this.emit('tokenUnregistered', { token, userId: pushToken.userId });
      
      logger.info('Push token unregistered', {
        userId: pushToken.userId,
        platform: pushToken.platform
      });
      
    } catch (error) {
      logger.error('Failed to unregister push token', { error, token });
      throw error;
    }
  }

  /**
   * Send push notification
   */
  async sendNotification(
    notification: NotificationData,
    options?: {
      template?: boolean;
      dryRun?: boolean;
      priority?: 'high' | 'normal';
    }
  ): Promise<PushDeliveryResult[]> {
    try {
      const startTime = Date.now();
      
      // Get user tokens
      const tokens = await this.getUserTokens(notification.userId);
      
      if (tokens.length === 0) {
        logger.debug('No push tokens found for user', { userId: notification.userId });
        return [];
      }
      
      // Prepare payload
      const payload = await this.preparePayload(notification, options);
      
      const results: PushDeliveryResult[] = [];
      
      // Send to each token
      for (const token of tokens) {
        if (!token.enabled) continue;
        
        try {
          const result = await this.sendToToken(token, payload, options);
          results.push(result);
          
          if (result.success) {
            // Update last used
            token.lastUsedAt = new Date();
            await this.storeToken(token);
            
            // Update metrics
            this.updateMetrics('sent', token.platform, Date.now() - startTime);
            
          } else {
            // Handle failure
            await this.handleTokenFailure(token, result.error);
            
            // Update metrics
            this.updateMetrics('failed', token.platform);
          }
          
        } catch (error) {
          logger.error('Failed to send to token', {
            error,
            token: token.token,
            platform: token.platform
          });
          
          results.push({
            success: false,
            notificationId: notification.notificationId,
            platform: token.platform,
            token: token.token,
            timestamp: new Date(),
            error: {
              code: 'SEND_ERROR',
              message: error instanceof Error ? error.message : 'Send failed',
              shouldRetry: true,
              shouldRemoveToken: false
            }
          });
        }
      }
      
      // Emit delivery event
      this.emit('pushDelivered', {
        notificationId: notification.notificationId,
        results,
        totalTokens: tokens.length,
        successful: results.filter(r => r.success).length
      });
      
      return results;
      
    } catch (error) {
      logger.error('Failed to send push notification', {
        error,
        notificationId: notification.notificationId
      });
      throw error;
    }
  }

  /**
   * Send multicast push notification
   */
  async sendMulticast(
    notification: NotificationData,
    userIds: string[],
    options?: {
      template?: boolean;
      dryRun?: boolean;
    }
  ): Promise<{
    totalUsers: number;
    totalTokens: number;
    successful: number;
    failed: number;
    results: PushDeliveryResult[];
  }> {
    try {
      const allResults: PushDeliveryResult[] = [];
      let totalTokens = 0;
      
      // Get all tokens for users
      const tokensByUser = new Map<string, PushToken[]>();
      
      for (const userId of userIds) {
        const tokens = await this.getUserTokens(userId);
        if (tokens.length > 0) {
          tokensByUser.set(userId, tokens);
          totalTokens += tokens.length;
        }
      }
      
      // Prepare payload
      const payload = await this.preparePayload(notification, options);
      
      // Group tokens by platform
      const tokensByPlatform = new Map<string, PushToken[]>();
      
      for (const tokens of tokensByUser.values()) {
        for (const token of tokens) {
          if (!token.enabled) continue;
          
          const platform = token.platform;
          if (!tokensByPlatform.has(platform)) {
            tokensByPlatform.set(platform, []);
          }
          tokensByPlatform.get(platform)!.push(token);
        }
      }
      
      // Send to each platform in batches
      for (const [platform, tokens] of tokensByPlatform) {
        const batches = this.createBatches(tokens, this.config.batchSize);
        
        for (const batch of batches) {
          const batchResults = await this.sendBatch(batch, payload, platform as any, options);
          allResults.push(...batchResults);
        }
      }
      
      const successful = allResults.filter(r => r.success).length;
      const failed = allResults.filter(r => !r.success).length;
      
      logger.info('Multicast push notification sent', {
        notificationId: notification.notificationId,
        totalUsers: userIds.length,
        totalTokens,
        successful,
        failed
      });
      
      return {
        totalUsers: userIds.length,
        totalTokens,
        successful,
        failed,
        results: allResults
      };
      
    } catch (error) {
      logger.error('Failed to send multicast push', { error });
      throw error;
    }
  }

  /**
   * Handle push notification interaction
   */
  async handleInteraction(interactionData: {
    notificationId: string;
    messageId?: string;
    userId: string;
    action: 'opened' | 'dismissed' | 'action';
    actionId?: string;
    timestamp: Date;
    platform: 'ios' | 'android' | 'web';
  }): Promise<void> {
    try {
      // Store interaction
      await redisClient.hset(
        `push_interactions:${interactionData.notificationId}`,
        Date.now().toString(),
        JSON.stringify(interactionData)
      );
      
      // Update metrics
      if (interactionData.action === 'opened') {
        this.metrics.opened++;
      } else if (interactionData.action === 'dismissed') {
        this.metrics.dismissed++;
      }
      
      // Emit interaction event
      this.emit('pushInteraction', interactionData);
      
      logger.debug('Push interaction handled', interactionData);
      
    } catch (error) {
      logger.error('Failed to handle push interaction', { error, interactionData });
    }
  }

  /**
   * Get user's push tokens
   */
  async getUserTokens(userId: string): Promise<PushToken[]> {
    try {
      const tokenIds = await redisClient.smembers(`user_push_tokens:${userId}`);
      const tokens: PushToken[] = [];
      
      for (const tokenId of tokenIds) {
        const data = await redisClient.hget('push_tokens', tokenId);
        if (data) {
          const token = JSON.parse(data);
          tokens.push(token);
        }
      }
      
      // Filter enabled tokens
      return tokens.filter(t => t.enabled);
      
    } catch (error) {
      logger.error('Failed to get user tokens', { error, userId });
      return [];
    }
  }

  /**
   * Update token status
   */
  async updateTokenStatus(
    token: string,
    status: {
      enabled?: boolean;
      failureCount?: number;
      lastFailureAt?: Date;
      lastFailureReason?: string;
    }
  ): Promise<void> {
    try {
      const pushToken = await this.getTokenByValue(token);
      
      if (!pushToken) {
        logger.warn('Token not found for status update', { token });
        return;
      }
      
      // Update status
      Object.assign(pushToken, status);
      pushToken.updatedAt = new Date();
      
      await this.storeToken(pushToken);
      
      logger.debug('Token status updated', { token, status });
      
    } catch (error) {
      logger.error('Failed to update token status', { error, token });
    }
  }

  /**
   * Get push metrics
   */
  async getMetrics(period?: { from: Date; to: Date }): Promise<PushMetrics> {
    try {
      // Calculate rates
      if (this.metrics.sent > 0) {
        this.metrics.deliveryRate = this.metrics.delivered / this.metrics.sent;
        this.metrics.openRate = this.metrics.opened / this.metrics.delivered;
      }
      
      return this.metrics;
      
    } catch (error) {
      logger.error('Failed to get push metrics', { error });
      throw error;
    }
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const now = Date.now();
      const expiryTime = this.config.tokenExpiryDays * 24 * 60 * 60 * 1000;
      let cleaned = 0;
      
      // Get all tokens
      const tokens = await redisClient.hgetall('push_tokens');
      
      for (const [tokenId, data] of Object.entries(tokens)) {
        const token = JSON.parse(data);
        const lastUsed = token.lastUsedAt ? new Date(token.lastUsedAt).getTime() : 
                         new Date(token.createdAt).getTime();
        
        // Check if expired
        if (now - lastUsed > expiryTime) {
          await this.deleteToken(token.token);
          cleaned++;
        }
        
        // Check failure count
        if (token.failureCount >= 5) {
          await this.deleteToken(token.token);
          cleaned++;
        }
      }
      
      logger.info('Expired push tokens cleaned', { count: cleaned });
      
      return cleaned;
      
    } catch (error) {
      logger.error('Failed to cleanup expired tokens', { error });
      throw error;
    }
  }

  // Private helper methods

  private async initializeFCM(config: any): Promise<void> {
    // Initialize Firebase Admin SDK
    // Implementation would use firebase-admin package
    logger.info('FCM client initialized');
  }

  private async initializeAPNS(config: any): Promise<void> {
    // Initialize APNS client
    // Implementation would use apn package
    logger.info('APNS client initialized');
  }

  private validateToken(token: string, platform: 'ios' | 'android' | 'web'): boolean {
    // Basic validation
    if (!token || token.length < 10) return false;
    
    switch (platform) {
      case 'ios':
        // iOS tokens are typically 64 hex characters
        return /^[a-f0-9]{64}$/i.test(token);
      case 'android':
        // FCM tokens are typically 150+ characters
        return token.length > 100;
      case 'web':
        // Web push tokens vary
        return token.length > 50;
      default:
        return false;
    }
  }

  private async preparePayload(
    notification: NotificationData,
    options?: any
  ): Promise<PushNotificationPayload> {
    // Render template if available
    let title = notification.title || 'Notification';
    let body = notification.message;
    
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
          { channel: 'push' }
        );
        
        title = rendered.title || title;
        body = rendered.body;
        
      } catch (error) {
        logger.error('Failed to render push template', {
          error,
          templateId: notification.metadata.templateId
        });
      }
    }
    
    // Build payload
    const payload: PushNotificationPayload = {
      title,
      body,
      icon: notification.metadata?.icon,
      image: notification.metadata?.image,
      badge: notification.metadata?.badge,
      sound: notification.metadata?.sound !== false ? 
             (notification.metadata?.sound || this.config.sound) : false,
      data: {
        notificationId: notification.notificationId,
        type: notification.type,
        ...notification.metadata
      },
      clickAction: notification.actions?.[0]?.link,
      tag: notification.groupId,
      requireInteraction: notification.priority === 'critical',
      priority: options?.priority || this.mapPriority(notification.priority),
      ttl: notification.metadata?.ttl || this.config.ttl,
      timestamp: Date.now(),
      actions: notification.actions?.map(action => ({
        action: action.action,
        title: action.label,
        icon: action.icon
      }))
    };
    
    return payload;
  }

  private async sendToToken(
    token: PushToken,
    payload: PushNotificationPayload,
    options?: any
  ): Promise<PushDeliveryResult> {
    try {
      let messageId: string | undefined;
      
      switch (token.platform) {
        case 'android':
          messageId = await this.sendFCM(token.token, payload, options);
          break;
        case 'ios':
          messageId = await this.sendAPNS(token.token, payload, options);
          break;
        case 'web':
          messageId = await this.sendWebPush(token.token, payload, options);
          break;
      }
      
      return {
        success: true,
        notificationId: payload.data?.notificationId || '',
        messageId,
        platform: token.platform,
        token: token.token,
        timestamp: new Date()
      };
      
    } catch (error) {
      const errorInfo = this.parseError(error);
      
      return {
        success: false,
        notificationId: payload.data?.notificationId || '',
        platform: token.platform,
        token: token.token,
        timestamp: new Date(),
        error: errorInfo
      };
    }
  }

  private async sendFCM(token: string, payload: PushNotificationPayload, options?: any): Promise<string> {
    // Implementation would use FCM client
    // This is a placeholder
    logger.debug('FCM notification sent', { token: token.substring(0, 10) + '...' });
    return `fcm_${Date.now()}`;
  }

  private async sendAPNS(token: string, payload: PushNotificationPayload, options?: any): Promise<string> {
    // Implementation would use APNS client
    // This is a placeholder
    logger.debug('APNS notification sent', { token: token.substring(0, 10) + '...' });
    return `apns_${Date.now()}`;
  }

  private async sendWebPush(token: string, payload: PushNotificationPayload, options?: any): Promise<string> {
    // Implementation would use web-push library
    // This is a placeholder
    logger.debug('Web push notification sent', { token: token.substring(0, 10) + '...' });
    return `web_${Date.now()}`;
  }

  private async sendBatch(
    tokens: PushToken[],
    payload: PushNotificationPayload,
    platform: 'ios' | 'android' | 'web',
    options?: any
  ): Promise<PushDeliveryResult[]> {
    // Implementation would send batch notifications
    // This is a simplified version
    const results: PushDeliveryResult[] = [];
    
    for (const token of tokens) {
      const result = await this.sendToToken(token, payload, options);
      results.push(result);
    }
    
    return results;
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private mapPriority(priority: NotificationPriority): 'high' | 'normal' {
    return priority === 'critical' || priority === 'high' ? 'high' : 'normal';
  }

  private parseError(error: any): {
    code: string;
    message: string;
    shouldRetry: boolean;
    shouldRemoveToken: boolean;
  } {
    // Parse platform-specific errors
    const errorCode = error?.code || 'UNKNOWN_ERROR';
    const errorMessage = error?.message || 'Push delivery failed';
    
    // Determine if token should be removed
    const invalidTokenCodes = [
      'InvalidRegistration',
      'NotRegistered',
      'InvalidToken',
      'Unregistered'
    ];
    
    const shouldRemoveToken = invalidTokenCodes.includes(errorCode);
    
    // Determine if should retry
    const retryableCodes = [
      'Unavailable',
      'InternalServerError',
      'Timeout'
    ];
    
    const shouldRetry = retryableCodes.includes(errorCode);
    
    return {
      code: errorCode,
      message: errorMessage,
      shouldRetry,
      shouldRemoveToken
    };
  }

  private async handleTokenFailure(token: PushToken, error?: any): Promise<void> {
    if (!error) return;
    
    token.failureCount++;
    token.lastFailureAt = new Date();
    token.lastFailureReason = error.message;
    
    if (error.shouldRemoveToken || token.failureCount >= 5) {
      // Disable token
      token.enabled = false;
      
      // Update metrics
      this.metrics.tokenFailures++;
      
      logger.warn('Push token disabled due to failures', {
        token: token.token.substring(0, 10) + '...',
        platform: token.platform,
        failureCount: token.failureCount
      });
    }
    
    await this.storeToken(token);
  }

  private async enforceTokenLimit(userId: string): Promise<void> {
    const tokens = await this.getUserTokens(userId);
    
    if (tokens.length >= this.config.maxTokensPerUser) {
      // Remove oldest token
      const oldest = tokens.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )[0];
      
      if (oldest) {
        await this.deleteToken(oldest.token);
      }
    }
  }

  private async getTokenByValue(token: string): Promise<PushToken | null> {
    const data = await redisClient.hget('push_tokens', token);
    return data ? JSON.parse(data) : null;
  }

  private async storeToken(token: PushToken): Promise<void> {
    // Store token
    await redisClient.hset('push_tokens', token.token, JSON.stringify(token));
    
    // Add to user's set
    await redisClient.sadd(`user_push_tokens:${token.userId}`, token.token);
    
    // Add to platform set
    await redisClient.sadd(`platform_tokens:${token.platform}`, token.token);
  }

  private async deleteToken(token: string): Promise<void> {
    const pushToken = await this.getTokenByValue(token);
    
    if (pushToken) {
      // Remove from user's set
      await redisClient.srem(`user_push_tokens:${pushToken.userId}`, token);
      
      // Remove from platform set
      await redisClient.srem(`platform_tokens:${pushToken.platform}`, token);
    }
    
    // Delete token
    await redisClient.hdel('push_tokens', token);
  }

  private setupTokenCleanup(): void {
    // Run cleanup daily
    setInterval(() => {
      this.cleanupExpiredTokens();
    }, 24 * 60 * 60 * 1000);
  }

  private updateMetrics(event: string, platform?: string, deliveryTime?: number): void {
    if (event === 'sent') {
      this.metrics.sent++;
      if (platform) {
        this.metrics.byPlatform[platform].sent++;
      }
      if (deliveryTime) {
        const totalTime = this.metrics.avgDeliveryTime * (this.metrics.sent - 1);
        this.metrics.avgDeliveryTime = (totalTime + deliveryTime) / this.metrics.sent;
      }
    } else if (event === 'delivered') {
      this.metrics.delivered++;
      if (platform) {
        this.metrics.byPlatform[platform].delivered++;
      }
    } else if (event === 'failed') {
      this.metrics.failed++;
      if (platform) {
        this.metrics.byPlatform[platform].failed++;
      }
    }
    
    // Persist metrics
    this.persistMetrics();
  }

  private async persistMetrics(): Promise<void> {
    await redisClient.hset(
      'push_metrics',
      'current',
      JSON.stringify(this.metrics)
    );
  }

  private async loadMetrics(): Promise<void> {
    const data = await redisClient.hget('push_metrics', 'current');
    if (data) {
      this.metrics = JSON.parse(data);
    }
  }
}

// Export singleton instance
export const pushNotificationChannel = new PushNotificationChannel();
export default pushNotificationChannel;