// Group Management Types
export interface Group {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  group_type: 'system' | 'department' | 'project' | 'custom';
  parent_group_id?: string;
  is_active: boolean;
  is_system?: boolean;
  metadata?: Record<string, any>;
  member_count?: number;
  active_member_count?: number;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

export interface UserGroup {
  id: string;
  user_id: string;
  group_id: string;
  assigned_by?: string;
  assigned_at: string;
  group?: Group;
}

export interface CreateGroupRequest {
  name: string;
  display_name: string;
  description?: string;
  group_type: 'department' | 'project' | 'custom';
  parent_group_id?: string;
  metadata?: Record<string, any>;
}

export interface UpdateGroupRequest {
  display_name?: string;
  description?: string;
  is_active?: boolean;
  metadata?: Record<string, any>;
}

export interface AssignGroupRequest {
  user_id: string;
  group_id: string;
}

export interface GroupFilters {
  search?: string;
  group_type?: string;
  is_active?: boolean;
  is_system?: boolean;
  created_after?: string;
  created_before?: string;
}

export interface UserForGroupAssignment {
  id: number;
  email: string;
  full_name?: string;
  department?: string;
  position?: string;
  is_approved?: boolean;
  is_blocked?: boolean;
  role_in_group?: 'member' | 'manager' | 'owner';
  joined_at?: string;
  status?: string;
}

export interface ServiceResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
  message?: string;
  error?: string;
}

// New types for member management
export interface AddMembersRequest {
  user_ids: string[];
  role_in_group?: 'member' | 'manager' | 'owner';
}

export interface BulkMemberResponse {
  success: boolean;
  message: string;
  data: {
    successful: {
      user_id: string;
      success: boolean;
      message: string;
    }[];
    failed: {
      user_id: string;
      success: boolean;
      error: string;
    }[];
    summary: {
      total: number;
      successful_count: number;
      failed_count: number;
    };
  };
}

export interface UpdateMemberRoleRequest {
  role_in_group: 'member' | 'manager' | 'owner';
}