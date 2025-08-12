/**
 * WebSocket Service for Real-time Cache Updates
 * Provides WebSocket connectivity for real-time cache event broadcasting
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import realTimeCacheService, { CacheUpdateEvent } from './realTimeCacheService';
import { logger } from '../utils/logger';

export interface SocketUser {
  id: string;
  email: string;
  fullName?: string;
  socketId: string;
  connectedAt: Date;
}

export interface CacheSubscriptionSocket {
  userId: string;
  socketId: string;
  entities: string[];
  filters?: {
    entityIds?: string[];
    eventTypes?: string[];
    priority?: string[];
  };
}

/**
 * WebSocket Service for Real-time Communications
 */
class WebSocketService {
  private io: SocketIOServer | null = null;
  private connectedUsers = new Map<string, SocketUser>();
  private userSockets = new Map<string, Set<string>>(); // userId -> Set of socketIds
  private cacheSubscriptions = new Map<string, CacheSubscriptionSocket>();
  private isEnabled = false;

  constructor() {
    // WebSocket will be initialized when server is ready
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server: HttpServer): void {
    try {
      this.io = new SocketIOServer(server, {
        cors: {
          origin: process.env.FRONTEND_URL || 'http://localhost:3001',
          credentials: true
        },
        transports: ['websocket', 'polling']
      });

      this.setupEventHandlers();
      this.setupCacheEventHandlers();
      this.isEnabled = true;

      logger.info('WebSocket service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize WebSocket service', { error });
      this.isEnabled = false;
    }
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Get user connection info
   */
  getUserConnections(userId: string): SocketUser[] {
    const socketIds = this.userSockets.get(userId) || new Set();
    const connections: SocketUser[] = [];

    for (const socketId of socketIds) {
      const user = Array.from(this.connectedUsers.values())
        .find(u => u.socketId === socketId && u.id === userId);
      if (user) {
        connections.push(user);
      }
    }

    return connections;
  }

  /**
   * Send cache update to specific user
   */
  async sendCacheUpdateToUser(userId: string, event: CacheUpdateEvent): Promise<void> {
    if (!this.isEnabled || !this.io) {
      return;
    }

    const socketIds = this.userSockets.get(userId);
    if (!socketIds || socketIds.size === 0) {
      return; // User not connected
    }

    const eventData = {
      type: 'cache_update',
      timestamp: new Date().toISOString(),
      event
    };

    // Send to all user's sockets
    for (const socketId of socketIds) {
      this.io.to(socketId).emit('cache:update', eventData);
    }

    logger.debug('Cache update sent to user via WebSocket', {
      userId,
      socketCount: socketIds.size,
      eventType: event.type,
      entity: event.entity
    });
  }

  /**
   * Broadcast cache update to all subscribed users
   */
  async broadcastCacheUpdate(event: CacheUpdateEvent): Promise<void> {
    if (!this.isEnabled || !this.io) {
      return;
    }

    const eventData = {
      type: 'cache_update',
      timestamp: new Date().toISOString(),
      event
    };

    // Find subscribed users for this entity
    const subscribedSocketIds = Array.from(this.cacheSubscriptions.values())
      .filter(sub => sub.entities.includes(event.entity))
      .filter(sub => this.shouldNotifySubscription(sub, event))
      .map(sub => sub.socketId);

    if (subscribedSocketIds.length > 0) {
      // Emit to subscribed sockets
      for (const socketId of subscribedSocketIds) {
        this.io.to(socketId).emit('cache:update', eventData);
      }

      logger.debug('Cache update broadcasted via WebSocket', {
        eventType: event.type,
        entity: event.entity,
        recipientCount: subscribedSocketIds.length
      });
    }
  }

  /**
   * Send system notification
   */
  async sendSystemNotification(userId: string, notification: {
    type: 'info' | 'warning' | 'error' | 'success';
    title: string;
    message: string;
    data?: any;
  }): Promise<void> {
    if (!this.isEnabled || !this.io) {
      return;
    }

    const socketIds = this.userSockets.get(userId);
    if (!socketIds || socketIds.size === 0) {
      return;
    }

    const eventData = {
      type: 'system_notification',
      timestamp: new Date().toISOString(),
      notification
    };

    for (const socketId of socketIds) {
      this.io.to(socketId).emit('system:notification', eventData);
    }

    logger.debug('System notification sent via WebSocket', {
      userId,
      notificationType: notification.type,
      title: notification.title
    });
  }

  /**
   * Get WebSocket service statistics
   */
  getStats(): {
    enabled: boolean;
    connectedUsers: number;
    totalSockets: number;
    cacheSubscriptions: number;
    uptime: number;
  } {
    const totalSockets = Array.from(this.userSockets.values())
      .reduce((total, sockets) => total + sockets.size, 0);

    return {
      enabled: this.isEnabled,
      connectedUsers: this.connectedUsers.size,
      totalSockets,
      cacheSubscriptions: this.cacheSubscriptions.size,
      uptime: process.uptime()
    };
  }

  // Private helper methods

  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.use(this.authenticateSocket.bind(this));

    this.io.on('connection', (socket) => {
      logger.info('WebSocket client connected', { socketId: socket.id });

      // Handle cache subscription
      socket.on('cache:subscribe', async (data) => {
        await this.handleCacheSubscribe(socket, data);
      });

      // Handle cache unsubscribe
      socket.on('cache:unsubscribe', async (data) => {
        await this.handleCacheUnsubscribe(socket, data);
      });

      // Handle ping for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date().toISOString() });
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.handleDisconnection(socket, reason);
      });
    });
  }

  private async authenticateSocket(socket: any, next: any): Promise<void> {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      const user: SocketUser = {
        id: decoded.userId,
        email: decoded.email,
        fullName: decoded.fullName,
        socketId: socket.id,
        connectedAt: new Date()
      };

      socket.user = user;
      this.connectedUsers.set(socket.id, user);

      // Track user sockets
      if (!this.userSockets.has(user.id)) {
        this.userSockets.set(user.id, new Set());
      }
      this.userSockets.get(user.id)!.add(socket.id);

      logger.info('WebSocket client authenticated', {
        userId: user.id,
        socketId: socket.id,
        email: user.email
      });

      next();
    } catch (error) {
      logger.error('WebSocket authentication failed', { error, socketId: socket.id });
      next(new Error('Authentication failed'));
    }
  }

  private async handleCacheSubscribe(socket: any, data: {
    entities: string[];
    filters?: any;
  }): Promise<void> {
    try {
      const user = socket.user as SocketUser;
      if (!user) {
        socket.emit('cache:subscribe:error', { error: 'User not authenticated' });
        return;
      }

      // Validate entities
      const validEntities = ['user', 'form', 'submission', 'location', 'preference', 'session'];
      const invalidEntities = data.entities.filter(e => !validEntities.includes(e));
      
      if (invalidEntities.length > 0) {
        socket.emit('cache:subscribe:error', { 
          error: `Invalid entities: ${invalidEntities.join(', ')}`,
          validEntities 
        });
        return;
      }

      const subscription: CacheSubscriptionSocket = {
        userId: user.id,
        socketId: socket.id,
        entities: data.entities,
        filters: data.filters
      };

      this.cacheSubscriptions.set(socket.id, subscription);

      // Also subscribe through real-time cache service
      const serviceSubscriptionId = realTimeCacheService.subscribe({
        userId: user.id,
        entities: data.entities,
        filters: data.filters,
        callback: async (event: CacheUpdateEvent) => {
          await this.sendCacheUpdateToUser(user.id, event);
        }
      });

      socket.serviceSubscriptionId = serviceSubscriptionId;

      socket.emit('cache:subscribe:success', {
        entities: data.entities,
        filters: data.filters,
        subscriptionId: serviceSubscriptionId
      });

      logger.info('WebSocket cache subscription created', {
        userId: user.id,
        socketId: socket.id,
        entities: data.entities
      });

    } catch (error) {
      logger.error('Failed to handle cache subscribe', { error });
      socket.emit('cache:subscribe:error', { error: 'Failed to create subscription' });
    }
  }

  private async handleCacheUnsubscribe(socket: any, data: any): Promise<void> {
    try {
      const user = socket.user as SocketUser;
      if (!user) {
        return;
      }

      // Remove from cache subscriptions
      this.cacheSubscriptions.delete(socket.id);

      // Unsubscribe from real-time cache service
      if (socket.serviceSubscriptionId) {
        realTimeCacheService.unsubscribe(socket.serviceSubscriptionId);
      }

      socket.emit('cache:unsubscribe:success');

      logger.info('WebSocket cache subscription removed', {
        userId: user.id,
        socketId: socket.id
      });

    } catch (error) {
      logger.error('Failed to handle cache unsubscribe', { error });
      socket.emit('cache:unsubscribe:error', { error: 'Failed to remove subscription' });
    }
  }

  private handleDisconnection(socket: any, reason: string): void {
    const user = socket.user as SocketUser;
    if (user) {
      // Remove from connected users
      this.connectedUsers.delete(socket.id);

      // Remove from user sockets
      const userSockets = this.userSockets.get(user.id);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          this.userSockets.delete(user.id);
        }
      }

      // Remove cache subscription
      this.cacheSubscriptions.delete(socket.id);

      // Unsubscribe from real-time cache service
      if (socket.serviceSubscriptionId) {
        realTimeCacheService.unsubscribe(socket.serviceSubscriptionId);
      }

      logger.info('WebSocket client disconnected', {
        userId: user.id,
        socketId: socket.id,
        reason
      });
    }
  }

  private setupCacheEventHandlers(): void {
    // Listen to cache events from real-time cache service
    realTimeCacheService.on('cache:update', async (event: CacheUpdateEvent) => {
      await this.broadcastCacheUpdate(event);
    });
  }

  private shouldNotifySubscription(subscription: CacheSubscriptionSocket, event: CacheUpdateEvent): boolean {
    // Check user scope
    if (event.userId && event.userId !== subscription.userId) {
      return false;
    }

    // Check filters if provided
    if (subscription.filters) {
      const { entityIds, eventTypes, priority } = subscription.filters;

      if (entityIds && !entityIds.includes(event.entityId)) {
        return false;
      }

      if (eventTypes && !eventTypes.includes(event.type)) {
        return false;
      }

      if (priority && event.metadata?.priority && !priority.includes(event.metadata.priority)) {
        return false;
      }
    }

    return true;
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();
export default webSocketService;