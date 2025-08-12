import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  Group,
  UserGroup,
  AssignGroupRequest,
  CreateGroupRequest,
  UpdateGroupRequest,
  GroupFilters,
  ServiceResponse,
  PaginatedResponse,
  UserForGroupAssignment,
  AddMembersRequest,
  BulkMemberResponse,
  UpdateMemberRoleRequest
} from '../types/group-management';

class GroupManagementService {
  private api: AxiosInstance;

  private getApiUrl(): string {
    if (process.env.NODE_ENV === 'test') {
      return 'http://localhost:5000';
    }
    // Use globalThis to avoid import.meta.env in test environment
    const viteEnv = (globalThis as any).import?.meta?.env;
    return viteEnv?.VITE_API_URL || 'http://localhost:5000';
  }

  constructor() {
    this.api = axios.create({
      baseURL: `${this.getApiUrl()}/api/user-management/groups`,
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
        console.error('Group API Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  // Get all groups
  async getGroups(filters?: GroupFilters): Promise<ServiceResponse<Group[]>> {
    try {
      const params = new URLSearchParams();
      if (filters?.search) params.append('search', filters.search);
      if (filters?.group_type) params.append('group_type', filters.group_type);
      if (filters?.is_active !== undefined) params.append('is_active', filters.is_active.toString());
      if (filters?.is_system !== undefined) params.append('is_system', filters.is_system.toString());
      if (filters?.created_after) params.append('created_after', filters.created_after);
      if (filters?.created_before) params.append('created_before', filters.created_before);

      const response: AxiosResponse<ServiceResponse<Group[]>> = await this.api.get(`/?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        data: [],
        error: error.response?.data?.message || 'Failed to fetch groups'
      };
    }
  }

  // Get group by ID
  async getGroupById(groupId: string): Promise<ServiceResponse<Group>> {
    try {
      const response: AxiosResponse<ServiceResponse<Group>> = await this.api.get(`/${groupId}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        data: {} as Group,
        error: error.response?.data?.message || 'Failed to fetch group'
      };
    }
  }

  // Create new group
  async createGroup(groupData: CreateGroupRequest): Promise<ServiceResponse<Group>> {
    try {
      const response: AxiosResponse<ServiceResponse<Group>> = await this.api.post('/', groupData);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        data: {} as Group,
        error: error.response?.data?.message || 'Failed to create group'
      };
    }
  }

  // Update group
  async updateGroup(groupId: string, updates: UpdateGroupRequest): Promise<ServiceResponse<Group>> {
    try {
      const response: AxiosResponse<ServiceResponse<Group>> = await this.api.put(`/${groupId}`, updates);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        data: {} as Group,
        error: error.response?.data?.message || 'Failed to update group'
      };
    }
  }

  // Delete group
  async deleteGroup(groupId: string): Promise<ServiceResponse<void>> {
    try {
      const response: AxiosResponse<ServiceResponse<void>> = await this.api.delete(`/${groupId}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        data: undefined,
        error: error.response?.data?.message || 'Failed to delete group'
      };
    }
  }

  // Get user's groups
  async getUserGroups(userId: string): Promise<ServiceResponse<UserGroup[]>> {
    try {
      const response: AxiosResponse<ServiceResponse<UserGroup[]>> = await this.api.get(`/user/${userId}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        data: [],
        error: error.response?.data?.message || 'Failed to fetch user groups'
      };
    }
  }

  // Assign group to user
  async assignGroupToUser(assignData: AssignGroupRequest): Promise<ServiceResponse<UserGroup>> {
    try {
      const response: AxiosResponse<ServiceResponse<UserGroup>> = await this.api.post('/assign', assignData);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        data: {} as UserGroup,
        error: error.response?.data?.message || 'Failed to assign group'
      };
    }
  }

  // Remove group from user
  async removeGroupFromUser(userId: string, groupId: string): Promise<ServiceResponse<void>> {
    try {
      const response: AxiosResponse<ServiceResponse<void>> = await this.api.delete(`/remove/${userId}/${groupId}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        data: undefined,
        error: error.response?.data?.message || 'Failed to remove group'
      };
    }
  }

  // Get group members (updated to match new API)
  async getUsersByGroup(
    groupId: string, 
    pagination: { page?: number; limit?: number } = {}
  ): Promise<ServiceResponse<UserForGroupAssignment[]>> {
    try {
      const params = new URLSearchParams();
      if (pagination.page) params.append('page', pagination.page.toString());
      if (pagination.limit) params.append('limit', pagination.limit.toString());

      const response: AxiosResponse<PaginatedResponse<UserForGroupAssignment>> = 
        await this.api.get(`/${groupId}/members?${params.toString()}`);
      
      // Transform paginated response to simple array for backward compatibility
      return {
        success: response.data.success,
        data: response.data.data.items,
        message: response.data.message
      };
    } catch (error: any) {
      return {
        success: false,
        data: [],
        error: error.response?.data?.message || 'Failed to fetch group members'
      };
    }
  }

  // Get group members with pagination (new method)
  async getGroupMembers(
    groupId: string, 
    pagination: { page?: number; limit?: number } = {}
  ): Promise<PaginatedResponse<UserForGroupAssignment>> {
    try {
      const params = new URLSearchParams();
      if (pagination.page) params.append('page', pagination.page.toString());
      if (pagination.limit) params.append('limit', pagination.limit.toString());

      const response: AxiosResponse<PaginatedResponse<UserForGroupAssignment>> = 
        await this.api.get(`/${groupId}/members?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        data: {
          items: [],
          total: 0,
          page: 1,
          limit: 10,
          total_pages: 0
        },
        error: error.response?.data?.message || 'Failed to fetch group members'
      };
    }
  }

  // Search users for group assignment (not in group)
  async searchUsersForAssignment(
    groupId: string,
    searchTerm?: string,
    department?: string,
    limit?: number
  ): Promise<ServiceResponse<UserForGroupAssignment[]>> {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (department) params.append('department', department);
      if (limit) params.append('limit', limit.toString());
      
      const response: AxiosResponse<ServiceResponse<UserForGroupAssignment[]>> = 
        await this.api.get(`/${groupId}/available-users?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        data: [],
        error: error.response?.data?.message || 'Failed to search users'
      };
    }
  }

  // Add members to group (bulk operation)
  async addMembersToGroup(
    groupId: string,
    memberData: AddMembersRequest
  ): Promise<BulkMemberResponse> {
    try {
      const response: AxiosResponse<BulkMemberResponse> = 
        await this.api.post(`/${groupId}/members`, memberData);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to add members to group',
        data: {
          successful: [],
          failed: [],
          summary: {
            total: 0,
            successful_count: 0,
            failed_count: 0
          }
        }
      };
    }
  }

  // Remove member from group
  async removeMemberFromGroup(
    groupId: string,
    userId: string
  ): Promise<ServiceResponse<void>> {
    try {
      const response: AxiosResponse<ServiceResponse<void>> = 
        await this.api.delete(`/${groupId}/members/${userId}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        data: undefined,
        error: error.response?.data?.message || 'Failed to remove member from group'
      };
    }
  }

  // Update member role in group
  async updateMemberRole(
    groupId: string,
    userId: string,
    roleData: UpdateMemberRoleRequest
  ): Promise<ServiceResponse<UserForGroupAssignment>> {
    try {
      const response: AxiosResponse<ServiceResponse<UserForGroupAssignment>> = 
        await this.api.put(`/${groupId}/members/${userId}`, roleData);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        data: {} as UserForGroupAssignment,
        error: error.response?.data?.message || 'Failed to update member role'
      };
    }
  }

  // Get group statistics
  async getGroupStatistics(): Promise<ServiceResponse<any>> {
    try {
      const response: AxiosResponse<ServiceResponse<any>> = 
        await this.api.get('/statistics');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        data: {
          totalGroups: 0,
          totalMembers: 0,
          groupsByType: {
            system: { total: 0, active: 0 },
            department: { total: 0, active: 0 },
            project: { total: 0, active: 0 },
            custom: { total: 0, active: 0 }
          },
          groupsByStatus: { active: 0, inactive: 0 }
        },
        error: error.response?.data?.message || 'Failed to fetch group statistics'
      };
    }
  }
}

const groupManagementService = new GroupManagementService();
export default groupManagementService;