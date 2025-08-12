import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Role } from '../../types/role-management';
import roleManagementService from '../../services/roleManagementService';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Button } from '../common/Button';
import RoleBadge from './RoleBadge';

interface RoleAnalyticsData {
  totalRoles: number;
  activeRoles: number;
  systemRoles: number;
  customRoles: number;
  roleDistribution: {
    role_id: string;
    role_name: string;
    display_name: string;
    priority: number;
    user_count: number;
    is_system: boolean;
  }[];
  priorityStats: {
    high: number; // 900-1000
    medium: number; // 500-899
    low: number; // 100-499
    minimal: number; // 1-99
  };
  recentActivity: {
    date: string;
    assignments: number;
    removals: number;
    creates: number;
  }[];
}

interface RoleAnalyticsDashboardProps {
  className?: string;
}

const RoleAnalyticsDashboard: React.FC<RoleAnalyticsDashboardProps> = ({ className = '' }) => {
  const [analyticsData, setAnalyticsData] = useState<RoleAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [viewMode, setViewMode] = useState<'overview' | 'distribution' | 'trends'>('overview');

  // Load analytics data
  const loadAnalyticsData = async (isRefresh: boolean = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Load all roles
      const rolesResponse = await roleManagementService.getRoles({});
      
      if (!rolesResponse.success || !rolesResponse.data) {
        toast.error('Không thể tải dữ liệu vai trò');
        return;
      }

      const roles = rolesResponse.data;

      // Calculate basic statistics
      const totalRoles = roles.length;
      const activeRoles = roles.filter(role => role.is_active).length;
      const systemRoles = roles.filter(role => role.is_system).length;
      const customRoles = roles.filter(role => !role.is_system).length;

      // Get role distribution (user count per role)
      const roleDistribution = [];
      for (const role of roles) {
        try {
          const usersResponse = await roleManagementService.getUsersByRole(role.id, 1, 1);
          const userCount = usersResponse.success && usersResponse.data ? usersResponse.data.total : 0;
          
          roleDistribution.push({
            role_id: role.id,
            role_name: role.name,
            display_name: role.display_name,
            priority: role.priority,
            user_count: userCount,
            is_system: role.is_system
          });
        } catch (error) {
          console.error(`Error getting user count for role ${role.id}:`, error);
          roleDistribution.push({
            role_id: role.id,
            role_name: role.name,
            display_name: role.display_name,
            priority: role.priority,
            user_count: 0,
            is_system: role.is_system
          });
        }
      }

      // Calculate priority distribution
      const priorityStats = {
        high: roles.filter(role => role.priority >= 900).length,
        medium: roles.filter(role => role.priority >= 500 && role.priority < 900).length,
        low: roles.filter(role => role.priority >= 100 && role.priority < 500).length,
        minimal: roles.filter(role => role.priority < 100).length
      };

      // Mock recent activity data (in real app, this would come from audit logs)
      const recentActivity = [
        { date: '2025-01-10', assignments: 15, removals: 3, creates: 1 },
        { date: '2025-01-09', assignments: 8, removals: 2, creates: 0 },
        { date: '2025-01-08', assignments: 12, removals: 1, creates: 2 },
        { date: '2025-01-07', assignments: 6, removals: 4, creates: 0 },
        { date: '2025-01-06', assignments: 9, removals: 1, creates: 1 },
        { date: '2025-01-05', assignments: 11, removals: 2, creates: 0 },
        { date: '2025-01-04', assignments: 7, removals: 3, creates: 1 }
      ];

      setAnalyticsData({
        totalRoles,
        activeRoles,
        systemRoles,
        customRoles,
        roleDistribution: roleDistribution.sort((a, b) => b.user_count - a.user_count),
        priorityStats,
        recentActivity
      });

    } catch (error: any) {
      console.error('Error loading analytics data:', error);
      toast.error('Lỗi khi tải dữ liệu thống kê');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnalyticsData();
  }, [timeRange]);

  // Handle refresh
  const handleRefresh = () => {
    loadAnalyticsData(true);
  };

  // Get priority color
  const getPriorityColor = (priority: number): string => {
    if (priority >= 900) return 'bg-red-500';
    if (priority >= 500) return 'bg-orange-500';
    if (priority >= 100) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  // Get user count color
  const getUserCountColor = (count: number): string => {
    if (count === 0) return 'text-gray-500';
    if (count <= 5) return 'text-green-600';
    if (count <= 20) return 'text-blue-600';
    return 'text-purple-600';
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
        <div className="p-6">
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner size="lg" />
            <span className="ml-3 text-gray-600">Đang tải dữ liệu thống kê...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
        <div className="p-6">
          <div className="text-center py-12">
            <span className="text-gray-500">Không thể tải dữ liệu thống kê</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              📊 Thống Kê Vai Trò
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Tổng quan về phân bổ và sử dụng vai trò trong hệ thống
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {/* Time Range Filter */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="7d">7 ngày</option>
              <option value="30d">30 ngày</option>
              <option value="90d">90 ngày</option>
            </select>

            {/* View Mode */}
            <div className="flex bg-gray-100 rounded-md p-1">
              <button
                onClick={() => setViewMode('overview')}
                className={`px-3 py-1 text-xs font-medium rounded ${
                  viewMode === 'overview'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Tổng quan
              </button>
              <button
                onClick={() => setViewMode('distribution')}
                className={`px-3 py-1 text-xs font-medium rounded ${
                  viewMode === 'distribution'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Phân bổ
              </button>
              <button
                onClick={() => setViewMode('trends')}
                className={`px-3 py-1 text-xs font-medium rounded ${
                  viewMode === 'trends'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Xu hướng
              </button>
            </div>

            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              disabled={refreshing}
            >
              {refreshing ? <LoadingSpinner size="xs" /> : '🔄 Làm mới'}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {viewMode === 'overview' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm">Tổng vai trò</p>
                    <p className="text-2xl font-bold">{analyticsData.totalRoles}</p>
                  </div>
                  <div className="text-3xl opacity-80">📋</div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm">Vai trò hoạt động</p>
                    <p className="text-2xl font-bold">{analyticsData.activeRoles}</p>
                  </div>
                  <div className="text-3xl opacity-80">✅</div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm">Vai trò hệ thống</p>
                    <p className="text-2xl font-bold">{analyticsData.systemRoles}</p>
                  </div>
                  <div className="text-3xl opacity-80">🔒</div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 text-sm">Vai trò tùy chỉnh</p>
                    <p className="text-2xl font-bold">{analyticsData.customRoles}</p>
                  </div>
                  <div className="text-3xl opacity-80">⚙️</div>
                </div>
              </div>
            </div>

            {/* Priority Distribution */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">🎯 Phân Bố Theo Priority:</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="w-12 h-12 bg-red-500 rounded-full mx-auto mb-2 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">{analyticsData.priorityStats.high}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">Cao (900-1000)</p>
                  <p className="text-xs text-gray-600">Admin level</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-orange-500 rounded-full mx-auto mb-2 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">{analyticsData.priorityStats.medium}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">Trung (500-899)</p>
                  <p className="text-xs text-gray-600">Manager level</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-yellow-500 rounded-full mx-auto mb-2 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">{analyticsData.priorityStats.low}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">Thấp (100-499)</p>
                  <p className="text-xs text-gray-600">User level</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-gray-500 rounded-full mx-auto mb-2 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">{analyticsData.priorityStats.minimal}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">Tối thiểu (1-99)</p>
                  <p className="text-xs text-gray-600">Limited access</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'distribution' && (
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">👥 Phân Bố Người Dùng Theo Vai Trò:</h4>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {analyticsData.roleDistribution.map((roleData) => {
                  const role: Role = {
                    id: roleData.role_id,
                    name: roleData.role_name,
                    display_name: roleData.display_name,
                    priority: roleData.priority,
                    is_system: roleData.is_system,
                    is_active: true,
                    description: '',
                    created_at: '',
                    updated_at: ''
                  };

                  return (
                    <div key={roleData.role_id} className="bg-white border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <RoleBadge role={role} size="sm" />
                          <div>
                            <div className="font-medium text-gray-900">{roleData.display_name}</div>
                            <div className="text-sm text-gray-500">Priority: {roleData.priority}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${getUserCountColor(roleData.user_count)}`}>
                            {roleData.user_count}
                          </div>
                          <div className="text-xs text-gray-500">người dùng</div>
                        </div>
                      </div>
                      
                      {/* Usage Bar */}
                      <div className="mt-3">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${getPriorityColor(roleData.priority)}`}
                            style={{ 
                              width: `${Math.max(5, (roleData.user_count / Math.max(...analyticsData.roleDistribution.map(r => r.user_count))) * 100)}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'trends' && (
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">📈 Hoạt Động Gần Đây ({timeRange}):</h4>
              <div className="space-y-3">
                {analyticsData.recentActivity.map((activity, index) => (
                  <div key={index} className="bg-white border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">
                          {new Date(activity.date).toLocaleDateString('vi-VN')}
                        </div>
                        <div className="text-sm text-gray-500">
                          {activity.date === new Date().toISOString().split('T')[0] ? 'Hôm nay' : 
                           new Date(activity.date).toLocaleDateString('vi-VN', { weekday: 'long' })}
                        </div>
                      </div>
                      <div className="flex space-x-6 text-sm">
                        <div className="text-center">
                          <div className="font-bold text-green-600">{activity.assignments}</div>
                          <div className="text-gray-500">Gán vai trò</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-red-600">{activity.removals}</div>
                          <div className="text-gray-500">Xóa vai trò</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-blue-600">{activity.creates}</div>
                          <div className="text-gray-500">Tạo vai trò</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Summary */}
              <div className="mt-4 pt-4 border-t border-gray-300">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {analyticsData.recentActivity.reduce((sum, day) => sum + day.assignments, 0)}
                    </div>
                    <div className="text-sm text-gray-600">Tổng gán vai trò</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">
                      {analyticsData.recentActivity.reduce((sum, day) => sum + day.removals, 0)}
                    </div>
                    <div className="text-sm text-gray-600">Tổng xóa vai trò</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {analyticsData.recentActivity.reduce((sum, day) => sum + day.creates, 0)}
                    </div>
                    <div className="text-sm text-gray-600">Tổng tạo vai trò</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleAnalyticsDashboard;