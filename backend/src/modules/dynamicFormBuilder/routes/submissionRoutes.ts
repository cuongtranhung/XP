/**
 * Submission Routes
 * RESTful API endpoints for form submissions and analytics
 */

import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate } from '../../../middleware/auth';
import { SubmissionController } from '../controllers/SubmissionController';

const router = Router();
const submissionController = new SubmissionController();

// Validation schemas
const submitFormValidation = [
  param('formId')
    .isUUID()
    .withMessage('Form ID must be a valid UUID'),
  
  body('data')
    .isObject()
    .withMessage('Data must be an object'),
  
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
  
  body('partial')
    .optional()
    .isBoolean()
    .withMessage('Partial must be boolean'),
  
  body('currentStep')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Current step must be a positive integer'),
  
  body('completedSteps')
    .optional()
    .isArray()
    .withMessage('Completed steps must be an array'),
  
  body('completedSteps.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each completed step must be a positive integer')
];

const updateSubmissionValidation = [
  param('formId')
    .isUUID()
    .withMessage('Form ID must be a valid UUID'),
  
  param('submissionId')
    .isUUID()
    .withMessage('Submission ID must be a valid UUID'),
  
  body('data')
    .optional()
    .isObject()
    .withMessage('Data must be an object'),
  
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
  
  body('currentStep')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Current step must be a positive integer'),
  
  body('completedSteps')
    .optional()
    .isArray()
    .withMessage('Completed steps must be an array'),
  
  body('partial')
    .optional()
    .isBoolean()
    .withMessage('Partial must be boolean')
];

const formIdValidation = [
  param('formId')
    .isUUID()
    .withMessage('Form ID must be a valid UUID')
];

const submissionIdValidation = [
  param('submissionId')
    .isUUID()
    .withMessage('Submission ID must be a valid UUID')
];

const listSubmissionsValidation = [
  param('formId')
    .isUUID()
    .withMessage('Form ID must be a valid UUID'),
  
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
    .isIn(['draft', 'completed', 'processing', 'failed'])
    .withMessage('Status must be draft, completed, processing, or failed'),
  
  query('date_from')
    .optional()
    .isISO8601()
    .withMessage('Date from must be a valid ISO date'),
  
  query('date_to')
    .optional()
    .isISO8601()
    .withMessage('Date to must be a valid ISO date'),
  
  query('search')
    .optional()
    .isString()
    .isLength({ max: 255 })
    .withMessage('Search must be less than 255 characters'),
  
  query('export')
    .optional()
    .isIn(['csv', 'xlsx', 'json'])
    .withMessage('Export format must be csv, xlsx, or json')
];

const analyticsValidation = [
  param('formId')
    .isUUID()
    .withMessage('Form ID must be a valid UUID'),
  
  query('period')
    .optional()
    .isIn(['24h', '7d', '30d', '90d', '1y', 'all'])
    .withMessage('Period must be 24h, 7d, 30d, 90d, 1y, or all'),
  
  query('timezone')
    .optional()
    .isString()
    .withMessage('Timezone must be a valid timezone string')
];

// Routes

/**
 * @route   POST /forms/:formId/submissions
 * @desc    Submit form data
 * @access  Public (but can track authenticated users)
 */
router.post('/:formId/submissions',
  submitFormValidation,
  async (req: Request, res: Response) => {
    await submissionController.submitForm(req, res);
  }
);

/**
 * @route   GET /forms/:formId/submissions
 * @desc    List form submissions
 * @access  Private (form owner only)
 */
router.get('/:formId/submissions',
  authenticate,
  listSubmissionsValidation,
  async (req: Request, res: Response) => {
    await submissionController.listSubmissions(req, res);
  }
);

/**
 * @route   GET /forms/:formId/submissions/export
 * @desc    Export form submissions
 * @access  Private (form owner only)
 * NOTE: This route MUST be defined before /:submissionId to avoid route conflicts
 */
router.get('/:formId/submissions/export',
  authenticate,
  [
    param('formId')
      .isUUID()
      .withMessage('Form ID must be a valid UUID'),
    
    query('format')
      .optional()
      .isIn(['csv', 'xlsx', 'json', 'pdf'])
      .withMessage('Format must be csv, xlsx, json, or pdf'),
    
    query('fields')
      .optional()
      .isString()
      .withMessage('Fields must be a comma-separated string'),
    
    query('date_from')
      .optional()
      .isISO8601()
      .withMessage('Date from must be a valid ISO date'),
    
    query('date_to')
      .optional()
      .isISO8601()
      .withMessage('Date to must be a valid ISO date'),
    
    query('include_metadata')
      .optional()
      .isBoolean()
      .withMessage('Include metadata must be boolean')
  ],
  async (req: Request, res: Response) => {
    await submissionController.exportSubmissions(req, res);
  }
);

/**
 * @route   POST /forms/:formId/submissions/import
 * @desc    Import form submissions from file
 * @access  Private (form owner only)
 * NOTE: This route MUST be defined before /:submissionId to avoid route conflicts
 */
router.post('/:formId/submissions/import',
  authenticate,
  [
    param('formId')
      .isUUID()
      .withMessage('Form ID must be a valid UUID')
  ],
  async (req: Request, res: Response) => {
    await submissionController.importSubmissions(req, res);
  }
);

/**
 * @route   GET /forms/:formId/submissions/:submissionId
 * @desc    Get submission details
 * @access  Private (form owner or submitter)
 */
router.get('/:formId/submissions/:submissionId',
  [
    param('formId')
      .isUUID()
      .withMessage('Form ID must be a valid UUID'),
    param('submissionId')
      .isUUID()
      .withMessage('Submission ID must be a valid UUID')
  ],
  async (req: Request, res: Response) => {
    await submissionController.getSubmission(req, res);
  }
);

/**
 * @route   PUT /forms/:formId/submissions/:submissionId
 * @desc    Update submission (draft only)
 * @access  Private (submitter only)
 */
router.put('/:formId/submissions/:submissionId',
  authenticate,
  updateSubmissionValidation,
  async (req: Request, res: Response) => {
    await submissionController.updateSubmission(req, res);
  }
);

/**
 * @route   DELETE /forms/:formId/submissions/:submissionId
 * @desc    Delete submission
 * @access  Private (form owner or submitter)
 */
router.delete('/:formId/submissions/:submissionId',
  [
    param('formId')
      .isUUID()
      .withMessage('Form ID must be a valid UUID'),
    param('submissionId')
      .isUUID()
      .withMessage('Submission ID must be a valid UUID')
  ],
  authenticate,
  async (req: Request, res: Response) => {
    await submissionController.deleteSubmission(req, res);
  }
);

/**
 * @route   PATCH /forms/:formId/submissions/batch-status
 * @desc    Update status for multiple submissions
 * @access  Private (form owner only)
 */
router.patch('/:formId/submissions/batch-status',
  authenticate,
  [
    param('formId')
      .isUUID()
      .withMessage('Form ID must be a valid UUID'),
    body('submissionIds')
      .isArray()
      .withMessage('Submission IDs must be an array'),
    body('submissionIds.*')
      .isUUID()
      .withMessage('Each submission ID must be a valid UUID'),
    body('status')
      .isIn(['draft', 'completed', 'processing', 'failed', 'submitted'])
      .withMessage('Status must be draft, completed, processing, failed, or submitted')
  ],
  async (req: Request, res: Response) => {
    await submissionController.batchUpdateStatus(req, res);
  }
);

/**
 * @route   GET /forms/:formId/analytics/summary
 * @desc    Get form analytics summary
 * @access  Private (form owner only)
 */
router.get('/:formId/analytics/summary',
  authenticate,
  analyticsValidation,
  async (req: Request, res: Response) => {
    await submissionController.getFormAnalytics(req, res);
  }
);

/**
 * @route   GET /forms/:formId/analytics/fields
 * @desc    Get field-specific analytics
 * @access  Private (form owner only)
 */
router.get('/:formId/analytics/fields',
  authenticate,
  [
    param('formId')
      .isUUID()
      .withMessage('Form ID must be a valid UUID'),
    
    query('period')
      .optional()
      .isIn(['7d', '30d', '90d'])
      .withMessage('Period must be 7d, 30d, or 90d')
  ],
  async (req: Request, res: Response) => {
    await submissionController.getFieldAnalytics(req, res);
  }
);

export default router;