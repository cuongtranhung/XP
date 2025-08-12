import React, { useState, useEffect } from 'react';
import { useNotifications } from '../../contexts/NotificationContext'; // Real implementation
import { Button } from '../common/Button';
import { Bell } from '../icons';

interface NotificationCenterProps {
  className?: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ className }) => {
  const { 
    notifications, 
    unreadCount, 
    loading, 
    isConnected, 
    markAsRead, 
    markAllAsRead, 
    clearNotifications,
    deleteNotification,
    fetchNotifications 
  } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  // Auto-refresh notifications when panel opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'email': return '📧';
      case 'sms': return '💬';
      case 'push': return '🔔';
      case 'in-app': return '📱';
      case 'system': return '⚙️';
      case 'marketing': return '📢';
      case 'transactional': return '📋';
      default: return '🔔';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'border-l-red-500 bg-red-50';
      case 'high': return 'border-l-orange-500 bg-orange-50';
      case 'medium': return 'border-l-blue-500 bg-blue-50';
      case 'low': return 'border-l-gray-500 bg-gray-50';
      default: return 'border-l-gray-500 bg-gray-50';
    }
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return time.toLocaleDateString('vi-VN');
  };

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md transition-all duration-200 ${
          unreadCount > 0 ? 'text-blue-600 hover:text-blue-700' : ''
        } ${isOpen ? 'bg-gray-100' : ''}`}
      >
        <span className="sr-only">Xem thông báo</span>
        <Bell className={`h-5 w-5 transition-transform duration-200 ${
          unreadCount > 0 ? 'animate-pulse' : ''
        } ${isOpen ? 'scale-110' : 'hover:scale-105'}`} />
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium shadow-sm ring-2 ring-white animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        
        {/* Connection Status Indicator */}
        <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
          isConnected ? 'bg-green-400' : 'bg-red-400 animate-ping'
        }`}></span>
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Thông báo ({unreadCount})
              </h3>
              <div className="flex items-center space-x-2">
                <div className={`flex items-center text-xs ${
                  isConnected ? 'text-green-600' : 'text-red-600'
                }`}>
                  <span className={`h-2 w-2 rounded-full mr-1 ${
                    isConnected ? 'bg-green-400' : 'bg-red-400'
                  }`}></span>
                  {isConnected ? 'Kết nối' : 'Mất kết nối'}
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Actions */}
            {notifications.length > 0 && (
              <div className="mt-3 flex space-x-2">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={markAllAsRead}
                  disabled={unreadCount === 0 || loading}
                >
                  {loading ? 'Loading...' : 'Đánh dấu đã đọc'}
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={clearNotifications}
                  disabled={loading}
                >
                  Xóa tất cả
                </Button>
              </div>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <div className="text-sm text-gray-500">Loading notifications...</div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Bell className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                <div className="text-sm">Chưa có thông báo nào</div>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    !notification.read 
                      ? `border-l-4 ${getPriorityColor(notification.priority || 'medium')}` 
                      : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="text-xl flex-shrink-0">{getNotificationIcon(notification.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900 mb-1">
                            {notification.title}
                          </div>
                          <div className="text-sm text-gray-600 mb-2">
                            {notification.message}
                          </div>
                          <div className="flex items-center space-x-2 text-xs text-gray-400">
                            <span>{formatRelativeTime(notification.timestamp)}</span>
                            <span>•</span>
                            <span className="capitalize">{notification.type}</span>
                            {notification.priority && (
                              <>
                                <span>•</span>
                                <span className={`capitalize ${
                                  notification.priority === 'critical' ? 'text-red-600' :
                                  notification.priority === 'high' ? 'text-orange-600' :
                                  notification.priority === 'medium' ? 'text-blue-600' :
                                  'text-gray-500'
                                }`}>
                                  {notification.priority}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-2">
                          {!notification.read && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                              className="text-blue-600 hover:text-blue-800 text-xs"
                              title="Mark as read"
                            >
                              ✓
                            </button>
                          )}
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            className="text-gray-400 hover:text-red-600 text-xs"
                            title="Delete"
                          >
                            ✕
                          </button>
                          
                          {!notification.read && (
                            <div className="flex-shrink-0">
                              <span className="inline-block h-2 w-2 bg-blue-500 rounded-full"></span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-200 text-center">
            <button 
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              onClick={() => {
                window.location.href = '/notification-dashboard';
              }}
            >
              📊 Xem tất cả thông báo
            </button>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        ></div>
      )}
    </div>
  );
};

export default NotificationCenter;