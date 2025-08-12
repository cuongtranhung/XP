import React from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Link } from 'react-router-dom';
import { Mail, Lock, User } from '../icons';
import { RegisterData } from '../../types/auth';
import { registerSchema, getPasswordStrength } from '../../utils/validation';
import Button from '../common/Button';
import Input from '../common/Input';

interface RegisterFormProps {
  onSubmit: (data: RegisterData) => Promise<void>;
  isLoading: boolean;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSubmit, isLoading }) => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<RegisterData>({
    resolver: yupResolver(registerSchema),
    mode: 'onBlur'
  });

  const watchPassword = watch('password', '');
  const passwordStrength = getPasswordStrength(watchPassword);

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Create Account
        </h2>
        <p className="text-gray-600">
          Join us today and get started
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          {...register('fullName')}
          label="Full Name"
          type="text"
          leftIcon={<User />}
          placeholder="Enter your full name"
          error={errors.fullName?.message}
          autoComplete="name"
          required
        />

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

        <div>
          <Input
            {...register('password')}
            label="Password"
            type="password"
            leftIcon={<Lock />}
            placeholder="Create a password"
            error={errors.password?.message}
            showPasswordToggle
            autoComplete="new-password"
            required
          />
          
          {/* Password strength indicator */}
          {watchPassword && (
            <div className="mt-2">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Password strength:</span>
                <span className={passwordStrength.color}>
                  {passwordStrength.label}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1">
                <div
                  className={`h-1 rounded-full transition-all duration-300 ${
                    passwordStrength.score < 3
                      ? 'bg-red-500'
                      : passwordStrength.score < 5
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${(passwordStrength.score / 6) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <Input
          {...register('confirmPassword')}
          label="Confirm Password"
          type="password"
          leftIcon={<Lock />}
          placeholder="Confirm your password"
          error={errors.confirmPassword?.message}
          showPasswordToggle
          autoComplete="new-password"
          required
        />

        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              {...register('terms', { 
                required: 'You must agree to the Terms of Service and Privacy Policy' 
              })}
              id="terms"
              name="terms"
              type="checkbox"
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="terms" className="text-gray-700">
              I agree to the{' '}
              <Link
                to="/terms"
                className="text-primary-600 hover:text-primary-500 font-medium"
              >
                Terms of Service
              </Link>
              {' '}and{' '}
              <Link
                to="/privacy"
                className="text-primary-600 hover:text-primary-500 font-medium"
              >
                Privacy Policy
              </Link>
            </label>
          </div>
        </div>
        {errors.terms && (
          <div className="text-red-600 text-sm mt-1">
            {errors.terms.message}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          isLoading={isLoading}
          disabled={isLoading}
        >
          Create Account
        </Button>
      </form>

      <div className="text-center">
        <p className="text-gray-600">
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-primary-600 hover:text-primary-500 font-medium"
          >
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterForm;