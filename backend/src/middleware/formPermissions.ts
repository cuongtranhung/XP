/**
 * Form Permission Middleware
 * Middleware for checking form access permissions
 * Created: 2025-01-12
 */

import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { MultiUserServiceManager } from '../modules/dynamicFormBuilder/services/MultiUserServiceManager';
import { logger } from '../utils/logger';
import { PermissionLevel } from '../modules/dynamicFormBuilder/types/multiuser.types';

// Extend Request type to include permission context
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email?: string;
  };
  permissions?: {
    formId: string;
    userId: number;
    canView: boolean;
    canSubmit: boolean;
    canEdit: boolean;
    canDelete: boolean;
    permissionSource: string;
  };
  sessionId?: string;
}

let serviceManager: MultiUserServiceManager;

/**
 * Initialize the middleware with database connection
 */
export const initializeFormPermissionsMiddleware = (dbPool: Pool) => {
  serviceManager = MultiUserServiceManager.getInstance(dbPool);
};

/**
 * Generic permission checker middleware factory
 */
export const requireFormPermission = (
  requiredPermission: 'view' | 'submit' | 'edit' | 'delete',
  options: {
    allowPublic?: boolean;
    logAccess?: boolean;
    formIdParam?: string;
  } = {}
) => {
  const {
    allowPublic = false,
    logAccess = true,
    formIdParam = 'formId'
  } = options;

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const formId = req.params[formIdParam];
      const userId = req.user?.id;

      if (!formId) {
        return res.status(400).json({
          success: false,
          error: `${formIdParam} parameter is required`
        });
      }

      // For public access, allow anonymous users for view/submit operations
      if (allowPublic && !userId && ['view', 'submit'].includes(requiredPermission)) {
        const isPublic = await serviceManager.permissionService.isFormPublic(formId);
        if (isPublic) {
          // Log anonymous access
          if (logAccess) {
            await serviceManager.auditService.logAccess(
              formId,
              null, // Anonymous user
              requiredPermission,
              { anonymous: true },
              true,
              undefined,
              {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                sessionId: req.sessionId
              }
            );
          }
          return next();
        }
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Check permissions and log access attempt
      const hasPermission = await serviceManager.checkAndLogAccess(
        formId,
        userId,
        requiredPermission,
        logAccess ? {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          sessionId: req.sessionId
        } : undefined
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: `Insufficient permissions. Required: ${requiredPermission}`
        });
      }

      // Add permission context to request for potential use in handlers
      const permissions = await serviceManager.permissionService.checkPermissions(formId, userId);
      req.permissions = {
        formId,
        userId,
        canView: permissions.can_view,
        canSubmit: permissions.can_submit,
        canEdit: permissions.can_edit,
        canDelete: permissions.can_delete,
        permissionSource: permissions.permission_source
      };

      next();

    } catch (error: any) {
      logger.error('Permission middleware error', {
        error: error.message,
        formId: req.params[formIdParam],
        userId: req.user?.id,
        requiredPermission
      });

      // Log failed permission check
      if (req.params[formIdParam] && req.user?.id && logAccess) {
        await serviceManager.auditService.logAccess(
          req.params[formIdParam],
          req.user.id,
          'access_denied',
          {
            required_permission: requiredPermission,
            error: error.message
          },
          false,
          error.message,
          {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            sessionId: req.sessionId
          }
        );
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
};

/**
 * Specific permission middlewares for common use cases
 */
export const requireViewPermission = (options?: {
  allowPublic?: boolean;
  logAccess?: boolean;
  formIdParam?: string;
}) => requireFormPermission('view', { allowPublic: true, ...options });

export const requireSubmitPermission = (options?: {
  allowPublic?: boolean;
  logAccess?: boolean;
  formIdParam?: string;
}) => requireFormPermission('submit', { allowPublic: true, ...options });

export const requireEditPermission = (options?: {
  allowPublic?: boolean;
  logAccess?: boolean;
  formIdParam?: string;
}) => requireFormPermission('edit', options);

export const requireDeletePermission = (options?: {
  allowPublic?: boolean;
  logAccess?: boolean;
  formIdParam?: string;
}) => requireFormPermission('delete', options);

/**
 * Owner-only middleware (equivalent to delete permission)
 */
export const requireOwnership = (options?: {
  logAccess?: boolean;
  formIdParam?: string;
}) => requireFormPermission('delete', options);

/**
 * Minimum permission level middleware
 */
export const requireMinimumPermission = (
  minimumLevel: PermissionLevel,
  options: {
    allowPublic?: boolean;
    logAccess?: boolean;
    formIdParam?: string;
  } = {}
) => {
  const permissionHierarchy: Record<PermissionLevel, number> = {
    'view': 1,
    'submit': 2,
    'edit': 3,
    'admin': 4
  };

  const requiredLevel = permissionHierarchy[minimumLevel];

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const formId = req.params[options.formIdParam || 'formId'];
      const userId = req.user?.id;

      if (!formId) {
        return res.status(400).json({
          success: false,
          error: 'formId parameter is required'
        });
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const permissions = await serviceManager.permissionService.checkPermissions(formId, userId);
      
      let userLevel = 0;
      if (permissions.can_delete) userLevel = 4; // admin
      else if (permissions.can_edit) userLevel = 3; // edit
      else if (permissions.can_submit) userLevel = 2; // submit
      else if (permissions.can_view) userLevel = 1; // view

      if (userLevel < requiredLevel) {
        // Log access denied
        if (options.logAccess !== false) {
          await serviceManager.auditService.logAccess(
            formId,
            userId,
            'access_denied',
            {
              required_level: minimumLevel,
              user_level: userLevel
            },
            false,
            `Insufficient permission level. Required: ${minimumLevel}`,
            {
              ip: req.ip,
              userAgent: req.get('User-Agent'),
              sessionId: req.sessionId
            }
          );
        }

        return res.status(403).json({
          success: false,
          error: `Insufficient permission level. Required: ${minimumLevel}`
        });
      }

      // Add permission context
      req.permissions = {
        formId,
        userId,
        canView: permissions.can_view,
        canSubmit: permissions.can_submit,
        canEdit: permissions.can_edit,
        canDelete: permissions.can_delete,
        permissionSource: permissions.permission_source
      };

      next();

    } catch (error: any) {
      logger.error('Minimum permission middleware error', {
        error: error.message,
        formId: req.params[options.formIdParam || 'formId'],
        userId: req.user?.id,
        minimumLevel
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
};

/**
 * Conditional permission middleware - checks different permissions based on HTTP method
 */
export const requireMethodBasedPermission = (options: {
  GET?: 'view' | 'submit' | 'edit' | 'delete';
  POST?: 'view' | 'submit' | 'edit' | 'delete';
  PUT?: 'view' | 'submit' | 'edit' | 'delete';
  PATCH?: 'view' | 'submit' | 'edit' | 'delete';
  DELETE?: 'view' | 'submit' | 'edit' | 'delete';
  allowPublic?: boolean;
  logAccess?: boolean;
  formIdParam?: string;
} = {}) => {
  const defaultPermissions = {
    GET: 'view',
    POST: 'submit',
    PUT: 'edit',
    PATCH: 'edit',
    DELETE: 'delete'
  } as const;

  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const method = req.method as keyof typeof defaultPermissions;
    const requiredPermission = (options[method] || defaultPermissions[method]) as 
      'view' | 'submit' | 'edit' | 'delete';

    return requireFormPermission(requiredPermission, {
      allowPublic: options.allowPublic,
      logAccess: options.logAccess,
      formIdParam: options.formIdParam
    })(req, res, next);
  };
};

/**
 * Bulk operation permission middleware
 */
export const requireBulkPermission = (
  requiredPermission: 'view' | 'submit' | 'edit' | 'delete',
  options: {
    formIdsField?: string;
    maxForms?: number;
    logAccess?: boolean;
  } = {}
) => {
  const {
    formIdsField = 'form_ids',
    maxForms = 50,
    logAccess = true
  } = options;

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const formIds = req.body[formIdsField];

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      if (!formIds || !Array.isArray(formIds)) {
        return res.status(400).json({
          success: false,
          error: `${formIdsField} array is required`
        });
      }

      if (formIds.length > maxForms) {
        return res.status(400).json({
          success: false,
          error: `Maximum ${maxForms} forms allowed in bulk operation`
        });
      }

      // Check permissions for all forms
      const permissionChecks = await Promise.all(
        formIds.map(async (formId: string) => {
          const hasPermission = await serviceManager.checkAndLogAccess(
            formId,
            userId,
            requiredPermission,
            logAccess ? {
              ip: req.ip,
              userAgent: req.get('User-Agent'),
              sessionId: req.sessionId
            } : undefined
          );
          return { formId, hasPermission };
        })
      );

      // Filter out forms without permission
      const deniedForms = permissionChecks
        .filter(check => !check.hasPermission)
        .map(check => check.formId);

      if (deniedForms.length > 0) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions for some forms',
          denied_forms: deniedForms
        });
      }

      next();

    } catch (error: any) {
      logger.error('Bulk permission middleware error', {
        error: error.message,
        userId: req.user?.id,
        requiredPermission
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
};

/**
 * Rate limiting based on permission level
 */
export const permissionBasedRateLimit = (options: {
  viewLimit?: number;
  submitLimit?: number;
  editLimit?: number;
  adminLimit?: number;
  windowMs?: number;
} = {}) => {
  const limits = {
    view: options.viewLimit || 100,
    submit: options.submitLimit || 50,
    edit: options.editLimit || 20,
    admin: options.adminLimit || 100
  };

  // This is a simplified rate limiter - in production, use a proper rate limiting library
  const requestCounts = new Map<string, { count: number; resetTime: number }>();
  const windowMs = options.windowMs || 60000; // 1 minute

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const formId = req.params.formId;

      if (!userId || !formId) {
        return next();
      }

      const permissions = await serviceManager.permissionService.checkPermissions(formId, userId);
      
      let limit = limits.view;
      if (permissions.can_delete) limit = limits.admin;
      else if (permissions.can_edit) limit = limits.edit;
      else if (permissions.can_submit) limit = limits.submit;

      const key = `${userId}:${formId}`;
      const now = Date.now();
      const userRequests = requestCounts.get(key);

      if (!userRequests || now > userRequests.resetTime) {
        requestCounts.set(key, { count: 1, resetTime: now + windowMs });
        return next();
      }

      if (userRequests.count >= limit) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          limit,
          resetTime: userRequests.resetTime
        });
      }

      userRequests.count++;
      next();

    } catch (error: any) {
      logger.error('Rate limit middleware error', {
        error: error.message,
        userId: req.user?.id
      });

      // Don't block on rate limit errors
      next();
    }
  };
};

export default {
  requireFormPermission,
  requireViewPermission,
  requireSubmitPermission,
  requireEditPermission,
  requireDeletePermission,
  requireOwnership,
  requireMinimumPermission,
  requireMethodBasedPermission,
  requireBulkPermission,
  permissionBasedRateLimit
};