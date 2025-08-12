import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ForgotPasswordData } from '../types/auth';
import AuthLayout from '../components/layout/AuthLayout';
import ForgotPasswordForm from '../components/auth/ForgotPasswordForm';

const ForgotPasswordPage: React.FC = () => {
  const { forgotPassword, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleForgotPassword = async (data: ForgotPasswordData): Promise<void> => {
    setIsLoading(true);
    try {
      const success = await forgotPassword(data);
      if (success) {
        setIsSuccess(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <ForgotPasswordForm 
        onSubmit={handleForgotPassword} 
        isLoading={isLoading}
        isSuccess={isSuccess}
      />
    </AuthLayout>
  );
};

export default ForgotPasswordPage;