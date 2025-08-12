import React, { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react';
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
      return {
        ...state,
        isLoading: true,
      };
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
      return {
        ...initialState,
        isLoading: false,
      };
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    default:
      return state;
  }
};

// Create Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider Props
interface AuthProviderProps {
  children: ReactNode;
}

// Provider Component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check authentication - memoized to prevent infinite loops
  const checkAuth = useCallback(async (): Promise<void> => {
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
      console.error('Auth check failed:', error);
      dispatch({ type: 'AUTH_FAILURE' });
      apiService.clearAuth();
    }
  }, []); // Empty dependency array since checkAuth doesn't depend on any state

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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
        
        // Note: Skip additional user refresh after login to prevent loops
        // User data from login response should be sufficient
        
        toast.success(response.message || 'Login successful!');
        return true;
      } else {
        dispatch({ type: 'AUTH_FAILURE' });
        toast.error(response.message || 'Login failed');
        return false;
      }
    } catch (error: any) {
      dispatch({ type: 'AUTH_FAILURE' });
      const message = error.response?.data?.message || 'Login failed';
      toast.error(message);
      return false;
    }
  };

  // Register
  const register = async (data: RegisterData): Promise<boolean> => {
    try {
      dispatch({ type: 'AUTH_START' });
      
      const response = await apiService.register(data);
      
      if (response.success && response.data?.token && response.data?.user) {
        apiService.setToken(response.data.token);
        dispatch({ 
          type: 'AUTH_SUCCESS', 
          payload: { user: response.data.user, token: response.data.token } 
        });
        toast.success(response.message || 'Registration successful!');
        return true;
      } else {
        dispatch({ type: 'AUTH_FAILURE' });
        toast.error(response.message || 'Registration failed');
        return false;
      }
    } catch (error: any) {
      dispatch({ type: 'AUTH_FAILURE' });
      
      // Handle validation errors
      if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        errors.forEach((err: any) => {
          toast.error(`${err.field}: ${err.message}`);
        });
      } else {
        const message = error.response?.data?.message || 'Registration failed';
        toast.error(message);
      }
      return false;
    }
  };

  // Refresh user data
  const refreshUser = async (): Promise<void> => {
    try {
      const response = await apiService.getCurrentUser();
      if (response.success && response.data?.user) {
        dispatch({ 
          type: 'AUTH_SUCCESS', 
          payload: { user: response.data.user, token: apiService.getToken() || '' } 
        });
      }
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  };

  // Logout
  const logout = (): void => {
    try {
      // Set logout context before making any API calls
      apiService.setLogoutContext();
      
      // Perform logout and clear auth
      apiService.logout().catch(console.error); // Don't wait for server response
      apiService.clearAuth();
      dispatch({ type: 'LOGOUT' });
      toast.success('Logged out successfully');
      
      // Clear logout context after a delay to ensure all pending API calls are handled
      setTimeout(() => {
        apiService.clearLogoutContext();
      }, 1000); // 1 second delay to handle any pending requests
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear auth even if server request fails
      apiService.clearAuth();
      dispatch({ type: 'LOGOUT' });
      // Clear logout context with delay even on error
      setTimeout(() => {
        apiService.clearLogoutContext();
      }, 1000);
    }
  };

  // Forgot Password
  const forgotPassword = async (data: ForgotPasswordData): Promise<boolean> => {
    try {
      const response = await apiService.forgotPassword(data);
      
      if (response.success) {
        toast.success(response.message || 'Password reset email sent!');
        return true;
      } else {
        toast.error(response.message || 'Failed to send reset email');
        return false;
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to send reset email';
      toast.error(message);
      return false;
    }
  };

  // Reset Password
  const resetPassword = async (data: ResetPasswordData): Promise<boolean> => {
    try {
      const response = await apiService.resetPassword(data);
      
      if (response.success) {
        toast.success(response.message || 'Password reset successful!');
        return true;
      } else {
        toast.error(response.message || 'Password reset failed');
        return false;
      }
    } catch (error: any) {
      // Handle validation errors
      if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        errors.forEach((err: any) => {
          toast.error(`${err.field}: ${err.message}`);
        });
      } else {
        const message = error.response?.data?.message || 'Password reset failed';
        toast.error(message);
      }
      return false;
    }
  };

  // Change Password
  const changePassword = async (data: ChangePasswordData): Promise<boolean> => {
    try {
      const response = await apiService.changePassword(data);
      
      if (response.success) {
        toast.success(response.message || 'Password changed successfully!');
        return true;
      } else {
        toast.error(response.message || 'Password change failed');
        return false;
      }
    } catch (error: any) {
      // Handle validation errors
      if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        errors.forEach((err: any) => {
          toast.error(`${err.field}: ${err.message}`);
        });
      } else {
        const message = error.response?.data?.message || 'Password change failed';
        toast.error(message);
      }
      return false;
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

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};