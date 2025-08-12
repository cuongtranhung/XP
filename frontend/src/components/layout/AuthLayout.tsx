import React from 'react';
import { Shield } from '../icons';

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-primary-600 rounded-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">
              {import.meta.env.VITE_APP_NAME || 'SecureAuth'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-lg sm:rounded-lg sm:px-10 border border-gray-200">
          {children}
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="text-xs text-gray-500">
          © 2024 {import.meta.env.VITE_APP_NAME || 'SecureAuth'}. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default AuthLayout;