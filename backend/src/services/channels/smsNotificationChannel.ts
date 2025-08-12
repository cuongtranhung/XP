/**
 * SMS Notification Channel
 * SMS delivery via Twilio and other providers
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

export interface SMSConfig {
  provider: 'twilio' | 'messagebird' | 'nexmo' | 'aws-sns';
  twilio?: {
    accountSid: string;
    authToken: string;
    from: string | string[]; // Multiple sender numbers
    messagingServiceSid?: string;
    statusCallbackUrl?: string;
  };
  messagebird?: {
    apiKey: string;
    from: string;
  };
  nexmo?: {
    apiKey: string;
    apiSecret: string;
    from: string;
  };
  awsSns?: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    senderId?: string;
  };
  maxLength: number;
  concatenate: boolean;
  encoding: 'GSM-7' | 'UCS-2' | 'auto';
  countryCode?: string; // Default country code
  rateLimit: {
    maxPerMinute: number;
    maxPerHour: number;
    maxPerDay: number;
    maxPerNumber: number; // Per recipient
  };
  blacklist?: string[]; // Blocked numbers
  whitelist?: string[]; // Allowed numbers (if set, only these are allowed)
  optOut: {
    keywords: string[]; // STOP, UNSUBSCRIBE, etc.
    message: string; // Reply message for opt-out
    persist: boolean; // Store opt-outs
  };
  shortLinks: boolean; // Use URL shortener
  analytics: boolean; // Track delivery and clicks
  templates: {
    useTemplates: boolean;
    compliance: boolean; // Add compliance text
    signature?: string; // Add signature to messages
  };
}

export interface SMSMessage {
  to: string | string[];
  from?: string;
  body: string;
  mediaUrl?: string[]; // MMS support
  statusCallback?: string;
  validityPeriod?: number; // Seconds
  schedule?: Date;
  priority?: 'high' | 'normal';
  reference?: string;
  tags?: string[];
}

export interface SMSDeliveryResult {
  success: boolean;
  messageId?: string;
  to: string;
  from: string;
  segments: number; // Number of SMS segments
  cost?: number;
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  errorCode?: string;
  errorMessage?: string;
  timestamp: Date;
  provider: string;
}

export interface SMSDeliveryStatus {
  messageId: string;
  status: string;
  to: string;
  from: string;
  timestamp: Date;
  errorCode?: string;
  errorMessage?: string;
  segments?: number;
  price?: number;
  priceUnit?: string;
}

export interface SMSMetrics {
  sent: number;
  delivered: number;
  failed: number;
  undelivered: number;
  optOuts: number;
  segments: number;
  totalCost: number;
  avgDeliveryTime: number;
  deliveryRate: number;
  optOutRate: number;
  byCountry: Record<string, {
    sent: number;
    delivered: number;
    failed: number;
    cost: number;
  }>;
}

/**
 * SMS Notification Channel Class
 */
class SMSNotificationChannel extends EventEmitter {
  private config: SMSConfig | null = null;
  private twilioClient: any = null;
  private rateLimiter = new Map<string, { count: number; resetAt: number }>();
  private metrics: SMSMetrics = {
    sent: 0,
    delivered: 0,
    failed: 0,
    undelivered: 0,
    optOuts: 0,
    segments: 0,
    totalCost: 0,
    avgDeliveryTime: 0,
    deliveryRate: 0,
    optOutRate: 0,
    byCountry: {}
  };
  
  private readonly channel: NotificationChannel = 'sms';
  private isInitialized = false;
  private phoneNumberCache = new Map<string, string>(); // Cache formatted numbers

  constructor() {
    super();
  }

  /**
   * Initialize SMS channel
   */
  async initialize(config: SMSConfig): Promise<void> {
    try {
      this.config = config;
      
      // Initialize provider client
      await this.initializeProvider(config);
      
      // Load opt-out list
      await this.loadOptOutList();
      
      // Load metrics
      await this.loadMetrics();
      
      // Setup webhook handler if needed
      if (config.twilio?.statusCallbackUrl) {
        this.setupWebhookHandler();
      }
      
      this.isInitialized = true;
      
      logger.info('✅ SMS notification channel initialized', {
        provider: config.provider,
        from: this.getFromNumber()
      });
      
    } catch (error) {
      logger.error('❌ Failed to initialize SMS channel', { error });
      throw error;
    }
  }

  /**
   * Send SMS notification
   */
  async sendNotification(
    notification: NotificationData,
    options?: {
      template?: boolean;
      priority?: 'high' | 'normal';
      schedule?: Date;
    }
  ): Promise<SMSDeliveryResult> {
    try {
      if (!this.isInitialized) {
        throw new Error('SMS channel not initialized');
      }
      
      const startTime = Date.now();
      
      // Get recipient phone number
      const phoneNumber = await this.getPhoneNumber(notification);
      
      if (!phoneNumber) {
        throw new Error('No phone number available for recipient');
      }
      
      // Validate and format phone number
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      
      // Check opt-out status
      if (await this.isOptedOut(formattedNumber)) {
        logger.info('Recipient opted out of SMS', { to: formattedNumber });
        
        return {
          success: false,
          to: formattedNumber,
          from: this.getFromNumber(),
          segments: 0,
          status: 'undelivered',
          errorCode: 'OPT_OUT',
          errorMessage: 'Recipient has opted out',
          timestamp: new Date(),
          provider: this.config!.provider
        };
      }
      
      // Check blacklist/whitelist
      if (!this.isNumberAllowed(formattedNumber)) {
        logger.warn('Number not allowed', { to: formattedNumber });
        
        return {
          success: false,
          to: formattedNumber,
          from: this.getFromNumber(),
          segments: 0,
          status: 'undelivered',
          errorCode: 'NOT_ALLOWED',
          errorMessage: 'Number not in whitelist or is blacklisted',
          timestamp: new Date(),
          provider: this.config!.provider
        };
      }
      
      // Check rate limits
      await this.checkRateLimit(formattedNumber);
      
      // Prepare message
      const message = await this.prepareMessage(notification, formattedNumber, options);
      
      // Shorten URLs if configured
      if (this.config!.shortLinks) {
        message.body = await this.shortenUrls(message.body);
      }
      
      // Add compliance text if needed
      if (this.config!.templates.compliance) {
        message.body = this.addComplianceText(message.body);
      }
      
      // Add signature if configured
      if (this.config!.templates.signature) {
        message.body = `${message.body}\n${this.config!.templates.signature}`;
      }
      
      // Calculate segments
      const segments = this.calculateSegments(message.body);
      
      // Send SMS
      const result = await this.sendSMS(message, options);
      
      // Update metrics
      this.updateMetrics('sent', segments, result.cost, Date.now() - startTime);
      
      // Store delivery info
      await this.storeDeliveryInfo(notification.notificationId, result);
      
      // Emit success event
      this.emit('smsSent', {
        notificationId: notification.notificationId,
        messageId: result.messageId,
        to: result.to,
        segments
      });
      
      logger.debug('SMS notification sent', {
        notificationId: notification.notificationId,
        to: formattedNumber,
        segments
      });
      
      return result;
      
    } catch (error) {
      // Update metrics
      this.updateMetrics('failed');
      
      // Emit error event
      this.emit('smsError', {
        notificationId: notification.notificationId,
        error
      });
      
      logger.error('Failed to send SMS notification', {
        error,
        notificationId: notification.notificationId
      });
      
      return {
        success: false,
        to: '',
        from: this.getFromNumber(),
        segments: 0,
        status: 'failed',
        errorCode: error instanceof Error && 'code' in error ? (error as any).code : 'SMS_ERROR',
        errorMessage: error instanceof Error ? error.message : 'SMS delivery failed',
        timestamp: new Date(),
        provider: this.config?.provider || 'unknown'
      };
    }
  }

  /**
   * Send bulk SMS
   */
  async sendBulkSMS(
    notifications: NotificationData[],
    options?: {
      batchSize?: number;
      delayBetweenBatches?: number;
    }
  ): Promise<SMSDeliveryResult[]> {
    try {
      const batchSize = options?.batchSize || 100;
      const delay = options?.delayBetweenBatches || 1000;
      const results: SMSDeliveryResult[] = [];
      
      // Process in batches
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        
        // Send batch
        const batchResults = await Promise.allSettled(
          batch.map(notification => this.sendNotification(notification))
        );
        
        // Collect results
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            results.push({
              success: false,
              to: '',
              from: this.getFromNumber(),
              segments: 0,
              status: 'failed',
              errorCode: 'BATCH_ERROR',
              errorMessage: result.reason?.message || 'Batch delivery failed',
              timestamp: new Date(),
              provider: this.config?.provider || 'unknown'
            });
          }
        });
        
        // Delay between batches
        if (i + batchSize < notifications.length) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      logger.info('Bulk SMS delivery completed', {
        total: notifications.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });
      
      return results;
      
    } catch (error) {
      logger.error('Failed to send bulk SMS', { error });
      throw error;
    }
  }

  /**
   * Handle delivery status webhook
   */
  async handleDeliveryStatus(statusData: SMSDeliveryStatus): Promise<void> {
    try {
      // Update delivery status
      await redisClient.hset(
        `sms_delivery:${statusData.messageId}`,
        'status',
        JSON.stringify(statusData)
      );
      
      // Update metrics based on status
      if (statusData.status === 'delivered') {
        this.updateMetrics('delivered');
      } else if (statusData.status === 'failed' || statusData.status === 'undelivered') {
        this.updateMetrics('undelivered');
      }
      
      // Update cost if provided
      if (statusData.price) {
        this.metrics.totalCost += parseFloat(statusData.price.toString());
      }
      
      // Emit status event
      this.emit('smsDeliveryStatus', statusData);
      
      logger.debug('SMS delivery status updated', {
        messageId: statusData.messageId,
        status: statusData.status
      });
      
    } catch (error) {
      logger.error('Failed to handle delivery status', { error, statusData });
    }
  }

  /**
   * Handle opt-out request
   */
  async handleOptOut(phoneNumber: string, message?: string): Promise<void> {
    try {
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      
      // Add to opt-out list
      await redisClient.sadd('sms_opt_outs', formattedNumber);
      
      // Store opt-out details
      await redisClient.hset(
        'sms_opt_out_details',
        formattedNumber,
        JSON.stringify({
          timestamp: new Date(),
          message,
          source: 'user_request'
        })
      );
      
      // Update metrics
      this.metrics.optOuts++;
      
      // Send confirmation if configured
      if (this.config?.optOut.message) {
        await this.sendOptOutConfirmation(formattedNumber);
      }
      
      // Emit opt-out event
      this.emit('smsOptOut', { phoneNumber: formattedNumber, timestamp: new Date() });
      
      logger.info('SMS opt-out processed', { phoneNumber: formattedNumber });
      
    } catch (error) {
      logger.error('Failed to process opt-out', { error, phoneNumber });
    }
  }

  /**
   * Handle opt-in request
   */
  async handleOptIn(phoneNumber: string): Promise<void> {
    try {
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      
      // Remove from opt-out list
      await redisClient.srem('sms_opt_outs', formattedNumber);
      
      // Remove opt-out details
      await redisClient.hdel('sms_opt_out_details', formattedNumber);
      
      // Emit opt-in event
      this.emit('smsOptIn', { phoneNumber: formattedNumber, timestamp: new Date() });
      
      logger.info('SMS opt-in processed', { phoneNumber: formattedNumber });
      
    } catch (error) {
      logger.error('Failed to process opt-in', { error, phoneNumber });
    }
  }

  /**
   * Get SMS metrics
   */
  async getMetrics(period?: { from: Date; to: Date }): Promise<SMSMetrics> {
    try {
      // Calculate rates
      if (this.metrics.sent > 0) {
        this.metrics.deliveryRate = this.metrics.delivered / this.metrics.sent;
        this.metrics.optOutRate = this.metrics.optOuts / this.metrics.sent;
      }
      
      return this.metrics;
      
    } catch (error) {
      logger.error('Failed to get SMS metrics', { error });
      throw error;
    }
  }

  /**
   * Validate phone number
   */
  validatePhoneNumber(phoneNumber: string): boolean {
    // Basic validation - can be enhanced with libphonenumber
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    return cleanNumber.length >= 10 && cleanNumber.length <= 15;
  }

  /**
   * Format phone number
   */
  formatPhoneNumber(phoneNumber: string): string {
    // Check cache
    if (this.phoneNumberCache.has(phoneNumber)) {
      return this.phoneNumberCache.get(phoneNumber)!;
    }
    
    // Remove non-digits
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add country code if missing
    if (this.config?.countryCode && !cleaned.startsWith(this.config.countryCode)) {
      cleaned = this.config.countryCode + cleaned;
    }
    
    // Add + prefix
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    
    // Cache formatted number
    this.phoneNumberCache.set(phoneNumber, cleaned);
    
    return cleaned;
  }

  /**
   * Calculate SMS segments
   */
  calculateSegments(message: string): number {
    const length = message.length;
    const encoding = this.detectEncoding(message);
    
    if (encoding === 'GSM-7') {
      // GSM-7 encoding
      if (length <= 160) return 1;
      return Math.ceil(length / 153);
    } else {
      // UCS-2 encoding (Unicode)
      if (length <= 70) return 1;
      return Math.ceil(length / 67);
    }
  }

  // Private helper methods

  private async initializeProvider(config: SMSConfig): Promise<void> {
    switch (config.provider) {
      case 'twilio':
        if (!config.twilio) {
          throw new Error('Twilio configuration not provided');
        }
        
        // Initialize Twilio client
        // Implementation would use twilio package
        logger.info('Twilio client initialized');
        break;
        
      case 'messagebird':
        // Initialize MessageBird client
        throw new Error('MessageBird provider not yet implemented');
        
      case 'nexmo':
        // Initialize Nexmo/Vonage client
        throw new Error('Nexmo provider not yet implemented');
        
      case 'aws-sns':
        // Initialize AWS SNS client
        throw new Error('AWS SNS provider not yet implemented');
        
      default:
        throw new Error(`Unsupported SMS provider: ${config.provider}`);
    }
  }

  private async getPhoneNumber(notification: NotificationData): Promise<string | null> {
    // Try to get phone number from metadata
    if (notification.metadata?.phoneNumber) {
      return notification.metadata.phoneNumber;
    }
    
    // Try to get from user profile
    const userPhone = await redisClient.hget(`user:${notification.userId}`, 'phoneNumber');
    
    return userPhone;
  }

  private async prepareMessage(
    notification: NotificationData,
    to: string,
    options?: any
  ): Promise<SMSMessage> {
    // Render template if available
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
          { channel: 'sms' }
        );
        
        body = rendered.body;
        
      } catch (error) {
        logger.error('Failed to render SMS template', {
          error,
          templateId: notification.metadata.templateId
        });
      }
    }
    
    // Truncate if needed
    if (!this.config?.concatenate && body.length > this.config?.maxLength!) {
      body = body.substring(0, this.config?.maxLength! - 3) + '...';
    }
    
    // Build SMS message
    const message: SMSMessage = {
      to,
      from: this.selectFromNumber(),
      body,
      statusCallback: this.config?.twilio?.statusCallbackUrl,
      priority: options?.priority || 'normal',
      reference: notification.notificationId,
      schedule: options?.schedule,
      tags: [notification.type, notification.priority]
    };
    
    return message;
  }

  private async sendSMS(message: SMSMessage, options?: any): Promise<SMSDeliveryResult> {
    // Implementation would use the configured provider
    // This is a placeholder
    
    const messageId = `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.debug('SMS sent via provider', {
      provider: this.config?.provider,
      to: message.to,
      segments: this.calculateSegments(message.body)
    });
    
    return {
      success: true,
      messageId,
      to: message.to as string,
      from: message.from!,
      segments: this.calculateSegments(message.body),
      status: 'sent',
      timestamp: new Date(),
      provider: this.config!.provider
    };
  }

  private getFromNumber(): string {
    if (this.config?.twilio?.from) {
      if (Array.isArray(this.config.twilio.from)) {
        return this.config.twilio.from[0];
      }
      return this.config.twilio.from;
    }
    
    return 'SMS';
  }

  private selectFromNumber(): string {
    if (this.config?.twilio?.from) {
      if (Array.isArray(this.config.twilio.from)) {
        // Round-robin selection
        const index = Math.floor(Math.random() * this.config.twilio.from.length);
        return this.config.twilio.from[index];
      }
      return this.config.twilio.from;
    }
    
    return 'SMS';
  }

  private detectEncoding(message: string): 'GSM-7' | 'UCS-2' {
    // Check if message contains non-GSM characters
    const gsmChars = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
    
    for (const char of message) {
      if (!gsmChars.includes(char)) {
        return 'UCS-2';
      }
    }
    
    return 'GSM-7';
  }

  private async isOptedOut(phoneNumber: string): Promise<boolean> {
    const isOptedOut = await redisClient.sismember('sms_opt_outs', phoneNumber);
    return isOptedOut === 1;
  }

  private isNumberAllowed(phoneNumber: string): boolean {
    // Check whitelist
    if (this.config?.whitelist && this.config.whitelist.length > 0) {
      return this.config.whitelist.some(pattern => 
        phoneNumber.includes(pattern) || new RegExp(pattern).test(phoneNumber)
      );
    }
    
    // Check blacklist
    if (this.config?.blacklist && this.config.blacklist.length > 0) {
      return !this.config.blacklist.some(pattern => 
        phoneNumber.includes(pattern) || new RegExp(pattern).test(phoneNumber)
      );
    }
    
    return true;
  }

  private async checkRateLimit(phoneNumber: string): Promise<void> {
    if (!this.config?.rateLimit) return;
    
    const now = Date.now();
    const minuteKey = `sms_rate:minute:${Math.floor(now / 60000)}`;
    const hourKey = `sms_rate:hour:${Math.floor(now / 3600000)}`;
    const dayKey = `sms_rate:day:${Math.floor(now / 86400000)}`;
    const numberKey = `sms_rate:number:${phoneNumber}:${Math.floor(now / 86400000)}`;
    
    // Check per-minute limit
    const minuteCount = await redisClient.incr(minuteKey);
    if (minuteCount === 1) {
      await redisClient.expire(minuteKey, 60);
    }
    if (minuteCount > this.config.rateLimit.maxPerMinute) {
      throw new Error('SMS rate limit exceeded (per minute)');
    }
    
    // Check per-hour limit
    const hourCount = await redisClient.incr(hourKey);
    if (hourCount === 1) {
      await redisClient.expire(hourKey, 3600);
    }
    if (hourCount > this.config.rateLimit.maxPerHour) {
      throw new Error('SMS rate limit exceeded (per hour)');
    }
    
    // Check per-day limit
    const dayCount = await redisClient.incr(dayKey);
    if (dayCount === 1) {
      await redisClient.expire(dayKey, 86400);
    }
    if (dayCount > this.config.rateLimit.maxPerDay) {
      throw new Error('SMS rate limit exceeded (per day)');
    }
    
    // Check per-number limit
    const numberCount = await redisClient.incr(numberKey);
    if (numberCount === 1) {
      await redisClient.expire(numberKey, 86400);
    }
    if (numberCount > this.config.rateLimit.maxPerNumber) {
      throw new Error('SMS rate limit exceeded for this number');
    }
  }

  private async shortenUrls(text: string): Promise<string> {
    // Implementation would use a URL shortening service
    // This is a placeholder
    return text;
  }

  private addComplianceText(message: string): string {
    const complianceText = '\nReply STOP to unsubscribe';
    
    // Check if compliance text already exists
    if (message.toLowerCase().includes('stop') && message.toLowerCase().includes('unsubscribe')) {
      return message;
    }
    
    return message + complianceText;
  }

  private async sendOptOutConfirmation(phoneNumber: string): Promise<void> {
    if (!this.config?.optOut.message) return;
    
    try {
      const message: SMSMessage = {
        to: phoneNumber,
        from: this.selectFromNumber(),
        body: this.config.optOut.message,
        priority: 'high'
      };
      
      await this.sendSMS(message);
      
    } catch (error) {
      logger.error('Failed to send opt-out confirmation', { error, phoneNumber });
    }
  }

  private setupWebhookHandler(): void {
    // Webhook handler would be set up in Express routes
    logger.info('SMS webhook handler configured');
  }

  private updateMetrics(event: string, segments?: number, cost?: number, deliveryTime?: number): void {
    switch (event) {
      case 'sent':
        this.metrics.sent++;
        if (segments) {
          this.metrics.segments += segments;
        }
        if (cost) {
          this.metrics.totalCost += cost;
        }
        if (deliveryTime) {
          const totalTime = this.metrics.avgDeliveryTime * (this.metrics.sent - 1);
          this.metrics.avgDeliveryTime = (totalTime + deliveryTime) / this.metrics.sent;
        }
        break;
      case 'delivered':
        this.metrics.delivered++;
        break;
      case 'failed':
        this.metrics.failed++;
        break;
      case 'undelivered':
        this.metrics.undelivered++;
        break;
    }
    
    // Persist metrics
    this.persistMetrics();
  }

  private async persistMetrics(): Promise<void> {
    await redisClient.hset(
      'sms_metrics',
      'current',
      JSON.stringify(this.metrics)
    );
  }

  private async loadMetrics(): Promise<void> {
    const data = await redisClient.hget('sms_metrics', 'current');
    if (data) {
      this.metrics = JSON.parse(data);
    }
  }

  private async loadOptOutList(): Promise<void> {
    // Load opt-out list from storage
    const optOuts = await redisClient.smembers('sms_opt_outs');
    logger.info('SMS opt-out list loaded', { count: optOuts.length });
  }

  private async storeDeliveryInfo(notificationId: string, result: SMSDeliveryResult): Promise<void> {
    await redisClient.hset(
      `sms_delivery:${result.messageId}`,
      'result',
      JSON.stringify({
        notificationId,
        ...result
      })
    );
    
    // Set expiry for 7 days
    await redisClient.expire(`sms_delivery:${result.messageId}`, 7 * 24 * 60 * 60);
  }

  // Public cleanup method
  async cleanup(): Promise<void> {
    this.isInitialized = false;
    
    // Clean up provider clients
    if (this.twilioClient) {
      this.twilioClient = null;
    }
  }
}

// Export singleton instance
export const smsNotificationChannel = new SMSNotificationChannel();
export default smsNotificationChannel;