import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';

// Mock the API service
jest.mock('../../services/api', () => ({
  apiService: {
    getCurrentUser: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    getToken: jest.fn(),
    setToken: jest.fn(),
    clearAuth: jest.fn(),
    setLogoutContext: jest.fn(),
    clearLogoutContext: jest.fn(),
  },
}));

import { apiService } from '../../services/api';
const mockApi = apiService as jest.Mocked<typeof apiService>;

// Test component that uses the auth context
const TestComponent = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  
  return (
    <div>
      <div data-testid="loading">{isLoading.toString()}</div>
      <div data-testid="authenticated">{isAuthenticated.toString()}</div>
      <div data-testid="user">{user ? user.email : 'null'}</div>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('should provide initial auth state', async () => {
    // Mock getToken to return null for initial state
    mockApi.getToken.mockReturnValue(null);
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    // Wait for loading to complete - checkAuth runs immediately on mount
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });
    
    // Check final state after auth check
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('user')).toHaveTextContent('null');
  });

  it('should check for existing token on mount', async () => {
    const mockUser = {
      id: 123,
      email: 'test@example.com',
      name: 'Test User',
      emailVerified: true,
    };

    const mockToken = 'valid-token';
    mockApi.getToken.mockReturnValue(mockToken);
    mockApi.getCurrentUser.mockResolvedValue({
      success: true,
      data: { user: mockUser },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      expect(screen.getByTestId('user')).toHaveTextContent(mockUser.email);
    });
  });

  it('should handle login successfully', async () => {
    const mockUser = {
      id: 123,
      email: 'test@example.com',
      name: 'Test User',
      emailVerified: true,
    };

    const mockToken = 'mock-token';

    mockApi.login.mockResolvedValue({
      success: true,
      data: { user: mockUser, token: mockToken },
    });
    
    // Mock getCurrentUser call that happens after login
    mockApi.getCurrentUser.mockResolvedValue({
      success: true,
      data: { user: mockUser },
    });
    
    // Mock getToken to return null initially
    mockApi.getToken.mockReturnValue(null);

    const LoginTestComponent = () => {
      const { login } = useAuth();
      
      return (
        <button
          onClick={() => login({ email: 'test@example.com', password: 'password' })}
        >
          Login
        </button>
      );
    };

    render(
      <AuthProvider>
        <TestComponent />
        <LoginTestComponent />
      </AuthProvider>
    );

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    // Click login button
    await act(async () => {
      screen.getByText('Login').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      expect(screen.getByTestId('user')).toHaveTextContent(mockUser.email);
    });

    // Check if setToken was called
    expect(mockApi.setToken).toHaveBeenCalledWith(mockToken);
  });

  it('should handle login failure', async () => {
    mockApi.login.mockRejectedValue({
      response: {
        data: {
          message: 'Invalid credentials',
        },
      },
    });
    
    // Mock getToken to return null initially
    mockApi.getToken.mockReturnValue(null);

    const LoginTestComponent = () => {
      const { login, isAuthenticated } = useAuth();
      
      return (
        <>
          <button
            onClick={() => login({ email: 'test@example.com', password: 'wrong' })}
          >
            Login
          </button>
          <div data-testid="auth-status">{isAuthenticated.toString()}</div>
        </>
      );
    };

    render(
      <AuthProvider>
        <LoginTestComponent />
      </AuthProvider>
    );

    // Click login button
    await act(async () => {
      screen.getByText('Login').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('false');
    });
  });

  it('should handle logout', async () => {
    const mockUser = {
      id: 123,
      email: 'test@example.com',
      name: 'Test User',
      emailVerified: true,
    };

    const mockToken = 'valid-token';
    mockApi.getToken.mockReturnValue(mockToken);
    mockApi.getCurrentUser.mockResolvedValue({
      success: true,
      data: { user: mockUser },
    });

    const LogoutTestComponent = () => {
      const { logout, isAuthenticated } = useAuth();
      
      return (
        <>
          <button onClick={logout}>Logout</button>
          <div data-testid="auth-status">{isAuthenticated.toString()}</div>
        </>
      );
    };

    render(
      <AuthProvider>
        <LogoutTestComponent />
      </AuthProvider>
    );

    // Wait for initial auth check
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('true');
    });

    // Click logout button
    await act(async () => {
      screen.getByText('Logout').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('false');
    });

    // Check if clearAuth was called
    expect(mockApi.clearAuth).toHaveBeenCalled();
  });

  it('should handle registration', async () => {
    const mockUser = {
      id: 123,
      email: 'newuser@example.com',
      name: 'New User',
      emailVerified: false,
    };

    const mockToken = 'mock-token';

    mockApi.register.mockResolvedValue({
      success: true,
      data: { user: mockUser, token: mockToken },
    });
    
    // Mock getCurrentUser call that happens after registration
    mockApi.getCurrentUser.mockResolvedValue({
      success: true,
      data: { user: mockUser },
    });
    
    // Mock getToken to return null initially
    mockApi.getToken.mockReturnValue(null);

    const RegisterTestComponent = () => {
      const { register } = useAuth();
      
      return (
        <button
          onClick={() => register({
            email: 'newuser@example.com',
            password: 'password123',
            confirmPassword: 'password123',
            fullName: 'New User',
            terms: true
          })}
        >
          Register
        </button>
      );
    };

    render(
      <AuthProvider>
        <TestComponent />
        <RegisterTestComponent />
      </AuthProvider>
    );

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    // Click register button
    await act(async () => {
      screen.getByText('Register').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      expect(screen.getByTestId('user')).toHaveTextContent(mockUser.email);
    });
    
    // Check if setToken was called
    expect(mockApi.setToken).toHaveBeenCalledWith(mockToken);
  });
});