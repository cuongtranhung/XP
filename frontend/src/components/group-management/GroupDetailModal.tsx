import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Group, UserForGroupAssignment } from '../../types/group-management';
import groupManagementService from '../../services/groupManagementService';
import exportService from '../../services/exportService';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { LoadingSpinner } from '../common/LoadingSpinner';
import Badge from '../common/Badge';
import UserSearchModal from './UserSearchModal';
import GroupPermissionsModal from './GroupPermissionsModal';

interface GroupDetailModalProps {
  group: Group | null;
  isOpen: boolean;
  onClose: () => void;
  onGroupUpdated: (group: Group) => void;
}

export const GroupDetailModal: React.FC<GroupDetailModalProps> = ({
  group,
  isOpen,
  onClose,
  onGroupUpdated
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [groupDetail, setGroupDetail] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<UserForGroupAssignment[]>([]);
  const [showUserSearchModal, setShowUserSearchModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [memberActionLoading, setMemberActionLoading] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    display_name: '',
    description: '',
    is_active: true
  });

  // Load group details when modal opens
  useEffect(() => {
    if (isOpen && group) {
      loadGroupDetail();
      loadGroupMembers();
    }
  }, [isOpen, group]);

  // Update form data when group detail changes
  useEffect(() => {
    if (groupDetail) {
      setFormData({
        display_name: groupDetail.display_name || '',
        description: groupDetail.description || '',
        is_active: groupDetail.is_active
      });
    }
  }, [groupDetail]);

  const loadGroupDetail = async () => {
    if (!group) return;
    
    try {
      setLoading(true);
      const response = await groupManagementService.getGroupById(group.id);
      if (response.success) {
        setGroupDetail(response.data);
      } else {
        toast.error('Không thể tải thông tin chi tiết nhóm');
      }
    } catch (error) {
      console.error('Error loading group detail:', error);
      toast.error('Lỗi khi tải thông tin nhóm');
    } finally {
      setLoading(false);
    }
  };

  const loadGroupMembers = async () => {
    if (!group) return;
    
    try {
      const response = await groupManagementService.getUsersByGroup(group.id);
      if (response.success) {
        setGroupMembers(response.data);
      }
    } catch (error) {
      console.error('Error loading group members:', error);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!groupDetail) return;
    
    try {
      setSaving(true);
      const response = await groupManagementService.updateGroup(groupDetail.id, formData);
      
      if (response.success) {
        toast.success('Cập nhật thông tin nhóm thành công');
        setGroupDetail(response.data);
        onGroupUpdated(response.data);
      } else {
        toast.error('Không thể cập nhật thông tin nhóm');
      }
    } catch (error) {
      console.error('Error updating group:', error);
      toast.error('Lỗi khi cập nhật thông tin nhóm');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!groupDetail) return;
    
    const member = groupMembers.find(m => m.id === userId);
    if (!member) return;

    const confirmMessage = `Bạn có chắc chắn muốn xóa "${member.full_name || member.email}" khỏi nhóm?`;
    if (!confirm(confirmMessage)) return;

    try {
      setMemberActionLoading(userId.toString());
      const response = await groupManagementService.removeMemberFromGroup(
        groupDetail.id,
        userId.toString()
      );

      if (response.success) {
        toast.success('Đã xóa thành viên khỏi nhóm');
        loadGroupMembers(); // Reload members list
      } else {
        toast.error('Không thể xóa thành viên: ' + response.error);
      }
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Lỗi khi xóa thành viên khỏi nhóm');
    } finally {
      setMemberActionLoading(null);
    }
  };

  const handleUpdateMemberRole = async (userId: number, newRole: 'member' | 'manager' | 'owner') => {
    if (!groupDetail) return;

    try {
      setMemberActionLoading(userId.toString());
      const response = await groupManagementService.updateMemberRole(
        groupDetail.id,
        userId.toString(),
        { role_in_group: newRole }
      );

      if (response.success) {
        toast.success('Đã cập nhật vai trò thành viên');
        loadGroupMembers(); // Reload members list
      } else {
        toast.error('Không thể cập nhật vai trò: ' + response.error);
      }
    } catch (error) {
      console.error('Error updating member role:', error);
      toast.error('Lỗi khi cập nhật vai trò thành viên');
    } finally {
      setMemberActionLoading(null);
    }
  };

  const handleMembersAdded = () => {
    loadGroupMembers(); // Reload members list after adding new members
    loadGroupDetail(); // Reload group details to get updated member count
  };

  const handleExportMembers = async () => {
    if (!groupDetail) return;
    
    try {
      setBulkActionLoading(true);
      await exportService.exportGroupMembersToExcel(
        groupDetail.id,
        groupDetail.display_name || groupDetail.name,
        groupMembers
      );
      toast.success('Đã xuất danh sách thành viên thành công!');
    } catch (error) {
      console.error('Export members error:', error);
      toast.error('Lỗi khi xuất danh sách thành viên');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleImportMembers = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !groupDetail) return;

    // Reset input
    event.target.value = '';

    try {
      setBulkActionLoading(true);
      
      // For demo purposes, simulate import processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success('Tính năng import thành viên đang được phát triển');
      toast.info('File đã được tải lên: ' + file.name);
      
      // In real implementation, this would:
      // 1. Parse Excel file
      // 2. Validate email addresses
      // 3. Check if users exist in system
      // 4. Add valid users to group
      // 5. Show report of successful/failed imports
      
    } catch (error) {
      console.error('Import members error:', error);
      toast.error('Lỗi khi import thành viên');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const getGroupTypeColor = (groupType: string) => {
    switch (groupType) {
      case 'system': return 'bg-blue-100 text-blue-800';
      case 'department': return 'bg-green-100 text-green-800';
      case 'project': return 'bg-purple-100 text-purple-800';
      case 'custom': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleColor = (role?: string) => {
    switch (role) {
      case 'owner': return 'bg-red-100 text-red-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'member': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleText = (role?: string) => {
    switch (role) {
      case 'owner': return 'Chủ sở hữu';
      case 'manager': return 'Quản lý';
      case 'member': return 'Thành viên';
      default: return 'Thành viên';
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

  if (!isOpen || !group) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Chi tiết nhóm
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
          ) : groupDetail ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Group Info */}
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Thông tin cơ bản</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tên nhóm (system name)
                      </label>
                      <div className="text-sm text-gray-900">{groupDetail.name}</div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tên hiển thị
                      </label>
                      <Input
                        type="text"
                        value={formData.display_name}
                        onChange={(e) => handleInputChange('display_name', e.target.value)}
                        placeholder="Nhập tên hiển thị"
                        disabled={groupDetail.is_system}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Mô tả
                      </label>
                      <textarea
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        rows={3}
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        placeholder="Nhập mô tả nhóm"
                        disabled={groupDetail.is_system}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Loại nhóm
                      </label>
                      <Badge className={getGroupTypeColor(groupDetail.group_type)}>
                        {groupDetail.group_type === 'system' ? 'Hệ thống' :
                         groupDetail.group_type === 'department' ? 'Phòng ban' :
                         groupDetail.group_type === 'project' ? 'Dự án' :
                         groupDetail.group_type === 'custom' ? 'Tùy chỉnh' : groupDetail.group_type}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Status Controls */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Điều khiển trạng thái</h4>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Trạng thái hoạt động:</span>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.is_active}
                          onChange={(e) => handleInputChange('is_active', e.target.checked)}
                          disabled={groupDetail.is_system}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <Badge className={formData.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {formData.is_active ? '✅ Hoạt động' : '❌ Vô hiệu'}
                        </Badge>
                      </div>
                    </div>
                    
                    {groupDetail.is_system && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Nhóm hệ thống:</span>
                        <Badge className="bg-blue-100 text-blue-800">
                          🔒 Không thể chỉnh sửa
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>

                {/* Timestamps */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Thông tin thời gian</h4>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Ngày tạo:</span>
                      <span className="text-gray-900">{formatDate(groupDetail.created_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cập nhật lần cuối:</span>
                      <span className="text-gray-900">{formatDate(groupDetail.updated_at)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Members */}
              <div className="space-y-6">
                {/* Group Members */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-md font-medium text-gray-900">
                      Thành viên nhóm ({groupMembers.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setShowPermissionsModal(true)}
                      >
                        🔒 Quyền
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={handleExportMembers}
                        disabled={bulkActionLoading || groupMembers.length === 0}
                      >
                        {bulkActionLoading ? '⏳' : '📤'} Xuất
                      </Button>
                      <label 
                        htmlFor="import-members" 
                        className={`inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 transition-colors cursor-pointer ${
                          bulkActionLoading ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handleImportMembers}
                          disabled={bulkActionLoading}
                          className="hidden"
                          id="import-members"
                        />
                        {bulkActionLoading ? '⏳' : '📥'} Nhập
                      </label>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setShowUserSearchModal(true)}
                      >
                        ➕ Thêm
                      </Button>
                    </div>
                  </div>
                  
                  {groupMembers.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {groupMembers.map((member) => (
                        <div key={member.id} className="flex justify-between items-center bg-white p-3 rounded border">
                          <div className="flex items-center flex-1">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                                <span className="text-sm font-medium text-gray-700">
                                  {member.full_name?.charAt(0)?.toUpperCase() || member.email.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <div className="ml-3 flex-1">
                              <div className="text-sm font-medium text-gray-900">
                                {member.full_name || 'Chưa có tên'}
                              </div>
                              <div className="text-xs text-gray-500">{member.email}</div>
                              {member.department && (
                                <div className="text-xs text-gray-400">{member.department}</div>
                              )}
                              {member.joined_at && (
                                <div className="text-xs text-gray-400">
                                  Tham gia: {formatDate(member.joined_at)}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            {/* Role Badge with Dropdown */}
                            <div className="relative group">
                              <Badge className={`${getRoleColor(member.role_in_group)} cursor-pointer`}>
                                {getRoleText(member.role_in_group)} ▼
                              </Badge>
                              
                              {/* Role Dropdown Menu */}
                              <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                                {['member', 'manager', 'owner'].map((role) => (
                                  <button
                                    key={role}
                                    onClick={() => handleUpdateMemberRole(member.id, role as any)}
                                    disabled={memberActionLoading === member.id.toString() || member.role_in_group === role}
                                    className={`block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${
                                      member.role_in_group === role ? 'bg-gray-100 font-semibold' : ''
                                    } ${
                                      memberActionLoading === member.id.toString() ? 'opacity-50' : ''
                                    }`}
                                  >
                                    {getRoleText(role)}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Status Badges */}
                            {member.is_blocked && (
                              <Badge className="bg-red-100 text-red-800 text-xs">
                                Bị khóa
                              </Badge>
                            )}
                            {member.is_approved === false && (
                              <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                                Chờ duyệt
                              </Badge>
                            )}

                            {/* Remove Button */}
                            <Button 
                              size="xs" 
                              variant="outline"
                              onClick={() => handleRemoveMember(member.id)}
                              disabled={memberActionLoading === member.id.toString()}
                              className="text-red-600 hover:text-red-700 hover:border-red-300"
                            >
                              {memberActionLoading === member.id.toString() ? (
                                <LoadingSpinner size="xs" />
                              ) : (
                                '🗑️'
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 text-center py-4">
                      Chưa có thành viên nào trong nhóm
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-500">Không thể tải thông tin nhóm</div>
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
            {groupDetail && !groupDetail.is_system && (
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

          {/* User Search Modal */}
          {groupDetail && (
            <UserSearchModal
              groupId={groupDetail.id}
              groupName={groupDetail.display_name}
              isOpen={showUserSearchModal}
              onClose={() => setShowUserSearchModal(false)}
              onMembersAdded={handleMembersAdded}
            />
          )}

          {/* Group Permissions Modal */}
          {groupDetail && (
            <GroupPermissionsModal
              groupId={groupDetail.id}
              groupName={groupDetail.display_name}
              isOpen={showPermissionsModal}
              onClose={() => setShowPermissionsModal(false)}
              onPermissionsUpdated={() => {
                toast.success('Đã cập nhật quyền nhóm');
                loadGroupDetail();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupDetailModal;