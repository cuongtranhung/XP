import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Custom error class with additional metadata
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode = 500,
    isOperational = true,
    code?: string,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Async handler wrapper to catch async errors
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Default error values
  let statusCode = 500;
  let message = 'Internal Server Error';
  let isOperational = false;
  let code = 'INTERNAL_ERROR';
  let details = {};

  // Handle known AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
    code = err.code || code;
    details = err.details || {};
  }
  
  // Handle specific error types
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    code = 'VALIDATION_ERROR';
    isOperational = true;
    details = extractValidationErrors(err);
  }
  
  else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
    code = 'INVALID_ID';
    isOperational = true;
  }
  
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
    isOperational = true;
  }
  
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    code = 'TOKEN_EXPIRED';
    isOperational = true;
  }
  
  else if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    const mongoErr = handleMongoError(err);
    statusCode = mongoErr.statusCode;
    message = mongoErr.message;
    code = mongoErr.code;
    isOperational = mongoErr.isOperational;
  }
  
  // Log error
  const errorLog = {
    error: err.message,
    statusCode,
    code,
    isOperational,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    user: (req as any).user?.id,
    timestamp: new Date().toISOString()
  };

  if (!isOperational) {
    // Log critical errors
    logger.error('Critical Error:', errorLog);
    
    // Send alert for critical errors in production
    if (process.env.NODE_ENV === 'production') {
      sendErrorAlert(errorLog);
    }
  } else {
    // Log operational errors
    logger.warn('Operational Error:', errorLog);
  }

  // Send error response
  const response: any = {
    success: false,
    error: {
      message,
      code,
      statusCode
    }
  };

  // Add details in development
  if (process.env.NODE_ENV === 'development') {
    response.error.details = details;
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

/**
 * 404 handler
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new AppError(
    `Route ${req.originalUrl} not found`,
    404,
    true,
    'ROUTE_NOT_FOUND'
  );
  next(error);
};

/**
 * Handle uncaught exceptions
 */
export const handleUncaughtException = () => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...', error);
    
    // Give time to log the error
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
};

/**
 * Handle unhandled promise rejections
 */
export const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('UNHANDLED REJECTION! 💥 Shutting down...', reason);
    
    // Give time to log the error
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
};

/**
 * Helper functions
 */
function extractValidationErrors(err: any): any {
  const errors: any = {};
  
  if (err.errors) {
    Object.keys(err.errors).forEach(key => {
      errors[key] = err.errors[key].message;
    });
  }
  
  return errors;
}

function handleMongoError(err: any): {
  statusCode: number;
  message: string;
  code: string;
  isOperational: boolean;
} {
  // Duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return {
      statusCode: 409,
      message: `${field} already exists`,
      code: 'DUPLICATE_KEY',
      isOperational: true
    };
  }
  
  // Validation error
  if (err.name === 'ValidationError') {
    return {
      statusCode: 400,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      isOperational: true
    };
  }
  
  // Default mongo error
  return {
    statusCode: 500,
    message: 'Database error',
    code: 'DATABASE_ERROR',
    isOperational: false
  };
}

function sendErrorAlert(error: any): void {
  // Implement your error alerting service here
  // Example: Send to Sentry, Slack, Email, etc.
  if (process.env.SENTRY_DSN) {
    // Sentry integration
  }
  if (process.env.SLACK_WEBHOOK) {
    // Slack notification
  }
}

export default {
  AppError,
  asyncHandler,
  errorHandler,
  notFoundHandler,
  handleUncaughtException,
  handleUnhandledRejection
};