import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationError } from 'express-validator';
import { logger } from '../utils/logger';
import { sanitizeUserInput } from '../utils/validation';

// Validation error handler middleware
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error: ValidationError) => {
      return {
        field: error.type === 'field' ? (error as any).path : error.type,
        message: error.msg
      };
    });

    logger.logSecurity('Validation failed', {
      ip: req.ip,
      path: req.path,
      errors: errorMessages
    });

    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages
    });
    return;
  }

  next();
};

// Input sanitization middleware
export const sanitizeInput = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeUserInput(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeUserInput(req.query);
    }

    next();
  } catch (error) {
    logger.error('Input sanitization error', { error });
    res.status(500).json({
      success: false,
      message: 'Input processing failed'
    });
  }
};

// Request size limit middleware
export const requestSizeLimit = (maxSize: string = '10mb') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.get('content-length') || '0');
    const maxSizeBytes = parseSize(maxSize);

    if (contentLength > maxSizeBytes) {
      logger.logSecurity('Request size limit exceeded', {
        ip: req.ip,
        contentLength,
        maxSize
      });

      res.status(413).json({
        success: false,
        message: 'Request payload too large'
      });
      return;
    }

    next();
  };
};

// Parse size string (e.g., '10mb', '1gb') to bytes
function parseSize(size: string): number {
  const units: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024
  };

  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)(b|kb|mb|gb)$/);
  if (!match) {
    return 10 * 1024 * 1024; // Default 10MB
  }

  const value = parseFloat(match[1]);
  const unit = match[2];
  
  return Math.round(value * units[unit]);
}

// Content-Type validation middleware
export const validateContentType = (allowedTypes: string[] = ['application/json']) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const contentType = req.get('content-type');
    
    if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
      logger.logSecurity('Invalid content type', {
        ip: req.ip,
        contentType,
        allowedTypes
      });

      _res.status(415).json({
        success: false,
        message: 'Unsupported content type'
      });
      return;
    }

    next();
  };
};

// Request logging middleware
export const logRequest = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  logger.logRequest(req);
  next();
};