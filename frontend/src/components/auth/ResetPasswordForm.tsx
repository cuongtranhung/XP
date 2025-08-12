import React from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Link } from 'react-router-dom';
import { Lock, CheckCircle } from '../icons';
import { ResetPasswordData } from '../../types/auth';
import { resetPasswordSchema, getPasswordStrength } from '../../utils/validation';
import Button from '../common/Button';
import Input from '../common/Input';

interface ResetPasswordFormProps {
  onSubmit: (data: Pick<ResetPasswordData, 'password' | 'confirmPassword'>) => Promise<void>;
  isLoading: boolean;
  isSuccess: boolean;
  token: string;
}

const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({ 
  onSubmit, 
  isLoading, 
  isSuccess,
  token: _token 
}) => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<Pick<ResetPasswordData, 'password' | 'confirmPassword'>>({
    resolver: yupResolver(resetPasswordSchema),
    mode: 'onBlur'
  });

  const watchPassword = watch('password', '');
  const passwordStrength = getPasswordStrength(watchPassword);

  if (isSuccess) {
    return (
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Password Reset Successfully
          </h2>
          <p className="text-gray-600">
            Your password has been updated. You can now sign in with your new password.
          </p>
        </div>

        <Link
          to="/login"
          className="inline-flex items-center justify-center w-full px-6 py-3 text-lg font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          Continue to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Reset Your Password
        </h2>
        <p className="text-gray-600">
          Enter your new password below
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Input
            {...register('password')}
            label="New Password"
            type="password"
            leftIcon={<Lock />}
            placeholder="Enter your new password"
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
          label="Confirm New Password"
          type="password"
          leftIcon={<Lock />}
          placeholder="Confirm your new password"
          error={errors.confirmPassword?.message}
          showPasswordToggle
          autoComplete="new-password"
          required
        />

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <strong>Security tip:</strong> Choose a strong password that you haven't used elsewhere.
          </p>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          isLoading={isLoading}
          disabled={isLoading}
        >
          Reset Password
        </Button>
      </form>

      <div className="text-center">
        <Link
          to="/login"
          className="text-sm text-gray-600 hover:text-gray-900 font-medium"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
};

export default ResetPasswordForm;