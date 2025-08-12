import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Role, RoleFilters } from '../types/role-management';
import roleManagementService from '../services/roleManagementService';
import { Layout } from '../components/layout/Layout';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import Badge from '../components/common/Badge';
import RoleAnalyticsDashboard from '../components/role-management/RoleAnalyticsDashboard';
import CreateRoleModal from '../components/role-management/CreateRoleModal';
import EditRoleModal from '../components/role-management/EditRoleModal';
import DeleteRoleConfirmation from '../components/role-management/DeleteRoleConfirmation';
import RoleBadge from '../components/role-management/RoleBadge';
import RoleHierarchyViewer from '../components/role-management/RoleHierarchyViewer';
import RoleTemplates from '../components/role-management/RoleTemplates';
import RoleHistory from '../components/role-management/RoleHistory';
import PermissionManagementModal from '../components/role-management/PermissionManagementModal';

const RoleManagementPage: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [filteredRoles, setFilteredRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'analytics' | 'hierarchy' | 'templates' | 'history'>('list');
  
  // Filters
  const [filters, setFilters] = useState<RoleFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});

  // Filter roles based on search term
  useEffect(() => {
    if (searchTerm) {
      const filtered = roles.filter(role => 
        role.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        role.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredRoles(filtered);
    } else {
      setFilteredRoles(roles);
    }
  }, [searchTerm, roles]);

  // Load roles on component mount
  useEffect(() => {
    loadRoles();
  }, []);

  // Load roles
  const loadRoles = async (isRefresh: boolean = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await roleManagementService.getRoles(filters);
      
      if (response.success && response.data) {
        setRoles(response.data);
        setFilteredRoles(response.data);
      } else {
        toast.error('Không thể tải danh sách vai trò');
      }
    } catch (error: any) {
      console.error('Error loading roles:', error);
      toast.error('Lỗi khi tải danh sách vai trò');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    loadRoles(true);
  };

  // Handle create role
  const handleCreateRole = () => {
    setIsCreateModalOpen(true);
  };

  const handleCreateSuccess = (newRole: Role) => {
    setRoles(prev => [newRole, ...prev]);
    toast.success('Tạo vai trò thành công!');
  };

  // Handle edit role
  const handleEditRole = (role: Role) => {
    setSelectedRole(role);
    setIsEditModalOpen(true);
  };

  const handleEditSuccess = (updatedRole: Role) => {
    setRoles(prev => prev.map(role => 
      role.id === updatedRole.id ? updatedRole : role
    ));
    toast.success('Cập nhật vai trò thành công!');
  };

  // Handle delete role - updated to use new modal
  const handleDeleteRole = (role: Role) => {
    setSelectedRole(role);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSuccess = () => {
    if (selectedRole) {
      setRoles(prev => prev.filter(role => role.id !== selectedRole.id));
      toast.success('Xóa vai trò thành công!');
    }
  };

  // Handle permission management
  const handleManagePermissions = (role: Role) => {
    setSelectedRole(role);
    setIsPermissionModalOpen(true);
  };

  const handlePermissionSuccess = () => {
    // Optionally refresh roles to get updated permission counts
    loadRoles(true);
  };

  const getRoleTypeColor = (roleType: string) => {
    switch (roleType) {
      case 'system': return 'bg-blue-100 text-blue-800';
      case 'custom': return 'bg-green-100 text-green-800';
      case 'department': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 900) return 'bg-red-100 text-red-800';
    if (priority >= 500) return 'bg-orange-100 text-orange-800';
    if (priority >= 100) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="lg" />
          <span className="ml-3 text-gray-600">Đang tải dữ liệu vai trò...</span>
        </div>
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
              <h1 className="text-2xl font-bold text-gray-900">Role Management</h1>
              <p className="mt-1 text-gray-600">
                Quản lý vai trò và quyền hạn trong hệ thống
              </p>
            </div>
            <div className="flex space-x-3">
              {activeTab === 'list' && (
                <Button
                  onClick={handleRefresh}
                  variant="outline"
                  disabled={refreshing}
                >
                  {refreshing ? <LoadingSpinner size="xs" /> : '🔄 Làm mới'}
                </Button>
              )}
              <Button
                onClick={handleCreateRole}
              >
                ➕ Tạo vai trò mới
              </Button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 overflow-x-auto">
              <button
                onClick={() => setActiveTab('list')}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'list'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📋 Danh sách
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'analytics'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📊 Thống kê
              </button>
              <button
                onClick={() => setActiveTab('hierarchy')}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'hierarchy'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🏗️ Phân cấp
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'templates'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📑 Template
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'history'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📜 Lịch sử
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'list' && (
          <>
            {/* Search and Filters */}
            <div className="bg-white shadow-sm rounded-lg p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0 md:space-x-4">
                {/* Search */}
                <div className="flex-1 max-w-md">
                  <input
                    type="text"
                    placeholder="Tìm kiếm vai trò..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Filter Options */}
                <div className="flex space-x-3">
                  <select
                    value={filters.is_active?.toString() || ''}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      is_active: e.target.value === '' ? undefined : e.target.value === 'true'
                    }))}
                    className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Tất cả trạng thái</option>
                    <option value="true">Hoạt động</option>
                    <option value="false">Vô hiệu hóa</option>
                  </select>

                  <select
                    value={filters.is_system?.toString() || ''}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      is_system: e.target.value === '' ? undefined : e.target.value === 'true'
                    }))}
                    className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Tất cả loại</option>
                    <option value="true">Hệ thống</option>
                    <option value="false">Tùy chỉnh</option>
                  </select>
                </div>
              </div>

              {/* Results Summary */}
              <div className="mt-3 text-sm text-gray-600">
                Hiển thị {filteredRoles.length} / {roles.length} vai trò
                {searchTerm && (
                  <span className="ml-2">
                    cho từ khóa "<span className="font-medium">{searchTerm}</span>"
                  </span>
                )}
              </div>
            </div>

            {/* Roles List */}
            {loading ? (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex justify-center items-center py-12">
                  <LoadingSpinner size="lg" />
                  <span className="ml-3 text-gray-600">Đang tải danh sách vai trò...</span>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm">
                {filteredRoles.length > 0 ? (
                  <div className="divide-y divide-gray-200">
                    {filteredRoles
                      .sort((a, b) => b.priority - a.priority || a.display_name.localeCompare(b.display_name))
                      .map((role) => (
                      <div key={role.id} className="p-6 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          {/* Role Info */}
                          <div className="flex items-center space-x-4">
                            <RoleBadge role={role} size="lg" />
                            <div>
                              <div className="flex items-center space-x-2">
                                <h3 className="text-lg font-medium text-gray-900">
                                  {role.display_name}
                                </h3>
                                <span className="text-sm text-gray-500">({role.name})</span>
                                {role.is_system && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    🔒 Hệ thống
                                  </span>
                                )}
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  role.is_active 
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {role.is_active ? '✅ Hoạt động' : '❌ Vô hiệu hóa'}
                                </span>
                              </div>
                              <div className="mt-1 text-sm text-gray-600">
                                {role.description || 'Không có mô tả'}
                              </div>
                              <div className="mt-1 text-xs text-gray-500">
                                Priority: {role.priority} • 
                                Tạo: {formatDate(role.created_at)} • 
                                Cập nhật: {formatDate(role.updated_at)}
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center space-x-2">
                            <Button
                              onClick={() => handleEditRole(role)}
                              variant="outline"
                              size="sm"
                            >
                              ✏️ Sửa
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleManagePermissions(role)}
                            >
                              🔑 Quyền
                            </Button>

                            {!role.is_system && (
                              <Button
                                onClick={() => handleDeleteRole(role)}
                                variant="danger"
                                size="sm"
                              >
                                🗑️ Xóa
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <div className="text-gray-400 text-6xl mb-4">📋</div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {searchTerm ? 'Không tìm thấy vai trò nào' : 'Chưa có vai trò nào'}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {searchTerm 
                        ? `Không có vai trò nào khớp với "${searchTerm}"`
                        : 'Bắt đầu bằng cách tạo vai trò đầu tiên'
                      }
                    </p>
                    {!searchTerm && (
                      <Button onClick={handleCreateRole}>
                        ➕ Tạo vai trò đầu tiên
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'analytics' && (
          <RoleAnalyticsDashboard />
        )}

        {activeTab === 'hierarchy' && (
          <RoleHierarchyViewer />
        )}

        {activeTab === 'templates' && (
          <RoleTemplates 
            onApplyTemplate={(template) => {
              // Refresh roles after applying template
              loadRoles(true);
              toast.success(`Template "${template.display_name}" đã được áp dụng!`);
            }}
          />
        )}

        {activeTab === 'history' && (
          <RoleHistory />
        )}

        {/* Create Role Modal */}
        <CreateRoleModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleCreateSuccess}
        />

        {/* Edit Role Modal */}
        {selectedRole && (
          <EditRoleModal
            role={selectedRole}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setSelectedRole(null);
            }}
            onSuccess={handleEditSuccess}
          />
        )}

        {/* Delete Role Confirmation */}
        {selectedRole && (
          <DeleteRoleConfirmation
            role={selectedRole}
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false);
              setSelectedRole(null);
            }}
            onSuccess={handleDeleteSuccess}
          />
        )}

        {/* Permission Management Modal */}
        <PermissionManagementModal
          role={selectedRole}
          isOpen={isPermissionModalOpen}
          onClose={() => {
            setIsPermissionModalOpen(false);
            setSelectedRole(null);
          }}
          onSuccess={handlePermissionSuccess}
        />
      </div>
    </Layout>
  );
};

export default RoleManagementPage;