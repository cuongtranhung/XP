import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import AuthLayout from '../components/layout/AuthLayout';
import LoadingSpinner from '../components/common/LoadingSpinner';

interface VerificationResult {
  success: boolean;
  message: string;
}

const EmailVerificationPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const hasVerified = useRef(false); // Prevent multiple verifications

  useEffect(() => {
    const verifyEmail = async () => {
      // Prevent multiple verifications
      if (hasVerified.current) {
        return;
      }
      
      if (!token) {
        setResult({
          success: false,
          message: 'Token xác minh không hợp lệ'
        });
        setLoading(false);
        hasVerified.current = true;
        return;
      }

      hasVerified.current = true;
      console.log('🔄 Starting email verification for token:', token.substring(0, 10) + '...');

      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/verify-email/${token}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        const data = await response.json();
        console.log('📧 Verification response:', data);
        setResult(data);
        
        if (data.success) {
          console.log('✅ Email verification successful');
          toast.success('Email đã được xác minh thành công!');
          // Chuyển hướng về trang login sau 3 giây
          setTimeout(() => {
            navigate('/login', { 
              state: { message: 'Email đã được xác minh. Bạn có thể đăng nhập ngay.' }
            });
          }, 3000);
        } else {
          console.log('❌ Email verification failed:', data.message);
          toast.error(data.message || 'Xác minh email thất bại');
        }
      } catch (error) {
        console.error('❌ Email verification error:', error);
        const errorResult = {
          success: false,
          message: 'Có lỗi xảy ra khi xác minh email. Vui lòng thử lại.'
        };
        setResult(errorResult);
        toast.error('Có lỗi xảy ra khi xác minh email');
      } finally {
        setLoading(false);
      }
    };

    verifyEmail();
  }, [token]); // Removed navigate from dependencies to prevent re-runs

  const handleReturnToLogin = () => {
    navigate('/login');
  };

  const handleResendVerification = () => {
    navigate('/resend-verification');
  };

  return (
    <AuthLayout>
      <div className="max-w-md mx-auto">
        <div className="bg-white shadow-lg rounded-lg p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
              {loading ? (
                <LoadingSpinner size="md" />
              ) : result?.success ? (
                <svg
                  className="h-8 w-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  className="h-8 w-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {loading ? 'Đang xác minh...' : result?.success ? 'Xác minh thành công!' : 'Xác minh thất bại'}
            </h2>
          </div>

          {/* Content */}
          <div className="text-center">
            {loading ? (
              <div>
                <p className="text-gray-600 mb-4">
                  Đang xác minh địa chỉ email của bạn...
                </p>
                <div className="flex justify-center">
                  <LoadingSpinner size="lg" />
                </div>
              </div>
            ) : (
              <div>
                <p className={`mb-6 ${result?.success ? 'text-green-600' : 'text-red-600'}`}>
                  {result?.message}
                </p>

                {result?.success ? (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-md p-4">
                      <div className="flex items-center">
                        <svg
                          className="h-5 w-5 text-green-400 mr-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <div className="text-sm text-green-700">
                          <p className="font-medium">Email của bạn đã được xác minh thành công!</p>
                          <p>Bạn sẽ được chuyển hướng về trang đăng nhập trong giây lát...</p>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={handleReturnToLogin}
                      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
                    >
                      Đăng nhập ngay
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-red-50 border border-red-200 rounded-md p-4">
                      <div className="flex items-center">
                        <svg
                          className="h-5 w-5 text-red-400 mr-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <div className="text-sm text-red-700">
                          <p className="font-medium">Có lỗi xảy ra khi xác minh email</p>
                          <p>Token có thể đã hết hạn hoặc không hợp lệ.</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col space-y-3">
                      <button
                        onClick={handleResendVerification}
                        className="w-full flex justify-center py-2 px-4 border border-blue-600 rounded-md shadow-sm text-sm font-medium text-blue-600 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
                      >
                        Gửi lại email xác minh
                      </button>
                      
                      <button
                        onClick={handleReturnToLogin}
                        className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
                      >
                        Quay lại trang đăng nhập
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            Nếu bạn tiếp tục gặp vấn đề, vui lòng liên hệ{' '}
            <a href="mailto:support@example.com" className="text-blue-600 hover:text-blue-500">
              bộ phận hỗ trợ
            </a>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
};

export default EmailVerificationPage;