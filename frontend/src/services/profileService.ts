import axios, { AxiosInstance } from 'axios';
import { 
  UserProfile,
  ProfileUpdateData,
  AvatarUploadResponse,
  PasswordChangeData,
  TwoFactorSetupData,
  UserPreferences,
  SecuritySettings,
  ActiveSession
} from '../types/profile';

export class ProfileService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for authentication
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('Profile API Error:', error);
        return Promise.reject(error);
      }
    );
  }

  // Get current user's profile
  async getCurrentProfile(): Promise<{
    success: boolean;
    data: UserProfile;
  }> {
    const response = await this.api.get('/api/profile/me');
    return response.data;
  }

  // Update profile information
  async updateProfile(data: ProfileUpdateData): Promise<{
    success: boolean;
    data: UserProfile;
    message: string;
  }> {
    const response = await this.api.put('/api/profile/me', data);
    return response.data;
  }

  // Upload avatar
  async uploadAvatar(file: File): Promise<AvatarUploadResponse> {
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await this.api.post('/api/profile/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // Update avatar with optimized data
  async updateAvatarFromDataUrl(dataUrl: string, originalFileName: string): Promise<AvatarUploadResponse> {
    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    
    // Create file from blob
    const file = new File([blob], originalFileName, { type: blob.type });
    
    return this.uploadAvatar(file);
  }

  // Remove avatar
  async removeAvatar(): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await this.api.delete('/api/profile/avatar');
    return response.data;
  }

  // Upload cover image
  async uploadCoverImage(file: File): Promise<{
    success: boolean;
    data: {
      cover_image_url: string;
      thumbnail_url?: string;
    };
    message: string;
  }> {
    const formData = new FormData();
    formData.append('cover_image', file);

    const response = await this.api.post('/api/profile/cover-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // Update preferences
  async updatePreferences(preferences: Partial<UserPreferences>): Promise<{
    success: boolean;
    data: UserPreferences;
    message: string;
  }> {
    const response = await this.api.put('/api/profile/preferences', preferences);
    return response.data;
  }

  // Change password
  async changePassword(passwordData: PasswordChangeData): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await this.api.put('/api/profile/change-password', passwordData);
    return response.data;
  }

  // Two-Factor Authentication
  async setupTwoFactor(): Promise<{
    success: boolean;
    data: TwoFactorSetupData;
  }> {
    const response = await this.api.post('/api/profile/2fa/setup');
    return response.data;
  }

  async verifyTwoFactor(verificationCode: string): Promise<{
    success: boolean;
    data: {
      backup_codes: string[];
    };
    message: string;
  }> {
    const response = await this.api.post('/api/profile/2fa/verify', {
      verification_code: verificationCode
    });
    return response.data;
  }

  async disableTwoFactor(password: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await this.api.post('/api/profile/2fa/disable', {
      password
    });
    return response.data;
  }

  async regenerateBackupCodes(): Promise<{
    success: boolean;
    data: {
      backup_codes: string[];
    };
    message: string;
  }> {
    const response = await this.api.post('/api/profile/2fa/regenerate-codes');
    return response.data;
  }

  // Security Settings
  async getActiveSessions(): Promise<{
    success: boolean;
    data: ActiveSession[];
  }> {
    const response = await this.api.get('/api/profile/security/sessions');
    return response.data;
  }

  async revokeSession(sessionId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await this.api.delete(`/api/profile/security/sessions/${sessionId}`);
    return response.data;
  }

  async revokeAllSessions(): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await this.api.delete('/api/profile/security/sessions');
    return response.data;
  }

  async updateSecuritySettings(settings: Partial<SecuritySettings>): Promise<{
    success: boolean;
    data: SecuritySettings;
    message: string;
  }> {
    const response = await this.api.put('/api/profile/security/settings', settings);
    return response.data;
  }

  // Export profile data
  async exportProfileData(): Promise<{
    success: boolean;
    data: {
      download_url: string;
      filename: string;
      expires_at: string;
    };
    message: string;
  }> {
    const response = await this.api.post('/api/profile/export');
    return response.data;
  }

  // Delete account
  async deleteAccount(password: string, reason?: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await this.api.post('/api/profile/delete-account', {
      password,
      reason
    });
    return response.data;
  }

  // Account verification
  async sendEmailVerification(): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await this.api.post('/api/profile/send-verification');
    return response.data;
  }

  async verifyEmail(token: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await this.api.post('/api/profile/verify-email', {
      token
    });
    return response.data;
  }

  // Activity logs
  async getActivityLogs(page: number = 1, limit: number = 20): Promise<{
    success: boolean;
    data: {
      logs: any[];
      total: number;
      page: number;
      totalPages: number;
    };
  }> {
    const response = await this.api.get(`/api/profile/activity?page=${page}&limit=${limit}`);
    return response.data;
  }
}

// Export singleton instance
export const profileService = new ProfileService();
export default profileService;