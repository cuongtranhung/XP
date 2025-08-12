import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Group, UserForGroupAssignment } from '../../types/group-management';
import groupManagementService from '../../services/groupManagementService';
import exportService from '../../services/exportService';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
import Badge from '../common/Badge';
import UserSearchModal from './UserSearchModal';

interface MemberManagementModalProps {
  group: Group | null;
  isOpen: boolean;
  onClose: () => void;
}

export const MemberManagementModal: React.FC<MemberManagementModalProps> = ({
  group,
  isOpen,
  onClose
}) => {
  const [members, setMembers] = useState<UserForGroupAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showUserSearchModal, setShowUserSearchModal] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // Load members when modal opens
  useEffect(() => {
    if (isOpen && group) {
      loadMembers();
    }
  }, [isOpen, group]);

  const loadMembers = async () => {
    if (!group) return;
    
    try {
      setLoading(true);
      const response = await groupManagementService.getUsersByGroup(group.id);
      if (response.success) {
        setMembers(response.data);
      } else {
        toast.error('Không thể tải danh sách thành viên');
      }
    } catch (error) {
      console.error('Error loading members:', error);
      toast.error('Lỗi khi tải danh sách thành viên');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!group) return;
    
    const member = members.find(m => m.id === userId);
    if (!member) return;

    const confirmMessage = `Bạn có chắc chắn muốn xóa "${member.full_name || member.email}" khỏi nhóm "${group.display_name}"?`;
    if (!confirm(confirmMessage)) return;

    try {
      setActionLoading(userId.toString());
      const response = await groupManagementService.removeMemberFromGroup(
        group.id,
        userId.toString()
      );

      if (response.success) {
        toast.success('Đã xóa thành viên khỏi nhóm');
        loadMembers(); // Reload members list
      } else {
        toast.error('Không thể xóa thành viên: ' + response.error);
      }
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Lỗi khi xóa thành viên khỏi nhóm');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateMemberRole = async (userId: number, newRole: 'member' | 'manager' | 'owner') => {
    if (!group) return;

    try {
      setActionLoading(userId.toString());
      const response = await groupManagementService.updateMemberRole(
        group.id,
        userId.toString(),
        { role_in_group: newRole }
      );

      if (response.success) {
        toast.success('Đã cập nhật vai trò thành viên');
        loadMembers(); // Reload members list
      } else {
        toast.error('Không thể cập nhật vai trò: ' + response.error);
      }
    } catch (error) {
      console.error('Error updating member role:', error);
      toast.error('Lỗi khi cập nhật vai trò thành viên');
    } finally {
      setActionLoading(null);
    }
  };

  const handleExportMembers = async () => {
    if (!group) return;
    
    try {
      setExportLoading(true);
      await exportService.exportGroupMembersToExcel(
        group.id,
        group.display_name || group.name,
        members
      );
      toast.success('Đã xuất danh sách thành viên thành công!');
    } catch (error) {
      console.error('Export members error:', error);
      toast.error('Lỗi khi xuất danh sách thành viên');
    } finally {
      setExportLoading(false);
    }
  };

  const handleMembersAdded = () => {
    loadMembers(); // Reload members list after adding new members
  };

  const getRoleText = (role?: string) => {
    switch (role) {
      case 'owner': return 'Chủ sở hữu';
      case 'manager': return 'Quản lý';
      case 'member': return 'Thành viên';
      default: return 'Thành viên';
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen || !group) {
    console.log('🚫 MemberManagementModal NOT RENDERING - isOpen:', isOpen, 'group:', group?.display_name);
    return null;
  }

  console.log('✅ MemberManagementModal RENDERING for group:', group.display_name);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Quản lý thành viên nhóm
              </h3>
              <p className="text-sm text-gray-600">
                Nhóm: <span className="font-medium">{group.display_name}</span>
                {' • '}
                <span className="font-medium">{members.length}</span> thành viên
              </p>
            </div>
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

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mb-6">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowUserSearchModal(true)}
            >
              ➕ Thêm thành viên
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportMembers}
              disabled={exportLoading || members.length === 0}
            >
              {exportLoading ? '⏳' : '📤'} Xuất danh sách
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={loadMembers}
              disabled={loading}
            >
              🔄 Làm mới
            </Button>
          </div>

          {/* Members List */}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner size="lg" />
              <span className="ml-3 text-gray-600">Đang tải danh sách thành viên...</span>
            </div>
          ) : members.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {members.map((member) => (
                <div key={member.id} className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border">
                  <div className="flex items-center flex-1">
                    <div className="flex-shrink-0 h-10 w-10">
                      <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-700">
                          {member.full_name?.charAt(0)?.toUpperCase() || member.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {member.full_name || 'Chưa có tên'}
                      </div>
                      <div className="text-sm text-gray-500">{member.email}</div>
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

                  <div className="flex items-center space-x-3">
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
                            disabled={actionLoading === member.id.toString() || member.role_in_group === role}
                            className={`block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${
                              member.role_in_group === role ? 'bg-gray-100 font-semibold' : ''
                            } ${
                              actionLoading === member.id.toString() ? 'opacity-50' : ''
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
                      disabled={actionLoading === member.id.toString()}
                      className="text-red-600 hover:text-red-700 hover:border-red-300"
                    >
                      {actionLoading === member.id.toString() ? (
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
            <div className="text-center py-12">
              <div className="text-gray-500 text-lg mb-2">Chưa có thành viên nào trong nhóm</div>
              <div className="text-gray-400 mb-4">Thêm thành viên để bắt đầu quản lý nhóm</div>
              <Button
                onClick={() => setShowUserSearchModal(true)}
                variant="outline"
              >
                ➕ Thêm thành viên đầu tiên
              </Button>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 flex justify-between items-center">
            <div className="text-sm text-gray-500">
              {members.length > 0 && (
                <>
                  Tổng: <span className="font-medium">{members.length}</span> thành viên
                  {' • '}
                  <span className="font-medium">
                    {members.filter(m => m.role_in_group === 'owner').length}
                  </span> chủ sở hữu
                  {' • '}
                  <span className="font-medium">
                    {members.filter(m => m.role_in_group === 'manager').length}
                  </span> quản lý
                  {' • '}
                  <span className="font-medium">
                    {members.filter(m => m.role_in_group === 'member').length}
                  </span> thành viên
                </>
              )}
            </div>
            <Button variant="outline" onClick={onClose}>
              Đóng
            </Button>
          </div>

          {/* User Search Modal */}
          {group && (
            <UserSearchModal
              groupId={group.id}
              groupName={group.display_name}
              isOpen={showUserSearchModal}
              onClose={() => setShowUserSearchModal(false)}
              onMembersAdded={handleMembersAdded}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default MemberManagementModal;