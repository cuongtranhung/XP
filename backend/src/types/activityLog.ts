// Activity logging types and interfaces
// Date: 2025-08-04

// Enums for activity types
export enum ActionType {
  // Authentication
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  FAILED_LOGIN = 'FAILED_LOGIN',
  
  // Profile Management
  VIEW_PROFILE = 'VIEW_PROFILE',
  UPDATE_PROFILE = 'UPDATE_PROFILE',
  CHANGE_PASSWORD = 'CHANGE_PASSWORD',
  UPLOAD_AVATAR = 'UPLOAD_AVATAR',
  
  // Settings
  VIEW_SETTINGS = 'VIEW_SETTINGS',
  UPDATE_SETTINGS = 'UPDATE_SETTINGS',
  
  // Navigation
  VIEW_DASHBOARD = 'VIEW_DASHBOARD',
  VIEW_PAGE = 'VIEW_PAGE',
  
  // API Calls
  API_CALL = 'API_CALL',
  
  // Security Events
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  
  // System
  ERROR_OCCURRED = 'ERROR_OCCURRED'
}

export enum ActionCategory {
  AUTH = 'AUTH',
  PROFILE = 'PROFILE',
  SETTINGS = 'SETTINGS',
  NAVIGATION = 'NAVIGATION',
  SECURITY = 'SECURITY',
  SYSTEM = 'SYSTEM'
}

export enum LogoutReason {
  USER_LOGOUT = 'USER_LOGOUT',
  TIMEOUT = 'TIMEOUT',
  FORCED = 'FORCED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  SECURITY_LOGOUT = 'SECURITY_LOGOUT'
}

// Core interfaces
export interface ActivityLogData {
  userId: number;
  sessionId?: string | undefined;
  actionType: ActionType;
  actionCategory: ActionCategory;
  endpoint?: string | undefined;
  method?: string | undefined;
  resourceType?: string | undefined;
  resourceId?: string | undefined;
  requestData?: Record<string, any> | undefined;
  responseStatus?: number | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  referrer?: string | undefined;
  browserInfo?: BrowserInfo | undefined;
  locationInfo?: LocationInfo | undefined;
  processingTimeMs?: number | undefined;
  metadata?: Record<string, any> | undefined;
}

export interface ActivityLog {
  id: string;
  userId: number;
  sessionId?: string;
  actionType: ActionType;
  actionCategory: ActionCategory;
  endpoint?: string;
  method?: string;
  resourceType?: string;
  resourceId?: string;
  requestData?: Record<string, any>;
  responseStatus?: number;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  browserInfo?: BrowserInfo;
  locationInfo?: LocationInfo;
  createdAt: Date;
  processingTimeMs?: number;
  metadata?: Record<string, any>;
}

export interface UserSession {
  id: string;
  userId: number;
  createdAt: Date;
  lastActivity: Date;
  expiresAt?: Date;
  ipAddress?: string;
  userAgent?: string;
  browserInfo?: BrowserInfo;
  locationInfo?: LocationInfo;
  isActive: boolean;
  logoutReason?: LogoutReason;
  metadata?: Record<string, any>;
}

export interface BrowserInfo {
  browser?: string;
  version?: string;
  os?: string;
  device?: string;
  isMobile?: boolean;
}

export interface LocationInfo {
  country?: string;
  city?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
}

// Query interfaces
export interface ActivityFilters {
  userId?: number;
  sessionId?: string;
  actionType?: ActionType | ActionType[];
  actionCategory?: ActionCategory | ActionCategory[];
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  endpoint?: string;
  method?: string;
  responseStatus?: number | number[];
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'processing_time_ms';
  sortOrder?: 'ASC' | 'DESC';
}

export interface SecurityFilters {
  userId?: number;
  startDate?: Date;
  endDate?: Date;
  includeFailedLogins?: boolean;
  includeSuspiciousActivity?: boolean;
  ipAddress?: string;
  minEventCount?: number;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

// Statistics interfaces
export interface ActivityStats {
  totalActions: number;
  actionsByType: Record<ActionType, number>;
  actionsByCategory: Record<ActionCategory, number>;
  actionsByHour: Array<{ hour: number; count: number }>;
  actionsByDay: Array<{ date: string; count: number }>;
  topPages: Array<{ page: string; views: number }>;
  averageSessionDuration?: number;
  uniqueSessions: number;
  securityEvents: number;
  errorRate: number;
  averageResponseTime?: number;
}

export interface SecurityEvent {
  userId: number;
  suspiciousType: string;
  eventCount: number;
  firstEvent: Date;
  lastEvent: Date;
  details: Record<string, any>;
  riskScore: number;
}

export interface TimeRange {
  startDate: Date;
  endDate: Date;
}

// Request/Response interfaces for API
export interface LogActivityRequest {
  actionType: ActionType;
  actionCategory?: ActionCategory;
  endpoint?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
}

export interface GetActivityLogsRequest {
  filters?: ActivityFilters;
  pagination?: {
    page?: number;
    limit?: number;
  };
}

export interface ActivityLogResponse {
  success: boolean;
  data: {
    logs: ActivityLog[];
    pagination: {
      page: number;
      limit: number;
      total: number;
    };
    filters: ActivityFilters;
  };
  message?: string;
}

export interface ActivityStatsResponse {
  success: boolean;
  data: ActivityStats;
  message?: string;
}

// Utility types
export type CreateActivityLogData = Omit<ActivityLog, 'id' | 'createdAt'>;
export type UpdateSessionData = Partial<Pick<UserSession, 'lastActivity' | 'isActive' | 'logoutReason' | 'metadata'>>;

// Configuration interfaces
export interface ActivityLogConfig {
  enabled: boolean;
  logAllRequests: boolean;
  logRequestData: boolean;
  logResponseData: boolean;
  excludedEndpoints: string[];
  sensitiveFields: string[];
  maxRequestDataSize: number;
  retentionDays: number;
  enableRealTimeAlerts: boolean;
  suspiciousActivityThresholds: {
    failedLoginsPerHour: number;
    multipleLocationsPerHour: number;
    requestsPerMinute: number;
  };
}

// Error interfaces
export interface ActivityLogError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, any>;
}