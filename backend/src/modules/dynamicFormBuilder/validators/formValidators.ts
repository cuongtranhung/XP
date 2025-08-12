/**
 * Form Validation Schemas
 * Centralized validation rules for form operations
 */

import { body, param, query, ValidationChain } from 'express-validator';

/**
 * Helper function to validate field structure
 */
const validateFieldStructure = (fields: any[]): boolean => {
  if (!fields || fields.length === 0) return true;
  
  for (const field of fields) {
    // Support both naming conventions
    const hasIdFormat = field.id && field.type && field.label;
    const hasFieldKeyFormat = field.fieldKey && field.fieldType && field.label;
    
    if (!hasIdFormat && !hasFieldKeyFormat) {
      throw new Error('Each field must have (id, type, label) or (fieldKey, fieldType, label)');
    }
    
    // Validate field types
    const validFieldTypes = [
      'text', 'textarea', 'number', 'email', 'phone', 'url',
      'select', 'radio', 'checkbox', 'checkbox_group',
      'date', 'time', 'datetime', 'file', 'image',
      'rating', 'signature', 'heading', 'paragraph'
    ];
    
    const fieldType = field.type || field.fieldType;
    if (fieldType && !validFieldTypes.includes(fieldType)) {
      throw new Error(`Invalid field type: ${fieldType}`);
    }
  }
  return true;
};

/**
 * Common field validations
 */
const commonFieldValidations = {
  name: body('name')
    .trim()
    .isString()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name is required and must be 1-255 characters'),
  
  description: body('description')
    .optional()
    .trim()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  
  category: body('category')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isString()
    .isLength({ max: 100 })
    .withMessage('Category must be less than 100 characters'),
  
  tags: body('tags')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Tags must be an array with max 20 items'),
  
  tagsItem: body('tags.*')
    .optional()
    .trim()
    .isString()
    .isLength({ max: 50 })
    .withMessage('Each tag must be a string less than 50 characters'),
  
  teamId: body('teamId')
    .optional()
    .isUUID()
    .withMessage('Team ID must be a valid UUID'),
  
  settings: body('settings')
    .optional()
    .isObject()
    .withMessage('Settings must be an object'),
  
  fields: body('fields')
    .optional()
    .isArray({ max: 100 })
    .withMessage('Fields must be an array with max 100 items')
    .custom(validateFieldStructure),
  
  steps: body('steps')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Steps must be an array with max 20 items')
};

/**
 * Create form validation
 */
export const createFormValidation: ValidationChain[] = [
  commonFieldValidations.name,
  commonFieldValidations.description,
  commonFieldValidations.category,
  commonFieldValidations.tags,
  commonFieldValidations.tagsItem,
  commonFieldValidations.teamId,
  commonFieldValidations.settings,
  commonFieldValidations.fields,
  commonFieldValidations.steps
];

/**
 * Update form validation
 */
export const updateFormValidation: ValidationChain[] = [
  param('formId')
    .isUUID()
    .withMessage('Form ID must be a valid UUID'),
  
  body('name')
    .optional()
    .trim()
    .isString()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be 1-255 characters'),
  
  commonFieldValidations.description,
  commonFieldValidations.category,
  commonFieldValidations.tags,
  commonFieldValidations.tagsItem,
  commonFieldValidations.settings,
  commonFieldValidations.fields,
  commonFieldValidations.steps,
  
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Status must be draft, published, or archived'),
  
  body('incrementVersion')
    .optional()
    .isBoolean()
    .withMessage('Increment version must be boolean')
];

/**
 * Form ID validation
 */
export const formIdValidation: ValidationChain[] = [
  param('formId')
    .isUUID()
    .withMessage('Form ID must be a valid UUID')
];

/**
 * Slug validation
 */
export const slugValidation: ValidationChain[] = [
  param('slug')
    .trim()
    .isString()
    .isLength({ min: 1, max: 255 })
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug must contain only lowercase letters, numbers, and hyphens')
];

/**
 * List forms query validation
 */
export const listFormsValidation: ValidationChain[] = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .toInt()
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .toInt()
    .withMessage('Limit must be between 1 and 100'),
  
  query('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Status must be draft, published, or archived'),
  
  query('search')
    .optional()
    .trim()
    .isString()
    .isLength({ max: 255 })
    .withMessage('Search must be less than 255 characters'),
  
  query('sort')
    .optional()
    .matches(/^-?(created_at|updated_at|name|status)$/)
    .withMessage('Sort field must be created_at, updated_at, name, or status (prefix with - for desc)'),
  
  query('category')
    .optional()
    .trim()
    .isString()
    .isLength({ max: 100 })
    .withMessage('Category must be less than 100 characters'),
  
  query('tags')
    .optional()
    .custom((value) => {
      // Allow string or array of strings
      if (typeof value === 'string') return true;
      if (Array.isArray(value)) {
        return value.every(tag => typeof tag === 'string');
      }
      return false;
    })
    .withMessage('Tags must be a string or array of strings')
];

/**
 * Duplicate form validation
 */
export const duplicateFormValidation: ValidationChain[] = [
  ...formIdValidation,
  
  body('name')
    .optional()
    .trim()
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
];

/**
 * Publish form validation
 */
export const publishFormValidation: ValidationChain[] = [
  ...formIdValidation,
  
  body('versionNote')
    .optional()
    .trim()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Version note must be less than 500 characters'),
  
  body('notifyCollaborators')
    .optional()
    .isBoolean()
    .withMessage('Notify collaborators must be boolean')
];