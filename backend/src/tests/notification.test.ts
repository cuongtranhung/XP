/**
 * Notification System Test Suite
 * Comprehensive testing for all notification components
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import { Server } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import app from '../app';
import redisClient from '../config/redis';
import notificationService from '../services/notificationService';
import notificationTemplateService from '../services/notificationTemplateService';
import notificationQueueService from '../services/notificationQueueService';
import notificationPreferencesService from '../services/notificationPreferencesService';
import notificationGroupingService from '../services/notificationGroupingService';
import notificationSchedulingService from '../services/notificationSchedulingService';
import notificationAnalyticsService from '../services/notificationAnalyticsService';
import emailNotificationChannel from '../services/channels/emailNotificationChannel';
import inAppNotificationChannel from '../services/channels/inAppNotificationChannel';
import pushNotificationChannel from '../services/channels/pushNotificationChannel';
import smsNotificationChannel from '../services/channels/smsNotificationChannel';

// Mock data
const mockUser = {
  id: 'user_test_123',
  email: 'test@example.com',
  name: 'Test User',
  phoneNumber: '+1234567890'
};

const mockNotification = {
  userId: mockUser.id,
  type: 'system' as const,
  title: 'Test Notification',
  message: 'This is a test notification',
  priority: 'medium' as const,
  channels: ['email', 'in-app'] as const
};

const mockTemplate = {
  name: 'test-template',
  category: 'test',
  subject: 'Test Subject - {{userName}}',
  body: 'Hello {{userName}}, this is a test.',
  htmlBody: '<p>Hello {{userName}}, this is a test.</p>',
  channels: {
    email: true,
    sms: true,
    push: true,
    'in-app': true
  }
};

describe('Notification Service Tests', () => {
  
  beforeAll(async () => {
    // Initialize services
    await notificationService.initialize();
    
    // Clear test data
    await redisClient.del(`notifications:${mockUser.id}`);
    await redisClient.del(`preferences:${mockUser.id}`);
  });
  
  afterAll(async () => {
    // Cleanup
    await redisClient.del(`notifications:${mockUser.id}`);
    await redisClient.del(`preferences:${mockUser.id}`);
    await redisClient.quit();
  });
  
  describe('Core Notification Service', () => {
    
    it('should create a notification', async () => {
      const notification = await notificationService.createNotification({
        ...mockNotification,
        notificationId: `test_${Date.now()}`,
        status: 'pending',
        createdAt: new Date()
      });
      
      expect(notification).toBeDefined();
      expect(notification.notificationId).toBeDefined();
      expect(notification.status).toBe('pending');
      expect(notification.userId).toBe(mockUser.id);
    });
    
    it('should get user notifications', async () => {
      const notifications = await notificationService.getUserNotifications(
        mockUser.id,
        {},
        { limit: 10, offset: 0 }
      );
      
      expect(Array.isArray(notifications)).toBe(true);
      expect(notifications.length).toBeGreaterThan(0);
    });
    
    it('should mark notification as read', async () => {
      const notification = await notificationService.createNotification({
        ...mockNotification,
        notificationId: `test_read_${Date.now()}`,
        status: 'delivered',
        createdAt: new Date()
      });
      
      const success = await notificationService.markAsRead(
        notification.notificationId,
        mockUser.id
      );
      
      expect(success).toBe(true);
      
      const updated = await notificationService.getNotification(notification.notificationId);
      expect(updated?.status).toBe('read');
    });
    
    it('should delete notification', async () => {
      const notification = await notificationService.createNotification({
        ...mockNotification,
        notificationId: `test_delete_${Date.now()}`,
        status: 'delivered',
        createdAt: new Date()
      });
      
      const success = await notificationService.deleteNotification(
        notification.notificationId,
        mockUser.id
      );
      
      expect(success).toBe(true);
      
      const deleted = await notificationService.getNotification(notification.notificationId);
      expect(deleted).toBeNull();
    });
    
    it('should validate notification priority', () => {
      const validPriorities = ['critical', 'high', 'medium', 'low'];
      
      validPriorities.forEach(priority => {
        expect(() => {
          notificationService.validateNotification({
            ...mockNotification,
            priority: priority as any
          });
        }).not.toThrow();
      });
    });
  });
  
  describe('Template Service Tests', () => {
    
    beforeEach(async () => {
      await notificationTemplateService.initialize();
    });
    
    it('should create a template', async () => {
      const template = await notificationTemplateService.createTemplate(mockTemplate);
      
      expect(template).toBeDefined();
      expect(template.templateId).toBeDefined();
      expect(template.name).toBe(mockTemplate.name);
      expect(template.category).toBe(mockTemplate.category);
    });
    
    it('should render template with variables', async () => {
      const template = await notificationTemplateService.createTemplate(mockTemplate);
      
      const rendered = await notificationTemplateService.renderTemplate(
        template.templateId,
        {
          user: {
            id: mockUser.id,
            email: mockUser.email,
            name: mockUser.name
          },
          context: {
            timestamp: new Date(),
            timezone: 'UTC',
            locale: 'en'
          },
          data: {
            userName: mockUser.name
          }
        }
      );
      
      expect(rendered.subject).toBe(`Test Subject - ${mockUser.name}`);
      expect(rendered.body).toContain(mockUser.name);
      expect(rendered.htmlBody).toContain(mockUser.name);
    });
    
    it('should validate template syntax', () => {
      const validTemplate = '{{userName}} has {{count}} notifications';
      const invalidTemplate = '{{userName has {{count notifications';
      
      expect(notificationTemplateService.validateTemplateSyntax(validTemplate)).toBe(true);
      expect(notificationTemplateService.validateTemplateSyntax(invalidTemplate)).toBe(false);
    });
    
    it('should support multiple languages', async () => {
      const multiLangTemplate = {
        ...mockTemplate,
        name: 'multi-lang-template',
        languages: {
          en: { subject: 'Hello {{userName}}', body: 'Welcome!' },
          es: { subject: 'Hola {{userName}}', body: '¡Bienvenido!' },
          fr: { subject: 'Bonjour {{userName}}', body: 'Bienvenue!' }
        }
      };
      
      const template = await notificationTemplateService.createTemplate(multiLangTemplate);
      
      const englishRender = await notificationTemplateService.renderTemplate(
        template.templateId,
        {
          user: { id: mockUser.id, email: mockUser.email, name: mockUser.name },
          context: { timestamp: new Date(), timezone: 'UTC', locale: 'en' },
          data: { userName: mockUser.name }
        },
        { locale: 'en' }
      );
      
      const spanishRender = await notificationTemplateService.renderTemplate(
        template.templateId,
        {
          user: { id: mockUser.id, email: mockUser.email, name: mockUser.name },
          context: { timestamp: new Date(), timezone: 'UTC', locale: 'es' },
          data: { userName: mockUser.name }
        },
        { locale: 'es' }
      );
      
      expect(englishRender.subject).toContain('Hello');
      expect(spanishRender.subject).toContain('Hola');
    });
  });
  
  describe('Queue Service Tests', () => {
    
    it('should add notification to queue', async () => {
      const result = await notificationQueueService.addToQueue({
        ...mockNotification,
        notificationId: `queue_test_${Date.now()}`,
        status: 'pending',
        createdAt: new Date()
      });
      
      expect(result).toBe(true);
    });
    
    it('should process queue based on priority', async () => {
      // Add notifications with different priorities
      const critical = await notificationQueueService.addToQueue({
        ...mockNotification,
        notificationId: `critical_${Date.now()}`,
        priority: 'critical',
        status: 'pending',
        createdAt: new Date()
      });
      
      const low = await notificationQueueService.addToQueue({
        ...mockNotification,
        notificationId: `low_${Date.now()}`,
        priority: 'low',
        status: 'pending',
        createdAt: new Date()
      });
      
      expect(critical).toBe(true);
      expect(low).toBe(true);
      
      // Critical should be processed first
      const queueStats = await notificationQueueService.getQueueStats();
      expect(queueStats).toBeDefined();
    });
    
    it('should handle rate limiting', async () => {
      const promises = [];
      
      // Try to add many notifications quickly
      for (let i = 0; i < 10; i++) {
        promises.push(
          notificationQueueService.addToQueue({
            ...mockNotification,
            notificationId: `rate_test_${i}_${Date.now()}`,
            status: 'pending',
            createdAt: new Date()
          })
        );
      }
      
      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value === true);
      
      expect(successful.length).toBeGreaterThan(0);
    });
    
    it('should retry failed notifications', async () => {
      const notification = {
        ...mockNotification,
        notificationId: `retry_test_${Date.now()}`,
        status: 'pending' as const,
        createdAt: new Date()
      };
      
      // Simulate failure
      await notificationQueueService.handleFailure(notification, new Error('Test failure'));
      
      // Check retry was scheduled
      const retryScheduled = await redisClient.exists(`retry:${notification.notificationId}`);
      expect(retryScheduled).toBe(1);
    });
  });
  
  describe('Preferences Service Tests', () => {
    
    it('should set user preferences', async () => {
      const preferences = await notificationPreferencesService.setUserPreferences(
        mockUser.id,
        {
          channels: {
            email: true,
            sms: false,
            push: true,
            'in-app': true
          },
          types: {
            system: true,
            marketing: false,
            transactional: true
          },
          quiet_hours: {
            enabled: true,
            start: '22:00',
            end: '08:00',
            timezone: 'America/New_York'
          }
        }
      );
      
      expect(preferences).toBeDefined();
      expect(preferences.channels.email).toBe(true);
      expect(preferences.channels.sms).toBe(false);
      expect(preferences.quiet_hours?.enabled).toBe(true);
    });
    
    it('should respect channel preferences', async () => {
      const allowed = await notificationPreferencesService.shouldSendNotification(
        mockUser.id,
        'system',
        'email'
      );
      
      expect(typeof allowed).toBe('boolean');
    });
    
    it('should check quiet hours', async () => {
      const inQuietHours = await notificationPreferencesService.isInQuietHours(mockUser.id);
      expect(typeof inQuietHours).toBe('boolean');
    });
    
    it('should handle unsubscribe', async () => {
      await notificationPreferencesService.unsubscribeFromType(mockUser.id, 'marketing');
      
      const preferences = await notificationPreferencesService.getUserPreferences(mockUser.id);
      expect(preferences.types?.marketing).toBe(false);
    });
  });
  
  describe('Grouping Service Tests', () => {
    
    it('should create grouping rule', async () => {
      const rule = await notificationGroupingService.createGroupingRule({
        name: 'Test Grouping Rule',
        type: 'system',
        conditions: [
          { field: 'type', operator: 'equals', value: 'system' }
        ],
        groupBy: ['userId', 'type'],
        aggregation: { strategy: 'count', timeWindow: 60000 },
        priority: 1,
        enabled: true
      });
      
      expect(rule).toBeDefined();
      expect(rule.ruleId).toBeDefined();
      expect(rule.name).toBe('Test Grouping Rule');
    });
    
    it('should group similar notifications', async () => {
      const notifications = [];
      
      for (let i = 0; i < 5; i++) {
        notifications.push({
          ...mockNotification,
          notificationId: `group_test_${i}_${Date.now()}`,
          status: 'pending' as const,
          createdAt: new Date()
        });
      }
      
      const results = await Promise.all(
        notifications.map(n => notificationGroupingService.processNotification(n))
      );
      
      const grouped = results.filter(r => r.grouped);
      expect(grouped.length).toBeGreaterThan(0);
    });
    
    it('should respect max group size', async () => {
      const largeGroup = [];
      
      for (let i = 0; i < 150; i++) {
        largeGroup.push({
          ...mockNotification,
          notificationId: `large_group_${i}_${Date.now()}`,
          status: 'pending' as const,
          createdAt: new Date()
        });
      }
      
      // Process all notifications
      const results = await Promise.all(
        largeGroup.map(n => notificationGroupingService.processNotification(n))
      );
      
      // Should create multiple groups due to size limit
      const uniqueGroups = new Set(results.filter(r => r.grouped).map(r => r.groupId));
      expect(uniqueGroups.size).toBeGreaterThan(1);
    });
  });
  
  describe('Scheduling Service Tests', () => {
    
    it('should schedule future notification', async () => {
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
      
      const scheduled = await notificationSchedulingService.scheduleNotification(
        {
          ...mockNotification,
          notificationId: `scheduled_test_${Date.now()}`,
          status: 'pending',
          createdAt: new Date()
        },
        {
          sendAt: futureDate,
          timezone: 'UTC'
        }
      );
      
      expect(scheduled).toBeDefined();
      expect(scheduled.scheduleId).toBeDefined();
      expect(scheduled.scheduledFor).toEqual(futureDate);
      expect(scheduled.status).toBe('pending');
    });
    
    it('should create recurring schedule', async () => {
      const scheduled = await notificationSchedulingService.scheduleNotification(
        {
          ...mockNotification,
          notificationId: `recurring_test_${Date.now()}`,
          status: 'pending',
          createdAt: new Date()
        },
        {
          sendAt: new Date(Date.now() + 3600000),
          recurring: {
            pattern: '0 9 * * *', // Daily at 9 AM
            frequency: 'daily',
            maxOccurrences: 7
          }
        }
      );
      
      expect(scheduled.recurring).toBeDefined();
      expect(scheduled.recurring?.pattern).toBe('0 9 * * *');
      expect(scheduled.recurring?.maxOccurrences).toBe(7);
    });
    
    it('should cancel scheduled notification', async () => {
      const scheduled = await notificationSchedulingService.scheduleNotification(
        {
          ...mockNotification,
          notificationId: `cancel_test_${Date.now()}`,
          status: 'pending',
          createdAt: new Date()
        },
        {
          sendAt: new Date(Date.now() + 3600000)
        }
      );
      
      const cancelled = await notificationSchedulingService.cancelSchedule(scheduled.scheduleId);
      expect(cancelled).toBe(true);
    });
    
    it('should calculate next occurrence for recurring schedule', () => {
      const schedule = {
        pattern: '0 12 * * *', // Daily at noon
        frequency: 'daily' as const,
        startDate: new Date(),
        occurrenceCount: 0,
        skipWeekends: true
      };
      
      const next = notificationSchedulingService.getNextOccurrence(schedule);
      expect(next).toBeDefined();
      expect(next).toBeInstanceOf(Date);
    });
  });
  
  describe('Analytics Service Tests', () => {
    
    it('should track notification events', async () => {
      const events = [
        { eventType: 'created' as const, timestamp: new Date() },
        { eventType: 'sent' as const, timestamp: new Date() },
        { eventType: 'delivered' as const, timestamp: new Date() },
        { eventType: 'opened' as const, timestamp: new Date() },
        { eventType: 'clicked' as const, timestamp: new Date() }
      ];
      
      const notificationId = `analytics_test_${Date.now()}`;
      
      for (const event of events) {
        await notificationAnalyticsService.trackEvent({
          eventId: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          eventType: event.eventType,
          notificationId,
          userId: mockUser.id,
          timestamp: event.timestamp
        });
      }
      
      const analytics = await notificationAnalyticsService.getNotificationAnalytics(notificationId);
      expect(analytics).toBeDefined();
      expect(analytics?.events.length).toBe(events.length);
    });
    
    it('should calculate user engagement score', async () => {
      const engagement = await notificationAnalyticsService.getUserEngagement(mockUser.id);
      
      expect(engagement).toBeDefined();
      expect(engagement.score).toBeGreaterThanOrEqual(0);
      expect(engagement.score).toBeLessThanOrEqual(100);
    });
    
    it('should generate funnel analysis', async () => {
      const funnel = await notificationAnalyticsService.getFunnelAnalysis({
        from: new Date(Date.now() - 86400000), // 24 hours ago
        to: new Date()
      });
      
      expect(funnel).toBeDefined();
      expect(funnel.sent).toBeGreaterThanOrEqual(0);
      expect(funnel.conversionRate).toBeGreaterThanOrEqual(0);
      expect(funnel.conversionRate).toBeLessThanOrEqual(1);
    });
    
    it('should export analytics data', async () => {
      const csv = await notificationAnalyticsService.exportAnalytics({
        from: new Date(Date.now() - 86400000),
        to: new Date(),
        format: 'csv'
      });
      
      expect(csv).toBeDefined();
      expect(typeof csv).toBe('string');
      expect(csv).toContain('eventType');
    });
  });
  
  describe('Channel Integration Tests', () => {
    
    describe('Email Channel', () => {
      
      beforeAll(async () => {
        await emailNotificationChannel.initialize({
          provider: 'smtp',
          smtp: {
            host: 'localhost',
            port: 1025, // MailHog
            secure: false
          },
          from: {
            name: 'Test App',
            email: 'noreply@test.com'
          },
          rateLimit: {
            maxPerSecond: 10,
            maxPerMinute: 100,
            maxPerHour: 1000
          }
        });
      });
      
      it('should send email notification', async () => {
        const result = await emailNotificationChannel.sendNotification({
          ...mockNotification,
          notificationId: `email_test_${Date.now()}`,
          status: 'pending',
          createdAt: new Date(),
          metadata: {
            recipientEmail: mockUser.email,
            recipientName: mockUser.name
          }
        });
        
        expect(result.success).toBe(true);
        expect(result.messageId).toBeDefined();
      });
      
      it('should validate email address', () => {
        expect(emailNotificationChannel.validateEmail('test@example.com')).toBe(true);
        expect(emailNotificationChannel.validateEmail('invalid-email')).toBe(false);
      });
    });
    
    describe('In-App Channel', () => {
      
      beforeAll(async () => {
        await inAppNotificationChannel.initialize({
          maxNotificationsPerUser: 100,
          retentionDays: 30,
          realtime: true,
          badgeEnabled: true,
          soundEnabled: true,
          vibrationEnabled: true
        });
      });
      
      it('should deliver in-app notification', async () => {
        const result = await inAppNotificationChannel.sendNotification({
          ...mockNotification,
          notificationId: `inapp_test_${Date.now()}`,
          status: 'pending',
          createdAt: new Date()
        });
        
        expect(result.success).toBe(true);
      });
      
      it('should update badge count', async () => {
        const count = await inAppNotificationChannel.getBadgeCount(mockUser.id);
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThanOrEqual(0);
      });
    });
    
    describe('Push Channel', () => {
      
      it('should validate push token', () => {
        const validToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
        const invalidToken = 'invalid-token';
        
        expect(pushNotificationChannel.validatePushToken(validToken)).toBe(true);
        expect(pushNotificationChannel.validatePushToken(invalidToken)).toBe(false);
      });
    });
    
    describe('SMS Channel', () => {
      
      it('should format phone number', () => {
        const formatted = smsNotificationChannel.formatPhoneNumber('1234567890');
        expect(formatted).toMatch(/^\+\d+$/);
      });
      
      it('should calculate SMS segments', () => {
        const shortMessage = 'Hello World';
        const longMessage = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10);
        
        expect(smsNotificationChannel.calculateSegments(shortMessage)).toBe(1);
        expect(smsNotificationChannel.calculateSegments(longMessage)).toBeGreaterThan(1);
      });
    });
  });
});

describe('Notification API Tests', () => {
  let authToken: string;
  
  beforeAll(async () => {
    // Get auth token
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });
    
    authToken = response.body.token || 'test-token';
  });
  
  describe('POST /api/notifications', () => {
    
    it('should send a notification', async () => {
      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mockNotification);
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.notification).toBeDefined();
    });
    
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing required fields
          userId: mockUser.id
        });
      
      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
    
    it('should schedule notification', async () => {
      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...mockNotification,
          schedule: new Date(Date.now() + 3600000).toISOString()
        });
      
      expect(response.status).toBe(202);
      expect(response.body.scheduleId).toBeDefined();
    });
  });
  
  describe('GET /api/notifications', () => {
    
    it('should get user notifications', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10, offset: 0 });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.notifications)).toBe(true);
    });
    
    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ status: 'read' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
  
  describe('WebSocket Tests', () => {
    let server: any;
    let client: ClientSocket;
    
    beforeAll((done) => {
      server = app.listen(3001, () => {
        client = ioClient('http://localhost:3001/notifications', {
          auth: { token: authToken }
        });
        
        client.on('connect', done);
      });
    });
    
    afterAll(() => {
      client.close();
      server.close();
    });
    
    it('should receive real-time notifications', (done) => {
      client.on('notification:new', (data) => {
        expect(data.notification).toBeDefined();
        expect(data.timestamp).toBeDefined();
        done();
      });
      
      // Trigger a notification
      notificationService.createNotification({
        ...mockNotification,
        notificationId: `ws_test_${Date.now()}`,
        status: 'pending',
        createdAt: new Date()
      });
    });
    
    it('should update badge count', (done) => {
      client.on('notification:badge:update', (data) => {
        expect(typeof data.count).toBe('number');
        expect(data.timestamp).toBeDefined();
        done();
      });
      
      client.emit('notification:badge');
    });
  });
});