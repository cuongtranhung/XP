/**
 * Improved TypeScript Type Definitions
 * Enhanced types with better type safety and documentation
 */

import { Request } from 'express';

/**
 * Field types enum for better type safety
 */
export enum FieldType {
  // Text inputs
  TEXT = 'text',
  TEXTAREA = 'textarea',
  EMAIL = 'email',
  PHONE = 'phone',
  URL = 'url',
  NUMBER = 'number',
  
  // Selection inputs
  SELECT = 'select',
  RADIO = 'radio',
  CHECKBOX = 'checkbox',
  CHECKBOX_GROUP = 'checkbox_group',
  
  // Date/Time inputs
  DATE = 'date',
  TIME = 'time',
  DATETIME = 'datetime',
  
  // File inputs
  FILE = 'file',
  IMAGE = 'image',
  
  // Special inputs
  RATING = 'rating',
  SIGNATURE = 'signature',
  
  // Display elements
  HEADING = 'heading',
  PARAGRAPH = 'paragraph',
  DIVIDER = 'divider'
}

/**
 * Form status enum
 */
export enum FormStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived'
}

/**
 * Field validation rules interface
 */
export interface FieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  customMessage?: string;
  email?: boolean;
  url?: boolean;
  phone?: boolean;
}

/**
 * Field option for select, radio, checkbox
 */
export interface FieldOption {
  label: string;
  value: string | number;
  disabled?: boolean;
  selected?: boolean;
}

/**
 * Enhanced form field interface
 */
export interface IFormField {
  id: string;
  fieldKey: string;
  fieldType: FieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  defaultValue?: any;
  position: number;
  required: boolean;
  hidden: boolean;
  readonly?: boolean;
  validation?: FieldValidation;
  options?: FieldOption[];
  conditional?: {
    show: boolean;
    when: string;
    equals?: any;
    notEquals?: any;
    contains?: string;
  };
  stepId?: string;
  metadata?: Record<string, any>;
}

/**
 * Form step for multi-page forms
 */
export interface IFormStep {
  id: string;
  title: string;
  description?: string;
  position: number;
  fields: string[]; // Field IDs
  validation?: {
    required?: boolean;
    customValidation?: string;
  };
  navigation?: {
    previous?: boolean;
    next?: boolean;
    submit?: boolean;
  };
}

/**
 * Form settings interface
 */
export interface IFormSettings {
  multiPage?: boolean;
  showProgressBar?: boolean;
  saveProgress?: boolean;
  requireAuth?: boolean;
  limitSubmissions?: boolean;
  maxSubmissions?: number;
  closeDate?: Date;
  redirectUrl?: string;
  successMessage?: string;
  emailNotification?: {
    enabled: boolean;
    recipients: string[];
    subject?: string;
    template?: string;
  };
  webhooks?: {
    enabled: boolean;
    urls: string[];
    events: string[];
  };
  captcha?: {
    enabled: boolean;
    type: 'recaptcha' | 'hcaptcha';
    siteKey?: string;
  };
  customCss?: string;
  customJs?: string;
}

/**
 * Enhanced form interface
 */
export interface IForm {
  id: string;
  name: string;
  description?: string;
  slug: string;
  status: FormStatus;
  category?: string;
  tags?: string[];
  ownerId: string;
  teamId?: string;
  fields: IFormField[];
  steps?: IFormStep[];
  settings?: IFormSettings;
  version: number;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  
  // Computed properties
  shareUrl?: string;
  editUrl?: string;
  previewUrl?: string;
  embedCode?: string;
  
  // Statistics
  stats?: {
    submissions: number;
    views: number;
    conversionRate: number;
    averageTime: number;
    lastSubmission?: Date;
  };
}

/**
 * Form query parameters
 */
export interface IFormQuery {
  page?: number;
  limit?: number;
  status?: FormStatus;
  search?: string;
  tags?: string[];
  category?: string;
  sort?: string;
  ownerId?: string;
  teamId?: string;
  includeDeleted?: boolean;
  includeStats?: boolean;
}

/**
 * Paginated response interface
 */
export interface IPaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  meta?: Record<string, any>;
}

/**
 * Form creation data
 */
export interface ICreateFormData {
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  teamId?: string;
  settings?: Partial<IFormSettings>;
  fields?: Partial<IFormField>[];
  steps?: Partial<IFormStep>[];
}

/**
 * Form update data
 */
export interface IUpdateFormData {
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  status?: FormStatus;
  settings?: Partial<IFormSettings>;
  fields?: Partial<IFormField>[];
  steps?: Partial<IFormStep>[];
  incrementVersion?: boolean;
}

/**
 * Enhanced authenticated request
 */
export interface IAuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    fullName?: string;
    role?: string;
    permissions?: string[];
    teamId?: string;
  };
  session?: {
    id: string;
    userId: number;
    expiresAt: Date;
  };
  formPermissions?: {
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canPublish: boolean;
    canViewSubmissions: boolean;
  };
}

/**
 * Service response wrapper
 */
export interface IServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: Record<string, any>;
}

/**
 * Webhook event types
 */
export enum WebhookEvent {
  FORM_CREATED = 'form.created',
  FORM_UPDATED = 'form.updated',
  FORM_PUBLISHED = 'form.published',
  FORM_DELETED = 'form.deleted',
  SUBMISSION_CREATED = 'submission.created',
  SUBMISSION_UPDATED = 'submission.updated'
}

/**
 * Analytics event interface
 */
export interface IAnalyticsEvent {
  eventType: string;
  formId: string;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
  data?: Record<string, any>;
  userAgent?: string;
  ip?: string;
  referrer?: string;
}