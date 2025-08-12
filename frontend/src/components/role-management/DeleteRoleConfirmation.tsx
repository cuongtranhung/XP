import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Role } from '../../types/role-management';
import roleManagementService from '../../services/roleManagementService';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface DeleteRoleConfirmationProps {
  role: Role | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ImpactAnalysis {
  userCount: number;
  canDelete: boolean;
  reasons: string[];
}

const DeleteRoleConfirmation: React.FC<DeleteRoleConfirmationProps> = ({
  role,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [impactAnalysis, setImpactAnalysis] = useState<ImpactAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  // Load impact analysis when modal opens
  useEffect(() => {
    if (isOpen && role) {
      loadImpactAnalysis();
      setConfirmText('');
    }
  }, [isOpen, role]);

  // Load impact analysis
  const loadImpactAnalysis = async () => {
    if (!role) return;

    try {
      setLoading(true);
      
      // Check if role can be deleted
      const reasons: string[] = [];
      let userCount = 0;
      let canDelete = true;

      // System roles cannot be deleted
      if (role.is_system) {
        canDelete = false;
        reasons.push('Đây là vai trò hệ thống, không thể xóa');
      }

      // Check how many users have this role
      try {
        const usersResponse = await roleManagementService.getUsersByRole(role.id, 1, 1);
        if (usersResponse.success && usersResponse.data) {
          userCount = usersResponse.data.total;
          if (userCount > 0) {
            reasons.push(`${userCount} người dùng hiện có vai trò này`);
            // Note: We can still delete roles with users, but warn about it
          }
        }
      } catch (error) {
        console.error('Error checking users with role:', error);
      }

      setImpactAnalysis({
        userCount,
        canDelete,
        reasons
      });
    } catch (error: any) {
      console.error('Error loading impact analysis:', error);
      toast.error('Không thể phân tích tác động của việc xóa');
    } finally {
      setLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!role || !impactAnalysis?.canDelete) {
      return;
    }

    // Require confirmation text for roles with users
    if (impactAnalysis.userCount > 0) {
      if (confirmText.toLowerCase() !== role.name.toLowerCase()) {
        toast.error('Vui lòng nhập đúng tên vai trò để xác nhận');
        return;
      }
    }

    try {
      setDeleting(true);
      
      const response = await roleManagementService.deleteRole(role.id);
      
      if (response.success) {
        toast.success('Đã xóa vai trò thành công');
        onSuccess?.();
        onClose();
      } else {
        toast.error(response.error || 'Không thể xóa vai trò');
      }
    } catch (error: any) {
      console.error('Error deleting role:', error);
      toast.error('Lỗi khi xóa vai trò');
    } finally {
      setDeleting(false);
    }
  };

  // Get severity color
  const getSeverityColor = (userCount: number): string => {
    if (userCount === 0) return 'text-green-600';
    if (userCount <= 5) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get severity icon
  const getSeverityIcon = (userCount: number): string => {
    if (userCount === 0) return '✅';
    if (userCount <= 5) return '⚠️';
    return '🚨';
  };

  if (!isOpen || !role) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-red-900">
              🗑️ Xác Nhận Xóa Vai Trò
            </h3>
            <button
              onClick={onClose}
              disabled={deleting}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          {/* Role Information */}
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-900 mb-3">
              Vai Trò Sẽ Bị Xóa:
            </h4>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-medium text-gray-900">{role.display_name}</span>
                  <span className="ml-2 text-sm text-gray-500">({role.name})</span>
                </div>
                <div className="flex items-center space-x-2">
                  {role.is_system && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      🔒 Hệ thống
                    </span>
                  )}
                  <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                    Priority: {role.priority}
                  </span>
                </div>
              </div>
              {role.description && (
                <div className="text-sm text-gray-600">
                  {role.description}
                </div>
              )}
            </div>
          </div>

          {/* Impact Analysis */}
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" />
              <span className="ml-3 text-gray-600">Đang phân tích tác động...</span>
            </div>
          ) : impactAnalysis ? (
            <div className="mb-6">
              <h4 className="text-md font-medium text-gray-900 mb-3">
                📊 Phân Tích Tác Động:
              </h4>
              
              <div className="space-y-4">
                {/* User Count Impact */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">
                      Người dùng bị ảnh hưởng:
                    </span>
                    <span className={`font-bold ${getSeverityColor(impactAnalysis.userCount)}`}>
                      {getSeverityIcon(impactAnalysis.userCount)} {impactAnalysis.userCount} users
                    </span>
                  </div>
                  
                  {impactAnalysis.userCount > 0 && (
                    <div className="text-sm text-gray-600">
                      <p className="mb-2">
                        Khi xóa vai trò này, {impactAnalysis.userCount} người dùng sẽ mất quyền tương ứng.
                      </p>
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                        <p className="text-yellow-800 text-sm">
                          ⚠️ <strong>Khuyến nghị:</strong> Trước khi xóa, hãy gán vai trò khác cho các users này 
                          hoặc đảm bảo họ không còn cần quyền này.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Blocking Reasons */}
                {impactAnalysis.reasons.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h5 className="font-medium text-red-900 mb-2">
                      {impactAnalysis.canDelete ? '⚠️ Cảnh báo:' : '🚫 Không thể xóa:'}
                    </h5>
                    <ul className="space-y-1">
                      {impactAnalysis.reasons.map((reason, index) => (
                        <li key={index} className="text-sm text-red-800">
                          • {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Delete Confirmation */}
                {impactAnalysis.canDelete && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="mb-3">
                      <h5 className="font-medium text-red-900 mb-2">
                        🔄 Hành động sẽ thực hiện:
                      </h5>
                      <ul className="space-y-1 text-sm text-red-800">
                        <li>• Xóa vai trò "{role.display_name}" khỏi hệ thống</li>
                        {impactAnalysis.userCount > 0 && (
                          <li>• Gỡ bỏ vai trò này khỏi {impactAnalysis.userCount} người dùng</li>
                        )}
                        <li>• Thao tác này <strong>KHÔNG THỂ HOÀN TÁC</strong></li>
                      </ul>
                    </div>

                    {/* Confirmation Input */}
                    {impactAnalysis.userCount > 0 && (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-red-900 mb-2">
                          Nhập tên vai trò "{role.name}" để xác nhận:
                        </label>
                        <input
                          type="text"
                          value={confirmText}
                          onChange={(e) => setConfirmText(e.target.value)}
                          className="block w-full border-red-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                          placeholder={role.name}
                          disabled={deleting}
                        />
                        <p className="text-xs text-red-600 mt-1">
                          Điều này đảm bảo bạn hiểu rõ hậu quả của việc xóa vai trò có người dùng
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {impactAnalysis?.canDelete ? (
                <span className="text-red-600">
                  ⚠️ Thao tác này không thể hoàn tác
                </span>
              ) : (
                <span className="text-gray-500">
                  Vai trò này không thể xóa
                </span>
              )}
            </div>
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={deleting}
              >
                Hủy
              </Button>
              {impactAnalysis?.canDelete && (
                <Button
                  variant="danger"
                  onClick={handleDelete}
                  disabled={
                    deleting || 
                    loading || 
                    (impactAnalysis.userCount > 0 && confirmText.toLowerCase() !== role.name.toLowerCase())
                  }
                >
                  {deleting ? (
                    <LoadingSpinner size="xs" />
                  ) : (
                    `🗑️ Xóa ${role.display_name}`
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteRoleConfirmation;