/**
 * Form Permissions API Routes
 * Handles permission checking and form access control
 * Created: 2025-01-12
 */

import express from 'express';
import { Pool } from 'pg';
import { authenticateToken } from '../../../middleware/auth';
import { MultiUserServiceManager } from '../services/MultiUserServiceManager';
import { logger } from '../../../utils/logger';

const router = express.Router();

/**
 * Initialize the service manager
 */
let serviceManager: MultiUserServiceManager;

export const initializePermissionsRoutes = (dbPool: Pool) => {
  serviceManager = MultiUserServiceManager.getInstance(dbPool);
  return router;
};

/**
 * Check user permissions for a specific form
 * GET /api/forms/:formId/permissions
 */
router.get('/:formId/permissions', authenticateToken, async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const permissions = await serviceManager.permissionService.checkPermissions(formId, userId);

    // Log permission check
    await serviceManager.auditService.logAccess(
      formId,
      userId,
      'view',
      { action: 'permission_check' },
      permissions.can_view,
      permissions.can_view ? undefined : 'Permission denied',
      {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId: (req as any).sessionId
      }
    );

    res.status(200).json({
      success: true,
      data: permissions
    });

  } catch (error: any) {
    logger.error('Error checking permissions', {
      error: error.message,
      formId: req.params.formId,
      userId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Check specific permission for a form
 * GET /api/forms/:formId/permissions/:action
 */
router.get('/:formId/permissions/:action', authenticateToken, async (req, res) => {
  try {
    const { formId, action } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const validActions = ['view', 'submit', 'edit', 'delete'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Must be one of: view, submit, edit, delete'
      });
    }

    let hasPermission = false;
    switch (action) {
      case 'view':
        hasPermission = await serviceManager.permissionService.canView(formId, userId);
        break;
      case 'submit':
        hasPermission = await serviceManager.permissionService.canSubmit(formId, userId);
        break;
      case 'edit':
        hasPermission = await serviceManager.permissionService.canEdit(formId, userId);
        break;
      case 'delete':
        hasPermission = await serviceManager.permissionService.canDelete(formId, userId);
        break;
    }

    res.status(200).json({
      success: true,
      data: {
        form_id: formId,
        user_id: userId,
        action,
        has_permission: hasPermission
      }
    });

  } catch (error: any) {
    logger.error('Error checking specific permission', {
      error: error.message,
      formId: req.params.formId,
      action: req.params.action,
      userId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get all forms accessible to the current user
 * GET /api/forms/accessible
 */
router.get('/accessible', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const includePublic = req.query.include_public !== 'false';

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const accessibleForms = await serviceManager.permissionService.getUserAccessibleForms(
      userId,
      includePublic
    );

    res.status(200).json({
      success: true,
      data: accessibleForms,
      total: accessibleForms.length
    });

  } catch (error: any) {
    logger.error('Error getting accessible forms', {
      error: error.message,
      userId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Update form visibility
 * PUT /api/forms/:formId/visibility
 */
router.put('/:formId/visibility', authenticateToken, async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = (req as any).user?.id;
    const { visibility } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!visibility) {
      return res.status(400).json({
        success: false,
        error: 'visibility is required'
      });
    }

    const validVisibilities = ['private', 'shared', 'public', 'organization'];
    if (!validVisibilities.includes(visibility)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid visibility. Must be one of: private, shared, public, organization'
      });
    }

    const success = await serviceManager.permissionService.updateFormVisibility(
      formId,
      userId,
      visibility
    );

    if (success) {
      // Log the visibility change
      await serviceManager.auditService.logAccess(
        formId,
        userId,
        'edit',
        { 
          action: 'visibility_change',
          new_visibility: visibility 
        },
        true,
        undefined,
        {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          sessionId: (req as any).sessionId
        }
      );

      res.status(200).json({
        success: true,
        message: 'Form visibility updated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to update form visibility'
      });
    }

  } catch (error: any) {
    logger.error('Error updating form visibility', {
      error: error.message,
      formId: req.params.formId,
      userId: (req as any).user?.id
    });

    if (error.message.includes('Only the form owner')) {
      return res.status(403).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Check if form is public
 * GET /api/forms/:formId/public
 */
router.get('/:formId/public', async (req, res) => {
  try {
    const { formId } = req.params;

    const isPublic = await serviceManager.permissionService.isFormPublic(formId);

    res.status(200).json({
      success: true,
      data: {
        form_id: formId,
        is_public: isPublic
      }
    });

  } catch (error: any) {
    logger.error('Error checking if form is public', {
      error: error.message,
      formId: req.params.formId
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get form owner information
 * GET /api/forms/:formId/owner
 */
router.get('/:formId/owner', authenticateToken, async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check if user can view the form
    const canView = await serviceManager.permissionService.canView(formId, userId);
    if (!canView) {
      return res.status(403).json({
        success: false,
        error: 'Permission denied'
      });
    }

    const ownerId = await serviceManager.permissionService.getFormOwner(formId);

    if (ownerId === null) {
      return res.status(404).json({
        success: false,
        error: 'Form not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        form_id: formId,
        owner_id: ownerId,
        is_owner: ownerId === userId
      }
    });

  } catch (error: any) {
    logger.error('Error getting form owner', {
      error: error.message,
      formId: req.params.formId,
      userId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Batch check permissions for multiple forms
 * POST /api/forms/batch-permissions
 */
router.post('/batch-permissions', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { form_ids } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!form_ids || !Array.isArray(form_ids)) {
      return res.status(400).json({
        success: false,
        error: 'form_ids array is required'
      });
    }

    if (form_ids.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 50 forms can be checked at once'
      });
    }

    const permissions = await serviceManager.permissionService.batchCheckPermissions(
      form_ids,
      userId
    );

    // Convert Map to Object for JSON response
    const result: Record<string, any> = {};
    permissions.forEach((permission, formId) => {
      result[formId] = permission;
    });

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error: any) {
    logger.error('Error batch checking permissions', {
      error: error.message,
      userId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Enforce permission (middleware endpoint for testing)
 * POST /api/forms/:formId/enforce/:action
 */
router.post('/:formId/enforce/:action', authenticateToken, async (req, res) => {
  try {
    const { formId, action } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const validActions = ['view', 'submit', 'edit', 'delete'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Must be one of: view, submit, edit, delete'
      });
    }

    // This will throw an error if permission is denied
    await serviceManager.permissionService.enforcePermission(
      formId,
      userId,
      action as 'view' | 'submit' | 'edit' | 'delete'
    );

    res.status(200).json({
      success: true,
      message: `Permission granted for ${action} on form ${formId}`
    });

  } catch (error: any) {
    logger.error('Error enforcing permission', {
      error: error.message,
      formId: req.params.formId,
      action: req.params.action,
      userId: (req as any).user?.id
    });

    if (error.statusCode === 403 || error.code === 'PERMISSION_DENIED') {
      return res.status(403).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;