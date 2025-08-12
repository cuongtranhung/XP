/**
 * Notification WebSocket Handler
 * Real-time notification delivery and updates
 */

import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import redisClient from '../config/redis';
import { authenticate } from '../middleware/auth';
import notificationService from '../services/notificationService';
import notificationAnalyticsService from '../services/notificationAnalyticsService';
import inAppNotificationChannel from '../services/channels/inAppNotificationChannel';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: any;
}

interface NotificationRoom {
  roomId: string;
  userId: string;
  sockets: Set<string>;
  createdAt: Date;
  lastActivity: Date;
}

/**
 * Notification WebSocket Manager
 */
class NotificationWebSocketManager {
  private io: Server | null = null;
  private userRooms = new Map<string, NotificationRoom>();
  private socketToUser = new Map<string, string>();
  private reconnectTimers = new Map<string, NodeJS.Timeout>();
  
  /**
   * Initialize WebSocket server
   */
  initialize(io: Server): void {
    this.io = io;
    
    // Create notification namespace
    const notificationNamespace = io.of('/notifications');
    
    // Authentication middleware
    notificationNamespace.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
        
        if (!token) {
          return next(new Error('Authentication required'));
        }
        
        // Verify token (implementation depends on your auth system)
        const user = await this.verifyToken(token);
        
        if (!user) {
          return next(new Error('Invalid token'));
        }
        
        socket.userId = user.id;
        socket.user = user;
        
        next();
      } catch (error) {
        logger.error('WebSocket authentication failed', { error });
        next(new Error('Authentication failed'));
      }
    });
    
    // Connection handler
    notificationNamespace.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });
    
    // Subscribe to Redis pub/sub for cross-server communication
    this.setupRedisPubSub();
    
    logger.info('✅ Notification WebSocket initialized');
  }
  
  /**
   * Handle new socket connection
   */
  private handleConnection(socket: AuthenticatedSocket): void {
    const userId = socket.userId!;
    
    logger.info('User connected to notifications', { 
      userId, 
      socketId: socket.id 
    });
    
    // Join user room
    this.joinUserRoom(socket, userId);
    
    // Send pending notifications
    this.sendPendingNotifications(socket, userId);
    
    // Setup event handlers
    this.setupSocketHandlers(socket);
    
    // Track connection
    this.trackConnection(userId, socket.id);
    
    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });
  }
  
  /**
   * Join user to their notification room
   */
  private joinUserRoom(socket: AuthenticatedSocket, userId: string): void {
    const roomId = `user:${userId}`;
    
    // Get or create room
    let room = this.userRooms.get(userId);
    
    if (!room) {
      room = {
        roomId,
        userId,
        sockets: new Set(),
        createdAt: new Date(),
        lastActivity: new Date()
      };
      this.userRooms.set(userId, room);
    }
    
    // Add socket to room
    room.sockets.add(socket.id);
    room.lastActivity = new Date();
    
    // Join socket.io room
    socket.join(roomId);
    
    // Map socket to user
    this.socketToUser.set(socket.id, userId);
    
    // Emit connection status
    socket.emit('connected', {
      userId,
      roomId,
      timestamp: new Date()
    });
  }
  
  /**
   * Setup socket event handlers
   */
  private setupSocketHandlers(socket: AuthenticatedSocket): void {
    const userId = socket.userId!;
    
    // Mark notification as read
    socket.on('notification:read', async (data: { notificationId: string }) => {
      try {
        const success = await notificationService.markAsRead(
          data.notificationId,
          userId
        );
        
        if (success) {
          // Track analytics
          await notificationAnalyticsService.trackEvent({
            eventId: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            eventType: 'opened',
            notificationId: data.notificationId,
            userId,
            timestamp: new Date()
          });
          
          // Emit success
          socket.emit('notification:read:success', {
            notificationId: data.notificationId,
            timestamp: new Date()
          });
          
          // Update badge count
          await this.updateBadgeCount(socket, userId);
        } else {
          socket.emit('notification:read:error', {
            notificationId: data.notificationId,
            error: 'Failed to mark as read'
          });
        }
      } catch (error) {
        logger.error('Failed to mark notification as read', { error });
        socket.emit('notification:read:error', {
          notificationId: data.notificationId,
          error: 'Internal error'
        });
      }
    });
    
    // Mark all notifications as read
    socket.on('notification:readAll', async () => {
      try {
        const count = await notificationService.markAllAsRead(userId);
        
        socket.emit('notification:readAll:success', {
          count,
          timestamp: new Date()
        });
        
        // Update badge count
        await this.updateBadgeCount(socket, userId);
        
      } catch (error) {
        logger.error('Failed to mark all notifications as read', { error });
        socket.emit('notification:readAll:error', {
          error: 'Failed to mark all as read'
        });
      }
    });
    
    // Delete notification
    socket.on('notification:delete', async (data: { notificationId: string }) => {
      try {
        const success = await notificationService.deleteNotification(
          data.notificationId,
          userId
        );
        
        if (success) {
          socket.emit('notification:delete:success', {
            notificationId: data.notificationId,
            timestamp: new Date()
          });
          
          // Update badge count
          await this.updateBadgeCount(socket, userId);
        } else {
          socket.emit('notification:delete:error', {
            notificationId: data.notificationId,
            error: 'Failed to delete'
          });
        }
      } catch (error) {
        logger.error('Failed to delete notification', { error });
        socket.emit('notification:delete:error', {
          notificationId: data.notificationId,
          error: 'Internal error'
        });
      }
    });
    
    // Get notifications
    socket.on('notification:fetch', async (data: { 
      limit?: number; 
      offset?: number;
      status?: string;
    }) => {
      try {
        const notifications = await notificationService.getUserNotifications(
          userId,
          { status: data.status as any },
          { 
            limit: data.limit || 50, 
            offset: data.offset || 0 
          }
        );
        
        socket.emit('notification:fetch:success', {
          notifications,
          timestamp: new Date()
        });
        
      } catch (error) {
        logger.error('Failed to fetch notifications', { error });
        socket.emit('notification:fetch:error', {
          error: 'Failed to fetch notifications'
        });
      }
    });
    
    // Get badge count
    socket.on('notification:badge', async () => {
      try {
        const count = await inAppNotificationChannel.getBadgeCount(userId);
        
        socket.emit('notification:badge:update', {
          count,
          timestamp: new Date()
        });
        
      } catch (error) {
        logger.error('Failed to get badge count', { error });
        socket.emit('notification:badge:error', {
          error: 'Failed to get badge count'
        });
      }
    });
    
    // Subscribe to specific notification types
    socket.on('notification:subscribe', (data: { types?: string[] }) => {
      if (data.types && Array.isArray(data.types)) {
        data.types.forEach(type => {
          socket.join(`type:${type}`);
        });
        
        socket.emit('notification:subscribe:success', {
          types: data.types,
          timestamp: new Date()
        });
      }
    });
    
    // Unsubscribe from notification types
    socket.on('notification:unsubscribe', (data: { types?: string[] }) => {
      if (data.types && Array.isArray(data.types)) {
        data.types.forEach(type => {
          socket.leave(`type:${type}`);
        });
        
        socket.emit('notification:unsubscribe:success', {
          types: data.types,
          timestamp: new Date()
        });
      }
    });
    
    // Acknowledge notification received
    socket.on('notification:ack', async (data: { notificationId: string }) => {
      try {
        // Track delivery
        await notificationAnalyticsService.trackEvent({
          eventId: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          eventType: 'delivered',
          notificationId: data.notificationId,
          userId,
          channel: 'in-app',
          timestamp: new Date()
        });
        
        socket.emit('notification:ack:success', {
          notificationId: data.notificationId,
          timestamp: new Date()
        });
        
      } catch (error) {
        logger.error('Failed to acknowledge notification', { error });
      }
    });
    
    // Handle notification click
    socket.on('notification:click', async (data: { 
      notificationId: string;
      action?: string;
      url?: string;
    }) => {
      try {
        // Track click event
        await notificationAnalyticsService.trackEvent({
          eventId: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          eventType: 'clicked',
          notificationId: data.notificationId,
          userId,
          channel: 'in-app',
          timestamp: new Date(),
          metadata: {
            action: data.action,
            url: data.url
          }
        });
        
        socket.emit('notification:click:success', {
          notificationId: data.notificationId,
          timestamp: new Date()
        });
        
      } catch (error) {
        logger.error('Failed to track notification click', { error });
      }
    });
    
    // Heartbeat
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() });
    });
  }
  
  /**
   * Send pending notifications to user
   */
  private async sendPendingNotifications(
    socket: AuthenticatedSocket, 
    userId: string
  ): Promise<void> {
    try {
      // Get unread notifications
      const notifications = await notificationService.getUserNotifications(
        userId,
        { status: 'delivered' },
        { limit: 20, offset: 0 }
      );
      
      if (notifications.length > 0) {
        socket.emit('notification:pending', {
          notifications,
          count: notifications.length,
          timestamp: new Date()
        });
      }
      
      // Send badge count
      const badgeCount = await inAppNotificationChannel.getBadgeCount(userId);
      socket.emit('notification:badge:update', {
        count: badgeCount,
        timestamp: new Date()
      });
      
    } catch (error) {
      logger.error('Failed to send pending notifications', { error, userId });
    }
  }
  
  /**
   * Update badge count for user
   */
  private async updateBadgeCount(
    socket: AuthenticatedSocket,
    userId: string
  ): Promise<void> {
    try {
      const count = await inAppNotificationChannel.getBadgeCount(userId);
      
      // Emit to specific socket
      socket.emit('notification:badge:update', {
        count,
        timestamp: new Date()
      });
      
      // Emit to all user's sockets
      const room = this.userRooms.get(userId);
      if (room && this.io) {
        this.io.of('/notifications').to(room.roomId).emit('notification:badge:update', {
          count,
          timestamp: new Date()
        });
      }
      
    } catch (error) {
      logger.error('Failed to update badge count', { error, userId });
    }
  }
  
  /**
   * Handle socket disconnection
   */
  private handleDisconnection(socket: AuthenticatedSocket): void {
    const userId = this.socketToUser.get(socket.id);
    
    if (!userId) return;
    
    logger.info('User disconnected from notifications', {
      userId,
      socketId: socket.id
    });
    
    // Remove socket from room
    const room = this.userRooms.get(userId);
    if (room) {
      room.sockets.delete(socket.id);
      room.lastActivity = new Date();
      
      // Remove room if no more sockets
      if (room.sockets.size === 0) {
        // Set reconnect timer
        const timer = setTimeout(() => {
          this.userRooms.delete(userId);
          this.reconnectTimers.delete(userId);
        }, 30000); // 30 seconds grace period
        
        this.reconnectTimers.set(userId, timer);
      }
    }
    
    // Remove socket mapping
    this.socketToUser.delete(socket.id);
    
    // Track disconnection
    this.trackDisconnection(userId, socket.id);
  }
  
  /**
   * Send notification to user
   */
  async sendNotificationToUser(
    userId: string,
    notification: any
  ): Promise<boolean> {
    try {
      if (!this.io) {
        logger.warn('WebSocket server not initialized');
        return false;
      }
      
      const room = this.userRooms.get(userId);
      
      if (!room || room.sockets.size === 0) {
        logger.debug('User not connected', { userId });
        return false;
      }
      
      // Clear reconnect timer if exists
      const timer = this.reconnectTimers.get(userId);
      if (timer) {
        clearTimeout(timer);
        this.reconnectTimers.delete(userId);
      }
      
      // Emit notification to user's room
      this.io.of('/notifications').to(room.roomId).emit('notification:new', {
        notification,
        timestamp: new Date()
      });
      
      // Update badge count
      const badgeCount = await inAppNotificationChannel.getBadgeCount(userId);
      this.io.of('/notifications').to(room.roomId).emit('notification:badge:update', {
        count: badgeCount,
        timestamp: new Date()
      });
      
      // Track delivery
      await notificationAnalyticsService.trackEvent({
        eventId: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        eventType: 'sent',
        notificationId: notification.notificationId,
        userId,
        channel: 'in-app',
        timestamp: new Date()
      });
      
      return true;
      
    } catch (error) {
      logger.error('Failed to send notification via WebSocket', { error, userId });
      return false;
    }
  }
  
  /**
   * Broadcast notification to multiple users
   */
  async broadcastNotification(
    userIds: string[],
    notification: any
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;
    
    for (const userId of userIds) {
      const success = await this.sendNotificationToUser(userId, notification);
      if (success) {
        sent++;
      } else {
        failed++;
      }
    }
    
    return { sent, failed };
  }
  
  /**
   * Setup Redis pub/sub for cross-server communication
   */
  private setupRedisPubSub(): void {
    // Subscribe to notification channel
    redisClient.subscribe('notifications', (err) => {
      if (err) {
        logger.error('Failed to subscribe to Redis channel', { err });
      } else {
        logger.info('Subscribed to Redis notifications channel');
      }
    });
    
    // Handle messages
    redisClient.on('message', async (channel, message) => {
      if (channel === 'notifications') {
        try {
          const data = JSON.parse(message);
          
          if (data.type === 'notification:new') {
            await this.sendNotificationToUser(data.userId, data.notification);
          } else if (data.type === 'notification:broadcast') {
            await this.broadcastNotification(data.userIds, data.notification);
          }
          
        } catch (error) {
          logger.error('Failed to process Redis message', { error });
        }
      }
    });
  }
  
  /**
   * Track connection analytics
   */
  private async trackConnection(userId: string, socketId: string): Promise<void> {
    try {
      await redisClient.hset(
        `ws:connections:${userId}`,
        socketId,
        JSON.stringify({
          connectedAt: new Date(),
          lastActivity: new Date()
        })
      );
    } catch (error) {
      logger.error('Failed to track connection', { error });
    }
  }
  
  /**
   * Track disconnection analytics
   */
  private async trackDisconnection(userId: string, socketId: string): Promise<void> {
    try {
      await redisClient.hdel(`ws:connections:${userId}`, socketId);
    } catch (error) {
      logger.error('Failed to track disconnection', { error });
    }
  }
  
  /**
   * Verify authentication token
   */
  private async verifyToken(token: string): Promise<any> {
    // Implementation depends on your auth system
    // This is a placeholder
    try {
      // Verify JWT token
      // const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // return decoded;
      
      // For now, return mock user
      return {
        id: 'user_123',
        email: 'user@example.com',
        roles: ['user']
      };
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalRooms: number;
    totalSockets: number;
    users: Array<{
      userId: string;
      socketCount: number;
      lastActivity: Date;
    }>;
  } {
    const users = Array.from(this.userRooms.entries()).map(([userId, room]) => ({
      userId,
      socketCount: room.sockets.size,
      lastActivity: room.lastActivity
    }));
    
    const totalSockets = users.reduce((sum, user) => sum + user.socketCount, 0);
    
    return {
      totalRooms: this.userRooms.size,
      totalSockets,
      users
    };
  }
  
  /**
   * Cleanup inactive connections
   */
  cleanupInactiveConnections(): void {
    const now = Date.now();
    const inactivityThreshold = 30 * 60 * 1000; // 30 minutes
    
    for (const [userId, room] of this.userRooms.entries()) {
      if (room.sockets.size === 0) {
        const inactiveTime = now - room.lastActivity.getTime();
        
        if (inactiveTime > inactivityThreshold) {
          this.userRooms.delete(userId);
          logger.info('Removed inactive room', { userId });
        }
      }
    }
  }
}

// Export singleton instance
export const notificationWebSocketManager = new NotificationWebSocketManager();
export default notificationWebSocketManager;