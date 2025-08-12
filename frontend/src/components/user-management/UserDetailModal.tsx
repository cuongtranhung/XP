import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { UserManagement, UserRole, UserGroup } from '../../types/user-management';
import userManagementService from '../../services/userManagementService';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { LoadingSpinner } from '../common/LoadingSpinner';
import Badge from '../common/Badge';

interface UserDetailModalProps {
  user: UserManagement | null;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: (user: UserManagement) => void;
}

export const UserDetailModal: React.FC<UserDetailModalProps> = ({
  user,
  isOpen,
  onClose,
  onUserUpdated
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userDetail, setUserDetail] = useState<UserManagement | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    department: '',
    position: ''
  });
  const [availableRoles, setAvailableRoles] = useState<UserRole[]>([]);
  const [availableGroups, setAvailableGroups] = useState<UserGroup[]>([]);

  // Load user details when modal opens
  useEffect(() => {
    if (isOpen && user) {
      loadUserDetail();
      loadRolesAndGroups();
    }
  }, [isOpen, user]);

  // Update form data when user detail changes
  useEffect(() => {
    if (userDetail) {
      setFormData({
        full_name: userDetail.full_name || '',
        department: userDetail.department || '',
        position: userDetail.position || ''
      });
    }
  }, [userDetail]);

  const loadUserDetail = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const response = await userManagementService.getUserById(user.id);
      if (response.success) {
        setUserDetail(response.data);
      } else {
        toast.error('Không thể tải thông tin chi tiết người dùng');
      }
    } catch (error) {
      console.error('Error loading user detail:', error);
      toast.error('Lỗi khi tải thông tin người dùng');
    } finally {
      setLoading(false);
    }
  };

  const loadRolesAndGroups = async () => {
    try {
      const [rolesResponse, groupsResponse] = await Promise.all([
        userManagementService.getRoles().catch(() => ({ success: false, data: [] })),
        userManagementService.getGroups().catch(() => ({ success: false, data: [] }))
      ]);
      
      if (rolesResponse.success) {
        setAvailableRoles(rolesResponse.data);
      }
      
      if (groupsResponse.success) {
        setAvailableGroups(groupsResponse.data);
      }
    } catch (error) {
      console.error('Error loading roles and groups:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!userDetail) return;
    
    try {
      setSaving(true);
      const response = await userManagementService.updateUser(userDetail.id, formData);
      
      if (response.success) {
        toast.success(response.message || 'Cập nhật thông tin thành công');
        setUserDetail(response.data);
        onUserUpdated(response.data);
      } else {
        toast.error('Không thể cập nhật thông tin người dùng');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Lỗi khi cập nhật thông tin người dùng');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleApproval = async () => {
    if (!userDetail) return;
    
    try {
      const response = await userManagementService.toggleUserApproval(userDetail.id);
      if (response.success) {
        toast.success(response.message);
        const updatedUser = { ...userDetail, is_approved: response.data.is_approved };
        setUserDetail(updatedUser);
        onUserUpdated(updatedUser);
      }
    } catch (error) {
      console.error('Error toggling approval:', error);
      toast.error('Lỗi khi thay đổi trạng thái phê duyệt');
    }
  };

  const handleToggleBlock = async () => {
    if (!userDetail) return;
    
    try {
      const response = await userManagementService.toggleUserBlock(userDetail.id);
      if (response.success) {
        toast.success(response.message);
        const updatedUser = { 
          ...userDetail, 
          is_blocked: response.data.is_blocked,
          status: response.data.status
        };
        setUserDetail(updatedUser);
        onUserUpdated(updatedUser);
      }
    } catch (error) {
      console.error('Error toggling block:', error);
      toast.error('Lỗi khi thay đổi trạng thái chặn');
    }
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

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Chi tiết người dùng
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <span className="sr-only">Đóng</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner size="lg" />
              <span className="ml-3 text-gray-600">Đang tải thông tin...</span>
            </div>
          ) : userDetail ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - User Info */}
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Thông tin cơ bản</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <div className="text-sm text-gray-900">{userDetail.email}</div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Username
                      </label>
                      <div className="text-sm text-gray-900">{userDetail.username || 'Chưa có'}</div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Họ và tên
                      </label>
                      <Input
                        type="text"
                        value={formData.full_name}
                        onChange={(e) => handleInputChange('full_name', e.target.value)}
                        placeholder="Nhập họ và tên"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phòng ban
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        value={formData.department}
                        onChange={(e) => handleInputChange('department', e.target.value)}
                      >
                        <option value="">Chọn phòng ban</option>
                        <option value="IT">IT</option>
                        <option value="HR">HR</option>
                        <option value="Finance">Finance</option>
                        <option value="Marketing">Marketing</option>
                        <option value="Sales">Sales</option>
                        <option value="Operations">Operations</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Vị trí
                      </label>
                      <Input
                        type="text"
                        value={formData.position}
                        onChange={(e) => handleInputChange('position', e.target.value)}
                        placeholder="Nhập vị trí công việc"
                      />
                    </div>
                  </div>
                </div>

                {/* Status Controls */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Điều khiển trạng thái</h4>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Trạng thái phê duyệt:</span>
                      <Button
                        size="sm"
                        variant={userDetail.is_approved ? 'success' : 'outline'}
                        onClick={handleToggleApproval}
                      >
                        {userDetail.is_approved ? '✅ Đã duyệt' : '⏳ Chờ duyệt'}
                      </Button>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Trạng thái chặn:</span>
                      <Button
                        size="sm"
                        variant={userDetail.is_blocked ? 'danger' : 'success'}
                        onClick={handleToggleBlock}
                      >
                        {userDetail.is_blocked ? '🚫 Đã chặn' : '✅ Bình thường'}
                      </Button>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Trạng thái hoạt động:</span>
                      <Badge className={
                        userDetail.status === 'active' ? 'bg-green-100 text-green-800' :
                        userDetail.status === 'inactive' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }>
                        {userDetail.status === 'active' ? 'Hoạt động' :
                         userDetail.status === 'inactive' ? 'Không hoạt động' :
                         userDetail.status === 'pending' ? 'Chờ xử lý' : userDetail.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Roles & Groups */}
              <div className="space-y-6">
                {/* Roles */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Vai trò (Roles)</h4>
                  
                  {userDetail.roles && userDetail.roles.length > 0 ? (
                    <div className="space-y-2">
                      {userDetail.roles.map((role) => (
                        <div key={role.id} className="flex justify-between items-center bg-white p-2 rounded border">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{role.name}</div>
                            {role.description && (
                              <div className="text-xs text-gray-500">{role.description}</div>
                            )}
                          </div>
                          <Button 
                            size="xs" 
                            variant="outline"
                            onClick={() => {
                              // TODO: Implement role removal
                              toast.success('Chức năng xóa vai trò sẽ được thêm sau');
                            }}
                          >
                            Xóa
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 text-center py-4">
                      Chưa có vai trò nào được gán
                    </div>
                  )}
                  
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full mt-3"
                    onClick={() => {
                      // TODO: Implement role assignment
                      toast.success('Chức năng gán vai trò sẽ được thêm sau');
                    }}
                  >
                    + Thêm vai trò
                  </Button>
                </div>

                {/* Groups */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Nhóm (Groups)</h4>
                  
                  {userDetail.groups && userDetail.groups.length > 0 ? (
                    <div className="space-y-2">
                      {userDetail.groups.map((group) => (
                        <div key={group.id} className="flex justify-between items-center bg-white p-2 rounded border">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{group.name}</div>
                            {group.description && (
                              <div className="text-xs text-gray-500">{group.description}</div>
                            )}
                          </div>
                          <Button 
                            size="xs" 
                            variant="outline"
                            onClick={() => {
                              // TODO: Implement group removal
                              toast.success('Chức năng xóa nhóm sẽ được thêm sau');
                            }}
                          >
                            Xóa
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 text-center py-4">
                      Chưa thuộc nhóm nào
                    </div>
                  )}
                  
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full mt-3"
                    onClick={() => {
                      // TODO: Implement group assignment
                      toast.success('Chức năng thêm vào nhóm sẽ được thêm sau');
                    }}
                  >
                    + Thêm vào nhóm
                  </Button>
                </div>

                {/* Timestamps */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Thông tin thời gian</h4>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Ngày tạo:</span>
                      <span className="text-gray-900">{formatDate(userDetail.created_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cập nhật lần cuối:</span>
                      <span className="text-gray-900">{formatDate(userDetail.updated_at)}</span>
                    </div>
                    {userDetail.last_login && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Đăng nhập lần cuối:</span>
                        <span className="text-gray-900">{formatDate(userDetail.last_login)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-500">Không thể tải thông tin người dùng</div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 flex justify-end space-x-3">
            <Button 
              variant="outline" 
              onClick={onClose}
            >
              Đóng
            </Button>
            {userDetail && (
              <Button 
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <LoadingSpinner size="xs" />
                    <span className="ml-2">Đang lưu...</span>
                  </>
                ) : (
                  '💾 Lưu thay đổi'
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDetailModal;