/**
 * Permission middleware for Dynamic Form Builder module
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../../utils/logger';

// Extend Request interface to include form permissions
declare global {
  namespace Express {
    interface Request {
      formPermissions?: {
        canCreate: boolean;
        canEdit: boolean;
        canDelete: boolean;
        canViewSubmissions: boolean;
        canExport: boolean;
        maxForms?: number;
      };
    }
  }
}

/**
 * Check if user has permission to create forms
 */
export const canCreateForms = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
    return;
  }

  // For now, all authenticated users can create forms
  // You can extend this to check user roles, subscription plans, etc.
  req.formPermissions = {
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canViewSubmissions: true,
    canExport: true,
    maxForms: parseInt(process.env.DYNAMIC_FORMS_MAX_PER_USER ?? '50'),
  };

  next();
};

/**
 * Check if user owns the form
 */
export const requireFormOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Check both possible param names (id or formId)
    const formId = req.params.formId || req.params.id;
    if (!formId) {
      next();
      return;
    }

    // Get form from database to check ownership
    const { query } = await import('../../../utils/database');
    const result = await query(
      'SELECT owner_id FROM forms WHERE id = $1 AND deleted_at IS NULL',
      [formId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Form not found',
      });
      return;
    }

    const form = result.rows[0];
    // Convert both to string for comparison to handle number/string type mismatch
    if (String(form.owner_id) !== String(req.user.id)) {
      logger.warn('Unauthorized form access attempt', {
        userId: req.user.id,
        userIdType: typeof req.user.id,
        formId,
        ownerId: form.owner_id,
        ownerIdType: typeof form.owner_id,
      });
      
      res.status(403).json({
        success: false,
        message: 'You do not have permission to access this form',
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Form ownership check failed', { error });
    res.status(500).json({
      success: false,
      message: 'Permission check failed',
    });
  }
};

/**
 * Check if user can view form submissions
 * This is more permissive - form owners and users with special permissions
 */
export const canViewFormSubmissions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const formId = req.params.id || req.params.formId;
    if (!formId) {
      next();
      return;
    }

    // Check if user owns the form
    const { query } = await import('../../../utils/database');
    const result = await query(
      'SELECT owner_id, settings FROM forms WHERE id = $1 AND deleted_at IS NULL',
      [formId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Form not found',
      });
      return;
    }

    const form = result.rows[0];
    
    // Form owner always has access
    if (form.owner_id === req.user.id) {
      next();
      return;
    }

    // Check if form has public submissions enabled (future feature)
    const settings = form.settings || {};
    if (settings.publicSubmissions) {
      next();
      return;
    }

    // Otherwise, deny access
    logger.warn('Unauthorized submission view attempt', {
      userId: req.user.id,
      formId,
      ownerId: form.owner_id,
    });
    
    res.status(403).json({
      success: false,
      message: 'You do not have permission to view submissions for this form',
    });
  } catch (error) {
    logger.error('Submission permission check failed', { error });
    res.status(500).json({
      success: false,
      message: 'Permission check failed',
    });
  }
};

/**
 * Rate limit form creation per user
 */
export const checkFormLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.formPermissions?.canCreate) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to create forms',
      });
      return;
    }

    // Check current form count
    const { query } = await import('../../../utils/database');
    const result = await query(
      'SELECT COUNT(*) as count FROM forms WHERE owner_id = $1 AND deleted_at IS NULL',
      [req.user.id]
    );

    const formCount = parseInt(result.rows[0].count);
    const maxForms = req.formPermissions.maxForms || 50;

    if (formCount >= maxForms) {
      logger.warn('User form limit reached', {
        userId: req.user.id,
        formCount,
        maxForms,
      });
      
      res.status(403).json({
        success: false,
        message: `You have reached the maximum limit of ${maxForms} forms`,
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Form limit check failed', { error });
    res.status(500).json({
      success: false,
      message: 'Permission check failed',
    });
  }
};