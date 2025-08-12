// Type definitions for minimalActivityLogger.js
import { Request, Response, NextFunction } from 'express';

export interface ActivityLogData {
  userId?: number | null;
  sessionId?: string | null;
  actionType?: string;
  actionCategory?: string;
  endpoint?: string;
  method?: string;
  responseStatus?: number;
  ipAddress?: string;
  userAgent?: string;
  processingTimeMs?: number;
  metadata?: any;
}

export class MinimalActivityLogger {
  static setEnabled(enabled: boolean): void;
  static isEnabled(): boolean;
  static log(data: ActivityLogData): Promise<boolean>;
  static logAsync(data: ActivityLogData): void;
  static getClientIP(req: Request): string;
  static logLogin(userId: string | number, sessionId: string, req: Request): void;
  static logLogout(userId: string | number, sessionId: string): void;
  static logFailedLogin(email: string, req: Request, reason?: string): void;
  static logPasswordChange(userId: string | number, sessionId: string, req: Request): void;
}

export function minimalActivityMiddleware(req: Request, res: Response, next: NextFunction): void;