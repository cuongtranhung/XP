/**
 * Real-time Communication Hub
 * Core WebSocket server implementation with Socket.IO
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Cluster } from 'ioredis';
import { instrument } from '@socket.io/admin-ui';
import jwt from 'jsonwebtoken';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { logger } from '../utils/logger';
import { GPSNamespace } from './namespaces/gpsNamespace';
import { NotificationNamespace } from './namespaces/notificationNamespace';
import { PresenceNamespace } from './namespaces/presenceNamespace';
import { CollaborationNamespace } from './namespaces/collaborationNamespace';
import { RealtimeMetrics } from './realtimeMetrics';
import { MessageValidator } from './messageValidator';

// Configuration
export interface RealtimeConfig {
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  redis: {
    nodes: Array<{ host: string; port: number }>;
    password?: string;
  };
  jwt: {
    secret: string;
    algorithms: string[];
  };
  rateLimiting: {
    connections: { points: number; duration: number };
    messages: { points: number; duration: number };
  };
  monitoring: {
    adminUI: boolean;
    prometheus: boolean;
  };
}

// User context attached to socket
export interface SocketUser {
  id: string;
  email: string;
  permissions: string[];
  sessionId: string;
}

// Extend Socket interface
declare module 'socket.io' {
  interface Socket {
    userId?: string;
    sessionId?: string;
    user?: SocketUser;
  }
}

/**
 * Real-time Communication Hub
 */
export class RealtimeHub {
  private io: SocketServer;
  private pubClient: Cluster;
  private subClient: Cluster;
  private metrics: RealtimeMetrics;
  private validator: MessageValidator;
  private connectionLimiter: RateLimiterRedis;
  private messageLimiter: RateLimiterRedis;
  
  // Namespaces
  private gpsNamespace: GPSNamespace;
  private notificationNamespace: NotificationNamespace;
  private presenceNamespace: PresenceNamespace;
  private collaborationNamespace: CollaborationNamespace;

  constructor(
    private httpServer: HTTPServer,
    private config: RealtimeConfig
  ) {
    this.initializeRedis();
    this.initializeSocketIO();
    this.initializeRateLimiters();
    this.initializeNamespaces();
    this.setupMiddleware();
    this.setupEventHandlers();
    
    if (config.monitoring.prometheus) {
      this.metrics = new RealtimeMetrics();
    }
    
    this.validator = new MessageValidator();
    
    logger.info('Realtime Hub initialized');
  }

  /**
   * Initialize Redis clients for adapter
   */
  private initializeRedis(): void {
    this.pubClient = new Cluster(this.config.redis.nodes, {
      redisOptions: {
        password: this.config.redis.password,
        retryStrategy: (times) => Math.min(times * 100, 3000)
      }
    });

    this.subClient = this.pubClient.duplicate();

    this.pubClient.on('error', (err) => {
      logger.error('Redis publisher error:', err);
    });

    this.subClient.on('error', (err) => {
      logger.error('Redis subscriber error:', err);
    });
  }

  /**
   * Initialize Socket.IO server
   */
  private initializeSocketIO(): void {
    this.io = new SocketServer(this.httpServer, {
      cors: this.config.cors,
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 30000,
      maxHttpBufferSize: 1e6, // 1MB
      allowEIO3: true, // Allow older clients
      adapter: createAdapter(this.pubClient, this.subClient)
    });

    // Enable admin UI for monitoring
    if (this.config.monitoring.adminUI) {
      instrument(this.io, {
        auth: {
          type: 'basic',
          username: process.env.SOCKETIO_ADMIN_USER ?? 'admin',
          password: process.env.SOCKETIO_ADMIN_PASS ?? 'admin'
        },
        readonly: false
      });
    }
  }

  /**
   * Initialize rate limiters
   */
  private initializeRateLimiters(): void {
    // Connection rate limiter
    this.connectionLimiter = new RateLimiterRedis({
      storeClient: this.pubClient,
      keyPrefix: 'rl:conn',
      points: this.config.rateLimiting.connections.points,
      duration: this.config.rateLimiting.connections.duration,
      blockDuration: 10 // Block for 10 seconds
    });

    // Message rate limiter
    this.messageLimiter = new RateLimiterRedis({
      storeClient: this.pubClient,
      keyPrefix: 'rl:msg',
      points: this.config.rateLimiting.messages.points,
      duration: this.config.rateLimiting.messages.duration
    });
  }

  /**
   * Initialize namespaces
   */
  private initializeNamespaces(): void {
    this.gpsNamespace = new GPSNamespace(this.io, this.pubClient);
    this.notificationNamespace = new NotificationNamespace(this.io, this.pubClient);
    this.presenceNamespace = new PresenceNamespace(this.io, this.pubClient);
    this.collaborationNamespace = new CollaborationNamespace(this.io, this.pubClient);
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
          return next(new Error('Authentication required'));
        }

        // Rate limit connections
        const ip = socket.handshake.address;
        try {
          await this.connectionLimiter.consume(ip);
        } catch (rejRes) {
          return next(new Error('Too many connection attempts'));
        }

        // Verify JWT
        const decoded = jwt.verify(token, this.config.jwt.secret, {
          algorithms: this.config.jwt.algorithms as jwt.Algorithm[]
        }) as any;

        // Attach user context
        socket.userId = decoded.userId;
        socket.sessionId = decoded.sessionId;
        socket.user = {
          id: decoded.userId,
          email: decoded.email,
          permissions: decoded.permissions || [],
          sessionId: decoded.sessionId
        };

        // Track connection
        if (this.metrics) {
          this.metrics.trackConnection(socket.nsp.name, 1);
        }

        logger.info('User connected', {
          userId: socket.userId,
          sessionId: socket.sessionId,
          namespace: socket.nsp.name
        });

        next();
      } catch (error) {
        logger.error('Authentication failed', error);
        next(new Error('Authentication failed'));
      }
    });

    // Message validation middleware
    this.io.use(async (socket, next) => {
      const originalEmit = socket.emit;
      
      // Override emit to add validation
      socket.emit = async (event: string, ...args: any[]) => {
        try {
          // Rate limit messages
          await this.messageLimiter.consume(`${socket.userId}:${event}`);
          
          // Validate message
          if (!this.validator.validate(event, args[0])) {
            throw new Error('Invalid message format');
          }
          
          // Track metrics
          if (this.metrics) {
            this.metrics.trackMessage(event, 'out', 'success');
          }
          
          return originalEmit.apply(socket, [event, ...args]);
        } catch (error) {
          if (this.metrics) {
            this.metrics.trackMessage(event, 'out', 'error');
          }
          
          socket.emit('error', {
            event,
            message: error.message
          });
          
          return false;
        }
      };
      
      next();
    });
  }

  /**
   * Setup global event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      // Handle disconnection
      socket.on('disconnect', (reason) => {
        if (this.metrics) {
          this.metrics.trackConnection(socket.nsp.name, -1);
        }
        
        logger.info('User disconnected', {
          userId: socket.userId,
          reason
        });
        
        // Clean up presence
        this.presenceNamespace.handleDisconnect(socket);
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error('Socket error', {
          userId: socket.userId,
          error: error.message
        });
      });

      // Heartbeat for connection monitoring
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });

      // Join user to their personal room
      if (socket.userId) {
        socket.join(`user:${socket.userId}`);
      }

      // Join session room
      if (socket.sessionId) {
        socket.join(`session:${socket.sessionId}`);
      }
    });
  }

  /**
   * Broadcast to specific users
   */
  async broadcastToUsers(userIds: string[], event: string, data: any): Promise<void> {
    const rooms = userIds.map(id => `user:${id}`);
    this.io.to(rooms).emit(event, data);
  }

  /**
   * Broadcast to a room
   */
  async broadcastToRoom(room: string, event: string, data: any): Promise<void> {
    this.io.to(room).emit(event, data);
  }

  /**
   * Get server statistics
   */
  async getStats(): Promise<{
    connections: number;
    rooms: number;
    namespaces: string[];
    metrics?: any;
  }> {
    const sockets = await this.io.fetchSockets();
    const rooms = this.io.sockets.adapter.rooms;
    
    return {
      connections: sockets.length,
      rooms: rooms.size,
      namespaces: ['/gps', '/notifications', '/presence', '/collaboration'],
      metrics: this.metrics ? await this.metrics.getMetrics() : undefined
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Realtime Hub...');
    
    // Close all connections
    this.io.disconnectSockets(true);
    
    // Close Redis connections
    await this.pubClient.quit();
    await this.subClient.quit();
    
    // Close Socket.IO server
    this.io.close();
    
    logger.info('Realtime Hub shutdown complete');
  }
}

// Export factory function
export function createRealtimeHub(
  httpServer: HTTPServer,
  config?: Partial<RealtimeConfig>
): RealtimeHub {
  const defaultConfig: RealtimeConfig = {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || '*',
      credentials: true
    },
    redis: {
      nodes: process.env.REDIS_NODES?.split(',').map(node => {
        const [host, port] = node.split(':');
        return { host, port: parseInt(port) };
      }) || [{ host: 'localhost', port: 6379 }],
      password: process.env.REDIS_PASSWORD
    },
    jwt: {
      secret: process.env.JWT_SECRET ?? 'secret',
      algorithms: ['HS256', 'RS256']
    },
    rateLimiting: {
      connections: { points: 5, duration: 60 }, // 5 connections per minute
      messages: { points: 100, duration: 1 } // 100 messages per second
    },
    monitoring: {
      adminUI: process.env.SOCKETIO_ADMIN === 'true',
      prometheus: true
    }
  };
  
  return new RealtimeHub(httpServer, { ...defaultConfig, ...config });
}