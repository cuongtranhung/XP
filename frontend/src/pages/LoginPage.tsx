import React, { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoginCredentials } from '../types/auth';
import AuthLayout from '../components/layout/AuthLayout';
import LoginForm from '../components/auth/LoginForm';

const LoginPage: React.FC = () => {
  const { login, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Monitor authentication state changes
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      console.log('User authenticated, redirecting to:', from);
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location.state]);

  // Show nothing while checking authentication status
  if (isLoading) {
    return null;
  }

  // Redirect if already authenticated (for initial render)
  if (isAuthenticated) {
    const from = (location.state as any)?.from?.pathname || '/dashboard';
    // Return null to avoid any flash of content during redirect
    return null;
  }

  const handleLogin = async (data: LoginCredentials): Promise<void> => {
    const success = await login(data);
    console.log('Login result:', success);
    
    // Navigate to dashboard if login successful
    if (success) {
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      console.log('Login successful, navigating to:', from);
      // Use setTimeout to ensure state updates have propagated
      setTimeout(() => {
        navigate(from, { replace: true });
      }, 100);
    }
  };

  return (
    <AuthLayout>
      <LoginForm onSubmit={handleLogin} isLoading={isLoading} />
    </AuthLayout>
  );
};

export default LoginPage;