/**
 * Forms-related constants
 */

export const FORM_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
  ALL: 'all'
} as const;

export const SUBMISSION_STATUS = {
  DRAFT: 'draft',
  COMPLETED: 'completed',
  PROCESSING: 'processing',
  FAILED: 'failed',
  SUBMITTED: 'submitted',
  ALL: 'all'
} as const;

export const ITEMS_PER_PAGE = {
  DEFAULT: 20,
  TABLE_VIEW: 50,
  COMPACT: 10,
  EXTENDED: 100
} as const;

export const BADGE_VARIANTS = {
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  INFO: 'info',
  DEFAULT: 'default'
} as const;

export const NAVIGATION_SOURCES = {
  FORMS_LIST: 'forms-list',
  SUBMISSIONS: 'submissions',
  DASHBOARD: 'dashboard'
} as const;

export const API_ENDPOINTS = {
  FORMS: '/api/forms',
  SUBMISSIONS: '/api/forms/:id/submissions',
  FORM_STEPS: '/api/forms/:id/steps',
  EXPORT: '/api/forms/:id/submissions/export'
} as const;

export const ERROR_MESSAGES = {
  LOAD_FORM: 'Failed to load form',
  LOAD_FORMS: 'Failed to load forms',
  CREATE_FORM: 'Failed to create form',
  UPDATE_FORM: 'Failed to update form',
  DELETE_FORM: 'Failed to delete form',
  DUPLICATE_FORM: 'Failed to duplicate form',
  PUBLISH_FORM: 'Failed to publish form',
  LOAD_DATA: 'Failed to load data',
  UPDATE_CELL: 'Failed to update. Please try again.',
  EXPORT_DATA: 'Failed to export data',
  DELETE_SUBMISSIONS: 'Failed to delete submissions',
  AUTH_REQUIRED: 'Authentication required'
} as const;

export const SUCCESS_MESSAGES = {
  FORM_CREATED: 'Form created successfully',
  FORM_UPDATED: 'Form updated successfully',
  FORM_DELETED: 'Form deleted successfully',
  FORM_DUPLICATED: 'Form duplicated successfully',
  FORM_PUBLISHED: 'Form published successfully',
  DATA_EXPORTED: 'Data exported successfully',
  CELL_UPDATED: 'Updated successfully',
  SUBMISSIONS_DELETED: 'Submissions deleted successfully'
} as const;

export const TOAST_DURATION = {
  SHORT: 2000,
  MEDIUM: 3000,
  LONG: 4000,
  EXTRA_LONG: 6000
} as const;

export const TOAST_POSITION = {
  TOP_RIGHT: 'top-right',
  TOP_LEFT: 'top-left',
  BOTTOM_RIGHT: 'bottom-right',
  BOTTOM_LEFT: 'bottom-left',
  TOP_CENTER: 'top-center',
  BOTTOM_CENTER: 'bottom-center'
} as const;

export type FormStatus = typeof FORM_STATUS[keyof typeof FORM_STATUS];
export type SubmissionStatus = typeof SUBMISSION_STATUS[keyof typeof SUBMISSION_STATUS];
export type BadgeVariant = typeof BADGE_VARIANTS[keyof typeof BADGE_VARIANTS];
export type NavigationSource = typeof NAVIGATION_SOURCES[keyof typeof NAVIGATION_SOURCES];