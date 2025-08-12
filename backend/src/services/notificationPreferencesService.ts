/**
 * Notification Preferences Service
 * Manages user notification preferences and settings
 */

import { logger } from '../utils/logger';
import { pool } from '../utils/database';

export interface NotificationPreferences {
  userId: string;
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
  frequency: {
    email: 'immediate' | 'hourly' | 'daily' | 'weekly';
    push: 'immediate' | 'hourly' | 'daily';
  };
  quiet_hours: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string;   // HH:MM format
  };
  language: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

class NotificationPreferencesService {
  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      // In a real implementation, this would query the database
      // For now, return default preferences
      const defaultPreferences: NotificationPreferences = {
        userId,
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
        quiet_hours: {
          enabled: false,
          start: '22:00',
          end: '08:00'
        },
        language: 'en',
        timezone: 'Asia/Ho_Chi_Minh',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      logger.info('Retrieved notification preferences', { userId });
      return defaultPreferences;
    } catch (error) {
      logger.error('Failed to get notification preferences', { userId, error });
      throw error;
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    try {
      // In a real implementation, this would update the database
      const currentPreferences = await this.getUserPreferences(userId);
      
      const updatedPreferences: NotificationPreferences = {
        ...currentPreferences,
        ...preferences,
        userId,
        updatedAt: new Date()
      };

      logger.info('Updated notification preferences', { userId, preferences });
      return updatedPreferences;
    } catch (error) {
      logger.error('Failed to update notification preferences', { userId, error });
      throw error;
    }
  }

  /**
   * Check if user has enabled a specific channel
   */
  async isChannelEnabled(userId: string, channel: keyof NotificationPreferences['channels']): Promise<boolean> {
    try {
      const preferences = await this.getUserPreferences(userId);
      return preferences.channels[channel] || false;
    } catch (error) {
      logger.error('Failed to check channel status', { userId, channel, error });
      return false;
    }
  }

  /**
   * Check if user has enabled a specific notification type
   */
  async isTypeEnabled(userId: string, type: keyof NotificationPreferences['types']): Promise<boolean> {
    try {
      const preferences = await this.getUserPreferences(userId);
      return preferences.types[type] || false;
    } catch (error) {
      logger.error('Failed to check type status', { userId, type, error });
      return false;
    }
  }

  /**
   * Unsubscribe user from all notifications
   */
  async unsubscribeAll(userId: string): Promise<void> {
    try {
      await this.updateUserPreferences(userId, {
        channels: {
          email: false,
          sms: false,
          push: false,
          'in-app': false
        },
        types: {
          system: false,
          marketing: false,
          transactional: false
        }
      });

      logger.info('User unsubscribed from all notifications', { userId });
    } catch (error) {
      logger.error('Failed to unsubscribe user', { userId, error });
      throw error;
    }
  }

  /**
   * Unsubscribe user from specific notification type
   */
  async unsubscribeFromType(userId: string, type: keyof NotificationPreferences['types']): Promise<void> {
    try {
      const preferences = await this.getUserPreferences(userId);
      preferences.types[type] = false;
      
      await this.updateUserPreferences(userId, { types: preferences.types });
      logger.info('User unsubscribed from notification type', { userId, type });
    } catch (error) {
      logger.error('Failed to unsubscribe from type', { userId, type, error });
      throw error;
    }
  }

  /**
   * Disable specific notification channel
   */
  async disableChannel(userId: string, channel: keyof NotificationPreferences['channels']): Promise<void> {
    try {
      const preferences = await this.getUserPreferences(userId);
      preferences.channels[channel] = false;
      
      await this.updateUserPreferences(userId, { channels: preferences.channels });
      logger.info('Notification channel disabled', { userId, channel });
    } catch (error) {
      logger.error('Failed to disable channel', { userId, channel, error });
      throw error;
    }
  }

  /**
   * Check if user is in quiet hours
   */
  async isInQuietHours(userId: string): Promise<boolean> {
    try {
      const preferences = await this.getUserPreferences(userId);
      
      if (!preferences.quiet_hours.enabled) {
        return false;
      }

      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      const start = preferences.quiet_hours.start;
      const end = preferences.quiet_hours.end;
      
      // Simple time comparison (doesn't handle timezone complexities)
      if (start <= end) {
        // Same day quiet hours (e.g., 22:00 to 23:00)
        return currentTime >= start && currentTime <= end;
      } else {
        // Overnight quiet hours (e.g., 22:00 to 08:00)
        return currentTime >= start || currentTime <= end;
      }
    } catch (error) {
      logger.error('Failed to check quiet hours', { userId, error });
      return false;
    }
  }
}

const notificationPreferencesService = new NotificationPreferencesService();
export default notificationPreferencesService;