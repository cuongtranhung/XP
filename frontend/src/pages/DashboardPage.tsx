import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import AppLayout from '../components/layout/AppLayout';
import { 
  User, 
  Mail, 
  Calendar, 
  Shield, 
  CheckCircle, 
  AlertTriangle,
  Clock,
  Cake,
  Activity,
  MapPin,
  FileText
} from '../components/icons';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';
import { ActivityLogViewer } from '../components/activity/ActivityLogViewer';

const DashboardPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { notifications, unreadCount, isConnected } = useNotifications();
  const navigate = useNavigate();
  const [isResendingEmail, setIsResendingEmail] = useState(false);

  // Refresh user data when component mounts to ensure latest information
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Helper function to format date as dd/mm/yyyy (timezone-safe)
  const formatDateOfBirth = (dateString?: string): string => {
    if (!dateString) return 'Not set';
    try {
      // Parse YYYY-MM-DD string directly without timezone conversion
      const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return 'Invalid date';
      
      const [, year, month, day] = match;
      return `${day}/${month}/${year}`;
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Handle resend verification email
  const handleResendVerificationEmail = async () => {
    console.log('🔄 Resend verification email clicked!', { email: user?.email });
    
    if (!user?.email) {
      toast.error('Email not found');
      return;
    }

    setIsResendingEmail(true);
    
    try {
      const response = await apiService.resendEmailVerification(user.email);
      
      if (response.success) {
        toast.success('Verification email sent successfully!');
      } else {
        toast.error(response.message || 'Failed to send verification email');
      }
    } catch (error: any) {
      console.error('Resend verification error:', error);
      const message = error.response?.data?.message || 'Failed to send verification email';
      toast.error(message);
    } finally {
      setIsResendingEmail(false);
    }
  };

  const stats = [
    {
      name: 'Account Status',
      value: user?.email_verified ? 'Verified' : 'Pending Verification',
      icon: user?.email_verified ? CheckCircle : AlertTriangle,
      color: user?.email_verified ? 'text-green-600' : 'text-yellow-600',
      bgColor: user?.email_verified ? 'bg-green-100' : 'bg-yellow-100'
    },
    {
      name: 'Member Since',
      value: user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A',
      icon: Calendar,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      name: 'Last Updated',
      value: user?.updated_at ? new Date(user.updated_at).toLocaleDateString() : 'N/A',
      icon: Clock,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100'
    }
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Avatar */}
            {user?.avatar_url && (
              <img
                src={user.avatar_url}
                alt={user.full_name}
                className="h-16 w-16 rounded-full object-cover border-2 border-gray-200 shadow-lg"
              />
            )}
            {!user?.avatar_url && (
              <div className="h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center border-2 border-gray-200 shadow-lg">
                <User className="h-8 w-8 text-primary-600" />
              </div>
            )}
            
            {/* Welcome Text */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome back, {user?.full_name}!
              </h1>
              <p className="mt-1 text-gray-600">
                Here's an overview of your account status and recent activity.
              </p>
            </div>
          </div>
        </div>

        {/* Email verification banner */}
        {!user?.email_verified && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Email Verification Required
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    Please check your email and click the verification link to fully activate your account.
                    Some features may be limited until you verify your email address.
                  </p>
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      console.log('🔴 BUTTON CLICKED - Testing basic onClick');
                      handleResendVerificationEmail();
                    }}
                    disabled={isResendingEmail}
                    className="bg-yellow-100 px-3 py-2 rounded-md text-sm font-medium text-yellow-800 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isResendingEmail ? 'Sending...' : 'Resend Verification Email'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.name}
              className="bg-white overflow-hidden shadow rounded-lg border border-gray-200"
            >
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className={`p-3 rounded-md ${stat.bgColor}`}>
                      <stat.icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {stat.name}
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stat.value}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Account Information */}
        <div className="bg-white shadow rounded-lg border border-gray-200">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Account Information
            </h3>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  Full Name
                </dt>
                <dd className="mt-1 text-sm text-gray-900">{user?.full_name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <Mail className="w-4 h-4 mr-2" />
                  Email Address
                </dt>
                <dd className="mt-1 text-sm text-gray-900 flex items-center">
                  {user?.email}
                  {user?.email_verified && (
                    <CheckCircle className="w-4 h-4 ml-2 text-green-500" />
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <Cake className="w-4 h-4 mr-2" />
                  Date of Birth
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatDateOfBirth(user?.date_of_birth)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  Account Created
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {user?.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <Shield className="w-4 h-4 mr-2" />
                  Account ID
                </dt>
                <dd className="mt-1 text-sm text-gray-900 font-mono">
                  #{user?.id.toString().padStart(8, '0')}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Notifications Overview */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Mail className="w-5 h-5 mr-2" />
                Recent Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {unreadCount} unread
                  </span>
                )}
              </h3>
              <div className="flex items-center space-x-3">
                <div className={`flex items-center text-xs ${
                  isConnected ? 'text-green-600' : 'text-red-600'
                }`}>
                  <span className={`h-2 w-2 rounded-full mr-1 ${
                    isConnected ? 'bg-green-400' : 'bg-red-400'
                  }`}></span>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </div>
                <button
                  onClick={() => navigate('/notification-settings')}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Settings →
                </button>
              </div>
            </div>
          </div>
          <div className="p-6">
            {notifications.length === 0 ? (
              <div className="text-center py-6">
                <Mail className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                <p className="text-gray-500">No notifications yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {notifications.slice(0, 5).map((notification) => (
                  <div
                    key={notification.id}
                    className={`flex items-start space-x-3 p-3 rounded-lg ${
                      !notification.read ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'bg-gray-50'
                    }`}
                  >
                    <div className="text-lg">
                      {notification.type === 'email' && '📧'}
                      {notification.type === 'sms' && '💬'}
                      {notification.type === 'push' && '🔔'}
                      {notification.type === 'in-app' && '📱'}
                      {notification.type === 'system' && '⚙️'}
                      {notification.type === 'marketing' && '📢'}
                      {notification.type === 'transactional' && '📋'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {notification.title}
                      </p>
                      <p className="text-sm text-gray-600 truncate">
                        {notification.message}
                      </p>
                      <div className="flex items-center space-x-2 mt-1 text-xs text-gray-400">
                        <span>{new Date(notification.timestamp).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className="capitalize">{notification.type}</span>
                        {notification.priority && (
                          <>
                            <span>•</span>
                            <span className={`capitalize ${
                              notification.priority === 'critical' ? 'text-red-600' :
                              notification.priority === 'high' ? 'text-orange-600' :
                              notification.priority === 'medium' ? 'text-blue-600' :
                              'text-gray-500'
                            }`}>
                              {notification.priority}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {!notification.read && (
                      <div className="flex-shrink-0">
                        <span className="inline-block h-2 w-2 bg-blue-500 rounded-full"></span>
                      </div>
                    )}
                  </div>
                ))}
                
                {notifications.length > 5 && (
                  <div className="text-center pt-2">
                    <button
                      onClick={() => {
                        // Navigate to full notifications view (could be in a modal)
                        // For now, we'll open the notification center programmatically
                        console.log('Show all notifications');
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      View all {notifications.length} notifications
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Activity className="w-5 h-5 mr-2" />
                Recent Activity
              </h3>
              <button
                onClick={() => navigate('/settings?tab=activity')}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View All →
              </button>
            </div>
          </div>
          <div className="p-6">
            <ActivityLogViewer 
              limit={5}
              showFilters={false}
              title=""
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white shadow rounded-lg border border-gray-200">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Quick Actions
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <button
                type="button"
                onClick={() => navigate('/settings?tab=security')}
                className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <div>
                  <span className="rounded-lg inline-flex p-3 bg-primary-50 text-primary-600 group-hover:bg-primary-100">
                    <Shield className="h-6 w-6" />
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Change Password
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Update your account password for better security.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/settings?tab=profile')}
                className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <div>
                  <span className="rounded-lg inline-flex p-3 bg-blue-50 text-blue-600 group-hover:bg-blue-100">
                    <User className="h-6 w-6" />
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Update Profile
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Modify your personal information and preferences.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/notification-settings')}
                className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <div>
                  <span className="rounded-lg inline-flex p-3 bg-green-50 text-green-600 group-hover:bg-green-100">
                    <Mail className="h-6 w-6" />
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Notification Settings
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Manage all notification preferences and channels.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/location-settings')}
                className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <div>
                  <span className="rounded-lg inline-flex p-3 bg-orange-50 text-orange-600 group-hover:bg-orange-100">
                    <MapPin className="h-6 w-6" />
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    GPS Tracking
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Configure location tracking settings and view history.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/forms')}
                className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <div>
                  <span className="rounded-lg inline-flex p-3 bg-purple-50 text-purple-600 group-hover:bg-purple-100">
                    <FileText className="h-6 w-6" />
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Form Builder
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Create and manage dynamic forms with real-time collaboration.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/user-management')}
                className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <div>
                  <span className="rounded-lg inline-flex p-3 bg-blue-50 text-blue-600 group-hover:bg-blue-100">
                    <User className="h-6 w-6" />
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    User Management
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Quản lý người dùng, phê duyệt tài khoản và phân quyền.
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default DashboardPage;