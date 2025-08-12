/**
 * Integration tests for Form API endpoints
 */

import request from 'supertest';
import app from '../../../../app';
import { pool } from '../../../../utils/database';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { FormStatus, FieldType } from '../../types';

// Mock database
jest.mock('../../../../utils/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

// Mock JWT
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

describe('Form API Endpoints', () => {
  const mockUserId = uuidv4();
  const mockFormId = uuidv4();
  const mockToken = 'mock-jwt-token';

  beforeEach(() => {
    jest.clearAllMocks();
    (jwt.verify as jest.Mock).mockReturnValue({ id: mockUserId });
  });

  describe('POST /api/forms', () => {
    it('should create a new form', async () => {
      const formData = {
        title: 'Test Form',
        description: 'Test Description',
        fields: [
          {
            type: FieldType.Text,
            label: 'Name',
            key: 'name',
            required: true,
          },
        ],
        settings: {
          submitButtonText: 'Submit',
        },
      };

      const mockCreatedForm = {
        id: mockFormId,
        ...formData,
        userId: mockUserId,
        status: FormStatus.Draft,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockCreatedForm],
      });

      const response = await request(app)
        .post('/api/forms')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(formData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: mockFormId,
        title: 'Test Form',
      });
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/forms')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/forms')
        .send({ title: 'Test' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/forms', () => {
    it('should retrieve user forms', async () => {
      const mockForms = [
        { id: uuidv4(), title: 'Form 1', status: FormStatus.Active },
        { id: uuidv4(), title: 'Form 2', status: FormStatus.Draft },
      ];

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: mockForms,
      });

      const response = await request(app)
        .get('/api/forms')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should support pagination', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      const response = await request(app)
        .get('/api/forms?page=2&limit=10')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([mockUserId, 10, 10]) // offset = (page-1) * limit
      );
    });

    it('should support search', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      const response = await request(app)
        .get('/api/forms?search=contact')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['%contact%'])
      );
    });
  });

  describe('GET /api/forms/:id', () => {
    it('should retrieve a specific form', async () => {
      const mockForm = {
        id: mockFormId,
        title: 'Test Form',
        fields: [],
        userId: mockUserId,
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockForm],
      });

      const response = await request(app)
        .get(`/api/forms/${mockFormId}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(mockFormId);
    });

    it('should return 404 for non-existent form', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      const response = await request(app)
        .get(`/api/forms/${mockFormId}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 for unauthorized access', async () => {
      const mockForm = {
        id: mockFormId,
        userId: uuidv4(), // Different user
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockForm],
      });

      const response = await request(app)
        .get(`/api/forms/${mockFormId}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/forms/:id', () => {
    it('should update a form', async () => {
      const updates = {
        title: 'Updated Form',
        description: 'Updated Description',
      };

      const mockUpdatedForm = {
        id: mockFormId,
        ...updates,
        userId: mockUserId,
        updatedAt: new Date(),
      };

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ userId: mockUserId }] }) // Check ownership
        .mockResolvedValueOnce({ rows: [mockUpdatedForm] }); // Update

      const response = await request(app)
        .put(`/api/forms/${mockFormId}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Form');
    });

    it('should validate field structure', async () => {
      const updates = {
        fields: [
          {
            // Missing required properties
            type: FieldType.Text,
          },
        ],
      };

      const response = await request(app)
        .put(`/api/forms/${mockFormId}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send(updates);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('DELETE /api/forms/:id', () => {
    it('should delete a form', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rowCount: 1,
      });

      const response = await request(app)
        .delete(`/api/forms/${mockFormId}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');
    });

    it('should return 404 if form not found', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rowCount: 0,
      });

      const response = await request(app)
        .delete(`/api/forms/${mockFormId}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/forms/:id/publish', () => {
    it('should publish a form', async () => {
      const mockPublishedForm = {
        id: mockFormId,
        status: FormStatus.Active,
        publishedAt: new Date(),
      };

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ userId: mockUserId }] }) // Check ownership
        .mockResolvedValueOnce({ rows: [mockPublishedForm] }); // Publish

      const response = await request(app)
        .post(`/api/forms/${mockFormId}/publish`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(FormStatus.Active);
    });
  });

  describe('POST /api/forms/:id/duplicate', () => {
    it('should duplicate a form', async () => {
      const originalForm = {
        id: mockFormId,
        title: 'Original Form',
        fields: [],
        userId: mockUserId,
      };

      const duplicatedForm = {
        id: uuidv4(),
        title: 'Original Form (Copy)',
        fields: [],
        userId: mockUserId,
      };

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [originalForm] }) // Get original
        .mockResolvedValueOnce({ rows: [duplicatedForm] }); // Create duplicate

      const response = await request(app)
        .post(`/api/forms/${mockFormId}/duplicate`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toContain('(Copy)');
    });
  });

  describe('GET /api/forms/:id/stats', () => {
    it('should retrieve form statistics', async () => {
      const mockStats = {
        totalSubmissions: '25',
        uniqueSubmitters: '20',
        averageCompletionTime: '180',
        lastSubmissionAt: new Date(),
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockStats],
      });

      const response = await request(app)
        .get(`/api/forms/${mockFormId}/stats`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        totalSubmissions: 25,
        uniqueSubmitters: 20,
        averageCompletionTime: 180,
      });
    });
  });

  describe('GET /api/forms/public/:id', () => {
    it('should retrieve public form', async () => {
      const mockPublicForm = {
        id: mockFormId,
        title: 'Public Form',
        status: FormStatus.Active,
        settings: {
          requireAuthentication: false,
        },
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockPublicForm],
      });

      const response = await request(app)
        .get(`/api/forms/public/${mockFormId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(mockFormId);
    });

    it('should return 404 for inactive forms', async () => {
      const mockInactiveForm = {
        id: mockFormId,
        status: FormStatus.Draft,
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockInactiveForm],
      });

      const response = await request(app)
        .get(`/api/forms/public/${mockFormId}`);

      expect(response.status).toBe(404);
    });

    it('should return 403 for forms requiring authentication', async () => {
      const mockAuthForm = {
        id: mockFormId,
        status: FormStatus.Active,
        settings: {
          requireAuthentication: true,
        },
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockAuthForm],
      });

      const response = await request(app)
        .get(`/api/forms/public/${mockFormId}`);

      expect(response.status).toBe(403);
    });
  });
});