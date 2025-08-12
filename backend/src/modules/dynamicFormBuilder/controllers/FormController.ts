/**
 * Form Controller
 * Handles HTTP requests for form management
 */

import { Response } from 'express';
import { validationResult } from 'express-validator';
import formServiceWithPermissions from '../services/FormServiceWithPermissions';
import { XPAuthenticatedRequest, DynamicFormBuilderError } from '../types';
import { logger } from '../../../utils/logger';

export class FormController {
  private formService: typeof formServiceWithPermissions;

  constructor() {
    this.formService = formServiceWithPermissions;
  }

  /**
   * Create a new form
   */
  async createForm(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array()
          }
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'User authentication required'
          }
        });
        return;
      }

      const form = await this.formService.createForm(req.user.id, req.body);

      res.status(201).json({
        success: true,
        data: {
          ...form,
          shareUrl: `${process.env.FRONTEND_URL}/forms/${form.slug}`,
          editUrl: `${process.env.FRONTEND_URL}/forms/${form.id}/edit`,
          previewUrl: `${process.env.FRONTEND_URL}/forms/${form.id}/preview`
        }
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to create form');
    }
  }

  /**
   * Get form details
   */
  async getForm(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { formId } = req.params;
      const userId = req.user?.id;

      const form = await this.formService.getFormById(formId, userId);

      if (!form) {
        res.status(404).json({
          success: false,
          error: {
            code: 'FORM_NOT_FOUND',
            message: 'Form not found'
          }
        });
        return;
      }

      // Ensure fields are included in response
      const responseData = {
        ...form,
        fields: form.fields || [],
        steps: form.steps || []
      };
      
      res.json({
        success: true,
        data: responseData
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to retrieve form');
    }
  }

  /**
   * Get form by slug (public access)
   */
  async getFormBySlug(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const userId = req.user?.id;

      const form = await this.formService.getFormBySlug(slug, userId);

      if (!form) {
        res.status(404).json({
          success: false,
          error: {
            code: 'FORM_NOT_FOUND',
            message: 'Form not found'
          }
        });
        return;
      }

      // If form is published or user is owner, return full form
      if (form.status === 'published' || form.ownerId === userId) {
        res.json({
          success: true,
          data: form
        });
      } else {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Form is not published'
          }
        });
      }
    } catch (error) {
      this.handleError(error, res, 'Failed to retrieve form');
    }
  }

  /**
   * List forms
   */
  async listForms(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'User authentication required'
          }
        });
        return;
      }

      const query = {
        page: parseInt(req.query.page as string) || 1,
        limit: Math.min(parseInt(req.query.limit as string) || 20, 100),
        status: req.query.status as any,
        search: req.query.search as string,
        tags: req.query.tags ? (Array.isArray(req.query.tags) ? req.query.tags as string[] : [req.query.tags as string]) : undefined,
        category: req.query.category as string,
        sort: req.query.sort as string || '-created_at',
        ownerId: req.query.owner_id as string,
        teamId: req.query.team_id as string,
        filterOwner: req.query.filter_owner as 'all' | 'mine' | 'others' // New filter option
      };

      // Get forms from database
      const result = await this.formService.listForms(req.user.id, query);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Forms API Error:', { error });
      this.handleError(error, res, 'Failed to list forms');
    }
  }

  /**
   * Update form
   */
  async updateForm(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Log incoming request for debugging
      logger.info('Form update request received', {
        formId: req.params.formId,
        userId: req.user?.id,
        bodyKeys: Object.keys(req.body),
        hasFields: !!req.body.fields,
        fieldsCount: req.body.fields?.length
      });

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.error('Validation failed for form update', {
          errors: errors.array(),
          body: req.body,
          params: req.params,
          formId: req.params.formId
        });
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array()
          }
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'User authentication required'
          }
        });
        return;
      }

      const { formId } = req.params;
      const form = await this.formService.updateForm(formId, req.user.id, req.body);

      res.json({
        success: true,
        data: form
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to update form');
    }
  }

  /**
   * Delete form
   */
  async deleteForm(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'User authentication required'
          }
        });
        return;
      }

      const { formId } = req.params;
      const permanent = req.query.permanent === 'true';

      await this.formService.deleteForm(formId, req.user.id, permanent);

      res.json({
        success: true,
        message: 'Form deleted successfully'
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to delete form');
    }
  }

  /**
   * Duplicate/Clone form
   * Enhanced to support cloning forms from other users (published forms)
   */
  async duplicateForm(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'User authentication required'
          }
        });
        return;
      }

      const { formId } = req.params;
      const { name } = req.body;

      // Use the new cloneForm method that handles permissions properly
      const clonedForm = await this.formService.cloneForm(formId, req.user.id, name);

      res.status(201).json({
        success: true,
        data: clonedForm,
        message: 'Form cloned successfully'
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to clone form');
    }
  }

  /**
   * Publish form
   */
  async publishForm(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'User authentication required'
          }
        });
        return;
      }

      const { formId } = req.params;
      const { versionNote } = req.body;
      // const { notifyCollaborators } = req.body; // TODO: Implement notifications

      const form = await this.formService.publishForm(formId, req.user.id, versionNote);

      res.json({
        success: true,
        data: form,
        message: 'Form published successfully'
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to publish form');
    }
  }

  /**
   * Get form statistics (owner-only detailed stats)
   */
  async getFormStats(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'User authentication required'
          }
        });
        return;
      }

      const { formId } = req.params;

      // Check form ownership
      const form = await this.formService.getFormById(formId, req.user.id);
      if (!form || form.ownerId !== req.user.id) {
        res.status(404).json({
          success: false,
          error: {
            code: 'FORM_NOT_FOUND',
            message: 'Form not found'
          }
        });
        return;
      }

      // TODO: Implement detailed analytics service for owners
      const stats = {
        totalViews: 0,
        uniqueVisitors: 0,
        totalSubmissions: 0,
        completedSubmissions: 0,
        conversionRate: 0,
        avgCompletionTime: 0,
        lastSubmission: null
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to retrieve form statistics');
    }
  }

  /**
   * Get public form statistics
   * Available for all users to view basic metrics of published forms
   */
  async getPublicStats(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { formId } = req.params;

      // Get public statistics (no auth required for published forms)
      const stats = await this.formService.getPublicStatistics(formId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to retrieve public statistics');
    }
  }

  /**
   * Get public form by slug
   */
  async getPublicForm(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;

      const form = await this.formService.getFormBySlug(slug);

      if (!form) {
        res.status(404).json({
          success: false,
          error: {
            code: 'FORM_NOT_FOUND',
            message: 'Form not found'
          }
        });
        return;
      }

      // Check if form is published
      if (form.status !== 'published') {
        res.status(404).json({
          success: false,
          error: {
            code: 'FORM_NOT_PUBLISHED',
            message: 'Form is not available'
          }
        });
        return;
      }

      // Remove sensitive data for public access
      const publicForm = {
        id: form.id,
        name: form.name,
        description: form.description,
        fields: form.fields,
        steps: form.steps,
        settings: form.settings,
        status: form.status
      };

      res.json({
        success: true,
        data: publicForm
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to retrieve public form');
    }
  }

  /**
   * Handle errors consistently
   */
  private handleError(error: any, res: Response, defaultMessage: string): void {
    if (error instanceof DynamicFormBuilderError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details && { details: error.details })
        }
      });
    } else {
      logger.error(defaultMessage, { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        }
      });
    }
  }
}