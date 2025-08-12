import React from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from '../icons';
import { ForgotPasswordData } from '../../types/auth';
import { forgotPasswordSchema } from '../../utils/validation';
import Button from '../common/Button';
import Input from '../common/Input';

interface ForgotPasswordFormProps {
  onSubmit: (data: ForgotPasswordData) => Promise<void>;
  isLoading: boolean;
  isSuccess: boolean;
}

const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ 
  onSubmit, 
  isLoading, 
  isSuccess 
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues
  } = useForm<ForgotPasswordData>({
    resolver: yupResolver(forgotPasswordSchema),
    mode: 'onBlur'
  });

  if (isSuccess) {
    return (
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
            <Mail className="w-6 h-6 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Check Your Email
          </h2>
          <p className="text-gray-600">
            We've sent a password reset link to{' '}
            <span className="font-medium text-gray-900">
              {getValues('email')}
            </span>
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">
            What to do next:
          </h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Check your inbox for an email from us</li>
            <li>• Click the reset link in the email</li>
            <li>• Follow the instructions to set a new password</li>
            <li>• The link will expire in 1 hour for security</li>
          </ul>
        </div>

        <div className="text-center space-y-3">
          <p className="text-sm text-gray-600">
            Didn't receive the email? Check your spam folder or{' '}
            <button
              onClick={() => window.location.reload()}
              className="text-primary-600 hover:text-primary-500 font-medium"
            >
              try again
            </button>
          </p>
          
          <Link
            to="/login"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Forgot Password?
        </h2>
        <p className="text-gray-600">
          No worries! Enter your email and we'll send you a reset link
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          {...register('email')}
          label="Email Address"
          type="email"
          leftIcon={<Mail />}
          placeholder="Enter your email address"
          error={errors.email?.message}
          autoComplete="email"
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          isLoading={isLoading}
          disabled={isLoading}
        >
          Send Reset Link
        </Button>
      </form>

      <div className="text-center">
        <Link
          to="/login"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 font-medium"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to login
        </Link>
      </div>
    </div>
  );
};

export default ForgotPasswordForm;