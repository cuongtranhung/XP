// Advanced Permission System Types for Resource-Based Authorization

// Permission Actions - What can be done
export enum PermissionAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  ASSIGN = 'assign',
  APPROVE = 'approve',
  REJECT = 'reject',
  EXPORT = 'export',
  IMPORT = 'import',
  MANAGE = 'manage', // Full control
  EXECUTE = 'execute',
  CONFIGURE = 'configure'
}

// Resource Types - What the action applies to
export enum ResourceType {
  USER = 'user',
  ROLE = 'role',
  GROUP = 'group',
  FORM = 'form',
  SUBMISSION = 'submission',
  ORGANIZATION = 'organization',
  DEPARTMENT = 'department',
  PROJECT = 'project',
  REPORT = 'report',
  AUDIT_LOG = 'audit_log',
  SYSTEM_CONFIG = 'system_config',
  API_KEY = 'api_key',
  INTEGRATION = 'integration',
  NOTIFICATION = 'notification',
  WORKFLOW = 'workflow'
}

// Permission Scope - Where the permission applies
export enum PermissionScope {
  GLOBAL = 'global',        // System-wide permission
  ORGANIZATION = 'organization', // Organization-level
  DEPARTMENT = 'department', // Department-level
  TEAM = 'team',           // Team-level
  PROJECT = 'project',     // Project-level
  OWN = 'own'             // Only own resources
}

// Permission Conditions - When the permission applies
export interface PermissionCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'in' | 'not_in' | 'greater_than' | 'less_than';
  value: any;
}

// Core Permission Definition
export interface Permission {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  action: PermissionAction;
  resource_type: ResourceType;
  scope: PermissionScope;
  conditions?: PermissionCondition[];
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Permission Template - Predefined permission sets
export interface PermissionTemplate {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  category: 'admin' | 'manager' | 'user' | 'viewer' | 'custom';
  permissions: Permission[];
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

// Role with Advanced Permissions
export interface AdvancedRole {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  priority: number;
  is_system: boolean;
  is_active: boolean;
  permissions: RolePermission[];
  inherited_permissions?: Permission[];
  effective_permissions?: Permission[];
  created_at: string;
  updated_at: string;
}

// Role-Permission Association with Context
export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  resource_constraints?: ResourceConstraint[];
  conditions?: PermissionCondition[];
  is_granted: boolean; // true = grant, false = deny
  priority: number; // For conflict resolution
  granted_by?: string;
  granted_at: string;
  expires_at?: string;
  
  // Populated from joins
  permission?: Permission;
  role?: AdvancedRole;
}

// Resource Constraints - Limit permissions to specific resources
export interface ResourceConstraint {
  resource_type: ResourceType;
  resource_ids?: string[]; // Specific resource IDs
  department_ids?: string[]; // Department-specific
  project_ids?: string[]; // Project-specific
  organization_ids?: string[]; // Organization-specific
  conditions?: PermissionCondition[];
}

// User Permissions with Context
export interface UserPermissions {
  user_id: string;
  effective_permissions: EffectivePermission[];
  role_permissions: RolePermission[];
  direct_permissions?: DirectPermission[];
  computed_at: string;
}

// Effective Permission - Final computed permission for a user
export interface EffectivePermission {
  permission: Permission;
  source_type: 'role' | 'direct' | 'inherited';
  source_id: string;
  source_name: string;
  resource_constraints: ResourceConstraint[];
  conditions: PermissionCondition[];
  is_granted: boolean;
  priority: number;
  expires_at?: string;
}

// Direct Permission - Assigned directly to user
export interface DirectPermission {
  id: string;
  user_id: string;
  permission_id: string;
  resource_constraints?: ResourceConstraint[];
  conditions?: PermissionCondition[];
  is_granted: boolean;
  priority: number;
  granted_by: string;
  granted_at: string;
  expires_at?: string;
  reason?: string;
  
  // Populated from joins
  permission?: Permission;
  user?: any;
}

// Permission Check Request
export interface PermissionCheckRequest {
  user_id: string;
  action: PermissionAction;
  resource_type: ResourceType;
  resource_id?: string;
  context?: Record<string, any>;
}

// Permission Check Result
export interface PermissionCheckResult {
  granted: boolean;
  reason: string;
  matching_permissions: EffectivePermission[];
  denied_permissions?: EffectivePermission[];
  resource_constraints: ResourceConstraint[];
}

// Bulk Permission Check
export interface BulkPermissionCheckRequest {
  user_id: string;
  checks: Omit<PermissionCheckRequest, 'user_id'>[];
}

export interface BulkPermissionCheckResult {
  results: Record<string, PermissionCheckResult>;
  computed_at: string;
}

// Permission Matrix - Visual representation
export interface PermissionMatrix {
  roles: AdvancedRole[];
  permissions: Permission[];
  matrix: PermissionMatrixCell[][];
}

export interface PermissionMatrixCell {
  role_id: string;
  permission_id: string;
  is_granted: boolean;
  source: 'direct' | 'inherited' | 'template';
  conditions?: PermissionCondition[];
  resource_constraints?: ResourceConstraint[];
  expires_at?: string;
}

// Audit Trail for Permissions
export interface PermissionAuditLog {
  id: string;
  action: 'grant' | 'revoke' | 'modify' | 'check';
  user_id: string;
  target_user_id?: string;
  role_id?: string;
  permission_id?: string;
  resource_type?: ResourceType;
  resource_id?: string;
  old_value?: any;
  new_value?: any;
  reason?: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
  created_by: string;
}

// Permission Group - Logical grouping of permissions
export interface PermissionGroup {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  icon?: string;
  color?: string;
  parent_group_id?: string;
  permissions: Permission[];
  sub_groups?: PermissionGroup[];
  order: number;
  is_system: boolean;
}

// API Request/Response Types

export interface CreatePermissionRequest {
  name: string;
  display_name: string;
  description?: string;
  action: PermissionAction;
  resource_type: ResourceType;
  scope: PermissionScope;
  conditions?: PermissionCondition[];
}

export interface UpdatePermissionRequest {
  display_name?: string;
  description?: string;
  scope?: PermissionScope;
  conditions?: PermissionCondition[];
  is_active?: boolean;
}

export interface AssignPermissionRequest {
  user_id?: string;
  role_id?: string;
  permission_id: string;
  resource_constraints?: ResourceConstraint[];
  conditions?: PermissionCondition[];
  is_granted: boolean;
  priority?: number;
  expires_at?: string;
  reason?: string;
}

export interface PermissionFilters {
  search?: string;
  actions?: PermissionAction[];
  resource_types?: ResourceType[];
  scopes?: PermissionScope[];
  is_active?: boolean;
  is_system?: boolean;
}

export interface RoleFilters {
  search?: string;
  is_active?: boolean;
  is_system?: boolean;
  has_permissions?: boolean;
  priority_min?: number;
  priority_max?: number;
}

// UI State Types
export type PermissionModalMode = 'create' | 'edit' | 'view' | 'assign';
export type PermissionViewMode = 'list' | 'matrix' | 'tree' | 'graph';

export interface PermissionFormState {
  mode: PermissionModalMode;
  selectedPermission?: Permission;
  selectedRole?: AdvancedRole;
  isLoading: boolean;
  errors: Record<string, string>;
}

// Utility Types
export type PermissionKey = `${ResourceType}:${PermissionAction}:${PermissionScope}`;

export interface PermissionContextValue {
  permissions: UserPermissions | null;
  checkPermission: (action: PermissionAction, resource: ResourceType, context?: any) => boolean;
  bulkCheckPermissions: (checks: Omit<PermissionCheckRequest, 'user_id'>[]) => Promise<BulkPermissionCheckResult>;
  refreshPermissions: () => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

// Predefined Permission Sets
export const ADMIN_PERMISSIONS = {
  SUPER_ADMIN: [
    'system_config:manage:global',
    'user:manage:global',
    'role:manage:global',
    'audit_log:read:global'
  ],
  USER_ADMIN: [
    'user:create:organization',
    'user:read:organization',
    'user:update:organization',
    'user:assign:organization'
  ],
  ROLE_ADMIN: [
    'role:create:organization',
    'role:read:organization',
    'role:update:organization',
    'role:assign:organization'
  ]
} as const;

export const MANAGER_PERMISSIONS = {
  DEPARTMENT_MANAGER: [
    'user:read:department',
    'user:update:department',
    'form:create:department',
    'report:read:department'
  ],
  PROJECT_MANAGER: [
    'project:manage:project',
    'user:assign:project',
    'form:manage:project',
    'submission:read:project'
  ]
} as const;

export const USER_PERMISSIONS = {
  STANDARD_USER: [
    'user:read:own',
    'user:update:own',
    'form:create:own',
    'submission:read:own'
  ],
  VIEWER: [
    'user:read:own',
    'form:read:organization',
    'submission:read:own'
  ]
} as const;