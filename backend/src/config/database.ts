import mongoose from 'mongoose';
import { logger } from '../utils/logger';

interface DatabaseConfig {
  uri: string;
  options?: mongoose.ConnectOptions;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Resilient database connection manager with retry logic and connection pooling
 */
class DatabaseConnection {
  private uri: string;
  private options: mongoose.ConnectOptions;
  private maxRetries: number;
  private retryDelay: number;
  private retryCount: number = 0;
  private isConnected: boolean = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(config: DatabaseConfig) {
    this.uri = config.uri;
    this.maxRetries = config.maxRetries || 5;
    this.retryDelay = config.retryDelay || 5000;
    
    // Optimized connection options
    this.options = {
      ...config.options,
      // Connection pooling
      maxPoolSize: 10,
      minPoolSize: 2,
      
      // Timeouts
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      
      // Keep alive
      keepAlive: true,
      keepAliveInitialDelay: 300000,
      
      // Auto index in development only
      autoIndex: process.env.NODE_ENV === 'development',
      
      // Buffer commands when disconnected
      bufferCommands: true,
      
      // Use new URL parser
      useNewUrlParser: true,
      useUnifiedTopology: true
    } as mongoose.ConnectOptions;

    this.setupEventHandlers();
  }

  /**
   * Connect to database with retry logic
   */
  async connect(): Promise<void> {
    try {
      logger.info(`Connecting to MongoDB... (Attempt ${this.retryCount + 1}/${this.maxRetries})`);
      
      await mongoose.connect(this.uri, this.options);
      
      this.isConnected = true;
      this.retryCount = 0;
      
      logger.info('✅ MongoDB connected successfully');
      
      // Log connection details
      const { host, port, name } = mongoose.connection;
      logger.info(`Connected to: ${host}:${port}/${name}`);
      
    } catch (error) {
      logger.error('MongoDB connection error:', error);
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        logger.info(`Retrying connection in ${this.retryDelay / 1000} seconds...`);
        
        await this.delay(this.retryDelay);
        return this.connect();
      } else {
        logger.error('Max connection retries reached. Exiting...');
        process.exit(1);
      }
    }
  }

  /**
   * Setup MongoDB event handlers
   */
  private setupEventHandlers(): void {
    const db = mongoose.connection;

    // Connection events
    db.on('connected', () => {
      logger.info('MongoDB connected event fired');
      this.isConnected = true;
      this.clearReconnectTimeout();
    });

    db.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
      this.isConnected = false;
      this.scheduleReconnect();
    });

    db.on('error', (error) => {
      logger.error('MongoDB error:', error);
      
      if (!this.isConnected) {
        this.scheduleReconnect();
      }
    });

    db.on('reconnected', () => {
      logger.info('MongoDB reconnected');
      this.isConnected = true;
      this.clearReconnectTimeout();
    });

    // Monitor replica set events
    db.on('reconnectFailed', () => {
      logger.error('MongoDB reconnection failed');
      this.scheduleReconnect();
    });

    db.on('close', () => {
      logger.warn('MongoDB connection closed');
      this.isConnected = false;
    });

    // Process termination handlers
    process.on('SIGINT', this.gracefulShutdown.bind(this));
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;
    
    this.reconnectTimeout = setTimeout(() => {
      logger.info('Attempting to reconnect to MongoDB...');
      this.connect();
    }, this.retryDelay);
  }

  /**
   * Clear reconnection timeout
   */
  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  /**
   * Graceful shutdown
   */
  private async gracefulShutdown(): Promise<void> {
    logger.info('Gracefully shutting down MongoDB connection...');
    
    try {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed through app termination');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get connection status
   */
  getStatus(): {
    isConnected: boolean;
    readyState: number;
    host?: string;
    port?: number;
    name?: string;
  } {
    const { readyState, host, port, name } = mongoose.connection;
    
    return {
      isConnected: this.isConnected,
      readyState, // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
      host,
      port,
      name
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isConnected) return false;
    
    try {
      // Ping the database
      await mongoose.connection.db.admin().ping();
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Get connection metrics
   */
  getMetrics(): any {
    if (!mongoose.connection.db) return null;
    
    return {
      collections: mongoose.connection.collections,
      models: mongoose.connection.models,
      readyState: mongoose.connection.readyState,
      // Add more metrics as needed
    };
  }
}

// Create singleton instance
const dbConfig: DatabaseConfig = {
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/xp_database',
  maxRetries: 5,
  retryDelay: 5000
};

export const database = new DatabaseConnection(dbConfig);

// Export mongoose for model definitions
export { mongoose };

export default database;