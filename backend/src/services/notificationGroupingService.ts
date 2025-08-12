/**
 * Notification Grouping Service
 * Smart aggregation and batching of similar notifications
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import redisClient from '../config/redis';
import { 
  NotificationData,
  NotificationType,
  NotificationPriority 
} from './notificationService';

export interface GroupingRule {
  ruleId: string;
  name: string;
  type: NotificationType | 'all';
  conditions: {
    field: string;
    operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'regex';
    value: any;
  }[];
  groupBy: string[]; // Fields to group by
  aggregation: {
    strategy: 'count' | 'list' | 'summary' | 'digest';
    maxItems?: number;
    timeWindow?: number; // milliseconds
    template?: string;
  };
  priority: number; // Rule priority (higher = higher priority)
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationGroup {
  groupId: string;
  userId: string;
  type: NotificationType;
  key: string; // Grouping key
  notifications: NotificationData[];
  count: number;
  firstNotificationAt: Date;
  lastNotificationAt: Date;
  summary?: string;
  priority: NotificationPriority;
  status: 'collecting' | 'ready' | 'sent' | 'cancelled';
  scheduledFor?: Date;
  metadata: {
    ruleId?: string;
    aggregationType?: string;
    customData?: Record<string, any>;
  };
}

export interface BatchConfig {
  batchId: string;
  name: string;
  criteria: {
    userGroups?: string[];
    userTags?: string[];
    notificationTypes?: NotificationType[];
    channels?: string[];
  };
  schedule?: {
    sendAt?: Date;
    timezone?: string;
    recurring?: {
      pattern: 'daily' | 'weekly' | 'monthly';
      time: string; // HH:mm
      daysOfWeek?: number[]; // 0-6
      dayOfMonth?: number;
    };
  };
  limits: {
    maxNotifications?: number;
    maxUsers?: number;
    timeWindow?: number; // milliseconds
  };
  priority: NotificationPriority;
  enabled: boolean;
}

export interface GroupingMetrics {
  totalGroups: number;
  activeGroups: number;
  notificationsGrouped: number;
  notificationsSent: number;
  averageGroupSize: number;
  groupingEfficiency: number; // Reduction ratio
  byType: Record<NotificationType, {
    groups: number;
    notifications: number;
    averageSize: number;
  }>;
  byStrategy: Record<string, {
    groups: number;
    notifications: number;
  }>;
}

/**
 * Notification Grouping Service Class
 */
class NotificationGroupingService extends EventEmitter {
  private groupingRules = new Map<string, GroupingRule>();
  private activeGroups = new Map<string, NotificationGroup>();
  private batchConfigs = new Map<string, BatchConfig>();
  private groupingTimers = new Map<string, NodeJS.Timeout>();
  
  private metrics: GroupingMetrics = {
    totalGroups: 0,
    activeGroups: 0,
    notificationsGrouped: 0,
    notificationsSent: 0,
    averageGroupSize: 0,
    groupingEfficiency: 0,
    byType: {} as any,
    byStrategy: {}
  };
  
  private readonly defaultTimeWindow = 60000; // 1 minute
  private readonly maxGroupSize = 100;

  constructor() {
    super();
    this.initializeService();
  }

  /**
   * Initialize grouping service
   */
  private async initializeService(): Promise<void> {
    try {
      // Load grouping rules
      await this.loadGroupingRules();
      
      // Load batch configurations
      await this.loadBatchConfigs();
      
      // Load active groups
      await this.loadActiveGroups();
      
      // Start group processors
      this.startGroupProcessors();
      
      // Load metrics
      await this.loadMetrics();
      
      logger.info('✅ Notification grouping service initialized');
      
    } catch (error) {
      logger.error('❌ Failed to initialize grouping service', { error });
      throw error;
    }
  }

  /**
   * Create grouping rule
   */
  async createGroupingRule(rule: Partial<GroupingRule>): Promise<GroupingRule> {
    try {
      const ruleId = this.generateRuleId();
      
      const fullRule: GroupingRule = {
        ruleId,
        name: rule.name || 'Unnamed Rule',
        type: rule.type || 'all',
        conditions: rule.conditions || [],
        groupBy: rule.groupBy || [],
        aggregation: rule.aggregation || { strategy: 'count' },
        priority: rule.priority || 0,
        enabled: rule.enabled !== false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Validate rule
      this.validateGroupingRule(fullRule);
      
      // Store rule
      this.groupingRules.set(ruleId, fullRule);
      await this.storeGroupingRule(fullRule);
      
      logger.info('Grouping rule created', {
        ruleId,
        name: fullRule.name,
        type: fullRule.type
      });
      
      return fullRule;
      
    } catch (error) {
      logger.error('Failed to create grouping rule', { error });
      throw error;
    }
  }

  /**
   * Process notification for grouping
   */
  async processNotification(notification: NotificationData): Promise<{
    grouped: boolean;
    groupId?: string;
    immediate?: boolean;
  }> {
    try {
      // Find applicable grouping rules
      const applicableRules = this.findApplicableRules(notification);
      
      if (applicableRules.length === 0) {
        return { grouped: false, immediate: true };
      }
      
      // Sort by priority
      applicableRules.sort((a, b) => b.priority - a.priority);
      
      // Apply first matching rule
      const rule = applicableRules[0];
      
      // Generate group key
      const groupKey = this.generateGroupKey(notification, rule);
      const groupId = `${notification.userId}_${rule.ruleId}_${groupKey}`;
      
      // Get or create group
      let group = this.activeGroups.get(groupId);
      
      if (!group) {
        group = await this.createGroup(groupId, notification, rule);
      }
      
      // Add notification to group
      group.notifications.push(notification);
      group.count++;
      group.lastNotificationAt = new Date();
      
      // Update priority if higher
      if (this.comparePriority(notification.priority, group.priority) > 0) {
        group.priority = notification.priority;
      }
      
      // Check if group should be sent immediately
      const shouldSendImmediately = this.shouldSendGroupImmediately(group, rule);
      
      if (shouldSendImmediately) {
        await this.sendGroup(group);
        return { grouped: true, groupId, immediate: true };
      }
      
      // Update group
      this.activeGroups.set(groupId, group);
      await this.storeGroup(group);
      
      // Set or reset timer for time-based sending
      this.setGroupTimer(group, rule);
      
      // Update metrics
      this.updateMetrics('grouped', notification.type);
      
      logger.debug('Notification grouped', {
        notificationId: notification.notificationId,
        groupId,
        groupSize: group.count
      });
      
      return { grouped: true, groupId, immediate: false };
      
    } catch (error) {
      logger.error('Failed to process notification for grouping', { error });
      return { grouped: false, immediate: true };
    }
  }

  /**
   * Create batch notification
   */
  async createBatch(config: Partial<BatchConfig>): Promise<BatchConfig> {
    try {
      const batchId = this.generateBatchId();
      
      const fullConfig: BatchConfig = {
        batchId,
        name: config.name || 'Unnamed Batch',
        criteria: config.criteria || {},
        schedule: config.schedule,
        limits: config.limits || {},
        priority: config.priority || 'medium',
        enabled: config.enabled !== false
      };
      
      // Validate batch config
      this.validateBatchConfig(fullConfig);
      
      // Store config
      this.batchConfigs.set(batchId, fullConfig);
      await this.storeBatchConfig(fullConfig);
      
      // Schedule if needed
      if (fullConfig.schedule) {
        await this.scheduleBatch(fullConfig);
      }
      
      logger.info('Batch created', {
        batchId,
        name: fullConfig.name
      });
      
      return fullConfig;
      
    } catch (error) {
      logger.error('Failed to create batch', { error });
      throw error;
    }
  }

  /**
   * Process batch notifications
   */
  async processBatch(
    batchId: string,
    notifications: NotificationData[]
  ): Promise<{
    processed: number;
    grouped: number;
    sent: number;
    failed: number;
  }> {
    try {
      const batch = this.batchConfigs.get(batchId);
      
      if (!batch) {
        throw new Error(`Batch not found: ${batchId}`);
      }
      
      if (!batch.enabled) {
        logger.info('Batch is disabled', { batchId });
        return { processed: 0, grouped: 0, sent: 0, failed: 0 };
      }
      
      let processed = 0;
      let grouped = 0;
      let sent = 0;
      let failed = 0;
      
      // Apply batch criteria
      const filteredNotifications = this.applyBatchCriteria(notifications, batch);
      
      // Apply limits
      const limitedNotifications = filteredNotifications.slice(0, batch.limits.maxNotifications);
      
      // Group notifications by user
      const notificationsByUser = new Map<string, NotificationData[]>();
      
      for (const notification of limitedNotifications) {
        const userId = notification.userId;
        
        if (!notificationsByUser.has(userId)) {
          notificationsByUser.set(userId, []);
        }
        
        notificationsByUser.get(userId)!.push(notification);
        processed++;
      }
      
      // Process each user's notifications
      for (const [userId, userNotifications] of notificationsByUser) {
        try {
          // Check if should group
          if (userNotifications.length > 1) {
            const groupResult = await this.createBatchGroup(userId, userNotifications, batch);
            
            if (groupResult.success) {
              grouped += userNotifications.length;
              sent++;
            } else {
              failed += userNotifications.length;
            }
          } else {
            // Send individual notification
            sent++;
          }
          
        } catch (error) {
          logger.error('Failed to process user batch', { error, userId });
          failed += userNotifications.length;
        }
      }
      
      logger.info('Batch processed', {
        batchId,
        processed,
        grouped,
        sent,
        failed
      });
      
      return { processed, grouped, sent, failed };
      
    } catch (error) {
      logger.error('Failed to process batch', { error, batchId });
      throw error;
    }
  }

  /**
   * Get active groups
   */
  async getActiveGroups(
    userId?: string,
    options?: {
      type?: NotificationType;
      status?: NotificationGroup['status'];
      limit?: number;
    }
  ): Promise<NotificationGroup[]> {
    try {
      let groups = Array.from(this.activeGroups.values());
      
      // Apply filters
      if (userId) {
        groups = groups.filter(g => g.userId === userId);
      }
      
      if (options?.type) {
        groups = groups.filter(g => g.type === options.type);
      }
      
      if (options?.status) {
        groups = groups.filter(g => g.status === options.status);
      }
      
      // Apply limit
      if (options?.limit) {
        groups = groups.slice(0, options.limit);
      }
      
      return groups;
      
    } catch (error) {
      logger.error('Failed to get active groups', { error });
      throw error;
    }
  }

  /**
   * Send group immediately
   */
  async sendGroupNow(groupId: string): Promise<boolean> {
    try {
      const group = this.activeGroups.get(groupId);
      
      if (!group) {
        throw new Error(`Group not found: ${groupId}`);
      }
      
      if (group.status === 'sent') {
        logger.info('Group already sent', { groupId });
        return false;
      }
      
      await this.sendGroup(group);
      
      return true;
      
    } catch (error) {
      logger.error('Failed to send group', { error, groupId });
      throw error;
    }
  }

  /**
   * Cancel group
   */
  async cancelGroup(groupId: string): Promise<boolean> {
    try {
      const group = this.activeGroups.get(groupId);
      
      if (!group) {
        throw new Error(`Group not found: ${groupId}`);
      }
      
      if (group.status === 'sent') {
        logger.info('Group already sent, cannot cancel', { groupId });
        return false;
      }
      
      // Cancel timer
      const timer = this.groupingTimers.get(groupId);
      if (timer) {
        clearTimeout(timer);
        this.groupingTimers.delete(groupId);
      }
      
      // Update status
      group.status = 'cancelled';
      await this.storeGroup(group);
      
      // Remove from active groups
      this.activeGroups.delete(groupId);
      
      logger.info('Group cancelled', { groupId });
      
      return true;
      
    } catch (error) {
      logger.error('Failed to cancel group', { error, groupId });
      throw error;
    }
  }

  /**
   * Get grouping metrics
   */
  async getMetrics(period?: { from: Date; to: Date }): Promise<GroupingMetrics> {
    try {
      // Calculate efficiency
      if (this.metrics.notificationsGrouped > 0) {
        const originalCount = this.metrics.notificationsGrouped;
        const groupCount = this.metrics.totalGroups;
        this.metrics.groupingEfficiency = 1 - (groupCount / originalCount);
        
        if (groupCount > 0) {
          this.metrics.averageGroupSize = originalCount / groupCount;
        }
      }
      
      // Update active groups count
      this.metrics.activeGroups = this.activeGroups.size;
      
      return this.metrics;
      
    } catch (error) {
      logger.error('Failed to get metrics', { error });
      throw error;
    }
  }

  /**
   * Update grouping rule
   */
  async updateGroupingRule(
    ruleId: string,
    updates: Partial<GroupingRule>
  ): Promise<GroupingRule> {
    try {
      const rule = this.groupingRules.get(ruleId);
      
      if (!rule) {
        throw new Error(`Rule not found: ${ruleId}`);
      }
      
      const updatedRule: GroupingRule = {
        ...rule,
        ...updates,
        ruleId,
        updatedAt: new Date()
      };
      
      // Validate updated rule
      this.validateGroupingRule(updatedRule);
      
      // Update rule
      this.groupingRules.set(ruleId, updatedRule);
      await this.storeGroupingRule(updatedRule);
      
      logger.info('Grouping rule updated', { ruleId });
      
      return updatedRule;
      
    } catch (error) {
      logger.error('Failed to update grouping rule', { error, ruleId });
      throw error;
    }
  }

  /**
   * Delete grouping rule
   */
  async deleteGroupingRule(ruleId: string): Promise<void> {
    try {
      const rule = this.groupingRules.get(ruleId);
      
      if (!rule) {
        throw new Error(`Rule not found: ${ruleId}`);
      }
      
      // Cancel any active groups using this rule
      for (const [groupId, group] of this.activeGroups) {
        if (group.metadata.ruleId === ruleId) {
          await this.cancelGroup(groupId);
        }
      }
      
      // Delete rule
      this.groupingRules.delete(ruleId);
      await redisClient.hdel('grouping_rules', ruleId);
      
      logger.info('Grouping rule deleted', { ruleId });
      
    } catch (error) {
      logger.error('Failed to delete grouping rule', { error, ruleId });
      throw error;
    }
  }

  // Private helper methods

  private findApplicableRules(notification: NotificationData): GroupingRule[] {
    const applicableRules: GroupingRule[] = [];
    
    for (const rule of this.groupingRules.values()) {
      if (!rule.enabled) continue;
      
      // Check type match
      if (rule.type !== 'all' && rule.type !== notification.type) continue;
      
      // Check conditions
      if (this.checkConditions(notification, rule.conditions)) {
        applicableRules.push(rule);
      }
    }
    
    return applicableRules;
  }

  private checkConditions(
    notification: NotificationData,
    conditions: GroupingRule['conditions']
  ): boolean {
    if (conditions.length === 0) return true;
    
    for (const condition of conditions) {
      const fieldValue = this.getFieldValue(notification, condition.field);
      
      if (!this.evaluateCondition(fieldValue, condition.operator, condition.value)) {
        return false;
      }
    }
    
    return true;
  }

  private getFieldValue(notification: NotificationData, field: string): any {
    const parts = field.split('.');
    let value: any = notification;
    
    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = value[part];
    }
    
    return value;
  }

  private evaluateCondition(fieldValue: any, operator: string, conditionValue: any): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === conditionValue;
      case 'contains':
        return String(fieldValue).includes(String(conditionValue));
      case 'startsWith':
        return String(fieldValue).startsWith(String(conditionValue));
      case 'endsWith':
        return String(fieldValue).endsWith(String(conditionValue));
      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
      case 'regex':
        return new RegExp(conditionValue).test(String(fieldValue));
      default:
        return false;
    }
  }

  private generateGroupKey(notification: NotificationData, rule: GroupingRule): string {
    const keyParts: string[] = [];
    
    for (const field of rule.groupBy) {
      const value = this.getFieldValue(notification, field);
      keyParts.push(String(value || 'null'));
    }
    
    return keyParts.join('_');
  }

  private async createGroup(
    groupId: string,
    notification: NotificationData,
    rule: GroupingRule
  ): Promise<NotificationGroup> {
    const group: NotificationGroup = {
      groupId,
      userId: notification.userId,
      type: notification.type,
      key: this.generateGroupKey(notification, rule),
      notifications: [],
      count: 0,
      firstNotificationAt: new Date(),
      lastNotificationAt: new Date(),
      priority: notification.priority,
      status: 'collecting',
      metadata: {
        ruleId: rule.ruleId,
        aggregationType: rule.aggregation.strategy
      }
    };
    
    this.activeGroups.set(groupId, group);
    await this.storeGroup(group);
    
    // Update metrics
    this.metrics.totalGroups++;
    
    return group;
  }

  private shouldSendGroupImmediately(group: NotificationGroup, rule: GroupingRule): boolean {
    // Check max items
    if (rule.aggregation.maxItems && group.count >= rule.aggregation.maxItems) {
      return true;
    }
    
    // Check critical priority
    if (group.priority === 'critical') {
      return true;
    }
    
    // Check if group is full
    if (group.count >= this.maxGroupSize) {
      return true;
    }
    
    return false;
  }

  private async sendGroup(group: NotificationGroup): Promise<void> {
    try {
      // Clear timer
      const timer = this.groupingTimers.get(group.groupId);
      if (timer) {
        clearTimeout(timer);
        this.groupingTimers.delete(group.groupId);
      }
      
      // Generate summary
      const summary = this.generateGroupSummary(group);
      group.summary = summary;
      
      // Create aggregated notification
      const aggregatedNotification = this.createAggregatedNotification(group);
      
      // Send notification
      // This would integrate with the notification service
      this.emit('groupReady', {
        group,
        notification: aggregatedNotification
      });
      
      // Update status
      group.status = 'sent';
      await this.storeGroup(group);
      
      // Remove from active groups
      this.activeGroups.delete(group.groupId);
      
      // Update metrics
      this.updateMetrics('sent', group.type, group.count);
      
      logger.info('Group sent', {
        groupId: group.groupId,
        count: group.count,
        userId: group.userId
      });
      
    } catch (error) {
      logger.error('Failed to send group', { error, groupId: group.groupId });
      throw error;
    }
  }

  private setGroupTimer(group: NotificationGroup, rule: GroupingRule): void {
    // Clear existing timer
    const existingTimer = this.groupingTimers.get(group.groupId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Set new timer
    const timeWindow = rule.aggregation.timeWindow || this.defaultTimeWindow;
    const timeElapsed = Date.now() - group.firstNotificationAt.getTime();
    const timeRemaining = Math.max(0, timeWindow - timeElapsed);
    
    const timer = setTimeout(() => {
      this.sendGroup(group);
    }, timeRemaining);
    
    this.groupingTimers.set(group.groupId, timer);
  }

  private generateGroupSummary(group: NotificationGroup): string {
    const strategy = group.metadata.aggregationType || 'count';
    
    switch (strategy) {
      case 'count':
        return `You have ${group.count} ${group.type} notifications`;
        
      case 'list':
        const items = group.notifications
          .slice(0, 5)
          .map(n => n.title || n.message)
          .join(', ');
        const more = group.count > 5 ? ` and ${group.count - 5} more` : '';
        return `${items}${more}`;
        
      case 'summary':
        return `${group.count} notifications: ${group.notifications[0].title}`;
        
      case 'digest':
        const types = new Set(group.notifications.map(n => n.type));
        return `Daily digest: ${group.count} notifications from ${types.size} categories`;
        
      default:
        return `You have ${group.count} notifications`;
    }
  }

  private createAggregatedNotification(group: NotificationGroup): NotificationData {
    const firstNotification = group.notifications[0];
    
    return {
      notificationId: `aggregated_${group.groupId}`,
      userId: group.userId,
      type: group.type,
      title: `${group.count} ${group.type} notifications`,
      message: group.summary || this.generateGroupSummary(group),
      priority: group.priority,
      channels: firstNotification.channels,
      status: 'pending',
      createdAt: new Date(),
      metadata: {
        isAggregated: true,
        groupId: group.groupId,
        notificationCount: group.count,
        notificationIds: group.notifications.map(n => n.notificationId),
        ...group.metadata
      }
    };
  }

  private applyBatchCriteria(
    notifications: NotificationData[],
    batch: BatchConfig
  ): NotificationData[] {
    return notifications.filter(notification => {
      // Check notification types
      if (batch.criteria.notificationTypes?.length) {
        if (!batch.criteria.notificationTypes.includes(notification.type)) {
          return false;
        }
      }
      
      // Check channels
      if (batch.criteria.channels?.length) {
        const hasChannel = notification.channels.some(c => 
          batch.criteria.channels!.includes(c)
        );
        if (!hasChannel) return false;
      }
      
      // Additional criteria would be checked here
      
      return true;
    });
  }

  private async createBatchGroup(
    userId: string,
    notifications: NotificationData[],
    batch: BatchConfig
  ): Promise<{ success: boolean; groupId?: string }> {
    try {
      const groupId = `batch_${batch.batchId}_${userId}_${Date.now()}`;
      
      const group: NotificationGroup = {
        groupId,
        userId,
        type: notifications[0].type,
        key: `batch_${batch.batchId}`,
        notifications,
        count: notifications.length,
        firstNotificationAt: new Date(),
        lastNotificationAt: new Date(),
        priority: batch.priority,
        status: 'ready',
        metadata: {
          batchId: batch.batchId,
          aggregationType: 'batch'
        }
      };
      
      await this.sendGroup(group);
      
      return { success: true, groupId };
      
    } catch (error) {
      logger.error('Failed to create batch group', { error, userId });
      return { success: false };
    }
  }

  private async scheduleBatch(batch: BatchConfig): Promise<void> {
    if (!batch.schedule) return;
    
    // Implementation would handle scheduling logic
    // This could integrate with a job scheduler like Bull or Agenda
    
    logger.info('Batch scheduled', {
      batchId: batch.batchId,
      schedule: batch.schedule
    });
  }

  private comparePriority(p1: NotificationPriority, p2: NotificationPriority): number {
    const priorities = { critical: 4, high: 3, medium: 2, low: 1 };
    return priorities[p1] - priorities[p2];
  }

  private validateGroupingRule(rule: GroupingRule): void {
    if (!rule.name) {
      throw new Error('Rule name is required');
    }
    
    if (rule.groupBy.length === 0) {
      throw new Error('At least one groupBy field is required');
    }
    
    if (!rule.aggregation.strategy) {
      throw new Error('Aggregation strategy is required');
    }
  }

  private validateBatchConfig(config: BatchConfig): void {
    if (!config.name) {
      throw new Error('Batch name is required');
    }
    
    if (config.limits.maxNotifications && config.limits.maxNotifications <= 0) {
      throw new Error('Max notifications must be positive');
    }
  }

  private updateMetrics(event: string, type?: NotificationType, count: number = 1): void {
    switch (event) {
      case 'grouped':
        this.metrics.notificationsGrouped += count;
        if (type) {
          if (!this.metrics.byType[type]) {
            this.metrics.byType[type] = { groups: 0, notifications: 0, averageSize: 0 };
          }
          this.metrics.byType[type].notifications += count;
        }
        break;
        
      case 'sent':
        this.metrics.notificationsSent += count;
        if (type) {
          if (!this.metrics.byType[type]) {
            this.metrics.byType[type] = { groups: 0, notifications: 0, averageSize: 0 };
          }
          this.metrics.byType[type].groups++;
          this.metrics.byType[type].averageSize = 
            this.metrics.byType[type].notifications / this.metrics.byType[type].groups;
        }
        break;
    }
    
    // Persist metrics
    this.persistMetrics();
  }

  private async persistMetrics(): Promise<void> {
    await redisClient.hset(
      'grouping_metrics',
      'current',
      JSON.stringify(this.metrics)
    );
  }

  private async loadMetrics(): Promise<void> {
    const data = await redisClient.hget('grouping_metrics', 'current');
    if (data) {
      this.metrics = JSON.parse(data);
    }
  }

  private async loadGroupingRules(): Promise<void> {
    const rules = await redisClient.hgetall('grouping_rules');
    
    for (const [ruleId, data] of Object.entries(rules)) {
      const rule = JSON.parse(data);
      this.groupingRules.set(ruleId, rule);
    }
    
    logger.info('Grouping rules loaded', { count: this.groupingRules.size });
  }

  private async loadBatchConfigs(): Promise<void> {
    const configs = await redisClient.hgetall('batch_configs');
    
    for (const [batchId, data] of Object.entries(configs)) {
      const config = JSON.parse(data);
      this.batchConfigs.set(batchId, config);
    }
    
    logger.info('Batch configs loaded', { count: this.batchConfigs.size });
  }

  private async loadActiveGroups(): Promise<void> {
    const groups = await redisClient.hgetall('active_groups');
    
    for (const [groupId, data] of Object.entries(groups)) {
      const group = JSON.parse(data);
      if (group.status === 'collecting') {
        this.activeGroups.set(groupId, group);
      }
    }
    
    logger.info('Active groups loaded', { count: this.activeGroups.size });
  }

  private startGroupProcessors(): void {
    // Process expired groups every minute
    setInterval(() => {
      this.processExpiredGroups();
    }, 60000);
  }

  private async processExpiredGroups(): Promise<void> {
    const now = Date.now();
    
    for (const [groupId, group] of this.activeGroups) {
      const age = now - group.firstNotificationAt.getTime();
      
      // Send groups older than 5 minutes regardless of size
      if (age > 300000 && group.status === 'collecting') {
        await this.sendGroup(group);
      }
    }
  }

  private async storeGroupingRule(rule: GroupingRule): Promise<void> {
    await redisClient.hset(
      'grouping_rules',
      rule.ruleId,
      JSON.stringify(rule)
    );
  }

  private async storeBatchConfig(config: BatchConfig): Promise<void> {
    await redisClient.hset(
      'batch_configs',
      config.batchId,
      JSON.stringify(config)
    );
  }

  private async storeGroup(group: NotificationGroup): Promise<void> {
    await redisClient.hset(
      'active_groups',
      group.groupId,
      JSON.stringify(group)
    );
    
    // Set expiry for completed groups
    if (group.status === 'sent' || group.status === 'cancelled') {
      await redisClient.expire(`active_groups:${group.groupId}`, 86400); // 24 hours
    }
  }

  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public cleanup method
  async cleanup(): Promise<void> {
    // Clear all timers
    for (const timer of this.groupingTimers.values()) {
      clearTimeout(timer);
    }
    
    this.groupingTimers.clear();
  }
}

// Export singleton instance
export const notificationGroupingService = new NotificationGroupingService();
export default notificationGroupingService;