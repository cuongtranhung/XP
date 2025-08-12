/**
 * Unit Tests for MultiUserServiceManager
 * Created: 2025-01-12
 */

import { Pool } from 'pg';
import { MultiUserServiceManager } from '../MultiUserServiceManager';
import { FormSharingService } from '../FormSharingService';
import { FormPermissionService } from '../FormPermissionService';
import { FormCloneService } from '../FormCloneService';
import { FormAuditService } from '../FormAuditService';

// Mock dependencies
jest.mock('../FormSharingService');
jest.mock('../FormPermissionService');
jest.mock('../FormCloneService');
jest.mock('../FormAuditService');
jest.mock('../../../utils/logger');

describe('MultiUserServiceManager', () => {
  let mockDb: jest.Mocked<Pool>;
  let serviceManager: MultiUserServiceManager;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock database pool
    mockDb = {
      connect: jest.fn(),
      query: jest.fn(),
    } as any;

    // Get fresh instance
    serviceManager = MultiUserServiceManager.getInstance(mockDb);
  });

  afterEach(() => {
    // Reset singleton instance
    (MultiUserServiceManager as any).instance = null;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = MultiUserServiceManager.getInstance(mockDb);
      const instance2 = MultiUserServiceManager.getInstance(mockDb);
      
      expect(instance1).toBe(instance2);
    });

    it('should have initialized all services', () => {
      expect(serviceManager.sharingService).toBeInstanceOf(FormSharingService);
      expect(serviceManager.permissionService).toBeInstanceOf(FormPermissionService);
      expect(serviceManager.cloneService).toBeInstanceOf(FormCloneService);
      expect(serviceManager.auditService).toBeInstanceOf(FormAuditService);
    });
  });

  describe('shareFormWithAudit', () => {
    it('should delegate to sharing service and log audit', async () => {
      const formId = 'test-form-id';
      const sharedWithUserId = 123;
      const sharedByUserId = 456;
      const permissionLevel = 'edit';
      const expiresAt = new Date();
      const notes = 'Test sharing';
      const context = { ip: '127.0.0.1', userAgent: 'test', sessionId: 'session123' };

      // Mock sharing service response
      const mockShareResult = {
        success: true,
        share_id: 'share-123',
        form_id: formId,
        shared_with_user_id: sharedWithUserId,
        permission_level: permissionLevel
      };

      const mockSharingService = serviceManager.sharingService as jest.Mocked<FormSharingService>;
      mockSharingService.shareForm.mockResolvedValue(mockShareResult);

      const mockAuditService = serviceManager.auditService as jest.Mocked<FormAuditService>;
      mockAuditService.logAccess.mockResolvedValue(undefined);

      const result = await serviceManager.shareFormWithAudit(
        formId,
        sharedWithUserId,
        sharedByUserId,
        permissionLevel,
        expiresAt,
        notes,
        context
      );

      expect(result).toEqual(mockShareResult);

      expect(mockSharingService.shareForm).toHaveBeenCalledWith(
        formId,
        sharedWithUserId,
        sharedByUserId,
        permissionLevel,
        expiresAt,
        notes
      );

      expect(mockAuditService.logAccess).toHaveBeenCalledWith(
        formId,
        sharedByUserId,
        'share',
        {
          action: 'share_form',
          shared_with_user_id: sharedWithUserId,
          permission_level: permissionLevel,
          share_id: 'share-123'
        },
        true,
        undefined,
        context
      );
    });

    it('should handle sharing failure and log audit', async () => {
      const formId = 'test-form-id';
      const sharedWithUserId = 123;
      const sharedByUserId = 456;

      const mockError = new Error('Sharing failed');
      const mockSharingService = serviceManager.sharingService as jest.Mocked<FormSharingService>;
      mockSharingService.shareForm.mockRejectedValue(mockError);

      const mockAuditService = serviceManager.auditService as jest.Mocked<FormAuditService>;
      mockAuditService.logAccess.mockResolvedValue(undefined);

      await expect(serviceManager.shareFormWithAudit(formId, sharedWithUserId, sharedByUserId, 'view'))
        .rejects.toThrow('Sharing failed');

      expect(mockAuditService.logAccess).toHaveBeenCalledWith(
        formId,
        sharedByUserId,
        'share',
        {
          action: 'share_form',
          shared_with_user_id: sharedWithUserId,
          permission_level: 'view'
        },
        false,
        'Sharing failed'
      );
    });
  });

  describe('cloneFormWithAudit', () => {
    it('should delegate to clone service and log audit', async () => {
      const formId = 'test-form-id';
      const userId = 123;
      const options = { new_name: 'Cloned Form' };
      const context = { ip: '127.0.0.1' };

      // Mock clone service response
      const mockCloneResult = {
        success: true,
        cloned_form_id: 'new-form-id',
        original_form_id: formId
      };

      const mockCloneService = serviceManager.cloneService as jest.Mocked<FormCloneService>;
      mockCloneService.cloneForm.mockResolvedValue(mockCloneResult);

      const mockAuditService = serviceManager.auditService as jest.Mocked<FormAuditService>;
      mockAuditService.logAccess.mockResolvedValue(undefined);

      const result = await serviceManager.cloneFormWithAudit(formId, userId, options, context);

      expect(result).toEqual(mockCloneResult);

      expect(mockCloneService.cloneForm).toHaveBeenCalledWith(formId, userId, options);

      expect(mockAuditService.logAccess).toHaveBeenCalledWith(
        formId,
        userId,
        'clone',
        {
          action: 'clone_form',
          cloned_form_id: 'new-form-id',
          options
        },
        true,
        undefined,
        context
      );
    });

    it('should handle cloning failure and log audit', async () => {
      const formId = 'test-form-id';
      const userId = 123;
      const options = { new_name: 'Failed Clone' };

      const mockError = new Error('Cloning failed');
      const mockCloneService = serviceManager.cloneService as jest.Mocked<FormCloneService>;
      mockCloneService.cloneForm.mockRejectedValue(mockError);

      const mockAuditService = serviceManager.auditService as jest.Mocked<FormAuditService>;
      mockAuditService.logAccess.mockResolvedValue(undefined);

      await expect(serviceManager.cloneFormWithAudit(formId, userId, options))
        .rejects.toThrow('Cloning failed');

      expect(mockAuditService.logAccess).toHaveBeenCalledWith(
        formId,
        userId,
        'clone',
        {
          action: 'clone_form',
          options
        },
        false,
        'Cloning failed'
      );
    });
  });

  describe('generateComprehensiveAuditReport', () => {
    it('should delegate to audit service', async () => {
      const formId = 'test-form-id';
      const requesterId = 123;
      const dateFrom = '2025-01-01';
      const dateTo = '2025-01-31';

      const mockReport = {
        form_id: formId,
        report_generated_by: requesterId,
        total_events: 150,
        events_by_type: { view: 100, edit: 30, share: 20 }
      };

      const mockAuditService = serviceManager.auditService as jest.Mocked<FormAuditService>;
      mockAuditService.generateComprehensiveReport.mockResolvedValue(mockReport);

      const result = await serviceManager.generateComprehensiveAuditReport(
        formId,
        requesterId,
        dateFrom,
        dateTo
      );

      expect(result).toEqual(mockReport);
      expect(mockAuditService.generateComprehensiveReport).toHaveBeenCalledWith(
        formId,
        requesterId,
        dateFrom,
        dateTo
      );
    });
  });

  describe('getServiceHealth', () => {
    it('should return health status of all services', async () => {
      // Mock service health responses
      const mockSharingService = serviceManager.sharingService as jest.Mocked<FormSharingService>;
      const mockPermissionService = serviceManager.permissionService as jest.Mocked<FormPermissionService>;
      const mockCloneService = serviceManager.cloneService as jest.Mocked<FormCloneService>;
      const mockAuditService = serviceManager.auditService as jest.Mocked<FormAuditService>;

      mockSharingService.getHealthStatus = jest.fn().mockResolvedValue({ 
        status: 'healthy', 
        active_shares: 25 
      });
      mockPermissionService.getHealthStatus = jest.fn().mockResolvedValue({ 
        status: 'healthy', 
        cache_size: 150 
      });
      mockCloneService.getHealthStatus = jest.fn().mockResolvedValue({ 
        status: 'healthy', 
        total_clones: 42 
      });
      mockAuditService.getHealthStatus = jest.fn().mockResolvedValue({ 
        status: 'healthy', 
        pending_logs: 5 
      });

      // Mock database health check
      mockDb.query.mockResolvedValue({ rows: [{ now: new Date().toISOString() }] });

      const health = await serviceManager.getServiceHealth();

      expect(health).toEqual({
        overall_status: 'healthy',
        services: {
          sharing: { status: 'healthy', active_shares: 25 },
          permission: { status: 'healthy', cache_size: 150 },
          clone: { status: 'healthy', total_clones: 42 },
          audit: { status: 'healthy', pending_logs: 5 }
        },
        database: { status: 'healthy', response_time_ms: expect.any(Number) },
        last_check: expect.any(String)
      });
    });

    it('should handle database connection failure', async () => {
      // Mock database failure
      mockDb.query.mockRejectedValue(new Error('Connection failed'));

      // Mock service health responses
      const mockSharingService = serviceManager.sharingService as jest.Mocked<FormSharingService>;
      const mockPermissionService = serviceManager.permissionService as jest.Mocked<FormPermissionService>;
      const mockCloneService = serviceManager.cloneService as jest.Mocked<FormCloneService>;
      const mockAuditService = serviceManager.auditService as jest.Mocked<FormAuditService>;

      mockSharingService.getHealthStatus = jest.fn().mockResolvedValue({ status: 'healthy' });
      mockPermissionService.getHealthStatus = jest.fn().mockResolvedValue({ status: 'healthy' });
      mockCloneService.getHealthStatus = jest.fn().mockResolvedValue({ status: 'healthy' });
      mockAuditService.getHealthStatus = jest.fn().mockResolvedValue({ status: 'healthy' });

      const health = await serviceManager.getServiceHealth();

      expect(health.overall_status).toBe('degraded');
      expect(health.database.status).toBe('unhealthy');
      expect(health.database.error).toBe('Connection failed');
    });
  });

  describe('performCleanup', () => {
    it('should perform cleanup on all services', async () => {
      const mockSharingService = serviceManager.sharingService as jest.Mocked<FormSharingService>;
      const mockAuditService = serviceManager.auditService as jest.Mocked<FormAuditService>;

      mockSharingService.cleanupExpiredShares = jest.fn().mockResolvedValue({ removed: 5 });
      mockAuditService.cleanupOldLogs = jest.fn().mockResolvedValue({ removed: 1000 });

      const result = await serviceManager.performCleanup();

      expect(result).toEqual({
        sharing: { removed: 5 },
        audit: { removed: 1000 }
      });

      expect(mockSharingService.cleanupExpiredShares).toHaveBeenCalled();
      expect(mockAuditService.cleanupOldLogs).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle service initialization failures gracefully', () => {
      // Mock one service to throw during construction
      const originalFormSharingService = FormSharingService;
      (FormSharingService as any) = jest.fn(() => {
        throw new Error('Service initialization failed');
      });

      expect(() => {
        MultiUserServiceManager.getInstance(mockDb);
      }).not.toThrow();

      // Restore original constructor
      (FormSharingService as any) = originalFormSharingService;
    });
  });
});