// Request validation middleware using express-validator
// Date: 2025-08-04

import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { logger } from '../utils/logger';

export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Log validation errors for security monitoring
    logger.warn('Request validation failed', {
      ip: req.ip,
      endpoint: req.originalUrl,
      method: req.method,
      userAgent: req.get('User-Agent'),
      errors: errors.array(),
      userId: req.userId
    });

    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: 'path' in error ? error.path : undefined,
        value: 'value' in error ? error.value : undefined,
        message: error.msg,
        location: 'location' in error ? error.location : undefined
      }))
    });
    return;
  }
  
  next();
};