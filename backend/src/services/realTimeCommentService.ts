/**
 * Real-time Comment Service for Live Comment Notifications and Interactions
 * Handles WebSocket-based real-time comment features including notifications, typing indicators, and reactions
 */

import { webSocketService } from './webSocketService';
import { logger } from '../utils/logger';
import redisClient from '../config/redis';

export interface CommentSubscription {
  userId: string;
  socketId: string;
  entityType: 'form_submission' | 'form' | 'comment';
  entityId: string;
  joinedAt: Date;
  lastActivity: Date;
  isActive: boolean;
}

export interface TypingIndicator {
  userId: string;
  userEmail: string;
  fullName?: string;
  entityType: 'form_submission' | 'form';
  entityId: string;
  startedTyping: Date;
  lastTypingActivity: Date;
  isTyping: boolean;
}

export interface CommentReaction {
  reactionId: string;
  commentId: string;
  userId: string;
  reactionType: 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry';
  timestamp: Date;
}

export interface UserPresence {
  userId: string;
  userEmail: string;
  fullName?: string;
  entityType: 'form_submission' | 'form';
  entityId: string;
  status: 'viewing' | 'commenting' | 'typing' | 'idle';
  joinedAt: Date;
  lastActivity: Date;
  metadata: {
    deviceType?: string;
    location?: string;
    currentSection?: string;
  };
}

export interface CommentNotification {
  type: 'new_comment' | 'comment_reply' | 'comment_mention' | 'comment_reaction' | 'comment_updated' | 'comment_deleted';
  commentId: string;
  entityType: 'form_submission' | 'form';
  entityId: string;
  author: {
    userId: string;
    userEmail: string;
    fullName?: string;
  };
  content?: string;
  parentCommentId?: string;
  mentionedUsers?: string[];
  reactionData?: CommentReaction;
  timestamp: Date;
  metadata: {
    isReply: boolean;
    depth: number;
    priority: 'low' | 'medium' | 'high';
  };
}

/**
 * Real-time Comment Service
 */
class RealTimeCommentService {
  private commentSubscriptions = new Map<string, CommentSubscription>();
  private entitySubscribers = new Map<string, Set<string>>(); // entityId -> Set of userIds
  private typingIndicators = new Map<string, TypingIndicator>();
  private userPresence = new Map<string, UserPresence>();
  private commentReactions = new Map<string, CommentReaction[]>(); // commentId -> reactions

  constructor() {
    this.setupCleanupInterval();
  }

  /**
   * Subscribe to real-time comment updates for an entity
   */
  async subscribeToEntity(subscription: {
    userId: string;
    socketId: string;
    entityType: 'form_submission' | 'form' | 'comment';
    entityId: string;
    userInfo: {
      userEmail: string;
      fullName?: string;
    };
  }): Promise<{
    subscription: CommentSubscription;
    currentPresence: UserPresence[];
    activeTyping: TypingIndicator[];
  }> {
    try {
      const entityKey = `${subscription.entityType}:${subscription.entityId}`;

      // Create subscription
      const commentSub: CommentSubscription = {
        userId: subscription.userId,
        socketId: subscription.socketId,
        entityType: subscription.entityType,
        entityId: subscription.entityId,
        joinedAt: new Date(),
        lastActivity: new Date(),
        isActive: true
      };

      this.commentSubscriptions.set(subscription.socketId, commentSub);

      // Track entity subscribers
      if (!this.entitySubscribers.has(entityKey)) {
        this.entitySubscribers.set(entityKey, new Set());
      }
      this.entitySubscribers.get(entityKey)!.add(subscription.userId);

      // Add user presence
      const presence: UserPresence = {
        userId: subscription.userId,
        userEmail: subscription.userInfo.userEmail,
        fullName: subscription.userInfo.fullName,
        entityType: subscription.entityType,
        entityId: subscription.entityId,
        status: 'viewing',
        joinedAt: new Date(),
        lastActivity: new Date(),
        metadata: {}
      };

      this.userPresence.set(`${subscription.userId}:${entityKey}`, presence);

      // Store in Redis for clustering
      await this.storeSubscriptionInRedis(subscription.socketId, commentSub);
      await this.storePresenceInRedis(subscription.userId, entityKey, presence);

      // Get current state
      const currentPresence = this.getEntityPresence(subscription.entityType, subscription.entityId);
      const activeTyping = this.getEntityTypingIndicators(subscription.entityType, subscription.entityId);

      // Notify others about new presence
      await this.broadcastPresenceUpdate(subscription.entityType, subscription.entityId, {
        type: 'user_joined',
        user: {
          userId: subscription.userId,
          userEmail: subscription.userInfo.userEmail,
          fullName: subscription.userInfo.fullName
        },
        timestamp: new Date()
      }, subscription.userId);

      logger.info('User subscribed to comment entity', {
        userId: subscription.userId,
        entityType: subscription.entityType,
        entityId: subscription.entityId
      });

      return {
        subscription: commentSub,
        currentPresence,
        activeTyping
      };

    } catch (error) {
      logger.error('Failed to subscribe to comment entity', { error, userId: subscription.userId });
      throw error;
    }
  }

  /**
   * Unsubscribe from comment updates
   */
  async unsubscribeFromEntity(socketId: string, userId: string): Promise<void> {
    try {
      const subscription = this.commentSubscriptions.get(socketId);
      if (!subscription) return;

      const entityKey = `${subscription.entityType}:${subscription.entityId}`;

      // Remove subscription
      this.commentSubscriptions.delete(socketId);

      // Remove from entity subscribers
      const subscribers = this.entitySubscribers.get(entityKey);
      if (subscribers) {
        subscribers.delete(userId);
        if (subscribers.size === 0) {
          this.entitySubscribers.delete(entityKey);
        }
      }

      // Remove presence
      this.userPresence.delete(`${userId}:${entityKey}`);

      // Remove typing indicator if active
      const typingKey = `${userId}:${entityKey}`;
      this.typingIndicators.delete(typingKey);

      // Clean up Redis
      await this.removeSubscriptionFromRedis(socketId);
      await this.removePresenceFromRedis(userId, entityKey);

      // Notify others about departure
      await this.broadcastPresenceUpdate(subscription.entityType, subscription.entityId, {
        type: 'user_left',
        user: { userId },
        timestamp: new Date()
      });

      logger.info('User unsubscribed from comment entity', {
        userId,
        entityType: subscription.entityType,
        entityId: subscription.entityId
      });

    } catch (error) {
      logger.error('Failed to unsubscribe from comment entity', { error, socketId, userId });
    }
  }

  /**
   * Send real-time comment notification
   */
  async sendCommentNotification(notification: CommentNotification): Promise<void> {
    try {
      const entityKey = `${notification.entityType}:${notification.entityId}`;
      const subscribers = this.entitySubscribers.get(entityKey);

      if (!subscribers || subscribers.size === 0) {
        logger.debug('No subscribers for comment notification', { entityKey });
        return;
      }

      const eventData = {
        type: 'comment_notification',
        notification,
        timestamp: new Date().toISOString()
      };

      // Send to all subscribers except the author
      for (const userId of subscribers) {
        if (userId === notification.author.userId) continue;

        await webSocketService.sendCacheUpdateToUser(userId, {
          type: 'realtime_update',
          entity: 'comment',
          entityId: notification.commentId,
          userId,
          data: eventData,
          timestamp: new Date(),
          metadata: {
            notificationType: notification.type,
            priority: notification.metadata.priority
          }
        });
      }

      // Store notification for offline users
      await this.storeNotificationForOfflineUsers(notification, Array.from(subscribers));

      logger.debug('Comment notification sent', {
        type: notification.type,
        commentId: notification.commentId,
        recipientCount: subscribers.size - 1 // Exclude author
      });

    } catch (error) {
      logger.error('Failed to send comment notification', { error, notification });
    }
  }

  /**
   * Update typing indicator
   */
  async updateTypingIndicator(data: {
    userId: string;
    userEmail: string;
    fullName?: string;
    entityType: 'form_submission' | 'form';
    entityId: string;
    isTyping: boolean;
  }): Promise<void> {
    try {
      const entityKey = `${data.entityType}:${data.entityId}`;
      const typingKey = `${data.userId}:${entityKey}`;

      if (data.isTyping) {
        // User started or continued typing
        const indicator: TypingIndicator = {
          userId: data.userId,
          userEmail: data.userEmail,
          fullName: data.fullName,
          entityType: data.entityType,
          entityId: data.entityId,
          startedTyping: this.typingIndicators.get(typingKey)?.startedTyping || new Date(),
          lastTypingActivity: new Date(),
          isTyping: true
        };

        this.typingIndicators.set(typingKey, indicator);

        // Store in Redis
        await this.storeTypingIndicatorInRedis(typingKey, indicator);
      } else {
        // User stopped typing
        this.typingIndicators.delete(typingKey);
        await this.removeTypingIndicatorFromRedis(typingKey);
      }

      // Broadcast typing update
      await this.broadcastTypingUpdate(data.entityType, data.entityId, {
        userId: data.userId,
        userEmail: data.userEmail,
        fullName: data.fullName,
        isTyping: data.isTyping,
        timestamp: new Date()
      }, data.userId);

      logger.debug('Typing indicator updated', {
        userId: data.userId,
        entityKey,
        isTyping: data.isTyping
      });

    } catch (error) {
      logger.error('Failed to update typing indicator', { error, userId: data.userId });
    }
  }

  /**
   * Update user presence status
   */
  async updatePresenceStatus(userId: string, entityType: 'form_submission' | 'form', entityId: string, status: UserPresence['status'], metadata?: Partial<UserPresence['metadata']>): Promise<void> {
    try {
      const entityKey = `${entityType}:${entityId}`;
      const presenceKey = `${userId}:${entityKey}`;
      const presence = this.userPresence.get(presenceKey);

      if (!presence) {
        logger.warn('Presence not found for status update', { userId, entityKey });
        return;
      }

      presence.status = status;
      presence.lastActivity = new Date();
      if (metadata) {
        presence.metadata = { ...presence.metadata, ...metadata };
      }

      // Store in Redis
      await this.storePresenceInRedis(userId, entityKey, presence);

      // Broadcast presence update
      await this.broadcastPresenceUpdate(entityType, entityId, {
        type: 'status_changed',
        user: {
          userId,
          userEmail: presence.userEmail,
          fullName: presence.fullName
        },
        status,
        metadata,
        timestamp: new Date()
      }, userId);

      logger.debug('Presence status updated', { userId, entityKey, status });

    } catch (error) {
      logger.error('Failed to update presence status', { error, userId });
    }
  }

  /**
   * Add or update comment reaction
   */
  async updateCommentReaction(reaction: Omit<CommentReaction, 'reactionId' | 'timestamp'>): Promise<CommentReaction> {
    try {
      const reactionId = `${reaction.commentId}:${reaction.userId}:${reaction.reactionType}`;
      const fullReaction: CommentReaction = {
        ...reaction,
        reactionId,
        timestamp: new Date()
      };

      // Get existing reactions for comment
      let reactions = this.commentReactions.get(reaction.commentId) || [];
      
      // Remove any existing reaction from this user
      reactions = reactions.filter(r => r.userId !== reaction.userId);
      
      // Add new reaction
      reactions.push(fullReaction);
      this.commentReactions.set(reaction.commentId, reactions);

      // Store in Redis
      await this.storeReactionInRedis(reaction.commentId, reactions);

      // Send notification about reaction
      await this.sendCommentNotification({
        type: 'comment_reaction',
        commentId: reaction.commentId,
        entityType: 'form_submission', // Would be determined from comment context
        entityId: '', // Would be determined from comment context
        author: {
          userId: reaction.userId,
          userEmail: '', // Would be resolved from user data
          fullName: ''
        },
        reactionData: fullReaction,
        timestamp: new Date(),
        metadata: {
          isReply: false,
          depth: 0,
          priority: 'low'
        }
      });

      logger.debug('Comment reaction updated', {
        commentId: reaction.commentId,
        userId: reaction.userId,
        reactionType: reaction.reactionType
      });

      return fullReaction;

    } catch (error) {
      logger.error('Failed to update comment reaction', { error, reaction });
      throw error;
    }
  }

  /**
   * Get entity presence information
   */
  getEntityPresence(entityType: 'form_submission' | 'form', entityId: string): UserPresence[] {
    const entityKey = `${entityType}:${entityId}`;
    const presence: UserPresence[] = [];

    for (const [key, userPresence] of this.userPresence) {
      if (key.endsWith(`:${entityKey}`)) {
        presence.push(userPresence);
      }
    }

    return presence.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  }

  /**
   * Get entity typing indicators
   */
  getEntityTypingIndicators(entityType: 'form_submission' | 'form', entityId: string): TypingIndicator[] {
    const entityKey = `${entityType}:${entityId}`;
    const indicators: TypingIndicator[] = [];

    for (const [key, indicator] of this.typingIndicators) {
      if (key.endsWith(`:${entityKey}`) && indicator.isTyping) {
        indicators.push(indicator);
      }
    }

    return indicators;
  }

  /**
   * Get comment reactions
   */
  getCommentReactions(commentId: string): CommentReaction[] {
    return this.commentReactions.get(commentId) || [];
  }

  /**
   * Get service statistics
   */
  getStats(): {
    activeSubscriptions: number;
    totalPresence: number;
    activeTyping: number;
    totalReactions: number;
    topEntities: Array<{ entityKey: string; subscribers: number }>;
  } {
    const activeTyping = Array.from(this.typingIndicators.values())
      .filter(indicator => indicator.isTyping).length;

    const totalReactions = Array.from(this.commentReactions.values())
      .reduce((sum, reactions) => sum + reactions.length, 0);

    const topEntities = Array.from(this.entitySubscribers.entries())
      .map(([entityKey, subscribers]) => ({
        entityKey,
        subscribers: subscribers.size
      }))
      .sort((a, b) => b.subscribers - a.subscribers)
      .slice(0, 10);

    return {
      activeSubscriptions: this.commentSubscriptions.size,
      totalPresence: this.userPresence.size,
      activeTyping,
      totalReactions,
      topEntities
    };
  }

  // Private helper methods

  private async broadcastPresenceUpdate(entityType: string, entityId: string, update: any, excludeUserId?: string): Promise<void> {
    const entityKey = `${entityType}:${entityId}`;
    const subscribers = this.entitySubscribers.get(entityKey);

    if (!subscribers) return;

    const eventData = {
      type: 'presence_update',
      entityType,
      entityId,
      update,
      timestamp: new Date().toISOString()
    };

    for (const userId of subscribers) {
      if (excludeUserId && userId === excludeUserId) continue;

      await webSocketService.sendCacheUpdateToUser(userId, {
        type: 'realtime_update',
        entity: 'comment_presence',
        entityId,
        userId,
        data: eventData,
        timestamp: new Date(),
        metadata: { updateType: update.type }
      });
    }
  }

  private async broadcastTypingUpdate(entityType: string, entityId: string, update: any, excludeUserId?: string): Promise<void> {
    const entityKey = `${entityType}:${entityId}`;
    const subscribers = this.entitySubscribers.get(entityKey);

    if (!subscribers) return;

    const eventData = {
      type: 'typing_update',
      entityType,
      entityId,
      update,
      timestamp: new Date().toISOString()
    };

    for (const userId of subscribers) {
      if (excludeUserId && userId === excludeUserId) continue;

      await webSocketService.sendCacheUpdateToUser(userId, {
        type: 'realtime_update',
        entity: 'comment_typing',
        entityId,
        userId,
        data: eventData,
        timestamp: new Date(),
        metadata: { isTyping: update.isTyping }
      });
    }
  }

  private async storeSubscriptionInRedis(socketId: string, subscription: CommentSubscription): Promise<void> {
    try {
      await redisClient.setex(
        `comment_subscription:${socketId}`,
        3600, // 1 hour TTL
        JSON.stringify(subscription)
      );
    } catch (error) {
      logger.warn('Failed to store comment subscription in Redis', { error, socketId });
    }
  }

  private async removeSubscriptionFromRedis(socketId: string): Promise<void> {
    try {
      await redisClient.del(`comment_subscription:${socketId}`);
    } catch (error) {
      logger.warn('Failed to remove comment subscription from Redis', { error, socketId });
    }
  }

  private async storePresenceInRedis(userId: string, entityKey: string, presence: UserPresence): Promise<void> {
    try {
      await redisClient.setex(
        `comment_presence:${userId}:${entityKey}`,
        1800, // 30 minutes TTL
        JSON.stringify(presence)
      );
    } catch (error) {
      logger.warn('Failed to store presence in Redis', { error, userId });
    }
  }

  private async removePresenceFromRedis(userId: string, entityKey: string): Promise<void> {
    try {
      await redisClient.del(`comment_presence:${userId}:${entityKey}`);
    } catch (error) {
      logger.warn('Failed to remove presence from Redis', { error, userId });
    }
  }

  private async storeTypingIndicatorInRedis(typingKey: string, indicator: TypingIndicator): Promise<void> {
    try {
      await redisClient.setex(
        `comment_typing:${typingKey}`,
        300, // 5 minutes TTL
        JSON.stringify(indicator)
      );
    } catch (error) {
      logger.warn('Failed to store typing indicator in Redis', { error, typingKey });
    }
  }

  private async removeTypingIndicatorFromRedis(typingKey: string): Promise<void> {
    try {
      await redisClient.del(`comment_typing:${typingKey}`);
    } catch (error) {
      logger.warn('Failed to remove typing indicator from Redis', { error, typingKey });
    }
  }

  private async storeReactionInRedis(commentId: string, reactions: CommentReaction[]): Promise<void> {
    try {
      await redisClient.setex(
        `comment_reactions:${commentId}`,
        86400, // 24 hours TTL
        JSON.stringify(reactions)
      );
    } catch (error) {
      logger.warn('Failed to store reactions in Redis', { error, commentId });
    }
  }

  private async storeNotificationForOfflineUsers(notification: CommentNotification, subscribers: string[]): Promise<void> {
    try {
      const notificationData = JSON.stringify(notification);
      
      for (const userId of subscribers) {
        if (userId === notification.author.userId) continue;
        
        await redisClient.lpush(`comment_notifications:${userId}`, notificationData);
        await redisClient.ltrim(`comment_notifications:${userId}`, 0, 99); // Keep last 100
      }
    } catch (error) {
      logger.warn('Failed to store notification for offline users', { error });
    }
  }

  private setupCleanupInterval(): void {
    // Clean up inactive typing indicators every 30 seconds
    setInterval(() => {
      this.cleanupInactiveTyping();
    }, 30 * 1000);

    // Clean up inactive presence every 5 minutes
    setInterval(() => {
      this.cleanupInactivePresence();
    }, 5 * 60 * 1000);
  }

  private cleanupInactiveTyping(): void {
    const now = new Date();
    const typingTimeout = 10 * 1000; // 10 seconds

    for (const [key, indicator] of this.typingIndicators) {
      if (now.getTime() - indicator.lastTypingActivity.getTime() > typingTimeout) {
        this.typingIndicators.delete(key);
        this.removeTypingIndicatorFromRedis(key);
        
        // Broadcast that user stopped typing
        this.broadcastTypingUpdate(indicator.entityType, indicator.entityId, {
          userId: indicator.userId,
          userEmail: indicator.userEmail,
          isTyping: false,
          timestamp: new Date()
        });
      }
    }
  }

  private cleanupInactivePresence(): void {
    const now = new Date();
    const presenceTimeout = 30 * 60 * 1000; // 30 minutes

    for (const [key, presence] of this.userPresence) {
      if (now.getTime() - presence.lastActivity.getTime() > presenceTimeout) {
        this.userPresence.delete(key);
        this.removePresenceFromRedis(presence.userId, `${presence.entityType}:${presence.entityId}`);
        
        logger.debug('Cleaned up inactive presence', {
          userId: presence.userId,
          entityType: presence.entityType,
          entityId: presence.entityId
        });
      }
    }
  }
}

// Export singleton instance
export const realTimeCommentService = new RealTimeCommentService();
export default realTimeCommentService;