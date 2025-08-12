/**
 * Unit tests for SubmissionService
 */

import { SubmissionService } from '../services/SubmissionService';
import FormService from '../services/FormService';
import ValidationService from '../services/ValidationService';
import WebhookService from '../services/WebhookService';
import pool from '../../../config/database';
import { v4 as uuidv4 } from 'uuid';
import { FormStatus, FieldType } from '../types';

// Mock dependencies
jest.mock('../../../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../services/FormService', () => ({
  default: {
    getForm: jest.fn(),
  },
}));

jest.mock('../services/ValidationService', () => ({
  default: {
    validateSubmission: jest.fn(),
  },
}));

jest.mock('../services/WebhookService', () => ({
  default: {
    triggerWebhooks: jest.fn(),
  },
}));

describe('SubmissionService', () => {
  let submissionService: SubmissionService;
  const mockFormId = uuidv4();
  const mockUserId = uuidv4();
  const mockSubmissionId = uuidv4();

  const mockForm = {
    id: mockFormId,
    title: 'Test Form',
    fields: [
      {
        id: uuidv4(),
        type: FieldType.Text,
        label: 'Name',
        key: 'name',
        required: true,
        position: 0,
      },
      {
        id: uuidv4(),
        type: FieldType.Email,
        label: 'Email',
        key: 'email',
        required: true,
        position: 1,
        validation: {
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
        },
      },
    ],
    settings: {
      requireAuthentication: false,
      allowMultipleSubmissions: true,
    },
    status: FormStatus.Active,
    userId: mockUserId,
  };

  beforeEach(() => {
    submissionService = new SubmissionService();
    jest.clearAllMocks();
  });

  describe('createSubmission', () => {
    it('should create submission successfully', async () => {
      const submissionData = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      const mockSubmission = {
        id: mockSubmissionId,
        formId: mockFormId,
        data: submissionData,
        submittedBy: mockUserId,
        submittedAt: new Date(),
      };

      (FormService.getForm as jest.Mock).mockResolvedValueOnce(mockForm);
      (ValidationService.validateSubmission as jest.Mock).mockReturnValueOnce({
        isValid: true,
        errors: [],
      });
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockSubmission],
      });

      const result = await submissionService.createSubmission(
        mockFormId,
        submissionData,
        mockUserId
      );

      expect(FormService.getForm).toHaveBeenCalledWith(mockFormId);
      expect(ValidationService.validateSubmission).toHaveBeenCalledWith(
        submissionData,
        mockForm.fields
      );
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO form_submissions'),
        expect.arrayContaining([mockFormId, expect.any(String), mockUserId])
      );
      expect(WebhookService.triggerWebhooks).toHaveBeenCalledWith(
        mockFormId,
        'form.submitted',
        expect.any(Object)
      );
      expect(result).toEqual(mockSubmission);
    });

    it('should handle validation errors', async () => {
      const submissionData = {
        name: 'John Doe',
        email: 'invalid-email',
      };

      const validationErrors = [
        { field: 'email', message: 'Invalid email format' },
      ];

      (FormService.getForm as jest.Mock).mockResolvedValueOnce(mockForm);
      (ValidationService.validateSubmission as jest.Mock).mockReturnValueOnce({
        isValid: false,
        errors: validationErrors,
      });

      await expect(
        submissionService.createSubmission(mockFormId, submissionData, mockUserId)
      ).rejects.toThrow('Validation failed');

      expect(pool.query).not.toHaveBeenCalled();
      expect(WebhookService.triggerWebhooks).not.toHaveBeenCalled();
    });

    it('should handle inactive form', async () => {
      const inactiveForm = { ...mockForm, status: FormStatus.Inactive };
      
      (FormService.getForm as jest.Mock).mockResolvedValueOnce(inactiveForm);

      await expect(
        submissionService.createSubmission(mockFormId, {}, mockUserId)
      ).rejects.toThrow('Form is not active');

      expect(ValidationService.validateSubmission).not.toHaveBeenCalled();
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('should prevent multiple submissions when not allowed', async () => {
      const formWithSingleSubmission = {
        ...mockForm,
        settings: { ...mockForm.settings, allowMultipleSubmissions: false },
      };

      (FormService.getForm as jest.Mock).mockResolvedValueOnce(formWithSingleSubmission);
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '1' }],
      });

      await expect(
        submissionService.createSubmission(mockFormId, {}, mockUserId)
      ).rejects.toThrow('already submitted');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT'),
        [mockFormId, mockUserId]
      );
    });
  });

  describe('getSubmission', () => {
    it('should retrieve submission by ID', async () => {
      const mockSubmission = {
        id: mockSubmissionId,
        formId: mockFormId,
        data: { name: 'John Doe' },
        submittedBy: mockUserId,
        submittedAt: new Date(),
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockSubmission],
      });

      const result = await submissionService.getSubmission(mockSubmissionId);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM form_submissions WHERE id = $1'),
        [mockSubmissionId]
      );
      expect(result).toEqual(mockSubmission);
    });

    it('should return null for non-existent submission', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      const result = await submissionService.getSubmission(mockSubmissionId);

      expect(result).toBeNull();
    });
  });

  describe('getFormSubmissions', () => {
    it('should retrieve form submissions with pagination', async () => {
      const mockSubmissions = [
        { id: uuidv4(), data: { name: 'User 1' } },
        { id: uuidv4(), data: { name: 'User 2' } },
      ];

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: mockSubmissions,
      });

      const result = await submissionService.getFormSubmissions(
        mockFormId,
        mockUserId,
        { page: 1, limit: 10 }
      );

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('JOIN forms f ON s.form_id = f.id'),
        expect.arrayContaining([mockFormId, mockUserId, 10, 0])
      );
      expect(result).toEqual(mockSubmissions);
    });

    it('should handle date range filters', async () => {
      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-01-31');

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      await submissionService.getFormSubmissions(mockFormId, mockUserId, {
        page: 1,
        limit: 10,
        dateFrom,
        dateTo,
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('s.submitted_at >= $4 AND s.submitted_at <= $5'),
        expect.arrayContaining([mockFormId, mockUserId, 10, 0, dateFrom, dateTo])
      );
    });
  });

  describe('updateSubmission', () => {
    it('should update submission data', async () => {
      const updates = { name: 'Jane Doe' };
      const mockUpdatedSubmission = {
        id: mockSubmissionId,
        data: updates,
        updatedAt: new Date(),
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockUpdatedSubmission],
      });

      const result = await submissionService.updateSubmission(
        mockSubmissionId,
        updates,
        mockUserId
      );

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE form_submissions'),
        expect.arrayContaining([mockSubmissionId, mockUserId, expect.any(String)])
      );
      expect(result).toEqual(mockUpdatedSubmission);
    });
  });

  describe('deleteSubmission', () => {
    it('should delete submission successfully', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rowCount: 1,
      });

      const result = await submissionService.deleteSubmission(
        mockSubmissionId,
        mockUserId
      );

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM form_submissions'),
        [mockSubmissionId, mockUserId]
      );
      expect(result).toBe(true);
    });

    it('should return false if submission not found', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rowCount: 0,
      });

      const result = await submissionService.deleteSubmission(
        mockSubmissionId,
        mockUserId
      );

      expect(result).toBe(false);
    });
  });

  describe('exportSubmissions', () => {
    it('should export submissions as CSV', async () => {
      const mockSubmissions = [
        { data: { name: 'John Doe', email: 'john@example.com' } },
        { data: { name: 'Jane Doe', email: 'jane@example.com' } },
      ];

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: mockSubmissions,
      });

      const result = await submissionService.exportSubmissions(
        mockFormId,
        mockUserId,
        'csv'
      );

      expect(result).toContain('name,email');
      expect(result).toContain('John Doe,john@example.com');
      expect(result).toContain('Jane Doe,jane@example.com');
    });

    it('should export submissions as JSON', async () => {
      const mockSubmissions = [
        { data: { name: 'John Doe' } },
      ];

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: mockSubmissions,
      });

      const result = await submissionService.exportSubmissions(
        mockFormId,
        mockUserId,
        'json'
      );

      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe('John Doe');
    });
  });

  describe('getSubmissionAnalytics', () => {
    it('should calculate submission analytics', async () => {
      const mockAnalytics = {
        totalSubmissions: '100',
        submissionsToday: '10',
        submissionsThisWeek: '50',
        submissionsThisMonth: '100',
        averagePerDay: '3.33',
        completionRate: '0.85',
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockAnalytics],
      });

      const result = await submissionService.getSubmissionAnalytics(
        mockFormId,
        mockUserId
      );

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(s.id) as "totalSubmissions"'),
        [mockFormId, mockUserId]
      );
      expect(result).toEqual({
        totalSubmissions: 100,
        submissionsToday: 10,
        submissionsThisWeek: 50,
        submissionsThisMonth: 100,
        averagePerDay: 3.33,
        completionRate: 0.85,
      });
    });
  });
});