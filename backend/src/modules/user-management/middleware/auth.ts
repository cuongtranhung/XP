import { Request, Response, NextFunction } from 'express';
import { pool } from '../../../utils/database';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        full_name: string;
        email_verified: boolean;
        created_at: Date;
        updated_at: Date;
        roles?: string[];
      };
    }
  }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      // Check for session token (fallback for existing auth)
      const sessionToken = req.headers['x-session-token'] as string;
      if (!sessionToken) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
      }

      // Validate session token
      const sessionResult = await pool.query(
        'SELECT user_id FROM user_sessions WHERE id = $1 AND is_active = true AND expires_at > NOW()',
        [sessionToken]
      );

      if (sessionResult.rows.length === 0) {
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid or expired session' 
        });
      }

      // Get user details
      const userResult = await pool.query(
        'SELECT id, email FROM users WHERE id = $1 AND deleted_at IS NULL',
        [sessionResult.rows[0].user_id]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({ 
          success: false, 
          message: 'User not found' 
        });
      }

      // Attach user to request
      req.user = {
        id: userResult.rows[0].id.toString(),
        email: userResult.rows[0].email,
        full_name: userResult.rows[0].full_name || '',
        email_verified: userResult.rows[0].email_verified || false,
        created_at: userResult.rows[0].created_at || new Date(),
        updated_at: userResult.rows[0].updated_at || new Date()
      };

      // Set user ID for RLS (Row Level Security)
      if (req.user) {
        await pool.query(`SET LOCAL app.current_user_id = '${req.user.id}'`);
      }

      next();
    } else {
      // TODO: Implement JWT token validation when JWT is added
      return res.status(401).json({ 
        success: false, 
        message: 'JWT authentication not yet implemented' 
      });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Authentication error' 
    });
  }
};