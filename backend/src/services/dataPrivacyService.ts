import { pool } from '../config/database';
import { logger } from '../utils/logger';
import Redis from 'ioredis';
import redisClient from '../config/redis';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import { AuditLogService } from './auditLogService';

// Types and interfaces
export interface DataSubject {
  subjectId: string;
  type: 'user' | 'employee' | 'customer' | 'prospect' | 'contact';
  identifiers: {
    email?: string;
    phone?: string;
    userId?: string;
    externalId?: string;
    customIds?: Record<string, string>;
  };
  personalData: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: Date;
    address?: any;
    nationality?: string;
    metadata?: Record<string, any>;
  };
  consent: {
    processing: boolean;
    marketing: boolean;
    analytics: boolean;
    sharing: boolean;
    lastUpdated: Date;
    consentSource: string;
    ipAddress?: string;
    userAgent?: string;
  };
  preferences: {
    language?: string;
    timezone?: string;
    communication?: {
      email: boolean;
      sms: boolean;
      push: boolean;
      phone: boolean;
    };
  };
  legalBasis: {
    processing: 'consent' | 'contract' | 'legal_obligation' | 'vital_interests' | 'public_task' | 'legitimate_interests';
    purpose: string;
    retention: {
      period: number; // days
      reason: string;
    };
  };
  status: 'active' | 'suspended' | 'deleted' | 'anonymized';
  createdAt: Date;
  updatedAt: Date;
}

export interface DataProcessingActivity {
  activityId: string;
  name: string;
  description?: string;
  controller: {
    name: string;
    contact: string;
    representative?: string;
  };
  processor?: {
    name: string;
    contact: string;
    country?: string;
  };
  categories: {
    dataSubjects: string[];
    personalData: string[];
    recipients: string[];
  };
  purposes: string[];
  legalBasis: string[];
  retention: {
    period: number; // days
    criteria: string;
  };
  technicalMeasures: string[];
  organisationalMeasures: string[];
  transfers: {
    countries?: string[];
    safeguards?: string[];
    adequacyDecision?: boolean;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrivacyRequest {
  requestId: string;
  type: 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction' | 'objection' | 'consent_withdrawal';
  status: 'received' | 'processing' | 'completed' | 'rejected' | 'partially_completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  subjectId: string;
  requestData: {
    description: string;
    scope?: string[];
    specificData?: string[];
    reason?: string;
    evidence?: string[];
  };
  source: {
    channel: 'web' | 'email' | 'phone' | 'letter' | 'in_person';
    reference?: string;
    verificationMethod?: string;
  };
  processing: {
    assignedTo?: string;
    estimatedCompletion?: Date;
    actualCompletion?: Date;
    notes?: string[];
    actions: Array<{
      action: string;
      timestamp: Date;
      performedBy: string;
      details?: any;
    }>;
  };
  response: {
    decision: 'granted' | 'denied' | 'partial' | 'pending';
    reason?: string;
    deliveryMethod?: 'email' | 'post' | 'secure_portal' | 'in_person';
    deliveredAt?: Date;
    attachments?: string[];
  };
  deadlines: {
    response: Date; // 30 days for GDPR
    completion?: Date;
    extension?: {
      granted: boolean;
      reason?: string;
      newDeadline?: Date;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ConsentRecord {
  consentId: string;
  subjectId: string;
  purposes: string[];
  granularity: {
    processing: boolean;
    marketing: boolean;
    analytics: boolean;
    sharing: boolean;
    profiling: boolean;
    automated_decision: boolean;
  };
  legalBasis: 'consent' | 'legitimate_interest' | 'contract' | 'legal_obligation';
  method: 'explicit' | 'implicit' | 'opt_in' | 'opt_out';
  evidence: {
    timestamp: Date;
    ipAddress?: string;
    userAgent?: string;
    formData?: Record<string, any>;
    doubleOptIn?: {
      emailSent: Date;
      emailConfirmed?: Date;
      confirmationToken: string;
    };
  };
  status: 'active' | 'withdrawn' | 'expired' | 'superseded';
  withdrawal?: {
    timestamp: Date;
    method: string;
    reason?: string;
    ipAddress?: string;
  };
  expiry?: {
    date: Date;
    autoRenew: boolean;
    renewalPeriod?: number; // days
  };
  version: number;
  parentConsentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataBreach {
  breachId: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  classification: 'confidentiality' | 'integrity' | 'availability' | 'combination';
  discovery: {
    discoveredAt: Date;
    discoveredBy: string;
    detectionMethod: 'automated' | 'manual' | 'reported' | 'audit';
  };
  incident: {
    occurredAt?: Date;
    duration?: number; // minutes
    scope: {
      affectedSubjects: number;
      dataCategories: string[];
      geographicScope: string[];
    };
    cause: 'human_error' | 'system_failure' | 'cyber_attack' | 'unauthorized_access' | 'other';
    causeDetails?: string;
  };
  assessment: {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    riskFactors: string[];
    likelyConsequences: string[];
    mitigatingFactors?: string[];
  };
  notifications: {
    authority: {
      required: boolean;
      sent?: Date;
      reference?: string;
      deadline: Date;
    };
    subjects: {
      required: boolean;
      sent?: Date;
      method?: string[];
      deadline?: Date;
    };
  };
  remediation: {
    immediateActions: string[];
    longTermActions: string[];
    responsibleParty: string;
    timeline: Date;
    status: 'planned' | 'in_progress' | 'completed';
  };
  status: 'open' | 'investigating' | 'contained' | 'resolved' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceReport {
  reportId: string;
  type: 'gdpr' | 'ccpa' | 'hipaa' | 'pipeda' | 'lgpd' | 'pdpa';
  period: {
    startDate: Date;
    endDate: Date;
  };
  summary: {
    dataSubjects: number;
    activeConsents: number;
    withdrawnConsents: number;
    privacyRequests: number;
    completedRequests: number;
    dataBreaches: number;
    complianceScore: number; // 0-100
  };
  details: {
    processingActivities: DataProcessingActivity[];
    consentMetrics: {
      consentRate: number;
      withdrawalRate: number;
      renewalRate: number;
    };
    requestMetrics: {
      averageResponseTime: number; // hours
      completionRate: number;
      requestsByType: Record<string, number>;
    };
    breachMetrics: {
      totalBreaches: number;
      averageResolutionTime: number; // hours
      breachesByCategory: Record<string, number>;
    };
    complianceIssues: Array<{
      issue: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      recommendation: string;
    }>;
  };
  generatedAt: Date;
  generatedBy: string;
}

/**
 * Comprehensive Data Privacy Compliance Service
 * 
 * Enterprise-grade privacy management system supporting multiple regulations:
 * - GDPR (General Data Protection Regulation)
 * - CCPA (California Consumer Privacy Act)
 * - HIPAA (Health Insurance Portability and Accountability Act)
 * - PIPEDA (Personal Information Protection and Electronic Documents Act)
 * - LGPD (Brazilian General Data Protection Law)
 * - PDPA (Singapore Personal Data Protection Act)
 * 
 * Features:
 * - Complete data subject management
 * - Automated consent tracking and management
 * - Privacy request processing workflow
 * - Data breach incident management
 * - Compliance reporting and monitoring
 * - Data retention and deletion automation
 * - Cross-border transfer compliance
 * - Integration with audit logging
 */
export class DataPrivacyService extends EventEmitter {
  private redis: Redis;
  private auditService: AuditLogService;

  constructor(auditService: AuditLogService) {
    super();
    this.redis = redisClient;
    this.auditService = auditService;
    this.initialize();
  }

  /**
   * Initialize the service
   */
  private async initialize(): Promise<void> {
    try {
      // Create database indexes
      await this.createIndexes();

      // Start periodic tasks
      this.startPeriodicTasks();

      logger.info('Data privacy service initialized');

    } catch (error) {
      logger.error('Failed to initialize data privacy service:', error);
    }
  }

  /**
   * Data Subject Management
   */

  /**
   * Register a new data subject
   */
  async registerDataSubject(subjectData: Omit<DataSubject, 'subjectId' | 'status' | 'createdAt' | 'updatedAt'>): Promise<DataSubject> {
    try {
      const subjectId = this.generateId('ds');
      const now = new Date();

      const subject: DataSubject = {
        subjectId,
        ...subjectData,
        status: 'active',
        createdAt: now,
        updatedAt: now
      };

      await pool.query(`
        INSERT INTO data_subjects (
          subject_id, type, identifiers, personal_data, consent,
          preferences, legal_basis, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        subject.subjectId,
        subject.type,
        JSON.stringify(subject.identifiers),
        JSON.stringify(subject.personalData),
        JSON.stringify(subject.consent),
        JSON.stringify(subject.preferences),
        JSON.stringify(subject.legalBasis),
        subject.status,
        subject.createdAt,
        subject.updatedAt
      ]);

      // Log audit event
      await this.auditService.logDataAccess({
        userId: 'system',
        action: 'register_data_subject',
        resource: {
          type: 'data_subject',
          id: subjectId,
          attributes: { type: subject.type }
        },
        source: { application: 'privacy_service' },
        details: {
          description: 'New data subject registered',
          metadata: { type: subject.type }
        }
      });

      logger.info('Data subject registered', { subjectId, type: subject.type });
      return subject;

    } catch (error) {
      logger.error('Register data subject error:', error);
      throw error;
    }
  }

  /**
   * Get data subject by ID
   */
  async getDataSubject(subjectId: string): Promise<DataSubject | null> {
    try {
      const result = await pool.query(`
        SELECT * FROM data_subjects WHERE subject_id = $1
      `, [subjectId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDataSubjectFromDB(result.rows[0]);

    } catch (error) {
      logger.error('Get data subject error:', error);
      throw error;
    }
  }

  /**
   * Find data subject by identifiers
   */
  async findDataSubject(identifiers: Partial<DataSubject['identifiers']>): Promise<DataSubject | null> {
    try {
      let whereClause = '1=1';
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (identifiers.email) {
        whereClause += ` AND identifiers->>'email' = $${paramIndex}`;
        queryParams.push(identifiers.email);
        paramIndex++;
      }

      if (identifiers.phone) {
        whereClause += ` AND identifiers->>'phone' = $${paramIndex}`;
        queryParams.push(identifiers.phone);
        paramIndex++;
      }

      if (identifiers.userId) {
        whereClause += ` AND identifiers->>'userId' = $${paramIndex}`;
        queryParams.push(identifiers.userId);
        paramIndex++;
      }

      const result = await pool.query(`
        SELECT * FROM data_subjects WHERE ${whereClause} LIMIT 1
      `, queryParams);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDataSubjectFromDB(result.rows[0]);

    } catch (error) {
      logger.error('Find data subject error:', error);
      throw error;
    }
  }

  /**
   * Update data subject
   */
  async updateDataSubject(subjectId: string, updates: Partial<Pick<DataSubject, 'personalData' | 'preferences' | 'consent' | 'legalBasis'>>): Promise<DataSubject | null> {
    try {
      const updateFields: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (updates.personalData !== undefined) {
        updateFields.push(`personal_data = $${paramIndex}`);
        queryParams.push(JSON.stringify(updates.personalData));
        paramIndex++;
      }

      if (updates.preferences !== undefined) {
        updateFields.push(`preferences = $${paramIndex}`);
        queryParams.push(JSON.stringify(updates.preferences));
        paramIndex++;
      }

      if (updates.consent !== undefined) {
        updateFields.push(`consent = $${paramIndex}`);
        queryParams.push(JSON.stringify(updates.consent));
        paramIndex++;
      }

      if (updates.legalBasis !== undefined) {
        updateFields.push(`legal_basis = $${paramIndex}`);
        queryParams.push(JSON.stringify(updates.legalBasis));
        paramIndex++;
      }

      if (updateFields.length === 0) {
        return await this.getDataSubject(subjectId);
      }

      updateFields.push(`updated_at = $${paramIndex}`);
      queryParams.push(new Date());
      paramIndex++;

      queryParams.push(subjectId);

      const result = await pool.query(`
        UPDATE data_subjects 
        SET ${updateFields.join(', ')}
        WHERE subject_id = $${paramIndex}
        RETURNING *
      `, queryParams);

      if (result.rows.length === 0) {
        return null;
      }

      const subject = this.mapDataSubjectFromDB(result.rows[0]);

      // Log audit event
      await this.auditService.logDataModification({
        userId: 'system',
        action: 'update',
        resource: {
          type: 'data_subject',
          id: subjectId
        },
        source: { application: 'privacy_service' },
        outcome: 'success',
        newValues: updates,
        details: {
          description: 'Data subject updated'
        }
      });

      return subject;

    } catch (error) {
      logger.error('Update data subject error:', error);
      throw error;
    }
  }

  /**
   * Consent Management
   */

  /**
   * Record consent
   */
  async recordConsent(consentData: Omit<ConsentRecord, 'consentId' | 'status' | 'version' | 'createdAt' | 'updatedAt'>): Promise<ConsentRecord> {
    try {
      const consentId = this.generateId('consent');
      const now = new Date();

      // Find existing active consent to supersede
      const existingResult = await pool.query(`
        SELECT consent_id FROM consent_records 
        WHERE subject_id = $1 AND status = 'active'
        ORDER BY version DESC LIMIT 1
      `, [consentData.subjectId]);

      let version = 1;
      if (existingResult.rows.length > 0) {
        // Supersede existing consent
        await pool.query(`
          UPDATE consent_records 
          SET status = 'superseded', updated_at = $1
          WHERE consent_id = $2
        `, [now, existingResult.rows[0].consent_id]);

        // Get next version number
        const versionResult = await pool.query(`
          SELECT MAX(version) as max_version FROM consent_records 
          WHERE subject_id = $1
        `, [consentData.subjectId]);

        version = (versionResult.rows[0].max_version || 0) + 1;
      }

      const consent: ConsentRecord = {
        consentId,
        ...consentData,
        status: 'active',
        version,
        createdAt: now,
        updatedAt: now
      };

      await pool.query(`
        INSERT INTO consent_records (
          consent_id, subject_id, purposes, granularity, legal_basis,
          method, evidence, status, version, parent_consent_id, 
          expiry, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        consent.consentId,
        consent.subjectId,
        JSON.stringify(consent.purposes),
        JSON.stringify(consent.granularity),
        consent.legalBasis,
        consent.method,
        JSON.stringify(consent.evidence),
        consent.status,
        consent.version,
        consent.parentConsentId,
        JSON.stringify(consent.expiry || {}),
        consent.createdAt,
        consent.updatedAt
      ]);

      // Update data subject consent status
      await this.updateDataSubjectConsent(consentData.subjectId, consent.granularity);

      // Log audit event
      await this.auditService.logDataModification({
        userId: 'system',
        action: 'record_consent',
        resource: {
          type: 'consent',
          id: consentId,
          attributes: { subjectId: consentData.subjectId }
        },
        source: { application: 'privacy_service' },
        outcome: 'success',
        details: {
          description: 'Consent recorded',
          metadata: { 
            purposes: consent.purposes,
            method: consent.method 
          }
        }
      });

      logger.info('Consent recorded', { consentId, subjectId: consentData.subjectId });
      return consent;

    } catch (error) {
      logger.error('Record consent error:', error);
      throw error;
    }
  }

  /**
   * Withdraw consent
   */
  async withdrawConsent(subjectId: string, withdrawalData: {
    method: string;
    reason?: string;
    ipAddress?: string;
    purposes?: string[];
  }): Promise<boolean> {
    try {
      const now = new Date();

      // Get active consent
      const consentResult = await pool.query(`
        SELECT * FROM consent_records 
        WHERE subject_id = $1 AND status = 'active'
        ORDER BY version DESC LIMIT 1
      `, [subjectId]);

      if (consentResult.rows.length === 0) {
        return false;
      }

      const consent = consentResult.rows[0];

      // Update consent status
      await pool.query(`
        UPDATE consent_records 
        SET status = 'withdrawn', 
            withdrawal = $1,
            updated_at = $2
        WHERE consent_id = $3
      `, [
        JSON.stringify({
          timestamp: now,
          method: withdrawalData.method,
          reason: withdrawalData.reason,
          ipAddress: withdrawalData.ipAddress
        }),
        now,
        consent.consent_id
      ]);

      // Update data subject consent status
      const revokedGranularity = {
        processing: false,
        marketing: false,
        analytics: false,
        sharing: false,
        profiling: false,
        automated_decision: false
      };

      await this.updateDataSubjectConsent(subjectId, revokedGranularity);

      // Log audit event
      await this.auditService.logDataModification({
        userId: 'system',
        action: 'withdraw_consent',
        resource: {
          type: 'consent',
          id: consent.consent_id,
          attributes: { subjectId }
        },
        source: { application: 'privacy_service' },
        outcome: 'success',
        details: {
          description: 'Consent withdrawn',
          metadata: { 
            method: withdrawalData.method,
            reason: withdrawalData.reason 
          }
        }
      });

      logger.info('Consent withdrawn', { subjectId, method: withdrawalData.method });
      return true;

    } catch (error) {
      logger.error('Withdraw consent error:', error);
      throw error;
    }
  }

  /**
   * Privacy Request Processing
   */

  /**
   * Create privacy request
   */
  async createPrivacyRequest(requestData: Omit<PrivacyRequest, 'requestId' | 'status' | 'processing' | 'response' | 'createdAt' | 'updatedAt'>): Promise<PrivacyRequest> {
    try {
      const requestId = this.generateId('pr');
      const now = new Date();

      // Calculate deadline (30 days for GDPR)
      const responseDeadline = new Date(now);
      responseDeadline.setDate(responseDeadline.getDate() + 30);

      const request: PrivacyRequest = {
        requestId,
        ...requestData,
        status: 'received',
        processing: {
          actions: [{
            action: 'request_received',
            timestamp: now,
            performedBy: 'system',
            details: { source: requestData.source.channel }
          }]
        },
        response: {
          decision: 'pending'
        },
        deadlines: {
          response: responseDeadline
        },
        createdAt: now,
        updatedAt: now
      };

      await pool.query(`
        INSERT INTO privacy_requests (
          request_id, type, status, priority, subject_id, request_data,
          source, processing, response, deadlines, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        request.requestId,
        request.type,
        request.status,
        request.priority,
        request.subjectId,
        JSON.stringify(request.requestData),
        JSON.stringify(request.source),
        JSON.stringify(request.processing),
        JSON.stringify(request.response),
        JSON.stringify(request.deadlines),
        request.createdAt,
        request.updatedAt
      ]);

      // Log audit event
      await this.auditService.logDataAccess({
        userId: 'system',
        action: 'create_privacy_request',
        resource: {
          type: 'privacy_request',
          id: requestId,
          attributes: { 
            type: request.type,
            subjectId: request.subjectId 
          }
        },
        source: { application: 'privacy_service' },
        details: {
          description: 'Privacy request created',
          metadata: { 
            type: request.type,
            priority: request.priority 
          }
        }
      });

      // Emit event for notifications
      this.emit('privacyRequestCreated', request);

      logger.info('Privacy request created', { 
        requestId, 
        type: request.type, 
        subjectId: request.subjectId 
      });

      return request;

    } catch (error) {
      logger.error('Create privacy request error:', error);
      throw error;
    }
  }

  /**
   * Process privacy request
   */
  async processPrivacyRequest(requestId: string, processing: {
    assignedTo: string;
    estimatedCompletion?: Date;
    notes?: string;
  }): Promise<PrivacyRequest | null> {
    try {
      const request = await this.getPrivacyRequest(requestId);
      if (!request) return null;

      const now = new Date();
      const updatedProcessing = {
        ...request.processing,
        assignedTo: processing.assignedTo,
        estimatedCompletion: processing.estimatedCompletion,
        notes: request.processing.notes ? 
          [...request.processing.notes, ...(processing.notes ? [processing.notes] : [])] :
          (processing.notes ? [processing.notes] : []),
        actions: [
          ...request.processing.actions,
          {
            action: 'assigned_for_processing',
            timestamp: now,
            performedBy: processing.assignedTo,
            details: processing
          }
        ]
      };

      await pool.query(`
        UPDATE privacy_requests 
        SET status = 'processing',
            processing = $1,
            updated_at = $2
        WHERE request_id = $3
      `, [JSON.stringify(updatedProcessing), now, requestId]);

      // Log audit event
      await this.auditService.logDataModification({
        userId: processing.assignedTo,
        action: 'process_privacy_request',
        resource: {
          type: 'privacy_request',
          id: requestId
        },
        source: { application: 'privacy_service' },
        outcome: 'success',
        details: {
          description: 'Privacy request processing started',
          metadata: processing
        }
      });

      return await this.getPrivacyRequest(requestId);

    } catch (error) {
      logger.error('Process privacy request error:', error);
      throw error;
    }
  }

  /**
   * Complete privacy request
   */
  async completePrivacyRequest(requestId: string, completion: {
    performedBy: string;
    decision: 'granted' | 'denied' | 'partial';
    reason?: string;
    deliveryMethod?: string;
    attachments?: string[];
    notes?: string;
  }): Promise<PrivacyRequest | null> {
    try {
      const request = await this.getPrivacyRequest(requestId);
      if (!request) return null;

      const now = new Date();
      
      const updatedProcessing = {
        ...request.processing,
        actualCompletion: now,
        notes: request.processing.notes ? 
          [...request.processing.notes, ...(completion.notes ? [completion.notes] : [])] :
          (completion.notes ? [completion.notes] : []),
        actions: [
          ...request.processing.actions,
          {
            action: 'request_completed',
            timestamp: now,
            performedBy: completion.performedBy,
            details: completion
          }
        ]
      };

      const response = {
        decision: completion.decision,
        reason: completion.reason,
        deliveryMethod: completion.deliveryMethod,
        deliveredAt: now,
        attachments: completion.attachments
      };

      await pool.query(`
        UPDATE privacy_requests 
        SET status = 'completed',
            processing = $1,
            response = $2,
            updated_at = $3
        WHERE request_id = $4
      `, [
        JSON.stringify(updatedProcessing), 
        JSON.stringify(response), 
        now, 
        requestId
      ]);

      // Execute the request based on type
      await this.executePrivacyRequest(request, completion);

      // Log audit event
      await this.auditService.logDataModification({
        userId: completion.performedBy,
        action: 'complete_privacy_request',
        resource: {
          type: 'privacy_request',
          id: requestId
        },
        source: { application: 'privacy_service' },
        outcome: 'success',
        details: {
          description: 'Privacy request completed',
          metadata: completion
        }
      });

      // Emit event for notifications
      this.emit('privacyRequestCompleted', { 
        request, 
        completion 
      });

      logger.info('Privacy request completed', { 
        requestId, 
        decision: completion.decision 
      });

      return await this.getPrivacyRequest(requestId);

    } catch (error) {
      logger.error('Complete privacy request error:', error);
      throw error;
    }
  }

  /**
   * Get privacy request
   */
  async getPrivacyRequest(requestId: string): Promise<PrivacyRequest | null> {
    try {
      const result = await pool.query(`
        SELECT * FROM privacy_requests WHERE request_id = $1
      `, [requestId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapPrivacyRequestFromDB(result.rows[0]);

    } catch (error) {
      logger.error('Get privacy request error:', error);
      throw error;
    }
  }

  /**
   * Data Breach Management
   */

  /**
   * Report data breach
   */
  async reportDataBreach(breachData: Omit<DataBreach, 'breachId' | 'status' | 'createdAt' | 'updatedAt'>): Promise<DataBreach> {
    try {
      const breachId = this.generateId('breach');
      const now = new Date();

      // Calculate notification deadlines
      const authorityDeadline = new Date(breachData.discovery.discoveredAt);
      authorityDeadline.setHours(authorityDeadline.getHours() + 72); // 72 hours for GDPR

      const breach: DataBreach = {
        breachId,
        ...breachData,
        notifications: {
          ...breachData.notifications,
          authority: {
            ...breachData.notifications.authority,
            deadline: authorityDeadline
          }
        },
        status: 'open',
        createdAt: now,
        updatedAt: now
      };

      await pool.query(`
        INSERT INTO data_breaches (
          breach_id, title, description, severity, classification,
          discovery, incident, assessment, notifications, remediation,
          status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        breach.breachId,
        breach.title,
        breach.description,
        breach.severity,
        breach.classification,
        JSON.stringify(breach.discovery),
        JSON.stringify(breach.incident),
        JSON.stringify(breach.assessment),
        JSON.stringify(breach.notifications),
        JSON.stringify(breach.remediation),
        breach.status,
        breach.createdAt,
        breach.updatedAt
      ]);

      // Log critical security event
      await this.auditService.logSecurity({
        userId: breachData.discovery.discoveredBy,
        action: 'data_breach_reported',
        resource: {
          type: 'data_breach',
          id: breachId,
          attributes: { 
            severity: breach.severity,
            affectedSubjects: breach.incident.scope.affectedSubjects 
          }
        },
        source: { application: 'privacy_service' },
        outcome: 'warning',
        severity: 'critical',
        details: {
          description: 'Data breach reported',
          metadata: {
            title: breach.title,
            severity: breach.severity,
            affectedSubjects: breach.incident.scope.affectedSubjects
          }
        }
      });

      // Emit critical event
      this.emit('dataBreachReported', breach);

      logger.error('Data breach reported', { 
        breachId, 
        severity: breach.severity,
        affectedSubjects: breach.incident.scope.affectedSubjects 
      });

      return breach;

    } catch (error) {
      logger.error('Report data breach error:', error);
      throw error;
    }
  }

  /**
   * Compliance Reporting
   */

  /**
   * Generate compliance report
   */
  async generateComplianceReport(type: ComplianceReport['type'], period: {
    startDate: Date;
    endDate: Date;
  }, generatedBy: string): Promise<ComplianceReport> {
    try {
      const reportId = this.generateId('cr');

      // Get data subjects count
      const subjectsResult = await pool.query(`
        SELECT COUNT(*) as count FROM data_subjects 
        WHERE created_at >= $1 AND created_at <= $2
      `, [period.startDate, period.endDate]);

      // Get consent metrics
      const consentResult = await pool.query(`
        SELECT 
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_consents,
          COUNT(CASE WHEN status = 'withdrawn' THEN 1 END) as withdrawn_consents
        FROM consent_records 
        WHERE created_at >= $1 AND created_at <= $2
      `, [period.startDate, period.endDate]);

      // Get privacy request metrics
      const requestResult = await pool.query(`
        SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_requests,
          AVG(CASE WHEN status = 'completed' 
            THEN EXTRACT(EPOCH FROM (updated_at - created_at))/3600 
            ELSE NULL END) as avg_response_time
        FROM privacy_requests 
        WHERE created_at >= $1 AND created_at <= $2
      `, [period.startDate, period.endDate]);

      // Get breach metrics
      const breachResult = await pool.query(`
        SELECT COUNT(*) as count FROM data_breaches 
        WHERE created_at >= $1 AND created_at <= $2
      `, [period.startDate, period.endDate]);

      // Calculate compliance score (simplified)
      const completionRate = requestResult.rows[0].total_requests > 0 ?
        (requestResult.rows[0].completed_requests / requestResult.rows[0].total_requests) * 100 : 100;
      
      const avgResponseTime = parseFloat(requestResult.rows[0].avg_response_time || '0');
      const responseTimeScore = avgResponseTime <= 24 ? 100 : Math.max(0, 100 - (avgResponseTime - 24) * 2);
      
      const breachScore = breachResult.rows[0].count === 0 ? 100 : 
        Math.max(0, 100 - breachResult.rows[0].count * 10);
      
      const complianceScore = Math.round((completionRate + responseTimeScore + breachScore) / 3);

      const report: ComplianceReport = {
        reportId,
        type,
        period,
        summary: {
          dataSubjects: parseInt(subjectsResult.rows[0].count),
          activeConsents: parseInt(consentResult.rows[0].active_consents || '0'),
          withdrawnConsents: parseInt(consentResult.rows[0].withdrawn_consents || '0'),
          privacyRequests: parseInt(requestResult.rows[0].total_requests || '0'),
          completedRequests: parseInt(requestResult.rows[0].completed_requests || '0'),
          dataBreaches: parseInt(breachResult.rows[0].count),
          complianceScore
        },
        details: {
          processingActivities: await this.getProcessingActivities(),
          consentMetrics: {
            consentRate: 0, // Would calculate from actual data
            withdrawalRate: 0,
            renewalRate: 0
          },
          requestMetrics: {
            averageResponseTime: avgResponseTime,
            completionRate,
            requestsByType: {} // Would calculate from actual data
          },
          breachMetrics: {
            totalBreaches: parseInt(breachResult.rows[0].count),
            averageResolutionTime: 0, // Would calculate from actual data
            breachesByCategory: {}
          },
          complianceIssues: await this.identifyComplianceIssues()
        },
        generatedAt: new Date(),
        generatedBy
      };

      // Store report
      await this.storeComplianceReport(report);

      logger.info('Compliance report generated', { 
        reportId, 
        type, 
        complianceScore 
      });

      return report;

    } catch (error) {
      logger.error('Generate compliance report error:', error);
      throw error;
    }
  }

  /**
   * Helper Methods
   */

  /**
   * Execute privacy request actions
   */
  private async executePrivacyRequest(request: PrivacyRequest, completion: any): Promise<void> {
    try {
      switch (request.type) {
        case 'erasure':
          if (completion.decision === 'granted') {
            await this.eraseDataSubjectData(request.subjectId);
          }
          break;

        case 'consent_withdrawal':
          if (completion.decision === 'granted') {
            await this.withdrawConsent(request.subjectId, {
              method: 'privacy_request',
              reason: 'Subject request'
            });
          }
          break;

        case 'portability':
          if (completion.decision === 'granted') {
            await this.exportDataSubjectData(request.subjectId);
          }
          break;

        // Other request types would be handled here
      }

    } catch (error) {
      logger.error('Execute privacy request error:', error);
    }
  }

  /**
   * Erase data subject data
   */
  private async eraseDataSubjectData(subjectId: string): Promise<void> {
    try {
      // Anonymize rather than delete to maintain referential integrity
      await pool.query(`
        UPDATE data_subjects 
        SET status = 'anonymized',
            identifiers = '{}',
            personal_data = '{}',
            updated_at = $1
        WHERE subject_id = $2
      `, [new Date(), subjectId]);

      logger.info('Data subject data erased', { subjectId });

    } catch (error) {
      logger.error('Erase data subject data error:', error);
      throw error;
    }
  }

  /**
   * Export data subject data
   */
  private async exportDataSubjectData(subjectId: string): Promise<any> {
    try {
      const subject = await this.getDataSubject(subjectId);
      if (!subject) return null;

      // Get all related data
      const consentResult = await pool.query(`
        SELECT * FROM consent_records WHERE subject_id = $1
      `, [subjectId]);

      const requestResult = await pool.query(`
        SELECT * FROM privacy_requests WHERE subject_id = $1
      `, [subjectId]);

      const exportData = {
        subject,
        consents: consentResult.rows,
        privacyRequests: requestResult.rows,
        exportedAt: new Date()
      };

      // In a real implementation, this would be saved to a secure location
      // and provided to the data subject

      return exportData;

    } catch (error) {
      logger.error('Export data subject data error:', error);
      throw error;
    }
  }

  /**
   * Update data subject consent status
   */
  private async updateDataSubjectConsent(subjectId: string, granularity: ConsentRecord['granularity']): Promise<void> {
    try {
      await pool.query(`
        UPDATE data_subjects 
        SET consent = consent || jsonb_build_object(
          'processing', $1,
          'marketing', $2,
          'analytics', $3,
          'sharing', $4,
          'lastUpdated', $5
        ),
        updated_at = $6
        WHERE subject_id = $7
      `, [
        granularity.processing,
        granularity.marketing,
        granularity.analytics,
        granularity.sharing,
        new Date().toISOString(),
        new Date(),
        subjectId
      ]);

    } catch (error) {
      logger.error('Update data subject consent error:', error);
    }
  }

  /**
   * Get processing activities
   */
  private async getProcessingActivities(): Promise<DataProcessingActivity[]> {
    try {
      const result = await pool.query(`
        SELECT * FROM data_processing_activities WHERE is_active = true
      `);

      return result.rows.map(row => ({
        activityId: row.activity_id,
        name: row.name,
        description: row.description,
        controller: JSON.parse(row.controller),
        processor: row.processor ? JSON.parse(row.processor) : undefined,
        categories: JSON.parse(row.categories),
        purposes: JSON.parse(row.purposes),
        legalBasis: JSON.parse(row.legal_basis),
        retention: JSON.parse(row.retention),
        technicalMeasures: JSON.parse(row.technical_measures),
        organisationalMeasures: JSON.parse(row.organisational_measures),
        transfers: JSON.parse(row.transfers),
        isActive: row.is_active,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));

    } catch (error) {
      logger.error('Get processing activities error:', error);
      return [];
    }
  }

  /**
   * Identify compliance issues
   */
  private async identifyComplianceIssues(): Promise<Array<{
    issue: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    recommendation: string;
  }>> {
    const issues = [];

    try {
      // Check for overdue privacy requests
      const overdueResult = await pool.query(`
        SELECT COUNT(*) as count FROM privacy_requests 
        WHERE status IN ('received', 'processing') 
        AND deadlines->>'response' < $1
      `, [new Date().toISOString()]);

      if (parseInt(overdueResult.rows[0].count) > 0) {
        issues.push({
          issue: `${overdueResult.rows[0].count} overdue privacy requests`,
          severity: 'high' as const,
          recommendation: 'Process overdue requests immediately to avoid regulatory penalties'
        });
      }

      // Check for expired consents
      const expiredConsentResult = await pool.query(`
        SELECT COUNT(*) as count FROM consent_records 
        WHERE status = 'active' 
        AND expiry->>'date' < $1
      `, [new Date().toISOString()]);

      if (parseInt(expiredConsentResult.rows[0].count) > 0) {
        issues.push({
          issue: `${expiredConsentResult.rows[0].count} expired consents`,
          severity: 'medium' as const,
          recommendation: 'Review and renew expired consents or cease processing'
        });
      }

      // Check for unresolved breaches
      const openBreachResult = await pool.query(`
        SELECT COUNT(*) as count FROM data_breaches 
        WHERE status IN ('open', 'investigating')
      `);

      if (parseInt(openBreachResult.rows[0].count) > 0) {
        issues.push({
          issue: `${openBreachResult.rows[0].count} unresolved data breaches`,
          severity: 'critical' as const,
          recommendation: 'Complete breach investigation and remediation immediately'
        });
      }

      return issues;

    } catch (error) {
      logger.error('Identify compliance issues error:', error);
      return issues;
    }
  }

  /**
   * Store compliance report
   */
  private async storeComplianceReport(report: ComplianceReport): Promise<void> {
    try {
      await pool.query(`
        INSERT INTO compliance_reports (
          report_id, type, period, summary, details, 
          generated_at, generated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        report.reportId,
        report.type,
        JSON.stringify(report.period),
        JSON.stringify(report.summary),
        JSON.stringify(report.details),
        report.generatedAt,
        report.generatedBy
      ]);

    } catch (error) {
      logger.error('Store compliance report error:', error);
    }
  }

  /**
   * Database mapping methods
   */
  private mapDataSubjectFromDB(row: any): DataSubject {
    return {
      subjectId: row.subject_id,
      type: row.type,
      identifiers: JSON.parse(row.identifiers),
      personalData: JSON.parse(row.personal_data),
      consent: JSON.parse(row.consent),
      preferences: JSON.parse(row.preferences),
      legalBasis: JSON.parse(row.legal_basis),
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapPrivacyRequestFromDB(row: any): PrivacyRequest {
    return {
      requestId: row.request_id,
      type: row.type,
      status: row.status,
      priority: row.priority,
      subjectId: row.subject_id,
      requestData: JSON.parse(row.request_data),
      source: JSON.parse(row.source),
      processing: JSON.parse(row.processing),
      response: JSON.parse(row.response),
      deadlines: JSON.parse(row.deadlines),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Create database indexes
   */
  private async createIndexes(): Promise<void> {
    try {
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_data_subjects_identifiers ON data_subjects USING GIN (identifiers)',
        'CREATE INDEX IF NOT EXISTS idx_data_subjects_type ON data_subjects(type)',
        'CREATE INDEX IF NOT EXISTS idx_data_subjects_status ON data_subjects(status)',
        'CREATE INDEX IF NOT EXISTS idx_consent_records_subject_id ON consent_records(subject_id)',
        'CREATE INDEX IF NOT EXISTS idx_consent_records_status ON consent_records(status)',
        'CREATE INDEX IF NOT EXISTS idx_privacy_requests_subject_id ON privacy_requests(subject_id)',
        'CREATE INDEX IF NOT EXISTS idx_privacy_requests_status ON privacy_requests(status)',
        'CREATE INDEX IF NOT EXISTS idx_privacy_requests_type ON privacy_requests(type)',
        'CREATE INDEX IF NOT EXISTS idx_privacy_requests_deadline ON privacy_requests((deadlines->>\'response\'))',
        'CREATE INDEX IF NOT EXISTS idx_data_breaches_status ON data_breaches(status)',
        'CREATE INDEX IF NOT EXISTS idx_data_breaches_severity ON data_breaches(severity)'
      ];

      for (const indexSQL of indexes) {
        await pool.query(indexSQL);
      }

      logger.info('Data privacy indexes created');

    } catch (error) {
      logger.error('Create data privacy indexes error:', error);
    }
  }

  /**
   * Start periodic tasks
   */
  private startPeriodicTasks(): void {
    // Check for overdue requests daily
    setInterval(() => {
      this.checkOverdueRequests();
    }, 24 * 60 * 60 * 1000);

    // Check for expired consents daily
    setInterval(() => {
      this.checkExpiredConsents();
    }, 24 * 60 * 60 * 1000);

    // Data retention cleanup weekly
    setInterval(() => {
      this.performDataRetentionCleanup();
    }, 7 * 24 * 60 * 60 * 1000);
  }

  /**
   * Check for overdue requests
   */
  private async checkOverdueRequests(): Promise<void> {
    try {
      const result = await pool.query(`
        SELECT * FROM privacy_requests 
        WHERE status IN ('received', 'processing') 
        AND deadlines->>'response' < $1
      `, [new Date().toISOString()]);

      for (const row of result.rows) {
        const request = this.mapPrivacyRequestFromDB(row);
        
        // Emit overdue event
        this.emit('privacyRequestOverdue', request);
        
        logger.warn('Privacy request overdue', { 
          requestId: request.requestId,
          daysOverdue: Math.ceil(
            (new Date().getTime() - request.deadlines.response.getTime()) / (24 * 60 * 60 * 1000)
          )
        });
      }

    } catch (error) {
      logger.error('Check overdue requests error:', error);
    }
  }

  /**
   * Check for expired consents
   */
  private async checkExpiredConsents(): Promise<void> {
    try {
      const result = await pool.query(`
        SELECT * FROM consent_records 
        WHERE status = 'active' 
        AND expiry->>'date' IS NOT NULL
        AND expiry->>'date' < $1
      `, [new Date().toISOString()]);

      for (const row of result.rows) {
        // Mark consent as expired
        await pool.query(`
          UPDATE consent_records 
          SET status = 'expired', updated_at = $1
          WHERE consent_id = $2
        `, [new Date(), row.consent_id]);

        // Emit expired event
        this.emit('consentExpired', {
          consentId: row.consent_id,
          subjectId: row.subject_id
        });

        logger.info('Consent expired', { 
          consentId: row.consent_id,
          subjectId: row.subject_id 
        });
      }

    } catch (error) {
      logger.error('Check expired consents error:', error);
    }
  }

  /**
   * Perform data retention cleanup
   */
  private async performDataRetentionCleanup(): Promise<void> {
    try {
      // This would implement complex data retention logic
      // based on legal basis and retention periods
      logger.info('Data retention cleanup completed');

    } catch (error) {
      logger.error('Data retention cleanup error:', error);
    }
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
      logger.info('Shutting down data privacy service...');

      // No cleanup needed for this service

      logger.info('Data privacy service shut down complete');

    } catch (error) {
      logger.error('Data privacy service shutdown error:', error);
    }
  }
}

export default DataPrivacyService;