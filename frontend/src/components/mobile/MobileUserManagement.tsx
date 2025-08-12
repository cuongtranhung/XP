/**
 * Mobile User Management Component
 * Optimized for touch devices with responsive layout
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { UserManagement, UserManagementFilters } from '../../types/user-management';
import userManagementService from '../../services/userManagementService';
import { MobileWrapper } from './MobileWrapper';
import { MobileUserCard } from './MobileUserCard';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useDebounce } from '../../hooks/useDebounce';
import { useIsMobile, useIsTablet } from '../../hooks/useMediaQuery';

interface MobileUserManagementProps {
  onUserSelect: (user: UserManagement) => void;
}

export const MobileUserManagement: React.FC<MobileUserManagementProps> = ({
  onUserSelect
}) => {
  const [users, setUsers] = useState<UserManagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<UserManagementFilters>({});
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'blocked'>('all');
  
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  
  // Search debouncing
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Load users
  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      
      // Apply tab-based filtering
      const tabFilters: UserManagementFilters = { ...filters };
      
      switch (activeTab) {
        case 'pending':
          tabFilters.is_approved = false;
          break;
        case 'approved':
          tabFilters.is_approved = true;
          break;
        case 'blocked':
          tabFilters.is_blocked = true;
          break;
      }
      
      if (debouncedSearch) {
        tabFilters.search = debouncedSearch;
      }

      const response = await userManagementService.getUsers(tabFilters);
      if (response.success) {
        setUsers(response.data);
      }
    } catch (error) {
      toast.error('Lỗi khi tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  }, [filters, activeTab, debouncedSearch]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Pull to refresh handler
  const handlePullToRefresh = useCallback(async () => {
    await loadUsers();
    toast.success('Đã làm mới danh sách');
  }, [loadUsers]);

  // Selection handlers
  const handleSelectionToggle = useCallback((userId: string) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map(u => u.id)));
    }
  }, [users, selectedUsers]);

  // Bulk operations
  const handleBulkApprove = useCallback(async () => {
    const userIds = Array.from(selectedUsers);
    if (userIds.length === 0) {
      toast.error('Vui lòng chọn người dùng');
      return;
    }

    try {
      setBulkLoading(true);
      const response = await userManagementService.bulkApproveUsers(userIds);
      if (response.success) {
        toast.success(`Đã phê duyệt ${response.data.successful.length} người dùng`);
        setSelectedUsers(new Set());
        loadUsers();
      }
    } catch (error) {
      toast.error('Lỗi khi phê duyệt');
    } finally {
      setBulkLoading(false);
    }
  }, [selectedUsers, loadUsers]);

  const handleBulkBlock = useCallback(async () => {
    const userIds = Array.from(selectedUsers);
    if (userIds.length === 0) {
      toast.error('Vui lòng chọn người dùng');
      return;
    }

    try {
      setBulkLoading(true);
      const response = await userManagementService.bulkBlockUsers(userIds);
      if (response.success) {
        toast.success(`Đã chặn ${response.data.successful.length} người dùng`);
        setSelectedUsers(new Set());
        loadUsers();
      }
    } catch (error) {
      toast.error('Lỗi khi chặn người dùng');
    } finally {
      setBulkLoading(false);
    }
  }, [selectedUsers, loadUsers]);

  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      all: users.length,
      pending: users.filter(u => !u.is_approved).length,
      approved: users.filter(u => u.is_approved).length,
      blocked: users.filter(u => u.is_blocked).length
    };
  }, [users]);

  return (
    <MobileWrapper
      onPullToRefresh={handlePullToRefresh}
      enablePullToRefresh={true}
      className="bg-gray-50 min-h-screen"
    >
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">Quản lý người dùng</h1>
          
          {/* Search bar */}
          <div className="mt-3 relative">
            <Input
              type="text"
              placeholder="Tìm kiếm người dùng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10 text-sm"
            />
            <svg 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto border-t border-gray-200">
          {(['all', 'pending', 'approved', 'blocked'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 min-w-0 px-4 py-2 text-xs font-medium whitespace-nowrap ${
                activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500'
              }`}
            >
              <span>
                {tab === 'all' && 'Tất cả'}
                {tab === 'pending' && 'Chờ duyệt'}
                {tab === 'approved' && 'Đã duyệt'}
                {tab === 'blocked' && 'Đã chặn'}
              </span>
              <span className="ml-1 text-xs">
                ({tabCounts[tab]})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedUsers.size > 0 && (
        <div className="bg-blue-50 border-y border-blue-200 px-4 py-2 sticky top-[108px] z-30">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-800">
              Đã chọn {selectedUsers.size} người
            </span>
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="success"
                onClick={handleBulkApprove}
                disabled={bulkLoading}
                className="text-xs"
              >
                {bulkLoading ? <LoadingSpinner size="xs" /> : 'Duyệt'}
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={handleBulkBlock}
                disabled={bulkLoading}
                className="text-xs"
              >
                {bulkLoading ? <LoadingSpinner size="xs" /> : 'Chặn'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedUsers(new Set())}
                className="text-xs"
              >
                Bỏ chọn
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Select all checkbox (when in selection mode) */}
      {users.length > 0 && (
        <div className="bg-white border-b border-gray-200 px-4 py-2">
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={selectedUsers.size === users.length && users.length > 0}
              onChange={handleSelectAll}
              className="h-4 w-4 text-blue-600 rounded border-gray-300"
            />
            <span>Chọn tất cả</span>
          </label>
        </div>
      )}

      {/* Content */}
      <div className="px-4 py-4">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner size="lg" />
            <span className="ml-3 text-gray-600">Đang tải...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <svg 
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <div className="mt-2 text-gray-500">Không tìm thấy người dùng</div>
            <Button
              size="sm"
              variant="outline"
              onClick={loadUsers}
              className="mt-4"
            >
              Làm mới
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map(user => (
              <MobileUserCard
                key={user.id}
                user={user}
                onUserSelect={onUserSelect}
                onRefresh={loadUsers}
                selected={selectedUsers.has(user.id)}
                onSelectionToggle={handleSelectionToggle}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating action button */}
      {isMobile && (
        <button
          onClick={() => toast.success('Chức năng thêm người dùng sẽ được thêm sau')}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center z-50"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </MobileWrapper>
  );
};