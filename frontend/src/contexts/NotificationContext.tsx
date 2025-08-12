import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { apiService } from '../services/api';
import { useAuth } from './AuthContext';
import { notificationWebSocketService, ConnectionStatus, NotificationCallbacks } from '../services/notificationWebSocketService';
import { logger } from '../utils/logger';

export interface NotificationEvent {
  id: string;
  userId: string;
  type: 'email' | 'sms' | 'push' | 'in-app' | 'system' | 'marketing' | 'transactional';
  title: string;
  message: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  channels: ('email' | 'sms' | 'push' | 'in-app')[];
  metadata?: Record<string, any>;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'read' | 'archived';
  createdAt: string;
  readAt?: string;
  read: boolean;
  timestamp: string; // For compatibility with existing components
}

export interface NotificationPreferences {
  channels: {
    email: boolean;
    sms: boolean;
    push: boolean;
    'in-app': boolean;
  };
  types: {
    system: boolean;
    marketing: boolean;
    transactional: boolean;
  };
  quiet_hours?: {
    enabled: boolean;
    start: string; // HH:mm format
    end: string;   // HH:mm format
  };
  frequency: {
    email: 'immediate' | 'hourly' | 'daily' | 'weekly';
    push: 'immediate' | 'hourly' | 'daily';
  };
  language: string;
  timezone: string;
}

interface NotificationContextType {
  // Notifications
  notifications: NotificationEvent[];
  unreadCount: number;
  loading: boolean;
  
  // Connection status
  isConnected: boolean;
  
  // Actions
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  clearNotifications: () => Promise<void>;
  
  // Preferences
  preferences: NotificationPreferences | null;
  fetchPreferences: () => Promise<void>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
  
  // Send notifications
  sendNotification: (notification: {
    type: NotificationEvent['type'];
    title: string;
    message: string;
    priority?: NotificationEvent['priority'];
    channels?: NotificationEvent['channels'];
    metadata?: Record<string, any>;
    userId?: string;
  }) => Promise<void>;
  
  // Test notifications
  sendTestNotification: (channel: 'email' | 'sms' | 'push' | 'in-app') => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const { user, isAuthenticated, token } = useAuth();
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    connecting: false,
    reconnectAttempts: 0
  });

  // Feature flag: Use WebSocket or fallback to HTTP polling
  const useWebSocket = process.env.REACT_APP_USE_WEBSOCKET !== 'false';

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  // Test API connection
  const testConnection = useCallback(async () => {
    try {
      const response = await fetch('/api/health');
      setIsConnected(response.ok);
    } catch (error) {
      setIsConnected(false);
    }
  }, []);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    // Only fetch if user is authenticated
    if (!isAuthenticated) {
      setNotifications([]);
      return;
    }
    
    try {
      setLoading(true);
      const response = await apiService.get('/api/notifications', {
        params: {
          limit: 50,
          offset: 0
        }
      });
      
      if (response.success && response.notifications) {
        const formattedNotifications = response.notifications.map((notif: any) => ({
          ...notif,
          read: notif.status === 'read' || notif.readAt != null,
          timestamp: notif.createdAt || new Date().toISOString()
        }));
        
        setNotifications(formattedNotifications);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      // Only show error toast if user is authenticated
      if (isAuthenticated) {
        toast.error('Failed to load notifications');
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      if (useWebSocket && connectionStatus.connected) {
        // Use WebSocket for real-time updates
        await notificationWebSocketService.markAsRead(notificationId);
        
        // Update local state immediately for responsive UI
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === notificationId 
              ? { ...notif, read: true, status: 'read' as const, readAt: new Date().toISOString() }
              : notif
          )
        );
      } else {
        // Fallback to API call
        const response = await apiService.put(`/api/notifications/${notificationId}/read`);
        
        if (response.success) {
          setNotifications(prev => 
            prev.map(notif => 
              notif.id === notificationId 
                ? { ...notif, read: true, status: 'read' as const, readAt: new Date().toISOString() }
                : notif
            )
          );
        }
      }
    } catch (error) {
      logger.error('Failed to mark notification as read', { error, notificationId });
      toast.error('Failed to mark as read');
    }
  }, [useWebSocket, connectionStatus.connected]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      if (useWebSocket && connectionStatus.connected) {
        // Use WebSocket for real-time updates
        const count = await notificationWebSocketService.markAllAsRead();
        
        // Update local state immediately
        setNotifications(prev => 
          prev.map(notif => ({ 
            ...notif, 
            read: true, 
            status: 'read' as const,
            readAt: new Date().toISOString()
          }))
        );
        toast.success(`${count} notifications marked as read`);
      } else {
        // Fallback to API call
        const response = await apiService.put('/api/notifications/read-all');
        
        if (response.success) {
          setNotifications(prev => 
            prev.map(notif => ({ 
              ...notif, 
              read: true, 
              status: 'read' as const,
              readAt: new Date().toISOString()
            }))
          );
          toast.success(`${response.count || 0} notifications marked as read`);
        }
      }
    } catch (error) {
      logger.error('Failed to mark all as read', { error });
      toast.error('Failed to mark all as read');
    }
  }, [useWebSocket, connectionStatus.connected]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      if (useWebSocket && connectionStatus.connected) {
        // Use WebSocket for real-time updates
        await notificationWebSocketService.deleteNotification(notificationId);
        
        // Update local state immediately
        setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
        toast.success('Notification deleted');
      } else {
        // Fallback to API call
        const response = await apiService.delete(`/api/notifications/${notificationId}`);
        
        if (response.success) {
          setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
          toast.success('Notification deleted');
        }
      }
    } catch (error) {
      logger.error('Failed to delete notification', { error, notificationId });
      toast.error('Failed to delete notification');
    }
  }, [useWebSocket, connectionStatus.connected]);

  // Clear all notifications
  const clearNotifications = useCallback(async () => {
    try {
      // Delete each notification individually since we don't have bulk delete
      const promises = notifications.map(notif => deleteNotification(notif.id));
      await Promise.all(promises);
      setNotifications([]);
      toast.success('All notifications cleared');
    } catch (error) {
      console.error('Failed to clear notifications:', error);
      toast.error('Failed to clear notifications');
    }
  }, [notifications, deleteNotification]);

  // Fetch user preferences
  const fetchPreferences = useCallback(async () => {
    // Only fetch if user is authenticated
    if (!isAuthenticated) {
      setPreferences(null);
      return;
    }
    
    try {
      const response = await apiService.get('/api/notifications/preferences');
      
      if (response.success && response.preferences) {
        setPreferences(response.preferences);
      }
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
      // Set default preferences if API fails
      setPreferences({
        channels: {
          email: true,
          sms: false,
          push: true,
          'in-app': true
        },
        types: {
          system: true,
          marketing: false,
          transactional: true
        },
        frequency: {
          email: 'immediate',
          push: 'immediate'
        },
        language: 'en',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
    }
  }, [isAuthenticated]);

  // Update preferences
  const updatePreferences = useCallback(async (prefs: Partial<NotificationPreferences>) => {
    try {
      const response = await apiService.put('/api/notifications/preferences', prefs);
      
      if (response.success && response.preferences) {
        setPreferences(response.preferences);
        toast.success('Notification preferences updated');
      }
    } catch (error) {
      console.error('Failed to update preferences:', error);
      toast.error('Failed to update preferences');
    }
  }, []);

  // Send notification
  const sendNotification = useCallback(async (notification: {
    type: NotificationEvent['type'];
    title: string;
    message: string;
    priority?: NotificationEvent['priority'];
    channels?: NotificationEvent['channels'];
    metadata?: Record<string, any>;
    userId?: string;
  }) => {
    try {
      const response = await apiService.post('/api/notifications', notification);
      
      if (response.success) {
        toast.success('Notification sent successfully');
        // Refresh notifications to show the new one
        fetchNotifications();
      }
    } catch (error) {
      console.error('Failed to send notification:', error);
      toast.error('Failed to send notification');
    }
  }, [fetchNotifications]);

  // Send test notification
  const sendTestNotification = useCallback(async (channel: 'email' | 'sms' | 'push' | 'in-app') => {
    try {
      const response = await apiService.post('/api/notifications/test', {
        channel,
        template: 'test',
        data: { timestamp: new Date().toISOString() }
      });
      
      if (response.success) {
        toast.success(`Test ${channel} notification sent`);
        // Refresh notifications to show the test notification
        fetchNotifications();
      }
    } catch (error) {
      console.error('Failed to send test notification:', error);
      toast.error(`Failed to send test ${channel} notification`);
    }
  }, [fetchNotifications]);

  // WebSocket callbacks for real-time notifications
  const webSocketCallbacks: NotificationCallbacks = {
    onNotification: (notification: NotificationEvent) => {
      logger.info('New notification received via WebSocket', { notificationId: notification.id });
      
      // Add new notification to state
      setNotifications(prev => {
        // Check if notification already exists to avoid duplicates
        const exists = prev.some(n => n.id === notification.id);
        if (exists) return prev;
        
        // Add to the beginning of the array
        return [notification, ...prev];
      });
      
      // Show toast notification if user prefers
      if (notification.priority === 'critical' || notification.priority === 'high') {
        toast.success(notification.title);
      }
      
      // Acknowledge receipt
      notificationWebSocketService.acknowledgeNotification(notification.id);
    },
    
    onBadgeUpdate: (count: number) => {
      logger.debug('Badge count updated via WebSocket', { count });
      
      // Badge count is automatically calculated from notifications array
      // This ensures consistency between WebSocket updates and local state
    },
    
    onConnectionStatusChange: (status: ConnectionStatus) => {
      logger.info('WebSocket connection status changed', status);
      setConnectionStatus(status);
      setIsConnected(status.connected);
    },
    
    onError: (error: Error) => {
      logger.error('WebSocket error', { error: error.message });
      
      // Don't show toast errors for connection issues to avoid spam
      // The UI will show connection status instead
    }
  };

  // Initialize WebSocket connection when authenticated
  useEffect(() => {
    if (!isAuthenticated || !token || !useWebSocket) {
      return;
    }

    const initializeWebSocket = async () => {
      try {
        logger.info('Initializing WebSocket connection');
        await notificationWebSocketService.connect(token, webSocketCallbacks);
      } catch (error) {
        logger.error('Failed to initialize WebSocket', { error });
        
        // Fall back to HTTP polling on WebSocket failure
        logger.info('Falling back to HTTP polling');
        testConnection();
        fetchNotifications();
        fetchPreferences();
      }
    };

    initializeWebSocket();

    return () => {
      logger.info('Disconnecting WebSocket');
      notificationWebSocketService.disconnect();
    };
  }, [isAuthenticated, token, useWebSocket]);

  // Initialize data on mount - only if authenticated and not using WebSocket
  useEffect(() => {
    if (isAuthenticated && (!useWebSocket || !connectionStatus.connected)) {
      testConnection();
      fetchNotifications();
      fetchPreferences();
    } else if (!isAuthenticated) {
      // Clear data when user logs out
      setNotifications([]);
      setPreferences(null);
      setIsConnected(false);
      setConnectionStatus({
        connected: false,
        connecting: false,
        reconnectAttempts: 0
      });
    }
  }, [isAuthenticated, useWebSocket, connectionStatus.connected, testConnection, fetchNotifications, fetchPreferences]);

  // Set up periodic connection check - only if not using WebSocket or WebSocket is disconnected
  useEffect(() => {
    if (!isAuthenticated || (useWebSocket && connectionStatus.connected)) return;
    
    const interval = setInterval(testConnection, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [isAuthenticated, useWebSocket, connectionStatus.connected, testConnection]);

  // Set up notification polling - only if not using WebSocket or WebSocket is disconnected
  useEffect(() => {
    if (!isAuthenticated || (useWebSocket && connectionStatus.connected)) return;
    
    const interval = setInterval(fetchNotifications, 60000); // Poll every minute
    return () => clearInterval(interval);
  }, [isAuthenticated, useWebSocket, connectionStatus.connected, fetchNotifications]);

  const contextValue: NotificationContextType = {
    notifications,
    unreadCount,
    loading,
    isConnected,
    
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearNotifications,
    
    preferences,
    fetchPreferences,
    updatePreferences,
    
    sendNotification,
    sendTestNotification
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};


export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationProvider;