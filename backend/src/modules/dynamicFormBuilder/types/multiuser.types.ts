/**
 * Multi-User Access System Types
 * Created: 2025-01-12
 * Purpose: TypeScript interfaces for form sharing and collaboration
 */

// =====================================================
// Core Types
// =====================================================

export type FormVisibility = 'private' | 'shared' | 'public' | 'organization';
export type PermissionLevel = 'view' | 'submit' | 'edit' | 'admin';
export type AccessType = 'owned' | 'shared' | 'public';
export type AuditAction = 
  | 'view' 
  | 'submit' 
  | 'edit' 
  | 'delete' 
  | 'share' 
  | 'unshare' 
  | 'clone' 
  | 'export' 
  | 'publish' 
  | 'unpublish'
  | 'permission_change' 
  | 'access_denied';

// =====================================================
// Database Models
// =====================================================

export interface FormShare {
  id: string;
  form_id: string;
  shared_with_user_id: number;
  shared_by_user_id: number;
  permission_level: PermissionLevel;
  shared_at: Date;
  expires_at?: Date | null;
  notes?: string | null;
}

export interface FormAccessLog {
  id: string;
  form_id: string;
  user_id?: number | null;
  session_id?: string | null;
  action: AuditAction;
  ip_address?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, any> | null;
  success: boolean;
  error_message?: string | null;
  created_at: Date;
}

export interface FormClone {
  id: string;
  original_form_id: string;
  cloned_form_id: string;
  cloned_by_user_id: number;
  cloned_at: Date;
}

export interface FormStatisticsPublic {
  form_id: string;
  form_name: string;
  visibility: FormVisibility;
  total_submissions: number;
  unique_submitters: number;
  last_submission?: Date | null;
  first_submission?: Date | null;
  completion_rate: number;
}

// =====================================================
// Extended Form Types
// =====================================================

export interface FormWithPermissions {
  id: string;
  name: string;
  description?: string;
  owner_id: number;
  visibility: FormVisibility;
  status: string;
  created_at: Date;
  updated_at: Date;
  
  // Permission info for current user
  permissions?: {
    can_view: boolean;
    can_submit: boolean;
    can_edit: boolean;
    can_delete: boolean;
    permission_source: 'owner' | 'shared' | 'public' | 'none';
  };
  
  // Sharing info (only visible to owner)
  shares?: FormShare[];
  share_count?: number;
  
  // Statistics (public)
  statistics?: FormStatisticsPublic;
}

export interface AccessibleForm {
  form_id: string;
  form_name: string;
  owner_id: number;
  visibility: FormVisibility;
  permission_level: PermissionLevel | 'owner';
  access_type: AccessType;
}

// =====================================================
// API Request/Response Types
// =====================================================

export interface ShareFormRequest {
  user_id: number;
  permission_level: PermissionLevel;
  expires_at?: string | null;
  notes?: string;
}

export interface ShareFormResponse {
  success: boolean;
  share?: FormShare;
  message?: string;
  error?: string;
}

export interface CloneFormRequest {
  new_name?: string;
  new_description?: string;
  make_public?: boolean;
}

export interface CloneFormResponse {
  success: boolean;
  cloned_form_id?: string;
  cloned_form?: FormWithPermissions;
  message?: string;
  error?: string;
}

export interface CheckPermissionsRequest {
  form_id: string;
  user_id: number;
}

export interface CheckPermissionsResponse {
  can_view: boolean;
  can_submit: boolean;
  can_edit: boolean;
  can_delete: boolean;
  permission_source: 'owner' | 'shared' | 'public' | 'none';
}

export interface GetAccessibleFormsRequest {
  user_id: number;
  include_public?: boolean;
  visibility_filter?: FormVisibility[];
  access_type_filter?: AccessType[];
  page?: number;
  limit?: number;
  sort_by?: 'name' | 'created_at' | 'updated_at';
  sort_order?: 'asc' | 'desc';
}

export interface GetAccessibleFormsResponse {
  success: boolean;
  forms: AccessibleForm[];
  total: number;
  page: number;
  total_pages: number;
}

export interface FormStatisticsRequest {
  form_id: string;
  date_from?: string;
  date_to?: string;
  include_details?: boolean;
}

export interface FormStatisticsResponse {
  success: boolean;
  statistics?: FormStatisticsPublic;
  details?: {
    daily_submissions?: Array<{ date: string; count: number }>;
    top_fields?: Array<{ field: string; submissions: number }>;
    average_completion_time?: number;
  };
  error?: string;
}

// =====================================================
// Service Layer Types
// =====================================================

export interface FormSharingService {
  shareForm(
    formId: string,
    userId: number,
    sharedBy: number,
    permission: PermissionLevel,
    expiresAt?: Date
  ): Promise<FormShare>;
  
  unshareForm(formId: string, userId: number): Promise<boolean>;
  
  getFormShares(formId: string): Promise<FormShare[]>;
  
  getUserSharedForms(userId: number): Promise<AccessibleForm[]>;
  
  updateSharePermission(
    formId: string,
    userId: number,
    newPermission: PermissionLevel
  ): Promise<FormShare>;
}

export interface FormPermissionService {
  checkPermissions(
    formId: string,
    userId: number
  ): Promise<CheckPermissionsResponse>;
  
  canView(formId: string, userId: number): Promise<boolean>;
  
  canSubmit(formId: string, userId: number): Promise<boolean>;
  
  canEdit(formId: string, userId: number): Promise<boolean>;
  
  canDelete(formId: string, userId: number): Promise<boolean>;
  
  enforcePermission(
    formId: string,
    userId: number,
    requiredPermission: 'view' | 'submit' | 'edit' | 'delete'
  ): Promise<void>; // Throws error if no permission
}

export interface FormCloneService {
  cloneForm(
    formId: string,
    userId: number,
    options?: CloneFormRequest
  ): Promise<string>; // Returns new form ID
  
  getCloneHistory(formId: string): Promise<FormClone[]>;
  
  getOriginalForm(clonedFormId: string): Promise<string | null>;
}

export interface FormAuditService {
  logAccess(
    formId: string,
    userId: number | null,
    action: AuditAction,
    metadata?: Record<string, any>,
    success?: boolean,
    errorMessage?: string
  ): Promise<void>;
  
  getFormAccessLogs(
    formId: string,
    filters?: {
      userId?: number;
      action?: AuditAction;
      dateFrom?: Date;
      dateTo?: Date;
      limit?: number;
    }
  ): Promise<FormAccessLog[]>;
  
  getUserActivityLogs(
    userId: number,
    limit?: number
  ): Promise<FormAccessLog[]>;
}

// =====================================================
// Middleware Types
// =====================================================

export interface PermissionMiddlewareOptions {
  requiredPermission: 'view' | 'submit' | 'edit' | 'delete';
  allowPublic?: boolean;
  logAccess?: boolean;
}

export interface AuditMiddlewareOptions {
  action: AuditAction;
  includeBody?: boolean;
  includeQuery?: boolean;
  sensitiveFields?: string[];
}

// =====================================================
// Frontend Types
// =====================================================

export interface FormListFilter {
  visibility?: FormVisibility[];
  accessType?: AccessType[];
  ownerId?: number;
  search?: string;
  tags?: string[];
  status?: string[];
}

export interface FormShareModalProps {
  formId: string;
  formName: string;
  currentShares: FormShare[];
  onShare: (userId: number, permission: PermissionLevel) => Promise<void>;
  onUnshare: (userId: number) => Promise<void>;
  onClose: () => void;
}

export interface OwnershipBadgeProps {
  form: FormWithPermissions;
  currentUserId: number;
  showDetails?: boolean;
}

export interface FormPermissionInfoProps {
  permissions: CheckPermissionsResponse;
  formId: string;
  showActions?: boolean;
}

// =====================================================
// Utility Types
// =====================================================

export type PermissionCheck = (
  formId: string,
  userId: number
) => Promise<boolean>;

export type AuditLogger = (
  action: AuditAction,
  metadata?: Record<string, any>
) => Promise<void>;

export interface CacheKeys {
  formPermissions: (formId: string, userId: number) => string;
  userSharedForms: (userId: number) => string;
  formShares: (formId: string) => string;
  formStatistics: (formId: string) => string;
  publicForms: () => string;
}

// =====================================================
// Export all types
// =====================================================

export * from './multiuser.types';