export interface User {
  id: number;
  email: string;
  name: string;
  full_name?: string;
  emailVerified: boolean;
  email_verified?: boolean;
  avatar_url?: string;
  date_of_birth?: string;
  created_at?: string;
  updated_at?: string;
  role?: string; // Added role property for compatibility
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  terms: boolean;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: ValidationError[];
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    token: string;
    user: User;
  };
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ResetTokenValidation {
  valid: boolean;
}