import React from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Link } from 'react-router-dom';
import { Mail, Lock } from '../icons';
import { LoginCredentials } from '../../types/auth';
import { loginSchema } from '../../utils/validation';
import Button from '../common/Button';
import Input from '../common/Input';

interface LoginFormProps {
  onSubmit: (data: LoginCredentials) => Promise<void>;
  isLoading: boolean;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSubmit, isLoading }) => {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginCredentials>({
    resolver: yupResolver(loginSchema),
    mode: 'onChange'
  });

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome Back
        </h2>
        <p className="text-gray-600">
          Sign in to your account to continue
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          {...register('email')}
          label="Email Address"
          type="email"
          leftIcon={<Mail />}
          placeholder="Enter your email"
          error={errors.email?.message}
          autoComplete="email"
          required
        />

        <Input
          {...register('password')}
          label="Password"
          type="password"
          leftIcon={<Lock />}
          placeholder="Enter your password"
          error={errors.password?.message}
          showPasswordToggle
          autoComplete="current-password"
          required
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
              Remember me
            </label>
          </div>

          <Link
            to="/forgot-password"
            className="text-sm text-primary-600 hover:text-primary-500 font-medium"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          isLoading={isLoading}
          disabled={isLoading}
        >
          Sign In
        </Button>
      </form>

      <div className="text-center">
        <p className="text-gray-600">
          Don't have an account?{' '}
          <Link
            to="/register"
            className="text-primary-600 hover:text-primary-500 font-medium"
          >
            Create one here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginForm;