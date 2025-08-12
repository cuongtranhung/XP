/**
 * Notification Scheduling Service
 * Future-dated and recurring notification management
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import redisClient from '../config/redis';
import { 
  NotificationData,
  NotificationType,
  NotificationPriority,
  NotificationChannel
} from './notificationService';
import notificationService from './notificationService';
import * as cron from 'node-cron';

export interface ScheduledNotification {
  scheduleId: string;
  notification: NotificationData;
  scheduledFor: Date;
  timezone: string;
  status: 'pending' | 'scheduled' | 'processing' | 'sent' | 'failed' | 'cancelled';
  recurring?: RecurringSchedule;
  retryOnFailure: boolean;
  maxRetries: number;
  currentRetry: number;
  metadata: {
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
    lastProcessedAt?: Date;
    nextRunAt?: Date;
    runCount?: number;
    failureReason?: string;
  };
  conditions?: ScheduleCondition[];
  priority: NotificationPriority;
}

export interface RecurringSchedule {
  pattern: string; // Cron pattern
  frequency?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  interval?: number; // For frequency-based scheduling
  startDate: Date;
  endDate?: Date;
  maxOccurrences?: number;
  occurrenceCount: number;
  skipWeekends?: boolean;
  skipHolidays?: boolean;
  holidays?: Date[];
  daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
  daysOfMonth?: number[]; // 1-31
  monthsOfYear?: number[]; // 1-12
  time?: string; // HH:mm format
}

export interface ScheduleCondition {
  type: 'time' | 'event' | 'data' | 'user';
  field: string;
  operator: 'equals' | 'notEquals' | 'greater' | 'less' | 'contains' | 'exists';
  value: any;
  required: boolean;
}

export interface BatchSchedule {
  batchId: string;
  name: string;
  notifications: NotificationData[];
  schedule: {
    type: 'immediate' | 'delayed' | 'distributed';
    startTime: Date;
    endTime?: Date;
    distribution?: 'even' | 'random' | 'weighted';
    weights?: number[];
    batchSize?: number;
    delayBetweenBatches?: number; // milliseconds
  };
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    total: number;
    sent: number;
    failed: number;
    remaining: number;
    percentComplete: number;
  };
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface TimeSlot {
  slotId: string;
  startTime: Date;
  endTime: Date;
  capacity: number;
  used: number;
  available: number;
  notifications: string[]; // Schedule IDs
}

export interface SchedulingMetrics {
  totalScheduled: number;
  totalSent: number;
  totalFailed: number;
  totalCancelled: number;
  activeSchedules: number;
  recurringSchedules: number;
  averageDelay: number; // ms between scheduled and actual send time
  onTimeRate: number; // Percentage sent within 1 minute of scheduled time
  byFrequency: Record<string, number>;
  byChannel: Record<NotificationChannel, number>;
  byHour: number[]; // 24 hours
  byDayOfWeek: number[]; // 7 days
}

/**
 * Notification Scheduling Service Class
 */
class NotificationSchedulingService extends EventEmitter {
  private schedules = new Map<string, ScheduledNotification>();
  private batchSchedules = new Map<string, BatchSchedule>();
  private cronJobs = new Map<string, cron.ScheduledTask>();
  private timeSlots = new Map<string, TimeSlot>();
  private processingQueue = new Set<string>();
  
  private metrics: SchedulingMetrics = {
    totalScheduled: 0,
    totalSent: 0,
    totalFailed: 0,
    totalCancelled: 0,
    activeSchedules: 0,
    recurringSchedules: 0,
    averageDelay: 0,
    onTimeRate: 0,
    byFrequency: {},
    byChannel: {} as any,
    byHour: new Array(24).fill(0),
    byDayOfWeek: new Array(7).fill(0)
  };
  
  private readonly maxSchedulesPerUser = 100;
  private readonly maxBatchSize = 10000;
  private readonly processingInterval = 10000; // 10 seconds
  private processingTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.initializeService();
  }

  /**
   * Initialize scheduling service
   */
  private async initializeService(): Promise<void> {
    try {
      // Load scheduled notifications
      await this.loadScheduledNotifications();
      
      // Load batch schedules
      await this.loadBatchSchedules();
      
      // Start processing timer
      this.startProcessingTimer();
      
      // Restore cron jobs
      await this.restoreCronJobs();
      
      // Load metrics
      await this.loadMetrics();
      
      logger.info('✅ Notification scheduling service initialized', {
        activeSchedules: this.schedules.size,
        cronJobs: this.cronJobs.size
      });
      
    } catch (error) {
      logger.error('❌ Failed to initialize scheduling service', { error });
      throw error;
    }
  }

  /**
   * Schedule a notification
   */
  async scheduleNotification(
    notification: NotificationData,
    scheduleOptions: {
      sendAt: Date;
      timezone?: string;
      recurring?: Partial<RecurringSchedule>;
      conditions?: ScheduleCondition[];
      retryOnFailure?: boolean;
      maxRetries?: number;
    }
  ): Promise<ScheduledNotification> {
    try {
      // Validate schedule time
      if (scheduleOptions.sendAt <= new Date()) {
        throw new Error('Scheduled time must be in the future');
      }
      
      // Check user's schedule limit
      await this.checkUserScheduleLimit(notification.userId);
      
      const scheduleId = this.generateScheduleId();
      
      const scheduled: ScheduledNotification = {
        scheduleId,
        notification,
        scheduledFor: scheduleOptions.sendAt,
        timezone: scheduleOptions.timezone || 'UTC',
        status: 'pending',
        recurring: scheduleOptions.recurring ? this.buildRecurringSchedule(scheduleOptions.recurring) : undefined,
        retryOnFailure: scheduleOptions.retryOnFailure !== false,
        maxRetries: scheduleOptions.maxRetries || 3,
        currentRetry: 0,
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          runCount: 0
        },
        conditions: scheduleOptions.conditions,
        priority: notification.priority
      };
      
      // Validate schedule
      this.validateSchedule(scheduled);
      
      // Store schedule
      this.schedules.set(scheduleId, scheduled);
      await this.storeSchedule(scheduled);
      
      // Set up cron job if recurring
      if (scheduled.recurring) {
        await this.setupCronJob(scheduled);
      }
      
      // Update metrics
      this.updateMetrics('scheduled', scheduled);
      
      // Emit event
      this.emit('notificationScheduled', {
        scheduleId,
        scheduledFor: scheduled.scheduledFor,
        recurring: !!scheduled.recurring
      });
      
      logger.info('Notification scheduled', {
        scheduleId,
        userId: notification.userId,
        scheduledFor: scheduled.scheduledFor,
        recurring: !!scheduled.recurring
      });
      
      return scheduled;
      
    } catch (error) {
      logger.error('Failed to schedule notification', { error });
      throw error;
    }
  }

  /**
   * Schedule batch notifications
   */
  async scheduleBatch(
    notifications: NotificationData[],
    batchOptions: {
      name: string;
      schedule: BatchSchedule['schedule'];
    }
  ): Promise<BatchSchedule> {
    try {
      if (notifications.length === 0) {
        throw new Error('No notifications to schedule');
      }
      
      if (notifications.length > this.maxBatchSize) {
        throw new Error(`Batch size exceeds maximum of ${this.maxBatchSize}`);
      }
      
      const batchId = this.generateBatchId();
      
      const batch: BatchSchedule = {
        batchId,
        name: batchOptions.name,
        notifications,
        schedule: batchOptions.schedule,
        status: 'pending',
        progress: {
          total: notifications.length,
          sent: 0,
          failed: 0,
          remaining: notifications.length,
          percentComplete: 0
        },
        createdAt: new Date()
      };
      
      // Store batch
      this.batchSchedules.set(batchId, batch);
      await this.storeBatchSchedule(batch);
      
      // Start processing based on schedule type
      if (batch.schedule.type === 'immediate') {
        await this.processBatchImmediate(batch);
      } else if (batch.schedule.type === 'delayed') {
        this.scheduleBatchProcessing(batch);
      } else if (batch.schedule.type === 'distributed') {
        await this.processBatchDistributed(batch);
      }
      
      logger.info('Batch scheduled', {
        batchId,
        name: batch.name,
        total: batch.progress.total,
        scheduleType: batch.schedule.type
      });
      
      return batch;
      
    } catch (error) {
      logger.error('Failed to schedule batch', { error });
      throw error;
    }
  }

  /**
   * Cancel scheduled notification
   */
  async cancelSchedule(scheduleId: string): Promise<boolean> {
    try {
      const schedule = this.schedules.get(scheduleId);
      
      if (!schedule) {
        throw new Error(`Schedule not found: ${scheduleId}`);
      }
      
      if (schedule.status === 'sent') {
        logger.info('Schedule already sent, cannot cancel', { scheduleId });
        return false;
      }
      
      // Cancel cron job if exists
      const cronJob = this.cronJobs.get(scheduleId);
      if (cronJob) {
        cronJob.stop();
        this.cronJobs.delete(scheduleId);
      }
      
      // Update status
      schedule.status = 'cancelled';
      schedule.metadata.updatedAt = new Date();
      
      await this.storeSchedule(schedule);
      
      // Remove from active schedules
      this.schedules.delete(scheduleId);
      
      // Update metrics
      this.updateMetrics('cancelled', schedule);
      
      // Emit event
      this.emit('scheduleCancelled', { scheduleId });
      
      logger.info('Schedule cancelled', { scheduleId });
      
      return true;
      
    } catch (error) {
      logger.error('Failed to cancel schedule', { error, scheduleId });
      throw error;
    }
  }

  /**
   * Update scheduled notification
   */
  async updateSchedule(
    scheduleId: string,
    updates: {
      scheduledFor?: Date;
      notification?: Partial<NotificationData>;
      recurring?: Partial<RecurringSchedule>;
      conditions?: ScheduleCondition[];
    }
  ): Promise<ScheduledNotification> {
    try {
      const schedule = this.schedules.get(scheduleId);
      
      if (!schedule) {
        throw new Error(`Schedule not found: ${scheduleId}`);
      }
      
      if (schedule.status === 'sent' || schedule.status === 'processing') {
        throw new Error('Cannot update schedule in current status');
      }
      
      // Apply updates
      if (updates.scheduledFor) {
        schedule.scheduledFor = updates.scheduledFor;
      }
      
      if (updates.notification) {
        schedule.notification = { ...schedule.notification, ...updates.notification };
      }
      
      if (updates.recurring) {
        schedule.recurring = schedule.recurring ? 
          { ...schedule.recurring, ...updates.recurring } : 
          this.buildRecurringSchedule(updates.recurring);
      }
      
      if (updates.conditions) {
        schedule.conditions = updates.conditions;
      }
      
      schedule.metadata.updatedAt = new Date();
      
      // Validate updated schedule
      this.validateSchedule(schedule);
      
      // Update cron job if recurring changed
      if (updates.recurring) {
        const cronJob = this.cronJobs.get(scheduleId);
        if (cronJob) {
          cronJob.stop();
          this.cronJobs.delete(scheduleId);
        }
        
        if (schedule.recurring) {
          await this.setupCronJob(schedule);
        }
      }
      
      // Store updated schedule
      await this.storeSchedule(schedule);
      
      logger.info('Schedule updated', { scheduleId });
      
      return schedule;
      
    } catch (error) {
      logger.error('Failed to update schedule', { error, scheduleId });
      throw error;
    }
  }

  /**
   * Get scheduled notifications
   */
  async getScheduledNotifications(
    userId?: string,
    options?: {
      status?: ScheduledNotification['status'];
      recurring?: boolean;
      from?: Date;
      to?: Date;
      limit?: number;
    }
  ): Promise<ScheduledNotification[]> {
    try {
      let schedules = Array.from(this.schedules.values());
      
      // Apply filters
      if (userId) {
        schedules = schedules.filter(s => s.notification.userId === userId);
      }
      
      if (options?.status) {
        schedules = schedules.filter(s => s.status === options.status);
      }
      
      if (options?.recurring !== undefined) {
        schedules = schedules.filter(s => !!s.recurring === options.recurring);
      }
      
      if (options?.from) {
        schedules = schedules.filter(s => s.scheduledFor >= options.from!);
      }
      
      if (options?.to) {
        schedules = schedules.filter(s => s.scheduledFor <= options.to!);
      }
      
      // Sort by scheduled time
      schedules.sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
      
      // Apply limit
      if (options?.limit) {
        schedules = schedules.slice(0, options.limit);
      }
      
      return schedules;
      
    } catch (error) {
      logger.error('Failed to get scheduled notifications', { error });
      throw error;
    }
  }

  /**
   * Get next occurrence for recurring schedule
   */
  getNextOccurrence(schedule: RecurringSchedule, after?: Date): Date | null {
    try {
      const baseDate = after || new Date();
      
      // Check if schedule has ended
      if (schedule.endDate && baseDate > schedule.endDate) {
        return null;
      }
      
      // Check max occurrences
      if (schedule.maxOccurrences && schedule.occurrenceCount >= schedule.maxOccurrences) {
        return null;
      }
      
      // Calculate next occurrence based on pattern
      if (schedule.pattern) {
        const interval = cron.parseExpression(schedule.pattern, {
          currentDate: baseDate
        });
        
        const next = interval.next();
        if (next) {
          const nextDate = next.toDate();
          
          // Check weekend skip
          if (schedule.skipWeekends) {
            const dayOfWeek = nextDate.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) {
              return this.getNextOccurrence(schedule, new Date(nextDate.getTime() + 86400000));
            }
          }
          
          // Check holiday skip
          if (schedule.skipHolidays && schedule.holidays) {
            const isHoliday = schedule.holidays.some(h => 
              this.isSameDay(h, nextDate)
            );
            
            if (isHoliday) {
              return this.getNextOccurrence(schedule, new Date(nextDate.getTime() + 86400000));
            }
          }
          
          return nextDate;
        }
      }
      
      // Frequency-based calculation
      if (schedule.frequency && schedule.interval) {
        const nextDate = new Date(baseDate);
        
        switch (schedule.frequency) {
          case 'hourly':
            nextDate.setHours(nextDate.getHours() + schedule.interval);
            break;
          case 'daily':
            nextDate.setDate(nextDate.getDate() + schedule.interval);
            break;
          case 'weekly':
            nextDate.setDate(nextDate.getDate() + (schedule.interval * 7));
            break;
          case 'monthly':
            nextDate.setMonth(nextDate.getMonth() + schedule.interval);
            break;
          case 'yearly':
            nextDate.setFullYear(nextDate.getFullYear() + schedule.interval);
            break;
        }
        
        return nextDate;
      }
      
      return null;
      
    } catch (error) {
      logger.error('Failed to get next occurrence', { error });
      return null;
    }
  }

  /**
   * Get available time slots
   */
  async getAvailableTimeSlots(
    date: Date,
    duration: number = 3600000, // 1 hour in ms
    capacity: number = 100
  ): Promise<TimeSlot[]> {
    try {
      const slots: TimeSlot[] = [];
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      let currentTime = startOfDay.getTime();
      
      while (currentTime < endOfDay.getTime()) {
        const slotId = `slot_${currentTime}_${duration}`;
        const existingSlot = this.timeSlots.get(slotId);
        
        if (existingSlot) {
          if (existingSlot.available > 0) {
            slots.push(existingSlot);
          }
        } else {
          const newSlot: TimeSlot = {
            slotId,
            startTime: new Date(currentTime),
            endTime: new Date(currentTime + duration),
            capacity,
            used: 0,
            available: capacity,
            notifications: []
          };
          
          slots.push(newSlot);
        }
        
        currentTime += duration;
      }
      
      return slots;
      
    } catch (error) {
      logger.error('Failed to get available time slots', { error });
      throw error;
    }
  }

  /**
   * Get scheduling metrics
   */
  async getMetrics(period?: { from: Date; to: Date }): Promise<SchedulingMetrics> {
    try {
      // Update active schedules count
      this.metrics.activeSchedules = Array.from(this.schedules.values())
        .filter(s => s.status === 'pending' || s.status === 'scheduled').length;
      
      // Update recurring schedules count
      this.metrics.recurringSchedules = Array.from(this.schedules.values())
        .filter(s => !!s.recurring).length;
      
      // Calculate on-time rate
      if (this.metrics.totalSent > 0) {
        this.metrics.onTimeRate = 
          (this.metrics.totalSent - this.metrics.totalFailed) / this.metrics.totalSent;
      }
      
      return this.metrics;
      
    } catch (error) {
      logger.error('Failed to get metrics', { error });
      throw error;
    }
  }

  // Private helper methods

  private startProcessingTimer(): void {
    this.processingTimer = setInterval(() => {
      this.processScheduledNotifications();
    }, this.processingInterval);
  }

  private async processScheduledNotifications(): Promise<void> {
    try {
      const now = new Date();
      const schedules = Array.from(this.schedules.values());
      
      for (const schedule of schedules) {
        // Skip if already processing
        if (this.processingQueue.has(schedule.scheduleId)) {
          continue;
        }
        
        // Check if should process
        if (schedule.status === 'pending' && schedule.scheduledFor <= now) {
          // Check conditions
          if (schedule.conditions && !await this.checkConditions(schedule.conditions)) {
            logger.debug('Schedule conditions not met', { scheduleId: schedule.scheduleId });
            continue;
          }
          
          // Add to processing queue
          this.processingQueue.add(schedule.scheduleId);
          
          // Process asynchronously
          this.processSchedule(schedule).catch(error => {
            logger.error('Failed to process schedule', { error, scheduleId: schedule.scheduleId });
          }).finally(() => {
            this.processingQueue.delete(schedule.scheduleId);
          });
        }
      }
      
    } catch (error) {
      logger.error('Error in scheduled notification processing', { error });
    }
  }

  private async processSchedule(schedule: ScheduledNotification): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Update status
      schedule.status = 'processing';
      schedule.metadata.lastProcessedAt = new Date();
      await this.storeSchedule(schedule);
      
      // Send notification
      const result = await notificationService.createNotification(schedule.notification);
      
      if (result) {
        // Success
        schedule.status = 'sent';
        schedule.metadata.runCount = (schedule.metadata.runCount || 0) + 1;
        
        // Calculate delay
        const delay = startTime - schedule.scheduledFor.getTime();
        this.updateAverageDelay(delay);
        
        // Update metrics
        this.updateMetrics('sent', schedule);
        
        // Handle recurring
        if (schedule.recurring) {
          await this.handleRecurringSchedule(schedule);
        } else {
          // Remove from active schedules
          this.schedules.delete(schedule.scheduleId);
        }
        
        // Emit success event
        this.emit('scheduledNotificationSent', {
          scheduleId: schedule.scheduleId,
          notificationId: result.notificationId,
          delay
        });
        
        logger.info('Scheduled notification sent', {
          scheduleId: schedule.scheduleId,
          delay
        });
        
      } else {
        throw new Error('Failed to create notification');
      }
      
    } catch (error) {
      // Handle failure
      schedule.currentRetry++;
      
      if (schedule.retryOnFailure && schedule.currentRetry < schedule.maxRetries) {
        // Retry with exponential backoff
        const retryDelay = Math.pow(2, schedule.currentRetry) * 1000;
        schedule.scheduledFor = new Date(Date.now() + retryDelay);
        schedule.status = 'pending';
        
        logger.info('Scheduled notification will retry', {
          scheduleId: schedule.scheduleId,
          retry: schedule.currentRetry,
          nextAttempt: schedule.scheduledFor
        });
        
      } else {
        // Max retries reached or retry disabled
        schedule.status = 'failed';
        schedule.metadata.failureReason = error instanceof Error ? error.message : 'Unknown error';
        
        // Update metrics
        this.updateMetrics('failed', schedule);
        
        // Remove from active schedules if not recurring
        if (!schedule.recurring) {
          this.schedules.delete(schedule.scheduleId);
        }
        
        // Emit failure event
        this.emit('scheduledNotificationFailed', {
          scheduleId: schedule.scheduleId,
          error: schedule.metadata.failureReason
        });
        
        logger.error('Scheduled notification failed', {
          scheduleId: schedule.scheduleId,
          error
        });
      }
      
      await this.storeSchedule(schedule);
    }
  }

  private async handleRecurringSchedule(schedule: ScheduledNotification): Promise<void> {
    if (!schedule.recurring) return;
    
    // Increment occurrence count
    schedule.recurring.occurrenceCount++;
    
    // Get next occurrence
    const nextOccurrence = this.getNextOccurrence(schedule.recurring, new Date());
    
    if (nextOccurrence) {
      // Schedule next run
      schedule.scheduledFor = nextOccurrence;
      schedule.status = 'pending';
      schedule.currentRetry = 0;
      schedule.metadata.nextRunAt = nextOccurrence;
      
      await this.storeSchedule(schedule);
      
      logger.debug('Recurring schedule updated', {
        scheduleId: schedule.scheduleId,
        nextRun: nextOccurrence,
        occurrences: schedule.recurring.occurrenceCount
      });
      
    } else {
      // No more occurrences
      this.schedules.delete(schedule.scheduleId);
      
      // Stop cron job
      const cronJob = this.cronJobs.get(schedule.scheduleId);
      if (cronJob) {
        cronJob.stop();
        this.cronJobs.delete(schedule.scheduleId);
      }
      
      logger.info('Recurring schedule completed', {
        scheduleId: schedule.scheduleId,
        totalOccurrences: schedule.recurring.occurrenceCount
      });
    }
  }

  private async setupCronJob(schedule: ScheduledNotification): Promise<void> {
    if (!schedule.recurring?.pattern) return;
    
    try {
      const job = cron.schedule(schedule.recurring.pattern, async () => {
        await this.processSchedule(schedule);
      }, {
        scheduled: false,
        timezone: schedule.timezone
      });
      
      // Store and start job
      this.cronJobs.set(schedule.scheduleId, job);
      job.start();
      
      logger.debug('Cron job created', {
        scheduleId: schedule.scheduleId,
        pattern: schedule.recurring.pattern
      });
      
    } catch (error) {
      logger.error('Failed to create cron job', { error, scheduleId: schedule.scheduleId });
    }
  }

  private async processBatchImmediate(batch: BatchSchedule): Promise<void> {
    batch.status = 'running';
    batch.startedAt = new Date();
    
    // Process all notifications immediately
    for (const notification of batch.notifications) {
      try {
        await notificationService.createNotification(notification);
        batch.progress.sent++;
      } catch (error) {
        batch.progress.failed++;
        logger.error('Failed to send batch notification', { error });
      }
      
      batch.progress.remaining--;
      batch.progress.percentComplete = 
        (batch.progress.sent / batch.progress.total) * 100;
      
      // Update batch periodically
      if (batch.progress.sent % 10 === 0) {
        await this.storeBatchSchedule(batch);
      }
    }
    
    batch.status = 'completed';
    batch.completedAt = new Date();
    await this.storeBatchSchedule(batch);
  }

  private scheduleBatchProcessing(batch: BatchSchedule): void {
    const delay = batch.schedule.startTime.getTime() - Date.now();
    
    setTimeout(() => {
      this.processBatchImmediate(batch);
    }, Math.max(0, delay));
  }

  private async processBatchDistributed(batch: BatchSchedule): Promise<void> {
    const { startTime, endTime, distribution } = batch.schedule;
    
    if (!endTime) {
      return this.processBatchImmediate(batch);
    }
    
    const duration = endTime.getTime() - startTime.getTime();
    const notificationCount = batch.notifications.length;
    
    batch.status = 'running';
    batch.startedAt = new Date();
    
    if (distribution === 'even') {
      // Distribute evenly across time period
      const interval = duration / notificationCount;
      
      batch.notifications.forEach((notification, index) => {
        const sendTime = new Date(startTime.getTime() + (interval * index));
        
        this.scheduleNotification(notification, {
          sendAt: sendTime
        });
      });
      
    } else if (distribution === 'random') {
      // Random distribution within time period
      batch.notifications.forEach(notification => {
        const randomDelay = Math.random() * duration;
        const sendTime = new Date(startTime.getTime() + randomDelay);
        
        this.scheduleNotification(notification, {
          sendAt: sendTime
        });
      });
      
    } else if (distribution === 'weighted' && batch.schedule.weights) {
      // Weighted distribution
      // Implementation would distribute based on weights
    }
    
    await this.storeBatchSchedule(batch);
  }

  private async checkConditions(conditions: ScheduleCondition[]): Promise<boolean> {
    for (const condition of conditions) {
      if (!await this.evaluateCondition(condition)) {
        if (condition.required) {
          return false;
        }
      }
    }
    
    return true;
  }

  private async evaluateCondition(condition: ScheduleCondition): Promise<boolean> {
    // Implementation would check various condition types
    // This is a simplified version
    
    switch (condition.type) {
      case 'time':
        // Check time-based conditions
        const now = new Date();
        const hour = now.getHours();
        
        if (condition.field === 'hour') {
          switch (condition.operator) {
            case 'equals':
              return hour === condition.value;
            case 'greater':
              return hour > condition.value;
            case 'less':
              return hour < condition.value;
            default:
              return false;
          }
        }
        break;
        
      case 'event':
        // Check event-based conditions
        // Would check if specific events have occurred
        break;
        
      case 'data':
        // Check data conditions
        // Would query data sources
        break;
        
      case 'user':
        // Check user conditions
        // Would check user status, preferences, etc.
        break;
    }
    
    return true;
  }

  private buildRecurringSchedule(partial: Partial<RecurringSchedule>): RecurringSchedule {
    return {
      pattern: partial.pattern || '',
      frequency: partial.frequency,
      interval: partial.interval,
      startDate: partial.startDate || new Date(),
      endDate: partial.endDate,
      maxOccurrences: partial.maxOccurrences,
      occurrenceCount: 0,
      skipWeekends: partial.skipWeekends,
      skipHolidays: partial.skipHolidays,
      holidays: partial.holidays,
      daysOfWeek: partial.daysOfWeek,
      daysOfMonth: partial.daysOfMonth,
      monthsOfYear: partial.monthsOfYear,
      time: partial.time
    };
  }

  private validateSchedule(schedule: ScheduledNotification): void {
    if (!schedule.notification) {
      throw new Error('Notification is required');
    }
    
    if (!schedule.scheduledFor) {
      throw new Error('Scheduled time is required');
    }
    
    if (schedule.recurring) {
      if (!schedule.recurring.pattern && !schedule.recurring.frequency) {
        throw new Error('Recurring schedule must have pattern or frequency');
      }
      
      if (schedule.recurring.endDate && schedule.recurring.endDate <= schedule.recurring.startDate) {
        throw new Error('End date must be after start date');
      }
    }
  }

  private async checkUserScheduleLimit(userId: string): Promise<void> {
    const userSchedules = Array.from(this.schedules.values())
      .filter(s => s.notification.userId === userId && s.status === 'pending');
    
    if (userSchedules.length >= this.maxSchedulesPerUser) {
      throw new Error(`User has reached maximum schedule limit of ${this.maxSchedulesPerUser}`);
    }
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  private updateMetrics(event: string, schedule: ScheduledNotification): void {
    switch (event) {
      case 'scheduled':
        this.metrics.totalScheduled++;
        if (schedule.recurring) {
          const frequency = schedule.recurring.frequency || 'custom';
          this.metrics.byFrequency[frequency] = (this.metrics.byFrequency[frequency] || 0) + 1;
        }
        break;
        
      case 'sent':
        this.metrics.totalSent++;
        const hour = new Date().getHours();
        const dayOfWeek = new Date().getDay();
        this.metrics.byHour[hour]++;
        this.metrics.byDayOfWeek[dayOfWeek]++;
        
        for (const channel of schedule.notification.channels) {
          this.metrics.byChannel[channel] = (this.metrics.byChannel[channel] || 0) + 1;
        }
        break;
        
      case 'failed':
        this.metrics.totalFailed++;
        break;
        
      case 'cancelled':
        this.metrics.totalCancelled++;
        break;
    }
    
    // Persist metrics
    this.persistMetrics();
  }

  private updateAverageDelay(delay: number): void {
    const totalDelay = this.metrics.averageDelay * (this.metrics.totalSent - 1);
    this.metrics.averageDelay = (totalDelay + delay) / this.metrics.totalSent;
  }

  private async persistMetrics(): Promise<void> {
    await redisClient.hset(
      'scheduling_metrics',
      'current',
      JSON.stringify(this.metrics)
    );
  }

  private async loadMetrics(): Promise<void> {
    const data = await redisClient.hget('scheduling_metrics', 'current');
    if (data) {
      this.metrics = JSON.parse(data);
    }
  }

  private async loadScheduledNotifications(): Promise<void> {
    const schedules = await redisClient.hgetall('scheduled_notifications');
    
    for (const [scheduleId, data] of Object.entries(schedules)) {
      const schedule = JSON.parse(data);
      
      // Convert date strings to Date objects
      schedule.scheduledFor = new Date(schedule.scheduledFor);
      schedule.metadata.createdAt = new Date(schedule.metadata.createdAt);
      schedule.metadata.updatedAt = new Date(schedule.metadata.updatedAt);
      
      if (schedule.status === 'pending' || schedule.status === 'scheduled') {
        this.schedules.set(scheduleId, schedule);
      }
    }
    
    logger.info('Scheduled notifications loaded', { count: this.schedules.size });
  }

  private async loadBatchSchedules(): Promise<void> {
    const batches = await redisClient.hgetall('batch_schedules');
    
    for (const [batchId, data] of Object.entries(batches)) {
      const batch = JSON.parse(data);
      
      // Convert date strings
      batch.createdAt = new Date(batch.createdAt);
      batch.schedule.startTime = new Date(batch.schedule.startTime);
      if (batch.schedule.endTime) {
        batch.schedule.endTime = new Date(batch.schedule.endTime);
      }
      
      if (batch.status === 'pending' || batch.status === 'running') {
        this.batchSchedules.set(batchId, batch);
      }
    }
    
    logger.info('Batch schedules loaded', { count: this.batchSchedules.size });
  }

  private async restoreCronJobs(): Promise<void> {
    for (const schedule of this.schedules.values()) {
      if (schedule.recurring && schedule.status === 'pending') {
        await this.setupCronJob(schedule);
      }
    }
    
    logger.info('Cron jobs restored', { count: this.cronJobs.size });
  }

  private async storeSchedule(schedule: ScheduledNotification): Promise<void> {
    await redisClient.hset(
      'scheduled_notifications',
      schedule.scheduleId,
      JSON.stringify(schedule)
    );
  }

  private async storeBatchSchedule(batch: BatchSchedule): Promise<void> {
    await redisClient.hset(
      'batch_schedules',
      batch.batchId,
      JSON.stringify(batch)
    );
  }

  private generateScheduleId(): string {
    return `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public cleanup method
  async cleanup(): Promise<void> {
    // Stop processing timer
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
    }
    
    // Stop all cron jobs
    for (const job of this.cronJobs.values()) {
      job.stop();
    }
    
    this.cronJobs.clear();
  }
}

// Export singleton instance
export const notificationSchedulingService = new NotificationSchedulingService();
export default notificationSchedulingService;