/**
 * Unit Tests for SubmissionServiceWithPermissions
 * Created: 2025-01-12
 */

import { Pool } from 'pg';
import { SubmissionServiceWithPermissions } from '../SubmissionServiceWithPermissions';
import { MultiUserServiceManager } from '../MultiUserServiceManager';
import { FormServiceWithPermissions } from '../FormServiceWithPermissions';
import { DynamicFormBuilderError } from '../../types';

// Mock dependencies
jest.mock('../database');
jest.mock('../MultiUserServiceManager');
jest.mock('../FormServiceWithPermissions');
jest.mock('../../../services/cachedRepositoryService');
jest.mock('../../../utils/logger');

describe('SubmissionServiceWithPermissions', () => {
  let submissionService: SubmissionServiceWithPermissions;
  let mockDb: jest.Mocked<Pool>;
  let mockServiceManager: jest.Mocked<MultiUserServiceManager>;
  let mockFormService: jest.Mocked<FormServiceWithPermissions>;

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
        canSubmit: jest.fn(),
        canEdit: jest.fn(),
        canDelete: jest.fn(),
        isFormPublic: jest.fn(),
        hasPermissionLevel: jest.fn(),
      },
      auditService: {
        logAccess: jest.fn(),
      },
    } as any;

    // Mock form service
    mockFormService = {
      getFormById: jest.fn(),
    } as any;

    // Mock MultiUserServiceManager.getInstance
    (MultiUserServiceManager.getInstance as jest.Mock).mockReturnValue(mockServiceManager);

    // Create service instance
    submissionService = new SubmissionServiceWithPermissions();
  });

  describe('createSubmission', () => {
    it('should check submit permission for authenticated users', async () => {
      const formId = 'test-form-id';
      const submitterId = '123';
      const submissionData = { data: { field1: 'value1' } };

      // Mock client
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      mockDb.connect.mockResolvedValue(mockClient as any);

      // Mock permission service to deny submit
      mockServiceManager.permissionService.canSubmit.mockResolvedValue(false);

      await expect(submissionService.createSubmission(formId, submissionData, submitterId))
        .rejects.toThrow('You do not have permission to submit to this form');

      expect(mockServiceManager.permissionService.canSubmit).toHaveBeenCalledWith(formId, 123);
      expect(mockServiceManager.auditService.logAccess).toHaveBeenCalledWith(
        formId,
        123,
        'submit',
        { reason: 'no_submit_permission' },
        false,
        'User does not have submit permission'
      );

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should check if form is public for anonymous users', async () => {
      const formId = 'test-form-id';
      const submissionData = { data: { field1: 'value1' } };

      // Mock client
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      mockDb.connect.mockResolvedValue(mockClient as any);

      // Mock form is not public
      mockServiceManager.permissionService.isFormPublic.mockResolvedValue(false);

      await expect(submissionService.createSubmission(formId, submissionData))
        .rejects.toThrow('This form does not allow anonymous submissions');

      expect(mockServiceManager.permissionService.isFormPublic).toHaveBeenCalledWith(formId);
      expect(mockServiceManager.auditService.logAccess).toHaveBeenCalledWith(
        formId,
        null,
        'submit',
        { reason: 'form_not_public' },
        false,
        'Anonymous submission not allowed on private form'
      );
    });

    it('should successfully create submission with proper permissions', async () => {
      const formId = 'test-form-id';
      const submitterId = '123';
      const submissionData = { data: { field1: 'value1' } };

      // Mock client
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      mockDb.connect.mockResolvedValue(mockClient as any);

      // Mock permission service to allow submit
      mockServiceManager.permissionService.canSubmit.mockResolvedValue(true);

      // Mock form service to return valid form
      mockFormService.getFormById.mockResolvedValue({
        id: formId,
        name: 'Test Form',
        status: 'published',
        ownerId: '456'
      } as any);

      // Mock database queries
      mockClient.query.mockResolvedValueOnce(undefined); // BEGIN
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // form fields query
      mockClient.query.mockResolvedValueOnce({ // submission insert
        rows: [{
          id: 'submission-id',
          form_id: formId,
          status: 'submitted',
          submission_data: JSON.stringify(submissionData.data),
          created_at: new Date().toISOString()
        }]
      });
      mockClient.query.mockResolvedValueOnce(undefined); // COMMIT

      const result = await submissionService.createSubmission(formId, submissionData, submitterId);

      expect(result).toBeDefined();
      expect(result.id).toBe('submission-id');
      expect(result.formId).toBe(formId);

      expect(mockServiceManager.auditService.logAccess).toHaveBeenCalledWith(
        formId,
        123,
        'submit',
        expect.objectContaining({
          submission_id: 'submission-id',
          status: 'submitted'
        }),
        true,
        undefined,
        expect.any(Object)
      );
    });
  });

  describe('getSubmissionById', () => {
    it('should return null when user has no view permission', async () => {
      const submissionId = 'test-submission-id';
      const userId = '123';

      // Mock database query for submission
      mockDb.query.mockResolvedValue({
        rows: [{
          id: submissionId,
          form_id: 'test-form-id',
          submitter_id: '456', // Different user
        }]
      });

      // Mock permission service to deny view
      mockServiceManager.permissionService.canView.mockResolvedValue(false);

      const result = await submissionService.getSubmissionById(submissionId, userId);

      expect(result).toBeNull();
      expect(mockServiceManager.auditService.logAccess).toHaveBeenCalledWith(
        'test-form-id',
        123,
        'view',
        expect.objectContaining({
          reason: 'no_view_permission',
          submission_id: submissionId
        }),
        false,
        'No permission to view submission'
      );
    });

    it('should return submission when user can view own submission', async () => {
      const submissionId = 'test-submission-id';
      const userId = '123';

      // Mock database query for submission
      mockDb.query.mockResolvedValue({
        rows: [{
          id: submissionId,
          form_id: 'test-form-id',
          submitter_id: userId, // Same user (own submission)
          submission_data: '{"field1": "value1"}',
          created_at: new Date().toISOString()
        }]
      });

      // Mock permission service to deny view (but user owns submission)
      mockServiceManager.permissionService.canView.mockResolvedValue(false);

      const result = await submissionService.getSubmissionById(submissionId, userId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(submissionId);
      expect(mockServiceManager.auditService.logAccess).toHaveBeenCalledWith(
        'test-form-id',
        123,
        'view',
        expect.objectContaining({
          submission_id: submissionId,
          context: 'submission_view'
        }),
        true
      );
    });
  });

  describe('listSubmissions', () => {
    it('should enforce view permission before listing submissions', async () => {
      const formId = 'test-form-id';
      const userId = '123';

      // Mock permission service to deny view
      mockServiceManager.permissionService.canView.mockResolvedValue(false);

      await expect(submissionService.listSubmissions(formId, userId))
        .rejects.toThrow('You do not have permission to view submissions for this form');

      expect(mockServiceManager.auditService.logAccess).toHaveBeenCalledWith(
        formId,
        123,
        'view',
        expect.objectContaining({
          reason: 'no_view_permission',
          context: 'submissions_list'
        }),
        false,
        'No permission to view form submissions'
      );
    });

    it('should restrict non-owners to their own submissions', async () => {
      const formId = 'test-form-id';
      const userId = '123';

      // Mock permission service to allow view
      mockServiceManager.permissionService.canView.mockResolvedValue(true);

      // Mock form service to return form with different owner
      mockFormService.getFormById.mockResolvedValue({
        id: formId,
        name: 'Test Form',
        ownerId: '456' // Different owner
      } as any);

      // Mock hasPermissionLevel to return false (not admin)
      mockServiceManager.permissionService.hasPermissionLevel.mockResolvedValue(false);

      // Mock database queries
      mockDb.query.mockResolvedValueOnce({ rows: [{ total: '0' }] }); // count query
      mockDb.query.mockResolvedValueOnce({ rows: [] }); // main query

      await submissionService.listSubmissions(formId, userId);

      // Verify that query includes restriction to user's own submissions
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('s.submitter_id = $'),
        expect.arrayContaining([userId])
      );
    });

    it('should allow owners to see all submissions', async () => {
      const formId = 'test-form-id';
      const userId = '123';

      // Mock permission service to allow view
      mockServiceManager.permissionService.canView.mockResolvedValue(true);

      // Mock form service to return form with same owner
      mockFormService.getFormById.mockResolvedValue({
        id: formId,
        name: 'Test Form',
        ownerId: userId // Same owner
      } as any);

      // Mock database queries
      mockDb.query.mockResolvedValueOnce({ rows: [{ total: '5' }] }); // count query
      mockDb.query.mockResolvedValueOnce({ rows: [] }); // main query

      await submissionService.listSubmissions(formId, userId);

      // Verify that query does NOT include restriction to user's own submissions
      const countQuery = mockDb.query.mock.calls[0][0];
      const mainQuery = mockDb.query.mock.calls[1][0];
      
      expect(countQuery).not.toContain('s.submitter_id =');
      expect(mainQuery).not.toContain('s.submitter_id =');
    });
  });

  describe('updateSubmission', () => {
    it('should require authentication', async () => {
      const submissionId = 'test-submission-id';
      const updateData = { data: { field1: 'new value' } };

      await expect(submissionService.updateSubmission(submissionId, updateData))
        .rejects.toThrow('Authentication required');
    });

    it('should check edit permissions before updating', async () => {
      const submissionId = 'test-submission-id';
      const userId = '123';
      const updateData = { data: { field1: 'new value' } };

      // Mock getSubmissionById to return submission
      const mockSubmission = {
        id: submissionId,
        formId: 'test-form-id',
        submitterId: '456', // Different user
        status: 'submitted'
      };

      // Setup spy on getSubmissionById
      jest.spyOn(submissionService, 'getSubmissionById').mockResolvedValue(mockSubmission as any);

      // Mock permission service to deny edit
      mockServiceManager.permissionService.canEdit.mockResolvedValue(false);

      await expect(submissionService.updateSubmission(submissionId, updateData, userId))
        .rejects.toThrow('Access denied');

      expect(mockServiceManager.auditService.logAccess).toHaveBeenCalledWith(
        'test-form-id',
        123,
        'edit',
        expect.objectContaining({
          reason: 'no_edit_permission',
          submission_id: submissionId
        }),
        false,
        'No permission to update submission'
      );
    });

    it('should allow users to edit their own submissions', async () => {
      const submissionId = 'test-submission-id';
      const userId = '123';
      const updateData = { data: { field1: 'new value' } };

      // Mock getSubmissionById to return user's own submission
      const mockSubmission = {
        id: submissionId,
        formId: 'test-form-id',
        submitterId: userId, // Same user
        status: 'draft'
      };

      // Setup spy on getSubmissionById
      jest.spyOn(submissionService, 'getSubmissionById').mockResolvedValue(mockSubmission as any);

      // Mock permission service to deny edit (but user owns submission)
      mockServiceManager.permissionService.canEdit.mockResolvedValue(false);

      // Mock database query
      mockDb.query.mockResolvedValue({
        rows: [{
          id: submissionId,
          form_id: 'test-form-id',
          submission_data: JSON.stringify(updateData.data),
          updated_at: new Date().toISOString()
        }]
      });

      const result = await submissionService.updateSubmission(submissionId, updateData, userId);

      expect(result).toBeDefined();
      expect(mockServiceManager.auditService.logAccess).toHaveBeenCalledWith(
        'test-form-id',
        123,
        'edit',
        expect.objectContaining({
          submission_id: submissionId,
          context: 'submission_update',
          is_own_submission: true
        }),
        true
      );
    });
  });

  describe('deleteSubmission', () => {
    it('should check delete permissions', async () => {
      const submissionId = 'test-submission-id';
      const userId = '123';

      // Mock getSubmissionById to return submission
      const mockSubmission = {
        id: submissionId,
        formId: 'test-form-id',
        submitterId: '456' // Different user
      };

      // Setup spy on getSubmissionById
      jest.spyOn(submissionService, 'getSubmissionById').mockResolvedValue(mockSubmission as any);

      // Mock permission service to deny delete
      mockServiceManager.permissionService.canDelete.mockResolvedValue(false);

      await expect(submissionService.deleteSubmission(submissionId, userId))
        .rejects.toThrow('Access denied');

      expect(mockServiceManager.auditService.logAccess).toHaveBeenCalledWith(
        'test-form-id',
        123,
        'delete',
        expect.objectContaining({
          reason: 'no_delete_permission',
          submission_id: submissionId
        }),
        false,
        'No permission to delete submission'
      );
    });

    it('should allow users to delete their own submissions', async () => {
      const submissionId = 'test-submission-id';
      const userId = '123';

      // Mock getSubmissionById to return user's own submission
      const mockSubmission = {
        id: submissionId,
        formId: 'test-form-id',
        submitterId: userId // Same user
      };

      // Setup spy on getSubmissionById
      jest.spyOn(submissionService, 'getSubmissionById').mockResolvedValue(mockSubmission as any);

      // Mock permission service to deny delete (but user owns submission)
      mockServiceManager.permissionService.canDelete.mockResolvedValue(false);

      // Mock database delete
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });

      await submissionService.deleteSubmission(submissionId, userId);

      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM form_submissions WHERE id = $1',
        [submissionId]
      );

      expect(mockServiceManager.auditService.logAccess).toHaveBeenCalledWith(
        'test-form-id',
        123,
        'delete',
        expect.objectContaining({
          submission_id: submissionId,
          is_own_submission: true
        }),
        true
      );
    });
  });

  describe('exportSubmissions', () => {
    it('should require edit permission for export', async () => {
      const formId = 'test-form-id';
      const userId = '123';

      // Mock permission service to deny edit
      mockServiceManager.permissionService.canEdit.mockResolvedValue(false);

      await expect(submissionService.exportSubmissions(formId, userId))
        .rejects.toThrow('You do not have permission to export submissions');

      expect(mockServiceManager.auditService.logAccess).toHaveBeenCalledWith(
        formId,
        123,
        'export',
        expect.objectContaining({
          reason: 'no_export_permission',
          context: 'submissions_export'
        }),
        false,
        'No permission to export submissions'
      );
    });
  });

  describe('batchUpdateStatus', () => {
    it('should require edit permission for batch updates', async () => {
      const formId = 'test-form-id';
      const submissionIds = ['sub1', 'sub2'];
      const status = 'completed';
      const userId = '123';

      // Mock permission service to deny edit
      mockServiceManager.permissionService.canEdit.mockResolvedValue(false);

      await expect(submissionService.batchUpdateStatus(formId, submissionIds, status, userId))
        .rejects.toThrow('You do not have permission to batch update submissions');

      expect(mockServiceManager.auditService.logAccess).toHaveBeenCalledWith(
        formId,
        123,
        'edit',
        expect.objectContaining({
          reason: 'no_edit_permission',
          context: 'batch_status_update'
        }),
        false,
        'No permission for batch update'
      );
    });
  });

  describe('getSubmissionStatistics', () => {
    it('should require view permission for statistics', async () => {
      const formId = 'test-form-id';
      const userId = '123';

      // Mock permission service to deny view
      mockServiceManager.permissionService.canView.mockResolvedValue(false);

      await expect(submissionService.getSubmissionStatistics(formId, userId))
        .rejects.toThrow('You do not have permission to view statistics');

      expect(mockServiceManager.auditService.logAccess).toHaveBeenCalledWith(
        formId,
        123,
        'view',
        expect.objectContaining({
          reason: 'no_view_permission',
          context: 'submission_statistics'
        }),
        false,
        'No permission to view submission statistics'
      );
    });

    it('should return statistics when user has view permission', async () => {
      const formId = 'test-form-id';
      const userId = '123';

      // Mock permission service to allow view
      mockServiceManager.permissionService.canView.mockResolvedValue(true);

      // Mock database statistics query
      mockDb.query.mockResolvedValue({
        rows: [{
          total_submissions: '10',
          completed_submissions: '8',
          draft_submissions: '2',
          processing_submissions: '0',
          unique_submitters: '7',
          first_submission: new Date().toISOString(),
          last_submission: new Date().toISOString()
        }]
      });

      const result = await submissionService.getSubmissionStatistics(formId, userId);

      expect(result).toBeDefined();
      expect(result.total_submissions).toBe(10);
      expect(result.completed_submissions).toBe(8);
      expect(result.completion_rate).toBe(80);

      expect(mockServiceManager.auditService.logAccess).toHaveBeenCalledWith(
        formId,
        123,
        'view',
        { context: 'submission_statistics' },
        true
      );
    });
  });
});