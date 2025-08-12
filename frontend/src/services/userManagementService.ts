import axios, { AxiosInstance } from 'axios';
import { 
  UserManagement, 
  UserManagementFilters, 
  UserManagementStats,
  UserUpdateData,
  UserRole,
  UserGroup
} from '../types/user-management';

export class UserManagementService {
  private api: AxiosInstance;

  constructor() {
    // Create dedicated axios instance for user management
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
        console.error('User Management API Error:', error);
        return Promise.reject(error);
      }
    );
  }

  // Health check
  async getHealth(): Promise<{ status: string; module: string; timestamp: string }> {
    const response = await this.api.get('/api/user-management/health');
    return response.data;
  }

  // User Management CRUD
  async getUsers(filters?: UserManagementFilters & { 
    page?: number; 
    limit?: number; 
    sortBy?: string; 
    sortOrder?: 'asc' | 'desc' 
  }): Promise<{
    success: boolean;
    data: UserManagement[];
    total: number;
    page?: number;
    totalPages?: number;
  }> {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.department) params.append('department', filters.department);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.is_approved !== undefined) params.append('is_approved', filters.is_approved.toString());
    if (filters?.is_blocked !== undefined) params.append('is_blocked', filters.is_blocked.toString());
    if (filters?.role) params.append('role', filters.role);
    if (filters?.group) params.append('group', filters.group);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);

    const queryString = params.toString();
    const url = `/api/user-management/users${queryString ? `?${queryString}` : ''}`;
    
    const response = await this.api.get(url);
    return response.data;
  }

  async getUserById(id: string): Promise<{
    success: boolean;
    data: UserManagement;
  }> {
    const response = await this.api.get(`/api/user-management/users/${id}`);
    return response.data;
  }

  async updateUser(id: string, data: UserUpdateData): Promise<{
    success: boolean;
    data: UserManagement;
    message: string;
  }> {
    const response = await this.api.put(`/api/user-management/users/${id}`, data);
    return response.data;
  }

  // Toggle Operations (Simple Boolean Functions as requested)
  async toggleUserApproval(id: string): Promise<{
    success: boolean;
    data: UserManagement;
    message: string;
  }> {
    const response = await this.api.put(`/api/user-management/users/${id}/toggle-approval`);
    return response.data;
  }

  async toggleUserBlock(id: string): Promise<{
    success: boolean;
    data: UserManagement;
    message: string;
  }> {
    const response = await this.api.put(`/api/user-management/users/${id}/toggle-block`);
    return response.data;
  }

  // Role Management
  async getRoles(): Promise<{
    success: boolean;
    data: UserRole[];
  }> {
    const response = await this.api.get('/api/user-management/roles');
    return response.data;
  }

  async assignUserRoles(userId: string, roleIds: string[]): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await this.api.post(`/api/user-management/users/${userId}/roles`, {
      roleIds
    });
    return response.data;
  }

  async removeUserRole(userId: string, roleId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await this.api.delete(`/api/user-management/users/${userId}/roles/${roleId}`);
    return response.data;
  }

  // Group Management
  async getGroups(): Promise<{
    success: boolean;
    data: UserGroup[];
  }> {
    const response = await this.api.get('/api/user-management/groups');
    return response.data;
  }

  async assignUserGroups(userId: string, groupIds: string[]): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await this.api.post(`/api/user-management/users/${userId}/groups`, {
      groupIds
    });
    return response.data;
  }

  async removeUserGroup(userId: string, groupId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await this.api.delete(`/api/user-management/users/${userId}/groups/${groupId}`);
    return response.data;
  }

  // Delete User
  async deleteUser(userId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await this.api.delete(`/api/user-management/users/${userId}`);
    return response.data;
  }

  // Statistics
  async getStats(): Promise<{
    success: boolean;
    data: UserManagementStats;
  }> {
    const response = await this.api.get('/api/user-management/stats');
    return response.data;
  }

  // Bulk Operations
  async bulkApproveUsers(userIds: string[]): Promise<{
    success: boolean;
    data: {
      successful: string[];
      failed: string[];
      total: number;
    };
    message: string;
  }> {
    const response = await this.api.put('/api/user-management/users/bulk-approve', {
      userIds
    });
    return response.data;
  }

  async bulkBlockUsers(userIds: string[]): Promise<{
    success: boolean;
    data: {
      successful: string[];
      failed: string[];
      total: number;
    };
    message: string;
  }> {
    const response = await this.api.put('/api/user-management/users/bulk-block', {
      userIds
    });
    return response.data;
  }

  async bulkUnblockUsers(userIds: string[]): Promise<{
    success: boolean;
    data: {
      successful: string[];
      failed: string[];
      total: number;
    };
    message: string;
  }> {
    const response = await this.api.put('/api/user-management/users/bulk-unblock', {
      userIds
    });
    return response.data;
  }

  // Export/Import Operations
  async exportUsers(filters?: UserManagementFilters, format: 'csv' | 'json' | 'xlsx' = 'csv'): Promise<{
    success: boolean;
    data: {
      url: string;
      filename: string;
      totalRecords: number;
    };
    message: string;
  }> {
    const params = new URLSearchParams();
    params.append('format', format);
    
    if (filters?.search) params.append('search', filters.search);
    if (filters?.department) params.append('department', filters.department);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.is_approved !== undefined) params.append('is_approved', filters.is_approved.toString());
    if (filters?.is_blocked !== undefined) params.append('is_blocked', filters.is_blocked.toString());
    if (filters?.role) params.append('role', filters.role);
    if (filters?.group) params.append('group', filters.group);

    const response = await this.api.get(`/api/user-management/users/export?${params.toString()}`);
    return response.data;
  }

  async importUsers(file: File): Promise<{
    success: boolean;
    data: {
      imported: number;
      failed: number;
      total: number;
      errors: Array<{
        row: number;
        field: string;
        message: string;
      }>;
    };
    message: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.api.post('/api/user-management/users/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async downloadExportFile(url: string, filename: string): Promise<void> {
    const response = await this.api.get(url, {
      responseType: 'blob',
    });

    // Create blob URL and trigger download
    const blob = new Blob([response.data]);
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  }

  // Audit Logs
  async getAuditLogs(userId?: string): Promise<{
    success: boolean;
    data: any[];
  }> {
    const url = userId 
      ? `/api/user-management/audit-logs?user_id=${userId}`
      : '/api/user-management/audit-logs';
    const response = await this.api.get(url);
    return response.data;
  }
}

// Export singleton instance
export const userManagementService = new UserManagementService();
export default userManagementService;