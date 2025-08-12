import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { UserManagement, UserManagementFilters } from '../types/user-management';
import userManagementService from '../services/userManagementService';
import UserManagementTable from '../components/user-management/UserManagementTable';
import VirtualUserTable from '../components/user-management/VirtualUserTable';
import InfiniteScrollUserTable from '../components/user-management/InfiniteScrollUserTable';
import UserManagementFiltersComponent from '../components/user-management/UserManagementFilters';
import AdvancedUserFilters from '../components/user-management/AdvancedUserFilters';
import UserDetailModal from '../components/user-management/UserDetailModal';
import ExportImportModal from '../components/user-management/ExportImportModal';
import AuditLogViewer from '../components/user-management/AuditLogViewer';
import AnalyticsDashboard from '../components/user-management/AnalyticsDashboard';
import RoleAssignmentModal from '../components/role-management/RoleAssignmentModal';
import BulkRoleAssignmentModal from '../components/role-management/BulkRoleAssignmentModal';
import { MobileUserManagement } from '../components/mobile/MobileUserManagement';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/common/Button';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { useIsMobile } from '../hooks/useMediaQuery';

const UserManagementPage: React.FC = () => {
  const [filters, setFilters] = useState<UserManagementFilters>({});
  const [selectedUser, setSelectedUser] = useState<UserManagement | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExportImportModalOpen, setIsExportImportModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roleManagementUser, setRoleManagementUser] = useState<UserManagement | null>(null);
  const [isBulkRoleModalOpen, setIsBulkRoleModalOpen] = useState(false);
  const [bulkRoleUserIds, setBulkRoleUserIds] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tableMode, setTableMode] = useState<'normal' | 'virtual' | 'infinite'>('normal');
  const [useAdvancedFilters, setUseAdvancedFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'analytics' | 'audit'>('users');
  
  const isMobile = useIsMobile();

  // Performance monitoring
  const { metrics, logMetrics, isSlowRender } = usePerformanceMonitor('UserManagementPage', {
    trackMemory: true,
    logToConsole: process.env.NODE_ENV === 'development',
    threshold: 100 // 100ms threshold for page renders
  });

  const handleFiltersChange = (newFilters: UserManagementFilters) => {
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
    setFilters({});
  };

  const handleUserSelect = (user: UserManagement) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedUser(null);
    setIsModalOpen(false);
  };

  const handleManageRoles = (user: UserManagement) => {
    setRoleManagementUser(user);
    setIsRoleModalOpen(true);
  };

  const handleCloseRoleModal = () => {
    setRoleManagementUser(null);
    setIsRoleModalOpen(false);
  };

  const handleRoleAssignmentSuccess = () => {
    // Refresh the table to show updated roles
    handleDataRefresh();
  };

  const handleBulkRoleAssignment = (userIds: string[]) => {
    setBulkRoleUserIds(userIds);
    setIsBulkRoleModalOpen(true);
  };

  const handleCloseBulkRoleModal = () => {
    setBulkRoleUserIds([]);
    setIsBulkRoleModalOpen(false);
  };

  const handleBulkRoleAssignmentSuccess = () => {
    // Refresh the table to show updated roles
    handleDataRefresh();
  };

  const handleUserUpdated = (updatedUser: UserManagement) => {
    // The table will refresh automatically when user is updated
    toast.success('User updated successfully');
  };

  const handleDataRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Render mobile version if on mobile device
  if (isMobile) {
    return (
      <Layout>
        <MobileUserManagement onUserSelect={handleUserSelect} />
        
        {/* User Detail Modal - still use the same modal for mobile */}
        <UserDetailModal
          user={selectedUser}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onUserUpdated={handleUserUpdated}
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white shadow-sm rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
              <p className="mt-1 text-gray-600">
                Quản lý người dùng, phê duyệt tài khoản và phân quyền trong hệ thống
              </p>
              {process.env.NODE_ENV === 'development' && isSlowRender() && (
                <div className="mt-2 text-xs text-orange-600">
                  ⚠️ Render time: {metrics.renderTime.toFixed(2)}ms 
                  {metrics.memoryUsage && ` | Memory: ${metrics.memoryUsage.toFixed(2)}MB`}
                  <button 
                    onClick={logMetrics} 
                    className="ml-2 text-blue-600 underline"
                  >
                    Log Details
                  </button>
                </div>
              )}
            </div>
            <div className="flex space-x-3">
              {activeTab === 'users' && (
                <>
                  <Button
                    onClick={() => setUseAdvancedFilters(!useAdvancedFilters)}
                    variant="outline"
                    size="sm"
                  >
                    {useAdvancedFilters ? '📊 Bộ lọc cơ bản' : '🔍 Bộ lọc nâng cao'}
                  </Button>
                  <Button
                    onClick={() => {
                      const modes: Array<'normal' | 'virtual' | 'infinite'> = ['normal', 'virtual', 'infinite'];
                      const currentIndex = modes.indexOf(tableMode);
                      const nextIndex = (currentIndex + 1) % modes.length;
                      setTableMode(modes[nextIndex]);
                    }}
                    variant="outline"
                    size="sm"
                  >
                    {tableMode === 'normal' ? '📋 Bảng thường' : 
                     tableMode === 'virtual' ? '⚡ Bảng ảo hóa' : 
                     '♾️ Infinite Scroll'}
                  </Button>
                  <Button
                    onClick={() => setIsExportImportModalOpen(true)}
                    variant="outline"
                  >
                    📤 Xuất / Nhập
                  </Button>
                </>
              )}
              <Button
                onClick={() => {
                  toast.success('Chức năng thêm user mới sẽ được thêm sau');
                }}
              >
                ➕ Thêm người dùng
              </Button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('users')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'users'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                👥 Danh sách người dùng
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'analytics'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📊 Analytics
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'audit'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📋 Audit Logs
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'users' && (
          <>
            {/* Filters */}
            {useAdvancedFilters ? (
              <AdvancedUserFilters
                filters={filters}
                onFiltersChange={handleFiltersChange}
                onReset={handleResetFilters}
              />
            ) : (
              <UserManagementFiltersComponent
                filters={filters}
                onFiltersChange={handleFiltersChange}
                onReset={handleResetFilters}
              />
            )}

            {/* Users Table */}
            {tableMode === 'virtual' ? (
              <VirtualUserTable
                key={refreshKey}
                filters={filters}
                onUserSelect={handleUserSelect}
                height={600}
                className="mb-6"
              />
            ) : tableMode === 'infinite' ? (
              <InfiniteScrollUserTable
                key={refreshKey}
                searchTerm={filters.search}
                filters={{
                  status: filters.status,
                  role: filters.role,
                  department: filters.department
                }}
                onUserUpdate={handleUserUpdated}
                virtualMode={false}
              />
            ) : (
              <UserManagementTable
                key={refreshKey}
                filters={filters}
                onUserSelect={handleUserSelect}
                onManageRoles={handleManageRoles}
                onBulkRoleAssignment={handleBulkRoleAssignment}
              />
            )}
          </>
        )}

        {activeTab === 'analytics' && (
          <AnalyticsDashboard className="mb-6" />
        )}

        {activeTab === 'audit' && (
          <AuditLogViewer className="mb-6" />
        )}

        {/* User Detail Modal */}
        <UserDetailModal
          user={selectedUser}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onUserUpdated={handleUserUpdated}
        />

        {/* Role Assignment Modal */}
        {roleManagementUser && (
          <RoleAssignmentModal
            user={roleManagementUser}
            isOpen={isRoleModalOpen}
            onClose={handleCloseRoleModal}
            onSuccess={handleRoleAssignmentSuccess}
          />
        )}

        {/* Bulk Role Assignment Modal */}
        {bulkRoleUserIds.length > 0 && (
          <BulkRoleAssignmentModal
            userIds={bulkRoleUserIds}
            isOpen={isBulkRoleModalOpen}
            onClose={handleCloseBulkRoleModal}
            onSuccess={handleBulkRoleAssignmentSuccess}
          />
        )}

        {/* Export/Import Modal */}
        <ExportImportModal
          isOpen={isExportImportModalOpen}
          onClose={() => setIsExportImportModalOpen(false)}
          currentFilters={filters}
          onDataUpdated={handleDataRefresh}
        />
      </div>
    </Layout>
  );
};

export default UserManagementPage;