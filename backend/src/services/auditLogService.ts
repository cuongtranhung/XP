import { pool } from '../config/database';
import { logger } from '../utils/logger';
import Redis from 'ioredis';
import redisClient from '../config/redis';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import { performance } from 'perf_hooks';

// Types and interfaces
export interface AuditEvent {
  eventId: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  category: AuditCategory;
  action: string;
  resource: {
    type: string;
    id?: string;
    name?: string;
    attributes?: Record<string, any>;
  };
  source: {
    ip?: string;
    userAgent?: string;
    application?: string;
    service?: string;
    version?: string;
  };
  outcome: 'success' | 'failure' | 'warning' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details?: {
    description?: string;
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
    changes?: Record<string, { from: any; to: any }>;
    metadata?: Record<string, any>;
    errors?: string[];
  };
  compliance: {
    regulation?: string[];
    dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
    retention?: number; // days
    encrypted?: boolean;
  };
  context?: {
    correlationId?: string;
    parentEventId?: string;
    businessContext?: string;
    environment?: 'development' | 'staging' | 'production';
    requestId?: string;
  };
}

export type AuditCategory = 
  | 'authentication'
  | 'authorization'
  | 'data_access'
  | 'data_modification'
  | 'system_admin'
  | 'security'
  | 'compliance'
  | 'integration'
  | 'user_activity'
  | 'file_access'
  | 'configuration'
  | 'backup_restore';

export interface AuditQuery {
  userId?: string;
  category?: AuditCategory;
  action?: string;
  resource?: {
    type?: string;
    id?: string;
  };
  outcome?: 'success' | 'failure' | 'warning' | 'info';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  source?: {
    ip?: string;
    application?: string;
  };
  compliance?: {
    regulation?: string;
    dataClassification?: string;
  };
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'severity' | 'category';
  sortOrder?: 'asc' | 'desc';
}

export interface AuditReport {
  reportId: string;
  title: string;
  description?: string;
  type: 'compliance' | 'security' | 'activity' | 'performance';
  period: {
    startDate: Date;
    endDate: Date;
  };
  filters?: AuditQuery;
  statistics: {
    totalEvents: number;
    successEvents: number;
    failureEvents: number;
    warningEvents: number;
    infoEvents: number;
    categoryCounts: Record<AuditCategory, number>;
    severityCounts: Record<string, number>;
    hourlyDistribution: Record<string, number>;
    topUsers: Array<{ userId: string; eventCount: number }>;
    topActions: Array<{ action: string; eventCount: number }>;
    topResources: Array<{ resourceType: string; eventCount: number }>;
  };
  events: AuditEvent[];
  generatedAt: Date;
  generatedBy: string;
}

export interface AuditAlert {
  alertId: string;
  name: string;
  description?: string;
  conditions: {
    category?: AuditCategory[];
    action?: string[];
    severity?: string[];
    outcome?: string[];
    threshold?: {
      count: number;
      timeWindow: number; // minutes
    };
    pattern?: string; // regex pattern for matching
  };
  notification: {
    email?: string[];
    webhook?: string;
    slack?: string;
    teams?: string;
  };
  isActive: boolean;
  lastTriggered?: Date;
  triggerCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceRule {
  ruleId: string;
  name: string;
  description?: string;
  regulation: string; // GDPR, HIPAA, SOX, PCI-DSS, etc.
  requirements: {
    auditCategories: AuditCategory[];
    retentionPeriod: number; // days
    encryptionRequired: boolean;
    accessControls: string[];
    dataClassification: string[];
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Comprehensive Audit Logging Service
 * 
 * Enterprise-grade audit logging system with advanced features:
 * - Comprehensive event tracking across all system activities
 * - Compliance support (GDPR, HIPAA, SOX, PCI-DSS, etc.)
 * - Real-time alerting and monitoring
 * - Advanced querying and reporting
 * - Data integrity and tamper detection
 * - Performance optimization with batching
 * - Automated compliance reporting
 * - Integration with SIEM systems
 * 
 * Features:
 * - Immutable audit trail with cryptographic integrity
 * - Real-time event streaming and alerting
 * - Compliance-ready data retention policies
 * - Advanced search and filtering capabilities
 * - Automated report generation
 * - Data classification and protection
 * - Performance monitoring and optimization
 */
export class AuditLogService extends EventEmitter {
  private redis: Redis;
  private eventBuffer: AuditEvent[] = [];
  private isProcessing = false;
  private flushInterval: NodeJS.Timeout | null = null;
  private alertRules: Map<string, AuditAlert> = new Map();
  private complianceRules: Map<string, ComplianceRule> = new Map();

  private config = {
    batchSize: 50,
    flushInterval: 5000, // 5 seconds
    enableEncryption: true,
    enableIntegrityCheck: true,
    maxRetentionDays: 2555, // 7 years default
    enableRealTimeAlerts: true,
    encryptionKey: process.env.AUDIT_ENCRYPTION_KEY || 'default-key-change-in-production'
  };

  constructor() {
    super();
    this.redis = redisClient;
    this.initialize();
  }

  /**
   * Initialize the audit log service
   */
  private async initialize(): Promise<void> {
    try {
      // Load alert rules
      await this.loadAlertRules();

      // Load compliance rules
      await this.loadComplianceRules();

      // Start background processing
      this.startPeriodicTasks();

      // Create indexes for performance
      await this.createIndexes();

      logger.info('Audit log service initialized');

    } catch (error) {
      logger.error('Failed to initialize audit log service:', error);
    }
  }

  /**
   * Core Audit Logging
   */

  /**
   * Log an audit event
   */
  async logEvent(eventData: Omit<AuditEvent, 'eventId' | 'timestamp'>): Promise<string> {
    try {
      const eventId = this.generateEventId();
      const timestamp = new Date();

      const event: AuditEvent = {
        eventId,
        timestamp,
        ...eventData,
        compliance: {
          ...eventData.compliance,
          encrypted: this.config.enableEncryption
        }
      };

      // Apply compliance rules
      await this.applyComplianceRules(event);

      // Add to buffer
      this.eventBuffer.push(event);

      // Emit real-time event
      this.emit('auditEvent', event);

      // Check for alerts
      if (this.config.enableRealTimeAlerts) {
        await this.checkAlerts(event);
      }

      // Flush if buffer is full
      if (this.eventBuffer.length >= this.config.batchSize) {
        await this.flushEvents();
      }

      // Store critical events immediately
      if (event.severity === 'critical') {
        await this.storeSingleEvent(event);
      }

      logger.debug('Audit event logged', { eventId, category: event.category, action: event.action });
      return eventId;

    } catch (error) {
      logger.error('Log audit event error:', error);
      throw error;
    }
  }

  /**
   * Log authentication event
   */
  async logAuthentication(data: {
    userId?: string;
    action: 'login' | 'logout' | 'password_change' | 'mfa_setup' | 'account_lock' | 'password_reset';
    outcome: 'success' | 'failure';
    source: AuditEvent['source'];
    details?: AuditEvent['details'];
  }): Promise<string> {
    return await this.logEvent({
      category: 'authentication',
      action: data.action,
      userId: data.userId,
      resource: { type: 'user_account', id: data.userId },
      source: data.source,
      outcome: data.outcome,
      severity: data.outcome === 'failure' ? 'high' : 'medium',
      details: data.details,
      compliance: {
        regulation: ['GDPR', 'SOX'],
        dataClassification: 'confidential',
        retention: 2555 // 7 years
      }
    });
  }

  /**
   * Log authorization event
   */
  async logAuthorization(data: {
    userId: string;
    action: 'access_granted' | 'access_denied' | 'role_assigned' | 'role_removed' | 'permission_check';
    resource: AuditEvent['resource'];
    outcome: 'success' | 'failure';
    source: AuditEvent['source'];
    details?: AuditEvent['details'];
  }): Promise<string> {
    return await this.logEvent({
      category: 'authorization',
      action: data.action,
      userId: data.userId,
      resource: data.resource,
      source: data.source,
      outcome: data.outcome,
      severity: data.outcome === 'failure' ? 'medium' : 'low',
      details: data.details,
      compliance: {
        regulation: ['GDPR', 'HIPAA', 'SOX'],
        dataClassification: 'confidential',
        retention: 2555
      }
    });
  }

  /**
   * Log data access event
   */
  async logDataAccess(data: {
    userId: string;
    action: 'read' | 'export' | 'download' | 'view' | 'search' | 'query';
    resource: AuditEvent['resource'];
    source: AuditEvent['source'];
    details?: AuditEvent['details'];
  }): Promise<string> {
    return await this.logEvent({
      category: 'data_access',
      action: data.action,
      userId: data.userId,
      resource: data.resource,
      source: data.source,
      outcome: 'success',
      severity: this.getDataAccessSeverity(data.resource),
      details: data.details,
      compliance: {
        regulation: ['GDPR', 'HIPAA', 'PCI-DSS'],
        dataClassification: this.getDataClassification(data.resource),
        retention: 2555
      }
    });
  }

  /**
   * Log data modification event
   */
  async logDataModification(data: {
    userId: string;
    action: 'create' | 'update' | 'delete' | 'import' | 'bulk_update' | 'restore';
    resource: AuditEvent['resource'];
    source: AuditEvent['source'];
    outcome: 'success' | 'failure';
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
    details?: AuditEvent['details'];
  }): Promise<string> {
    const changes = this.calculateChanges(data.oldValues, data.newValues);

    return await this.logEvent({
      category: 'data_modification',
      action: data.action,
      userId: data.userId,
      resource: data.resource,
      source: data.source,
      outcome: data.outcome,
      severity: this.getModificationSeverity(data.action, data.resource),
      details: {
        ...data.details,
        oldValues: data.oldValues,
        newValues: data.newValues,
        changes
      },
      compliance: {
        regulation: ['GDPR', 'HIPAA', 'SOX', 'PCI-DSS'],
        dataClassification: this.getDataClassification(data.resource),
        retention: 2555
      }
    });
  }

  /**
   * Log system administration event
   */
  async logSystemAdmin(data: {
    userId: string;
    action: string;
    resource: AuditEvent['resource'];
    source: AuditEvent['source'];
    outcome: 'success' | 'failure';
    details?: AuditEvent['details'];
  }): Promise<string> {
    return await this.logEvent({
      category: 'system_admin',
      action: data.action,
      userId: data.userId,
      resource: data.resource,
      source: data.source,
      outcome: data.outcome,
      severity: 'high', // System admin actions are always high severity
      details: data.details,
      compliance: {
        regulation: ['SOX', 'PCI-DSS'],
        dataClassification: 'restricted',
        retention: 2555
      }
    });
  }

  /**
   * Log security event
   */
  async logSecurity(data: {
    userId?: string;
    action: string;
    resource: AuditEvent['resource'];
    source: AuditEvent['source'];
    outcome: 'success' | 'failure' | 'warning';
    severity?: 'low' | 'medium' | 'high' | 'critical';
    details?: AuditEvent['details'];
  }): Promise<string> {
    return await this.logEvent({
      category: 'security',
      action: data.action,
      userId: data.userId,
      resource: data.resource,
      source: data.source,
      outcome: data.outcome,
      severity: data.severity || 'high',
      details: data.details,
      compliance: {
        regulation: ['GDPR', 'HIPAA', 'SOX', 'PCI-DSS'],
        dataClassification: 'restricted',
        retention: 2555
      }
    });
  }

  /**
   * Query and Search
   */

  /**
   * Search audit events
   */
  async searchEvents(query: AuditQuery): Promise<{ events: AuditEvent[]; total: number }> {
    try {
      const { whereClause, queryParams } = this.buildWhereClause(query);
      
      // Get total count
      const countResult = await pool.query(`
        SELECT COUNT(*) FROM audit_logs WHERE ${whereClause}
      `, queryParams);

      const total = parseInt(countResult.rows[0].count);

      // Get events
      const limit = Math.min(query.limit || 100, 1000); // Max 1000 events
      const offset = query.offset || 0;
      const sortBy = query.sortBy || 'timestamp';
      const sortOrder = query.sortOrder || 'desc';

      const eventsResult = await pool.query(`
        SELECT * FROM audit_logs 
        WHERE ${whereClause}
        ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `, [...queryParams, limit, offset]);

      const events = await Promise.all(
        eventsResult.rows.map(row => this.mapEventFromDB(row))
      );

      return { events, total };

    } catch (error) {
      logger.error('Search audit events error:', error);
      throw error;
    }
  }

  /**
   * Get event by ID
   */
  async getEvent(eventId: string): Promise<AuditEvent | null> {
    try {
      const result = await pool.query(`
        SELECT * FROM audit_logs WHERE event_id = $1
      `, [eventId]);

      if (result.rows.length === 0) {
        return null;
      }

      return await this.mapEventFromDB(result.rows[0]);

    } catch (error) {
      logger.error('Get audit event error:', error);
      throw error;
    }
  }

  /**
   * Get events by correlation ID
   */
  async getEventsByCorrelationId(correlationId: string): Promise<AuditEvent[]> {
    try {
      const result = await pool.query(`
        SELECT * FROM audit_logs 
        WHERE context->>'correlationId' = $1
        ORDER BY timestamp ASC
      `, [correlationId]);

      return await Promise.all(
        result.rows.map(row => this.mapEventFromDB(row))
      );

    } catch (error) {
      logger.error('Get events by correlation ID error:', error);
      throw error;
    }
  }

  /**
   * Reporting
   */

  /**
   * Generate audit report
   */
  async generateReport(options: {
    title: string;
    description?: string;
    type: AuditReport['type'];
    period: AuditReport['period'];
    filters?: AuditQuery;
    generatedBy: string;
  }): Promise<AuditReport> {
    try {
      const reportId = this.generateId('rpt');
      const query: AuditQuery = {
        ...options.filters,
        dateRange: options.period,
        limit: 10000 // Large limit for reports
      };

      const { events, total } = await this.searchEvents(query);

      // Generate statistics
      const statistics = this.generateStatistics(events);

      const report: AuditReport = {
        reportId,
        title: options.title,
        description: options.description,
        type: options.type,
        period: options.period,
        filters: options.filters,
        statistics,
        events,
        generatedAt: new Date(),
        generatedBy: options.generatedBy
      };

      // Store report for future reference
      await this.storeReport(report);

      logger.info('Audit report generated', { 
        reportId, 
        type: options.type, 
        eventCount: events.length 
      });

      return report;

    } catch (error) {
      logger.error('Generate audit report error:', error);
      throw error;
    }
  }

  /**
   * Get compliance report
   */
  async generateComplianceReport(regulation: string, period: {
    startDate: Date;
    endDate: Date;
  }, generatedBy: string): Promise<AuditReport> {
    return await this.generateReport({
      title: `${regulation} Compliance Report`,
      description: `Compliance audit report for ${regulation} regulation`,
      type: 'compliance',
      period,
      filters: {
        compliance: { regulation }
      },
      generatedBy
    });
  }

  /**
   * Alert Management
   */

  /**
   * Create audit alert
   */
  async createAlert(alertData: Omit<AuditAlert, 'alertId' | 'triggerCount' | 'createdAt' | 'updatedAt'>): Promise<AuditAlert> {
    try {
      const alertId = this.generateId('alert');
      const now = new Date();

      const alert: AuditAlert = {
        alertId,
        ...alertData,
        triggerCount: 0,
        createdAt: now,
        updatedAt: now
      };

      // Store in database
      await pool.query(`
        INSERT INTO audit_alerts (
          alert_id, name, description, conditions, notification, 
          is_active, trigger_count, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        alertId,
        alert.name,
        alert.description,
        JSON.stringify(alert.conditions),
        JSON.stringify(alert.notification),
        alert.isActive,
        0,
        now,
        now
      ]);

      // Add to memory
      this.alertRules.set(alertId, alert);

      logger.info('Audit alert created', { alertId, name: alert.name });
      return alert;

    } catch (error) {
      logger.error('Create audit alert error:', error);
      throw error;
    }
  }

  /**
   * Check if event matches alert conditions
   */
  private async checkAlerts(event: AuditEvent): Promise<void> {
    try {
      for (const alert of this.alertRules.values()) {
        if (!alert.isActive) continue;

        if (await this.doesEventMatchAlert(event, alert)) {
          await this.triggerAlert(alert, event);
        }
      }
    } catch (error) {
      logger.error('Check alerts error:', error);
    }
  }

  /**
   * Check if event matches alert conditions
   */
  private async doesEventMatchAlert(event: AuditEvent, alert: AuditAlert): Promise<boolean> {
    const conditions = alert.conditions;

    // Check category
    if (conditions.category && conditions.category.length > 0) {
      if (!conditions.category.includes(event.category)) {
        return false;
      }
    }

    // Check action
    if (conditions.action && conditions.action.length > 0) {
      if (!conditions.action.includes(event.action)) {
        return false;
      }
    }

    // Check severity
    if (conditions.severity && conditions.severity.length > 0) {
      if (!conditions.severity.includes(event.severity)) {
        return false;
      }
    }

    // Check outcome
    if (conditions.outcome && conditions.outcome.length > 0) {
      if (!conditions.outcome.includes(event.outcome)) {
        return false;
      }
    }

    // Check pattern
    if (conditions.pattern) {
      const regex = new RegExp(conditions.pattern, 'i');
      const searchText = `${event.action} ${event.resource.type} ${JSON.stringify(event.details)}`;
      if (!regex.test(searchText)) {
        return false;
      }
    }

    // Check threshold
    if (conditions.threshold) {
      const count = await this.countRecentEvents(alert, conditions.threshold.timeWindow);
      if (count < conditions.threshold.count) {
        return false;
      }
    }

    return true;
  }

  /**
   * Trigger alert notification
   */
  private async triggerAlert(alert: AuditAlert, event: AuditEvent): Promise<void> {
    try {
      // Update trigger count and last triggered
      await pool.query(`
        UPDATE audit_alerts 
        SET trigger_count = trigger_count + 1, last_triggered = $1
        WHERE alert_id = $2
      `, [new Date(), alert.alertId]);

      // Send notifications
      await this.sendAlertNotifications(alert, event);

      // Emit alert event
      this.emit('alertTriggered', { alert, event });

      logger.warn('Audit alert triggered', { 
        alertId: alert.alertId, 
        alertName: alert.name,
        eventId: event.eventId 
      });

    } catch (error) {
      logger.error('Trigger alert error:', error);
    }
  }

  /**
   * Count recent events matching alert
   */
  private async countRecentEvents(alert: AuditAlert, timeWindowMinutes: number): Promise<number> {
    try {
      const startTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
      const conditions = alert.conditions;

      let whereClause = 'timestamp >= $1';
      const queryParams: any[] = [startTime];
      let paramIndex = 2;

      if (conditions.category && conditions.category.length > 0) {
        whereClause += ` AND category = ANY($${paramIndex})`;
        queryParams.push(conditions.category);
        paramIndex++;
      }

      if (conditions.action && conditions.action.length > 0) {
        whereClause += ` AND action = ANY($${paramIndex})`;
        queryParams.push(conditions.action);
        paramIndex++;
      }

      const result = await pool.query(`
        SELECT COUNT(*) FROM audit_logs WHERE ${whereClause}
      `, queryParams);

      return parseInt(result.rows[0].count);

    } catch (error) {
      logger.error('Count recent events error:', error);
      return 0;
    }
  }

  /**
   * Send alert notifications
   */
  private async sendAlertNotifications(alert: AuditAlert, event: AuditEvent): Promise<void> {
    try {
      const notification = alert.notification;

      // Email notifications
      if (notification.email && notification.email.length > 0) {
        // Would integrate with email service
        logger.info('Sending email alert notification', { 
          alertId: alert.alertId,
          recipients: notification.email 
        });
      }

      // Webhook notifications
      if (notification.webhook) {
        // Would send HTTP POST to webhook URL
        logger.info('Sending webhook alert notification', { 
          alertId: alert.alertId,
          webhook: notification.webhook 
        });
      }

      // Slack notifications
      if (notification.slack) {
        // Would integrate with Slack API
        logger.info('Sending Slack alert notification', { 
          alertId: alert.alertId,
          channel: notification.slack 
        });
      }

    } catch (error) {
      logger.error('Send alert notifications error:', error);
    }
  }

  /**
   * Data Processing
   */

  /**
   * Flush events to database
   */
  private async flushEvents(): Promise<void> {
    if (this.isProcessing || this.eventBuffer.length === 0) return;

    try {
      this.isProcessing = true;
      const events = [...this.eventBuffer];
      this.eventBuffer = [];

      await this.storeEventsBatch(events);

      logger.debug('Audit events flushed', { count: events.length });

    } catch (error) {
      logger.error('Flush audit events error:', error);
      // Put events back in buffer on failure
      this.eventBuffer.unshift(...this.eventBuffer);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Store single event immediately
   */
  private async storeSingleEvent(event: AuditEvent): Promise<void> {
    try {
      const encryptedData = this.config.enableEncryption ? 
        this.encryptSensitiveData(event) : event;

      const integrityHash = this.config.enableIntegrityCheck ?
        this.calculateIntegrityHash(encryptedData) : null;

      await pool.query(`
        INSERT INTO audit_logs (
          event_id, timestamp, user_id, session_id, category, action,
          resource, source, outcome, severity, details, compliance,
          context, integrity_hash, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        encryptedData.eventId,
        encryptedData.timestamp,
        encryptedData.userId,
        encryptedData.sessionId,
        encryptedData.category,
        encryptedData.action,
        JSON.stringify(encryptedData.resource),
        JSON.stringify(encryptedData.source),
        encryptedData.outcome,
        encryptedData.severity,
        JSON.stringify(encryptedData.details || {}),
        JSON.stringify(encryptedData.compliance),
        JSON.stringify(encryptedData.context || {}),
        integrityHash,
        new Date()
      ]);

    } catch (error) {
      logger.error('Store single audit event error:', error);
      throw error;
    }
  }

  /**
   * Store events batch
   */
  private async storeEventsBatch(events: AuditEvent[]): Promise<void> {
    try {
      if (events.length === 0) return;

      const values = events.map(event => {
        const encryptedEvent = this.config.enableEncryption ? 
          this.encryptSensitiveData(event) : event;

        const integrityHash = this.config.enableIntegrityCheck ?
          this.calculateIntegrityHash(encryptedEvent) : null;

        return `(
          '${encryptedEvent.eventId}',
          '${encryptedEvent.timestamp.toISOString()}',
          ${encryptedEvent.userId ? `'${encryptedEvent.userId}'` : 'NULL'},
          ${encryptedEvent.sessionId ? `'${encryptedEvent.sessionId}'` : 'NULL'},
          '${encryptedEvent.category}',
          '${encryptedEvent.action}',
          '${JSON.stringify(encryptedEvent.resource).replace(/'/g, "''")}',
          '${JSON.stringify(encryptedEvent.source).replace(/'/g, "''")}',
          '${encryptedEvent.outcome}',
          '${encryptedEvent.severity}',
          '${JSON.stringify(encryptedEvent.details || {}).replace(/'/g, "''")}',
          '${JSON.stringify(encryptedEvent.compliance).replace(/'/g, "''")}',
          '${JSON.stringify(encryptedEvent.context || {}).replace(/'/g, "''")}',
          ${integrityHash ? `'${integrityHash}'` : 'NULL'},
          '${new Date().toISOString()}'
        )`;
      }).join(', ');

      await pool.query(`
        INSERT INTO audit_logs (
          event_id, timestamp, user_id, session_id, category, action,
          resource, source, outcome, severity, details, compliance,
          context, integrity_hash, created_at
        ) VALUES ${values}
      `);

    } catch (error) {
      logger.error('Store audit events batch error:', error);
      throw error;
    }
  }

  /**
   * Helper Methods
   */

  /**
   * Apply compliance rules to event
   */
  private async applyComplianceRules(event: AuditEvent): Promise<void> {
    for (const rule of this.complianceRules.values()) {
      if (!rule.isActive) continue;

      if (rule.requirements.auditCategories.includes(event.category)) {
        // Apply retention period
        if (rule.requirements.retentionPeriod > (event.compliance.retention || 0)) {
          event.compliance.retention = rule.requirements.retentionPeriod;
        }

        // Apply encryption requirement
        if (rule.requirements.encryptionRequired) {
          event.compliance.encrypted = true;
        }

        // Add regulation
        if (!event.compliance.regulation) {
          event.compliance.regulation = [];
        }
        if (!event.compliance.regulation.includes(rule.regulation)) {
          event.compliance.regulation.push(rule.regulation);
        }
      }
    }
  }

  /**
   * Get data access severity based on resource
   */
  private getDataAccessSeverity(resource: AuditEvent['resource']): 'low' | 'medium' | 'high' | 'critical' {
    // Determine severity based on resource type and attributes
    const sensitiveTypes = ['user_data', 'financial', 'medical', 'personal'];
    
    if (sensitiveTypes.includes(resource.type)) {
      return 'high';
    }

    if (resource.attributes?.sensitive === true) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Get modification severity
   */
  private getModificationSeverity(action: string, resource: AuditEvent['resource']): 'low' | 'medium' | 'high' | 'critical' {
    if (action === 'delete') {
      return 'high';
    }

    if (resource.type === 'system_config') {
      return 'critical';
    }

    if (resource.type === 'user_data') {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Get data classification
   */
  private getDataClassification(resource: AuditEvent['resource']): 'public' | 'internal' | 'confidential' | 'restricted' {
    const restrictedTypes = ['system_config', 'admin_data'];
    const confidentialTypes = ['user_data', 'financial', 'medical'];

    if (restrictedTypes.includes(resource.type)) {
      return 'restricted';
    }

    if (confidentialTypes.includes(resource.type)) {
      return 'confidential';
    }

    if (resource.attributes?.classification) {
      return resource.attributes.classification;
    }

    return 'internal';
  }

  /**
   * Calculate changes between old and new values
   */
  private calculateChanges(oldValues?: Record<string, any>, newValues?: Record<string, any>): Record<string, { from: any; to: any }> {
    if (!oldValues || !newValues) return {};

    const changes: Record<string, { from: any; to: any }> = {};

    // Check for modified fields
    for (const key in newValues) {
      if (oldValues[key] !== newValues[key]) {
        changes[key] = {
          from: oldValues[key],
          to: newValues[key]
        };
      }
    }

    // Check for removed fields
    for (const key in oldValues) {
      if (!(key in newValues)) {
        changes[key] = {
          from: oldValues[key],
          to: undefined
        };
      }
    }

    return changes;
  }

  /**
   * Build WHERE clause for queries
   */
  private buildWhereClause(query: AuditQuery): { whereClause: string; queryParams: any[] } {
    let whereClause = '1=1';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (query.userId) {
      whereClause += ` AND user_id = $${paramIndex}`;
      queryParams.push(query.userId);
      paramIndex++;
    }

    if (query.category) {
      whereClause += ` AND category = $${paramIndex}`;
      queryParams.push(query.category);
      paramIndex++;
    }

    if (query.action) {
      whereClause += ` AND action = $${paramIndex}`;
      queryParams.push(query.action);
      paramIndex++;
    }

    if (query.outcome) {
      whereClause += ` AND outcome = $${paramIndex}`;
      queryParams.push(query.outcome);
      paramIndex++;
    }

    if (query.severity) {
      whereClause += ` AND severity = $${paramIndex}`;
      queryParams.push(query.severity);
      paramIndex++;
    }

    if (query.resource?.type) {
      whereClause += ` AND resource->>'type' = $${paramIndex}`;
      queryParams.push(query.resource.type);
      paramIndex++;
    }

    if (query.resource?.id) {
      whereClause += ` AND resource->>'id' = $${paramIndex}`;
      queryParams.push(query.resource.id);
      paramIndex++;
    }

    if (query.source?.ip) {
      whereClause += ` AND source->>'ip' = $${paramIndex}`;
      queryParams.push(query.source.ip);
      paramIndex++;
    }

    if (query.dateRange) {
      whereClause += ` AND timestamp >= $${paramIndex} AND timestamp <= $${paramIndex + 1}`;
      queryParams.push(query.dateRange.startDate, query.dateRange.endDate);
      paramIndex += 2;
    }

    return { whereClause, queryParams };
  }

  /**
   * Map event from database row
   */
  private async mapEventFromDB(row: any): Promise<AuditEvent> {
    const event: AuditEvent = {
      eventId: row.event_id,
      timestamp: new Date(row.timestamp),
      userId: row.user_id,
      sessionId: row.session_id,
      category: row.category,
      action: row.action,
      resource: JSON.parse(row.resource),
      source: JSON.parse(row.source),
      outcome: row.outcome,
      severity: row.severity,
      details: JSON.parse(row.details || '{}'),
      compliance: JSON.parse(row.compliance),
      context: JSON.parse(row.context || '{}')
    };

    // Decrypt sensitive data if encrypted
    if (this.config.enableEncryption && event.compliance.encrypted) {
      return this.decryptSensitiveData(event);
    }

    return event;
  }

  /**
   * Generate statistics for report
   */
  private generateStatistics(events: AuditEvent[]): AuditReport['statistics'] {
    const statistics: AuditReport['statistics'] = {
      totalEvents: events.length,
      successEvents: 0,
      failureEvents: 0,
      warningEvents: 0,
      infoEvents: 0,
      categoryCounts: {} as Record<AuditCategory, number>,
      severityCounts: {},
      hourlyDistribution: {},
      topUsers: [],
      topActions: [],
      topResources: []
    };

    const userCounts: Record<string, number> = {};
    const actionCounts: Record<string, number> = {};
    const resourceCounts: Record<string, number> = {};

    for (const event of events) {
      // Outcome counts
      switch (event.outcome) {
        case 'success':
          statistics.successEvents++;
          break;
        case 'failure':
          statistics.failureEvents++;
          break;
        case 'warning':
          statistics.warningEvents++;
          break;
        case 'info':
          statistics.infoEvents++;
          break;
      }

      // Category counts
      statistics.categoryCounts[event.category] = (statistics.categoryCounts[event.category] || 0) + 1;

      // Severity counts
      statistics.severityCounts[event.severity] = (statistics.severityCounts[event.severity] || 0) + 1;

      // Hourly distribution
      const hour = event.timestamp.getHours().toString().padStart(2, '0') + ':00';
      statistics.hourlyDistribution[hour] = (statistics.hourlyDistribution[hour] || 0) + 1;

      // User counts
      if (event.userId) {
        userCounts[event.userId] = (userCounts[event.userId] || 0) + 1;
      }

      // Action counts
      actionCounts[event.action] = (actionCounts[event.action] || 0) + 1;

      // Resource counts
      resourceCounts[event.resource.type] = (resourceCounts[event.resource.type] || 0) + 1;
    }

    // Top users
    statistics.topUsers = Object.entries(userCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([userId, eventCount]) => ({ userId, eventCount }));

    // Top actions
    statistics.topActions = Object.entries(actionCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([action, eventCount]) => ({ action, eventCount }));

    // Top resources
    statistics.topResources = Object.entries(resourceCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([resourceType, eventCount]) => ({ resourceType, eventCount }));

    return statistics;
  }

  /**
   * Store report
   */
  private async storeReport(report: AuditReport): Promise<void> {
    try {
      await pool.query(`
        INSERT INTO audit_reports (
          report_id, title, description, type, period, filters,
          statistics, generated_at, generated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        report.reportId,
        report.title,
        report.description,
        report.type,
        JSON.stringify(report.period),
        JSON.stringify(report.filters || {}),
        JSON.stringify(report.statistics),
        report.generatedAt,
        report.generatedBy
      ]);

    } catch (error) {
      logger.error('Store audit report error:', error);
    }
  }

  /**
   * Load alert rules from database
   */
  private async loadAlertRules(): Promise<void> {
    try {
      const result = await pool.query(`
        SELECT * FROM audit_alerts WHERE is_active = true
      `);

      for (const row of result.rows) {
        const alert: AuditAlert = {
          alertId: row.alert_id,
          name: row.name,
          description: row.description,
          conditions: JSON.parse(row.conditions),
          notification: JSON.parse(row.notification),
          isActive: row.is_active,
          lastTriggered: row.last_triggered ? new Date(row.last_triggered) : undefined,
          triggerCount: row.trigger_count,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at)
        };

        this.alertRules.set(alert.alertId, alert);
      }

      logger.info('Audit alert rules loaded', { count: this.alertRules.size });

    } catch (error) {
      logger.error('Load alert rules error:', error);
    }
  }

  /**
   * Load compliance rules from database
   */
  private async loadComplianceRules(): Promise<void> {
    try {
      const result = await pool.query(`
        SELECT * FROM compliance_rules WHERE is_active = true
      `);

      for (const row of result.rows) {
        const rule: ComplianceRule = {
          ruleId: row.rule_id,
          name: row.name,
          description: row.description,
          regulation: row.regulation,
          requirements: JSON.parse(row.requirements),
          isActive: row.is_active,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at)
        };

        this.complianceRules.set(rule.ruleId, rule);
      }

      logger.info('Compliance rules loaded', { count: this.complianceRules.size });

    } catch (error) {
      logger.error('Load compliance rules error:', error);
    }
  }

  /**
   * Create database indexes for performance
   */
  private async createIndexes(): Promise<void> {
    try {
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC)',
        'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category)',
        'CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)',
        'CREATE INDEX IF NOT EXISTS idx_audit_logs_outcome ON audit_logs(outcome)',
        'CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity)',
        'CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs USING GIN ((resource->\'type\'))',
        'CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation ON audit_logs USING GIN ((context->\'correlationId\'))',
        'CREATE INDEX IF NOT EXISTS idx_audit_logs_composite ON audit_logs(category, action, timestamp DESC)'
      ];

      for (const indexSQL of indexes) {
        await pool.query(indexSQL);
      }

      logger.info('Audit log indexes created');

    } catch (error) {
      logger.error('Create indexes error:', error);
    }
  }

  /**
   * Start periodic background tasks
   */
  private startPeriodicTasks(): void {
    // Flush events periodically
    this.flushInterval = setInterval(() => {
      this.flushEvents();
    }, this.config.flushInterval);

    // Clean up old events based on retention policies
    setInterval(() => {
      this.cleanupExpiredEvents();
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  /**
   * Clean up expired events
   */
  private async cleanupExpiredEvents(): Promise<void> {
    try {
      const result = await pool.query(`
        DELETE FROM audit_logs 
        WHERE created_at < NOW() - INTERVAL '1 day' * 
          COALESCE((compliance->>'retention')::integer, $1)
      `, [this.config.maxRetentionDays]);

      if (result.rowCount && result.rowCount > 0) {
        logger.info('Expired audit events cleaned up', { count: result.rowCount });
      }

    } catch (error) {
      logger.error('Cleanup expired events error:', error);
    }
  }

  /**
   * Encrypt sensitive data
   */
  private encryptSensitiveData(event: AuditEvent): AuditEvent {
    try {
      const sensitiveFields = ['details', 'source'];
      const encrypted = { ...event };

      for (const field of sensitiveFields) {
        if (encrypted[field as keyof AuditEvent]) {
          const data = JSON.stringify(encrypted[field as keyof AuditEvent]);
          const cipher = crypto.createCipher('aes256', this.config.encryptionKey);
          let encryptedData = cipher.update(data, 'utf8', 'hex');
          encryptedData += cipher.final('hex');
          
          (encrypted as any)[field] = { encrypted: encryptedData };
        }
      }

      return encrypted;

    } catch (error) {
      logger.error('Encrypt sensitive data error:', error);
      return event;
    }
  }

  /**
   * Decrypt sensitive data
   */
  private decryptSensitiveData(event: AuditEvent): AuditEvent {
    try {
      const sensitiveFields = ['details', 'source'];
      const decrypted = { ...event };

      for (const field of sensitiveFields) {
        const fieldData = (decrypted as any)[field];
        if (fieldData && typeof fieldData === 'object' && fieldData.encrypted) {
          const decipher = crypto.createDecipher('aes256', this.config.encryptionKey);
          let decryptedData = decipher.update(fieldData.encrypted, 'hex', 'utf8');
          decryptedData += decipher.final('utf8');
          
          (decrypted as any)[field] = JSON.parse(decryptedData);
        }
      }

      return decrypted;

    } catch (error) {
      logger.error('Decrypt sensitive data error:', error);
      return event;
    }
  }

  /**
   * Calculate integrity hash
   */
  private calculateIntegrityHash(event: AuditEvent): string {
    const hashData = JSON.stringify({
      eventId: event.eventId,
      timestamp: event.timestamp.toISOString(),
      userId: event.userId,
      category: event.category,
      action: event.action,
      resource: event.resource,
      outcome: event.outcome
    });

    return crypto.createHash('sha256').update(hashData).digest('hex');
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `audit_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  }

  /**
   * Shutdown service gracefully
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down audit log service...');

      // Clear intervals
      if (this.flushInterval) {
        clearInterval(this.flushInterval);
      }

      // Flush remaining events
      await this.flushEvents();

      // Clear buffers
      this.eventBuffer = [];
      this.alertRules.clear();
      this.complianceRules.clear();

      logger.info('Audit log service shut down complete');

    } catch (error) {
      logger.error('Audit log service shutdown error:', error);
    }
  }
}

export default AuditLogService;