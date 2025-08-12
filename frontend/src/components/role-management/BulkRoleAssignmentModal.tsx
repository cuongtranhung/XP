import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Role, AssignRoleRequest } from '../../types/role-management';
import roleManagementService from '../../services/roleManagementService';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
import RoleBadge from './RoleBadge';

interface BulkRoleAssignmentModalProps {
  userIds: string[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type ActionType = 'assign' | 'remove' | 'replace';

const BulkRoleAssignmentModal: React.FC<BulkRoleAssignmentModalProps> = ({
  userIds,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [actionType, setActionType] = useState<ActionType>('assign');
  const [expirationDate, setExpirationDate] = useState<string>('');
  const [sendNotification, setSendNotification] = useState(true);
  const [auditNote, setAuditNote] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewResults, setPreviewResults] = useState<any[]>([]);

  // Load available roles
  useEffect(() => {
    if (isOpen) {
      loadAvailableRoles();
      setSelectedRoles([]);
      setActionType('assign');
      setExpirationDate('');
      setSendNotification(true);
      setAuditNote('');
      setPreviewResults([]);
    }
  }, [isOpen]);

  const loadAvailableRoles = async () => {
    try {
      setLoading(true);
      const response = await roleManagementService.getRoles({ is_active: true });
      
      if (response.success && response.data) {
        setAvailableRoles(response.data);
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

  // Generate preview of changes
  const generatePreview = () => {
    const selectedRoleNames = availableRoles
      .filter(role => selectedRoles.includes(role.id))
      .map(role => role.display_name);

    const preview = userIds.map((userId, index) => ({
      userId,
      userName: `user${index + 1}@xp.vn`, // This would come from actual user data
      action: actionType,
      roles: selectedRoleNames,
      expires: expirationDate
    }));

    setPreviewResults(preview);
  };

  useEffect(() => {
    if (selectedRoles.length > 0) {
      generatePreview();
    }
  }, [selectedRoles, actionType, expirationDate]);

  // Execute bulk role assignment
  const handleExecute = async () => {
    if (selectedRoles.length === 0) {
      toast.warning('Vui lòng chọn ít nhất một vai trò');
      return;
    }

    try {
      setSaving(true);
      
      let successCount = 0;
      let errorCount = 0;

      for (const userId of userIds) {
        try {
          if (actionType === 'assign') {
            // Assign roles
            for (const roleId of selectedRoles) {
              const assignment: AssignRoleRequest = {
                user_id: userId,
                role_id: roleId,
                expires_at: expirationDate ? new Date(expirationDate) : undefined
              };
              
              await roleManagementService.assignRoleToUser(assignment);
            }
          } else if (actionType === 'remove') {
            // Remove roles
            for (const roleId of selectedRoles) {
              await roleManagementService.removeRoleFromUser(userId, roleId);
            }
          }
          // Note: 'replace' would require getting current roles first, then removing and adding
          
          successCount++;
        } catch (error) {
          console.error(`Error processing user ${userId}:`, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Đã xử lý thành công ${successCount} người dùng${errorCount > 0 ? ` (${errorCount} lỗi)` : ''}`);
        onSuccess?.();
        onClose();
      } else {
        toast.error('Không thể xử lý bất kỳ người dùng nào');
      }
      
    } catch (error: any) {
      console.error('Error in bulk role assignment:', error);
      toast.error('Lỗi khi thực hiện gán vai trò hàng loạt');
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
              👥 Gán Vai Trò Hàng Loạt
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          {/* Selected Users Summary */}
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-900 mb-3">
              📋 Đã Chọn {userIds.length} Users:
            </h4>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">
                {userIds.length} người dùng sẽ được xử lý
                {/* In real implementation, would show user emails/names */}
              </div>
            </div>
          </div>

          {/* Action Type Selection */}
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-900 mb-3">
              🎯 Chọn Hành Động:
            </h4>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="assign"
                    checked={actionType === 'assign'}
                    onChange={(e) => setActionType(e.target.value as ActionType)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-3 font-medium">● Thêm vai trò</span>
                  <span className="ml-2 text-sm text-gray-500">(Không thay đổi vai trò hiện có)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="remove"
                    checked={actionType === 'remove'}
                    onChange={(e) => setActionType(e.target.value as ActionType)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-3 font-medium">○ Xóa vai trò</span>
                  <span className="ml-2 text-sm text-gray-500">(Chỉ xóa các vai trò được chọn)</span>
                </label>
                <label className="flex items-center opacity-50">
                  <input
                    type="radio"
                    value="replace"
                    checked={actionType === 'replace'}
                    onChange={(e) => setActionType(e.target.value as ActionType)}
                    disabled
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-3 font-medium">○ Thay thế tất cả vai trò</span>
                  <span className="ml-2 text-sm text-gray-400">(Sắp ra mắt)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Role Selection */}
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-900 mb-3">
              📝 Chọn Vai Trò:
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
                              <span className="ml-2 text-sm text-gray-500">Priority: {role.priority}</span>
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

          {/* Advanced Options */}
          {selectedRoles.length > 0 && (
            <div className="space-y-4">
              {/* Expiration Date (only for assign) */}
              {actionType === 'assign' && (
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
                </div>
              )}

              {/* Options */}
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={sendNotification}
                    onChange={(e) => setSendNotification(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-3 text-sm">☑ Gửi email thông báo cho users</span>
                </label>
              </div>

              {/* Audit Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📝 Ghi chú audit (Tùy chọn):
                </label>
                <textarea
                  value={auditNote}
                  onChange={(e) => setAuditNote(e.target.value)}
                  rows={2}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Gán vai trò cho dự án Q1/2025..."
                />
              </div>
            </div>
          )}

          {/* Preview Results */}
          {previewResults.length > 0 && (
            <div className="mt-6">
              <h4 className="text-md font-medium text-gray-900 mb-3">
                📊 Xem Trước Kết Quả:
              </h4>
              <div className="bg-gray-50 p-4 rounded-lg max-h-40 overflow-y-auto">
                <div className="space-y-1 text-sm">
                  {previewResults.slice(0, 5).map((result, index) => (
                    <div key={index} className="flex justify-between">
                      <span>{result.userName}:</span>
                      <span className="text-blue-600">
                        {actionType === 'assign' ? '→' : '×'} {result.roles.join(', ')}
                      </span>
                    </div>
                  ))}
                  {previewResults.length > 5 && (
                    <div className="text-gray-500 text-center">
                      ... và {previewResults.length - 5} users khác
                    </div>
                  )}
                </div>
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
                  ⚠️ Sẽ {actionType === 'assign' ? 'gán' : 'xóa'} {selectedRoles.length} vai trò cho {userIds.length} users
                  {expirationDate && actionType === 'assign' && (
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
                onClick={handleExecute}
                disabled={saving || selectedRoles.length === 0}
              >
                {saving ? <LoadingSpinner size="xs" /> : '💾 Áp Dụng Cho Tất Cả'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkRoleAssignmentModal;