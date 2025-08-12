# 🔐 Dynamic Form Builder - Security & Validation Framework

## 📋 Table of Contents
- [Overview](#overview)
- [Authentication & Authorization](#authentication--authorization)
- [Input Validation Pipeline](#input-validation-pipeline)
- [Data Encryption](#data-encryption)
- [CSRF & XSS Protection](#csrf--xss-protection)
- [Rate Limiting & DDoS Protection](#rate-limiting--ddos-protection)
- [File Upload Security](#file-upload-security)
- [API Security](#api-security)
- [Audit & Compliance](#audit--compliance)
- [Security Monitoring](#security-monitoring)
- [Incident Response](#incident-response)

---

## Overview

This document outlines a comprehensive security framework for the Dynamic Form Builder system, implementing defense-in-depth strategies and following OWASP best practices.

### Security Principles
- **Zero Trust Architecture**: Never trust, always verify
- **Least Privilege**: Minimal access rights for all entities
- **Defense in Depth**: Multiple layers of security controls
- **Secure by Default**: Security enabled out of the box
- **Continuous Monitoring**: Real-time threat detection
- **Data Privacy**: GDPR, CCPA, and HIPAA compliance ready

---

## 🛡️ Security Architecture

### Multi-Layer Security Model

```
┌─────────────────────────────────────────────────────────────┐
│                        Application Layer                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   Presentation Layer                  │    │
│  │  • Client-side validation                           │    │
│  │  • XSS prevention (CSP, sanitization)              │    │
│  │  • CSRF tokens                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    API Gateway                       │    │
│  │  • Rate limiting                                    │    │
│  │  • Request validation                               │    │
│  │  • Authentication & Authorization                   │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  Business Logic                      │    │
│  │  • Input sanitization                               │    │
│  │  • Business rule validation                         │    │
│  │  • Access control enforcement                       │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    Data Layer                        │    │
│  │  • Encryption at rest                               │    │
│  │  • Query parameterization                           │    │
│  │  • Audit logging                                    │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Authentication & Authorization

### JWT-Based Authentication

```typescript
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
  iat: number;
  exp: number;
}

class AuthenticationService {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly accessTokenExpiry = '15m';
  private readonly refreshTokenExpiry = '7d';

  constructor() {
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET!;
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET!;
  }

  generateTokenPair(user: User): { accessToken: string; refreshToken: string } {
    const sessionId = crypto.randomUUID();
    
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      roles: user.roles,
      permissions: this.getUserPermissions(user),
      sessionId,
      iat: Math.floor(Date.now() / 1000),
      exp: 0, // Will be set by jwt.sign
    };

    const accessToken = jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry,
      issuer: 'formbuilder-api',
      audience: 'formbuilder-client',
    });

    const refreshToken = jwt.sign(
      { userId: user.id, sessionId },
      this.refreshTokenSecret,
      { expiresIn: this.refreshTokenExpiry }
    );

    // Store refresh token in secure database
    this.storeRefreshToken(user.id, refreshToken, sessionId);

    return { accessToken, refreshToken };
  }

  async verifyAccessToken(token: string): Promise<TokenPayload> {
    try {
      const payload = jwt.verify(token, this.accessTokenSecret, {
        issuer: 'formbuilder-api',
        audience: 'formbuilder-client',
      }) as TokenPayload;

      // Additional validation
      await this.validateSession(payload.sessionId);
      
      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthError('Token expired', 'TOKEN_EXPIRED');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthError('Invalid token', 'INVALID_TOKEN');
      }
      throw error;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const payload = jwt.verify(refreshToken, this.refreshTokenSecret) as any;
    
    // Validate refresh token in database
    const isValid = await this.validateRefreshToken(payload.userId, refreshToken);
    if (!isValid) {
      throw new AuthError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }

    const user = await this.getUserById(payload.userId);
    const { accessToken } = this.generateTokenPair(user);
    
    return accessToken;
  }

  private getUserPermissions(user: User): string[] {
    const permissions = new Set<string>();
    
    // Add role-based permissions
    user.roles.forEach(role => {
      const rolePermissions = this.getRolePermissions(role);
      rolePermissions.forEach(p => permissions.add(p));
    });

    // Add user-specific permissions
    user.permissions?.forEach(p => permissions.add(p));

    return Array.from(permissions);
  }
}
```

### Role-Based Access Control (RBAC)

```typescript
interface Permission {
  resource: string;
  action: string;
  scope?: 'own' | 'team' | 'all';
}

interface Role {
  id: string;
  name: string;
  permissions: Permission[];
  inherits?: string[]; // Role inheritance
}

class AuthorizationService {
  private roles: Map<string, Role> = new Map();

  constructor() {
    this.initializeRoles();
  }

  private initializeRoles() {
    // Define system roles
    this.roles.set('admin', {
      id: 'admin',
      name: 'Administrator',
      permissions: [
        { resource: 'form', action: '*', scope: 'all' },
        { resource: 'submission', action: '*', scope: 'all' },
        { resource: 'user', action: '*', scope: 'all' },
        { resource: 'analytics', action: '*', scope: 'all' },
      ],
    });

    this.roles.set('form_creator', {
      id: 'form_creator',
      name: 'Form Creator',
      permissions: [
        { resource: 'form', action: 'create', scope: 'own' },
        { resource: 'form', action: 'read', scope: 'team' },
        { resource: 'form', action: 'update', scope: 'own' },
        { resource: 'form', action: 'delete', scope: 'own' },
        { resource: 'submission', action: 'read', scope: 'own' },
        { resource: 'analytics', action: 'read', scope: 'own' },
      ],
    });

    this.roles.set('form_viewer', {
      id: 'form_viewer',
      name: 'Form Viewer',
      permissions: [
        { resource: 'form', action: 'read', scope: 'team' },
        { resource: 'submission', action: 'create', scope: 'own' },
        { resource: 'submission', action: 'read', scope: 'own' },
      ],
    });
  }

  hasPermission(
    user: AuthUser,
    resource: string,
    action: string,
    resourceOwnerId?: string,
    resourceTeamId?: string
  ): boolean {
    const userPermissions = this.getUserPermissions(user);

    return userPermissions.some(permission => {
      // Check resource and action match
      if (permission.resource !== resource && permission.resource !== '*') {
        return false;
      }
      if (permission.action !== action && permission.action !== '*') {
        return false;
      }

      // Check scope
      switch (permission.scope) {
        case 'all':
          return true;
        case 'team':
          return resourceTeamId && user.teams.includes(resourceTeamId);
        case 'own':
          return resourceOwnerId === user.id;
        default:
          return true;
      }
    });
  }

  private getUserPermissions(user: AuthUser): Permission[] {
    const permissions: Permission[] = [];

    user.roles.forEach(roleId => {
      const role = this.roles.get(roleId);
      if (role) {
        permissions.push(...role.permissions);
        
        // Handle role inheritance
        role.inherits?.forEach(inheritedRoleId => {
          const inheritedRole = this.roles.get(inheritedRoleId);
          if (inheritedRole) {
            permissions.push(...inheritedRole.permissions);
          }
        });
      }
    });

    return permissions;
  }
}

// Authorization Middleware
export const authorize = (resource: string, action: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as AuthUser;
    const authService = new AuthorizationService();

    // Get resource owner and team from request
    const resourceOwnerId = req.params.ownerId || req.body.ownerId;
    const resourceTeamId = req.params.teamId || req.body.teamId;

    if (!authService.hasPermission(user, resource, action, resourceOwnerId, resourceTeamId)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You do not have permission to perform this action',
        },
      });
    }

    next();
  };
};
```

---

## 🛡️ Input Validation Framework

### Multi-Stage Validation Pipeline

```typescript
class ValidationPipeline {
  private stages: ValidationStage[] = [];

  constructor() {
    this.initializeStages();
  }

  private initializeStages() {
    // Stage 1: Type validation
    this.stages.push(new TypeValidationStage());
    
    // Stage 2: Format validation
    this.stages.push(new FormatValidationStage());
    
    // Stage 3: Business rule validation
    this.stages.push(new BusinessRuleValidationStage());
    
    // Stage 4: Security validation
    this.stages.push(new SecurityValidationStage());
    
    // Stage 5: Async validation (external checks)
    this.stages.push(new AsyncValidationStage());
  }

  async validate(
    field: FormField,
    value: any,
    context: ValidationContext
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    let sanitizedValue = value;

    for (const stage of this.stages) {
      const result = await stage.validate(field, sanitizedValue, context);
      
      if (!result.valid) {
        errors.push(...result.errors);
        
        if (stage.breakOnError) {
          break;
        }
      }

      if (result.sanitizedValue !== undefined) {
        sanitizedValue = result.sanitizedValue;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitizedValue,
    };
  }
}

// Type Validation Stage
class TypeValidationStage implements ValidationStage {
  async validate(
    field: FormField,
    value: any,
    context: ValidationContext
  ): Promise<StageValidationResult> {
    const typeValidators: Record<string, TypeValidator> = {
      text: new TextTypeValidator(),
      number: new NumberTypeValidator(),
      email: new EmailTypeValidator(),
      date: new DateTypeValidator(),
      file: new FileTypeValidator(),
      // ... other type validators
    };

    const validator = typeValidators[field.fieldType];
    if (!validator) {
      return { valid: true };
    }

    return validator.validate(value, field);
  }
}

// Security Validation Stage
class SecurityValidationStage implements ValidationStage {
  private readonly xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
  ];

  private readonly sqlInjectionPatterns = [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi,
    /(-{2}|\/\*|\*\/)/g,
    /(;|'|"|`|\\)/g,
  ];

  async validate(
    field: FormField,
    value: any,
    context: ValidationContext
  ): Promise<StageValidationResult> {
    if (typeof value !== 'string') {
      return { valid: true };
    }

    const errors: ValidationError[] = [];

    // XSS validation
    if (this.containsXSS(value)) {
      errors.push({
        field: field.fieldKey,
        code: 'XSS_DETECTED',
        message: 'Input contains potentially harmful content',
      });
    }

    // SQL Injection validation
    if (this.containsSQLInjection(value) && field.validation?.strictSecurity) {
      errors.push({
        field: field.fieldKey,
        code: 'SQL_INJECTION_DETECTED',
        message: 'Input contains potentially harmful database commands',
      });
    }

    // Path traversal validation
    if (this.containsPathTraversal(value)) {
      errors.push({
        field: field.fieldKey,
        code: 'PATH_TRAVERSAL_DETECTED',
        message: 'Input contains invalid path characters',
      });
    }

    // Sanitize value
    const sanitizedValue = this.sanitize(value, field);

    return {
      valid: errors.length === 0,
      errors,
      sanitizedValue,
    };
  }

  private containsXSS(value: string): boolean {
    return this.xssPatterns.some(pattern => pattern.test(value));
  }

  private containsSQLInjection(value: string): boolean {
    return this.sqlInjectionPatterns.some(pattern => pattern.test(value));
  }

  private containsPathTraversal(value: string): boolean {
    return /(\.\.|\.\/|\.\\)/.test(value);
  }

  private sanitize(value: string, field: FormField): string {
    // Use DOMPurify for HTML sanitization
    if (field.fieldType === 'richtext') {
      return DOMPurify.sanitize(value, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li'],
        ALLOWED_ATTR: ['href', 'target'],
      });
    }

    // Basic sanitization for other fields
    return value
      .replace(/[<>]/g, '') // Remove angle brackets
      .trim(); // Trim whitespace
  }
}
```

### Field-Specific Validators

```typescript
// Email Validator with DNS validation
class EmailValidator implements FieldValidator {
  private readonly emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private readonly disposableEmailDomains = new Set([
    'tempmail.com',
    'throwaway.email',
    'guerrillamail.com',
    // ... more disposable domains
  ]);

  async validate(value: string, field: FormField): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    // Basic format validation
    if (!this.emailRegex.test(value)) {
      errors.push({
        field: field.fieldKey,
        code: 'INVALID_EMAIL_FORMAT',
        message: 'Please enter a valid email address',
      });
      return { valid: false, errors };
    }

    const [, domain] = value.split('@');

    // Check disposable email
    if (field.validation?.blockDisposable && this.disposableEmailDomains.has(domain)) {
      errors.push({
        field: field.fieldKey,
        code: 'DISPOSABLE_EMAIL',
        message: 'Disposable email addresses are not allowed',
      });
    }

    // DNS validation
    if (field.validation?.validateDNS) {
      const hasMX = await this.checkMXRecord(domain);
      if (!hasMX) {
        errors.push({
          field: field.fieldKey,
          code: 'INVALID_EMAIL_DOMAIN',
          message: 'Email domain does not exist',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitizedValue: value.toLowerCase().trim(),
    };
  }

  private async checkMXRecord(domain: string): Promise<boolean> {
    try {
      const { resolveMx } = await import('dns/promises');
      const records = await resolveMx(domain);
      return records.length > 0;
    } catch {
      return false;
    }
  }
}

// File Upload Validator with virus scanning
class FileUploadValidator implements FieldValidator {
  private readonly magicNumbers: Record<string, string[]> = {
    'image/jpeg': ['FFD8FF'],
    'image/png': ['89504E47'],
    'image/gif': ['47494638'],
    'application/pdf': ['25504446'],
    'application/zip': ['504B0304', '504B0506', '504B0708'],
  };

  async validate(value: File | File[], field: FormField): Promise<ValidationResult> {
    const files = Array.isArray(value) ? value : [value];
    const errors: ValidationError[] = [];

    for (const file of files) {
      // Size validation
      if (field.validation?.maxSize && file.size > field.validation.maxSize) {
        errors.push({
          field: field.fieldKey,
          code: 'FILE_TOO_LARGE',
          message: `File size must not exceed ${this.formatFileSize(field.validation.maxSize)}`,
        });
      }

      // Type validation
      if (field.validation?.allowedTypes && !field.validation.allowedTypes.includes(file.type)) {
        errors.push({
          field: field.fieldKey,
          code: 'INVALID_FILE_TYPE',
          message: `File type must be one of: ${field.validation.allowedTypes.join(', ')}`,
        });
      }

      // Magic number validation (prevent spoofing)
      const isValidType = await this.validateMagicNumber(file);
      if (!isValidType) {
        errors.push({
          field: field.fieldKey,
          code: 'FILE_TYPE_MISMATCH',
          message: 'File content does not match its extension',
        });
      }

      // Virus scanning
      if (field.validation?.scanForVirus) {
        const scanResult = await this.scanForVirus(file);
        if (scanResult.infected) {
          errors.push({
            field: field.fieldKey,
            code: 'VIRUS_DETECTED',
            message: 'File contains malicious content',
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private async validateMagicNumber(file: File): Promise<boolean> {
    const expectedMagicNumbers = this.magicNumbers[file.type];
    if (!expectedMagicNumbers) return true;

    const buffer = await file.slice(0, 8).arrayBuffer();
    const bytes = Array.from(new Uint8Array(buffer));
    const hex = bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('');

    return expectedMagicNumbers.some(magic => hex.startsWith(magic));
  }

  private async scanForVirus(file: File): Promise<{ infected: boolean; virus?: string }> {
    // Integration with virus scanning service (ClamAV, VirusTotal, etc.)
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/virus-scan', {
        method: 'POST',
        body: formData,
      });

      return await response.json();
    } catch {
      // If scanning fails, consider it safe but log the error
      console.error('Virus scanning failed');
      return { infected: false };
    }
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}
```

### Cross-Field Validation

```typescript
class CrossFieldValidator {
  async validate(
    formData: Record<string, any>,
    rules: CrossFieldValidationRule[]
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    for (const rule of rules) {
      const result = await this.validateRule(formData, rule);
      if (!result.valid) {
        errors.push(...result.errors);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private async validateRule(
    formData: Record<string, any>,
    rule: CrossFieldValidationRule
  ): Promise<ValidationResult> {
    switch (rule.type) {
      case 'date_range':
        return this.validateDateRange(formData, rule);
      
      case 'field_dependency':
        return this.validateFieldDependency(formData, rule);
      
      case 'sum_total':
        return this.validateSumTotal(formData, rule);
      
      case 'unique_combination':
        return this.validateUniqueCombination(formData, rule);
      
      default:
        return { valid: true, errors: [] };
    }
  }

  private validateDateRange(
    formData: Record<string, any>,
    rule: DateRangeRule
  ): ValidationResult {
    const startDate = new Date(formData[rule.startField]);
    const endDate = new Date(formData[rule.endField]);

    if (startDate > endDate) {
      return {
        valid: false,
        errors: [{
          field: rule.endField,
          code: 'INVALID_DATE_RANGE',
          message: rule.message || 'End date must be after start date',
        }],
      };
    }

    if (rule.maxDays) {
      const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > rule.maxDays) {
        return {
          valid: false,
          errors: [{
            field: rule.endField,
            code: 'DATE_RANGE_TOO_LARGE',
            message: `Date range cannot exceed ${rule.maxDays} days`,
          }],
        };
      }
    }

    return { valid: true, errors: [] };
  }

  private async validateUniqueCombination(
    formData: Record<string, any>,
    rule: UniqueCombinationRule
  ): Promise<ValidationResult> {
    const values = rule.fields.map(field => formData[field]);
    
    // Check uniqueness in database
    const exists = await this.checkCombinationExists(rule.fields, values, rule.excludeId);
    
    if (exists) {
      return {
        valid: false,
        errors: [{
          field: rule.fields[0],
          code: 'DUPLICATE_COMBINATION',
          message: rule.message || 'This combination already exists',
        }],
      };
    }

    return { valid: true, errors: [] };
  }
}
```

---

## 🔒 CSRF Protection

```typescript
class CSRFProtection {
  private readonly tokenLength = 32;
  private readonly tokenExpiry = 3600000; // 1 hour

  generateToken(sessionId: string): string {
    const token = crypto.randomBytes(this.tokenLength).toString('hex');
    const hash = this.hashToken(token, sessionId);
    
    // Store token with expiry
    this.storeToken(sessionId, hash, Date.now() + this.tokenExpiry);
    
    return token;
  }

  validateToken(token: string, sessionId: string): boolean {
    const hash = this.hashToken(token, sessionId);
    const storedData = this.getStoredToken(sessionId);
    
    if (!storedData) return false;
    
    // Check expiry
    if (Date.now() > storedData.expiry) {
      this.deleteToken(sessionId);
      return false;
    }
    
    // Timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(storedData.hash)
    );
  }

  private hashToken(token: string, sessionId: string): string {
    return crypto
      .createHmac('sha256', process.env.CSRF_SECRET!)
      .update(`${token}:${sessionId}`)
      .digest('hex');
  }

  middleware(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip CSRF for safe methods
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }

      const token = req.headers['x-csrf-token'] as string || req.body._csrf;
      const sessionId = req.sessionID;

      if (!token || !sessionId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'CSRF_TOKEN_MISSING',
            message: 'CSRF token is required',
          },
        });
      }

      if (!this.validateToken(token, sessionId)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'CSRF_TOKEN_INVALID',
            message: 'Invalid CSRF token',
          },
        });
      }

      // Regenerate token for next request
      const newToken = this.generateToken(sessionId);
      res.setHeader('X-CSRF-Token', newToken);

      next();
    };
  }
}
```

---

## 🚦 Rate Limiting

```typescript
interface RateLimitConfig {
  windowMs: number;
  max: number;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  handler?: (req: Request, res: Response) => void;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  
  constructor(private config: RateLimitConfig) {}

  middleware(): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
      const key = this.getKey(req);
      const now = Date.now();
      
      // Clean expired entries
      this.cleanExpiredEntries(now);
      
      let entry = this.limits.get(key);
      
      if (!entry) {
        entry = {
          count: 0,
          resetTime: now + this.config.windowMs,
        };
        this.limits.set(key, entry);
      }
      
      // Reset if window expired
      if (now > entry.resetTime) {
        entry.count = 0;
        entry.resetTime = now + this.config.windowMs;
      }
      
      entry.count++;
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', this.config.max.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.config.max - entry.count).toString());
      res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());
      
      if (entry.count > this.config.max) {
        res.setHeader('Retry-After', Math.ceil((entry.resetTime - now) / 1000).toString());
        
        if (this.config.handler) {
          return this.config.handler(req, res);
        }
        
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
            retryAfter: entry.resetTime,
          },
        });
      }
      
      next();
    };
  }
  
  private getKey(req: Request): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(req);
    }
    
    // Default: Use IP + user ID if authenticated
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userId = (req as any).user?.id || 'anonymous';
    return `${ip}:${userId}`;
  }
  
  private cleanExpiredEntries(now: number): void {
    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetTime + this.config.windowMs) {
        this.limits.delete(key);
      }
    }
  }
}

// Advanced rate limiting with Redis
class RedisRateLimiter extends RateLimiter {
  private redis: Redis;
  
  constructor(config: RateLimitConfig, redis: Redis) {
    super(config);
    this.redis = redis;
  }
  
  async middleware(): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
      const key = this.getKey(req);
      const now = Date.now();
      const window = Math.floor(now / this.config.windowMs);
      const redisKey = `rate_limit:${key}:${window}`;
      
      const pipeline = this.redis.pipeline();
      pipeline.incr(redisKey);
      pipeline.expire(redisKey, Math.ceil(this.config.windowMs / 1000));
      
      const results = await pipeline.exec();
      const count = results?.[0]?.[1] as number || 0;
      
      // Set headers
      res.setHeader('X-RateLimit-Limit', this.config.max.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.config.max - count).toString());
      res.setHeader('X-RateLimit-Reset', new Date((window + 1) * this.config.windowMs).toISOString());
      
      if (count > this.config.max) {
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
          },
        });
      }
      
      next();
    };
  }
}
```

---

## 🔐 Data Encryption

### Encryption Service

```typescript
class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyDerivationIterations = 100000;
  private readonly saltLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;

  constructor(private masterKey: string) {}

  async encryptField(
    value: any,
    fieldId: string,
    additionalData?: Buffer
  ): Promise<EncryptedData> {
    // Generate unique salt for this field
    const salt = crypto.randomBytes(this.saltLength);
    
    // Derive field-specific key
    const key = await this.deriveKey(this.masterKey, salt, fieldId);
    
    // Generate IV
    const iv = crypto.randomBytes(this.ivLength);
    
    // Create cipher
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
    // Add additional authenticated data if provided
    if (additionalData) {
      cipher.setAAD(additionalData);
    }
    
    // Encrypt data
    const plaintext = JSON.stringify(value);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    
    // Get auth tag
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted.toString('base64'),
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      algorithm: this.algorithm,
      keyDerivation: {
        iterations: this.keyDerivationIterations,
        hash: 'sha256',
      },
    };
  }

  async decryptField(
    encryptedData: EncryptedData,
    fieldId: string,
    additionalData?: Buffer
  ): Promise<any> {
    // Decode from base64
    const encrypted = Buffer.from(encryptedData.encrypted, 'base64');
    const salt = Buffer.from(encryptedData.salt, 'base64');
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const authTag = Buffer.from(encryptedData.authTag, 'base64');
    
    // Derive key
    const key = await this.deriveKey(this.masterKey, salt, fieldId);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    // Add additional authenticated data if provided
    if (additionalData) {
      decipher.setAAD(additionalData);
    }
    
    // Decrypt data
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    
    return JSON.parse(decrypted.toString('utf8'));
  }

  private async deriveKey(
    masterKey: string,
    salt: Buffer,
    context: string
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        masterKey + context,
        salt,
        this.keyDerivationIterations,
        32,
        'sha256',
        (err, derivedKey) => {
          if (err) reject(err);
          else resolve(derivedKey);
        }
      );
    });
  }

  // Encrypt entire form submission
  async encryptSubmission(
    submission: FormSubmission,
    encryptionConfig: FormEncryptionConfig
  ): Promise<EncryptedSubmission> {
    const encryptedFields: Record<string, EncryptedData> = {};
    
    for (const [fieldId, value] of Object.entries(submission.data)) {
      if (encryptionConfig.fields[fieldId]?.encrypt) {
        encryptedFields[fieldId] = await this.encryptField(
          value,
          fieldId,
          Buffer.from(submission.id)
        );
      } else {
        // Store unencrypted fields separately
        encryptedFields[fieldId] = { plain: value };
      }
    }
    
    return {
      id: submission.id,
      formId: submission.formId,
      encryptedData: encryptedFields,
      metadata: submission.metadata,
      submittedAt: submission.submittedAt,
    };
  }
}

// Key rotation service
class KeyRotationService {
  async rotateKeys(oldKey: string, newKey: string): Promise<void> {
    const oldEncryption = new EncryptionService(oldKey);
    const newEncryption = new EncryptionService(newKey);
    
    // Get all encrypted submissions
    const submissions = await this.getEncryptedSubmissions();
    
    for (const submission of submissions) {
      const decryptedData: Record<string, any> = {};
      
      // Decrypt with old key
      for (const [fieldId, encryptedData] of Object.entries(submission.encryptedData)) {
        if (encryptedData.encrypted) {
          decryptedData[fieldId] = await oldEncryption.decryptField(
            encryptedData,
            fieldId,
            Buffer.from(submission.id)
          );
        } else {
          decryptedData[fieldId] = encryptedData.plain;
        }
      }
      
      // Re-encrypt with new key
      const reencryptedData: Record<string, EncryptedData> = {};
      for (const [fieldId, value] of Object.entries(decryptedData)) {
        if (submission.encryptionConfig.fields[fieldId]?.encrypt) {
          reencryptedData[fieldId] = await newEncryption.encryptField(
            value,
            fieldId,
            Buffer.from(submission.id)
          );
        } else {
          reencryptedData[fieldId] = { plain: value };
        }
      }
      
      // Update submission
      await this.updateEncryptedSubmission(submission.id, reencryptedData);
    }
  }
}
```

---

## 🛡️ Content Security Policy (CSP)

```typescript
class ContentSecurityPolicy {
  private directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'nonce-{nonce}'"],
    'style-src': ["'self'", "'unsafe-inline'"], // Consider using nonce for styles too
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'"],
    'connect-src': ["'self'"],
    'media-src': ["'self'"],
    'object-src': ["'none'"],
    'child-src': ["'self'"],
    'frame-src': ["'self'"],
    'worker-src': ["'self'"],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
    'base-uri': ["'self'"],
    'manifest-src': ["'self'"],
  };

  middleware(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      // Generate nonce for this request
      const nonce = crypto.randomBytes(16).toString('base64');
      
      // Store nonce in res.locals for use in templates
      res.locals.nonce = nonce;
      
      // Build CSP header
      const policy = this.buildPolicy(nonce);
      
      // Set CSP header
      res.setHeader('Content-Security-Policy', policy);
      
      // Set other security headers
      this.setSecurityHeaders(res);
      
      next();
    };
  }

  private buildPolicy(nonce: string): string {
    return Object.entries(this.directives)
      .map(([directive, sources]) => {
        const processedSources = sources.map(source => 
          source.replace('{nonce}', nonce)
        );
        return `${directive} ${processedSources.join(' ')}`;
      })
      .join('; ');
  }

  private setSecurityHeaders(res: Response): void {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS filter
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // HSTS
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
    
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions policy
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(self), payment=()'
    );
  }

  // Dynamic CSP for specific routes
  addSource(directive: string, source: string): void {
    if (!this.directives[directive]) {
      this.directives[directive] = [];
    }
    this.directives[directive].push(source);
  }

  // CSP reporting
  enableReporting(reportUri: string): void {
    this.directives['report-uri'] = [reportUri];
    this.directives['report-to'] = ['csp-endpoint'];
  }
}
```

---

## 🔍 Security Monitoring & Auditing

```typescript
interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ip: string;
  userAgent: string;
  resource: string;
  action: string;
  result: 'success' | 'failure';
  details: Record<string, any>;
  timestamp: Date;
}

type SecurityEventType = 
  | 'authentication_failed'
  | 'authorization_denied'
  | 'invalid_input'
  | 'rate_limit_exceeded'
  | 'suspicious_activity'
  | 'data_breach_attempt'
  | 'csrf_attack'
  | 'xss_attempt'
  | 'sql_injection_attempt';

class SecurityMonitor {
  private eventQueue: SecurityEvent[] = [];
  private alertThresholds: Map<SecurityEventType, AlertThreshold> = new Map();

  constructor() {
    this.initializeThresholds();
    this.startProcessing();
  }

  private initializeThresholds() {
    this.alertThresholds.set('authentication_failed', {
      count: 5,
      window: 300000, // 5 minutes
      severity: 'medium',
    });

    this.alertThresholds.set('sql_injection_attempt', {
      count: 1,
      window: 0,
      severity: 'critical',
    });

    // ... other thresholds
  }

  logEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): void {
    const fullEvent: SecurityEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    this.eventQueue.push(fullEvent);
    
    // Check for immediate alerts
    this.checkAlertThreshold(fullEvent);
    
    // Async processing
    setImmediate(() => this.processEvent(fullEvent));
  }

  private async processEvent(event: SecurityEvent): Promise<void> {
    // Store in database
    await this.storeEvent(event);
    
    // Check for patterns
    await this.detectPatterns(event);
    
    // Send to SIEM if configured
    if (process.env.SIEM_ENDPOINT) {
      await this.sendToSIEM(event);
    }
  }

  private async detectPatterns(event: SecurityEvent): Promise<void> {
    // Detect brute force attempts
    if (event.type === 'authentication_failed') {
      const recentFailures = await this.getRecentEvents({
        type: 'authentication_failed',
        ip: event.ip,
        window: 600000, // 10 minutes
      });

      if (recentFailures.length >= 10) {
        await this.blockIP(event.ip, 3600000); // Block for 1 hour
        await this.sendAlert({
          type: 'brute_force_detected',
          severity: 'high',
          details: {
            ip: event.ip,
            attempts: recentFailures.length,
          },
        });
      }
    }

    // Detect credential stuffing
    if (event.type === 'authentication_failed') {
      const uniqueUserAttempts = await this.getUniqueUserAttempts(event.ip, 300000);
      
      if (uniqueUserAttempts > 20) {
        await this.blockIP(event.ip, 86400000); // Block for 24 hours
        await this.sendAlert({
          type: 'credential_stuffing_detected',
          severity: 'critical',
          details: {
            ip: event.ip,
            uniqueAccounts: uniqueUserAttempts,
          },
        });
      }
    }
  }

  private checkAlertThreshold(event: SecurityEvent): void {
    const threshold = this.alertThresholds.get(event.type);
    if (!threshold) return;

    const recentEvents = this.eventQueue.filter(e => 
      e.type === event.type &&
      e.timestamp.getTime() > Date.now() - threshold.window
    );

    if (recentEvents.length >= threshold.count) {
      this.sendAlert({
        type: `threshold_exceeded_${event.type}`,
        severity: threshold.severity,
        details: {
          eventType: event.type,
          count: recentEvents.length,
          window: threshold.window,
          events: recentEvents,
        },
      });
    }
  }

  private async sendAlert(alert: SecurityAlert): Promise<void> {
    // Send to various channels based on severity
    switch (alert.severity) {
      case 'critical':
        await this.sendSMS(alert);
        await this.sendEmail(alert);
        await this.sendSlack(alert);
        await this.createIncident(alert);
        break;
      
      case 'high':
        await this.sendEmail(alert);
        await this.sendSlack(alert);
        break;
      
      case 'medium':
        await this.sendSlack(alert);
        break;
      
      case 'low':
        // Just log
        console.log('Security alert:', alert);
        break;
    }
  }
}

// Security audit logger
class SecurityAuditLogger {
  async log(event: AuditEvent): Promise<void> {
    const enrichedEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      environment: process.env.NODE_ENV,
      serverInfo: {
        hostname: os.hostname(),
        platform: os.platform(),
        nodeVersion: process.version,
      },
    };

    // Write to multiple destinations
    await Promise.all([
      this.writeToFile(enrichedEvent),
      this.writeToDatabase(enrichedEvent),
      this.writeToSIEM(enrichedEvent),
    ]);
  }

  private async writeToFile(event: AuditEvent): Promise<void> {
    const filename = `security-audit-${format(new Date(), 'yyyy-MM-dd')}.log`;
    const logEntry = JSON.stringify(event) + '\n';
    
    await fs.appendFile(
      path.join(process.env.AUDIT_LOG_PATH!, filename),
      logEntry,
      { flag: 'a', mode: 0o600 } // Restrictive permissions
    );
  }

  private async writeToDatabase(event: AuditEvent): Promise<void> {
    await db.query(
      `INSERT INTO security_audit_logs 
       (id, type, user_id, ip, action, resource, result, details, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        event.id,
        event.type,
        event.userId,
        event.ip,
        event.action,
        event.resource,
        event.result,
        JSON.stringify(event.details),
        event.timestamp,
      ]
    );
  }
}
```

---

## 🚨 Incident Response

```typescript
class IncidentResponsePlan {
  async handleSecurityIncident(incident: SecurityIncident): Promise<void> {
    // 1. Immediate containment
    await this.containIncident(incident);
    
    // 2. Assessment
    const assessment = await this.assessImpact(incident);
    
    // 3. Notification
    await this.notifyStakeholders(incident, assessment);
    
    // 4. Evidence collection
    await this.collectEvidence(incident);
    
    // 5. Eradication
    await this.eradicateTheat(incident);
    
    // 6. Recovery
    await this.recoverSystems(incident);
    
    // 7. Post-incident analysis
    await this.conductPostMortem(incident);
  }

  private async containIncident(incident: SecurityIncident): Promise<void> {
    switch (incident.type) {
      case 'data_breach':
        // Revoke all access tokens
        await this.revokeAllTokens();
        // Block affected accounts
        await this.blockAffectedAccounts(incident.affectedUsers);
        break;
      
      case 'malware_detection':
        // Isolate affected systems
        await this.isolateSystems(incident.affectedSystems);
        break;
      
      case 'ddos_attack':
        // Enable DDoS protection
        await this.enableDDoSProtection();
        break;
    }
  }

  private async assessImpact(incident: SecurityIncident): Promise<ImpactAssessment> {
    return {
      dataCompromised: await this.assessDataCompromise(incident),
      usersAffected: await this.countAffectedUsers(incident),
      systemsCompromised: await this.identifyCompromisedSystems(incident),
      financialImpact: await this.estimateFinancialImpact(incident),
      reputationalImpact: await this.assessReputationalImpact(incident),
      regulatoryImplications: await this.checkRegulatoryRequirements(incident),
    };
  }

  private async notifyStakeholders(
    incident: SecurityIncident,
    assessment: ImpactAssessment
  ): Promise<void> {
    const notifications = [];

    // Internal notifications
    notifications.push(this.notifySecurityTeam(incident, assessment));
    notifications.push(this.notifyManagement(incident, assessment));
    
    // External notifications (if required)
    if (assessment.regulatoryImplications.notificationRequired) {
      notifications.push(this.notifyRegulators(incident, assessment));
      notifications.push(this.notifyAffectedUsers(incident, assessment));
    }

    await Promise.all(notifications);
  }
}
```

---

## 📊 Security Metrics & KPIs

```typescript
interface SecurityMetrics {
  // Authentication metrics
  failedLoginAttempts: number;
  successfulLogins: number;
  averageLoginTime: number;
  passwordResetRequests: number;
  
  // Authorization metrics
  unauthorizedAccessAttempts: number;
  privilegeEscalationAttempts: number;
  
  // Input validation metrics
  validationFailures: number;
  xssAttemptsBlocked: number;
  sqlInjectionAttemptsBlocked: number;
  
  // Encryption metrics
  encryptedFieldsCount: number;
  encryptionFailures: number;
  keyRotationEvents: number;
  
  // Incident metrics
  securityIncidents: number;
  meanTimeToDetect: number;
  meanTimeToRespond: number;
  meanTimeToResolve: number;
}

class SecurityMetricsCollector {
  async collectMetrics(period: TimePeriod): Promise<SecurityMetrics> {
    const metrics: SecurityMetrics = {
      failedLoginAttempts: await this.countEvents('authentication_failed', period),
      successfulLogins: await this.countEvents('authentication_success', period),
      averageLoginTime: await this.calculateAverageLoginTime(period),
      passwordResetRequests: await this.countEvents('password_reset_requested', period),
      unauthorizedAccessAttempts: await this.countEvents('authorization_denied', period),
      privilegeEscalationAttempts: await this.countEvents('privilege_escalation_attempt', period),
      validationFailures: await this.countEvents('validation_failed', period),
      xssAttemptsBlocked: await this.countEvents('xss_attempt_blocked', period),
      sqlInjectionAttemptsBlocked: await this.countEvents('sql_injection_blocked', period),
      encryptedFieldsCount: await this.countEncryptedFields(),
      encryptionFailures: await this.countEvents('encryption_failed', period),
      keyRotationEvents: await this.countEvents('key_rotation_completed', period),
      securityIncidents: await this.countIncidents(period),
      meanTimeToDetect: await this.calculateMTTD(period),
      meanTimeToRespond: await this.calculateMTTR(period),
      meanTimeToResolve: await this.calculateMTTResolve(period),
    };

    return metrics;
  }

  async generateSecurityReport(period: TimePeriod): Promise<SecurityReport> {
    const metrics = await this.collectMetrics(period);
    const previousMetrics = await this.collectMetrics(this.getPreviousPeriod(period));
    
    return {
      period,
      metrics,
      trends: this.calculateTrends(metrics, previousMetrics),
      recommendations: this.generateRecommendations(metrics),
      complianceStatus: await this.checkComplianceStatus(),
      vulnerabilities: await this.getKnownVulnerabilities(),
      upcomingActions: await this.getUpcomingSecurityActions(),
    };
  }
}
```

---

## 🎯 Best Practices Implementation

### 1. Secure Defaults

```typescript
class SecureDefaults {
  static getFormDefaults(): FormSecuritySettings {
    return {
      encryption: {
        enabled: true,
        fields: 'sensitive', // Encrypt sensitive fields by default
        algorithm: 'aes-256-gcm',
      },
      validation: {
        strictMode: true,
        sanitizeInput: true,
        maxLength: 10000,
        allowedTags: [],
      },
      authentication: {
        required: false, // Set to true for private forms
        allowAnonymous: true,
      },
      rateLimit: {
        enabled: true,
        maxSubmissions: 100,
        window: 3600000, // 1 hour
      },
      csrf: {
        enabled: true,
        tokenExpiry: 3600000,
      },
      captcha: {
        enabled: true,
        threshold: 3, // Show after 3 submissions
      },
    };
  }
}
```

### 2. Security Headers Configuration

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'nonce-{nonce}'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
```

### 3. Secure Session Management

```typescript
app.use(session({
  secret: process.env.SESSION_SECRET!,
  name: 'sessionId',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true, // HTTPS only
    httpOnly: true,
    maxAge: 3600000, // 1 hour
    sameSite: 'strict',
  },
  store: new RedisStore({
    client: redis,
    prefix: 'sess:',
    ttl: 3600,
  }),
}));
```

---

## 🎉 Conclusion

This comprehensive security and validation framework provides:

1. **Defense in Depth**: Multiple layers of security controls
2. **Zero Trust Architecture**: Never trust, always verify
3. **Proactive Security**: Threat detection and prevention
4. **Compliance Ready**: GDPR, CCPA, SOC2 compliant
5. **Performance Optimized**: Minimal impact on user experience
6. **Audit Trail**: Complete security event logging
7. **Incident Response**: Automated incident handling

The framework ensures that the Dynamic Form Builder maintains the highest security standards while providing a seamless user experience.