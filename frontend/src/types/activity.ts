// Activity Log Types for Frontend
// Date: 2025-08-04

export interface ActivityLog {
  id: number;
  user_id: number;
  session_id?: string;
  action_type: string;
  action_category: string;
  endpoint?: string;
  method?: string;
  response_status?: number;
  ip_address?: string;
  user_agent?: string;
  processing_time_ms?: number;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface ActivityLogResponse {
  success: boolean;
  data: {
    logs: ActivityLog[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  message?: string;
}

export interface ActivityControlStatus {
  success: boolean;
  data: {
    enabled: boolean;
    environment: string;
    asyncLogging: boolean;
  };
  message?: string;
}

export interface ActivityControlToggle {
  success: boolean;
  data: {
    enabled: boolean;
  };
  message?: string;
}

export interface ActivityLogFilters {
  action_type?: string;
  action_category?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

// Action types for display
export const ACTION_TYPES = {
  'LOGIN': 'Login',
  'LOGOUT': 'Logout',
  'FAILED_LOGIN': 'Failed Login',
  'CHANGE_PASSWORD': 'Password Change',
  'API_CALL': 'API Call',
  'Profile Update': 'Profile Update'
} as const;

// Action categories for display
export const ACTION_CATEGORIES = {
  AUTH: 'Authentication',
  SECURITY: 'Security',
  PROFILE: 'Profile',
  SYSTEM: 'System',
  API: 'API'
} as const;

// Status colors for display
export const STATUS_COLORS = {
  200: 'text-green-600',
  201: 'text-green-600',
  400: 'text-yellow-600',
  401: 'text-red-600',
  403: 'text-red-600',
  404: 'text-yellow-600',
  500: 'text-red-600'
} as const;