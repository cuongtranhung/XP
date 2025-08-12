/**
 * Type definitions for Dynamic Form Builder module
 */

import { Request } from 'express';

// Core form types
export interface Form {
  id: string;
  slug: string;
  name: string;
  description?: string;
  status: FormStatus;
  version: number;
  category?: string;
  tags?: string[];
  visibility: FormVisibility;
  ownerId?: string;
  teamId?: string;
  settings: FormSettings;
  fields?: FormField[];  // Add fields array
  steps?: FormStep[];     // Add steps array  
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  deletedAt?: Date;
}

export enum FormStatus {
  Draft = 'draft',
  Published = 'published',
  Archived = 'archived',
  Active = 'published', // Alias for backwards compatibility
  Inactive = 'archived' // Alias for backwards compatibility
}
export type FormVisibility = 'public' | 'private' | 'team';

export interface FormSettings {
  theme?: string;
  multiPage?: boolean;
  progressBar?: {
    enabled: boolean;
    type: 'steps' | 'percentage';
  };
  saveProgress?: {
    enabled: boolean;
    autoSave: boolean;
    interval?: number; // seconds
  };
  notifications?: {
    email?: {
      recipients: string[];
      onSubmission: boolean;
      includeData: boolean;
    };
    webhook?: {
      url: string;
      method: 'POST' | 'PUT' | 'PATCH';
      headers?: Record<string, string>;
      retry?: {
        enabled: boolean;
        maxAttempts: number;
        backoffMultiplier: number;
      };
    };
  };
  confirmation?: {
    type: 'message' | 'redirect';
    title?: string;
    message?: string;
    redirectUrl?: string;
    redirectDelay?: number;
  };
  security?: {
    captcha: boolean;
    honeypot: boolean;
    csrfProtection: boolean;
    allowedDomains?: string[];
    ipRateLimit?: {
      enabled: boolean;
      maxAttempts: number;
      windowMinutes: number;
    };
  };
  scheduling?: {
    startDate?: Date;
    endDate?: Date;
    timezone?: string;
  };
  quotas?: {
    maxSubmissions?: number;
    maxPerUser?: number;
  };
}

// Form field types
export interface FormField {
  id: string;
  formId: string;
  fieldKey: string;
  fieldType: FieldType;
  label: string;
  placeholder?: string;
  position: number;
  required: boolean;
  hidden: boolean;
  validation?: FieldValidation;
  options?: FieldOption[];
  conditionalLogic?: ConditionalLogic;
  stepId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum FieldType {
  Text = 'text',
  Textarea = 'textarea', 
  Email = 'email',
  Password = 'password',
  Number = 'number',
  Tel = 'tel',
  Url = 'url',
  Date = 'date',
  Time = 'time',
  DatetimeLocal = 'datetime-local',
  Select = 'select',
  Radio = 'radio', 
  Checkbox = 'checkbox',
  CheckboxGroup = 'checkbox_group',
  File = 'file',
  Image = 'image',
  Rating = 'rating',
  Range = 'range',
  Hidden = 'hidden',
  Section = 'section',
  Html = 'html',
  Signature = 'signature',
  Address = 'address',
  Payment = 'payment',
  FileUpload = 'file' // Alias for backwards compatibility
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  custom?: string; // Custom validation function
  messages?: {
    required?: string;
    minLength?: string;
    maxLength?: string;
    min?: string;
    max?: string;
    pattern?: string;
    custom?: string;
  };
}

export interface FieldOption {
  label: string;
  value: string | number;
  selected?: boolean;
  disabled?: boolean;
}

export interface ConditionalLogic {
  rules: ConditionalRule[];
}

export interface ConditionalRule {
  conditions: Condition[];
  actions: Action[];
  logic?: 'and' | 'or'; // Default: 'and'
}

export interface Condition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 
           'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty';
  value: any;
}

export interface Action {
  type: 'show' | 'hide' | 'require' | 'unrequire' | 'set_value';
  target: string | string[];
  value?: any;
}

// Form step types
export interface FormStep {
  id: string;
  formId: string;
  title: string;
  description?: string;
  position: number;
  settings?: StepSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface StepSettings {
  navigation?: {
    showPrevious: boolean;
    showNext: boolean;
    allowSkip: boolean;
  };
  validation?: {
    validateOnNext: boolean;
    showErrors: boolean;
  };
}

// Form submission types
export interface FormSubmission {
  id: string;
  formId: string;
  submissionNumber: number;
  status: SubmissionStatus;
  data: Record<string, any>;
  metadata?: SubmissionMetadata;
  currentStep?: number;
  completedSteps?: number[];
  submitterId?: string;
  submitterEmail?: string;
  submitterIp?: string;
  score?: number;
  completionTime?: number; // in seconds
  createdAt: Date;
  updatedAt: Date;
  submittedAt?: Date;
  deletedAt?: Date;
}

export type SubmissionStatus = 'draft' | 'completed' | 'processing' | 'failed';

export interface SubmissionMetadata {
  source?: string;
  referrer?: string;
  device?: {
    type: 'desktop' | 'mobile' | 'tablet';
    browser?: string;
    os?: string;
    userAgent?: string;
  };
  location?: {
    country?: string;
    region?: string;
    city?: string;
    timezone?: string;
  };
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
}

// Analytics types
export interface FormAnalytics {
  id: string;
  formId: string;
  date: Date;
  views: number;
  uniqueVisitors: number;
  submissions: number;
  completedSubmissions: number;
  abandonmentRate: number;
  avgCompletionTime: number;
  deviceBreakdown: Record<string, number>;
  trafficSources: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalyticsSummary {
  overview: {
    totalViews: number;
    uniqueVisitors: number;
    totalSubmissions: number;
    completedSubmissions: number;
    conversionRate: number;
    avgCompletionTime: number;
    bounceRate: number;
  };
  trends: {
    views: Array<{ date: string; value: number }>;
    submissions: Array<{ date: string; value: number }>;
  };
  topTrafficSources: Array<{ source: string; visits: number; conversions: number }>;
  deviceBreakdown: Record<string, { percentage: number; submissions: number }>;
  fieldAnalytics?: FieldAnalytics[];
  completionFunnel?: CompletionFunnelStep[];
}

export interface FieldAnalytics {
  fieldId: string;
  fieldName: string;
  interactions: number;
  avgTimeSpent: number;
  errorRate: number;
  abandonmentRate: number;
  mostCommonErrors: Array<{
    type: string;
    message: string;
    count: number;
  }>;
}

export interface CompletionFunnelStep {
  step: number;
  entered: number;
  completed: number;
  dropRate: number;
}

// Webhook types
export interface FormWebhook {
  id: string;
  formId: string;
  name: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  events: WebhookEvent[];
  authType: 'none' | 'bearer' | 'basic' | 'api_key';
  authConfig: Record<string, any>;
  headers: Record<string, string>;
  payloadTemplate: Record<string, any>;
  retryConfig: {
    enabled: boolean;
    maxAttempts: number;
    backoffMultiplier: number;
  };
  conditions?: Record<string, any>;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type WebhookEvent = 
  | 'form.created'
  | 'form.updated'
  | 'form.published'
  | 'form.archived'
  | 'form.deleted'
  | 'submission.created'
  | 'submission.updated'
  | 'submission.completed'
  | 'webhook.failed';

// Template types
export interface FormTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  templateData: any; // Complete form structure
  isPublic: boolean;
  isFeatured: boolean;
  usageCount: number;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// API Request/Response types
export interface CreateFormRequest {
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  teamId?: string;
  settings?: Partial<FormSettings>;
  fields?: Omit<FormField, 'id' | 'formId' | 'createdAt' | 'updatedAt'>[];
  steps?: Omit<FormStep, 'id' | 'formId' | 'createdAt' | 'updatedAt'>[];
}

export interface UpdateFormRequest extends Partial<CreateFormRequest> {
  incrementVersion?: boolean;
}

export interface CreateSubmissionRequest {
  data: Record<string, any>;
  metadata?: Partial<SubmissionMetadata>;
  partial?: boolean;
  currentStep?: number;
  completedSteps?: number[];
  submitterEmail?: string;
  submitterName?: string;
}

export interface ListFormsQuery {
  page?: number;
  limit?: number;
  status?: FormStatus;
  search?: string;
  tags?: string[];
  category?: string;
  sort?: string;
  ownerId?: string;
  teamId?: string;
  filterOwner?: 'all' | 'mine' | 'others'; // New filter option
}

export interface ListSubmissionsQuery {
  page?: number;
  limit?: number;
  status?: SubmissionStatus;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  export?: 'csv' | 'xlsx' | 'json';
}

// XP Integration types
export interface XPAuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    full_name: string;
    email_verified: boolean;
    created_at: Date;
    updated_at: Date;
    last_login?: Date;
  };
  userId?: number;
  sessionId?: string;
  startTime?: number;
}

// Error types
export class DynamicFormBuilderError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: any
  ) {
    super(message);
    this.name = 'DynamicFormBuilderError';
  }
}

// Validation types
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  value?: any;
}