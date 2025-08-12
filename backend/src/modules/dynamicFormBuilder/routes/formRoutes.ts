/**
 * Dynamic Form Builder Routes
 * RESTful API endpoints for form management
 */

import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate } from '../../../middleware/auth';
import { FormController } from '../controllers/FormController';
import { 
  canCreateForms, 
  requireFormOwnership, 
  canViewFormSubmissions,
  checkFormLimit 
} from '../middleware/permissions';
import { 
  generalRateLimit,
  formBuilderRateLimits 
} from '../../../middleware/rateLimiter';
import {
  validateFormContent,
  logSecurityEvent
} from '../middleware/security';

const router = Router();
const formController = new FormController();

// Validation schemas
const createFormValidation = [
  body('name')
    .isString()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name is required and must be 1-255 characters'),
  
  body('description')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  
  body('category')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .isLength({ max: 100 })
    .withMessage('Category must be less than 100 characters'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  
  body('tags.*')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('Each tag must be a string less than 50 characters'),
  
  body('teamId')
    .optional()
    .isUUID()
    .withMessage('Team ID must be a valid UUID'),
  
  body('settings')
    .optional()
    .isObject()
    .withMessage('Settings must be an object'),
  
  body('fields')
    .optional()
    .isArray()
    .withMessage('Fields must be an array'),
  
  body('steps')
    .optional()
    .isArray()
    .withMessage('Steps must be an array')
];

const updateFormValidation = [
  param('formId')
    .isUUID()
    .withMessage('Form ID must be a valid UUID'),
  
  body('name')
    .optional()
    .isString()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be 1-255 characters'),
  
  body('description')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  
  body('category')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .isLength({ max: 100 })
    .withMessage('Category must be less than 100 characters'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  
  body('settings')
    .optional()
    .isObject()
    .withMessage('Settings must be an object'),
  
  body('fields')
    .optional()
    .isArray()
    .withMessage('Fields must be an array')
    .custom((fields) => {
      // Allow empty arrays
      if (!fields || fields.length === 0) return true;
      
      // Validate each field has required properties - support both formats
      for (const field of fields) {
        // Accept either (id, type) OR (fieldKey, fieldType) format
        const hasIdFormat = field.id && field.type && field.label;
        const hasFieldKeyFormat = field.fieldKey && field.fieldType && field.label;
        
        if (!hasIdFormat && !hasFieldKeyFormat) {
          throw new Error('Each field must have (id, type, label) or (fieldKey, fieldType, label)');
        }
      }
      return true;
    }),
  
  body('incrementVersion')
    .optional()
    .isBoolean()
    .withMessage('Increment version must be boolean')
];

const formIdValidation = [
  param('formId')
    .isUUID()
    .withMessage('Form ID must be a valid UUID')
];

const slugValidation = [
  param('slug')
    .isString()
    .isLength({ min: 1, max: 255 })
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug must contain only lowercase letters, numbers, and hyphens')
];

const listFormsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Status must be draft, published, or archived'),
  
  query('search')
    .optional()
    .isString()
    .isLength({ max: 255 })
    .withMessage('Search must be less than 255 characters'),
  
  query('sort')
    .optional()
    .matches(/^-?(created_at|updated_at|name|status)$/)
    .withMessage('Sort field must be created_at, updated_at, name, or status (prefix with - for desc)')
];

// Routes

/**
 * @route   GET /forms/public/:slug
 * @desc    Get public form by slug
 * @access  Public
 */
router.get('/public/:slug',
  [
    param('slug')
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('Slug must be 1-255 characters')
  ],
  async (req: Request, res: Response) => {
    await formController.getPublicForm(req, res);
  }
);

/**
 * @route   POST /forms
 * @desc    Create a new form
 * @access  Private
 */
router.post('/', 
  formBuilderRateLimits.formCreation,
  authenticate,
  canCreateForms,
  checkFormLimit,
  createFormValidation,
  validateFormContent,
  logSecurityEvent('form_creation', { action: 'create' }),
  async (req: Request, res: Response) => {
    await formController.createForm(req, res);
  }
);

/**
 * @route   GET /forms
 * @desc    List user's forms with pagination and filtering
 * @access  Private
 */

router.get('/',
  generalRateLimit,
  authenticate,
  // listFormsValidation, // Temporarily disabled for debugging
  async (req: Request, res: Response) => {
    await formController.listForms(req, res);
  }
);

/**
 * @route   GET /forms/:formId
 * @desc    Get form details by ID
 * @access  Private (owner) / Public (if published)
 */
router.get('/:formId',
  formIdValidation,
  async (req: Request, res: Response) => {
    await formController.getForm(req, res);
  }
);

/**
 * @route   GET /forms/slug/:slug
 * @desc    Get form details by slug (public access)
 * @access  Public
 */
router.get('/slug/:slug',
  slugValidation,
  async (req: Request, res: Response) => {
    await formController.getFormBySlug(req, res);
  }
);

/**
 * @route   PUT /forms/:formId
 * @desc    Update form
 * @access  Private (owner only)
 */
router.put('/:formId',
  formBuilderRateLimits.formUpdate,
  authenticate,
  requireFormOwnership,
  updateFormValidation,
  validateFormContent,
  logSecurityEvent('form_update', { action: 'update' }),
  async (req: Request, res: Response) => {
    await formController.updateForm(req, res);
  }
);

/**
 * @route   DELETE /forms/:formId
 * @desc    Delete form (soft delete by default)
 * @access  Private (owner only)
 */
router.delete('/:formId',
  authenticate,
  requireFormOwnership,
  formIdValidation,
  async (req: Request, res: Response) => {
    await formController.deleteForm(req, res);
  }
);

/**
 * @route   POST /forms/:formId/duplicate
 * @desc    Duplicate form
 * @access  Private
 */
router.post('/:formId/duplicate',
  formBuilderRateLimits.formCloning,
  authenticate,
  formIdValidation,
  [
    body('name')
      .optional()
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('Name must be 1-255 characters'),
    
    body('teamId')
      .optional()
      .isUUID()
      .withMessage('Team ID must be a valid UUID'),
    
    body('includeSubmissions')
      .optional()
      .isBoolean()
      .withMessage('Include submissions must be boolean'),
    
    body('includeWebhooks')
      .optional()
      .isBoolean()
      .withMessage('Include webhooks must be boolean')
  ],
  logSecurityEvent('form_cloning', { action: 'clone' }),
  async (req: Request, res: Response) => {
    await formController.duplicateForm(req, res);
  }
);

/**
 * @route   POST /forms/:formId/publish
 * @desc    Publish form
 * @access  Private (owner only)
 */
router.post('/:formId/publish',
  authenticate,
  formIdValidation,
  [
    body('versionNote')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Version note must be less than 500 characters'),
    
    body('notifyCollaborators')
      .optional()
      .isBoolean()
      .withMessage('Notify collaborators must be boolean')
  ],
  async (req: Request, res: Response) => {
    await formController.publishForm(req, res);
  }
);

/**
 * @route   GET /forms/:formId/stats
 * @desc    Get form statistics
 * @access  Private (owner only)
 */
router.get('/:formId/stats',
  authenticate,
  formIdValidation,
  async (req: Request, res: Response) => {
    await formController.getFormStats(req, res);
  }
);

/**
 * @route   GET /forms/:formId/public-stats
 * @desc    Get public form statistics
 * @access  Public (for published forms)
 */
router.get('/:formId/public-stats',
  formBuilderRateLimits.publicStats,
  formIdValidation,
  async (req: Request, res: Response) => {
    await formController.getPublicStats(req, res);
  }
);

export default router;