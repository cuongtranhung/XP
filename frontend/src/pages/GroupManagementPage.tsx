import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Group, GroupFilters } from '../types/group-management';
import GroupManagementTable from '../components/group-management/GroupManagementTable';
import GroupManagementFiltersComponent from '../components/group-management/GroupManagementFilters';
import GroupDetailModal from '../components/group-management/GroupDetailModal';
import CreateGroupModal from '../components/group-management/CreateGroupModal';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/common/Button';
import groupManagementService from '../services/groupManagementService';
import exportService from '../services/exportService';

const GroupManagementPage: React.FC = () => {
  const [filters, setFilters] = useState<GroupFilters>({});
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [statistics, setStatistics] = useState({
    totalGroups: 0,
    totalMembers: 0,
    groupsByType: {
      system: { total: 0, active: 0 },
      department: { total: 0, active: 0 },
      project: { total: 0, active: 0 },
      custom: { total: 0, active: 0 }
    },
    groupsByStatus: { active: 0, inactive: 0 }
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);

  const handleFiltersChange = (newFilters: GroupFilters) => {
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
    setFilters({});
  };

  const handleGroupSelect = (group: Group) => {
    setSelectedGroup(group);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedGroup(null);
    setIsModalOpen(false);
  };

  const handleGroupUpdated = (updatedGroup: Group) => {
    // The table will refresh automatically when group is updated
    toast.success('Group updated successfully');
    // Refresh statistics when a group is updated
    loadStatistics();
  };

  const handleGroupCreated = () => {
    // Refresh statistics and groups table when a new group is created
    loadStatistics();
    setIsCreateModalOpen(false);
  };

  const handleExportData = async () => {
    try {
      setExportLoading(true);
      
      // Get all groups for export
      const response = await groupManagementService.getGroups(filters);
      
      if (response.success) {
        await exportService.exportComprehensiveReport();
        toast.success('Đã xuất dữ liệu thành công!');
      } else {
        toast.error('Không thể tải dữ liệu để xuất');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Lỗi khi xuất dữ liệu');
    } finally {
      setExportLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      setLoadingStats(true);
      const response = await groupManagementService.getGroupStatistics();
      
      if (response.success) {
        setStatistics(response.data);
      } else {
        console.error('Failed to load statistics:', response.error);
        // Keep the default values if API fails
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
      // Keep the default values if API fails
    } finally {
      setLoadingStats(false);
    }
  };

  // Load statistics on component mount
  useEffect(() => {
    loadStatistics();
  }, []);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white shadow-sm rounded-lg p-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Group Management</h1>
              <p className="mt-1 text-gray-600">
                Quản lý nhóm người dùng và phân quyền nhóm trong hệ thống
              </p>
            </div>
            <div className="flex space-x-3">
              <Button
                onClick={handleExportData}
                disabled={exportLoading}
                variant="outline"
              >
                {exportLoading ? '⏳ Đang xuất...' : '📤 Xuất dữ liệu'}
              </Button>
              <Button
                onClick={() => setIsCreateModalOpen(true)}
              >
                ➕ Tạo nhóm mới
              </Button>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">👥</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Tổng nhóm</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {loadingStats ? '...' : statistics.totalGroups.toLocaleString()}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">🏢</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Nhóm phòng ban</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {loadingStats ? '...' : statistics.groupsByType.department.total.toLocaleString()}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">📋</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Nhóm dự án</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {loadingStats ? '...' : statistics.groupsByType.project.total.toLocaleString()}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">⚙️</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Nhóm tùy chỉnh</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {loadingStats ? '...' : statistics.groupsByType.custom.total.toLocaleString()}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <GroupManagementFiltersComponent
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onReset={handleResetFilters}
        />

        {/* Groups Table */}
        <GroupManagementTable
          filters={filters}
          onGroupSelect={handleGroupSelect}
        />

        {/* Group Detail Modal */}
        <GroupDetailModal
          group={selectedGroup}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onGroupUpdated={handleGroupUpdated}
        />

        {/* Create Group Modal */}
        <CreateGroupModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onGroupCreated={handleGroupCreated}
        />
      </div>
    </Layout>
  );
};

export default GroupManagementPage;