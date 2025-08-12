/**
 * Type definitions for Form Builder frontend
 */

export interface Form {
  id: string;
  slug: string;
  name: string;
  title?: string;         // Alias for name in some contexts
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
  shareUrl?: string;
  editUrl?: string;
  previewUrl?: string;
  statistics?: {
    views?: number;
    submissions?: number;
    conversionRate?: number;
    avgCompletionTime?: number;
  };
}

export enum FormStatus {
  Draft = 'draft',
  Published = 'published', 
  Archived = 'archived'
}

export enum FormVisibility {
  Public = 'public',
  Private = 'private',
  Team = 'team'
}

export interface FormSettings {
  id?: string;
  title?: string;
  description?: string;
  theme?: string;
  multiPage?: boolean;
  progressBar?: {
    enabled: boolean;
    type: 'steps' | 'percentage';
  };
  saveProgress?: {
    enabled: boolean;
    autoSave: boolean;
    interval?: number;
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

export interface FormField {
  id: string;
  formId?: string;
  fieldKey: string;
  fieldType: FieldType;
  type?: string; // Alias for fieldType in some contexts
  key?: string; // Alias for fieldKey in some contexts
  label: string;
  placeholder?: string;
  helpText?: string; // Help text shown below field
  position: number;
  required: boolean;
  hidden: boolean;
  validation?: FieldValidation;
  options?: FieldOption[];
  conditionalLogic?: ConditionalLogic;
  stepId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type Field = FormField; // Alias for compatibility

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
  Dropdown = 'dropdown', // Alias for select
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
  Location = 'location',
  Divider = 'divider',
  FileUpload = 'file' // Alias for backwards compatibility
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  custom?: string;
  maxSize?: number; // For file upload validation
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
  logic?: 'and' | 'or';
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

export interface FormStep {
  id: string;
  formId?: string;
  title: string;
  description?: string;
  position: number;
  settings?: StepSettings;
  fields?: FormField[];
  createdAt?: Date;
  updatedAt?: Date;
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
  completionTime?: number;
  createdAt: Date;
  updatedAt: Date;
  submittedAt?: Date;
  deletedAt?: Date;
}

export enum SubmissionStatus {
  Draft = 'draft',
  Completed = 'completed',
  Processing = 'processing', 
  Failed = 'failed'
}

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

// Field types for the sidebar
export interface FieldTypeDefinition {
  type: FieldType;
  label: string;
  icon: string;
  category: FieldCategory;
  description: string;
  defaultOptions?: Partial<FormField>;
}

export enum FieldCategory {
  Basic = 'basic',
  Advanced = 'advanced', 
  Layout = 'layout',
  Payment = 'payment'
}

// Form Builder Context
export interface FormBuilderContextType {
  form?: Form;
  fields: FormField[];
  steps: FormStep[];
  selectedField?: FormField;
  selectedStep?: FormStep;
  draggedField?: FieldTypeDefinition;
  isDragging: boolean;
  isPreviewMode: boolean;
  formSettings: FormSettings;
  
  // Actions
  addField: (fieldType: FieldType | FormField, position?: number) => void;
  updateField: (fieldId: string, updates: Partial<FormField>) => void;
  deleteField: (fieldId: string) => void;
  selectField: (field: FormField | undefined) => void;
  reorderFields: (dragIndex: number, dropIndex: number) => void;
  
  addStep: (step: Omit<FormStep, 'id'>) => void;
  updateStep: (stepId: string, updates: Partial<FormStep>) => void;
  deleteStep: (stepId: string) => void;
  selectStep: (step: FormStep | undefined) => void;
  
  setDraggedField: (field: FieldTypeDefinition | undefined) => void;
  setIsDragging: (isDragging: boolean) => void;
  setIsPreviewMode: (isPreview: boolean) => void;
  
  // Collaboration methods
  updateForm: (updates: Partial<Form>) => void;
  updateFormSettings: (updates: Partial<FormSettings>) => void;
  addFieldAtPosition: (field: FormField, position: number) => void;
  setAllFields: (fields: FormField[]) => void;
  saveForm?: () => Promise<void>;
}

// API Request/Response types
export interface ListFormsResponse {
  success: boolean;
  data: {
    forms: Form[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

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
}

// Error handling
export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

// Analytics types
export interface FormAnalytics {
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