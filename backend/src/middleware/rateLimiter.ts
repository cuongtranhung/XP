import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

// Rate limiting configuration
const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message: string;
  skipSuccessfulRequests?: boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      success: false,
      message: options.message
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    handler: (req: Request, res: Response) => {
      logger.logSecurity('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method
      });
      
      res.status(429).json({
        success: false,
        message: options.message
      });
    }
  });
};

// Login rate limiter - 5 attempts per 15 minutes
export const loginRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.LOGIN_RATE_LIMIT ?? '5'),
  message: 'Too many login attempts. Please try again in 15 minutes.',
  skipSuccessfulRequests: true
});

// Registration rate limiter - 3 attempts per hour
export const registerRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.REGISTER_RATE_LIMIT ?? '3'),
  message: 'Too many registration attempts. Please try again in 1 hour.'
});

// Forgot password rate limiter - 3 attempts per hour
export const forgotPasswordRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.FORGOT_PASSWORD_RATE_LIMIT ?? '3'),
  message: 'Too many password reset requests. Please try again in 1 hour.'
});

// Reset password rate limiter - 5 attempts per 15 minutes
export const resetPasswordRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RESET_PASSWORD_RATE_LIMIT ?? '5'),
  message: 'Too many password reset attempts. Please try again in 15 minutes.'
});

// General API rate limiter - 100 requests per 15 minutes
export const generalRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.GENERAL_RATE_LIMIT ?? '100'),
  message: 'Too many requests. Please slow down.'
});

// Strict rate limiter for sensitive operations
export const strictRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1,
  message: 'Please wait 1 hour before trying again.'
});

// Form Builder specific rate limiters
export const formBuilderRateLimits = {
  // Form creation - 20 forms per hour per user
  formCreation: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: parseInt(process.env.FORM_CREATION_RATE_LIMIT ?? '20'),
    message: 'Too many forms created. Please wait before creating more forms.'
  }),

  // Form submission - 50 submissions per hour per IP
  formSubmission: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: parseInt(process.env.FORM_SUBMISSION_RATE_LIMIT ?? '50'),
    message: 'Too many form submissions. Please wait before submitting again.'
  }),

  // Public stats viewing - 200 requests per hour per IP
  publicStats: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: parseInt(process.env.PUBLIC_STATS_RATE_LIMIT ?? '200'),
    message: 'Too many statistics requests. Please wait before viewing more stats.'
  }),

  // Form cloning - 10 clones per hour per user
  formCloning: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: parseInt(process.env.FORM_CLONING_RATE_LIMIT ?? '10'),
    message: 'Too many form clones. Please wait before cloning more forms.'
  }),

  // Export operations - 5 exports per hour per user
  dataExport: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: parseInt(process.env.DATA_EXPORT_RATE_LIMIT ?? '5'),
    message: 'Too many export requests. Please wait before exporting more data.'
  }),

  // Form updates - 100 updates per hour per user
  formUpdate: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: parseInt(process.env.FORM_UPDATE_RATE_LIMIT ?? '100'),
    message: 'Too many form updates. Please wait before updating more forms.'
  }),

  // Bulk operations - 10 operations per hour per user
  bulkOperations: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: parseInt(process.env.BULK_OPERATIONS_RATE_LIMIT ?? '10'),
    message: 'Too many bulk operations. Please wait before performing more bulk actions.'
  })
};

// Default export for backwards compatibility
export default createRateLimiter;