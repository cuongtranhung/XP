/**
 * Security Middleware for Form Builder
 * Additional security checks and validations
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../../utils/logger';
import { DynamicFormBuilderError, XPAuthenticatedRequest } from '../types';

/**
 * Validate form content for malicious patterns
 */
export const validateFormContent = (req: XPAuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const { fields, description, name } = req.body;

    // Check for script injection attempts
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /data:text\/html/gi,
      /<iframe/gi,
      /<object/gi,
      /<embed/gi
    ];

    const checkContent = (content: string): boolean => {
      return dangerousPatterns.some(pattern => pattern.test(content));
    };

    // Validate text fields
    if (name && checkContent(name)) {
      logger.warn('Malicious content detected in form name', {
        userId: req.user?.id,
        content: name
      });
      throw new DynamicFormBuilderError('Invalid content in form name', 'INVALID_CONTENT', 400);
    }

    if (description && checkContent(description)) {
      logger.warn('Malicious content detected in form description', {
        userId: req.user?.id,
        content: description
      });
      throw new DynamicFormBuilderError('Invalid content in form description', 'INVALID_CONTENT', 400);
    }

    // Validate form fields
    if (fields && Array.isArray(fields)) {
      for (const field of fields) {
        if (field.label && checkContent(field.label)) {
          logger.warn('Malicious content detected in field label', {
            userId: req.user?.id,
            fieldId: field.id || field.fieldKey,
            content: field.label
          });
          throw new DynamicFormBuilderError('Invalid content in form field', 'INVALID_CONTENT', 400);
        }

        if (field.placeholder && checkContent(field.placeholder)) {
          logger.warn('Malicious content detected in field placeholder', {
            userId: req.user?.id,
            fieldId: field.id || field.fieldKey,
            content: field.placeholder
          });
          throw new DynamicFormBuilderError('Invalid content in form field', 'INVALID_CONTENT', 400);
        }

        if (field.defaultValue && typeof field.defaultValue === 'string' && checkContent(field.defaultValue)) {
          logger.warn('Malicious content detected in field default value', {
            userId: req.user?.id,
            fieldId: field.id || field.fieldKey,
            content: field.defaultValue
          });
          throw new DynamicFormBuilderError('Invalid content in form field', 'INVALID_CONTENT', 400);
        }

        // Check field options
        if (field.options && Array.isArray(field.options)) {
          for (const option of field.options) {
            if (option.label && checkContent(option.label)) {
              logger.warn('Malicious content detected in field option', {
                userId: req.user?.id,
                fieldId: field.id || field.fieldKey,
                content: option.label
              });
              throw new DynamicFormBuilderError('Invalid content in form field option', 'INVALID_CONTENT', 400);
            }
          }
        }
      }
    }

    next();
  } catch (error) {
    if (error instanceof DynamicFormBuilderError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    } else {
      logger.error('Security validation error', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: {
          code: 'SECURITY_CHECK_FAILED',
          message: 'Security validation failed'
        }
      });
    }
  }
};

/**
 * Validate form submission content
 */
export const validateSubmissionContent = (req: XPAuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const { data } = req.body;

    if (!data || typeof data !== 'object') {
      next();
      return;
    }

    // Check for script injection in submission data
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /data:text\/html/gi,
      /<iframe/gi,
      /<object/gi,
      /<embed/gi
    ];

    const checkContent = (content: string): boolean => {
      return dangerousPatterns.some(pattern => pattern.test(content));
    };

    // Check all submission values
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' && checkContent(value)) {
        logger.warn('Malicious content detected in form submission', {
          userId: req.user?.id,
          formId: req.params.formId,
          field: key,
          content: value
        });
        throw new DynamicFormBuilderError('Invalid content in form submission', 'INVALID_SUBMISSION_CONTENT', 400);
      }

      // Check array values
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && checkContent(item)) {
            logger.warn('Malicious content detected in form submission array', {
              userId: req.user?.id,
              formId: req.params.formId,
              field: key,
              content: item
            });
            throw new DynamicFormBuilderError('Invalid content in form submission', 'INVALID_SUBMISSION_CONTENT', 400);
          }
        }
      }
    }

    next();
  } catch (error) {
    if (error instanceof DynamicFormBuilderError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    } else {
      logger.error('Submission security validation error', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: {
          code: 'SECURITY_CHECK_FAILED',
          message: 'Security validation failed'
        }
      });
    }
  }
};

/**
 * Log security events for monitoring
 */
export const logSecurityEvent = (eventType: string, details: any) => {
  return (req: XPAuthenticatedRequest, res: Response, next: NextFunction): void => {
    logger.info(`Security event: ${eventType}`, {
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      ...details
    });
    next();
  };
};

/**
 * Validate file upload security
 */
export const validateFileUpload = (req: XPAuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    if (!req.files && !req.file) {
      next();
      return;
    }

    const files = req.files ? (Array.isArray(req.files) ? req.files : [req.files]) : [req.file];
    const allowedMimeTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json',
      'text/plain'
    ];

    const maxFileSize = 10 * 1024 * 1024; // 10MB

    for (const file of files) {
      if (!file) continue;

      // Check file size
      if (file.size > maxFileSize) {
        logger.warn('File too large', {
          userId: req.user?.id,
          filename: file.originalname || file.name,
          size: file.size
        });
        throw new DynamicFormBuilderError('File too large. Maximum size is 10MB', 'FILE_TOO_LARGE', 400);
      }

      // Check MIME type
      if (!allowedMimeTypes.includes(file.mimetype || file.type)) {
        logger.warn('Invalid file type', {
          userId: req.user?.id,
          filename: file.originalname || file.name,
          mimetype: file.mimetype || file.type
        });
        throw new DynamicFormBuilderError('Invalid file type. Only CSV, Excel, JSON and text files are allowed', 'INVALID_FILE_TYPE', 400);
      }

      // Check for malicious filenames
      const dangerousPatterns = [
        /\.exe$/i,
        /\.bat$/i,
        /\.cmd$/i,
        /\.scr$/i,
        /\.pif$/i,
        /\.jar$/i,
        /\.js$/i,
        /\.php$/i,
        /\.asp$/i,
        /\.jsp$/i
      ];

      const filename = file.originalname || file.name || '';
      if (dangerousPatterns.some(pattern => pattern.test(filename))) {
        logger.warn('Dangerous file extension detected', {
          userId: req.user?.id,
          filename
        });
        throw new DynamicFormBuilderError('File type not allowed for security reasons', 'DANGEROUS_FILE_TYPE', 400);
      }
    }

    next();
  } catch (error) {
    if (error instanceof DynamicFormBuilderError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    } else {
      logger.error('File upload security validation error', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: {
          code: 'SECURITY_CHECK_FAILED',
          message: 'File security validation failed'
        }
      });
    }
  }
};