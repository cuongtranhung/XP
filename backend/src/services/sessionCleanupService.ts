import * as cron from 'node-cron';
import { SessionService } from './sessionService';
import { logger } from '../utils/logger';

export class SessionCleanupService {
  private static cleanupInterval: NodeJS.Timeout | null = null;
  private static cronJob: cron.ScheduledTask | null = null;

  /**
   * Start the session cleanup service
   */
  static start(): void {
    if (this.cronJob) {
      logger.warn('Session cleanup service is already running');
      return;
    }

    // Run cleanup every hour
    this.cronJob = cron.schedule('0 * * * *', async () => {
      try {
        logger.info('Starting scheduled session cleanup');
        await SessionService.cleanupExpiredSessions();
        logger.info('Scheduled session cleanup completed');
      } catch (error) {
        logger.error('Scheduled session cleanup failed', { error });
      }
    });

    // Also run an initial cleanup on startup
    setTimeout(async () => {
      try {
        logger.info('Running initial session cleanup on startup');
        await SessionService.cleanupExpiredSessions();
        logger.info('Initial session cleanup completed');
      } catch (error) {
        logger.error('Initial session cleanup failed', { error });
      }
    }, 10000); // Wait 10 seconds after startup

    logger.info('Session cleanup service started - runs every hour');
  }

  /**
   * Stop the session cleanup service
   */
  static stop(): void {
    if (this.cronJob) {
      this.cronJob.destroy();
      this.cronJob = null;
      logger.info('Session cleanup service stopped');
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Run cleanup manually
   */
  static async runCleanup(): Promise<void> {
    try {
      logger.info('Running manual session cleanup');
      await SessionService.cleanupExpiredSessions();
      logger.info('Manual session cleanup completed');
    } catch (error) {
      logger.error('Manual session cleanup failed', { error });
      throw error;
    }
  }

  /**
   * Get cleanup service status
   */
  static getStatus(): {
    running: boolean;
    nextRun?: string | undefined;
  } {
    return {
      running: !!this.cronJob,
      nextRun: this.cronJob ? 'Every hour at minute 0' : undefined
    };
  }
}