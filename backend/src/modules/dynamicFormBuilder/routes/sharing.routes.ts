/**
 * Form Sharing API Routes
 * Handles form sharing operations with permission checking
 * Created: 2025-01-12
 */

import express from 'express';
import { Pool } from 'pg';
import { authenticateToken } from '../../../middleware/auth';
import { MultiUserServiceManager } from '../services/MultiUserServiceManager';
import { logger } from '../../../utils/logger';
import { ShareFormRequest } from '../types/multiuser.types';

const router = express.Router();

/**
 * Initialize the service manager
 */
let serviceManager: MultiUserServiceManager;

export const initializeSharingRoutes = (dbPool: Pool) => {
  serviceManager = MultiUserServiceManager.getInstance(dbPool);
  return router;
};

/**
 * Share a form with a user
 * POST /api/forms/:formId/share
 */
router.post('/:formId/share', authenticateToken, async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = (req as any).user?.id;
    const shareRequest: ShareFormRequest = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!shareRequest.user_id || !shareRequest.permission_level) {
      return res.status(400).json({
        success: false,
        error: 'user_id and permission_level are required'
      });
    }

    // Validate permission level
    const validPermissions = ['view', 'submit', 'edit', 'admin'];
    if (!validPermissions.includes(shareRequest.permission_level)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid permission level'
      });
    }

    // Parse expiration date if provided
    let expiresAt: Date | undefined;
    if (shareRequest.expires_at) {
      expiresAt = new Date(shareRequest.expires_at);
      if (isNaN(expiresAt.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid expiration date'
        });
      }
    }

    // Share the form with audit logging
    const result = await serviceManager.shareFormWithAudit(
      formId,
      shareRequest.user_id,
      userId,
      shareRequest.permission_level,
      expiresAt,
      shareRequest.notes,
      {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId: (req as any).sessionId
      }
    );

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error: any) {
    logger.error('Error sharing form', {
      error: error.message,
      formId: req.params.formId,
      userId: (req as any).user?.id
    });

    if (error.statusCode === 403) {
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
 * Remove form sharing
 * DELETE /api/forms/:formId/share/:userId
 */
router.delete('/:formId/share/:userId', authenticateToken, async (req, res) => {
  try {
    const { formId, userId: sharedUserId } = req.params;
    const currentUserId = (req as any).user?.id;

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const success = await serviceManager.sharingService.unshareForm(
      formId,
      parseInt(sharedUserId),
      currentUserId
    );

    if (success) {
      // Log the action
      await serviceManager.auditService.logAccess(
        formId,
        currentUserId,
        'unshare',
        { unshared_user: parseInt(sharedUserId) },
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
        message: 'Form sharing removed successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to remove form sharing'
      });
    }

  } catch (error: any) {
    logger.error('Error unsharing form', {
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
 * Get all shares for a form
 * GET /api/forms/:formId/shares
 */
router.get('/:formId/shares', authenticateToken, async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const shares = await serviceManager.sharingService.getFormShares(formId, userId);

    res.status(200).json({
      success: true,
      data: shares
    });

  } catch (error: any) {
    logger.error('Error getting form shares', {
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
 * Get forms shared with the current user
 * GET /api/forms/shared-with-me
 */
router.get('/shared-with-me', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const sharedForms = await serviceManager.sharingService.getUserSharedForms(userId);

    res.status(200).json({
      success: true,
      data: sharedForms
    });

  } catch (error: any) {
    logger.error('Error getting shared forms', {
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
 * Update share permission
 * PUT /api/forms/:formId/share/:userId
 */
router.put('/:formId/share/:userId', authenticateToken, async (req, res) => {
  try {
    const { formId, userId: sharedUserId } = req.params;
    const currentUserId = (req as any).user?.id;
    const { permission_level } = req.body;

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!permission_level) {
      return res.status(400).json({
        success: false,
        error: 'permission_level is required'
      });
    }

    const validPermissions = ['view', 'submit', 'edit', 'admin'];
    if (!validPermissions.includes(permission_level)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid permission level'
      });
    }

    const updatedShare = await serviceManager.sharingService.updateSharePermission(
      formId,
      parseInt(sharedUserId),
      permission_level,
      currentUserId
    );

    if (updatedShare) {
      res.status(200).json({
        success: true,
        data: updatedShare,
        message: 'Permission updated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to update permission'
      });
    }

  } catch (error: any) {
    logger.error('Error updating share permission', {
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
 * Bulk share form with multiple users
 * POST /api/forms/:formId/bulk-share
 */
router.post('/:formId/bulk-share', authenticateToken, async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = (req as any).user?.id;
    const { user_ids, permission_level } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'user_ids array is required'
      });
    }

    if (!permission_level) {
      return res.status(400).json({
        success: false,
        error: 'permission_level is required'
      });
    }

    const validPermissions = ['view', 'submit', 'edit', 'admin'];
    if (!validPermissions.includes(permission_level)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid permission level'
      });
    }

    const result = await serviceManager.bulkShareWithPermissionCheck(
      formId,
      user_ids,
      userId,
      permission_level
    );

    res.status(200).json({
      success: true,
      data: result,
      message: `Bulk share completed. ${result.succeeded.length} succeeded, ${result.failed.length} failed.`
    });

  } catch (error: any) {
    logger.error('Error bulk sharing form', {
      error: error.message,
      formId: req.params.formId,
      userId: (req as any).user?.id
    });

    if (error.statusCode === 403) {
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
 * Get form access list (all users with access)
 * GET /api/forms/:formId/access-list
 */
router.get('/:formId/access-list', authenticateToken, async (req, res) => {
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

    const accessList = await serviceManager.permissionService.getFormAccessList(formId);

    res.status(200).json({
      success: true,
      data: accessList
    });

  } catch (error: any) {
    logger.error('Error getting form access list', {
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

export default router;