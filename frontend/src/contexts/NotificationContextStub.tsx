import React, { createContext, useContext } from 'react';

// STUB NOTIFICATION CONTEXT
// This is a temporary stub to prevent errors while the real notification system is disabled
// The real NotificationContext has a bug connecting to non-existent /api/notifications/stream

interface NotificationEvent {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
}

interface NotificationContextType {
  notifications: NotificationEvent[];
  unreadCount: number;
  isConnected: boolean;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Stub implementation - no real functionality
  const stubValue: NotificationContextType = {
    notifications: [],
    unreadCount: 0,
    isConnected: false,
    markAsRead: () => {},
    markAllAsRead: () => {},
    clearNotifications: () => {}
  };

  return (
    <NotificationContext.Provider value={stubValue}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    // Return stub value instead of throwing error
    return {
      notifications: [],
      unreadCount: 0,
      isConnected: false,
      markAsRead: () => {},
      markAllAsRead: () => {},
      clearNotifications: () => {}
    };
  }
  return context;
};

export default NotificationProvider;