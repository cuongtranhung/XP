import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ResetPasswordData } from '../types/auth';
import { apiService } from '../services/api';
import AuthLayout from '../components/layout/AuthLayout';
import ResetPasswordForm from '../components/auth/ResetPasswordForm';
import { InlineLoading } from '../components/common/LoadingSpinner';
import Alert from '../components/common/Alert';

const ResetPasswordPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const { resetPassword, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setIsValidatingToken(false);
        setIsValidToken(false);
        return;
      }

      try {
        const response = await apiService.verifyResetToken(token);
        setIsValidToken(response.success && response.data?.valid === true);
      } catch (error) {
        console.error('Token validation error:', error);
        setIsValidToken(false);
      } finally {
        setIsValidatingToken(false);
      }
    };

    validateToken();
  }, [token]);

  const handleResetPassword = async (
    data: Pick<ResetPasswordData, 'password' | 'confirmPassword'>
  ): Promise<void> => {
    if (!token) return;

    setIsLoading(true);
    try {
      const resetData: ResetPasswordData = {
        token,
        password: data.password,
        confirmPassword: data.confirmPassword,
      };
      
      const success = await resetPassword(resetData);
      if (success) {
        setIsSuccess(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidatingToken) {
    return (
      <AuthLayout>
        <InlineLoading message="Validating reset token..." />
      </AuthLayout>
    );
  }

  if (!token || !isValidToken) {
    return (
      <AuthLayout>
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Invalid Reset Link
            </h2>
            <p className="text-gray-600">
              This password reset link is invalid or has expired.
            </p>
          </div>

          <Alert
            type="error"
            message="The password reset link you followed is either invalid or has expired. Please request a new password reset."
          />

          <div className="text-center">
            <a
              href="/forgot-password"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Request New Reset Link
            </a>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <ResetPasswordForm 
        onSubmit={handleResetPassword} 
        isLoading={isLoading}
        isSuccess={isSuccess}
        token={token}
      />
    </AuthLayout>
  );
};

export default ResetPasswordPage;