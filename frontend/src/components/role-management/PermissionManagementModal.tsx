import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Role } from '../../types/role-management';
import { permissionService } from '../../services/permissionService';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Button } from '../common/Button';

interface Permission {
  id: string;
  resource: string;
  action: string;
  scope: string;
  display_name: string;
  description?: string;
  category?: string;
}

interface PermissionManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: Role | null;
  onSuccess?: () => void;
}

const PermissionManagementModal: React.FC<PermissionManagementModalProps> = ({
  isOpen,
  onClose,
  role,
  onSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'resource' | 'action' | 'matrix'>('resource');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen && role) {
      loadPermissions();
    }
  }, [isOpen, role]);

  const loadPermissions = async () => {
    if (!role) return;
    
    setLoading(true);
    try {
      // Load all permissions
      const allPermsResponse = await permissionService.getAllPermissions();
      if (allPermsResponse.success && allPermsResponse.data) {
        setPermissions(allPermsResponse.data);
      }

      // Load role permissions
      const rolePermsResponse = await permissionService.getRolePermissions(role.id);
      if (rolePermsResponse.success && rolePermsResponse.data) {
        const permIds = rolePermsResponse.data.map((p: Permission) => p.id);
        setRolePermissions(permIds);
        setSelectedPermissions(new Set(permIds));
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
      toast.error('Lỗi khi tải danh sách quyền');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!role) return;
    
    setSaving(true);
    try {
      // Find added and removed permissions
      const added = Array.from(selectedPermissions).filter(id => !rolePermissions.includes(id));
      const removed = rolePermissions.filter(id => !selectedPermissions.has(id));

      // Update permissions
      if (added.length > 0 || removed.length > 0) {
        await permissionService.updateRolePermissions(role.id, {
          add: added,
          remove: removed
        });
        
        toast.success('Cập nhật quyền thành công!');
        onSuccess?.();
        onClose();
      } else {
        toast.info('Không có thay đổi nào');
      }
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast.error('Lỗi khi cập nhật quyền');
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(permissionId)) {
        newSet.delete(permissionId);
      } else {
        newSet.add(permissionId);
      }
      return newSet;
    });
  };

  const toggleAll = (permissionIds: string[]) => {
    const allSelected = permissionIds.every(id => selectedPermissions.has(id));
    if (allSelected) {
      setSelectedPermissions(prev => {
        const newSet = new Set(prev);
        permissionIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    } else {
      setSelectedPermissions(prev => {
        const newSet = new Set(prev);
        permissionIds.forEach(id => newSet.add(id));
        return newSet;
      });
    }
  };

  // Group permissions by resource
  const groupedByResource = permissions.reduce((acc, perm) => {
    if (!acc[perm.resource]) {
      acc[perm.resource] = [];
    }
    acc[perm.resource].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  // Group permissions by action
  const groupedByAction = permissions.reduce((acc, perm) => {
    if (!acc[perm.action]) {
      acc[perm.action] = [];
    }
    acc[perm.action].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  // Get unique resources and actions for matrix
  const resources = [...new Set(permissions.map(p => p.resource))].sort();
  const actions = [...new Set(permissions.map(p => p.action))].sort();

  // Filter permissions based on search
  const filteredPermissions = permissions.filter(perm =>
    perm.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    perm.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
    perm.action.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen || !role) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Quản lý quyền cho vai trò: {role.display_name}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Chọn các quyền mà vai trò này sẽ có trong hệ thống
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Tìm kiếm quyền..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-4">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('resource')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'resource'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  📁 Theo tài nguyên
                </button>
                <button
                  onClick={() => setActiveTab('action')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'action'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  ⚡ Theo hành động
                </button>
                <button
                  onClick={() => setActiveTab('matrix')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'matrix'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  📊 Ma trận quyền
                </button>
              </nav>
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <LoadingSpinner size="lg" />
                <span className="ml-3 text-gray-600">Đang tải danh sách quyền...</span>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {/* Resource Tab */}
                {activeTab === 'resource' && (
                  <div className="space-y-4">
                    {Object.entries(groupedByResource).map(([resource, perms]) => (
                      <div key={resource} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900 capitalize">
                            {resource}
                          </h4>
                          <button
                            onClick={() => toggleAll(perms.map(p => p.id))}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            {perms.every(p => selectedPermissions.has(p.id)) 
                              ? 'Bỏ chọn tất cả' 
                              : 'Chọn tất cả'}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {perms.map(perm => (
                            <label 
                              key={perm.id}
                              className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                            >
                              <input
                                type="checkbox"
                                checked={selectedPermissions.has(perm.id)}
                                onChange={() => togglePermission(perm.id)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <div className="flex-1">
                                <span className="text-sm font-medium text-gray-900">
                                  {perm.display_name}
                                </span>
                                <span className="ml-2 text-xs text-gray-500">
                                  ({perm.action}.{perm.scope})
                                </span>
                                {perm.description && (
                                  <p className="text-xs text-gray-500">{perm.description}</p>
                                )}
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action Tab */}
                {activeTab === 'action' && (
                  <div className="space-y-4">
                    {Object.entries(groupedByAction).map(([action, perms]) => (
                      <div key={action} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900 capitalize">
                            {action}
                          </h4>
                          <button
                            onClick={() => toggleAll(perms.map(p => p.id))}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            {perms.every(p => selectedPermissions.has(p.id)) 
                              ? 'Bỏ chọn tất cả' 
                              : 'Chọn tất cả'}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {perms.map(perm => (
                            <label 
                              key={perm.id}
                              className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                            >
                              <input
                                type="checkbox"
                                checked={selectedPermissions.has(perm.id)}
                                onChange={() => togglePermission(perm.id)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <div className="flex-1">
                                <span className="text-sm font-medium text-gray-900">
                                  {perm.display_name}
                                </span>
                                <span className="ml-2 text-xs text-gray-500">
                                  ({perm.resource}.{perm.scope})
                                </span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Matrix Tab */}
                {activeTab === 'matrix' && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Resource
                          </th>
                          {actions.map(action => (
                            <th key={action} className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {action}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {resources.map(resource => (
                          <tr key={resource}>
                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                              {resource}
                            </td>
                            {actions.map(action => {
                              const perm = permissions.find(
                                p => p.resource === resource && p.action === action
                              );
                              return (
                                <td key={action} className="px-4 py-2 text-center">
                                  {perm ? (
                                    <input
                                      type="checkbox"
                                      checked={selectedPermissions.has(perm.id)}
                                      onChange={() => togglePermission(perm.id)}
                                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                  ) : (
                                    <span className="text-gray-300">-</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Summary */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                Đã chọn {selectedPermissions.size} quyền • 
                Thay đổi: {
                  Array.from(selectedPermissions).filter(id => !rolePermissions.includes(id)).length
                } thêm mới, {
                  rolePermissions.filter(id => !selectedPermissions.has(id)).length
                } xóa bỏ
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto sm:ml-3"
            >
              {saving ? <LoadingSpinner size="xs" /> : '💾 Lưu thay đổi'}
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="mt-3 w-full sm:mt-0 sm:w-auto"
            >
              Hủy
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionManagementModal;