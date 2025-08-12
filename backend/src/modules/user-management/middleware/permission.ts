import { Request, Response, NextFunction } from 'express';
import { pool } from '../../../utils/database';

export const checkPermission = (resource: string, action: string, scope?: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
      }

      // Check if user has the required permission through their roles
      const query = `
        SELECT DISTINCT 1
        FROM user_permissions_view
        WHERE user_id = $1
          AND resource = $2
          AND action = $3
          AND ($4::VARCHAR IS NULL OR scope = $4 OR scope = 'all')
        LIMIT 1
      `;

      const result = await pool.query(query, [
        req.user.id,
        resource,
        action,
        scope || null
      ]);

      if (result.rows.length > 0) {
        // User has permission
        return next();
      } else {
        // Check if user is trying to access their own resource
        if (scope === 'own' && req.params.userId === String(req.user.id)) {
          return next();
        } else {
          return res.status(403).json({ 
            success: false, 
            message: `Insufficient permissions for ${action} on ${resource}` 
          });
        }
      }
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Permission check error' 
      });
    }
  };
};