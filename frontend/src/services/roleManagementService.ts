import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  Role,
  UserRole,
  AssignRoleRequest,
  CreateRoleRequest,
  UpdateRoleRequest,
  RoleFilters,
  ServiceResponse,
  PaginatedResponse,
  UserForRoleAssignment
} from '../types/role-management';

class RoleManagementService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/user-management/roles`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth interceptor
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('sessionToken');
      if (token) {
        config.headers['x-session-token'] = token;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('Role API Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  // Get all roles
  async getRoles(filters?: RoleFilters): Promise<ServiceResponse<Role[]>> {
    try {
      const params = new URLSearchParams();
      if (filters?.search) params.append('search', filters.search);
      if (filters?.is_active !== undefined) params.append('is_active', filters.is_active.toString());
      if (filters?.is_system !== undefined) params.append('is_system', filters.is_system.toString());
      if (filters?.priority_min !== undefined) params.append('priority_min', filters.priority_min.toString());
      if (filters?.priority_max !== undefined) params.append('priority_max', filters.priority_max.toString());

      const response: AxiosResponse<ServiceResponse<Role[]>> = await this.api.get(`/?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching roles:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to fetch roles'
      };
    }
  }

  // Create new role
  async createRole(roleData: CreateRoleRequest): Promise<ServiceResponse<Role>> {
    try {
      const response: AxiosResponse<ServiceResponse<Role>> = await this.api.post('/', roleData);
      return response.data;
    } catch (error: any) {
      console.error('Error creating role:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to create role'
      };
    }
  }

  // Update role
  async updateRole(roleId: string, updates: UpdateRoleRequest): Promise<ServiceResponse<Role>> {
    try {
      const response: AxiosResponse<ServiceResponse<Role>> = await this.api.put(`/${roleId}`, updates);
      return response.data;
    } catch (error: any) {
      console.error('Error updating role:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to update role'
      };
    }
  }

  // Delete role
  async deleteRole(roleId: string): Promise<ServiceResponse<void>> {
    try {
      const response: AxiosResponse<ServiceResponse<void>> = await this.api.delete(`/${roleId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error deleting role:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to delete role'
      };
    }
  }

  // Get user's roles
  async getUserRoles(userId: string): Promise<ServiceResponse<Role[]>> {
    try {
      const response: AxiosResponse<ServiceResponse<Role[]>> = await this.api.get(`/user/${userId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching user roles:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to fetch user roles'
      };
    }
  }

  // Assign role to user
  async assignRoleToUser(assignData: AssignRoleRequest): Promise<ServiceResponse<UserRole>> {
    try {
      const response: AxiosResponse<ServiceResponse<UserRole>> = await this.api.post('/assign', assignData);
      return response.data;
    } catch (error: any) {
      console.error('Error assigning role:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to assign role'
      };
    }
  }

  // Remove role from user
  async removeRoleFromUser(userId: string, roleId: string): Promise<ServiceResponse<void>> {
    try {
      const response: AxiosResponse<ServiceResponse<void>> = await this.api.delete(`/remove/${userId}/${roleId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error removing role:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to remove role'
      };
    }
  }

  // Get users by role
  async getUsersByRole(
    roleId: string, 
    page: number = 1, 
    limit: number = 10
  ): Promise<ServiceResponse<PaginatedResponse<UserForRoleAssignment>>> {
    try {
      const response: AxiosResponse<ServiceResponse<PaginatedResponse<UserForRoleAssignment>>> = 
        await this.api.get(`/${roleId}/users?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching users by role:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to fetch users by role'
      };
    }
  }

  // Health check
  async healthCheck(): Promise<ServiceResponse<any>> {
    try {
      const response: AxiosResponse<ServiceResponse<any>> = await this.api.get('/');
      return response.data;
    } catch (error: any) {
      console.error('Role service health check failed:', error);
      return {
        success: false,
        error: 'Role service unavailable'
      };
    }
  }
}

// Singleton instance
export const roleManagementService = new RoleManagementService();
export default roleManagementService;