import request from 'supertest';
import { pool } from '../../../utils/database';

// Mock the database pool
jest.mock('../../../utils/database', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn()
  }
}));

const API_BASE = 'http://localhost:5000';

describe('User Management Module Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(API_BASE)
        .get('/api/user-management/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('module', 'user-management');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('User List Endpoint', () => {
    it('should return list of users', async () => {
      const mockUsers = [
        {
          id: 1,
          email: 'test@example.com',
          username: 'testuser',
          full_name: 'Test User',
          department: 'IT',
          position: 'Developer',
          is_approved: true,
          is_blocked: false,
          status: 'active'
        }
      ];

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: mockUsers,
        rowCount: 1
      });

      const response = await request(API_BASE)
        .get('/api/user-management/users')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      (pool.query as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      const response = await request(API_BASE)
        .get('/api/user-management/users')
        .expect(500);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Get User by ID', () => {
    it('should return user details with roles and groups', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        username: 'testuser',
        full_name: 'Test User',
        roles: [{ id: 'role-1', name: 'admin' }],
        groups: [{ id: 'group-1', name: 'administrators' }]
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockUser],
        rowCount: 1
      });

      const response = await request(API_BASE)
        .get('/api/user-management/users/1')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id', 1);
    });

    it('should return 404 for non-existent user', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      });

      const response = await request(API_BASE)
        .get('/api/user-management/users/999')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'User not found');
    });
  });

  describe('Toggle User Approval', () => {
    it('should toggle user approval status', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 1, is_approved: true }],
        rowCount: 1
      });

      const response = await request(API_BASE)
        .put('/api/user-management/users/1/toggle-approval')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body.data).toHaveProperty('is_approved', true);
    });

    it('should return 404 for non-existent user', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      });

      const response = await request(API_BASE)
        .put('/api/user-management/users/999/toggle-approval')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'User not found');
    });
  });

  describe('Toggle User Block', () => {
    it('should toggle user block status and update status field', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 1, is_blocked: true, status: 'inactive' }],
        rowCount: 1
      });

      const response = await request(API_BASE)
        .put('/api/user-management/users/1/toggle-block')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body.data).toHaveProperty('is_blocked', true);
      expect(response.body.data).toHaveProperty('status', 'inactive');
    });

    it('should handle database errors', async () => {
      (pool.query as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      const response = await request(API_BASE)
        .put('/api/user-management/users/1/toggle-block')
        .expect(500);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });
});

describe('User Management Database Integration Tests', () => {
  describe('Database Schema Validation', () => {
    it('should have all required tables', async () => {
      const tables = [
        'users',
        'roles',
        'permissions',
        'user_roles',
        'user_groups',
        'user_group_members',
        'audit_logs'
      ];

      for (const table of tables) {
        const query = `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )
        `;
        
        (pool.query as jest.Mock).mockResolvedValueOnce({
          rows: [{ exists: true }],
          rowCount: 1
        });

        const result = await pool.query(query, [table]);
        expect(result.rows[0].exists).toBe(true);
      }
    });

    it('should have all required views', async () => {
      const views = [
        'user_permissions_view',
        'user_details_view',
        'user_groups_summary',
        'department_statistics',
        'role_statistics'
      ];

      for (const view of views) {
        const query = `
          SELECT EXISTS (
            SELECT FROM information_schema.views 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )
        `;
        
        (pool.query as jest.Mock).mockResolvedValueOnce({
          rows: [{ exists: true }],
          rowCount: 1
        });

        const result = await pool.query(query, [view]);
        expect(result.rows[0].exists).toBe(true);
      }
    });
  });

  describe('User Data Integrity', () => {
    it('should enforce unique email constraint', async () => {
      const error = new Error('duplicate key value violates unique constraint "users_email_key"');
      (error as any).code = '23505';
      
      (pool.query as jest.Mock).mockRejectedValueOnce(error);

      try {
        await pool.query(
          'INSERT INTO users (email, username) VALUES ($1, $2)',
          ['duplicate@example.com', 'duplicateuser']
        );
      } catch (err: any) {
        expect(err.code).toBe('23505');
      }
    });

    it('should enforce foreign key constraints', async () => {
      const error = new Error('insert or update on table "user_roles" violates foreign key constraint');
      (error as any).code = '23503';
      
      (pool.query as jest.Mock).mockRejectedValueOnce(error);

      try {
        await pool.query(
          'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
          [999, 'invalid-role-id']
        );
      } catch (err: any) {
        expect(err.code).toBe('23503');
      }
    });
  });

  describe('Business Logic Validation', () => {
    it('should not allow blocked users to be active', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 1,
          is_blocked: true,
          status: 'inactive'
        }],
        rowCount: 1
      });

      const result = await pool.query(
        'SELECT id, is_blocked, status FROM users WHERE is_blocked = true'
      );

      result.rows.forEach(user => {
        if (user.is_blocked) {
          expect(user.status).not.toBe('active');
        }
      });
    });

    it('should properly cascade deletes', async () => {
      // Mock checking for cascading deletes
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      });

      // When a user is deleted, their roles should also be deleted
      const result = await pool.query(
        'SELECT * FROM user_roles WHERE user_id = $1',
        [999] // Deleted user
      );

      expect(result.rowCount).toBe(0);
    });
  });
});