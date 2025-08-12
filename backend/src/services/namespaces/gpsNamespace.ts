/**
 * GPS Namespace for Real-time Location Updates
 * Handles live GPS tracking, location sharing, and geofencing
 */

import { Server, Socket, Namespace } from 'socket.io';
import { Cluster } from 'ioredis';
import { logger } from '../../utils/logger';
import { DatabaseService } from '../databaseService';
const databaseService = new DatabaseService();

// Interfaces
export interface LocationUpdate {
  userId: string;
  deviceId: string;
  sessionId?: string;
  location: {
    lat: number;
    lng: number;
    accuracy: number;
    speed?: number;
    heading?: number;
    altitude?: number;
  };
  timestamp: number;
  metadata?: {
    battery?: number;
    network?: string;
    activity?: 'stationary' | 'walking' | 'running' | 'driving';
  };
}

export interface TrackingSession {
  id: string;
  userId: string;
  deviceId: string;
  startTime: number;
  status: 'active' | 'paused' | 'stopped';
  settings: {
    interval: number;
    highAccuracy: boolean;
    backgroundTracking: boolean;
  };
}

export interface SharedRoute {
  routeId: string;
  ownerId: string;
  sharedWith: string[];
  waypoints: LocationUpdate[];
  metadata: {
    name: string;
    description?: string;
    estimatedDuration?: number;
    totalDistance?: number;
  };
}

export interface GeofenceEvent {
  userId: string;
  deviceId: string;
  geofenceId: string;
  event: 'enter' | 'exit' | 'dwell';
  location: LocationUpdate['location'];
  timestamp: number;
}

/**
 * GPS Namespace Handler
 */
export class GPSNamespace {
  private namespace: Namespace;
  private activeSessions: Map<string, TrackingSession> = new Map();
  private locationBuffer: Map<string, LocationUpdate[]> = new Map();
  private bufferFlushInterval?: NodeJS.Timer;

  constructor(
    private io: Server,
    private redis: Cluster
  ) {
    this.namespace = io.of('/gps');
    this.setupEventHandlers();
    this.startBufferFlush();
    
    logger.info('GPS namespace initialized');
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.namespace.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Handle new connection
   */
  private handleConnection(socket: Socket): void {
    logger.info('GPS namespace connection', { userId: socket.userId });

    // Join user's personal GPS room
    socket.join(`gps:user:${socket.userId}`);

    // Location update events
    socket.on('location:update', (data: Omit<LocationUpdate, 'userId'>) => {
      this.handleLocationUpdate(socket, data);
    });

    socket.on('location:batch', (data: Omit<LocationUpdate, 'userId'>[]) => {
      this.handleLocationBatch(socket, data);
    });

    // Tracking session events
    socket.on('tracking:start', (data, callback) => {
      this.handleTrackingStart(socket, data, callback);
    });

    socket.on('tracking:stop', (data, callback) => {
      this.handleTrackingStop(socket, data, callback);
    });

    socket.on('tracking:pause', (data, callback) => {
      this.handleTrackingPause(socket, data, callback);
    });

    socket.on('tracking:resume', (data, callback) => {
      this.handleTrackingResume(socket, data, callback);
    });

    // Room-based events
    socket.on('room:join', (data, callback) => {
      this.handleRoomJoin(socket, data, callback);
    });

    socket.on('room:leave', (data, callback) => {
      this.handleRoomLeave(socket, data, callback);
    });

    // Route sharing
    socket.on('route:share', (data, callback) => {
      this.handleRouteShare(socket, data, callback);
    });

    socket.on('route:unshare', (data, callback) => {
      this.handleRouteUnshare(socket, data, callback);
    });

    // Geofencing
    socket.on('geofence:create', (data, callback) => {
      this.handleGeofenceCreate(socket, data, callback);
    });

    socket.on('geofence:delete', (data, callback) => {
      this.handleGeofenceDelete(socket, data, callback);
    });

    // Disconnect handling
    socket.on('disconnect', () => {
      this.handleDisconnect(socket);
    });
  }

  /**
   * Handle location update
   */
  private async handleLocationUpdate(
    socket: Socket,
    data: Omit<LocationUpdate, 'userId'>
  ): Promise<void> {
    try {
      const locationUpdate: LocationUpdate = {
        ...data,
        userId: socket.userId!,
        timestamp: Date.now()
      };

      // Validate location data
      if (!this.validateLocation(locationUpdate.location)) {
        socket.emit('error', {
          code: 'INVALID_LOCATION',
          message: 'Invalid location data'
        });
        return;
      }

      // Add to buffer for batch processing
      this.addToBuffer(locationUpdate);

      // Broadcast to user's rooms
      const rooms = await this.getUserRooms(socket.userId!);
      rooms.forEach(room => {
        socket.to(room).emit('location:update', locationUpdate);
      });

      // Check geofences
      await this.checkGeofences(locationUpdate);

      // Update presence
      await this.updatePresence(socket.userId!, locationUpdate);

      // Store in time-series database
      await this.storeLocation(locationUpdate);

    } catch (error) {
      logger.error('Location update error', error);
      socket.emit('error', {
        code: 'LOCATION_UPDATE_FAILED',
        message: 'Failed to process location update'
      });
    }
  }

  /**
   * Handle batch location updates
   */
  private async handleLocationBatch(
    socket: Socket,
    data: Omit<LocationUpdate, 'userId'>[]
  ): Promise<void> {
    try {
      const updates = data.map(update => ({
        ...update,
        userId: socket.userId!
      }));

      // Add all to buffer
      updates.forEach(update => this.addToBuffer(update));

      // Process geofences for latest location
      if (updates.length > 0) {
        await this.checkGeofences(updates[updates.length - 1]);
      }

    } catch (error) {
      logger.error('Location batch error', error);
    }
  }

  /**
   * Handle tracking start
   */
  private async handleTrackingStart(
    socket: Socket,
    data: any,
    callback: Function
  ): Promise<void> {
    try {
      const session: TrackingSession = {
        id: `session:${socket.userId}:${Date.now()}`,
        userId: socket.userId!,
        deviceId: data.deviceId,
        startTime: Date.now(),
        status: 'active',
        settings: {
          interval: data.interval || 5000,
          highAccuracy: data.highAccuracy !== false,
          backgroundTracking: data.backgroundTracking || false
        }
      };

      // Store session
      this.activeSessions.set(session.id, session);
      await this.redis.setex(
        `tracking:session:${session.id}`,
        86400, // 24 hours
        JSON.stringify(session)
      );

      // Store in database
      await databaseService.query(
        `INSERT INTO location_tracking_sessions 
         (id, user_id, device_id, started_at, status, settings)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          session.id,
          session.userId,
          session.deviceId,
          new Date(session.startTime),
          session.status,
          JSON.stringify(session.settings)
        ]
      );

      // Join session room
      socket.join(`session:${session.id}`);

      // Notify user's other devices
      socket.to(`gps:user:${socket.userId}`).emit('tracking:started', session);

      callback({ success: true, session });

    } catch (error) {
      logger.error('Tracking start error', error);
      callback({ 
        success: false, 
        error: 'Failed to start tracking session' 
      });
    }
  }

  /**
   * Handle tracking stop
   */
  private async handleTrackingStop(
    socket: Socket,
    data: { sessionId: string },
    callback: Function
  ): Promise<void> {
    try {
      const session = this.activeSessions.get(data.sessionId);
      
      if (!session || session.userId !== socket.userId) {
        callback({ success: false, error: 'Session not found' });
        return;
      }

      // Update session status
      session.status = 'stopped';
      this.activeSessions.delete(data.sessionId);

      // Update in database
      await databaseService.query(
        `UPDATE location_tracking_sessions 
         SET status = 'stopped', ended_at = NOW()
         WHERE id = $1`,
        [data.sessionId]
      );

      // Leave session room
      socket.leave(`session:${data.sessionId}`);

      // Notify others
      this.namespace.to(`session:${data.sessionId}`).emit('tracking:stopped', {
        sessionId: data.sessionId
      });

      // Flush any remaining buffered locations
      await this.flushBuffer(socket.userId!);

      callback({ success: true });

    } catch (error) {
      logger.error('Tracking stop error', error);
      callback({ success: false, error: 'Failed to stop tracking' });
    }
  }

  /**
   * Handle tracking pause
   */
  private async handleTrackingPause(
    socket: Socket,
    data: { sessionId: string },
    callback: Function
  ): Promise<void> {
    try {
      const session = this.activeSessions.get(data.sessionId);
      
      if (!session || session.userId !== socket.userId) {
        callback({ success: false, error: 'Session not found' });
        return;
      }

      session.status = 'paused';
      
      await this.redis.setex(
        `tracking:session:${session.id}`,
        86400,
        JSON.stringify(session)
      );

      this.namespace.to(`session:${data.sessionId}`).emit('tracking:paused', {
        sessionId: data.sessionId
      });

      callback({ success: true });

    } catch (error) {
      logger.error('Tracking pause error', error);
      callback({ success: false, error: 'Failed to pause tracking' });
    }
  }

  /**
   * Handle tracking resume
   */
  private async handleTrackingResume(
    socket: Socket,
    data: { sessionId: string },
    callback: Function
  ): Promise<void> {
    try {
      const session = this.activeSessions.get(data.sessionId);
      
      if (!session || session.userId !== socket.userId) {
        callback({ success: false, error: 'Session not found' });
        return;
      }

      session.status = 'active';
      
      await this.redis.setex(
        `tracking:session:${session.id}`,
        86400,
        JSON.stringify(session)
      );

      this.namespace.to(`session:${data.sessionId}`).emit('tracking:resumed', {
        sessionId: data.sessionId
      });

      callback({ success: true });

    } catch (error) {
      logger.error('Tracking resume error', error);
      callback({ success: false, error: 'Failed to resume tracking' });
    }
  }

  /**
   * Handle room join
   */
  private async handleRoomJoin(
    socket: Socket,
    data: { roomId: string },
    callback: Function
  ): Promise<void> {
    try {
      // Validate room access
      const hasAccess = await this.validateRoomAccess(socket.userId!, data.roomId);
      
      if (!hasAccess) {
        callback({ success: false, error: 'Access denied' });
        return;
      }

      socket.join(`room:${data.roomId}`);
      
      // Get room members
      const members = await this.getRoomMembers(data.roomId);
      
      // Notify room members
      socket.to(`room:${data.roomId}`).emit('room:user:joined', {
        userId: socket.userId,
        roomId: data.roomId
      });

      callback({ success: true, members });

    } catch (error) {
      logger.error('Room join error', error);
      callback({ success: false, error: 'Failed to join room' });
    }
  }

  /**
   * Handle room leave
   */
  private async handleRoomLeave(
    socket: Socket,
    data: { roomId: string },
    callback: Function
  ): Promise<void> {
    try {
      socket.leave(`room:${data.roomId}`);
      
      // Notify room members
      socket.to(`room:${data.roomId}`).emit('room:user:left', {
        userId: socket.userId,
        roomId: data.roomId
      });

      callback({ success: true });

    } catch (error) {
      logger.error('Room leave error', error);
      callback({ success: false, error: 'Failed to leave room' });
    }
  }

  /**
   * Handle route sharing
   */
  private async handleRouteShare(
    socket: Socket,
    data: any,
    callback: Function
  ): Promise<void> {
    try {
      const sharedRoute: SharedRoute = {
        routeId: `route:${socket.userId}:${Date.now()}`,
        ownerId: socket.userId!,
        sharedWith: data.sharedWith || [],
        waypoints: data.waypoints || [],
        metadata: {
          name: data.name,
          description: data.description,
          estimatedDuration: data.estimatedDuration,
          totalDistance: data.totalDistance
        }
      };

      // Store route
      await this.redis.setex(
        `route:${sharedRoute.routeId}`,
        3600, // 1 hour
        JSON.stringify(sharedRoute)
      );

      // Notify shared users
      sharedRoute.sharedWith.forEach(userId => {
        this.namespace.to(`gps:user:${userId}`).emit('route:shared', sharedRoute);
      });

      callback({ success: true, route: sharedRoute });

    } catch (error) {
      logger.error('Route share error', error);
      callback({ success: false, error: 'Failed to share route' });
    }
  }

  /**
   * Handle route unshare
   */
  private async handleRouteUnshare(
    socket: Socket,
    data: { routeId: string },
    callback: Function
  ): Promise<void> {
    try {
      const routeData = await this.redis.get(`route:${data.routeId}`);
      
      if (!routeData) {
        callback({ success: false, error: 'Route not found' });
        return;
      }

      const route: SharedRoute = JSON.parse(routeData);
      
      if (route.ownerId !== socket.userId) {
        callback({ success: false, error: 'Access denied' });
        return;
      }

      // Delete route
      await this.redis.del(`route:${data.routeId}`);

      // Notify users
      route.sharedWith.forEach(userId => {
        this.namespace.to(`gps:user:${userId}`).emit('route:unshared', {
          routeId: data.routeId
        });
      });

      callback({ success: true });

    } catch (error) {
      logger.error('Route unshare error', error);
      callback({ success: false, error: 'Failed to unshare route' });
    }
  }

  /**
   * Handle geofence creation
   */
  private async handleGeofenceCreate(
    socket: Socket,
    data: any,
    callback: Function
  ): Promise<void> {
    try {
      const geofence = {
        id: `geofence:${socket.userId}:${Date.now()}`,
        userId: socket.userId,
        name: data.name,
        center: data.center, // { lat, lng }
        radius: data.radius, // meters
        triggers: data.triggers || ['enter', 'exit'],
        active: true,
        created: Date.now()
      };

      // Store geofence
      await this.redis.setex(
        `geofence:${geofence.id}`,
        0, // No expiration
        JSON.stringify(geofence)
      );

      // Add to user's geofence set
      await this.redis.sadd(`user:${socket.userId}:geofences`, geofence.id);

      callback({ success: true, geofence });

    } catch (error) {
      logger.error('Geofence create error', error);
      callback({ success: false, error: 'Failed to create geofence' });
    }
  }

  /**
   * Handle geofence deletion
   */
  private async handleGeofenceDelete(
    socket: Socket,
    data: { geofenceId: string },
    callback: Function
  ): Promise<void> {
    try {
      // Verify ownership
      const geofenceData = await this.redis.get(`geofence:${data.geofenceId}`);
      
      if (!geofenceData) {
        callback({ success: false, error: 'Geofence not found' });
        return;
      }

      const geofence = JSON.parse(geofenceData);
      
      if (geofence.userId !== socket.userId) {
        callback({ success: false, error: 'Access denied' });
        return;
      }

      // Delete geofence
      await this.redis.del(`geofence:${data.geofenceId}`);
      await this.redis.srem(`user:${socket.userId}:geofences`, data.geofenceId);

      callback({ success: true });

    } catch (error) {
      logger.error('Geofence delete error', error);
      callback({ success: false, error: 'Failed to delete geofence' });
    }
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(socket: Socket): void {
    // Stop any active tracking sessions
    this.activeSessions.forEach((session, sessionId) => {
      if (session.userId === socket.userId) {
        this.handleTrackingStop(socket, { sessionId }, () => {});
      }
    });
  }

  /**
   * Validate location data
   */
  private validateLocation(location: LocationUpdate['location']): boolean {
    return (
      typeof location.lat === 'number' &&
      typeof location.lng === 'number' &&
      location.lat >= -90 && location.lat <= 90 &&
      location.lng >= -180 && location.lng <= 180 &&
      (!location.accuracy || location.accuracy > 0)
    );
  }

  /**
   * Add location to buffer
   */
  private addToBuffer(location: LocationUpdate): void {
    const key = location.userId;
    
    if (!this.locationBuffer.has(key)) {
      this.locationBuffer.set(key, []);
    }
    
    this.locationBuffer.get(key)!.push(location);
    
    // Limit buffer size
    const buffer = this.locationBuffer.get(key)!;
    if (buffer.length > 100) {
      buffer.shift();
    }
  }

  /**
   * Start buffer flush interval
   */
  private startBufferFlush(): void {
    this.bufferFlushInterval = setInterval(() => {
      this.flushAllBuffers();
    }, 5000); // Flush every 5 seconds
  }

  /**
   * Flush all buffers
   */
  private async flushAllBuffers(): Promise<void> {
    const promises: Promise<void>[] = [];
    
    this.locationBuffer.forEach((buffer, userId) => {
      if (buffer.length > 0) {
        promises.push(this.flushBuffer(userId));
      }
    });
    
    await Promise.allSettled(promises);
  }

  /**
   * Flush buffer for specific user
   */
  private async flushBuffer(userId: string): Promise<void> {
    const buffer = this.locationBuffer.get(userId);
    
    if (!buffer || buffer.length === 0) {
      return;
    }
    
    try {
      // Batch insert to database
      await this.storeLocationBatch(buffer);
      
      // Clear buffer
      this.locationBuffer.set(userId, []);
      
    } catch (error) {
      logger.error('Buffer flush error', { userId, error });
    }
  }

  /**
   * Store location in database
   */
  private async storeLocation(location: LocationUpdate): Promise<void> {
    try {
      await databaseService.query(
        `INSERT INTO user_locations 
         (user_id, device_id, session_id, latitude, longitude, accuracy, 
          speed, heading, altitude, battery_level, network_type, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          location.userId,
          location.deviceId,
          location.sessionId,
          location.location.lat,
          location.location.lng,
          location.location.accuracy,
          location.location.speed,
          location.location.heading,
          location.location.altitude,
          location.metadata?.battery,
          location.metadata?.network,
          JSON.stringify(location.metadata),
          new Date(location.timestamp)
        ]
      );
    } catch (error) {
      logger.error('Store location error', error);
    }
  }

  /**
   * Store location batch
   */
  private async storeLocationBatch(locations: LocationUpdate[]): Promise<void> {
    if (locations.length === 0) return;
    
    const values: any[] = [];
    const placeholders: string[] = [];
    
    locations.forEach((location, index) => {
      const offset = index * 13;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, 
          $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, 
          $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13})`
      );
      
      values.push(
        location.userId,
        location.deviceId,
        location.sessionId,
        location.location.lat,
        location.location.lng,
        location.location.accuracy,
        location.location.speed,
        location.location.heading,
        location.location.altitude,
        location.metadata?.battery,
        location.metadata?.network,
        JSON.stringify(location.metadata),
        new Date(location.timestamp)
      );
    });
    
    await databaseService.query(
      `INSERT INTO user_locations 
       (user_id, device_id, session_id, latitude, longitude, accuracy, 
        speed, heading, altitude, battery_level, network_type, metadata, created_at)
       VALUES ${placeholders.join(', ')}`,
      values
    );
  }

  /**
   * Check geofences
   */
  private async checkGeofences(location: LocationUpdate): Promise<void> {
    try {
      // Get user's geofences
      const geofenceIds = await this.redis.smembers(`user:${location.userId}:geofences`);
      
      for (const geofenceId of geofenceIds) {
        const geofenceData = await this.redis.get(`geofence:${geofenceId}`);
        
        if (!geofenceData) continue;
        
        const geofence = JSON.parse(geofenceData);
        const distance = this.calculateDistance(
          location.location,
          geofence.center
        );
        
        const isInside = distance <= geofence.radius;
        const wasInside = await this.redis.get(`geofence:${geofenceId}:user:${location.userId}:inside`);
        
        // Check for enter event
        if (isInside && !wasInside && geofence.triggers.includes('enter')) {
          this.emitGeofenceEvent({
            userId: location.userId,
            deviceId: location.deviceId,
            geofenceId: geofence.id,
            event: 'enter',
            location: location.location,
            timestamp: Date.now()
          });
          
          await this.redis.set(`geofence:${geofenceId}:user:${location.userId}:inside`, '1');
        }
        
        // Check for exit event
        if (!isInside && wasInside && geofence.triggers.includes('exit')) {
          this.emitGeofenceEvent({
            userId: location.userId,
            deviceId: location.deviceId,
            geofenceId: geofence.id,
            event: 'exit',
            location: location.location,
            timestamp: Date.now()
          });
          
          await this.redis.del(`geofence:${geofenceId}:user:${location.userId}:inside`);
        }
      }
    } catch (error) {
      logger.error('Geofence check error', error);
    }
  }

  /**
   * Emit geofence event
   */
  private emitGeofenceEvent(event: GeofenceEvent): void {
    // Emit to user
    this.namespace.to(`gps:user:${event.userId}`).emit('geofence:event', event);
    
    // Also emit to notification namespace
    this.io.of('/notifications').to(`user:${event.userId}`).emit('geofence:alert', {
      type: event.event,
      geofenceId: event.geofenceId,
      location: event.location,
      timestamp: event.timestamp
    });
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(
    point1: { lat: number; lng: number },
    point2: { lat: number; lng: number }
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = point1.lat * Math.PI / 180;
    const φ2 = point2.lat * Math.PI / 180;
    const Δφ = (point2.lat - point1.lat) * Math.PI / 180;
    const Δλ = (point2.lng - point1.lng) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * Update user presence with location
   */
  private async updatePresence(userId: string, location: LocationUpdate): Promise<void> {
    await this.redis.setex(
      `presence:${userId}:location`,
      300, // 5 minutes
      JSON.stringify({
        lat: location.location.lat,
        lng: location.location.lng,
        accuracy: location.location.accuracy,
        timestamp: location.timestamp
      })
    );
  }

  /**
   * Get user's rooms
   */
  private async getUserRooms(userId: string): Promise<string[]> {
    const rooms: string[] = [`gps:user:${userId}`];
    
    // Get shared rooms from Redis
    const sharedRooms = await this.redis.smembers(`user:${userId}:rooms`);
    rooms.push(...sharedRooms.map(room => `room:${room}`));
    
    return rooms;
  }

  /**
   * Validate room access
   */
  private async validateRoomAccess(userId: string, roomId: string): Promise<boolean> {
    // Check if user has access to room
    const roomData = await this.redis.get(`room:${roomId}:config`);
    
    if (!roomData) {
      return false;
    }
    
    const room = JSON.parse(roomData);
    return room.members.includes(userId) || room.owner === userId;
  }

  /**
   * Get room members
   */
  private async getRoomMembers(roomId: string): Promise<string[]> {
    const roomData = await this.redis.get(`room:${roomId}:config`);
    
    if (!roomData) {
      return [];
    }
    
    const room = JSON.parse(roomData);
    return room.members || [];
  }

  /**
   * Cleanup on shutdown
   */
  cleanup(): void {
    if (this.bufferFlushInterval) {
      clearInterval(this.bufferFlushInterval);
    }
    
    // Flush all remaining buffers
    this.flushAllBuffers().catch(error => {
      logger.error('Final buffer flush error', error);
    });
  }
}