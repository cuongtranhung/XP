import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { RegisterData } from '../types/auth';
import AuthLayout from '../components/layout/AuthLayout';
import RegisterForm from '../components/auth/RegisterForm';

const RegisterPage: React.FC = () => {
  const { register, isLoading, isAuthenticated } = useAuth();

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleRegister = async (data: RegisterData): Promise<void> => {
    await register(data);
  };

  return (
    <AuthLayout>
      <RegisterForm onSubmit={handleRegister} isLoading={isLoading} />
    </AuthLayout>
  );
};

export default RegisterPage;