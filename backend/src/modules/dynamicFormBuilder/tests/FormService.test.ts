/**
 * Unit tests for FormService
 */

import { FormService } from '../services/FormService';
import pool from '../../../config/database';
import { v4 as uuidv4 } from 'uuid';
import { FormStatus, FormField, FieldType } from '../types';

// Mock the database pool
jest.mock('../../../config/database', () => ({
  query: jest.fn(),
}));

describe('FormService', () => {
  let formService: FormService;
  const mockUserId = uuidv4();
  const mockFormId = uuidv4();

  beforeEach(() => {
    formService = new FormService();
    jest.clearAllMocks();
  });

  describe('createForm', () => {
    it('should create a new form successfully', async () => {
      const formData = {
        title: 'Test Form',
        description: 'Test Description',
        fields: [
          {
            id: uuidv4(),
            type: FieldType.Text,
            label: 'Name',
            key: 'name',
            required: true,
            position: 0,
          },
        ],
        settings: {
          allowMultipleSubmissions: true,
          requireAuthentication: false,
        },
      };

      const mockResult = {
        rows: [{
          id: mockFormId,
          ...formData,
          userId: mockUserId,
          status: FormStatus.Draft,
          createdAt: new Date(),
          updatedAt: new Date(),
        }],
      };

      (pool.query as jest.Mock).mockResolvedValueOnce(mockResult);

      const result = await formService.createForm(formData, mockUserId);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO forms'),
        expect.arrayContaining([
          formData.title,
          formData.description,
          expect.any(String), // JSON fields
          expect.any(String), // JSON settings
          mockUserId,
          FormStatus.Draft,
        ])
      );
      expect(result).toEqual(mockResult.rows[0]);
    });

    it('should handle database errors', async () => {
      const formData = {
        title: 'Test Form',
        description: 'Test Description',
      };

      (pool.query as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      await expect(formService.createForm(formData, mockUserId))
        .rejects.toThrow('Database error');
    });
  });

  describe('getForm', () => {
    it('should retrieve a form by ID', async () => {
      const mockForm = {
        id: mockFormId,
        title: 'Test Form',
        description: 'Test Description',
        fields: [],
        settings: {},
        userId: mockUserId,
        status: FormStatus.Draft,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockForm],
      });

      const result = await formService.getForm(mockFormId);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM forms WHERE id = $1'),
        [mockFormId]
      );
      expect(result).toEqual(mockForm);
    });

    it('should return null for non-existent form', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      const result = await formService.getForm(mockFormId);

      expect(result).toBeNull();
    });
  });

  describe('updateForm', () => {
    it('should update form successfully', async () => {
      const updates = {
        title: 'Updated Form',
        description: 'Updated Description',
      };

      const mockUpdatedForm = {
        id: mockFormId,
        ...updates,
        userId: mockUserId,
        status: FormStatus.Draft,
        updatedAt: new Date(),
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockUpdatedForm],
      });

      const result = await formService.updateForm(mockFormId, updates, mockUserId);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE forms SET'),
        expect.arrayContaining([mockFormId, mockUserId])
      );
      expect(result).toEqual(mockUpdatedForm);
    });

    it('should handle partial updates', async () => {
      const updates = {
        title: 'Only Title Updated',
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: mockFormId,
          title: updates.title,
          userId: mockUserId,
        }],
      });

      await formService.updateForm(mockFormId, updates, mockUserId);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('title = COALESCE($1, title)'),
        expect.any(Array)
      );
    });
  });

  describe('deleteForm', () => {
    it('should delete form successfully', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rowCount: 1,
      });

      const result = await formService.deleteForm(mockFormId, mockUserId);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM forms WHERE id = $1 AND user_id = $2'),
        [mockFormId, mockUserId]
      );
      expect(result).toBe(true);
    });

    it('should return false if form not found or unauthorized', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rowCount: 0,
      });

      const result = await formService.deleteForm(mockFormId, mockUserId);

      expect(result).toBe(false);
    });
  });

  describe('getUserForms', () => {
    it('should retrieve user forms with pagination', async () => {
      const mockForms = [
        { id: uuidv4(), title: 'Form 1' },
        { id: uuidv4(), title: 'Form 2' },
      ];

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: mockForms,
      });

      const result = await formService.getUserForms(mockUserId, { page: 1, limit: 10 });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM forms WHERE user_id = $1'),
        expect.arrayContaining([mockUserId, 10, 0])
      );
      expect(result).toEqual(mockForms);
    });

    it('should handle search parameter', async () => {
      const searchTerm = 'test';
      
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      await formService.getUserForms(mockUserId, { 
        page: 1, 
        limit: 10, 
        search: searchTerm 
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('(title ILIKE $2 OR description ILIKE $2)'),
        expect.arrayContaining([mockUserId, `%${searchTerm}%`])
      );
    });
  });

  describe('publishForm', () => {
    it('should publish form successfully', async () => {
      const mockPublishedForm = {
        id: mockFormId,
        status: FormStatus.Active,
        publishedAt: new Date(),
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockPublishedForm],
      });

      const result = await formService.publishForm(mockFormId, mockUserId);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE forms SET status = $1, published_at = $2'),
        expect.arrayContaining([FormStatus.Active, expect.any(Date), mockFormId, mockUserId])
      );
      expect(result).toEqual(mockPublishedForm);
    });
  });

  describe('duplicateForm', () => {
    it('should duplicate form with new title', async () => {
      const originalForm = {
        id: mockFormId,
        title: 'Original Form',
        description: 'Original Description',
        fields: [],
        settings: {},
        userId: mockUserId,
      };

      const duplicatedForm = {
        id: uuidv4(),
        title: 'Original Form (Copy)',
        description: 'Original Description',
        fields: [],
        settings: {},
        userId: mockUserId,
        status: FormStatus.Draft,
      };

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [originalForm] })
        .mockResolvedValueOnce({ rows: [duplicatedForm] });

      const result = await formService.duplicateForm(mockFormId, mockUserId);

      expect(pool.query).toHaveBeenCalledTimes(2);
      expect(result).toEqual(duplicatedForm);
      expect(result.title).toContain('(Copy)');
    });

    it('should return null if original form not found', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      const result = await formService.duplicateForm(mockFormId, mockUserId);

      expect(result).toBeNull();
      expect(pool.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('getFormStats', () => {
    it('should calculate form statistics', async () => {
      const mockStats = {
        totalSubmissions: '10',
        uniqueSubmitters: '8',
        averageCompletionTime: '300',
        lastSubmissionAt: new Date(),
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockStats],
      });

      const result = await formService.getFormStats(mockFormId, mockUserId);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(DISTINCT s.id) as "totalSubmissions"'),
        [mockFormId, mockUserId]
      );
      expect(result).toEqual({
        totalSubmissions: 10,
        uniqueSubmitters: 8,
        averageCompletionTime: 300,
        lastSubmissionAt: mockStats.lastSubmissionAt,
      });
    });
  });
});