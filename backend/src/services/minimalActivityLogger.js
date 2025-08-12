// Minimal Activity Logger - JavaScript version for maximum compatibility
// Date: 2025-08-04
// Purpose: Simple activity logging without TypeScript complexity

const { getClient } = require('../utils/database');

// Global state
let isLoggingEnabled = process.env.ACTIVITY_LOGGING_ENABLED !== 'false';
let asyncLogging = process.env.ACTIVITY_ASYNC_PROCESSING !== 'false';

// Throttling mechanism to prevent event loop exhaustion
const THROTTLE_CONFIG = {
  maxQueueSize: parseInt(process.env.ACTIVITY_LOG_MAX_QUEUE || '1000'),
  maxLogsPerSecond: parseInt(process.env.ACTIVITY_LOG_MAX_PER_SEC || '100'),
  windowMs: 1000
};

let logQueue = [];
let logCount = 0;
let windowStart = Date.now();

class MinimalActivityLogger {
  // Simple enable/disable
  static setEnabled(enabled) {
    isLoggingEnabled = enabled;
    console.log(`Activity logging ${enabled ? 'enabled' : 'disabled'}`);
  }

  static isEnabled() {
    return isLoggingEnabled;
  }

  // Core logging method
  static async log(data) {
    if (!isLoggingEnabled) return false;

    let client = null;
    try {
      client = await getClient();
      
      const query = `
        INSERT INTO user_activity_logs (
          user_id, session_id, action_type, action_category, 
          endpoint, method, response_status, ip_address, 
          user_agent, processing_time_ms, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `;
      
      const values = [
        data.userId || null,  // Use null instead of 0 to avoid FK constraint violation
        data.sessionId || null,
        data.actionType || 'UNKNOWN',
        data.actionCategory || 'SYSTEM',
        data.endpoint || null,
        data.method || null,
        data.responseStatus || null,
        data.ipAddress || null,
        data.userAgent || null,
        data.processingTimeMs || null,
        data.metadata ? JSON.stringify(data.metadata) : null
      ];
      
      await client.query(query, values);
      return true;
    } catch (error) {
      console.error('Activity logging failed:', error);
      return false;
    } finally {
      // CRITICAL: Always release the client back to the pool
      if (client) {
        try {
          client.release();
        } catch (releaseError) {
          console.error('Failed to release database client:', releaseError);
        }
      }
    }
  }

  // Throttled async wrapper
  static logAsync(data) {
    if (!isLoggingEnabled) return;

    // Check throttling limits
    const now = Date.now();
    if (now - windowStart >= THROTTLE_CONFIG.windowMs) {
      // Reset window
      windowStart = now;
      logCount = 0;
    }

    // Check rate limit
    if (logCount >= THROTTLE_CONFIG.maxLogsPerSecond) {
      // Rate limited - add to queue if not full
      if (logQueue.length < THROTTLE_CONFIG.maxQueueSize) {
        logQueue.push(data);
      } else {
        console.warn('Activity log queue full, dropping log entry');
      }
      return;
    }

    logCount++;

    if (asyncLogging) {
      setImmediate(() => {
        this.log(data).catch(error => {
          console.error('Async activity logging failed:', error);
        });
      });
    } else {
      this.log(data).catch(error => {
        console.error('Activity logging failed:', error);
      });
    }
  }

  // Process queued logs (called periodically)
  static processQueuedLogs() {
    if (logQueue.length === 0) return;

    const now = Date.now();
    if (now - windowStart >= THROTTLE_CONFIG.windowMs) {
      // Reset window and process queued logs
      windowStart = now;
      logCount = 0;
      
      const logsToProcess = logQueue.splice(0, THROTTLE_CONFIG.maxLogsPerSecond);
      logsToProcess.forEach(data => {
        setImmediate(() => {
          this.log(data).catch(error => {
            console.error('Queued activity logging failed:', error);
          });
        });
      });
      logCount = logsToProcess.length;
    }
  }

  // Helper methods
  static getClientIP(req) {
    return (
      req.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
      req.get('X-Real-IP') ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  // Auth logging helpers
  static logLogin(userId, sessionId, req) {
    this.logAsync({
      userId: parseInt(userId),
      sessionId,
      actionType: 'LOGIN',
      actionCategory: 'AUTH',
      endpoint: req.originalUrl,
      method: req.method,
      responseStatus: 200,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      processingTimeMs: req.startTime ? Date.now() - req.startTime : undefined,
      metadata: {
        loginMethod: 'email_password',
        timestamp: new Date().toISOString()
      }
    });
  }

  static logLogout(userId, sessionId) {
    this.logAsync({
      userId: parseInt(userId),
      sessionId,
      actionType: 'LOGOUT',
      actionCategory: 'AUTH',
      responseStatus: 200,
      metadata: {
        logoutReason: 'USER_LOGOUT',
        timestamp: new Date().toISOString()
      }
    });
  }

  static logFailedLogin(email, req, reason = 'invalid_credentials') {
    this.logAsync({
      userId: null,  // Use null for failed login attempts
      actionType: 'FAILED_LOGIN',
      actionCategory: 'SECURITY',
      endpoint: req.originalUrl,
      method: req.method,
      responseStatus: 401,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      processingTimeMs: req.startTime ? Date.now() - req.startTime : undefined,
      metadata: {
        email,
        reason,
        timestamp: new Date().toISOString()
      }
    });
  }

  static logPasswordChange(userId, sessionId, req) {
    this.logAsync({
      userId: parseInt(userId),
      sessionId,
      actionType: 'CHANGE_PASSWORD',
      actionCategory: 'PROFILE',
      endpoint: req.originalUrl,
      method: req.method,
      responseStatus: 200,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      processingTimeMs: req.startTime ? Date.now() - req.startTime : undefined,
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  }

  static logProfileUpdate(userId, sessionId, req, updatedFields) {
    console.log('🔍 logProfileUpdate called:', { userId, sessionId, updatedFields });
    this.logAsync({
      userId: parseInt(userId),
      sessionId,
      actionType: 'Profile Update',
      actionCategory: 'PROFILE',
      endpoint: req.originalUrl,
      method: req.method,
      responseStatus: 200,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      processingTimeMs: req.startTime ? Date.now() - req.startTime : undefined,
      metadata: {
        updatedFields: updatedFields || [],
        timestamp: new Date().toISOString()
      }
    });
  }

  // Cleanup method for tests and graceful shutdown
  static cleanup() {
    console.log('🧹 Cleaning up MinimalActivityLogger...');
    
    // Disable logging
    this.setEnabled(false);
    
    // Clear queue
    logQueue = [];
    logCount = 0;
    
    // Clear window timer
    windowStart = Date.now();
    
    console.log('✅ MinimalActivityLogger cleanup complete');
  }
}

// Simple middleware - DISABLED API_CALL logging
const minimalActivityMiddleware = (req, res, next) => {
  if (!isLoggingEnabled) {
    return next();
  }

  // Set start time for other logging methods
  req.startTime = Date.now();

  // Skip automatic API_CALL logging - only use explicit logging methods
  // (logLogin, logLogout, logFailedLogin, logPasswordChange, etc.)
  
  next();
};

// Initialize queue processing interval
let queueProcessor = null;

// Start queue processor if not already running
if (!queueProcessor) {
  queueProcessor = setInterval(() => {
    MinimalActivityLogger.processQueuedLogs();
  }, THROTTLE_CONFIG.windowMs);
  
  // Track timer for test cleanup
  if (!global.__ACTIVITY_TIMERS__) {
    global.__ACTIVITY_TIMERS__ = [];
  }
  global.__ACTIVITY_TIMERS__.push(queueProcessor);
  
  // Cleanup on process exit
  process.on('exit', () => {
    if (queueProcessor) {
      clearInterval(queueProcessor);
      queueProcessor = null;
    }
  });
  
  // Cleanup on SIGTERM
  process.on('SIGTERM', () => {
    if (queueProcessor) {
      clearInterval(queueProcessor);
      queueProcessor = null;
    }
  });
  
  // Cleanup on SIGINT
  process.on('SIGINT', () => {
    if (queueProcessor) {
      clearInterval(queueProcessor);
      queueProcessor = null;
    }
  });
}

// Global cleanup function for tests
const cleanupGlobalTimers = () => {
  if (queueProcessor) {
    clearInterval(queueProcessor);
    queueProcessor = null;
    console.log('🧹 Cleared activity logger global timer');
  }
};

module.exports = {
  MinimalActivityLogger,
  minimalActivityMiddleware,
  cleanupGlobalTimers
};

// CommonJS only - remove ES6 export for Node.js compatibility