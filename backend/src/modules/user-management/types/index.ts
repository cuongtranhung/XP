// User Management Types (Simplified)

export interface User {
  id: string;
  email: string;
  username?: string;
  password_hash?: string;
  full_name?: string;
  phone_number?: string;
  department?: string;
  position?: string;
  avatar_url?: string;
  
  // Simple status fields
  status: 'active' | 'inactive' | 'suspended';
  is_approved: boolean;  // Simple enable/disable approval
  is_blocked: boolean;   // Simple enable/disable blocking
  
  // Timestamps
  last_login?: Date;
  last_activity?: Date;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface Role {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  priority: number;
  is_system: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
  scope?: 'all' | 'own' | 'department' | 'group';
  description?: string;
  created_at: Date;
}

export interface UserGroup {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  group_type: 'department' | 'project' | 'custom';
  parent_group_id?: string;
  metadata?: Record<string, any>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface UserRole {
  user_id: string;
  role_id: string;
  assigned_by?: string;
  assigned_at: Date;
  expires_at?: Date;
}

export interface UserGroupMember {
  user_id: string;
  group_id: string;
  role_in_group?: 'member' | 'manager' | 'owner';
  joined_at: Date;
  added_by?: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  created_at: Date;
}

// Request/Response DTOs
export interface CreateUserDTO {
  email: string;
  username?: string;
  password: string;
  full_name?: string;
  phone_number?: string;
  department?: string;
  position?: string;
  roles?: string[];
  groups?: string[];
  is_approved?: boolean;  // Default true
  is_blocked?: boolean;   // Default false
}

export interface UpdateUserDTO {
  email?: string;
  username?: string;
  full_name?: string;
  phone_number?: string;
  department?: string;
  position?: string;
  avatar_url?: string;
  status?: 'active' | 'inactive' | 'suspended';
  is_approved?: boolean;  // Simple toggle
  is_blocked?: boolean;   // Simple toggle
}

export interface AssignRoleDTO {
  user_id: string;
  role_id: string;
  expires_at?: Date;
}

export interface AddUserToGroupDTO {
  user_id: string;
  group_id: string;
  role_in_group?: 'member' | 'manager' | 'owner';
}

// Query filters
export interface UserFilter {
  status?: string[];
  department?: string;
  role?: string;
  group?: string;
  is_blocked?: boolean;
  is_approved?: boolean;
  search?: string;
  created_after?: Date;
  created_before?: Date;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// Service responses
export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// JWT Token payloads
export interface TokenPayload {
  user_id: string;
  email: string;
  roles: string[];
  permissions: Permission[];
  groups: string[];
}

export interface RefreshTokenPayload {
  user_id: string;
  token_id: string;
}

// Statistics
export interface UserStatistics {
  total_users: number;
  active_users: number;
  blocked_users: number;
  unapproved_users: number;
  users_by_department: Record<string, number>;
  users_by_role: Record<string, number>;
  recent_registrations: number;
}