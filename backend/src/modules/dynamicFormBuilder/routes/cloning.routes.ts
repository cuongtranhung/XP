/**
 * Form Cloning API Routes
 * Handles form cloning and template operations
 * Created: 2025-01-12
 */

import express from 'express';
import { Pool } from 'pg';
import { authenticateToken } from '../../../middleware/auth';
import { MultiUserServiceManager } from '../services/MultiUserServiceManager';
import { logger } from '../../../utils/logger';
import { CloneFormRequest } from '../types/multiuser.types';

const router = express.Router();

/**
 * Initialize the service manager
 */
let serviceManager: MultiUserServiceManager;

export const initializeCloningRoutes = (dbPool: Pool) => {
  serviceManager = MultiUserServiceManager.getInstance(dbPool);
  return router;
};

/**
 * Clone a form
 * POST /api/forms/:formId/clone
 */
router.post('/:formId/clone', authenticateToken, async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = (req as any).user?.id;
    const cloneRequest: CloneFormRequest = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Clone the form with audit logging
    const result = await serviceManager.cloneFormWithAudit(
      formId,
      userId,
      cloneRequest,
      {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId: (req as any).sessionId
      }
    );

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error: any) {
    logger.error('Error cloning form', {
      error: error.message,
      formId: req.params.formId,
      userId: (req as any).user?.id
    });

    if (error.statusCode === 403 || error.message.includes('permission')) {
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
 * Get clone history for a form
 * GET /api/forms/:formId/clones
 */
router.get('/:formId/clones', authenticateToken, async (req, res) => {
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

    const cloneHistory = await serviceManager.cloneService.getCloneHistory(formId);

    res.status(200).json({
      success: true,
      data: cloneHistory
    });

  } catch (error: any) {
    logger.error('Error getting clone history', {
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
 * Get original form for a cloned form
 * GET /api/forms/:formId/original
 */
router.get('/:formId/original', authenticateToken, async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check if user can view the cloned form
    const canView = await serviceManager.permissionService.canView(formId, userId);
    if (!canView) {
      return res.status(403).json({
        success: false,
        error: 'Permission denied'
      });
    }

    const originalFormId = await serviceManager.cloneService.getOriginalForm(formId);

    if (originalFormId) {
      // Also check if user can view the original form
      const canViewOriginal = await serviceManager.permissionService.canView(originalFormId, userId);
      
      res.status(200).json({
        success: true,
        data: {
          cloned_form_id: formId,
          original_form_id: originalFormId,
          can_view_original: canViewOriginal
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Original form not found or this form is not a clone'
      });
    }

  } catch (error: any) {
    logger.error('Error getting original form', {
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
 * Create template from form
 * POST /api/forms/:formId/create-template
 */
router.post('/:formId/create-template', authenticateToken, async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = (req as any).user?.id;
    const { template_name, template_description, is_public = false } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!template_name) {
      return res.status(400).json({
        success: false,
        error: 'template_name is required'
      });
    }

    const templateId = await serviceManager.cloneService.createTemplate(
      formId,
      userId,
      template_name,
      template_description,
      is_public
    );

    // Log template creation
    await serviceManager.auditService.logAccess(
      formId,
      userId,
      'clone',
      {
        action: 'create_template',
        template_id: templateId,
        template_name,
        is_public
      },
      true,
      undefined,
      {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId: (req as any).sessionId
      }
    );

    res.status(201).json({
      success: true,
      data: {
        template_id: templateId,
        template_name,
        is_public
      },
      message: 'Template created successfully'
    });

  } catch (error: any) {
    logger.error('Error creating template', {
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
 * Get available templates
 * GET /api/forms/templates
 */
router.get('/templates', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const templates = await serviceManager.cloneService.getAvailableTemplates(userId);

    res.status(200).json({
      success: true,
      data: templates,
      total: templates.length
    });

  } catch (error: any) {
    logger.error('Error getting available templates', {
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
 * Batch clone forms
 * POST /api/forms/batch-clone
 */
router.post('/batch-clone', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { form_ids, options } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!form_ids || !Array.isArray(form_ids) || form_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'form_ids array is required'
      });
    }

    if (form_ids.length > 20) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 20 forms can be cloned at once'
      });
    }

    const result = await serviceManager.cloneService.batchCloneForms(
      form_ids,
      userId,
      options
    );

    // Log batch clone operation
    await serviceManager.auditService.logAccess(
      'batch_operation',
      userId,
      'clone',
      {
        action: 'batch_clone',
        form_count: form_ids.length,
        succeeded: result.succeeded.length,
        failed: result.failed.length
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
      data: result,
      message: `Batch clone completed. ${result.succeeded.length} succeeded, ${result.failed.length} failed.`
    });

  } catch (error: any) {
    logger.error('Error batch cloning forms', {
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
 * Get clone statistics for a form
 * GET /api/forms/:formId/clone-stats
 */
router.get('/:formId/clone-stats', authenticateToken, async (req, res) => {
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

    const statistics = await serviceManager.cloneService.getCloneStatistics(formId);

    res.status(200).json({
      success: true,
      data: {
        form_id: formId,
        ...statistics
      }
    });

  } catch (error: any) {
    logger.error('Error getting clone statistics', {
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
 * Delete clone history for a form
 * DELETE /api/forms/:formId/clone-history
 */
router.delete('/:formId/clone-history', authenticateToken, async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const success = await serviceManager.cloneService.deleteCloneHistory(formId, userId);

    if (success) {
      // Log the action
      await serviceManager.auditService.logAccess(
        formId,
        userId,
        'delete',
        { action: 'delete_clone_history' },
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
        message: 'Clone history deleted successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to delete clone history'
      });
    }

  } catch (error: any) {
    logger.error('Error deleting clone history', {
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
 * Clone form from template
 * POST /api/forms/templates/:templateId/clone
 */
router.post('/templates/:templateId/clone', authenticateToken, async (req, res) => {
  try {
    const { templateId } = req.params;
    const userId = (req as any).user?.id;
    const cloneRequest: CloneFormRequest = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Clone from template (same as regular clone but with template context)
    const result = await serviceManager.cloneFormWithAudit(
      templateId,
      userId,
      {
        ...cloneRequest,
        new_name: cloneRequest.new_name || 'Form from Template'
      },
      {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId: (req as any).sessionId
      }
    );

    if (result.success) {
      res.status(201).json({
        ...result,
        message: 'Form created from template successfully'
      });
    } else {
      res.status(400).json(result);
    }

  } catch (error: any) {
    logger.error('Error cloning from template', {
      error: error.message,
      templateId: req.params.templateId,
      userId: (req as any).user?.id
    });

    if (error.statusCode === 403 || error.message.includes('permission')) {
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