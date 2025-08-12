import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Group, GroupFilters } from '../../types/group-management';
import groupManagementService from '../../services/groupManagementService';
import Badge from '../common/Badge';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
import MemberManagementModal from './MemberManagementModal';

interface GroupManagementTableProps {
  filters?: GroupFilters;
  onGroupSelect?: (group: Group) => void;
}

export const GroupManagementTable: React.FC<GroupManagementTableProps> = ({
  filters = {},
  onGroupSelect
}) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});
  const [selectedGroupForMembers, setSelectedGroupForMembers] = useState<Group | null>(null);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);

  // Load groups
  const loadGroups = async () => {
    try {
      setLoading(true);
      const response = await groupManagementService.getGroups(filters);
      if (response.success) {
        setGroups(response.data);
      } else {
        toast.error('Không thể tải danh sách nhóm');
      }
    } catch (error) {
      console.error('Error loading groups:', error);
      toast.error('Lỗi khi tải danh sách nhóm');
    } finally {
      setLoading(false);
    }
  };

  // Load groups on component mount or filter change
  useEffect(() => {
    loadGroups();
  }, [filters]);

  // Delete group
  const handleDeleteGroup = async (group: Group) => {
    if (group.is_system) {
      toast.error('Không thể xóa nhóm hệ thống');
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn xóa nhóm "${group.display_name}"?`)) {
      return;
    }

    const actionKey = `delete-${group.id}`;
    try {
      setActionLoading(prev => ({ ...prev, [actionKey]: true }));
      
      const response = await groupManagementService.deleteGroup(group.id);
      if (response.success) {
        toast.success('Xóa nhóm thành công');
        setGroups(prev => prev.filter(g => g.id !== group.id));
      } else {
        toast.error('Không thể xóa nhóm');
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Lỗi khi xóa nhóm');
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  // Handle member management
  const handleMemberManagement = (group: Group) => {
    console.log('✅ MemberManagement clicked for group:', group.display_name);
    setSelectedGroupForMembers(group);
    setIsMemberModalOpen(true);
  };

  // Get group type color
  const getGroupTypeColor = (groupType: string) => {
    switch (groupType) {
      case 'system': return 'bg-blue-100 text-blue-800';
      case 'department': return 'bg-green-100 text-green-800';
      case 'project': return 'bg-purple-100 text-purple-800';
      case 'custom': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Format date
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
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-gray-600">Đang tải dữ liệu nhóm...</span>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 text-lg mb-2">Không tìm thấy nhóm nào</div>
        <div className="text-gray-400">Thử thay đổi bộ lọc hoặc tạo nhóm mới</div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-sm rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">
            Danh sách nhóm ({groups.length})
          </h3>
          <Button
            onClick={loadGroups}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            🔄 Làm mới
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nhóm
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Loại nhóm
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Trạng thái
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ngày tạo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {groups.map((group) => (
              <tr key={group.id} className="hover:bg-gray-50">
                {/* Group Info */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-700">
                          {group.display_name?.charAt(0)?.toUpperCase() || group.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {group.display_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {group.name}
                      </div>
                      {group.description && (
                        <div className="text-xs text-gray-400 mt-1">
                          {group.description}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {/* Group Type */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge className={getGroupTypeColor(group.group_type)}>
                    {group.group_type === 'system' ? 'Hệ thống' :
                     group.group_type === 'department' ? 'Phòng ban' :
                     group.group_type === 'project' ? 'Dự án' :
                     group.group_type === 'custom' ? 'Tùy chỉnh' : group.group_type}
                  </Badge>
                </td>

                {/* Status */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="space-y-1">
                    <Badge className={group.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {group.is_active ? '✅ Hoạt động' : '❌ Vô hiệu'}
                    </Badge>
                    {group.is_system && (
                      <div>
                        <Badge className="bg-blue-100 text-blue-800" size="sm">
                          🔒 Hệ thống
                        </Badge>
                      </div>
                    )}
                  </div>
                </td>

                {/* Created Date */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(group.created_at)}
                </td>

                {/* Actions */}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onGroupSelect?.(group)}
                    >
                      📝 Chi tiết
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        console.log('🔥 BUTTON CLICKED - Member Management for:', group.display_name);
                        handleMemberManagement(group);
                      }}
                    >
                      👥 Thành viên
                    </Button>

                    {!group.is_system && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDeleteGroup(group)}
                        disabled={actionLoading[`delete-${group.id}`]}
                      >
                        {actionLoading[`delete-${group.id}`] ? (
                          <LoadingSpinner size="xs" />
                        ) : (
                          '🗑️ Xóa'
                        )}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <div className="text-sm text-gray-700">
          Hiển thị <span className="font-medium">{groups.length}</span> nhóm
          {' • '}
          <span className="font-medium">
            {groups.filter(g => g.is_system).length}
          </span> nhóm hệ thống
          {' • '}
          <span className="font-medium">
            {groups.filter(g => !g.is_system).length}
          </span> nhóm tùy chỉnh
        </div>
      </div>

      {/* Member Management Modal */}
      <MemberManagementModal
        group={selectedGroupForMembers}
        isOpen={isMemberModalOpen}
        onClose={() => {
          setIsMemberModalOpen(false);
          setSelectedGroupForMembers(null);
        }}
      />
    </div>
  );
};

export default GroupManagementTable;