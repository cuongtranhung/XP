import { Server } from 'http';
import { logger } from './logger';
import { database } from '../config/database';
import { circuitBreakerFactory } from './circuitBreaker';

interface ShutdownHandler {
  name: string;
  handler: () => Promise<void>;
  timeout?: number;
}

/**
 * Graceful shutdown manager
 */
class GracefulShutdown {
  private server: Server | null = null;
  private isShuttingDown = false;
  private shutdownHandlers: ShutdownHandler[] = [];
  private connections = new Set<any>();
  private readonly shutdownTimeout = 30000; // 30 seconds

  /**
   * Initialize graceful shutdown
   */
  init(server: Server): void {
    this.server = server;
    this.setupSignalHandlers();
    this.trackConnections();
    this.registerDefaultHandlers();
  }

  /**
   * Setup signal handlers
   */
  private setupSignalHandlers(): void {
    // Handle termination signals
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      this.shutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.shutdown('UNHANDLED_REJECTION');
    });
  }

  /**
   * Track active connections
   */
  private trackConnections(): void {
    if (!this.server) return;

    this.server.on('connection', (connection) => {
      this.connections.add(connection);

      connection.on('close', () => {
        this.connections.delete(connection);
      });
    });
  }

  /**
   * Register default shutdown handlers
   */
  private registerDefaultHandlers(): void {
    // Close server
    this.register({
      name: 'HTTP Server',
      handler: async () => {
        if (!this.server) return;

        return new Promise((resolve, reject) => {
          // Stop accepting new connections
          this.server!.close((error) => {
            if (error) {
              logger.error('Error closing server:', error);
              reject(error);
            } else {
              logger.info('HTTP server closed');
              resolve();
            }
          });

          // Close existing connections
          this.connections.forEach((connection) => {
            connection.end();
          });

          // Force close after timeout
          setTimeout(() => {
            this.connections.forEach((connection) => {
              connection.destroy();
            });
          }, 5000);
        });
      },
      timeout: 10000
    });

    // Close database
    this.register({
      name: 'Database',
      handler: async () => {
        try {
          await database.gracefulShutdown();
          logger.info('Database connection closed');
        } catch (error) {
          logger.error('Error closing database:', error);
          throw error;
        }
      },
      timeout: 5000
    });

    // Reset circuit breakers
    this.register({
      name: 'Circuit Breakers',
      handler: async () => {
        circuitBreakerFactory.resetAll();
        logger.info('Circuit breakers reset');
      },
      timeout: 1000
    });
  }

  /**
   * Register shutdown handler
   */
  register(handler: ShutdownHandler): void {
    this.shutdownHandlers.push(handler);
  }

  /**
   * Execute shutdown
   */
  private async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    logger.info(`\n🛑 Received ${signal}, starting graceful shutdown...`);

    // Set overall timeout
    const shutdownTimer = setTimeout(() => {
      logger.error('Graceful shutdown timeout, forcing exit');
      process.exit(1);
    }, this.shutdownTimeout);

    try {
      // Execute handlers in reverse order (LIFO)
      const handlers = [...this.shutdownHandlers].reverse();
      
      for (const handler of handlers) {
        try {
          logger.info(`Shutting down ${handler.name}...`);
          
          // Execute with timeout
          await this.executeWithTimeout(
            handler.handler(),
            handler.timeout || 5000
          );
          
          logger.info(`✅ ${handler.name} shutdown complete`);
        } catch (error) {
          logger.error(`❌ Error shutting down ${handler.name}:`, error);
          // Continue with other handlers even if one fails
        }
      }

      clearTimeout(shutdownTimer);
      logger.info('\n✅ Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      clearTimeout(shutdownTimer);
      logger.error('Fatal error during shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Execute promise with timeout
   */
  private executeWithTimeout<T>(
    promise: Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timeout')), timeout)
      )
    ]);
  }

  /**
   * Check if shutting down
   */
  isShuttingDownNow(): boolean {
    return this.isShuttingDown;
  }
}

// Create singleton instance
export const gracefulShutdown = new GracefulShutdown();

/**
 * Middleware to reject requests during shutdown
 */
export const rejectDuringShutdown = (req: any, res: any, next: any) => {
  if (gracefulShutdown.isShuttingDownNow()) {
    res.status(503).json({
      success: false,
      error: {
        message: 'Server is shutting down',
        code: 'SERVER_SHUTTING_DOWN'
      }
    });
  } else {
    next();
  }
};

export default gracefulShutdown;