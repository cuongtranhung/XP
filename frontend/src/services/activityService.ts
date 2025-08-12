// Activity Service for Frontend
// Date: 2025-08-04

import axios, { AxiosInstance } from 'axios';
import { 
  ActivityLogResponse, 
  ActivityControlStatus, 
  ActivityControlToggle,
  ActivityLogFilters 
} from '../types/activity';

class ActivityService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('Activity API Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  // Get current user's activity logs
  async getUserActivityLogs(filters: ActivityLogFilters = {}): Promise<ActivityLogResponse> {
    try {
      const params = new URLSearchParams();
      
      if (filters.action_type) params.append('action_type', filters.action_type);
      if (filters.action_category) params.append('action_category', filters.action_category);
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());

      const response = await this.client.get(`/api/activity/my-logs?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch activity logs');
    }
  }

  // Get user's recent activity (last 10)
  async getRecentActivity(): Promise<ActivityLogResponse> {
    try {
      const response = await this.client.get('/api/activity/recent');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch recent activity');
    }
  }

  // Admin: Get activity control status
  async getActivityStatus(): Promise<ActivityControlStatus> {
    try {
      const response = await this.client.get('/api/activity-control/status');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to get activity status');
    }
  }

  // Admin: Toggle activity logging
  async toggleActivityLogging(enabled: boolean): Promise<ActivityControlToggle> {
    try {
      const response = await this.client.post('/api/activity-control/toggle', { enabled });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to toggle activity logging');
    }
  }

  // Admin: Get all users' activity logs
  async getAllActivityLogs(filters: ActivityLogFilters = {}): Promise<ActivityLogResponse> {
    try {
      const params = new URLSearchParams();
      
      if (filters.action_type) params.append('action_type', filters.action_type);
      if (filters.action_category) params.append('action_category', filters.action_category);
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());

      const response = await this.client.get(`/api/activity/all-logs?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch all activity logs');
    }
  }

  // Format date for display
  formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Ho_Chi_Minh'
      }).format(date);
    } catch (error) {
      return dateString;
    }
  }

  // Format processing time
  formatProcessingTime(ms?: number): string {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  // Get status color class
  getStatusColor(status?: number): string {
    if (!status) return 'text-gray-500';
    if (status >= 200 && status < 300) return 'text-green-600';
    if (status >= 300 && status < 400) return 'text-blue-600';
    if (status >= 400 && status < 500) return 'text-yellow-600';
    return 'text-red-600';
  }
}

// Export singleton instance
export const activityService = new ActivityService();
export default activityService;