/**
 * Unit Tests for FormServiceWithPermissions
 * Created: 2025-01-12
 */

import { Pool } from 'pg';
import { FormServiceWithPermissions } from '../FormServiceWithPermissions';
import { MultiUserServiceManager } from '../MultiUserServiceManager';
import { DynamicFormBuilderError } from '../../types';

// Mock dependencies
jest.mock('../../database');
jest.mock('../MultiUserServiceManager');
jest.mock('../../../services/cachedRepositoryService');
jest.mock('../../../utils/logger');

describe('FormServiceWithPermissions', () => {
  let formService: FormServiceWithPermissions;
  let mockDb: jest.Mocked<Pool>;
  let mockServiceManager: jest.Mocked<MultiUserServiceManager>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock database pool
    mockDb = {
      connect: jest.fn(),
      query: jest.fn(),
    } as any;

    // Mock service manager
    mockServiceManager = {
      permissionService: {
        canView: jest.fn(),
        canEdit: jest.fn(),
        canDelete: jest.fn(),
        enforcePermission: jest.fn(),
        getFormOwner: jest.fn(),
        isFormPublic: jest.fn(),
        getUserAccessibleForms: jest.fn(),
      },
      auditService: {
        logAccess: jest.fn(),
      },
      cloneFormWithAudit: jest.fn(),
    } as any;

    // Mock MultiUserServiceManager.getInstance
    (MultiUserServiceManager.getInstance as jest.Mock).mockReturnValue(mockServiceManager);

    // Create service instance
    formService = new FormServiceWithPermissions();
  });

  describe('getFormById', () => {
    it('should return null when user has no permission to view form', async () => {
      const formId = 'test-form-id';
      const userId = '123';

      // Mock permission service to return false
      mockServiceManager.permissionService.canView.mockResolvedValue(false);

      const result = await formService.getFormById(formId, userId);

      expect(result).toBeNull();
      expect(mockServiceManager.permissionService.canView).toHaveBeenCalledWith(formId, 123);
      expect(mockServiceManager.auditService.logAccess).toHaveBeenCalledWith(
        formId,
        123,
        'view',
        { reason: 'permission_denied' },
        false,
        'No view permission'
      );
    });

    it('should return form when user has permission', async () => {
      const formId = 'test-form-id';
      const userId = '123';

      // Mock permission service to return true
      mockServiceManager.permissionService.canView.mockResolvedValue(true);

      // Mock cached repository
      const mockForm = {
        id: formId,
        name: 'Test Form',
        description: 'Test Description',
        status: 'published',
        ownerId: '456',
        fields: []
      };

      // Mock the cached repository behavior
      const cachedRepositories = require('../../../services/cachedRepositoryService');
      cachedRepositories.cachedRepositories = {
        forms: {
          getById: jest.fn().mockImplementation(async (id, fetcher) => {
            return await fetcher();
          })
        }
      };

      // Mock database query for form
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: formId,
          name: 'Test Form',
          description: 'Test Description',
          status: 'published',
          owner_id: '456',
          full_name: 'Test User',
          email: 'test@example.com'
        }]
      });

      // Mock database query for fields
      mockDb.query.mockResolvedValueOnce({
        rows: []
      });

      const result = await formService.getFormById(formId, userId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(formId);
      expect(result?.name).toBe('Test Form');
      expect(mockServiceManager.auditService.logAccess).toHaveBeenCalledWith(
        formId,
        123,
        'view',
        { form_name: 'Test Form' },
        true
      );
    });
  });

  describe('updateForm', () => {
    it('should enforce edit permission before updating', async () => {
      const formId = 'test-form-id';
      const userId = '123';
      const updateData = { name: 'Updated Form Name' };

      // Mock client
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      mockDb.connect.mockResolvedValue(mockClient as any);

      // Mock permission enforcement to throw error
      mockServiceManager.permissionService.enforcePermission.mockRejectedValue(
        new DynamicFormBuilderError('Access denied', 'ACCESS_DENIED', 403)
      );

      await expect(formService.updateForm(formId, userId, updateData))
        .rejects.toThrow(DynamicFormBuilderError);

      expect(mockServiceManager.permissionService.enforcePermission)
        .toHaveBeenCalledWith(formId, 123, 'edit');
    });

    it('should only allow owners to change visibility', async () => {
      const formId = 'test-form-id';
      const userId = '123';
      const updateData = { visibility: 'public' as const };

      // Mock client
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      mockDb.connect.mockResolvedValue(mockClient as any);

      // Mock permission enforcement to pass
      mockServiceManager.permissionService.enforcePermission.mockResolvedValue(undefined);

      // Mock getFormOwner to return different user (not owner)
      mockServiceManager.permissionService.getFormOwner.mockResolvedValue(456);

      await expect(formService.updateForm(formId, userId, updateData))
        .rejects.toThrow('Only form owners can change visibility');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('deleteForm', () => {
    it('should enforce delete permission before deleting', async () => {
      const formId = 'test-form-id';
      const userId = '123';

      // Mock permission enforcement to throw error
      mockServiceManager.permissionService.enforcePermission.mockRejectedValue(
        new DynamicFormBuilderError('Access denied', 'ACCESS_DENIED', 403)
      );

      await expect(formService.deleteForm(formId, userId))
        .rejects.toThrow(DynamicFormBuilderError);

      expect(mockServiceManager.permissionService.enforcePermission)
        .toHaveBeenCalledWith(formId, 123, 'delete');
    });

    it('should successfully soft delete form with proper permissions', async () => {
      const formId = 'test-form-id';
      const userId = '123';

      // Mock permission enforcement to pass
      mockServiceManager.permissionService.enforcePermission.mockResolvedValue(undefined);

      // Mock database query for soft delete
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });

      await formService.deleteForm(formId, userId, false);

      expect(mockDb.query).toHaveBeenCalledWith(
        'UPDATE forms SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
        [formId]
      );

      expect(mockServiceManager.auditService.logAccess).toHaveBeenCalledWith(
        formId,
        123,
        'delete',
        { permanent: false },
        true
      );
    });
  });

  describe('publishForm', () => {
    it('should enforce edit permission and ownership before publishing', async () => {
      const formId = 'test-form-id';
      const userId = '123';

      // Mock permission enforcement to pass
      mockServiceManager.permissionService.enforcePermission.mockResolvedValue(undefined);

      // Mock getFormOwner to return different user (not owner)
      mockServiceManager.permissionService.getFormOwner.mockResolvedValue(456);

      await expect(formService.publishForm(formId, userId))
        .rejects.toThrow('Only form owners can publish forms');

      expect(mockServiceManager.permissionService.enforcePermission)
        .toHaveBeenCalledWith(formId, 123, 'edit');
    });

    it('should successfully publish form when user is owner', async () => {
      const formId = 'test-form-id';
      const userId = '123';

      // Mock permission enforcement to pass
      mockServiceManager.permissionService.enforcePermission.mockResolvedValue(undefined);

      // Mock getFormOwner to return same user (owner)
      mockServiceManager.permissionService.getFormOwner.mockResolvedValue(123);

      // Mock database query for publish
      mockDb.query.mockResolvedValue({
        rows: [{
          id: formId,
          name: 'Test Form',
          status: 'published',
          owner_id: userId
        }]
      });

      const result = await formService.publishForm(formId, userId, 'Test version note');

      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE forms'), [formId]);
      expect(mockServiceManager.auditService.logAccess).toHaveBeenCalledWith(
        formId,
        123,
        'publish',
        { version_note: 'Test version note' },
        true
      );
    });
  });

  describe('cloneForm', () => {
    it('should delegate to service manager cloneFormWithAudit', async () => {
      const formId = 'test-form-id';
      const userId = '123';
      const newName = 'Cloned Form';

      // Mock cloning result
      mockServiceManager.cloneFormWithAudit.mockResolvedValue({
        success: true,
        cloned_form_id: 'new-form-id'
      });

      // Mock getFormById for the cloned form
      const mockClonedForm = {
        id: 'new-form-id',
        name: newName,
        status: 'draft',
        ownerId: userId
      };

      // Setup the mock chain for getFormById
      const cachedRepositories = require('../../../services/cachedRepositoryService');
      cachedRepositories.cachedRepositories = {
        forms: {
          getById: jest.fn().mockImplementation(async (id, fetcher) => {
            return await fetcher();
          })
        }
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'new-form-id',
          name: newName,
          status: 'draft',
          owner_id: userId
        }]
      });
      mockDb.query.mockResolvedValueOnce({ rows: [] }); // fields query

      // Mock permission check for getFormById
      mockServiceManager.permissionService.canView.mockResolvedValue(true);

      const result = await formService.cloneForm(formId, userId, newName);

      expect(mockServiceManager.cloneFormWithAudit).toHaveBeenCalledWith(
        formId,
        123,
        { new_name: newName }
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('new-form-id');
    });
  });
});