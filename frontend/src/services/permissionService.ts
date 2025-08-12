import axios, { AxiosInstance } from 'axios';
import {
  Permission,
  AdvancedRole,
  RolePermission,
  UserPermissions,
  PermissionCheckRequest,
  PermissionCheckResult,
  BulkPermissionCheckRequest,
  BulkPermissionCheckResult,
  PermissionMatrix,
  CreatePermissionRequest,
  UpdatePermissionRequest,
  AssignPermissionRequest,
  PermissionFilters,
  DirectPermission,
  PermissionTemplate,
  PermissionGroup,
  PermissionAuditLog
} from '../types/permissions';

export class PermissionService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for authentication
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('Permission API Error:', error);
        return Promise.reject(error);
      }
    );
  }

  // Permission Management
  async getPermissions(filters?: PermissionFilters): Promise<{
    success: boolean;
    data: Permission[];
    total: number;
  }> {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.actions?.length) params.append('actions', filters.actions.join(','));
    if (filters?.resource_types?.length) params.append('resource_types', filters.resource_types.join(','));
    if (filters?.scopes?.length) params.append('scopes', filters.scopes.join(','));
    if (filters?.is_active !== undefined) params.append('is_active', filters.is_active.toString());
    if (filters?.is_system !== undefined) params.append('is_system', filters.is_system.toString());

    const queryString = params.toString();
    const url = `/api/permissions${queryString ? `?${queryString}` : ''}`;
    
    const response = await this.api.get(url);
    return response.data;
  }

  async getPermissionById(id: string): Promise<{
    success: boolean;
    data: Permission;
  }> {
    const response = await this.api.get(`/api/permissions/${id}`);
    return response.data;
  }

  async createPermission(data: CreatePermissionRequest): Promise<{
    success: boolean;
    data: Permission;
    message: string;
  }> {
    const response = await this.api.post('/api/permissions', data);
    return response.data;
  }

  async updatePermission(id: string, data: UpdatePermissionRequest): Promise<{
    success: boolean;
    data: Permission;
    message: string;
  }> {
    const response = await this.api.put(`/api/permissions/${id}`, data);
    return response.data;
  }

  async deletePermission(id: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await this.api.delete(`/api/permissions/${id}`);
    return response.data;
  }

  // Advanced Role Management
  async getAdvancedRoles(filters?: any): Promise<{
    success: boolean;
    data: AdvancedRole[];
    total: number;
  }> {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.is_active !== undefined) params.append('is_active', filters.is_active.toString());
    if (filters?.is_system !== undefined) params.append('is_system', filters.is_system.toString());
    if (filters?.has_permissions !== undefined) params.append('has_permissions', filters.has_permissions.toString());

    const queryString = params.toString();
    const url = `/api/roles/advanced${queryString ? `?${queryString}` : ''}`;
    
    const response = await this.api.get(url);
    return response.data;
  }

  async getAdvancedRoleById(id: string): Promise<{
    success: boolean;
    data: AdvancedRole;
  }> {
    const response = await this.api.get(`/api/roles/advanced/${id}`);
    return response.data;
  }

  // Role-Permission Management
  async getRolePermissions(roleId: string): Promise<{
    success: boolean;
    data: RolePermission[];
  }> {
    const response = await this.api.get(`/api/permissions/roles/${roleId}/permissions`);
    return response.data;
  }

  async assignPermissionToRole(roleId: string, data: Omit<AssignPermissionRequest, 'role_id'>): Promise<{
    success: boolean;
    data: RolePermission;
    message: string;
  }> {
    const response = await this.api.post(`/api/roles/${roleId}/permissions`, data);
    return response.data;
  }

  async removePermissionFromRole(roleId: string, permissionId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await this.api.delete(`/api/roles/${roleId}/permissions/${permissionId}`);
    return response.data;
  }

  async updateRolePermission(roleId: string, permissionId: string, data: Partial<AssignPermissionRequest>): Promise<{
    success: boolean;
    data: RolePermission;
    message: string;
  }> {
    const response = await this.api.put(`/api/roles/${roleId}/permissions/${permissionId}`, data);
    return response.data;
  }

  // User Permission Management
  async getUserPermissions(userId: string): Promise<{
    success: boolean;
    data: UserPermissions;
  }> {
    const response = await this.api.get(`/api/users/${userId}/permissions`);
    return response.data;
  }

  async getCurrentUserPermissions(): Promise<{
    success: boolean;
    data: UserPermissions;
  }> {
    const response = await this.api.get('/api/permissions/me');
    return response.data;
  }

  async assignDirectPermissionToUser(userId: string, data: Omit<AssignPermissionRequest, 'user_id'>): Promise<{
    success: boolean;
    data: DirectPermission;
    message: string;
  }> {
    const response = await this.api.post(`/api/users/${userId}/permissions`, data);
    return response.data;
  }

  async removeDirectPermissionFromUser(userId: string, permissionId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await this.api.delete(`/api/users/${userId}/permissions/${permissionId}`);
    return response.data;
  }

  // Permission Checking
  async checkPermission(data: PermissionCheckRequest): Promise<{
    success: boolean;
    data: PermissionCheckResult;
  }> {
    const response = await this.api.post('/api/permissions/check', data);
    return response.data;
  }

  async bulkCheckPermissions(data: BulkPermissionCheckRequest): Promise<{
    success: boolean;
    data: BulkPermissionCheckResult;
  }> {
    const response = await this.api.post('/api/permissions/check/bulk', data);
    return response.data;
  }

  // Current user permission checking (optimized)
  async checkCurrentUserPermission(action: string, resource: string, context?: any): Promise<{
    success: boolean;
    data: { granted: boolean; reason: string };
  }> {
    const response = await this.api.post('/api/permissions/check/me', {
      action,
      resource,
      context
    });
    return response.data;
  }

  // Permission Matrix
  async getPermissionMatrix(roleIds?: string[]): Promise<{
    success: boolean;
    data: PermissionMatrix;
  }> {
    const params = new URLSearchParams();
    if (roleIds?.length) {
      params.append('role_ids', roleIds.join(','));
    }
    
    const queryString = params.toString();
    const url = `/api/permissions/matrix${queryString ? `?${queryString}` : ''}`;
    
    const response = await this.api.get(url);
    return response.data;
  }

  async updatePermissionMatrix(updates: {
    role_id: string;
    permission_id: string;
    is_granted: boolean;
    conditions?: any[];
    resource_constraints?: any[];
  }[]): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await this.api.put('/api/permissions/matrix', { updates });
    return response.data;
  }

  // Permission Templates
  async getPermissionTemplates(): Promise<{
    success: boolean;
    data: PermissionTemplate[];
  }> {
    const response = await this.api.get('/api/permissions/templates');
    return response.data;
  }

  async applyPermissionTemplate(roleId: string, templateId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await this.api.post(`/api/roles/${roleId}/apply-template`, {
      template_id: templateId
    });
    return response.data;
  }

  // Permission Groups
  async getPermissionGroups(): Promise<{
    success: boolean;
    data: PermissionGroup[];
  }> {
    const response = await this.api.get('/api/permissions/groups');
    return response.data;
  }

  // Audit Logs
  async getPermissionAuditLogs(filters?: {
    user_id?: string;
    action?: string;
    resource_type?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    success: boolean;
    data: PermissionAuditLog[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const params = new URLSearchParams();
    if (filters?.user_id) params.append('user_id', filters.user_id);
    if (filters?.action) params.append('action', filters.action);
    if (filters?.resource_type) params.append('resource_type', filters.resource_type);
    if (filters?.date_from) params.append('date_from', filters.date_from);
    if (filters?.date_to) params.append('date_to', filters.date_to);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const queryString = params.toString();
    const url = `/api/permissions/audit${queryString ? `?${queryString}` : ''}`;
    
    const response = await this.api.get(url);
    return response.data;
  }

  // Bulk Operations
  async bulkAssignPermissions(data: {
    role_ids?: string[];
    user_ids?: string[];
    permission_ids: string[];
    is_granted: boolean;
    expires_at?: string;
    reason?: string;
  }): Promise<{
    success: boolean;
    data: {
      successful: number;
      failed: number;
      errors: any[];
    };
    message: string;
  }> {
    const response = await this.api.post('/api/permissions/bulk-assign', data);
    return response.data;
  }

  async bulkRemovePermissions(data: {
    role_ids?: string[];
    user_ids?: string[];
    permission_ids: string[];
    reason?: string;
  }): Promise<{
    success: boolean;
    data: {
      successful: number;
      failed: number;
      errors: any[];
    };
    message: string;
  }> {
    const response = await this.api.post('/api/permissions/bulk-remove', data);
    return response.data;
  }

  // Permission Synchronization
  async syncUserPermissions(userId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await this.api.post(`/api/users/${userId}/permissions/sync`);
    return response.data;
  }

  async syncAllUserPermissions(): Promise<{
    success: boolean;
    data: {
      processed: number;
      updated: number;
      errors: number;
    };
    message: string;
  }> {
    const response = await this.api.post('/api/permissions/sync-all');
    return response.data;
  }

  // Permission Analytics
  async getPermissionAnalytics(): Promise<{
    success: boolean;
    data: {
      total_permissions: number;
      active_permissions: number;
      roles_count: number;
      users_with_direct_permissions: number;
      most_used_permissions: Permission[];
      least_used_permissions: Permission[];
      permission_usage_by_resource: Record<string, number>;
    };
  }> {
    const response = await this.api.get('/api/permissions/analytics');
    return response.data;
  }

  // Additional methods for PermissionManagementModal
  async getAllPermissions(): Promise<{
    success: boolean;
    data: Permission[];
  }> {
    const response = await this.api.get('/api/permissions/all');
    return response.data;
  }

  async updateRolePermissions(roleId: string, data: {
    add: string[];
    remove: string[];
  }): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await this.api.put(`/api/permissions/roles/${roleId}/permissions`, data);
    return response.data;
  }
}

// Export singleton instance
export const permissionService = new PermissionService();
export default permissionService;