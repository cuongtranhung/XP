import crypto from 'crypto';
import { UserSessionModel, UserSessionData } from '../models/UserSession';
import { logger } from '../utils/logger';

export interface SessionConfig {
  // Encryption settings
  encryptionKey: string;
  signingKey: string;
  algorithm: string;
  
  // Session limits
  maxConcurrentSessions: number;
  sessionTimeout: number;
  
  // Security settings
  enableRotation: boolean;
  rotationInterval: number;
  enableFingerprinting: boolean;
  
  // Compliance
  enableAuditLogging: boolean;
}

export interface DeviceFingerprint {
  userAgent: string;
  acceptLanguage: string;
  acceptEncoding: string;
  screenResolution?: string;
  timezone?: string;
  platform?: string;
}

export interface SessionSecurityData {
  encryptedData: string;
  signature: string;
  fingerprint?: string;
  riskScore: number;
  deviceTrust: 'trusted' | 'unknown' | 'suspicious';
}

export class SessionService {
  private static config: SessionConfig = {
    encryptionKey: process.env.SESSION_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'),
    signingKey: process.env.SESSION_SIGNING_KEY || crypto.randomBytes(32).toString('hex'),
    algorithm: 'aes-256-gcm',
    maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS ?? '5'),
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT_HOURS ?? '24') * 60 * 60 * 1000,
    enableRotation: process.env.ENABLE_SESSION_ROTATION !== 'false',
    rotationInterval: parseInt(process.env.SESSION_ROTATION_HOURS ?? '4') * 60 * 60 * 1000,
    enableFingerprinting: process.env.ENABLE_DEVICE_FINGERPRINTING !== 'false',
    enableAuditLogging: process.env.ENABLE_SESSION_AUDIT_LOGGING !== 'false'
  };

  /**
   * Create a new secure session with encryption and fingerprinting
   */
  static async createSecureSession(
    userId: number,
    req: any,
    additionalData?: Record<string, any>
  ): Promise<{ sessionId: string; sessionData: UserSessionData }> {
    try {
      const sessionId = crypto.randomUUID();
      const fingerprint = this.generateDeviceFingerprint(req);
      const riskScore = this.calculateRiskScore(req, fingerprint);
      
      // Check concurrent session limits
      await this.enforceConcurrentSessionLimits(userId);
      
      const sessionData: Partial<UserSessionData> = {
        id: sessionId,
        user_id: userId,
        expires_at: new Date(Date.now() + this.config.sessionTimeout),
        ip_address: this.getClientIP(req),
        user_agent: req.get('User-Agent'),
        browser_info: {
          name: this.parseBrowserName(req.get('User-Agent')),
          version: this.parseBrowserVersion(req.get('User-Agent')),
          os: this.parseOS(req.get('User-Agent'))
        },
        location_info: await this.getLocationInfo(this.getClientIP(req)),
        metadata: {
          loginMethod: 'email_password',
          timestamp: new Date().toISOString(),
          fingerprint: this.config.enableFingerprinting ? fingerprint : undefined,
          riskScore,
          deviceTrust: this.determineDeviceTrust(riskScore),
          rotationDue: new Date(Date.now() + this.config.rotationInterval),
          ...additionalData
        }
      };

      const createdSession = await UserSessionModel.create(sessionData);
      
      if (this.config.enableAuditLogging) {
        await this.logSessionEvent('SESSION_CREATED', userId, sessionId, {
          riskScore,
          deviceTrust: sessionData.metadata?.deviceTrust,
          ip: sessionData.ip_address
        });
      }

      return { sessionId, sessionData: createdSession! };
    } catch (error) {
      logger.error('Failed to create secure session', { error, userId });
      throw new Error('Session creation failed');
    }
  }

  /**
   * Validate and verify session security
   */
  static async validateSession(sessionId: string, req: any): Promise<{
    valid: boolean;
    session?: UserSessionData;
    shouldRotate?: boolean;
    riskLevel?: 'low' | 'medium' | 'high';
  }> {
    try {
      const session = await UserSessionModel.findById(sessionId);
      
      if (!session || !session.is_active) {
        return { valid: false };
      }

      // Check expiration
      if (new Date() > session.expires_at) {
        await UserSessionModel.deactivate(sessionId, 'EXPIRED');
        return { valid: false };
      }

      // Verify device fingerprint if enabled
      if (this.config.enableFingerprinting && session.metadata?.fingerprint) {
        const currentFingerprint = this.generateDeviceFingerprint(req);
        const fingerprintMatch = this.compareFingerprinds(
          session.metadata.fingerprint,
          currentFingerprint
        );
        
        if (!fingerprintMatch) {
          await this.logSessionEvent('FINGERPRINT_MISMATCH', session.user_id, sessionId, {
            originalFingerprint: session.metadata.fingerprint,
            currentFingerprint,
            ip: this.getClientIP(req)
          });
          
          // Don't invalidate immediately, but mark as suspicious
          await UserSessionModel.updateMetadata(sessionId, {
            ...session.metadata,
            suspiciousActivity: true,
            lastFingerprintMismatch: new Date().toISOString()
          });
        }
      }

      // Check if rotation is due
      const shouldRotate = this.config.enableRotation && 
        session.metadata?.rotationDue && 
        new Date() > new Date(session.metadata.rotationDue);

      // Calculate current risk level
      const currentRisk = this.calculateCurrentRiskLevel(session, req);

      return {
        valid: true,
        session,
        shouldRotate,
        riskLevel: currentRisk
      };
    } catch (error) {
      logger.error('Session validation failed', { error, sessionId });
      return { valid: false };
    }
  }

  /**
   * Rotate session ID for security
   */
  static async rotateSession(oldSessionId: string): Promise<string | null> {
    try {
      const oldSession = await UserSessionModel.findById(oldSessionId);
      if (!oldSession) {return null;}

      const newSessionId = crypto.randomUUID();
      
      // Create new session with same data but new ID
      const newSessionData: Partial<UserSessionData> = {
        ...oldSession,
        id: newSessionId,
        created_at: new Date(),
        metadata: {
          ...oldSession.metadata,
          rotatedFrom: oldSessionId,
          rotationDue: new Date(Date.now() + this.config.rotationInterval),
          lastRotation: new Date().toISOString()
        }
      };

      await UserSessionModel.create(newSessionData);
      await UserSessionModel.deactivate(oldSessionId, 'ROTATED');

      if (this.config.enableAuditLogging) {
        await this.logSessionEvent('SESSION_ROTATED', oldSession.user_id, newSessionId, {
          oldSessionId,
          reason: 'scheduled_rotation'
        });
      }

      return newSessionId;
    } catch (error) {
      logger.error('Session rotation failed', { error, sessionId: oldSessionId });
      return null;
    }
  }

  /**
   * Enforce concurrent session limits
   */
  private static async enforceConcurrentSessionLimits(userId: number): Promise<void> {
    const activeSessions = await UserSessionModel.getActiveSessions(userId);
    
    if (activeSessions.length >= this.config.maxConcurrentSessions) {
      // Deactivate oldest sessions
      const sessionsToDeactivate = activeSessions
        .sort((a, b) => a.last_activity!.getTime() - b.last_activity!.getTime())
        .slice(0, activeSessions.length - this.config.maxConcurrentSessions + 1);

      for (const session of sessionsToDeactivate) {
        await UserSessionModel.deactivate(session.id, 'CONCURRENT_LIMIT_EXCEEDED');
        
        if (this.config.enableAuditLogging) {
          await this.logSessionEvent('SESSION_LIMIT_EXCEEDED', userId, session.id, {
            reason: 'max_concurrent_sessions',
            limit: this.config.maxConcurrentSessions,
            totalActive: activeSessions.length
          });
        }
      }
    }
  }

  /**
   * Generate device fingerprint for tracking
   */
  private static generateDeviceFingerprint(req: any): string {
    const fingerprint: DeviceFingerprint = {
      userAgent: req.get('User-Agent') || '',
      acceptLanguage: req.get('Accept-Language') || '',
      acceptEncoding: req.get('Accept-Encoding') || '',
      // Additional fingerprinting data can be added from client-side
      timezone: req.get('X-Timezone'),
      screenResolution: req.get('X-Screen-Resolution'),
      platform: req.get('X-Platform')
    };

    return crypto
      .createHash('sha256')
      .update(JSON.stringify(fingerprint))
      .digest('hex');
  }

  /**
   * Calculate risk score based on various factors
   */
  private static calculateRiskScore(req: any, _fingerprint: string): number {
    let riskScore = 0;

    // IP-based risk factors
    const ip = this.getClientIP(req);
    if (this.isPrivateIP(ip)) {riskScore += 0.1;}
    if (this.isTorIP(ip)) {riskScore += 0.8;} // High risk for Tor
    
    // User agent analysis
    const userAgent = req.get('User-Agent') || '';
    if (this.isSuspiciousUserAgent(userAgent)) {riskScore += 0.3;}
    
    // Geographic factors (would need GeoIP service)
    // if (this.isHighRiskCountry(ip)) riskScore += 0.2;
    
    // Time-based factors
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {riskScore += 0.1;} // Late night access
    
    return Math.min(riskScore, 1.0); // Cap at 1.0
  }

  /**
   * Determine device trust level
   */
  private static determineDeviceTrust(riskScore: number): 'trusted' | 'unknown' | 'suspicious' {
    if (riskScore < 0.3) {return 'trusted';}
    if (riskScore < 0.7) {return 'unknown';}
    return 'suspicious';
  }

  /**
   * Calculate current risk level for existing session
   */
  private static calculateCurrentRiskLevel(session: UserSessionData, _req: any): 'low' | 'medium' | 'high' {
    const originalRisk = session.metadata?.riskScore || 0;
    const timeSinceCreation = Date.now() - session.created_at.getTime();
    const hoursSinceCreation = timeSinceCreation / (1000 * 60 * 60);
    
    let currentRisk = originalRisk;
    
    // Increase risk for very old sessions
    if (hoursSinceCreation > 12) {currentRisk += 0.2;}
    if (hoursSinceCreation > 24) {currentRisk += 0.3;}
    
    // Check for suspicious activity markers
    if (session.metadata?.suspiciousActivity) {currentRisk += 0.4;}
    
    if (currentRisk < 0.3) {return 'low';}
    if (currentRisk < 0.7) {return 'medium';}
    return 'high';
  }

  /**
   * Compare device fingerprints
   */
  private static compareFingerprinds(stored: string, current: string): boolean {
    return stored === current;
  }

  /**
   * Get client IP address
   */
  private static getClientIP(req: any): string {
    return req.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
           req.get('X-Real-IP') ||
           req.socket.remoteAddress ||
           'unknown';
  }

  /**
   * Parse browser information
   */
  private static parseBrowserName(userAgent: string): string {
    if (userAgent.includes('Chrome')) {return 'Chrome';}
    if (userAgent.includes('Firefox')) {return 'Firefox';}
    if (userAgent.includes('Safari')) {return 'Safari';}
    if (userAgent.includes('Edge')) {return 'Edge';}
    return 'Unknown';
  }

  private static parseBrowserVersion(userAgent: string): string {
    const match = userAgent.match(/(?:Chrome|Firefox|Safari|Edge)\/(\d+\.\d+)/);
    return match ? match[1] : 'Unknown';
  }

  private static parseOS(userAgent: string): string {
    if (userAgent.includes('Windows')) {return 'Windows';}
    if (userAgent.includes('Mac OS')) {return 'macOS';}
    if (userAgent.includes('Linux')) {return 'Linux';}
    if (userAgent.includes('Android')) {return 'Android';}
    if (userAgent.includes('iOS')) {return 'iOS';}
    return 'Unknown';
  }

  /**
   * Get location information (placeholder - would integrate with GeoIP service)
   */
  private static async getLocationInfo(_ip: string): Promise<any> {
    // Placeholder - integrate with MaxMind GeoIP or similar service
    return {
      country: 'Unknown',
      city: 'Unknown',
      ip: _ip
    };
  }

  /**
   * Security checks
   */
  private static isPrivateIP(ip: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./
    ];
    return privateRanges.some(range => range.test(ip));
  }

  private static isTorIP(_ip: string): boolean {
    // Placeholder - would check against Tor exit node list
    return false;
  }

  private static isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /^$/,
      /curl/i,
      /wget/i
    ];
    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Log session events for audit purposes
   */
  private static async logSessionEvent(
    event: string,
    userId: number,
    sessionId: string,
    metadata: any
  ): Promise<void> {
    try {
      logger.info('Session Event', {
        event,
        userId,
        sessionId,
        timestamp: new Date().toISOString(),
        ...metadata
      });
      
      // Could also write to dedicated audit log table
    } catch (error) {
      logger.error('Failed to log session event', { error, event, sessionId });
    }
  }

  /**
   * Cleanup expired sessions
   */
  static async cleanupExpiredSessions(): Promise<void> {
    try {
      const result = await UserSessionModel.cleanup();
      logger.info('Session cleanup completed', { 
        cleanedSessions: result.deletedCount || 0 
      });
    } catch (error) {
      logger.error('Session cleanup failed', { error });
    }
  }

  /**
   * Get session analytics
   */
  static async getSessionAnalytics(userId?: number): Promise<any> {
    try {
      return await UserSessionModel.getAnalytics(userId);
    } catch (error) {
      logger.error('Failed to get session analytics', { error, userId });
      return null;
    }
  }
}