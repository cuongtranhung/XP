/**
 * Mobile User Card Component
 * Touch-optimized card layout for mobile devices
 */

import React, { useState, useCallback } from 'react';
import { UserManagement } from '../../types/user-management';
import Badge from '../common/Badge';
import { Button } from '../common/Button';
import { toast } from 'react-hot-toast';
import userManagementService from '../../services/userManagementService';
import { useSwipeable } from 'react-swipeable';

interface MobileUserCardProps {
  user: UserManagement;
  onUserSelect: (user: UserManagement) => void;
  onRefresh?: () => void;
  selected?: boolean;
  onSelectionToggle?: (userId: string) => void;
}

export const MobileUserCard: React.FC<MobileUserCardProps> = ({
  user,
  onUserSelect,
  onRefresh,
  selected = false,
  onSelectionToggle
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipeActionActive, setIsSwipeActionActive] = useState(false);

  // Swipe handlers for quick actions
  const swipeHandlers = useSwipeable({
    onSwiping: (eventData) => {
      const offset = eventData.deltaX;
      
      // Limit swipe distance
      if (Math.abs(offset) < 150) {
        setSwipeOffset(offset);
        
        // Activate action if swiped enough
        if (Math.abs(offset) > 80) {
          setIsSwipeActionActive(true);
        } else {
          setIsSwipeActionActive(false);
        }
      }
    },
    onSwipedLeft: async () => {
      if (isSwipeActionActive) {
        // Block user action
        await handleToggleBlock();
      }
      resetSwipe();
    },
    onSwipedRight: async () => {
      if (isSwipeActionActive) {
        // Approve user action
        await handleToggleApproval();
      }
      resetSwipe();
    },
    onTouchEndOrOnMouseUp: () => {
      if (!isSwipeActionActive) {
        resetSwipe();
      }
    },
    trackMouse: false,
    trackTouch: true,
    delta: 10,
  });

  const resetSwipe = () => {
    setSwipeOffset(0);
    setIsSwipeActionActive(false);
  };

  const handleToggleApproval = useCallback(async () => {
    try {
      setActionLoading('approval');
      const response = await userManagementService.toggleUserApproval(user.id);
      if (response.success) {
        toast.success(response.message);
        onRefresh?.();
      }
    } catch (error) {
      toast.error('Lỗi khi thay đổi trạng thái phê duyệt');
    } finally {
      setActionLoading(null);
    }
  }, [user.id, onRefresh]);

  const handleToggleBlock = useCallback(async () => {
    try {
      setActionLoading('block');
      const response = await userManagementService.toggleUserBlock(user.id);
      if (response.success) {
        toast.success(response.message);
        onRefresh?.();
      }
    } catch (error) {
      toast.error('Lỗi khi thay đổi trạng thái chặn');
    } finally {
      setActionLoading(null);
    }
  }, [user.id, onRefresh]);

  const statusColor = user.status === 'active' ? 'bg-green-100 text-green-800' :
                      user.status === 'inactive' ? 'bg-red-100 text-red-800' :
                      user.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800';

  return (
    <div className="relative overflow-hidden">
      {/* Swipe action indicators */}
      {swipeOffset !== 0 && (
        <>
          {/* Right swipe - Approve */}
          <div 
            className={`absolute inset-y-0 left-0 flex items-center justify-start pl-4 transition-all ${
              swipeOffset > 0 ? 'bg-green-500' : 'bg-transparent'
            }`}
            style={{ width: Math.abs(swipeOffset) }}
          >
            {swipeOffset > 0 && (
              <div className="text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs">Phê duyệt</span>
              </div>
            )}
          </div>

          {/* Left swipe - Block */}
          <div 
            className={`absolute inset-y-0 right-0 flex items-center justify-end pr-4 transition-all ${
              swipeOffset < 0 ? 'bg-red-500' : 'bg-transparent'
            }`}
            style={{ width: Math.abs(swipeOffset) }}
          >
            {swipeOffset < 0 && (
              <div className="text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="text-xs">Chặn</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Main card content */}
      <div 
        {...swipeHandlers}
        className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 transition-all ${
          selected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
        }`}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: swipeOffset === 0 ? 'transform 0.3s ease-out' : 'none'
        }}
        onClick={() => !isSwipeActionActive && setIsExpanded(!isExpanded)}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3 flex-1">
            {/* Selection checkbox */}
            {onSelectionToggle && (
              <input
                type="checkbox"
                checked={selected}
                onChange={(e) => {
                  e.stopPropagation();
                  onSelectionToggle(user.id);
                }}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4 text-blue-600 rounded border-gray-300"
              />
            )}

            {/* Avatar */}
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-700">
                {user.full_name?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase()}
              </span>
            </div>

            {/* User info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {user.full_name || 'Chưa có tên'}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {user.email}
              </div>
            </div>
          </div>

          {/* Status badge */}
          <Badge className={`${statusColor} text-xs`}>
            {user.status === 'active' ? 'Hoạt động' : 
             user.status === 'inactive' ? 'Không hoạt động' : 
             user.status === 'pending' ? 'Chờ xử lý' : user.status}
          </Badge>
        </div>

        {/* Quick info */}
        <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
          <span>{user.department || 'Chưa có phòng ban'}</span>
          <span>{new Date(user.created_at).toLocaleDateString('vi-VN')}</span>
        </div>

        {/* Status indicators */}
        <div className="flex items-center space-x-2">
          <span className={`inline-flex items-center text-xs ${user.is_approved ? 'text-green-600' : 'text-yellow-600'}`}>
            {user.is_approved ? '✅ Đã duyệt' : '⏳ Chờ duyệt'}
          </span>
          <span className={`inline-flex items-center text-xs ${user.is_blocked ? 'text-red-600' : 'text-gray-600'}`}>
            {user.is_blocked ? '🚫 Đã chặn' : '✅ Bình thường'}
          </span>
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200 animate-slide-up">
            {/* Additional info */}
            <div className="space-y-2 mb-4">
              {user.username && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Username:</span>
                  <span className="text-gray-900">@{user.username}</span>
                </div>
              )}
              {user.position && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Vị trí:</span>
                  <span className="text-gray-900">{user.position}</span>
                </div>
              )}
              {user.last_login && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Đăng nhập cuối:</span>
                  <span className="text-gray-900">
                    {new Date(user.last_login).toLocaleString('vi-VN')}
                  </span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant={user.is_approved ? 'success' : 'outline'}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleApproval();
                }}
                disabled={actionLoading === 'approval'}
                className="text-xs"
              >
                {actionLoading === 'approval' ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  user.is_approved ? 'Đã duyệt ✅' : 'Phê duyệt'
                )}
              </Button>

              <Button
                size="sm"
                variant={user.is_blocked ? 'danger' : 'outline'}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleBlock();
                }}
                disabled={actionLoading === 'block'}
                className="text-xs"
              >
                {actionLoading === 'block' ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  user.is_blocked ? 'Bỏ chặn' : 'Chặn'
                )}
              </Button>
            </div>

            {/* View details button */}
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onUserSelect(user);
              }}
              className="w-full mt-2 text-xs"
            >
              📝 Xem chi tiết
            </Button>
          </div>
        )}

        {/* Expand/Collapse indicator */}
        <div className="flex justify-center mt-2">
          <svg 
            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
};