import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import Redis from 'ioredis';
import { logger } from '../../utils/logger';

export async function initializeWebSocket(httpServer: http.Server, redis?: Redis): Promise<SocketIOServer> {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/socket.io',
    transports: ['websocket', 'polling'],
  });

  // Initialize Redis adapter if available
  if (redis) {
    try {
      const { createAdapter } = await import('@socket.io/redis-adapter');
      const pubClient = redis;
      const subClient = pubClient.duplicate();
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('WebSocket Redis adapter initialized');
    } catch (error) {
      logger.warn('Failed to initialize Redis adapter for WebSocket', { error });
    }
  }

  // Handle WebSocket connections
  io.on('connection', (socket) => {
    logger.debug('WebSocket client connected', {
      socketId: socket.id,
      userAgent: socket.handshake.headers['user-agent'],
      ip: socket.handshake.address
    });

    // Join form room
    socket.on('join-form', (formId: string) => {
      if (!formId || typeof formId !== 'string') {
        socket.emit('error', { message: 'Invalid form ID' });
        return;
      }

      socket.join(`form:${formId}`);
      socket.emit('joined-form', { formId });
      
      // Notify other collaborators
      socket.to(`form:${formId}`).emit('collaborator-joined', {
        socketId: socket.id,
        timestamp: new Date().toISOString()
      });

      logger.debug('Socket joined form room', { socketId: socket.id, formId });
    });

    // Leave form room
    socket.on('leave-form', (formId: string) => {
      if (!formId || typeof formId !== 'string') {
        return;
      }

      socket.leave(`form:${formId}`);
      
      // Notify other collaborators
      socket.to(`form:${formId}`).emit('collaborator-left', {
        socketId: socket.id,
        timestamp: new Date().toISOString()
      });

      logger.debug('Socket left form room', { socketId: socket.id, formId });
    });

    // Handle field updates
    socket.on('field-update', (data: any) => {
      if (!data.formId || !data.fieldId) {
        socket.emit('error', { message: 'Invalid field update data' });
        return;
      }

      // Broadcast to other collaborators
      socket.to(`form:${data.formId}`).emit('field-updated', {
        ...data,
        editorId: socket.id,
      });

      logger.debug('Field update broadcasted', {
        socketId: socket.id,
        formId: data.formId,
        fieldId: data.fieldId
      });
    });

    // Handle cursor movements
    socket.on('cursor-move', (data: any) => {
      if (!data.formId) {
        return;
      }

      socket.to(`form:${data.formId}`).emit('cursor-moved', {
        ...data,
        userId: socket.id,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle form submissions
    socket.on('form-submitted', (data: any) => {
      if (!data.formId || !data.submissionId) {
        return;
      }

      // Notify admins
      socket.to(`form:${data.formId}:admin`).emit('new-submission', {
        ...data,
        timestamp: new Date().toISOString(),
      });

      logger.info('Form submission event broadcasted', data);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.debug('WebSocket client disconnected', {
        socketId: socket.id,
        reason
      });

      // Notify all rooms the socket was in
      socket.rooms.forEach(room => {
        if (room.startsWith('form:')) {
          socket.to(room).emit('collaborator-left', {
            socketId: socket.id,
            timestamp: new Date().toISOString(),
          });
        }
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error('WebSocket error', {
        socketId: socket.id,
        error: error.message || error
      });
    });
  });

  // Handle engine errors
  io.engine.on('connection_error', (err: any) => {
    logger.error('WebSocket connection error', {
      code: err.code,
      message: err.message,
      context: err.context,
      type: err.type,
    });
  });

  logger.info('WebSocket server initialized', {
    path: '/socket.io',
    cors: {
      origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    },
  });

  return io;
}

export function notifyFormCollaborators(io: SocketIOServer, formId: string, event: string, data: any): void {
  io.to(`form:${formId}`).emit(event, {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

export function notifyFormAdmins(io: SocketIOServer, formId: string, event: string, data: any): void {
  io.to(`form:${formId}:admin`).emit(event, {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

export async function getActiveCollaborators(io: SocketIOServer, formId: string): Promise<number> {
  try {
    const sockets = await io.in(`form:${formId}`).fetchSockets();
    return sockets.length;
  } catch (error) {
    logger.error('Failed to get active collaborators', { formId, error });
    return 0;
  }
}