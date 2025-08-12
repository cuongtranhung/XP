// User Management Types
export interface UserManagement {
  id: string;
  email: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  department?: string;
  position?: string;
  is_approved: boolean;
  is_blocked: boolean;
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
  updated_at: string;
  last_login?: string;
  roles?: UserRole[];
  groups?: UserGroup[];
}

export interface UserRole {
  role_id: string;
  name: string;
  display_name: string;
  description?: string;
  priority: number;
  is_system: boolean;
  is_active: boolean;
  assigned_at: string;
  expires_at?: string;
}

export interface UserGroup {
  id: string;
  name: string;
  description?: string;
  department?: string;
}

export interface UserManagementFilters {
  search?: string;
  department?: string;
  status?: string;
  is_approved?: boolean;
  is_blocked?: boolean;
  role?: string;
  group?: string;
}

export interface UserManagementStats {
  total: number;
  approved: number;
  blocked: number;
  pending: number;
  active: number;
  inactive: number;
}

export interface UserUpdateData {
  full_name?: string;
  department?: string;
  position?: string;
  is_approved?: boolean;
  is_blocked?: boolean;
  roles?: string[];
  groups?: string[];
}