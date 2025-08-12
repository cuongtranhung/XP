/**
 * Email Notification Channel
 * SMTP-based email delivery with HTML templates and attachments
 */

import nodemailer from 'nodemailer';
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

export interface EmailConfig {
  provider: 'smtp' | 'sendgrid' | 'ses' | 'mailgun';
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
    tls?: {
      rejectUnauthorized?: boolean;
      ciphers?: string;
    };
  };
  sendgrid?: {
    apiKey: string;
    from: string;
  };
  ses?: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  mailgun?: {
    apiKey: string;
    domain: string;
    from: string;
  };
  defaults: {
    from: string;
    replyTo?: string;
    bcc?: string[];
    headers?: Record<string, string>;
  };
  rateLimit?: {
    maxPerSecond?: number;
    maxPerMinute?: number;
    maxPerHour?: number;
  };
  bounce?: {
    handleBounces: boolean;
    bounceAddress?: string;
    maxBounceRate?: number;
  };
  tracking?: {
    opens: boolean;
    clicks: boolean;
    unsubscribes: boolean;
  };
}

export interface EmailMessage {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  from?: string;
  replyTo?: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content?: Buffer | string;
    path?: string;
    contentType?: string;
    cid?: string; // For inline images
  }>;
  headers?: Record<string, string>;
  priority?: 'high' | 'normal' | 'low';
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  list?: {
    id?: string;
    unsubscribe?: string;
    help?: string;
  };
  alternatives?: Array<{
    contentType: string;
    content: string;
  }>;
}

export interface EmailDeliveryResult {
  success: boolean;
  messageId?: string;
  envelope?: {
    from: string;
    to: string[];
  };
  accepted?: string[];
  rejected?: string[];
  pending?: string[];
  response?: string;
  error?: {
    code: string;
    message: string;
    permanent: boolean;
    details?: any;
  };
  timestamp: Date;
  attempts: number;
}

export interface EmailMetrics {
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  failed: number;
  avgDeliveryTime: number;
  deliveryRate: number;
  bounceRate: number;
  openRate: number;
  clickRate: number;
}

/**
 * Email Notification Channel Class
 */
class EmailNotificationChannel extends EventEmitter {
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig | null = null;
  private rateLimiter = new Map<string, number>();
  private metrics: EmailMetrics = {
    sent: 0,
    delivered: 0,
    bounced: 0,
    complained: 0,
    opened: 0,
    clicked: 0,
    unsubscribed: 0,
    failed: 0,
    avgDeliveryTime: 0,
    deliveryRate: 0,
    bounceRate: 0,
    openRate: 0,
    clickRate: 0
  };
  
  private readonly channel: NotificationChannel = 'email';
  private isInitialized = false;

  constructor() {
    super();
  }

  /**
   * Initialize email channel
   */
  async initialize(config: EmailConfig): Promise<void> {
    try {
      this.config = config;
      
      // Create transporter based on provider
      await this.createTransporter();
      
      // Verify connection
      await this.verifyConnection();
      
      // Load metrics from storage
      await this.loadMetrics();
      
      // Setup bounce handling
      if (config.bounce?.handleBounces) {
        await this.setupBounceHandling();
      }
      
      // Setup tracking
      if (config.tracking) {
        await this.setupTracking();
      }
      
      this.isInitialized = true;
      
      logger.info('✅ Email notification channel initialized', {
        provider: config.provider,
        from: config.defaults.from
      });
      
    } catch (error) {
      logger.error('❌ Failed to initialize email channel', { error });
      throw error;
    }
  }

  /**
   * Send notification via email
   */
  async sendNotification(
    notification: NotificationData,
    options?: {
      template?: boolean;
      retry?: boolean;
      priority?: EmailMessage['priority'];
    }
  ): Promise<EmailDeliveryResult> {
    try {
      if (!this.isInitialized || !this.transporter) {
        throw new Error('Email channel not initialized');
      }
      
      const startTime = Date.now();
      
      // Check rate limits
      await this.checkRateLimit(notification.userId);
      
      // Prepare email message
      const message = await this.prepareEmailMessage(notification, options);
      
      // Add tracking pixels/links if enabled
      if (this.config?.tracking) {
        this.addTracking(message, notification.notificationId);
      }
      
      // Send email
      const result = await this.sendEmail(message);
      
      // Update metrics
      this.updateMetrics('sent', Date.now() - startTime);
      
      // Store delivery info
      await this.storeDeliveryInfo(notification.notificationId, result);
      
      // Emit success event
      this.emit('emailSent', {
        notificationId: notification.notificationId,
        messageId: result.messageId,
        to: message.to
      });
      
      return result;
      
    } catch (error) {
      // Update metrics
      this.updateMetrics('failed');
      
      // Emit error event
      this.emit('emailError', {
        notificationId: notification.notificationId,
        error
      });
      
      logger.error('Failed to send email notification', {
        error,
        notificationId: notification.notificationId
      });
      
      return {
        success: false,
        error: {
          code: error instanceof Error && 'code' in error ? (error as any).code : 'EMAIL_ERROR',
          message: error instanceof Error ? error.message : 'Email delivery failed',
          permanent: this.isPermanentError(error)
        },
        timestamp: new Date(),
        attempts: 1
      };
    }
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmails(
    notifications: NotificationData[],
    options?: {
      batchSize?: number;
      delayBetweenBatches?: number;
    }
  ): Promise<EmailDeliveryResult[]> {
    try {
      const batchSize = options?.batchSize || 50;
      const delay = options?.delayBetweenBatches || 1000;
      const results: EmailDeliveryResult[] = [];
      
      // Process in batches
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        
        // Send batch in parallel
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
              error: {
                code: 'BATCH_ERROR',
                message: result.reason?.message || 'Batch delivery failed',
                permanent: false
              },
              timestamp: new Date(),
              attempts: 1
            });
          }
        });
        
        // Delay between batches
        if (i + batchSize < notifications.length) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      logger.info('Bulk email delivery completed', {
        total: notifications.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });
      
      return results;
      
    } catch (error) {
      logger.error('Failed to send bulk emails', { error });
      throw error;
    }
  }

  /**
   * Handle email bounce
   */
  async handleBounce(bounceData: {
    messageId: string;
    recipient: string;
    bounceType: 'hard' | 'soft';
    bounceSubType?: string;
    timestamp: Date;
    diagnosticCode?: string;
  }): Promise<void> {
    try {
      // Update metrics
      this.updateMetrics('bounced');
      
      // Store bounce info
      await redisClient.hset(
        `email_bounce:${bounceData.recipient}`,
        bounceData.messageId,
        JSON.stringify(bounceData)
      );
      
      // Handle hard bounces
      if (bounceData.bounceType === 'hard') {
        await this.handleHardBounce(bounceData.recipient);
      }
      
      // Emit bounce event
      this.emit('emailBounce', bounceData);
      
      logger.warn('Email bounce received', bounceData);
      
    } catch (error) {
      logger.error('Failed to handle email bounce', { error, bounceData });
    }
  }

  /**
   * Handle email complaint
   */
  async handleComplaint(complaintData: {
    messageId: string;
    recipient: string;
    complaintType: 'abuse' | 'fraud' | 'virus' | 'other';
    timestamp: Date;
    userAgent?: string;
  }): Promise<void> {
    try {
      // Update metrics
      this.updateMetrics('complained');
      
      // Store complaint info
      await redisClient.hset(
        `email_complaint:${complaintData.recipient}`,
        complaintData.messageId,
        JSON.stringify(complaintData)
      );
      
      // Block recipient
      await this.blockRecipient(complaintData.recipient, 'complaint');
      
      // Emit complaint event
      this.emit('emailComplaint', complaintData);
      
      logger.warn('Email complaint received', complaintData);
      
    } catch (error) {
      logger.error('Failed to handle email complaint', { error, complaintData });
    }
  }

  /**
   * Track email open
   */
  async trackOpen(trackingData: {
    notificationId: string;
    messageId: string;
    recipient: string;
    timestamp: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<void> {
    try {
      // Update metrics
      this.updateMetrics('opened');
      
      // Store open event
      await redisClient.hset(
        `email_opens:${trackingData.notificationId}`,
        Date.now().toString(),
        JSON.stringify(trackingData)
      );
      
      // Emit open event
      this.emit('emailOpened', trackingData);
      
      logger.debug('Email open tracked', {
        notificationId: trackingData.notificationId,
        recipient: trackingData.recipient
      });
      
    } catch (error) {
      logger.error('Failed to track email open', { error, trackingData });
    }
  }

  /**
   * Track email click
   */
  async trackClick(trackingData: {
    notificationId: string;
    messageId: string;
    recipient: string;
    link: string;
    timestamp: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<void> {
    try {
      // Update metrics
      this.updateMetrics('clicked');
      
      // Store click event
      await redisClient.hset(
        `email_clicks:${trackingData.notificationId}`,
        Date.now().toString(),
        JSON.stringify(trackingData)
      );
      
      // Emit click event
      this.emit('emailClicked', trackingData);
      
      logger.debug('Email click tracked', {
        notificationId: trackingData.notificationId,
        link: trackingData.link
      });
      
    } catch (error) {
      logger.error('Failed to track email click', { error, trackingData });
    }
  }

  /**
   * Unsubscribe recipient
   */
  async unsubscribe(unsubscribeData: {
    recipient: string;
    reason?: string;
    timestamp: Date;
    categories?: string[];
  }): Promise<void> {
    try {
      // Update metrics
      this.updateMetrics('unsubscribed');
      
      // Store unsubscribe
      await redisClient.hset(
        'email_unsubscribes',
        unsubscribeData.recipient,
        JSON.stringify(unsubscribeData)
      );
      
      // Block recipient
      await this.blockRecipient(unsubscribeData.recipient, 'unsubscribed');
      
      // Emit unsubscribe event
      this.emit('emailUnsubscribed', unsubscribeData);
      
      logger.info('Email unsubscribe processed', {
        recipient: unsubscribeData.recipient,
        reason: unsubscribeData.reason
      });
      
    } catch (error) {
      logger.error('Failed to process unsubscribe', { error, unsubscribeData });
    }
  }

  /**
   * Get channel metrics
   */
  async getMetrics(period?: { from: Date; to: Date }): Promise<EmailMetrics> {
    try {
      if (period) {
        // Load metrics for specific period
        return await this.loadMetricsForPeriod(period);
      }
      
      // Calculate rates
      if (this.metrics.sent > 0) {
        this.metrics.deliveryRate = this.metrics.delivered / this.metrics.sent;
        this.metrics.bounceRate = this.metrics.bounced / this.metrics.sent;
        this.metrics.openRate = this.metrics.opened / this.metrics.delivered;
        this.metrics.clickRate = this.metrics.clicked / this.metrics.opened;
      }
      
      return this.metrics;
      
    } catch (error) {
      logger.error('Failed to get email metrics', { error });
      throw error;
    }
  }

  /**
   * Validate email address
   */
  validateEmailAddress(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Check if recipient is blocked
   */
  async isRecipientBlocked(email: string): Promise<boolean> {
    try {
      // Check unsubscribes
      const unsubscribed = await redisClient.hexists('email_unsubscribes', email);
      if (unsubscribed) return true;
      
      // Check hard bounces
      const hardBounced = await redisClient.hexists('email_hard_bounces', email);
      if (hardBounced) return true;
      
      // Check complaints
      const complained = await redisClient.hexists('email_complaints', email);
      if (complained) return true;
      
      // Check blocklist
      const blocked = await redisClient.sismember('email_blocklist', email);
      
      return blocked === 1;
      
    } catch (error) {
      logger.error('Failed to check recipient block status', { error, email });
      return false;
    }
  }

  // Private helper methods

  private async createTransporter(): Promise<void> {
    if (!this.config) {
      throw new Error('Email configuration not provided');
    }
    
    switch (this.config.provider) {
      case 'smtp':
        if (!this.config.smtp) {
          throw new Error('SMTP configuration not provided');
        }
        
        this.transporter = nodemailer.createTransporter({
          host: this.config.smtp.host,
          port: this.config.smtp.port,
          secure: this.config.smtp.secure,
          auth: this.config.smtp.auth,
          tls: this.config.smtp.tls
        });
        break;
        
      case 'sendgrid':
        // Implement SendGrid transport
        throw new Error('SendGrid provider not yet implemented');
        
      case 'ses':
        // Implement AWS SES transport
        throw new Error('AWS SES provider not yet implemented');
        
      case 'mailgun':
        // Implement Mailgun transport
        throw new Error('Mailgun provider not yet implemented');
        
      default:
        throw new Error(`Unsupported email provider: ${this.config.provider}`);
    }
  }

  private async verifyConnection(): Promise<void> {
    if (!this.transporter) {
      throw new Error('Email transporter not initialized');
    }
    
    try {
      await this.transporter.verify();
      logger.info('Email transporter connection verified');
    } catch (error) {
      logger.error('Failed to verify email connection', { error });
      throw error;
    }
  }

  private async prepareEmailMessage(
    notification: NotificationData,
    options?: any
  ): Promise<EmailMessage> {
    // Get template if available
    let subject = notification.title || 'Notification';
    let text = notification.message;
    let html: string | undefined;
    
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
          { channel: 'email' }
        );
        
        subject = rendered.subject || subject;
        text = rendered.body;
        html = rendered.htmlBody;
        
      } catch (error) {
        logger.error('Failed to render email template', {
          error,
          templateId: notification.metadata.templateId
        });
      }
    }
    
    // Build email message
    const message: EmailMessage = {
      to: notification.metadata?.recipientEmail || notification.userId,
      subject,
      text,
      html: html || this.textToHtml(text),
      from: this.config?.defaults.from,
      replyTo: this.config?.defaults.replyTo,
      headers: {
        'X-Notification-ID': notification.notificationId,
        'X-Priority': this.mapPriority(notification.priority),
        ...this.config?.defaults.headers
      },
      priority: options?.priority || this.mapPriority(notification.priority)
    };
    
    // Add list headers if present
    if (notification.metadata?.listId) {
      message.list = {
        id: notification.metadata.listId,
        unsubscribe: notification.metadata.unsubscribeUrl
      };
    }
    
    return message;
  }

  private async sendEmail(message: EmailMessage): Promise<EmailDeliveryResult> {
    if (!this.transporter) {
      throw new Error('Email transporter not initialized');
    }
    
    try {
      const info = await this.transporter.sendMail(message as any);
      
      return {
        success: true,
        messageId: info.messageId,
        envelope: info.envelope,
        accepted: info.accepted,
        rejected: info.rejected,
        pending: info.pending,
        response: info.response,
        timestamp: new Date(),
        attempts: 1
      };
      
    } catch (error) {
      throw error;
    }
  }

  private async checkRateLimit(userId: string): Promise<void> {
    if (!this.config?.rateLimit) return;
    
    const now = Date.now();
    const key = `email_rate:${userId}`;
    
    // Check per-second limit
    if (this.config.rateLimit.maxPerSecond) {
      const secondKey = `${key}:${Math.floor(now / 1000)}`;
      const count = this.rateLimiter.get(secondKey) || 0;
      
      if (count >= this.config.rateLimit.maxPerSecond) {
        throw new Error('Email rate limit exceeded (per second)');
      }
      
      this.rateLimiter.set(secondKey, count + 1);
      setTimeout(() => this.rateLimiter.delete(secondKey), 1000);
    }
    
    // Check per-minute and per-hour limits using Redis
    // Implementation would use Redis for distributed rate limiting
  }

  private addTracking(message: EmailMessage, notificationId: string): void {
    if (!this.config?.tracking) return;
    
    // Add open tracking pixel
    if (this.config.tracking.opens && message.html) {
      const pixelUrl = `${process.env.API_URL}/api/email/track/open/${notificationId}`;
      const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none;" />`;
      message.html = message.html.replace('</body>', `${pixel}</body>`);
    }
    
    // Add click tracking
    if (this.config.tracking.clicks && message.html) {
      // Replace links with tracking URLs
      message.html = message.html.replace(
        /href="(https?:\/\/[^"]+)"/g,
        (match, url) => {
          const trackUrl = `${process.env.API_URL}/api/email/track/click/${notificationId}?url=${encodeURIComponent(url)}`;
          return `href="${trackUrl}"`;
        }
      );
    }
    
    // Add unsubscribe link
    if (this.config.tracking.unsubscribes && message.html) {
      const unsubUrl = `${process.env.API_URL}/api/email/unsubscribe/${notificationId}`;
      const unsubLink = `<a href="${unsubUrl}">Unsubscribe</a>`;
      message.html = message.html.replace('</body>', `<p>${unsubLink}</p></body>`);
    }
  }

  private textToHtml(text: string): string {
    // Simple text to HTML conversion
    return text
      .split('\n')
      .map(line => `<p>${line}</p>`)
      .join('');
  }

  private mapPriority(priority: NotificationPriority): 'high' | 'normal' | 'low' {
    switch (priority) {
      case 'critical':
      case 'high':
        return 'high';
      case 'low':
        return 'low';
      default:
        return 'normal';
    }
  }

  private isPermanentError(error: any): boolean {
    // Check for permanent error codes
    const permanentCodes = [
      '550', // Mailbox unavailable
      '551', // User not local
      '552', // Exceeded storage allocation
      '553', // Mailbox name not allowed
      '554'  // Transaction failed
    ];
    
    if (error && 'code' in error) {
      return permanentCodes.some(code => error.code.startsWith(code));
    }
    
    return false;
  }

  private async handleHardBounce(recipient: string): Promise<void> {
    // Add to hard bounce list
    await redisClient.hset(
      'email_hard_bounces',
      recipient,
      JSON.stringify({
        timestamp: new Date(),
        permanent: true
      })
    );
    
    // Block recipient
    await this.blockRecipient(recipient, 'hard_bounce');
  }

  private async blockRecipient(recipient: string, reason: string): Promise<void> {
    await redisClient.sadd('email_blocklist', recipient);
    
    await redisClient.hset(
      'email_block_reasons',
      recipient,
      JSON.stringify({
        reason,
        timestamp: new Date()
      })
    );
    
    logger.info('Email recipient blocked', { recipient, reason });
  }

  private async setupBounceHandling(): Promise<void> {
    // Setup webhook endpoint for bounce notifications
    // This would integrate with the email provider's bounce handling
    logger.info('Email bounce handling setup');
  }

  private async setupTracking(): Promise<void> {
    // Setup tracking endpoints and pixel serving
    logger.info('Email tracking setup');
  }

  private updateMetrics(event: keyof EmailMetrics, deliveryTime?: number): void {
    if (event === 'sent' || event === 'delivered' || event === 'bounced' || 
        event === 'complained' || event === 'opened' || event === 'clicked' || 
        event === 'unsubscribed' || event === 'failed') {
      this.metrics[event]++;
    }
    
    // Update average delivery time
    if (deliveryTime && event === 'sent') {
      const totalTime = this.metrics.avgDeliveryTime * (this.metrics.sent - 1);
      this.metrics.avgDeliveryTime = (totalTime + deliveryTime) / this.metrics.sent;
    }
    
    // Persist metrics periodically
    this.persistMetrics();
  }

  private async persistMetrics(): Promise<void> {
    await redisClient.hset(
      'email_metrics',
      'current',
      JSON.stringify(this.metrics)
    );
  }

  private async loadMetrics(): Promise<void> {
    const data = await redisClient.hget('email_metrics', 'current');
    if (data) {
      this.metrics = JSON.parse(data);
    }
  }

  private async loadMetricsForPeriod(period: { from: Date; to: Date }): Promise<EmailMetrics> {
    // Implementation would load metrics for specific period from storage
    return this.metrics;
  }

  private async storeDeliveryInfo(notificationId: string, result: EmailDeliveryResult): Promise<void> {
    await redisClient.hset(
      `email_delivery:${notificationId}`,
      'result',
      JSON.stringify(result)
    );
    
    // Set expiry for 30 days
    await redisClient.expire(`email_delivery:${notificationId}`, 30 * 24 * 60 * 60);
  }

  // Public cleanup method
  async cleanup(): Promise<void> {
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
    }
    
    this.isInitialized = false;
  }
}

// Export singleton instance
export const emailNotificationChannel = new EmailNotificationChannel();
export default emailNotificationChannel;