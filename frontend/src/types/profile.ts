// User Profile Management Types

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  department?: string;
  position?: string;
  bio?: string;
  location?: string;
  timezone?: string;
  language?: string;
  avatar_url?: string | null;
  cover_image_url?: string | null;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  website?: string;
  social_links?: {
    linkedin?: string;
    twitter?: string;
    github?: string;
    facebook?: string;
  };
  preferences: UserPreferences;
  security: SecuritySettings;
  created_at: string;
  updated_at: string;
  last_login?: string;
  is_verified: boolean;
  is_active: boolean;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  date_format: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  time_format: '12h' | '24h';
  notification_settings: NotificationSettings;
  privacy_settings: PrivacySettings;
}

export interface NotificationSettings {
  email_notifications: boolean;
  push_notifications: boolean;
  sms_notifications: boolean;
  marketing_emails: boolean;
  security_alerts: boolean;
  system_updates: boolean;
  weekly_summary: boolean;
}

export interface PrivacySettings {
  profile_visibility: 'public' | 'private' | 'team_only';
  show_email: boolean;
  show_phone: boolean;
  show_location: boolean;
  show_last_seen: boolean;
  allow_search: boolean;
}

export interface SecuritySettings {
  two_factor_enabled: boolean;
  login_alerts: boolean;
  session_timeout: number; // minutes
  backup_codes_count: number;
  active_sessions: ActiveSession[];
}

export interface ActiveSession {
  id: string;
  device: string;
  browser: string;
  os: string;
  ip_address: string;
  location?: string;
  last_activity: string;
  is_current: boolean;
}

export interface ProfileUpdateData {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  department?: string;
  position?: string;
  bio?: string;
  location?: string;
  timezone?: string;
  language?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  website?: string;
  social_links?: {
    linkedin?: string;
    twitter?: string;
    github?: string;
    facebook?: string;
  };
}

export interface AvatarUploadResponse {
  success: boolean;
  data: {
    avatar_url: string;
    thumbnail_url?: string;
    original_filename: string;
    file_size: number;
    mime_type: string;
  };
  message: string;
}

export interface PasswordChangeData {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface TwoFactorSetupData {
  secret?: string;
  qr_code?: string;
  backup_codes?: string[];
  verification_code?: string;
}

// Validation schemas
export interface ProfileValidationErrors {
  [key: string]: string[];
}

// Form states
export type ProfileFormSection = 
  | 'basic_info' 
  | 'contact_info' 
  | 'professional_info' 
  | 'preferences' 
  | 'security' 
  | 'privacy';

export interface ProfileFormState {
  activeSection: ProfileFormSection;
  isDirty: boolean;
  isLoading: boolean;
  errors: ProfileValidationErrors;
}