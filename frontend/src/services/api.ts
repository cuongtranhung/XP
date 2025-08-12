import axios, { AxiosInstance, AxiosError } from 'axios';
import { 
  LoginCredentials, 
  RegisterData, 
  ForgotPasswordData,
  ResetPasswordData,
  ChangePasswordData,
  AuthResponse,
  ApiResponse,
  User,
  ResetTokenValidation 
} from '../types/auth';
import { toast } from 'react-hot-toast';

class ApiService {
  private client: AxiosInstance;
  private token: string | null = null;
  private isLoggingOut: boolean = false;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
      timeout: 30000, // Increased from 10s to 30s to handle backend database timeouts
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Load token from localStorage on initialization
    this.token = localStorage.getItem('auth_token');
    if (this.token) {
      this.setAuthHeader(this.token);
    }

    // Request interceptor to ensure token is always sent
    this.client.interceptors.request.use(
      (config) => {
        // Always check for token before each request
        const currentToken = this.token || localStorage.getItem('auth_token');
        if (currentToken && !config.headers['Authorization']) {
          config.headers['Authorization'] = `Bearer ${currentToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        this.handleApiError(error);
        return Promise.reject(error);
      }
    );
  }

  private setAuthHeader(token: string): void {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  private removeAuthHeader(): void {
    delete this.client.defaults.headers.common['Authorization'];
  }

  private handleApiError(error: AxiosError): void {
    if (error.response && error.response.status === 401) {
      // Token expired or invalid
      this.clearAuth();
      // Only show session expiry message if NOT in logout process
      if (!this.isLoggingOut && window.location.pathname !== '/login') {
        toast.error('Session expired. Please login again.');
        window.location.href = '/login';
      }
    } else if (error.response && error.response.status === 429) {
      toast.error('Too many requests. Please slow down.');
    } else if (error.response && error.response.status >= 500) {
      toast.error('Server error. Please try again later.');
    } else if (error.code === 'ECONNABORTED') {
      toast.error('Request timeout. Please check your connection.');
    } else if (!error.response) {
      toast.error('Network error. Please check your connection.');
    }
  }

  // Set authentication token
  setToken(token: string): void {
    this.token = token;
    localStorage.setItem('auth_token', token);
    this.setAuthHeader(token);
  }

  // Clear authentication
  clearAuth(): void {
    this.token = null;
    localStorage.removeItem('auth_token');
    this.removeAuthHeader();
  }

  // Set logout context to prevent session expiry warnings
  setLogoutContext(): void {
    this.isLoggingOut = true;
  }

  // Clear logout context
  clearLogoutContext(): void {
    this.isLoggingOut = false;
  }

  // Get current token
  getToken(): string | null {
    return this.token;
  }

  // Register new user
  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/api/auth/register', data);
    return response.data;
  }

  // Login user
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/api/auth/login', credentials);
    return response.data;
  }

  // Get current user
  async getCurrentUser(): Promise<ApiResponse<{ user: User }>> {
    const response = await this.client.get<ApiResponse<{ user: User }>>('/api/auth/me');
    return response.data;
  }

  // Logout user
  async logout(): Promise<ApiResponse> {
    // Set logout context to prevent session expiry warnings
    this.setLogoutContext();
    
    try {
      const response = await this.client.post<ApiResponse>('/api/auth/logout');
      return response.data;
    } finally {
      // Always clear logout context after logout attempt
      this.clearLogoutContext();
    }
  }

  // Forgot password
  async forgotPassword(data: ForgotPasswordData): Promise<ApiResponse> {
    const response = await this.client.post<ApiResponse>('/api/auth/forgot-password', data);
    return response.data;
  }

  // Verify reset token
  async verifyResetToken(token: string): Promise<ApiResponse<ResetTokenValidation>> {
    const response = await this.client.get<ApiResponse<ResetTokenValidation>>(
      `/api/auth/verify-reset-token/${token}`
    );
    return response.data;
  }

  // Reset password
  async resetPassword(data: ResetPasswordData): Promise<ApiResponse> {
    const response = await this.client.post<ApiResponse>('/api/auth/reset-password', data);
    return response.data;
  }

  // Change password
  async changePassword(data: ChangePasswordData): Promise<ApiResponse> {
    const response = await this.client.post<ApiResponse>('/api/auth/change-password', data);
    return response.data;
  }

  // Update profile
  async updateProfile(data: { fullName?: string; email?: string; avatarUrl?: string; dateOfBirth?: string }): Promise<ApiResponse<{ user: User }>> {
    console.log('🔍 updateProfile called with:', data);
    console.log('🔍 Current token:', this.token ? `${this.token.substring(0, 20)}...` : 'No token');
    console.log('🔍 Token from localStorage:', localStorage.getItem('auth_token') ? 'Found' : 'Not found');
    
    const response = await this.client.put<ApiResponse<{ user: User }>>('/api/auth/profile', data);
    return response.data;
  }

  // Resend email verification
  async resendEmailVerification(email: string): Promise<ApiResponse> {
    const response = await this.client.post<ApiResponse>('/api/auth/resend-verification', { email });
    return response.data;
  }

  // Health check
  async healthCheck(): Promise<ApiResponse> {
    const response = await this.client.get<ApiResponse>('/health');
    return response.data;
  }

  // Generic HTTP methods for other services to use
  async get<T = any>(url: string, config?: any): Promise<{ data: T }> {
    return this.client.get<T>(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: any): Promise<{ data: T }> {
    return this.client.post<T>(url, data, config);
  }

  async put<T = any>(url: string, data?: any, config?: any): Promise<{ data: T }> {
    return this.client.put<T>(url, data, config);
  }

  async patch<T = any>(url: string, data?: any, config?: any): Promise<{ data: T }> {
    return this.client.patch<T>(url, data, config);
  }

  async delete<T = any>(url: string, config?: any): Promise<{ data: T }> {
    return this.client.delete<T>(url, config);
  }
}

// Export singleton instance
export const apiService = new ApiService();

// Export as default as well for convenience
export default apiService;