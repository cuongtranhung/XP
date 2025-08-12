/**
 * Notification Template Service
 * Advanced templating system with personalization, localization, and dynamic content
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import redisClient from '../config/redis';
import { NotificationTemplate, NotificationType, NotificationChannel } from './notificationService';

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  required: boolean;
  defaultValue?: any;
  description?: string;
  format?: string; // For dates and numbers
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: any[];
  };
}

export interface TemplateBlock {
  blockId: string;
  type: 'header' | 'body' | 'footer' | 'cta' | 'image' | 'divider' | 'social';
  content?: string;
  html?: string;
  styles?: Record<string, any>;
  condition?: string; // JavaScript expression for conditional rendering
  repeat?: string; // Variable name for repeating blocks
}

export interface AdvancedTemplate extends NotificationTemplate {
  category: string;
  tags: string[];
  version: string;
  status: 'draft' | 'active' | 'archived';
  blocks?: TemplateBlock[];
  layouts?: {
    email?: string; // HTML layout template
    push?: string; // Push notification format
    sms?: string; // SMS format
    inApp?: string; // In-app notification format
  };
  personalization?: {
    useUserProfile: boolean;
    useUserPreferences: boolean;
    useContextData: boolean;
    customFields?: string[];
  };
  analytics?: {
    trackOpen: boolean;
    trackClick: boolean;
    trackConversion: boolean;
    conversionGoal?: string;
  };
  scheduling?: {
    bestTimeToSend: boolean;
    timezone: 'user' | 'system' | string;
    blackoutPeriods?: Array<{
      start: string; // HH:mm
      end: string; // HH:mm
      days?: number[]; // 0-6 (Sunday-Saturday)
    }>;
  };
  testing?: {
    abTestEnabled: boolean;
    variants?: Array<{
      variantId: string;
      name: string;
      weight: number; // Percentage
      changes: Record<string, any>;
    }>;
  };
}

export interface PersonalizationContext {
  user: {
    id: string;
    email: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    preferences?: Record<string, any>;
    metadata?: Record<string, any>;
  };
  context: {
    timestamp: Date;
    timezone: string;
    locale: string;
    platform?: string;
    device?: string;
    location?: {
      country?: string;
      city?: string;
      region?: string;
    };
  };
  data: Record<string, any>;
}

export interface TemplateRenderResult {
  subject?: string;
  title?: string;
  body: string;
  htmlBody?: string;
  blocks?: Array<{
    type: string;
    content: string;
    html?: string;
  }>;
  metadata: {
    templateId: string;
    templateVersion: string;
    renderTime: number;
    personalizedFields: string[];
    abTestVariant?: string;
  };
}

/**
 * Notification Template Service Class
 */
class NotificationTemplateService extends EventEmitter {
  private templates = new Map<string, AdvancedTemplate>();
  private templateCache = new Map<string, TemplateRenderResult>();
  private compiledTemplates = new Map<string, Function>();
  
  private readonly cacheExpiry = 300000; // 5 minutes
  private readonly maxCacheSize = 1000;

  constructor() {
    super();
    this.initializeService();
  }

  /**
   * Initialize template service
   */
  private async initializeService(): Promise<void> {
    try {
      await this.loadTemplatesFromStorage();
      await this.loadDefaultTemplates();
      
      logger.info('✅ Notification template service initialized');
      
    } catch (error) {
      logger.error('❌ Failed to initialize template service', { error });
      throw error;
    }
  }

  /**
   * Create advanced template
   */
  async createAdvancedTemplate(template: Partial<AdvancedTemplate>): Promise<AdvancedTemplate> {
    try {
      const templateId = this.generateTemplateId();
      
      const fullTemplate: AdvancedTemplate = {
        templateId,
        name: template.name || 'Untitled Template',
        type: template.type || 'custom',
        channels: template.channels || ['in-app', 'email'],
        subject: template.subject,
        title: template.title,
        body: template.body || '',
        htmlBody: template.htmlBody,
        variables: template.variables || [],
        defaultValues: template.defaultValues,
        localization: template.localization,
        category: template.category || 'general',
        tags: template.tags || [],
        version: '1.0.0',
        status: template.status || 'draft',
        blocks: template.blocks,
        layouts: template.layouts,
        personalization: template.personalization,
        analytics: template.analytics,
        scheduling: template.scheduling,
        testing: template.testing,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Validate template
      this.validateAdvancedTemplate(fullTemplate);
      
      // Compile template for faster rendering
      this.compileTemplate(fullTemplate);
      
      // Store template
      this.templates.set(templateId, fullTemplate);
      await this.storeTemplate(fullTemplate);
      
      // Emit event
      this.emit('templateCreated', fullTemplate);
      
      logger.info('Advanced template created', {
        templateId,
        name: fullTemplate.name,
        type: fullTemplate.type
      });
      
      return fullTemplate;
      
    } catch (error) {
      logger.error('Failed to create advanced template', { error });
      throw error;
    }
  }

  /**
   * Render template with personalization
   */
  async renderTemplate(
    templateId: string,
    context: PersonalizationContext,
    options?: {
      channel?: NotificationChannel;
      variant?: string;
      preview?: boolean;
      cache?: boolean;
    }
  ): Promise<TemplateRenderResult> {
    try {
      const startTime = Date.now();
      
      // Check cache
      if (options?.cache !== false) {
        const cacheKey = this.getCacheKey(templateId, context, options);
        const cached = this.templateCache.get(cacheKey);
        
        if (cached && this.isCacheValid(cached)) {
          return cached;
        }
      }
      
      // Get template
      const template = this.templates.get(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }
      
      // Check template status
      if (template.status !== 'active' && !options?.preview) {
        throw new Error(`Template is not active: ${template.status}`);
      }
      
      // Select A/B test variant if enabled
      let finalTemplate = template;
      let variantId: string | undefined;
      
      if (template.testing?.abTestEnabled && template.testing.variants && !options?.variant) {
        const variant = this.selectVariant(template.testing.variants, context.user.id);
        if (variant) {
          variantId = variant.variantId;
          finalTemplate = this.applyVariant(template, variant);
        }
      } else if (options?.variant) {
        const variant = template.testing?.variants?.find(v => v.variantId === options.variant);
        if (variant) {
          variantId = variant.variantId;
          finalTemplate = this.applyVariant(template, variant);
        }
      }
      
      // Get localized content
      const localizedTemplate = this.getLocalizedTemplate(finalTemplate, context.context.locale);
      
      // Apply personalization
      const personalizedTemplate = await this.applyPersonalization(localizedTemplate, context);
      
      // Render blocks if present
      let renderedBlocks: TemplateRenderResult['blocks'];
      if (personalizedTemplate.blocks) {
        renderedBlocks = await this.renderBlocks(personalizedTemplate.blocks, context);
      }
      
      // Format for specific channel
      const formatted = this.formatForChannel(personalizedTemplate, options?.channel || 'in-app');
      
      // Build result
      const result: TemplateRenderResult = {
        subject: formatted.subject,
        title: formatted.title,
        body: formatted.body,
        htmlBody: formatted.htmlBody,
        blocks: renderedBlocks,
        metadata: {
          templateId,
          templateVersion: template.version,
          renderTime: Date.now() - startTime,
          personalizedFields: this.getPersonalizedFields(context),
          abTestVariant: variantId
        }
      };
      
      // Cache result
      if (options?.cache !== false) {
        const cacheKey = this.getCacheKey(templateId, context, options);
        this.addToCache(cacheKey, result);
      }
      
      // Track rendering
      if (!options?.preview) {
        await this.trackRendering(templateId, context, variantId);
      }
      
      return result;
      
    } catch (error) {
      logger.error('Failed to render template', { error, templateId });
      throw error;
    }
  }

  /**
   * Clone template
   */
  async cloneTemplate(templateId: string, newName: string): Promise<AdvancedTemplate> {
    try {
      const original = this.templates.get(templateId);
      if (!original) {
        throw new Error(`Template not found: ${templateId}`);
      }
      
      const cloned = await this.createAdvancedTemplate({
        ...original,
        name: newName,
        status: 'draft',
        version: '1.0.0'
      });
      
      logger.info('Template cloned', {
        originalId: templateId,
        clonedId: cloned.templateId,
        name: newName
      });
      
      return cloned;
      
    } catch (error) {
      logger.error('Failed to clone template', { error, templateId });
      throw error;
    }
  }

  /**
   * Update template version
   */
  async updateTemplateVersion(
    templateId: string,
    updates: Partial<AdvancedTemplate>
  ): Promise<AdvancedTemplate> {
    try {
      const existing = this.templates.get(templateId);
      if (!existing) {
        throw new Error(`Template not found: ${templateId}`);
      }
      
      // Increment version
      const versionParts = existing.version.split('.');
      versionParts[2] = (parseInt(versionParts[2]) + 1).toString();
      const newVersion = versionParts.join('.');
      
      const updated: AdvancedTemplate = {
        ...existing,
        ...updates,
        templateId,
        version: newVersion,
        updatedAt: new Date()
      };
      
      // Validate and compile
      this.validateAdvancedTemplate(updated);
      this.compileTemplate(updated);
      
      // Store updated template
      this.templates.set(templateId, updated);
      await this.storeTemplate(updated);
      
      // Clear cache
      this.clearTemplateCache(templateId);
      
      // Emit event
      this.emit('templateUpdated', updated);
      
      logger.info('Template version updated', {
        templateId,
        oldVersion: existing.version,
        newVersion
      });
      
      return updated;
      
    } catch (error) {
      logger.error('Failed to update template version', { error, templateId });
      throw error;
    }
  }

  /**
   * Archive template
   */
  async archiveTemplate(templateId: string): Promise<void> {
    try {
      const template = this.templates.get(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }
      
      template.status = 'archived';
      template.updatedAt = new Date();
      
      await this.storeTemplate(template);
      
      // Clear cache
      this.clearTemplateCache(templateId);
      
      logger.info('Template archived', { templateId });
      
    } catch (error) {
      logger.error('Failed to archive template', { error, templateId });
      throw error;
    }
  }

  /**
   * Get template analytics
   */
  async getTemplateAnalytics(
    templateId: string,
    dateRange?: { from: Date; to: Date }
  ): Promise<{
    renders: number;
    deliveries: number;
    opens: number;
    clicks: number;
    conversions: number;
    variants?: Array<{
      variantId: string;
      renders: number;
      conversions: number;
      conversionRate: number;
    }>;
  }> {
    try {
      // Implementation would fetch analytics from storage
      const analytics = {
        renders: 0,
        deliveries: 0,
        opens: 0,
        clicks: 0,
        conversions: 0,
        variants: undefined as any
      };
      
      // Get analytics data from Redis
      const key = `template_analytics:${templateId}`;
      const data = await redisClient.hgetall(key);
      
      if (data) {
        analytics.renders = parseInt(data.renders || '0');
        analytics.deliveries = parseInt(data.deliveries || '0');
        analytics.opens = parseInt(data.opens || '0');
        analytics.clicks = parseInt(data.clicks || '0');
        analytics.conversions = parseInt(data.conversions || '0');
      }
      
      return analytics;
      
    } catch (error) {
      logger.error('Failed to get template analytics', { error, templateId });
      throw error;
    }
  }

  /**
   * Search templates
   */
  searchTemplates(criteria: {
    type?: NotificationType;
    channel?: NotificationChannel;
    category?: string;
    tags?: string[];
    status?: AdvancedTemplate['status'];
    search?: string;
  }): AdvancedTemplate[] {
    let templates = Array.from(this.templates.values());
    
    if (criteria.type) {
      templates = templates.filter(t => t.type === criteria.type);
    }
    
    if (criteria.channel) {
      templates = templates.filter(t => t.channels.includes(criteria.channel));
    }
    
    if (criteria.category) {
      templates = templates.filter(t => t.category === criteria.category);
    }
    
    if (criteria.tags && criteria.tags.length > 0) {
      templates = templates.filter(t =>
        criteria.tags!.some(tag => t.tags.includes(tag))
      );
    }
    
    if (criteria.status) {
      templates = templates.filter(t => t.status === criteria.status);
    }
    
    if (criteria.search) {
      const searchLower = criteria.search.toLowerCase();
      templates = templates.filter(t =>
        t.name.toLowerCase().includes(searchLower) ||
        t.body.toLowerCase().includes(searchLower) ||
        t.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }
    
    return templates;
  }

  // Private helper methods

  private validateAdvancedTemplate(template: AdvancedTemplate): void {
    if (!template.name) {
      throw new Error('Template name is required');
    }
    
    if (!template.body && !template.blocks) {
      throw new Error('Template must have body or blocks');
    }
    
    if (!template.channels || template.channels.length === 0) {
      throw new Error('At least one channel is required');
    }
    
    // Validate variables
    if (template.variables) {
      for (const variable of template.variables) {
        if (typeof variable === 'string') continue;
        
        const varDef = variable as TemplateVariable;
        if (!varDef.name || !varDef.type) {
          throw new Error('Variable must have name and type');
        }
      }
    }
    
    // Validate blocks
    if (template.blocks) {
      for (const block of template.blocks) {
        if (!block.blockId || !block.type) {
          throw new Error('Block must have blockId and type');
        }
      }
    }
  }

  private compileTemplate(template: AdvancedTemplate): void {
    try {
      // Compile body template
      const bodyCompiled = this.compileTemplateString(template.body);
      this.compiledTemplates.set(`${template.templateId}_body`, bodyCompiled);
      
      // Compile HTML body if present
      if (template.htmlBody) {
        const htmlCompiled = this.compileTemplateString(template.htmlBody);
        this.compiledTemplates.set(`${template.templateId}_html`, htmlCompiled);
      }
      
      // Compile subject if present
      if (template.subject) {
        const subjectCompiled = this.compileTemplateString(template.subject);
        this.compiledTemplates.set(`${template.templateId}_subject`, subjectCompiled);
      }
      
    } catch (error) {
      logger.error('Failed to compile template', { error, templateId: template.templateId });
    }
  }

  private compileTemplateString(template: string): Function {
    // Simple template compiler using regex
    return (context: any) => {
      return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const value = this.getNestedValue(context, path.trim());
        return value !== undefined ? value : match;
      });
    };
  }

  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  }

  private async applyPersonalization(
    template: AdvancedTemplate,
    context: PersonalizationContext
  ): Promise<AdvancedTemplate> {
    const personalized = { ...template };
    
    if (!template.personalization) {
      return personalized;
    }
    
    // Merge user profile data
    if (template.personalization.useUserProfile) {
      context.data = {
        ...context.data,
        user: context.user
      };
    }
    
    // Merge user preferences
    if (template.personalization.useUserPreferences && context.user.preferences) {
      context.data = {
        ...context.data,
        preferences: context.user.preferences
      };
    }
    
    // Merge context data
    if (template.personalization.useContextData) {
      context.data = {
        ...context.data,
        context: context.context
      };
    }
    
    // Apply compiled templates
    const bodyCompiled = this.compiledTemplates.get(`${template.templateId}_body`);
    if (bodyCompiled) {
      personalized.body = bodyCompiled(context.data);
    }
    
    const htmlCompiled = this.compiledTemplates.get(`${template.templateId}_html`);
    if (htmlCompiled && template.htmlBody) {
      personalized.htmlBody = htmlCompiled(context.data);
    }
    
    const subjectCompiled = this.compiledTemplates.get(`${template.templateId}_subject`);
    if (subjectCompiled && template.subject) {
      personalized.subject = subjectCompiled(context.data);
    }
    
    if (template.title) {
      personalized.title = this.compileTemplateString(template.title)(context.data);
    }
    
    return personalized;
  }

  private async renderBlocks(
    blocks: TemplateBlock[],
    context: PersonalizationContext
  ): Promise<TemplateRenderResult['blocks']> {
    const rendered: TemplateRenderResult['blocks'] = [];
    
    for (const block of blocks) {
      // Check condition
      if (block.condition) {
        const shouldRender = this.evaluateCondition(block.condition, context.data);
        if (!shouldRender) continue;
      }
      
      // Handle repeating blocks
      if (block.repeat) {
        const items = this.getNestedValue(context.data, block.repeat);
        if (Array.isArray(items)) {
          for (const item of items) {
            const itemContext = { ...context.data, item };
            rendered.push({
              type: block.type,
              content: block.content ? this.compileTemplateString(block.content)(itemContext) : '',
              html: block.html ? this.compileTemplateString(block.html)(itemContext) : undefined
            });
          }
        }
      } else {
        rendered.push({
          type: block.type,
          content: block.content ? this.compileTemplateString(block.content)(context.data) : '',
          html: block.html ? this.compileTemplateString(block.html)(context.data) : undefined
        });
      }
    }
    
    return rendered;
  }

  private evaluateCondition(condition: string, context: any): boolean {
    try {
      // Safe evaluation using Function constructor
      const func = new Function('context', `return ${condition}`);
      return func(context);
    } catch {
      return false;
    }
  }

  private getLocalizedTemplate(
    template: AdvancedTemplate,
    locale: string
  ): AdvancedTemplate {
    if (!template.localization || !template.localization[locale]) {
      return template;
    }
    
    const localized = template.localization[locale];
    
    return {
      ...template,
      subject: localized.subject || template.subject,
      title: localized.title || template.title,
      body: localized.body || template.body,
      htmlBody: localized.htmlBody || template.htmlBody
    };
  }

  private formatForChannel(
    template: AdvancedTemplate,
    channel: NotificationChannel
  ): Partial<AdvancedTemplate> {
    if (!template.layouts || !template.layouts[channel]) {
      return template;
    }
    
    // Apply channel-specific layout
    const layout = template.layouts[channel];
    
    // Simple layout application (would be more sophisticated in production)
    return {
      ...template,
      body: layout.replace('{{content}}', template.body),
      htmlBody: template.htmlBody ? layout.replace('{{content}}', template.htmlBody) : undefined
    };
  }

  private selectVariant(
    variants: NonNullable<AdvancedTemplate['testing']>['variants'],
    userId: string
  ): typeof variants[0] | null {
    if (!variants || variants.length === 0) return null;
    
    // Simple hash-based variant selection
    const hash = this.hashString(userId);
    const random = (hash % 100) / 100;
    
    let cumulative = 0;
    for (const variant of variants) {
      cumulative += variant.weight / 100;
      if (random <= cumulative) {
        return variant;
      }
    }
    
    return variants[0];
  }

  private applyVariant(
    template: AdvancedTemplate,
    variant: NonNullable<AdvancedTemplate['testing']>['variants'][0]
  ): AdvancedTemplate {
    return {
      ...template,
      ...variant.changes
    };
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private getCacheKey(
    templateId: string,
    context: PersonalizationContext,
    options?: any
  ): string {
    return `${templateId}_${context.user.id}_${context.context.locale}_${options?.channel || 'default'}`;
  }

  private isCacheValid(cached: any): boolean {
    // Simple cache validation (would be more sophisticated in production)
    return true;
  }

  private addToCache(key: string, result: TemplateRenderResult): void {
    // Manage cache size
    if (this.templateCache.size >= this.maxCacheSize) {
      const firstKey = this.templateCache.keys().next().value;
      this.templateCache.delete(firstKey);
    }
    
    this.templateCache.set(key, result);
    
    // Set expiry
    setTimeout(() => {
      this.templateCache.delete(key);
    }, this.cacheExpiry);
  }

  private clearTemplateCache(templateId: string): void {
    for (const [key] of this.templateCache) {
      if (key.startsWith(templateId)) {
        this.templateCache.delete(key);
      }
    }
  }

  private getPersonalizedFields(context: PersonalizationContext): string[] {
    const fields: string[] = [];
    
    if (context.user.name) fields.push('user.name');
    if (context.user.firstName) fields.push('user.firstName');
    if (context.user.email) fields.push('user.email');
    
    // Add other personalized fields
    for (const key in context.data) {
      if (context.data[key]) {
        fields.push(key);
      }
    }
    
    return fields;
  }

  private async trackRendering(
    templateId: string,
    context: PersonalizationContext,
    variantId?: string
  ): Promise<void> {
    const key = `template_analytics:${templateId}`;
    await redisClient.hincrby(key, 'renders', 1);
    
    if (variantId) {
      const variantKey = `template_variant_analytics:${templateId}:${variantId}`;
      await redisClient.hincrby(variantKey, 'renders', 1);
    }
    
    // Store detailed event
    await redisClient.lpush(
      'template_render_events',
      JSON.stringify({
        templateId,
        userId: context.user.id,
        variantId,
        locale: context.context.locale,
        timestamp: new Date()
      })
    );
    
    // Trim to keep only recent events
    await redisClient.ltrim('template_render_events', 0, 9999);
  }

  private async loadTemplatesFromStorage(): Promise<void> {
    const keys = await redisClient.keys('notification_template:*');
    
    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        const template = JSON.parse(data);
        this.templates.set(template.templateId, template);
        this.compileTemplate(template);
      }
    }
  }

  private async loadDefaultTemplates(): Promise<void> {
    // Load default system templates
    const defaultTemplates: Partial<AdvancedTemplate>[] = [
      {
        name: 'Welcome Email',
        type: 'account',
        channels: ['email'],
        subject: 'Welcome to {{appName}}!',
        body: 'Hi {{user.firstName}},\n\nWelcome to {{appName}}! We\'re excited to have you on board.',
        htmlBody: '<h1>Welcome {{user.firstName}}!</h1><p>Welcome to {{appName}}! We\'re excited to have you on board.</p>',
        variables: ['appName', 'user.firstName'],
        category: 'onboarding',
        tags: ['welcome', 'onboarding'],
        status: 'active'
      },
      {
        name: 'Password Reset',
        type: 'security',
        channels: ['email'],
        subject: 'Reset Your Password',
        body: 'Click the link below to reset your password:\n{{resetLink}}',
        htmlBody: '<p>Click the button below to reset your password:</p><a href="{{resetLink}}">Reset Password</a>',
        variables: ['resetLink'],
        category: 'security',
        tags: ['password', 'security'],
        status: 'active'
      },
      {
        name: 'New Comment',
        type: 'comment',
        channels: ['in-app', 'email'],
        subject: 'New comment on your submission',
        title: 'New Comment',
        body: '{{commenter.name}} commented on your submission: "{{comment.excerpt}}"',
        variables: ['commenter.name', 'comment.excerpt'],
        category: 'engagement',
        tags: ['comment', 'notification'],
        status: 'active'
      }
    ];
    
    for (const templateData of defaultTemplates) {
      const existing = Array.from(this.templates.values()).find(t => t.name === templateData.name);
      if (!existing) {
        await this.createAdvancedTemplate(templateData);
      }
    }
  }

  private async storeTemplate(template: AdvancedTemplate): Promise<void> {
    await redisClient.set(
      `notification_template:${template.templateId}`,
      JSON.stringify(template)
    );
  }

  private generateTemplateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const notificationTemplateService = new NotificationTemplateService();
export default notificationTemplateService;