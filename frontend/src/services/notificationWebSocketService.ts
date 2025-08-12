/**
 * Notification WebSocket Service
 * Real-time notification delivery client with auto-reconnection
 * Replaces HTTP polling with WebSocket events
 */

import { io, Socket } from 'socket.io-client';
import { logger } from '../utils/logger';
import { NotificationEvent } from '../contexts/NotificationContext';

export interface WebSocketConfig {
  url: string;
  namespace: string;
  auth: {
    token: string;
  };
  reconnection: boolean;
  reconnectionAttempts: number;
  reconnectionDelay: number;
  timeout: number;
}

export interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  error?: string;
  reconnectAttempts: number;
  lastConnectedAt?: Date;
  lastDisconnectedAt?: Date;
}

export interface NotificationCallbacks {
  onNotification?: (notification: NotificationEvent) => void;
  onBadgeUpdate?: (count: number) => void;
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  onError?: (error: Error) => void;
}

/**
 * WebSocket Service for Real-time Notifications
 */
class NotificationWebSocketService {
  private socket: Socket | null = null;
  private config: WebSocketConfig | null = null;
  private callbacks: NotificationCallbacks = {};
  private connectionStatus: ConnectionStatus = {
    connected: false,
    connecting: false,
    reconnectAttempts: 0
  };
  
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isManualDisconnect = false;

  /**
   * Initialize WebSocket connection
   */
  async connect(token: string, callbacks: NotificationCallbacks = {}): Promise<void> {
    if (this.socket?.connected) {
      logger.info('WebSocket already connected');
      return;
    }

    this.callbacks = callbacks;
    this.isManualDisconnect = false;

    // Configuration
    this.config = {
      url: process.env.REACT_APP_WS_URL || window.location.origin,
      namespace: '/notifications',
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    };

    try {
      this.updateConnectionStatus({ connecting: true });
      
      // Create Socket.io connection to notifications namespace
      this.socket = io(`${this.config.url}${this.config.namespace}`, {
        auth: this.config.auth,
        reconnection: false, // Handle reconnection manually for better control
        timeout: this.config.timeout,
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true
      });

      this.setupEventHandlers();
      
      logger.info('WebSocket connection initiated', {
        url: `${this.config.url}${this.config.namespace}`,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown connection error';
      logger.error('Failed to create WebSocket connection', { error: errorMessage });
      
      this.updateConnectionStatus({
        connected: false,
        connecting: false,
        error: errorMessage
      });
      
      this.callbacks.onError?.(error instanceof Error ? error : new Error(errorMessage));
      throw error;
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection established
    this.socket.on('connect', () => {
      logger.info('WebSocket connected successfully', {
        socketId: this.socket?.id,
        timestamp: new Date().toISOString()
      });

      this.updateConnectionStatus({
        connected: true,
        connecting: false,
        reconnectAttempts: 0,
        lastConnectedAt: new Date(),
        error: undefined
      });

      this.startHeartbeat();
      this.requestInitialData();
    });

    // Connection error
    this.socket.on('connect_error', (error) => {
      logger.error('WebSocket connection error', { 
        error: error.message,
        timestamp: new Date().toISOString()
      });

      this.updateConnectionStatus({
        connected: false,
        connecting: false,
        error: error.message,
        lastDisconnectedAt: new Date()
      });

      this.callbacks.onError?.(error);
      
      // Attempt reconnection if not manually disconnected
      if (!this.isManualDisconnect) {
        this.scheduleReconnection();
      }
    });

    // Disconnection
    this.socket.on('disconnect', (reason) => {
      logger.info('WebSocket disconnected', { 
        reason,
        timestamp: new Date().toISOString()
      });

      this.updateConnectionStatus({
        connected: false,
        connecting: false,
        lastDisconnectedAt: new Date()
      });

      this.stopHeartbeat();

      // Auto-reconnect unless it was a manual disconnect or server initiated
      if (!this.isManualDisconnect && reason !== 'io server disconnect') {
        this.scheduleReconnection();
      }
    });

    // Authentication success
    this.socket.on('connected', (data) => {
      logger.info('WebSocket authentication successful', data);
    });

    // New notification received
    this.socket.on('notification:new', (data) => {
      logger.info('New notification received', {
        notificationId: data.notification?.id,
        timestamp: data.timestamp
      });

      if (data.notification) {
        this.callbacks.onNotification?.(data.notification);
      }
    });

    // Badge count update
    this.socket.on('notification:badge:update', (data) => {
      logger.debug('Badge count updated', {
        count: data.count,
        timestamp: data.timestamp
      });

      this.callbacks.onBadgeUpdate?.(data.count);
    });

    // Notification marked as read
    this.socket.on('notification:read:success', (data) => {
      logger.debug('Notification marked as read', {
        notificationId: data.notificationId,
        timestamp: data.timestamp
      });
    });

    // All notifications marked as read
    this.socket.on('notification:readAll:success', (data) => {
      logger.info('All notifications marked as read', {
        count: data.count,
        timestamp: data.timestamp
      });
    });

    // Notification deleted
    this.socket.on('notification:delete:success', (data) => {
      logger.debug('Notification deleted', {
        notificationId: data.notificationId,
        timestamp: data.timestamp
      });
    });

    // Pending notifications received
    this.socket.on('notification:pending', (data) => {
      logger.info('Pending notifications received', {
        count: data.count,
        timestamp: data.timestamp
      });

      // Process pending notifications
      if (data.notifications && Array.isArray(data.notifications)) {
        data.notifications.forEach((notification: NotificationEvent) => {
          this.callbacks.onNotification?.(notification);
        });
      }
    });

    // Heartbeat response
    this.socket.on('pong', (data) => {
      logger.debug('Heartbeat pong received', data);
    });

    // Error handlers
    this.socket.on('notification:read:error', (data) => {
      logger.error('Failed to mark notification as read', data);
      this.callbacks.onError?.(new Error(data.error));
    });

    this.socket.on('notification:delete:error', (data) => {
      logger.error('Failed to delete notification', data);
      this.callbacks.onError?.(new Error(data.error));
    });
  }

  /**
   * Request initial data after connection
   */
  private requestInitialData(): void {
    if (!this.socket?.connected) return;

    // Request badge count
    this.socket.emit('notification:badge');

    // Request recent notifications
    this.socket.emit('notification:fetch', {
      limit: 20,
      offset: 0
    });
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat(); // Clear existing timer

    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
      }
    }, 30000); // Send ping every 30 seconds
  }

  /**
   * Stop heartbeat timer
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnection(): void {
    if (this.reconnectTimer || this.isManualDisconnect) return;

    const maxAttempts = this.config?.reconnectionAttempts || 5;
    if (this.connectionStatus.reconnectAttempts >= maxAttempts) {
      logger.error('Max reconnection attempts reached', {
        attempts: this.connectionStatus.reconnectAttempts,
        maxAttempts
      });
      return;
    }

    const delay = Math.min(
      1000 * Math.pow(2, this.connectionStatus.reconnectAttempts),
      30000 // Max 30 seconds
    );

    logger.info('Scheduling reconnection', {
      attempt: this.connectionStatus.reconnectAttempts + 1,
      delay: delay,
      timestamp: new Date().toISOString()
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.attemptReconnection();
    }, delay);
  }

  /**
   * Attempt to reconnect
   */
  private async attemptReconnection(): Promise<void> {
    if (this.isManualDisconnect || !this.config) return;

    this.connectionStatus.reconnectAttempts++;
    
    logger.info('Attempting reconnection', {
      attempt: this.connectionStatus.reconnectAttempts,
      timestamp: new Date().toISOString()
    });

    try {
      // Clean up existing socket
      this.cleanup();

      // Attempt new connection
      await this.connect(this.config.auth.token, this.callbacks);
      
    } catch (error) {
      logger.error('Reconnection failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        attempt: this.connectionStatus.reconnectAttempts
      });

      // Schedule next attempt
      this.scheduleReconnection();
    }
  }

  /**
   * Update connection status and notify callbacks
   */
  private updateConnectionStatus(updates: Partial<ConnectionStatus>): void {
    this.connectionStatus = { ...this.connectionStatus, ...updates };
    this.callbacks.onConnectionStatusChange?.(this.connectionStatus);
  }

  /**
   * Mark notification as read
   */
  markAsRead(notificationId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      // Set up one-time listeners for response
      const successHandler = (data: any) => {
        if (data.notificationId === notificationId) {
          this.socket?.off('notification:read:success', successHandler);
          this.socket?.off('notification:read:error', errorHandler);
          resolve();
        }
      };

      const errorHandler = (data: any) => {
        if (data.notificationId === notificationId) {
          this.socket?.off('notification:read:success', successHandler);
          this.socket?.off('notification:read:error', errorHandler);
          reject(new Error(data.error || 'Failed to mark as read'));
        }
      };

      this.socket.on('notification:read:success', successHandler);
      this.socket.on('notification:read:error', errorHandler);

      // Send the request
      this.socket.emit('notification:read', { notificationId });

      // Timeout after 5 seconds
      setTimeout(() => {
        this.socket?.off('notification:read:success', successHandler);
        this.socket?.off('notification:read:error', errorHandler);
        reject(new Error('Request timeout'));
      }, 5000);
    });
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead(): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      // Set up one-time listeners for response
      const successHandler = (data: any) => {
        this.socket?.off('notification:readAll:success', successHandler);
        this.socket?.off('notification:readAll:error', errorHandler);
        resolve(data.count || 0);
      };

      const errorHandler = (data: any) => {
        this.socket?.off('notification:readAll:success', successHandler);
        this.socket?.off('notification:readAll:error', errorHandler);
        reject(new Error(data.error || 'Failed to mark all as read'));
      };

      this.socket.on('notification:readAll:success', successHandler);
      this.socket.on('notification:readAll:error', errorHandler);

      // Send the request
      this.socket.emit('notification:readAll');

      // Timeout after 5 seconds
      setTimeout(() => {
        this.socket?.off('notification:readAll:success', successHandler);
        this.socket?.off('notification:readAll:error', errorHandler);
        reject(new Error('Request timeout'));
      }, 5000);
    });
  }

  /**
   * Delete notification
   */
  deleteNotification(notificationId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      // Set up one-time listeners for response
      const successHandler = (data: any) => {
        if (data.notificationId === notificationId) {
          this.socket?.off('notification:delete:success', successHandler);
          this.socket?.off('notification:delete:error', errorHandler);
          resolve();
        }
      };

      const errorHandler = (data: any) => {
        if (data.notificationId === notificationId) {
          this.socket?.off('notification:delete:success', successHandler);
          this.socket?.off('notification:delete:error', errorHandler);
          reject(new Error(data.error || 'Failed to delete notification'));
        }
      };

      this.socket.on('notification:delete:success', successHandler);
      this.socket.on('notification:delete:error', errorHandler);

      // Send the request
      this.socket.emit('notification:delete', { notificationId });

      // Timeout after 5 seconds
      setTimeout(() => {
        this.socket?.off('notification:delete:success', successHandler);
        this.socket?.off('notification:delete:error', errorHandler);
        reject(new Error('Request timeout'));
      }, 5000);
    });
  }

  /**
   * Subscribe to specific notification types
   */
  subscribeToTypes(types: string[]): void {
    if (!this.socket?.connected) return;

    this.socket.emit('notification:subscribe', { types });
    logger.info('Subscribed to notification types', { types });
  }

  /**
   * Unsubscribe from notification types
   */
  unsubscribeFromTypes(types: string[]): void {
    if (!this.socket?.connected) return;

    this.socket.emit('notification:unsubscribe', { types });
    logger.info('Unsubscribed from notification types', { types });
  }

  /**
   * Acknowledge notification received
   */
  acknowledgeNotification(notificationId: string): void {
    if (!this.socket?.connected) return;

    this.socket.emit('notification:ack', { notificationId });
  }

  /**
   * Track notification click
   */
  trackNotificationClick(notificationId: string, action?: string, url?: string): void {
    if (!this.socket?.connected) return;

    this.socket.emit('notification:click', {
      notificationId,
      action,
      url
    });
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get socket ID
   */
  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    logger.info('Manual WebSocket disconnect initiated');
    
    this.isManualDisconnect = true;
    this.cleanup();
    
    this.updateConnectionStatus({
      connected: false,
      connecting: false,
      lastDisconnectedAt: new Date()
    });
  }

  /**
   * Clean up WebSocket connection and timers
   */
  private cleanup(): void {
    // Clear timers
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Disconnect socket
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Update authentication token
   */
  updateAuthToken(token: string): void {
    if (this.config) {
      this.config.auth.token = token;
      
      // Reconnect with new token if currently connected
      if (this.socket?.connected) {
        this.disconnect();
        setTimeout(() => {
          this.connect(token, this.callbacks);
        }, 1000);
      }
    }
  }
}

// Export singleton instance
export const notificationWebSocketService = new NotificationWebSocketService();
export default notificationWebSocketService;