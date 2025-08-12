import axios from 'axios';
import { profileService, ProfileService } from '../../services/profileService';
import { UserProfile, ProfileUpdateData } from '../../types/profile';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

describe('ProfileService', () => {
  let service: ProfileService;
  let mockAxiosInstance: jest.Mocked<any>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('mock-token');

    // Create mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      }
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    // Create new service instance
    service = new ProfileService();
  });

  describe('constructor', () => {
    it('creates axios instance with correct config', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:5000',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('sets up request interceptor for authentication', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
    });

    it('sets up response interceptor for error handling', () => {
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('getCurrentProfile', () => {
    it('fetches current user profile successfully', async () => {
      const mockProfile: UserProfile = {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        full_name: 'John Doe',
        preferences: {
          theme: 'light',
          language: 'en',
          timezone: 'UTC',
          date_format: 'MM/DD/YYYY',
          time_format: '12h',
          notification_settings: {
            email_notifications: true,
            push_notifications: true,
            sms_notifications: false,
            marketing_emails: true,
            security_alerts: true,
            system_updates: true,
            weekly_summary: true
          },
          privacy_settings: {
            profile_visibility: 'public',
            show_email: true,
            show_phone: false,
            show_location: true,
            show_last_seen: true,
            allow_search: true
          }
        },
        security: {
          two_factor_enabled: false,
          login_alerts: true,
          session_timeout: 30,
          backup_codes_count: 0,
          active_sessions: []
        },
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        is_verified: true,
        is_active: true
      } as UserProfile;

      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, data: mockProfile }
      });

      const result = await service.getCurrentProfile();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/profile/me');
      expect(result).toEqual({ success: true, data: mockProfile });
    });

    it('handles error when fetching profile fails', async () => {
      const error = new Error('Network error');
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(service.getCurrentProfile()).rejects.toThrow('Network error');
    });
  });

  describe('updateProfile', () => {
    it('updates profile successfully', async () => {
      const updateData: ProfileUpdateData = {
        full_name: 'Jane Doe',
        department: 'Marketing'
      };

      const updatedProfile = {
        id: '1',
        full_name: 'Jane Doe',
        department: 'Marketing'
      };

      mockAxiosInstance.put.mockResolvedValue({
        data: {
          success: true,
          data: updatedProfile,
          message: 'Profile updated successfully'
        }
      });

      const result = await service.updateProfile(updateData);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/profile/me', updateData);
      expect(result).toEqual({
        success: true,
        data: updatedProfile,
        message: 'Profile updated successfully'
      });
    });
  });

  describe('uploadAvatar', () => {
    it('uploads avatar successfully', async () => {
      const file = new File(['avatar'], 'avatar.jpg', { type: 'image/jpeg' });
      const mockResponse = {
        success: true,
        data: {
          avatar_url: 'https://example.com/avatar.jpg',
          thumbnail_url: 'https://example.com/avatar-thumb.jpg',
          original_filename: 'avatar.jpg',
          file_size: 12345,
          mime_type: 'image/jpeg'
        },
        message: 'Avatar uploaded successfully'
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const result = await service.uploadAvatar(file);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/profile/avatar',
        expect.any(FormData),
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('updateAvatarFromDataUrl', () => {
    it('converts data URL to file and uploads avatar', async () => {
      const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAA...';
      const filename = 'avatar.jpg';

      // Mock fetch for data URL conversion
      global.fetch = jest.fn().mockResolvedValue({
        blob: () => Promise.resolve(new Blob(['avatar'], { type: 'image/jpeg' }))
      });

      const mockResponse = {
        success: true,
        data: {
          avatar_url: 'https://example.com/avatar.jpg',
          thumbnail_url: 'https://example.com/avatar-thumb.jpg',
          original_filename: 'avatar.jpg',
          file_size: 12345,
          mime_type: 'image/jpeg'
        },
        message: 'Avatar uploaded successfully'
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const result = await service.updateAvatarFromDataUrl(dataUrl, filename);

      expect(global.fetch).toHaveBeenCalledWith(dataUrl);
      expect(mockAxiosInstance.post).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });
  });

  describe('removeAvatar', () => {
    it('removes avatar successfully', async () => {
      const mockResponse = {
        success: true,
        message: 'Avatar removed successfully'
      };

      mockAxiosInstance.delete.mockResolvedValue({ data: mockResponse });

      const result = await service.removeAvatar();

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/profile/avatar');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('updatePreferences', () => {
    it('updates preferences successfully', async () => {
      const preferences = {
        theme: 'dark' as const,
        language: 'es'
      };

      const mockResponse = {
        success: true,
        data: preferences,
        message: 'Preferences updated successfully'
      };

      mockAxiosInstance.put.mockResolvedValue({ data: mockResponse });

      const result = await service.updatePreferences(preferences);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/profile/preferences', preferences);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('changePassword', () => {
    it('changes password successfully', async () => {
      const passwordData = {
        current_password: 'oldpass',
        new_password: 'newpass',
        confirm_password: 'newpass'
      };

      const mockResponse = {
        success: true,
        message: 'Password changed successfully'
      };

      mockAxiosInstance.put.mockResolvedValue({ data: mockResponse });

      const result = await service.changePassword(passwordData);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/profile/change-password', passwordData);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('setupTwoFactor', () => {
    it('sets up two-factor authentication successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          secret: 'JBSWY3DPEHPK3PXP',
          qr_code: 'data:image/png;base64,iVBOR...'
        }
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const result = await service.setupTwoFactor();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/profile/2fa/setup');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('verifyTwoFactor', () => {
    it('verifies two-factor authentication successfully', async () => {
      const verificationCode = '123456';
      const mockResponse = {
        success: true,
        data: {
          backup_codes: ['code1', 'code2', 'code3']
        },
        message: '2FA enabled successfully'
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const result = await service.verifyTwoFactor(verificationCode);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/profile/2fa/verify', {
        verification_code: verificationCode
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getActiveSessions', () => {
    it('fetches active sessions successfully', async () => {
      const mockSessions = [
        {
          id: '1',
          device: 'Desktop',
          browser: 'Chrome',
          os: 'Windows',
          ip_address: '192.168.1.1',
          location: 'New York, US',
          last_activity: '2024-01-01T12:00:00Z',
          is_current: true
        }
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, data: mockSessions }
      });

      const result = await service.getActiveSessions();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/profile/security/sessions');
      expect(result).toEqual({ success: true, data: mockSessions });
    });
  });

  describe('revokeSession', () => {
    it('revokes session successfully', async () => {
      const sessionId = 'session-1';
      const mockResponse = {
        success: true,
        message: 'Session revoked successfully'
      };

      mockAxiosInstance.delete.mockResolvedValue({ data: mockResponse });

      const result = await service.revokeSession(sessionId);

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(`/api/profile/security/sessions/${sessionId}`);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('exportProfileData', () => {
    it('exports profile data successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          download_url: 'https://example.com/export.zip',
          filename: 'profile-export-2024.zip',
          expires_at: '2024-01-02T00:00:00Z'
        },
        message: 'Export generated successfully'
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const result = await service.exportProfileData();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/profile/export');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('deleteAccount', () => {
    it('deletes account successfully', async () => {
      const password = 'password123';
      const reason = 'No longer needed';
      const mockResponse = {
        success: true,
        message: 'Account deletion initiated'
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const result = await service.deleteAccount(password, reason);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/profile/delete-account', {
        password,
        reason
      });
      expect(result).toEqual(mockResponse);
    });

    it('deletes account without reason', async () => {
      const password = 'password123';
      const mockResponse = {
        success: true,
        message: 'Account deletion initiated'
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const result = await service.deleteAccount(password);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/profile/delete-account', {
        password,
        reason: undefined
      });
      expect(result).toEqual(mockResponse);
    });
  });
});