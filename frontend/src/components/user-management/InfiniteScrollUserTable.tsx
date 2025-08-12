/**
 * Infinite Scroll User Table Component
 * Seamless infinite scrolling with virtual windowing for large datasets
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User } from '../../types/user.types';
import { userManagementService } from '../../services/userManagementService';
import { useInfiniteScroll, useVirtualInfiniteScroll } from '../../hooks/useInfiniteScroll';
import Badge from '../common/Badge';
import { formatDate } from '../../utils/date';
import { UserActions } from './UserActions';
import { useToast } from '../../hooks/useToast';
import { formatAnnouncement } from '../../config/accessibility';

interface InfiniteScrollUserTableProps {
  searchTerm?: string;
  filters?: {
    status?: string;
    role?: string;
    department?: string;
  };
  onUserUpdate?: (user: User) => void;
  virtualMode?: boolean; // Use virtual scrolling for very large datasets
}

const InfiniteScrollUserTable: React.FC<InfiniteScrollUserTableProps> = ({
  searchTerm = '',
  filters = {},
  onUserUpdate,
  virtualMode = false
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const toast = useToast();

  const PAGE_SIZE = 50;
  const ITEM_HEIGHT = 80; // Height of each user row in pixels
  const CONTAINER_HEIGHT = 600; // Height of the scrollable container

  // Load more users
  const loadMoreUsers = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(null);

    try {
      const response = await userManagementService.getUsers({
        page,
        limit: PAGE_SIZE,
        search: searchTerm,
        ...filters
      });

      const newUsers = response.data;
      const isLastPage = newUsers.length < PAGE_SIZE || page * PAGE_SIZE >= response.total;

      setUsers(prev => [...prev, ...newUsers]);
      setTotalCount(response.total);
      setHasMore(!isLastPage);
      setPage(prev => prev + 1);

      // Announce to screen readers
      formatAnnouncement(
        `Loaded ${newUsers.length} more users. Total: ${users.length + newUsers.length} of ${response.total}`,
        'polite'
      );
    } catch (err) {
      setError('Failed to load users');
      toast.error('Failed to load more users');
    } finally {
      setLoading(false);
    }
  }, [page, loading, hasMore, searchTerm, filters, users.length, toast]);

  // Reset when filters change
  useEffect(() => {
    setUsers([]);
    setPage(1);
    setHasMore(true);
    loadMoreUsers();
  }, [searchTerm, JSON.stringify(filters)]); // eslint-disable-line react-hooks/exhaustive-deps

  // Regular infinite scroll hook
  const {
    sentinelRef,
    isIntersecting,
    resetScroll
  } = useInfiniteScroll({
    hasMore,
    loading,
    onLoadMore: loadMoreUsers,
    enabled: !virtualMode
  });

  // Virtual infinite scroll hook for large datasets
  const {
    containerRef,
    handleScroll,
    visibleItems,
    totalHeight,
    offsetY,
    startIndex
  } = useVirtualInfiniteScroll({
    items: users,
    itemHeight: ITEM_HEIGHT,
    containerHeight: CONTAINER_HEIGHT,
    hasMore,
    loading,
    onLoadMore: loadMoreUsers
  });

  // Handle user actions
  const handleUserAction = useCallback(async (userId: string, action: string) => {
    try {
      let updatedUser: User | null = null;

      switch (action) {
        case 'approve':
          updatedUser = await userManagementService.approveUser(userId);
          toast.success('User approved successfully');
          break;
        case 'block':
          updatedUser = await userManagementService.blockUser(userId);
          toast.success('User blocked successfully');
          break;
        case 'delete':
          await userManagementService.deleteUser(userId);
          setUsers(prev => prev.filter(u => u.id !== userId));
          toast.success('User deleted successfully');
          return;
        default:
          return;
      }

      if (updatedUser) {
        setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
        onUserUpdate?.(updatedUser);
      }
    } catch (err) {
      toast.error(`Failed to ${action} user`);
    }
  }, [toast, onUserUpdate]);

  // Render user row
  const renderUserRow = useCallback((user: User, index: number) => (
    <div
      key={user.id}
      className="flex items-center p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors"
      style={virtualMode ? { height: ITEM_HEIGHT } : undefined}
      role="row"
      aria-rowindex={virtualMode ? startIndex + index + 2 : index + 2} // +2 for header row
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
              <span className="text-gray-600 font-medium">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-sm text-gray-500 truncate">{user.email}</p>
          </div>
        </div>
      </div>

      <div className="ml-4 flex items-center space-x-4">
        <div className="flex flex-col items-end">
          <Badge 
            variant={user.status === 'active' ? 'success' : user.status === 'blocked' ? 'danger' : 'warning'}
          >
            {user.status}
          </Badge>
          <span className="text-xs text-gray-500 mt-1">
            {formatDate(user.createdAt)}
          </span>
        </div>
        
        <UserActions
          user={user}
          onAction={handleUserAction}
        />
      </div>
    </div>
  ), [virtualMode, startIndex, handleUserAction]);

  // Render loading indicator
  const renderLoadingIndicator = () => (
    <div className="flex justify-center items-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      <span className="ml-3 text-gray-600">Loading more users...</span>
    </div>
  );

  // Render error message
  const renderError = () => (
    <div className="text-center py-8">
      <p className="text-red-600 mb-4">{error}</p>
      <button
        onClick={() => {
          setError(null);
          loadMoreUsers();
        }}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        Retry
      </button>
    </div>
  );

  // Render empty state
  const renderEmptyState = () => (
    <div className="text-center py-12">
      <svg
        className="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
      <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
      <p className="mt-1 text-sm text-gray-500">
        Try adjusting your search or filters
      </p>
    </div>
  );

  // Stats header
  const renderStats = () => (
    <div className="bg-white px-4 py-3 border-b border-gray-200">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-700">
          Showing <span className="font-medium">{users.length}</span> of{' '}
          <span className="font-medium">{totalCount}</span> users
        </p>
        {hasMore && !loading && (
          <button
            onClick={resetScroll}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Back to top ↑
          </button>
        )}
      </div>
    </div>
  );

  // Virtual mode rendering
  if (virtualMode) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {renderStats()}
        
        <div
          ref={containerRef}
          className="overflow-y-auto"
          style={{ height: CONTAINER_HEIGHT }}
          onScroll={handleScroll}
          data-infinite-scroll-container
          role="table"
          aria-label="Users table with infinite scroll"
          aria-rowcount={totalCount || users.length}
        >
          {/* Virtual scrolling spacer */}
          <div style={{ height: totalHeight, position: 'relative' }}>
            <div
              style={{
                transform: `translateY(${offsetY}px)`,
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0
              }}
            >
              {visibleItems.map((user, index) => renderUserRow(user, index))}
            </div>
          </div>
          
          {loading && renderLoadingIndicator()}
          {error && renderError()}
        </div>
      </div>
    );
  }

  // Regular infinite scroll rendering
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {renderStats()}
      
      <div 
        className="overflow-y-auto max-h-[600px]"
        data-infinite-scroll-container
        role="table"
        aria-label="Users table with infinite scroll"
        aria-rowcount={totalCount || users.length}
      >
        {users.length === 0 && !loading && !error && renderEmptyState()}
        
        {users.map((user, index) => renderUserRow(user, index))}
        
        {/* Sentinel element for intersection observer */}
        {hasMore && !virtualMode && (
          <div
            ref={sentinelRef}
            className="h-20 flex items-center justify-center"
            aria-hidden="true"
          >
            {isIntersecting && loading && (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            )}
          </div>
        )}
        
        {loading && !isIntersecting && renderLoadingIndicator()}
        {error && renderError()}
        
        {!hasMore && users.length > 0 && (
          <div className="text-center py-4 text-gray-500 text-sm">
            No more users to load
          </div>
        )}
      </div>
    </div>
  );
};

export default InfiniteScrollUserTable;