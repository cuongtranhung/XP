export interface Permission {
  id: string;
  resource: string;
  action: string;
  scope: 'all' | 'own' | 'department' | 'group';
  display_name?: string;
  description?: string;
  group_id?: string;
  group_name?: string;
  group_display_name?: string;
  is_system?: boolean;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface PermissionGroup {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  icon?: string;
  sort_order?: number;
  is_active?: boolean;
  permissions?: Permission[];
  created_at?: Date;
  updated_at?: Date;
}

export interface RolePermission {
  role_id: string;
  permission_id: string;
  granted_by?: number;
  granted_at?: Date;
  expires_at?: Date;
}

export interface UserPermission {
  user_id: number;
  permission_id: string;
  granted: boolean;
  granted_by?: number;
  granted_at?: Date;
  expires_at?: Date;
  reason?: string;
}

export interface PermissionAssignment {
  permissionId: string;
  granted?: boolean;
  reason?: string;
  expiresAt?: Date;
}

export interface UserEffectivePermission {
  user_id: number;
  email: string;
  permission_id: string;
  permission_name: string;
  resource: string;
  action: string;
  scope: string;
  display_name?: string;
  permission_group?: string;
  granted: boolean;
  expires_at?: Date;
}

export interface RolePermissionSummary {
  role_id: string;
  role_name: string;
  role_display_name: string;
  role_priority: number;
  permission_group: string;
  group_display_name: string;
  permission_count: number;
  permissions: Permission[];
}

export interface PermissionMatrix {
  roles: Array<{
    id: string;
    name: string;
    display_name: string;
    priority: number;
  }>;
  groups: Array<{
    name: string;
    display_name: string;
    permissions: Permission[];
  }>;
  data: {
    [roleId: string]: {
      [groupName: string]: Array<{
        id: string;
        name: string;
        resource: string;
        action: string;
        scope: string;
        display_name: string;
        has_permission: boolean;
      }>;
    };
  };
}

export interface PermissionCheckRequest {
  userId: number;
  resource: string;
  action: string;
  scope?: string;
}

export interface PermissionCheckResponse {
  hasPermission: boolean;
  userId: number;
  resource: string;
  action: string;
  scope: string;
}