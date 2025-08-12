/**
 * Enhanced Error Handler Utility
 * Provides consistent error handling and response formatting
 */

import { Response } from 'express';
import { ValidationError } from 'express-validator';
import { logger } from '../../../utils/logger';
import { DynamicFormBuilderError } from '../types';

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp?: string;
    requestId?: string;
  };
}

/**
 * Error codes enum for consistency
 */
export enum ErrorCode {
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_FIELD = 'MISSING_FIELD',
  
  // Authentication & Authorization
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  FORM_NOT_FOUND = 'FORM_NOT_FOUND',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',
  
  // Business logic errors
  LIMIT_EXCEEDED = 'LIMIT_EXCEEDED',
  INVALID_STATE = 'INVALID_STATE',
  OPERATION_FAILED = 'OPERATION_FAILED',
  
  // System errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  TIMEOUT = 'TIMEOUT'
}

/**
 * Enhanced error handler with better error classification
 */
export class ErrorHandler {
  private static requestIdCounter = 0;

  /**
   * Generate unique request ID for error tracking
   */
  private static generateRequestId(): string {
    const timestamp = Date.now();
    const counter = ++this.requestIdCounter;
    return `err_${timestamp}_${counter}`;
  }

  /**
   * Handle validation errors from express-validator
   */
  static handleValidationError(
    errors: ValidationError[],
    res: Response,
    context?: string
  ): void {
    const requestId = this.generateRequestId();
    
    logger.warn('Validation error', {
      requestId,
      context,
      errors,
      timestamp: new Date().toISOString()
    });

    const response: ErrorResponse = {
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        details: errors.map(err => ({
          field: 'param' in err ? err.param : 'unknown',
          message: err.msg,
          value: 'value' in err ? err.value : undefined
        })),
        timestamp: new Date().toISOString(),
        requestId
      }
    };

    res.status(400).json(response);
  }

  /**
   * Handle authentication errors
   */
  static handleAuthError(res: Response, message = 'Authentication required'): void {
    const requestId = this.generateRequestId();
    
    logger.warn('Authentication error', {
      requestId,
      timestamp: new Date().toISOString()
    });

    const response: ErrorResponse = {
      success: false,
      error: {
        code: ErrorCode.AUTHENTICATION_REQUIRED,
        message,
        timestamp: new Date().toISOString(),
        requestId
      }
    };

    res.status(401).json(response);
  }

  /**
   * Handle not found errors
   */
  static handleNotFound(
    res: Response,
    resource = 'Resource',
    id?: string
  ): void {
    const requestId = this.generateRequestId();
    
    logger.info('Resource not found', {
      requestId,
      resource,
      id,
      timestamp: new Date().toISOString()
    });

    const response: ErrorResponse = {
      success: false,
      error: {
        code: ErrorCode.NOT_FOUND,
        message: `${resource} not found`,
        details: id ? { id } : undefined,
        timestamp: new Date().toISOString(),
        requestId
      }
    };

    res.status(404).json(response);
  }

  /**
   * Handle general errors with proper classification
   */
  static handleError(
    error: any,
    res: Response,
    defaultMessage: string,
    context?: any
  ): void {
    const requestId = this.generateRequestId();

    // Handle custom DynamicFormBuilderError
    if (error instanceof DynamicFormBuilderError) {
      logger.warn('Business logic error', {
        requestId,
        code: error.code,
        message: error.message,
        details: error.details,
        context,
        timestamp: new Date().toISOString()
      });

      const response: ErrorResponse = {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          timestamp: new Date().toISOString(),
          requestId
        }
      };

      res.status(error.statusCode).json(response);
      return;
    }

    // Handle database errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      logger.error('Database connection error', {
        requestId,
        error: error.message,
        code: error.code,
        context,
        timestamp: new Date().toISOString()
      });

      const response: ErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.DATABASE_ERROR,
          message: 'Database connection error. Please try again later.',
          timestamp: new Date().toISOString(),
          requestId
        }
      };

      res.status(503).json(response);
      return;
    }

    // Handle duplicate key errors (PostgreSQL)
    if (error.code === '23505') {
      logger.warn('Duplicate resource error', {
        requestId,
        error: error.message,
        detail: error.detail,
        context,
        timestamp: new Date().toISOString()
      });

      const response: ErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.DUPLICATE_RESOURCE,
          message: 'Resource already exists',
          details: error.detail,
          timestamp: new Date().toISOString(),
          requestId
        }
      };

      res.status(409).json(response);
      return;
    }

    // Handle foreign key constraint errors (PostgreSQL)
    if (error.code === '23503') {
      logger.warn('Foreign key constraint error', {
        requestId,
        error: error.message,
        detail: error.detail,
        context,
        timestamp: new Date().toISOString()
      });

      const response: ErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.INVALID_INPUT,
          message: 'Invalid reference to related resource',
          details: error.detail,
          timestamp: new Date().toISOString(),
          requestId
        }
      };

      res.status(400).json(response);
      return;
    }

    // Log unexpected errors with full details
    logger.error('Unexpected error', {
      requestId,
      message: error.message,
      stack: error.stack,
      code: error.code,
      context,
      defaultMessage,
      timestamp: new Date().toISOString()
    });

    // Generic error response (don't expose internal details)
    const response: ErrorResponse = {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: process.env.NODE_ENV === 'production' 
          ? 'An unexpected error occurred. Please try again later.'
          : error.message || defaultMessage,
        timestamp: new Date().toISOString(),
        requestId
      }
    };

    res.status(500).json(response);
  }

  /**
   * Create a standardized success response
   */
  static successResponse<T>(data: T, message?: string): {
    success: true;
    data: T;
    message?: string;
    timestamp: string;
  } {
    return {
      success: true,
      data,
      ...(message && { message }),
      timestamp: new Date().toISOString()
    };
  }
}