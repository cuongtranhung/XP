import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { UserManagement } from '../../types/user-management';
import { Role, AssignRoleRequest } from '../../types/role-management';
import roleManagementService from '../../services/roleManagementService';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
import RoleBadge from './RoleBadge';

interface RoleAssignmentModalProps {
  user: UserManagement;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const RoleAssignmentModal: React.FC<RoleAssignmentModalProps> = ({
  user,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [expirationDate, setExpirationDate] = useState<string>('');
  const [assignmentReason, setAssignmentReason] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load available roles
  useEffect(() => {
    if (isOpen) {
      loadAvailableRoles();
      setSelectedRoles([]);
      setExpirationDate('');
      setAssignmentReason('');
    }
  }, [isOpen]);

  const loadAvailableRoles = async () => {
    try {
      setLoading(true);
      const response = await roleManagementService.getRoles({ is_active: true });
      
      if (response.success && response.data) {
        // Filter out roles user already has
        const currentRoleIds = user.roles?.map(r => r.role_id) || [];
        const available = response.data.filter(role => !currentRoleIds.includes(role.id));
        setAvailableRoles(available);
      } else {
        toast.error('Không thể tải danh sách vai trò');
      }
    } catch (error) {
      console.error('Error loading roles:', error);
      toast.error('Lỗi khi tải danh sách vai trò');
    } finally {
      setLoading(false);
    }
  };

  // Handle role selection
  const handleRoleToggle = (roleId: string) => {
    setSelectedRoles(prev => {
      if (prev.includes(roleId)) {
        return prev.filter(id => id !== roleId);
      } else {
        return [...prev, roleId];
      }
    });
  };

  // Remove current role
  const handleRemoveRole = async (roleId: string) => {
    try {
      setSaving(true);
      const response = await roleManagementService.removeRoleFromUser(user.id, roleId);
      
      if (response.success) {
        toast.success('Đã xóa vai trò thành công');
        onSuccess?.();
      } else {
        toast.error('Không thể xóa vai trò');
      }
    } catch (error) {
      console.error('Error removing role:', error);
      toast.error('Lỗi khi xóa vai trò');
    } finally {
      setSaving(false);
    }
  };

  // Save role assignments
  const handleSave = async () => {
    if (selectedRoles.length === 0) {
      toast.warning('Vui lòng chọn ít nhất một vai trò');
      return;
    }

    try {
      setSaving(true);
      
      const assignments: AssignRoleRequest[] = selectedRoles.map(roleId => ({
        user_id: user.id,
        role_id: roleId,
        expires_at: expirationDate ? new Date(expirationDate) : undefined
      }));

      // Assign roles one by one
      for (const assignment of assignments) {
        const response = await roleManagementService.assignRoleToUser(assignment);
        if (!response.success) {
          throw new Error(`Failed to assign role: ${response.error}`);
        }
      }

      toast.success(`Đã gán ${selectedRoles.length} vai trò thành công`);
      onSuccess?.();
      onClose();
      
    } catch (error: any) {
      console.error('Error assigning roles:', error);
      toast.error(error.message || 'Lỗi khi gán vai trò');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">
              🎭 Phân Quyền Cho User
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <div className="mt-2">
            <p className="text-sm text-gray-600">
              👤 <span className="font-medium">{user.full_name || user.email}</span> ({user.email})
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          {/* Current Roles */}
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-900 mb-3">
              📋 Vai Trò Hiện Tại:
            </h4>
            <div className="bg-gray-50 p-4 rounded-lg">
              {user.roles && user.roles.length > 0 ? (
                <div className="space-y-2">
                  {user.roles.map((userRole) => {
                    const role = {
                      id: userRole.role_id,
                      name: userRole.name,
                      display_name: userRole.display_name,
                      description: userRole.description,
                      priority: userRole.priority,
                      is_system: userRole.is_system,
                      is_active: userRole.is_active,
                      created_at: '',
                      updated_at: ''
                    };
                    
                    return (
                      <div key={userRole.role_id} className="flex items-center justify-between bg-white p-3 rounded border">
                        <div className="flex items-center space-x-3">
                          <RoleBadge
                            role={role}
                            userRole={userRole}
                            size="sm"
                            showExpiration={true}
                          />
                          <div className="text-sm">
                            <div className="font-medium">Priority: {userRole.priority}</div>
                            {userRole.expires_at ? (
                              <div className="text-gray-500">
                                Hết hạn: {new Date(userRole.expires_at).toLocaleDateString('vi-VN')}
                              </div>
                            ) : (
                              <div className="text-gray-500">Không thời hạn</div>
                            )}
                          </div>
                        </div>
                        {!userRole.is_system && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleRemoveRole(userRole.role_id)}
                            disabled={saving}
                          >
                            {saving ? <LoadingSpinner size="xs" /> : '🗑️'}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 italic">Chưa có vai trò nào được gán</p>
              )}
            </div>
          </div>

          {/* Available Roles */}
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-900 mb-3">
              ➕ Thêm Vai Trò Mới:
            </h4>
            
            {loading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {availableRoles.length > 0 ? (
                    availableRoles.map((role) => (
                      <div key={role.id} className="flex items-center bg-white p-3 rounded border">
                        <input
                          type="checkbox"
                          id={`role-${role.id}`}
                          checked={selectedRoles.includes(role.id)}
                          onChange={() => handleRoleToggle(role.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor={`role-${role.id}`} className="ml-3 flex-1 cursor-pointer">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium text-gray-900">{role.display_name}</span>
                              <span className="ml-2 text-sm text-gray-500">({role.priority})</span>
                            </div>
                            {role.is_system && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                🔒 Hệ thống
                              </span>
                            )}
                          </div>
                          {role.description && (
                            <div className="text-sm text-gray-500 mt-1">
                              {role.description}
                            </div>
                          )}
                        </label>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 italic">Không có vai trò nào khả dụng</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Expiration & Reason */}
          {selectedRoles.length > 0 && (
            <div className="space-y-4">
              {/* Expiration Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ⏰ Thời Hạn (Tùy chọn):
                </label>
                <input
                  type="datetime-local"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Để trống nếu vai trò không có thời hạn
                </p>
              </div>

              {/* Assignment Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📝 Lý Do Phân Quyền:
                </label>
                <textarea
                  value={assignmentReason}
                  onChange={(e) => setAssignmentReason(e.target.value)}
                  rows={3}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ví dụ: Phân công dự án mới Q1/2025..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {selectedRoles.length > 0 && (
                <>
                  ⚠️ Sẽ gán {selectedRoles.length} vai trô mới cho user này
                  {expirationDate && (
                    <div className="mt-1">
                      ⏰ Thời hạn: {new Date(expirationDate).toLocaleDateString('vi-VN')}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={saving}
              >
                Hủy
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || selectedRoles.length === 0}
              >
                {saving ? <LoadingSpinner size="xs" /> : '💾 Lưu Thay Đổi'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoleAssignmentModal;