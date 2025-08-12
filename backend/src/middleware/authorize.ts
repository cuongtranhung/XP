import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Simple role-based authorization middleware
export const authorize = (allowedRoles: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // For now, treat all authenticated users as having admin access
      // In a real implementation, you would check user roles from the database
      const userRoles = ['admin', 'user', 'system', 'developer']; // Mock roles
      
      // Check if user has any of the required roles
      const hasPermission = allowedRoles.length === 0 || 
                           allowedRoles.some(role => userRoles.includes(role));
      
      if (!hasPermission) {
        logger.logSecurity('Unauthorized access attempt', {
          userId: req.user.id,
          email: req.user.email,
          requiredRoles: allowedRoles,
          userRoles,
          ip: req.ip
        });
        
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      next();
    } catch (error) {
      logger.error('Authorization middleware error', { error });
      res.status(500).json({
        success: false,
        message: 'Authorization failed'
      });
    }
  };
};

export default authorize;