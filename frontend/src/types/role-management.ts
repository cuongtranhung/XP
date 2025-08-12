// Role Management Types for Frontend

export interface Role {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  priority: number;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  user_id: string;
  role_id: string;
  assigned_by?: string;
  assigned_at: string;
  expires_at?: string;
  // Extended info from joins
  role_name?: string;
  assigned_by_name?: string;
}

export interface AssignRoleRequest {
  user_id: string;
  role_id: string;
  expires_at?: Date;
}

export interface CreateRoleRequest {
  name: string;
  display_name: string;
  description?: string;
  priority?: number;
}

export interface UpdateRoleRequest {
  display_name?: string;
  description?: string;
  priority?: number;
  is_active?: boolean;
}

export interface RoleFilters {
  search?: string;
  is_active?: boolean;
  is_system?: boolean;
  priority_min?: number;
  priority_max?: number;
}

export interface RoleWithUserCount extends Role {
  user_count: number;
}

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

// Extended user type for role assignment
export interface UserForRoleAssignment {
  id: string;
  email: string;
  full_name?: string;
  department?: string;
  status: 'active' | 'inactive' | 'suspended';
  current_roles: Role[];
}

// Role statistics
export interface RoleStatistics {
  total_roles: number;
  active_roles: number;
  system_roles: number;
  custom_roles: number;
  most_assigned_role: Role;
  least_assigned_role: Role;
  roles_by_priority: Record<number, number>;
}