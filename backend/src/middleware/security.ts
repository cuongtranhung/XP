/**
 * Security Headers and CORS Configuration
 * Enhanced security middleware for the application
 */

import { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from '../utils/logger';

/**
 * CORS configuration for multi-user access
 */
export const corsConfig = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'https://localhost:3000',
      // Add production domains here
    ];

    // Allow all origins in development
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request', { origin, allowedOrigins });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma',
    'X-CSRF-Token'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining', 
    'X-RateLimit-Reset'
  ],
  optionsSuccessStatus: 200 // Support legacy browsers
});

/**
 * Security headers configuration
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for form sharing
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

/**
 * Request sanitization middleware
 */
export const sanitizeRequest = (req: Request, res: Response, next: NextFunction): void => {
  // Remove potential XSS vectors from query parameters
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        // Basic XSS protection
        req.query[key] = value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      }
    }
  }

  // Log suspicious patterns
  const userAgent = req.get('User-Agent') || '';
  const suspiciousPatterns = [
    /sqlmap/i,
    /nmap/i,
    /nikto/i,
    /burp/i,
    /scanner/i,
    /<script/i,
    /union.*select/i,
    /or.*1.*=.*1/i
  ];

  if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
    logger.warn('Suspicious user agent detected', {
      ip: req.ip,
      userAgent,
      path: req.path
    });
  }

  next();
};

/**
 * IP whitelist middleware for sensitive operations
 */
export const ipWhitelist = (whitelist: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIp = req.ip || req.connection.remoteAddress;
    
    // Allow all IPs in development
    if (process.env.NODE_ENV === 'development') {
      return next();
    }

    // Check if IP is whitelisted
    if (whitelist.length > 0 && !whitelist.includes(clientIp || '')) {
      logger.warn('IP not whitelisted', {
        ip: clientIp,
        path: req.path,
        whitelist
      });
      
      res.status(403).json({
        success: false,
        error: {
          code: 'IP_NOT_ALLOWED',
          message: 'Access denied from this IP address'
        }
      });
      return;
    }

    next();
  };
};

/**
 * Request size limitation
 */
export const limitRequestSize = (maxSize: number = 10 * 1024 * 1024) => { // 10MB default
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.get('content-length') || '0');
    
    if (contentLength > maxSize) {
      logger.warn('Request too large', {
        ip: req.ip,
        contentLength,
        maxSize,
        path: req.path
      });
      
      res.status(413).json({
        success: false,
        error: {
          code: 'REQUEST_TOO_LARGE',
          message: `Request size exceeds limit of ${Math.round(maxSize / 1024 / 1024)}MB`
        }
      });
      return;
    }

    next();
  };
};

/**
 * Detect and block bot requests
 */
export const botProtection = (req: Request, res: Response, next: NextFunction): void => {
  const userAgent = req.get('User-Agent') || '';
  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python-requests/i,
    /go-http-client/i
  ];

  // Allow legitimate bots but rate limit them more strictly
  if (botPatterns.some(pattern => pattern.test(userAgent))) {
    logger.info('Bot request detected', {
      ip: req.ip,
      userAgent,
      path: req.path
    });
    
    // You could implement stricter rate limiting here
    // For now, just log and continue
  }

  next();
};

/**
 * Enhanced logging for security events
 */
export const securityLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Log all requests to sensitive endpoints
  const sensitiveEndpoints = [
    '/auth/login',
    '/auth/register', 
    '/forms',
    '/submissions',
    '/api/forms',
    '/api/submissions'
  ];

  if (sensitiveEndpoints.some(endpoint => req.path.includes(endpoint))) {
    logger.info('Security: Sensitive endpoint access', {
      ip: req.ip,
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.id,
      timestamp: new Date().toISOString()
    });
  }

  next();
};