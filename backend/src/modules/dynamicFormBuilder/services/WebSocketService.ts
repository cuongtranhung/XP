/**
 * WebSocket Service for Real-time Collaboration
 * Handles real-time form editing, presence, and synchronization
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { logger } from '../../../utils/logger';
import formService from './FormService';
import conflictResolutionService from './ConflictResolutionService';
import { pool } from '../../../utils/database';

interface CollaboratorInfo {
  userId: string;
  socketId: string;
  userName: string;
  userEmail: string;
  color: string;
  cursor?: { x: number; y: number };
  selection?: { fieldId: string };
  lastActivity: Date;
}

interface FormRoom {
  formId: string;
  collaborators: Map<string, CollaboratorInfo>;
  lastUpdate: Date;
  locked: boolean;
  lockedBy?: string;
}

export class WebSocketService {
  private io: SocketIOServer | null = null;
  private formRooms: Map<string, FormRoom> = new Map();
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> socketIds
  private collaboratorColors = [
    '#EF4444', '#F59E0B', '#10B981', '#3B82F6', 
    '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'
  ];
  private colorIndex = 0;

  /**
   * Initialize WebSocket server
   */
  initialize(server: HTTPServer): void {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        socket.data.userId = decoded.id;
        socket.data.userEmail = decoded.email;
        socket.data.userName = decoded.name || decoded.email.split('@')[0];
        
        next();
      } catch (error) {
        next(new Error('Invalid token'));
      }
    });

    this.setupEventHandlers();
    this.startCleanupInterval();

    logger.info('WebSocket service initialized for Dynamic Form Builder');
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      logger.info(`User connected: ${socket.data.userId} (${socket.id})`);

      // Track user socket
      this.addUserSocket(socket.data.userId, socket.id);

      // Form collaboration events
      socket.on('form:join', (formId: string) => this.handleFormJoin(socket, formId));
      socket.on('form:leave', (formId: string) => this.handleFormLeave(socket, formId));
      socket.on('form:update', (data: any) => this.handleFormUpdate(socket, data));
      socket.on('form:field:add', (data: any) => this.handleFieldAdd(socket, data));
      socket.on('form:field:update', (data: any) => this.handleFieldUpdate(socket, data));
      socket.on('form:field:delete', (data: any) => this.handleFieldDelete(socket, data));
      socket.on('form:field:reorder', (data: any) => this.handleFieldReorder(socket, data));
      socket.on('form:cursor:move', (data: any) => this.handleCursorMove(socket, data));
      socket.on('form:selection:change', (data: any) => this.handleSelectionChange(socket, data));
      socket.on('form:lock:request', (formId: string) => this.handleLockRequest(socket, formId));
      socket.on('form:lock:release', (formId: string) => this.handleLockRelease(socket, formId));

      // Presence events
      socket.on('presence:ping', () => this.handlePresencePing(socket));

      // Disconnection
      socket.on('disconnect', () => this.handleDisconnect(socket));
    });
  }

  /**
   * Handle user joining a form for collaboration
   */
  private async handleFormJoin(socket: Socket, formId: string): Promise<void> {
    try {
      // Verify user has access to the form
      const form = await formService.getForm(formId);
      if (!form || form.ownerId !== socket.data.userId) {
        // Check if user has edit permissions (could be extended with sharing logic)
        socket.emit('form:error', { message: 'Access denied' });
        return;
      }

      // Join socket room
      socket.join(`form:${formId}`);

      // Create or get form room
      let room = this.formRooms.get(formId);
      if (!room) {
        room = {
          formId,
          collaborators: new Map(),
          lastUpdate: new Date(),
          locked: false
        };
        this.formRooms.set(formId, room);
      }

      // Assign color to collaborator
      const color = this.collaboratorColors[this.colorIndex % this.collaboratorColors.length];
      this.colorIndex++;

      // Add collaborator
      const collaborator: CollaboratorInfo = {
        userId: socket.data.userId,
        socketId: socket.id,
        userName: socket.data.userName,
        userEmail: socket.data.userEmail,
        color,
        lastActivity: new Date()
      };

      room.collaborators.set(socket.id, collaborator);

      // Send current collaborators to joining user
      socket.emit('form:collaborators', {
        collaborators: Array.from(room.collaborators.values()).map(c => ({
          userId: c.userId,
          userName: c.userName,
          color: c.color,
          cursor: c.cursor,
          selection: c.selection
        })),
        locked: room.locked,
        lockedBy: room.lockedBy
      });

      // Notify others of new collaborator
      socket.to(`form:${formId}`).emit('collaborator:joined', {
        userId: collaborator.userId,
        userName: collaborator.userName,
        color: collaborator.color
      });

      logger.info(`User ${socket.data.userId} joined form ${formId}`);
    } catch (error) {
      logger.error('Error joining form:', error as Record<string, any>);
      socket.emit('form:error', { message: 'Failed to join form' });
    }
  }

  /**
   * Handle user leaving a form
   */
  private handleFormLeave(socket: Socket, formId: string): void {
    const room = this.formRooms.get(formId);
    if (!room) return;

    // Remove collaborator
    room.collaborators.delete(socket.id);

    // Leave socket room
    socket.leave(`form:${formId}`);

    // If user had lock, release it
    if (room.lockedBy === socket.id) {
      room.locked = false;
      room.lockedBy = undefined;
      socket.to(`form:${formId}`).emit('form:lock:released');
    }

    // Notify others
    socket.to(`form:${formId}`).emit('collaborator:left', {
      userId: socket.data.userId
    });

    // Clean up empty rooms
    if (room.collaborators.size === 0) {
      this.formRooms.delete(formId);
    }

    logger.info(`User ${socket.data.userId} left form ${formId}`);
  }

  /**
   * Handle form update
   */
  private async handleFormUpdate(socket: Socket, data: any): Promise<void> {
    const { formId, updates } = data;
    const room = this.formRooms.get(formId);
    
    if (!room || !room.collaborators.has(socket.id)) {
      socket.emit('form:error', { message: 'Not in form room' });
      return;
    }

    try {
      // Update form in database
      await formService.updateForm(formId, updates, socket.data.userId);

      // Update room timestamp
      room.lastUpdate = new Date();

      // Broadcast to other collaborators
      socket.to(`form:${formId}`).emit('form:updated', {
        updates,
        updatedBy: {
          userId: socket.data.userId,
          userName: socket.data.userName
        },
        timestamp: room.lastUpdate
      });

      // Send acknowledgment
      socket.emit('form:update:success', { timestamp: room.lastUpdate });
    } catch (error) {
      logger.error('Error updating form:', error as Record<string, any>);
      socket.emit('form:error', { message: 'Failed to update form' });
    }
  }

  /**
   * Handle field addition
   */
  private async handleFieldAdd(socket: Socket, data: any): Promise<void> {
    const { formId, field, position } = data;
    const room = this.formRooms.get(formId);
    
    if (!room || !room.collaborators.has(socket.id)) {
      socket.emit('form:error', { message: 'Not in form room' });
      return;
    }

    try {
      // Get current form state
      const form = await formService.getForm(formId);
      if (!form) {
        socket.emit('form:error', { message: 'Form not found' });
        return;
      }
      const currentFields = form.fields || [];

      // Create operation for conflict resolution
      const operation = {
        id: `${socket.id}-${Date.now()}`,
        type: 'add' as const,
        field,
        position,
        timestamp: new Date(),
        userId: socket.data.userId
      };

      // Resolve conflicts
      const resolution = conflictResolutionService.resolveConflicts(
        formId,
        operation,
        currentFields
      );

      // Record operation
      conflictResolutionService.recordOperation(formId, operation);

      // Apply accepted and merged operations
      const operationsToApply = [...resolution.accepted, ...resolution.merged];
      
      if (operationsToApply.length > 0) {
        // Broadcast to other collaborators
        socket.to(`form:${formId}`).emit('form:field:added', {
          field,
          position: operationsToApply[0].position || position,
          addedBy: {
            userId: socket.data.userId,
            userName: socket.data.userName
          }
        });
      } else {
        // Operation was rejected due to conflict
        socket.emit('form:conflict', {
          message: 'Field addition conflicted with another operation',
          operation
        });
      }
    } catch (error) {
      logger.error('Error handling field add:', error as Record<string, any>);
      socket.emit('form:error', { message: 'Failed to add field' });
    }
  }

  /**
   * Handle field update
   */
  private async handleFieldUpdate(socket: Socket, data: any): Promise<void> {
    const { formId, fieldId, updates } = data;
    const room = this.formRooms.get(formId);
    
    if (!room || !room.collaborators.has(socket.id)) {
      socket.emit('form:error', { message: 'Not in form room' });
      return;
    }

    try {
      // Get current form state
      const form = await formService.getForm(formId);
      if (!form) {
        socket.emit('form:error', { message: 'Form not found' });
        return;
      }
      const currentFields = form.fields || [];

      // Create operation for conflict resolution
      const operation = {
        id: `${socket.id}-${Date.now()}`,
        type: 'update' as const,
        fieldId,
        updates,
        timestamp: new Date(),
        userId: socket.data.userId
      };

      // Resolve conflicts
      const resolution = conflictResolutionService.resolveConflicts(
        formId,
        operation,
        currentFields
      );

      // Record operation
      conflictResolutionService.recordOperation(formId, operation);

      // Apply accepted and merged operations
      const operationsToApply = [...resolution.accepted, ...resolution.merged];
      
      if (operationsToApply.length > 0) {
        const finalUpdates = operationsToApply[0].updates || updates;
        
        // Broadcast to other collaborators
        socket.to(`form:${formId}`).emit('form:field:updated', {
          fieldId,
          updates: finalUpdates,
          updatedBy: {
            userId: socket.data.userId,
            userName: socket.data.userName
          }
        });
      } else {
        // Operation was rejected due to conflict
        socket.emit('form:conflict', {
          message: 'Field update conflicted with another operation',
          operation
        });
      }
    } catch (error) {
      logger.error('Error handling field update:', error as Record<string, any>);
      socket.emit('form:error', { message: 'Failed to update field' });
    }
  }

  /**
   * Handle field deletion
   */
  private async handleFieldDelete(socket: Socket, data: any): Promise<void> {
    const { formId, fieldId } = data;
    const room = this.formRooms.get(formId);
    
    if (!room || !room.collaborators.has(socket.id)) {
      socket.emit('form:error', { message: 'Not in form room' });
      return;
    }

    try {
      // Get current form state
      const form = await formService.getForm(formId);
      if (!form) {
        socket.emit('form:error', { message: 'Form not found' });
        return;
      }
      const currentFields = form.fields || [];

      // Create operation for conflict resolution
      const operation = {
        id: `${socket.id}-${Date.now()}`,
        type: 'delete' as const,
        fieldId,
        timestamp: new Date(),
        userId: socket.data.userId
      };

      // Resolve conflicts
      const resolution = conflictResolutionService.resolveConflicts(
        formId,
        operation,
        currentFields
      );

      // Record operation
      conflictResolutionService.recordOperation(formId, operation);

      // Apply accepted operations
      if (resolution.accepted.length > 0) {
        // Broadcast to other collaborators
        socket.to(`form:${formId}`).emit('form:field:deleted', {
          fieldId,
          deletedBy: {
            userId: socket.data.userId,
            userName: socket.data.userName
          }
        });
      } else {
        // Operation was rejected due to conflict
        socket.emit('form:conflict', {
          message: 'Field deletion conflicted with another operation',
          operation
        });
      }
    } catch (error) {
      logger.error('Error handling field delete:', error as Record<string, any>);
      socket.emit('form:error', { message: 'Failed to delete field' });
    }
  }

  /**
   * Handle field reordering
   */
  private async handleFieldReorder(socket: Socket, data: any): Promise<void> {
    const { formId, fromIndex, toIndex } = data;
    const room = this.formRooms.get(formId);
    
    if (!room || !room.collaborators.has(socket.id)) {
      socket.emit('form:error', { message: 'Not in form room' });
      return;
    }

    try {
      // Get current form state
      const form = await formService.getForm(formId);
      if (!form) {
        socket.emit('form:error', { message: 'Form not found' });
        return;
      }
      const currentFields = form.fields || [];

      // Create operation for conflict resolution
      const operation = {
        id: `${socket.id}-${Date.now()}`,
        type: 'reorder' as const,
        fromIndex,
        toIndex,
        timestamp: new Date(),
        userId: socket.data.userId
      };

      // Resolve conflicts
      const resolution = conflictResolutionService.resolveConflicts(
        formId,
        operation,
        currentFields
      );

      // Record operation
      conflictResolutionService.recordOperation(formId, operation);

      // Apply accepted and merged operations
      const operationsToApply = [...resolution.accepted, ...resolution.merged];
      
      if (operationsToApply.length > 0) {
        const finalOperation = operationsToApply[0];
        
        // Broadcast to other collaborators
        socket.to(`form:${formId}`).emit('form:field:reordered', {
          fromIndex: finalOperation.fromIndex || fromIndex,
          toIndex: finalOperation.toIndex || toIndex,
          reorderedBy: {
            userId: socket.data.userId,
            userName: socket.data.userName
          }
        });
      } else {
        // Operation was rejected due to conflict
        socket.emit('form:conflict', {
          message: 'Field reordering conflicted with another operation',
          operation
        });
      }
    } catch (error) {
      logger.error('Error handling field reorder:', error as Record<string, any>);
      socket.emit('form:error', { message: 'Failed to reorder fields' });
    }
  }

  /**
   * Handle cursor movement
   */
  private handleCursorMove(socket: Socket, data: any): void {
    const { formId, x, y } = data;
    const room = this.formRooms.get(formId);
    
    if (!room || !room.collaborators.has(socket.id)) return;

    const collaborator = room.collaborators.get(socket.id);
    if (collaborator) {
      collaborator.cursor = { x, y };
      collaborator.lastActivity = new Date();

      // Broadcast to other collaborators
      socket.to(`form:${formId}`).emit('collaborator:cursor:moved', {
        userId: socket.data.userId,
        cursor: { x, y }
      });
    }
  }

  /**
   * Handle selection change
   */
  private handleSelectionChange(socket: Socket, data: any): void {
    const { formId, fieldId } = data;
    const room = this.formRooms.get(formId);
    
    if (!room || !room.collaborators.has(socket.id)) return;

    const collaborator = room.collaborators.get(socket.id);
    if (collaborator) {
      collaborator.selection = fieldId ? { fieldId } : undefined;
      collaborator.lastActivity = new Date();

      // Broadcast to other collaborators
      socket.to(`form:${formId}`).emit('collaborator:selection:changed', {
        userId: socket.data.userId,
        selection: collaborator.selection
      });
    }
  }

  /**
   * Handle lock request
   */
  private handleLockRequest(socket: Socket, formId: string): void {
    const room = this.formRooms.get(formId);
    
    if (!room || !room.collaborators.has(socket.id)) {
      socket.emit('form:error', { message: 'Not in form room' });
      return;
    }

    if (room.locked && room.lockedBy !== socket.id) {
      socket.emit('form:lock:denied', {
        lockedBy: Array.from(room.collaborators.values())
          .find(c => c.socketId === room.lockedBy)?.userName
      });
      return;
    }

    room.locked = true;
    room.lockedBy = socket.id;

    // Notify all collaborators
    this.io?.to(`form:${formId}`).emit('form:lock:acquired', {
      lockedBy: {
        userId: socket.data.userId,
        userName: socket.data.userName
      }
    });
  }

  /**
   * Handle lock release
   */
  private handleLockRelease(socket: Socket, formId: string): void {
    const room = this.formRooms.get(formId);
    
    if (!room || room.lockedBy !== socket.id) return;

    room.locked = false;
    room.lockedBy = undefined;

    // Notify all collaborators
    this.io?.to(`form:${formId}`).emit('form:lock:released');
  }

  /**
   * Handle presence ping
   */
  private handlePresencePing(socket: Socket): void {
    // Update last activity for all rooms user is in
    this.formRooms.forEach(room => {
      const collaborator = room.collaborators.get(socket.id);
      if (collaborator) {
        collaborator.lastActivity = new Date();
      }
    });
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(socket: Socket): void {
    logger.info(`User disconnected: ${socket.data.userId} (${socket.id})`);

    // Remove from all form rooms
    this.formRooms.forEach((room, formId) => {
      if (room.collaborators.has(socket.id)) {
        this.handleFormLeave(socket, formId);
      }
    });

    // Remove socket tracking
    this.removeUserSocket(socket.data.userId, socket.id);
  }

  /**
   * Track user socket
   */
  private addUserSocket(userId: string, socketId: string): void {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socketId);
  }

  /**
   * Remove user socket
   */
  private removeUserSocket(userId: string, socketId: string): void {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }
  }

  /**
   * Start cleanup interval for inactive collaborators
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = new Date();
      const inactivityThreshold = 5 * 60 * 1000; // 5 minutes

      this.formRooms.forEach((room, formId) => {
        const inactiveCollaborators: string[] = [];

        room.collaborators.forEach((collaborator, socketId) => {
          const inactiveTime = now.getTime() - collaborator.lastActivity.getTime();
          if (inactiveTime > inactivityThreshold) {
            inactiveCollaborators.push(socketId);
          }
        });

        // Remove inactive collaborators
        inactiveCollaborators.forEach(socketId => {
          const collaborator = room.collaborators.get(socketId);
          if (collaborator) {
            room.collaborators.delete(socketId);
            
            // Notify others
            this.io?.to(`form:${formId}`).emit('collaborator:left', {
              userId: collaborator.userId,
              reason: 'inactive'
            });
          }
        });

        // Clean up empty rooms
        if (room.collaborators.size === 0) {
          this.formRooms.delete(formId);
        }
      });
    }, 60 * 1000); // Run every minute
  }

  /**
   * Get active collaborators for a form
   */
  getFormCollaborators(formId: string): CollaboratorInfo[] {
    const room = this.formRooms.get(formId);
    return room ? Array.from(room.collaborators.values()) : [];
  }

  /**
   * Send notification to specific user
   */
  sendToUser(userId: string, event: string, data: any): void {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.forEach(socketId => {
        this.io?.to(socketId).emit(event, data);
      });
    }
  }

  /**
   * Send notification to form collaborators
   */
  sendToForm(formId: string, event: string, data: any, excludeUserId?: string): void {
    const room = this.formRooms.get(formId);
    if (room) {
      room.collaborators.forEach(collaborator => {
        if (collaborator.userId !== excludeUserId) {
          this.sendToUser(collaborator.userId, event, data);
        }
      });
    }
  }
}

export default new WebSocketService();