import React, { createContext, useContext, useReducer, useEffect, useRef, ReactNode } from 'react';
import { 
  User, 
  AuthState, 
  LoginCredentials, 
  RegisterData,
  ForgotPasswordData,
  ResetPasswordData,
  ChangePasswordData 
} from '../types/auth';
import { apiService } from '../services/api';
import { toast } from 'react-hot-toast';
import { logger } from '../utils/logger';

// Auth Actions
type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'AUTH_FAILURE' }
  | { type: 'LOGOUT' }
  | { type: 'SET_USER'; payload: User }
  | { type: 'SET_LOADING'; payload: boolean };

// Auth Context Type
interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<boolean>;
  register: (data: RegisterData) => Promise<boolean>;
  logout: () => void;
  forgotPassword: (data: ForgotPasswordData) => Promise<boolean>;
  resetPassword: (data: ResetPasswordData) => Promise<boolean>;
  changePassword: (data: ChangePasswordData) => Promise<boolean>;
  checkAuth: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

// Initial State
const initialState: AuthState = {
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
};

// Reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTH_START':
      return { ...state, isLoading: true };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isLoading: false,
        isAuthenticated: true,
      };
    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
      };
    case 'LOGOUT':
      return { ...initialState, isLoading: false };
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
};

// Create Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider Component
export const OptimizedAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const isCheckingAuth = useRef(false);
  const checkAuthTimeout = useRef<NodeJS.Timeout>();

  // Check authentication status on mount with debounce
  useEffect(() => {
    // Prevent multiple simultaneous auth checks
    if (isCheckingAuth.current) return;
    
    // Debounce auth check to prevent rapid calls
    if (checkAuthTimeout.current) {
      clearTimeout(checkAuthTimeout.current);
    }

    checkAuthTimeout.current = setTimeout(() => {
      checkAuth();
    }, 100);

    return () => {
      if (checkAuthTimeout.current) {
        clearTimeout(checkAuthTimeout.current);
      }
    };
  }, []);

  // Check authentication
  const checkAuth = async (): Promise<void> => {
    // Prevent concurrent auth checks
    if (isCheckingAuth.current) return;
    isCheckingAuth.current = true;

    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const token = apiService.getToken();
      if (!token) {
        dispatch({ type: 'AUTH_FAILURE' });
        return;
      }

      const response = await apiService.getCurrentUser();
      if (response.success && response.data?.user) {
        dispatch({ 
          type: 'AUTH_SUCCESS', 
          payload: { user: response.data.user, token } 
        });
      } else {
        dispatch({ type: 'AUTH_FAILURE' });
        apiService.clearAuth();
      }
    } catch (error) {
      logger.error('Auth check failed:', error);
      dispatch({ type: 'AUTH_FAILURE' });
      apiService.clearAuth();
    } finally {
      isCheckingAuth.current = false;
    }
  };

  // Login
  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    try {
      dispatch({ type: 'AUTH_START' });
      
      const response = await apiService.login(credentials);
      
      if (response.success && response.data?.token && response.data?.user) {
        apiService.setToken(response.data.token);
        dispatch({ 
          type: 'AUTH_SUCCESS', 
          payload: { user: response.data.user, token: response.data.token } 
        });
        
        // Refresh user data to get complete profile
        try {
          const userResponse = await apiService.getCurrentUser();
          if (userResponse.success && userResponse.data?.user) {
            dispatch({ type: 'SET_USER', payload: userResponse.data.user });
          }
        } catch (error) {
          logger.warn('Failed to refresh user data:', error);
        }
        
        toast.success('Login successful!');
        return true;
      } else {
        const errorMessage = response.error || 'Login failed';
        dispatch({ type: 'AUTH_FAILURE' });
        toast.error(errorMessage);
        return false;
      }
    } catch (error: any) {
      dispatch({ type: 'AUTH_FAILURE' });
      const errorMessage = error.response?.data?.error || 'Login failed';
      toast.error(errorMessage);
      return false;
    }
  };

  // Register
  const register = async (data: RegisterData): Promise<boolean> => {
    try {
      dispatch({ type: 'AUTH_START' });
      
      const response = await apiService.register(data);
      
      if (response.success) {
        dispatch({ type: 'AUTH_FAILURE' }); // Reset to login state
        toast.success('Registration successful! Please check your email for verification.');
        return true;
      } else {
        dispatch({ type: 'AUTH_FAILURE' });
        toast.error(response.error || 'Registration failed');
        return false;
      }
    } catch (error: any) {
      dispatch({ type: 'AUTH_FAILURE' });
      const errorMessage = error.response?.data?.error || 'Registration failed';
      toast.error(errorMessage);
      return false;
    }
  };

  // Logout
  const logout = () => {
    apiService.clearAuth();
    dispatch({ type: 'LOGOUT' });
    toast.success('Logged out successfully');
  };

  // Forgot Password
  const forgotPassword = async (data: ForgotPasswordData): Promise<boolean> => {
    try {
      const response = await apiService.forgotPassword(data);
      
      if (response.success) {
        toast.success('Password reset link sent to your email');
        return true;
      } else {
        toast.error(response.error || 'Failed to send reset link');
        return false;
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to send reset link';
      toast.error(errorMessage);
      return false;
    }
  };

  // Reset Password
  const resetPassword = async (data: ResetPasswordData): Promise<boolean> => {
    try {
      const response = await apiService.resetPassword(data);
      
      if (response.success) {
        toast.success('Password reset successful! You can now log in.');
        return true;
      } else {
        toast.error(response.error || 'Failed to reset password');
        return false;
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to reset password';
      toast.error(errorMessage);
      return false;
    }
  };

  // Change Password
  const changePassword = async (data: ChangePasswordData): Promise<boolean> => {
    try {
      const response = await apiService.changePassword(data);
      
      if (response.success) {
        toast.success('Password changed successfully');
        return true;
      } else {
        toast.error(response.error || 'Failed to change password');
        return false;
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to change password';
      toast.error(errorMessage);
      return false;
    }
  };

  // Refresh User
  const refreshUser = async (): Promise<void> => {
    try {
      const response = await apiService.getCurrentUser();
      if (response.success && response.data?.user) {
        dispatch({ type: 'SET_USER', payload: response.data.user });
      }
    } catch (error) {
      logger.error('Failed to refresh user:', error);
    }
  };

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    changePassword,
    checkAuth,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default OptimizedAuthProvider;