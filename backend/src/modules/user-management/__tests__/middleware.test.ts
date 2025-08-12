import { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth';
import { checkPermission } from '../middleware/permission';
import { pool } from '../../../utils/database';

jest.mock('../../../utils/database', () => ({
  pool: {
    query: jest.fn()
  }
}));

describe('Authentication Middleware Tests', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      user: undefined
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    it('should reject requests without authentication', async () => {
      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should authenticate with valid session token', async () => {
      mockReq.headers = {
        'x-session-token': 'valid-session-token'
      };

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ user_id: 1 }],
          rowCount: 1
        })
        .mockResolvedValueOnce({
          rows: [{ id: 1, email: 'test@example.com', full_name: null, email_verified: null, created_at: null, updated_at: null }],
          rowCount: 1
        })
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0
        });

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toEqual({
        id: '1',
        email: 'test@example.com',
        full_name: '',
        email_verified: false,
        created_at: expect.any(Date),
        updated_at: expect.any(Date)
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject expired session tokens', async () => {
      mockReq.headers = {
        'x-session-token': 'expired-session-token'
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      });

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid or expired session'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockReq.headers = {
        'x-session-token': 'valid-session-token'
      };

      (pool.query as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication error'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject when user not found', async () => {
      mockReq.headers = {
        'x-session-token': 'valid-session-token'
      };

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ user_id: 1 }],
          rowCount: 1
        })
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0
        });

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});

describe('Permission Middleware Tests', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      user: { id: '1', email: 'test@example.com', full_name: 'Test User', email_verified: true, created_at: new Date(), updated_at: new Date(), roles: [] },
      params: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('checkPermission', () => {
    it('should require authentication', async () => {
      mockReq.user = undefined;
      const middleware = checkPermission('users', 'read');

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow users with proper permissions', async () => {
      const middleware = checkPermission('users', 'read');

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ '?column?': 1 }],
        rowCount: 1
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should deny users without permissions', async () => {
      const middleware = checkPermission('users', 'delete');

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions for delete on users'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow users to access their own resources', async () => {
      const middleware = checkPermission('users', 'update', 'own');
      mockReq.params = { userId: '1' };

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should handle scope-based permissions', async () => {
      const middleware = checkPermission('users', 'read', 'department');

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ '?column?': 1 }],
        rowCount: 1
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['1', 'users', 'read', 'department']
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const middleware = checkPermission('users', 'read');

      (pool.query as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Permission check error'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});