/**
 * Integration tests for Submission API endpoints
 */

import request from 'supertest';
import app from '../../../../app';
import { pool } from '../../../../utils/database';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { FormStatus, FieldType } from '../../types';
import WebhookService from '../../services/WebhookService';
import FileUploadService from '../../services/FileUploadService';

// Mock dependencies
jest.mock('../../../../utils/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

jest.mock('../../services/WebhookService', () => ({
  default: {
    triggerWebhooks: jest.fn(),
  },
}));

jest.mock('../../services/FileUploadService', () => ({
  default: {
    uploadFile: jest.fn(),
  },
}));

describe('Submission API Endpoints', () => {
  const mockUserId = uuidv4();
  const mockFormId = uuidv4();
  const mockSubmissionId = uuidv4();
  const mockToken = 'mock-jwt-token';

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
    jest.clearAllMocks();
    (jwt.verify as jest.Mock).mockReturnValue({ id: mockUserId });
  });

  describe('POST /api/forms/:formId/submit', () => {
    it('should submit form successfully', async () => {
      const submissionData = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      const mockSubmission = {
        id: mockSubmissionId,
        formId: mockFormId,
        data: submissionData,
        submittedBy: null,
        submittedAt: new Date(),
      };

      // Mock form retrieval
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockForm] }) // Get form
        .mockResolvedValueOnce({ rows: [mockSubmission] }); // Create submission

      const response = await request(app)
        .post(`/api/forms/${mockFormId}/submit`)
        .send(submissionData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(mockSubmissionId);
      expect(WebhookService.triggerWebhook).toHaveBeenCalledWith(
        mockFormId,
        'form.submitted',
        expect.any(Object)
      );
    });

    it('should validate required fields', async () => {
      const incompleteData = {
        name: 'John Doe',
        // Missing required email
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockForm] });

      const response = await request(app)
        .post(`/api/forms/${mockFormId}/submit`)
        .send(incompleteData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          field: 'email',
          message: expect.stringContaining('required'),
        })
      );
    });

    it('should validate email format', async () => {
      const invalidEmailData = {
        name: 'John Doe',
        email: 'invalid-email',
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockForm] });

      const response = await request(app)
        .post(`/api/forms/${mockFormId}/submit`)
        .send(invalidEmailData);

      expect(response.status).toBe(400);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          field: 'email',
          message: expect.stringContaining('email'),
        })
      );
    });

    it('should handle authentication requirement', async () => {
      const authRequiredForm = {
        ...mockForm,
        settings: { ...mockForm.settings, requireAuthentication: true },
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [authRequiredForm] });

      const response = await request(app)
        .post(`/api/forms/${mockFormId}/submit`)
        .send({ name: 'John', email: 'john@example.com' });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('authentication');
    });

    it('should prevent multiple submissions when not allowed', async () => {
      const singleSubmissionForm = {
        ...mockForm,
        settings: { ...mockForm.settings, allowMultipleSubmissions: false },
      };

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [singleSubmissionForm] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // Existing submission

      const response = await request(app)
        .post(`/api/forms/${mockFormId}/submit`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ name: 'John', email: 'john@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already submitted');
    });

    it('should handle inactive form', async () => {
      const inactiveForm = { ...mockForm, status: FormStatus.Inactive };

      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [inactiveForm] });

      const response = await request(app)
        .post(`/api/forms/${mockFormId}/submit`)
        .send({ name: 'John', email: 'john@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('not active');
    });
  });

  describe('GET /api/forms/:formId/submissions', () => {
    it('should retrieve form submissions', async () => {
      const mockSubmissions = [
        {
          id: uuidv4(),
          data: { name: 'User 1' },
          submittedAt: new Date(),
        },
        {
          id: uuidv4(),
          data: { name: 'User 2' },
          submittedAt: new Date(),
        },
      ];

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: mockSubmissions,
      });

      const response = await request(app)
        .get(`/api/forms/${mockFormId}/submissions`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should support pagination', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get(`/api/forms/${mockFormId}/submissions?page=2&limit=20`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([mockFormId, mockUserId, 20, 20])
      );
    });

    it('should support date filtering', async () => {
      const dateFrom = '2024-01-01';
      const dateTo = '2024-01-31';

      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get(`/api/forms/${mockFormId}/submissions?dateFrom=${dateFrom}&dateTo=${dateTo}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('submitted_at >= $4'),
        expect.arrayContaining([
          mockFormId,
          mockUserId,
          expect.any(Number),
          expect.any(Number),
          new Date(dateFrom),
          new Date(dateTo),
        ])
      );
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/forms/${mockFormId}/submissions`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/forms/:formId/submissions/:submissionId', () => {
    it('should retrieve specific submission', async () => {
      const mockSubmission = {
        id: mockSubmissionId,
        formId: mockFormId,
        data: { name: 'John Doe' },
        submittedAt: new Date(),
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockSubmission],
      });

      const response = await request(app)
        .get(`/api/forms/${mockFormId}/submissions/${mockSubmissionId}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(mockSubmissionId);
    });

    it('should return 404 for non-existent submission', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get(`/api/forms/${mockFormId}/submissions/${mockSubmissionId}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/forms/:formId/submissions/:submissionId', () => {
    it('should update submission', async () => {
      const updates = { name: 'Jane Doe' };
      const mockUpdatedSubmission = {
        id: mockSubmissionId,
        data: { name: 'Jane Doe', email: 'john@example.com' },
        updatedAt: new Date(),
      };

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ userId: mockUserId }] }) // Check ownership
        .mockResolvedValueOnce({ rows: [mockUpdatedSubmission] }); // Update

      const response = await request(app)
        .put(`/api/forms/${mockFormId}/submissions/${mockSubmissionId}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.data.name).toBe('Jane Doe');
    });
  });

  describe('DELETE /api/forms/:formId/submissions/:submissionId', () => {
    it('should delete submission', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ userId: mockUserId }] }) // Check ownership
        .mockResolvedValueOnce({ rowCount: 1 }); // Delete

      const response = await request(app)
        .delete(`/api/forms/${mockFormId}/submissions/${mockSubmissionId}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');
    });

    it('should return 404 if submission not found', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ userId: mockUserId }] })
        .mockResolvedValueOnce({ rowCount: 0 });

      const response = await request(app)
        .delete(`/api/forms/${mockFormId}/submissions/${mockSubmissionId}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/forms/:formId/submissions/export', () => {
    it('should export submissions as CSV', async () => {
      const mockSubmissions = [
        { data: { name: 'John Doe', email: 'john@example.com' } },
        { data: { name: 'Jane Doe', email: 'jane@example.com' } },
      ];

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ userId: mockUserId }] }) // Check ownership
        .mockResolvedValueOnce({ rows: mockSubmissions }); // Get submissions

      const response = await request(app)
        .get(`/api/forms/${mockFormId}/submissions/export?format=csv`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('csv');
      expect(response.text).toContain('name,email');
      expect(response.text).toContain('John Doe,john@example.com');
    });

    it('should export submissions as JSON', async () => {
      const mockSubmissions = [
        { data: { name: 'John Doe', email: 'john@example.com' } },
      ];

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ userId: mockUserId }] })
        .mockResolvedValueOnce({ rows: mockSubmissions });

      const response = await request(app)
        .get(`/api/forms/${mockFormId}/submissions/export?format=json`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('json');
      const data = JSON.parse(response.text);
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('John Doe');
    });

    it('should export submissions as Excel', async () => {
      const mockSubmissions = [
        { data: { name: 'John Doe', email: 'john@example.com' } },
      ];

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ userId: mockUserId }] })
        .mockResolvedValueOnce({ rows: mockSubmissions });

      const response = await request(app)
        .get(`/api/forms/${mockFormId}/submissions/export?format=excel`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('spreadsheet');
    });
  });

  describe('GET /api/forms/:formId/submissions/analytics', () => {
    it('should retrieve submission analytics', async () => {
      const mockAnalytics = {
        totalSubmissions: '100',
        submissionsToday: '10',
        submissionsThisWeek: '50',
        submissionsThisMonth: '100',
        averagePerDay: '3.33',
        completionRate: '0.85',
      };

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ userId: mockUserId }] }) // Check ownership
        .mockResolvedValueOnce({ rows: [mockAnalytics] }); // Get analytics

      const response = await request(app)
        .get(`/api/forms/${mockFormId}/submissions/analytics`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        totalSubmissions: 100,
        submissionsToday: 10,
        submissionsThisWeek: 50,
        submissionsThisMonth: 100,
        averagePerDay: 3.33,
        completionRate: 0.85,
      });
    });
  });

  describe('File upload in submissions', () => {
    it('should handle file upload fields', async () => {
      const formWithFileUpload = {
        ...mockForm,
        fields: [
          ...mockForm.fields,
          {
            id: uuidv4(),
            type: FieldType.FileUpload,
            label: 'Resume',
            key: 'resume',
            required: true,
            position: 2,
            validation: {
              allowedTypes: ['pdf'],
              maxSize: 5 * 1024 * 1024,
            },
          },
        ],
      };

      const mockFileUploadResult = {
        filename: 'resume.pdf',
        originalname: 'John_Doe_Resume.pdf',
        mimetype: 'application/pdf',
        size: 100000,
        url: '/uploads/forms/test-form-id/resume.pdf',
      };

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [formWithFileUpload] })
        .mockResolvedValueOnce({ rows: [{ id: mockSubmissionId }] });

      (FileUploadService.uploadFile as jest.Mock).mockResolvedValueOnce(mockFileUploadResult);

      const response = await request(app)
        .post(`/api/forms/${mockFormId}/submit`)
        .field('name', 'John Doe')
        .field('email', 'john@example.com')
        .attach('resume', Buffer.from('fake pdf content'), 'resume.pdf');

      expect(response.status).toBe(201);
      expect(FileUploadService.uploadFile).toHaveBeenCalled();
    });
  });
});