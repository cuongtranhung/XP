import { Request } from 'express';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

interface LogContext {
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: Record<string, any> | undefined;
}

class Logger {
  private logLevel: LogLevel;

  constructor() {
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    return levels.indexOf(level) <= levels.indexOf(this.logLevel);
  }

  private formatLog(level: LogLevel, message: string, meta?: Record<string, any>): LogContext {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta
    };
  }

  private output(logContext: LogContext): void {
    const { timestamp, level, message, meta } = logContext;
    const metaString = meta ? ` ${JSON.stringify(meta)}` : '';
    
    const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}${metaString}`;
    
    switch (level) {
      case LogLevel.ERROR:
        console.error(logMessage);
        break;
      case LogLevel.WARN:
        console.warn(logMessage);
        break;
      case LogLevel.DEBUG:
        console.debug(logMessage);
        break;
      default:
        console.log(logMessage);
    }
  }

  error(message: string, meta?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.output(this.formatLog(LogLevel.ERROR, message, meta));
    }
  }

  warn(message: string, meta?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.output(this.formatLog(LogLevel.WARN, message, meta));
    }
  }

  info(message: string, meta?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.output(this.formatLog(LogLevel.INFO, message, meta));
    }
  }

  debug(message: string, meta?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.output(this.formatLog(LogLevel.DEBUG, message, meta));
    }
  }

  // Log HTTP requests
  logRequest(req: Request): void {
    this.info('HTTP Request', {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  }

  // Log authentication events
  logAuth(event: string, email?: string, meta?: Record<string, any>): void {
    this.info(`Auth: ${event}`, {
      email,
      ...meta
    });
  }

  // Log security events
  logSecurity(event: string, meta?: Record<string, any>): void {
    this.warn(`Security: ${event}`, meta);
  }
}

export const logger = new Logger();