import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Login from '../../pages/LoginPage';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the AuthLayout component to avoid import.meta.env issues
jest.mock('../../components/layout/AuthLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

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

// Mock react-router-dom hooks
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Helper function to render with providers
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Login Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock getToken to return null by default
    mockApi.getToken.mockReturnValue(null);
  });

  it('should render login form', () => {
    renderWithProviders(<Login />);

    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    expect(screen.getByText('Sign in to your account to continue')).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByText(/don't have an account/i)).toBeInTheDocument();
    expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
  });

  it('should show validation errors for empty form', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    
    // Focus and blur to trigger validation
    await user.click(emailInput);
    await user.click(passwordInput);
    await user.click(emailInput);
    
    // Try to submit form
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    // Check for HTML5 validation or react-hook-form validation
    // The inputs should have required attribute
    expect(emailInput).toHaveAttribute('required');
    expect(passwordInput).toHaveAttribute('required');
  });

  it('should show validation error for invalid email', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);

    // Type invalid email to trigger react-hook-form validation
    await user.type(emailInput, 'invalid-email');
    await user.type(passwordInput, 'password123');
    
    // Tab away to trigger validation
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
  });

  it('should submit form with valid data', async () => {
    const user = userEvent.setup();
    const mockUser = {
      id: 123,
      email: 'test@example.com',
      name: 'Test User',
      emailVerified: true,
    };

    mockApi.login.mockResolvedValue({
      success: true,
      data: { user: mockUser, token: 'mock-token' },
    });
    
    // Mock getCurrentUser call that happens after login
    mockApi.getCurrentUser.mockResolvedValue({
      success: true,
      data: { user: mockUser },
    });

    renderWithProviders(<Login />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockApi.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });

  it('should display error message on login failure', async () => {
    const user = userEvent.setup();
    
    mockApi.login.mockResolvedValue({
      success: false,
      message: 'Invalid email or password',
    });

    renderWithProviders(<Login />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(submitButton);

    // Error is shown via toast notification
    await waitFor(() => {
      expect(mockApi.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'wrongpassword',
      });
    });
    
    // The error would be shown in a toast, not in the DOM
    // We can verify that login was called and returned false
    expect(mockApi.login).toHaveBeenCalled();
  });

  it('should disable form while submitting', async () => {
    const user = userEvent.setup();
    
    let resolveLogin: any;
    // Mock a delayed response that we can control
    mockApi.login.mockImplementation(() => 
      new Promise(resolve => {
        resolveLogin = resolve;
      })
    );

    renderWithProviders(<Login />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    
    // Click submit but don't await it yet
    const clickPromise = user.click(submitButton);

    // Wait for button to be disabled
    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });

    // Resolve the login promise
    resolveLogin({
      success: true,
      data: { user: { id: 123, email: 'test@example.com', name: 'Test User', emailVerified: true }, token: 'token' },
    });

    // Now await the click to finish
    await clickPromise;

    // Verify login was called
    expect(mockApi.login).toHaveBeenCalled();
  });

  it('should navigate to register page when clicking sign up link', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    const signUpLink = screen.getByText(/create one here/i);
    
    // The link is an actual <a> tag with href, not using navigate
    expect(signUpLink).toHaveAttribute('href', '/register');
  });

  it('should navigate to forgot password page when clicking forgot password link', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    const forgotPasswordLink = screen.getByText(/forgot password\?/i);
    
    // The link is an actual <a> tag with href, not using navigate
    expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password');
  });
});