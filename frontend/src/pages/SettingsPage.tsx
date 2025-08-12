import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { 
  User, 
  Mail, 
  Lock, 
  Bell, 
  Shield, 
  Save,
  Eye,
  EyeOff,
  Activity,
  Image
} from '../components/icons';
import Button from '../components/common/Button';
import AvatarUpload from '../components/common/AvatarUpload';
import toast from 'react-hot-toast';
import { apiService } from '../services/api';
import { ActivityLogViewer } from '../components/activity/ActivityLogViewer';
import { ActivityControl } from '../components/activity/ActivityControl';

const SettingsPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    fullName: user?.full_name || '',
    email: user?.email || '',
    dateOfBirth: user?.date_of_birth || ''
  });

  // Avatar state - track current avatar URL
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(user?.avatar_url || null);

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Loading states  
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Avatar state (removed unused variable)

  // Set active tab from URL parameter
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['profile', 'security', 'notifications'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Update form state when user data changes
  useEffect(() => {
    if (user) {
      // Convert stored date (YYYY-MM-DD) to display format (DD/MM/YYYY)
      const displayDateOfBirth = user.date_of_birth 
        ? convertDateToDisplayFormat(user.date_of_birth)
        : '';
      
      setProfileForm({
        fullName: user.full_name || '',
        email: user.email || '',
        dateOfBirth: displayDateOfBirth
      });
      setCurrentAvatarUrl(user.avatar_url || null);
    }
  }, [user]);

  // Helper functions for date format conversion
  const convertDateToDisplayFormat = (dateString: string) => {
    if (!dateString) return '';
    // Convert from YYYY-MM-DD to DD/MM/YYYY for display
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const convertDateToStorageFormat = (dateString: string) => {
    if (!dateString) return '';
    // Convert from DD/MM/YYYY to YYYY-MM-DD for storage
    const [day, month, year] = dateString.split('/');
    return `${year}-${month?.padStart(2, '0') || ''}-${day?.padStart(2, '0') || ''}`;
  };

  const isValidDateFormat = (dateString: string) => {
    const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    return regex.test(dateString);
  };

  const tabs = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'activity', name: 'Activity', icon: Activity },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'gallery', name: 'Gallery', icon: Image }
  ];

  const handleAvatarUpload = async (file: File | null, optimizedDataUrl?: string) => {
    setIsUploadingAvatar(true);
    
    try {
      let avatarUrl: string | null = null;
      
      if (file && optimizedDataUrl) {
        // Use the optimized data URL from AvatarUpload component
        avatarUrl = optimizedDataUrl;
        console.log(`📤 Uploading optimized avatar: ${Math.round(avatarUrl.length * 0.75 / 1024)}KB`);
      } else if (file) {
        // Fallback: convert file to base64 (shouldn't happen with new optimization)
        const reader = new FileReader();
        avatarUrl = await new Promise((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
        console.log(`📤 Uploading unoptimized avatar: ${Math.round((avatarUrl?.length || 0) * 0.75 / 1024)}KB`);
      }

      const response = await apiService.updateProfile({
        avatarUrl: avatarUrl || undefined
      });

      if (response.success) {
        toast.success(file ? 'Avatar updated successfully' : 'Avatar removed successfully');
        // Update local avatar state
        setCurrentAvatarUrl(avatarUrl);
        // Refresh user data to update avatar in UI
        await refreshUser();
      } else {
        toast.error(response.message || 'Failed to update avatar');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to update avatar';
      toast.error(message);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate date format if provided
    if (profileForm.dateOfBirth && !isValidDateFormat(profileForm.dateOfBirth)) {
      toast.error('Please enter date in DD/MM/YYYY format');
      return;
    }

    setIsUpdatingProfile(true);

    try {
      // Convert date to storage format before sending
      const dateOfBirthForStorage = profileForm.dateOfBirth 
        ? convertDateToStorageFormat(profileForm.dateOfBirth)
        : undefined;

      const response = await apiService.updateProfile({
        fullName: profileForm.fullName,
        email: profileForm.email,
        avatarUrl: currentAvatarUrl || undefined, // Include current avatar
        dateOfBirth: dateOfBirthForStorage // Include date of birth in YYYY-MM-DD format
      });

      if (response.success) {
        console.log('✅ Profile update successful, starting navigation flow...');
        toast.success('Profile updated successfully');
        
        // Refresh user data to update context
        console.log('🔄 Refreshing user data...');
        await refreshUser();
        console.log('✅ User data refreshed');
        
        // Navigate back to dashboard with updated information
        console.log('🚀 Starting navigation to dashboard in 1.5 seconds...');
        setTimeout(() => {
          console.log('📍 Navigating to dashboard...');
          navigate('/dashboard');
        }, 1500); // Wait 1.5 seconds to show success message
      } else {
        console.error('❌ Profile update failed:', response.message);
        toast.error(response.message || 'Failed to update profile');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to update profile';
      toast.error(message);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await apiService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword
      });

      if (response.success) {
        toast.success('Password changed successfully');
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        toast.error(response.message || 'Failed to change password');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to change password';
      toast.error(message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-6">
            {/* Avatar Upload Section */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Profile Photo</h3>
              <AvatarUpload
                currentAvatar={currentAvatarUrl}
                onImageChange={handleAvatarUpload}
                isLoading={isUploadingAvatar}
                className="mb-6"
              />
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Profile Information</h3>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="fullName"
                    value={profileForm.fullName}
                    onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Changing your email will require verification of the new address.
                  </p>
                </div>

                <div>
                  <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700">
                    Date of Birth
                  </label>
                  <input
                    type="text"
                    id="dateOfBirth"
                    value={profileForm.dateOfBirth}
                    onChange={(e) => setProfileForm({ ...profileForm, dateOfBirth: e.target.value })}
                    placeholder="DD/MM/YYYY"
                    pattern="^(0?[1-9]|[12][0-9]|3[01])\/(0?[1-9]|1[012])\/([0-9]{4})$"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Enter your date of birth in DD/MM/YYYY format (e.g., 25/12/1990).
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    leftIcon={<Save />}
                    isLoading={isUpdatingProfile}
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-md font-medium text-gray-900 mb-2">Account Status</h4>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-700">Email Verification</span>
                  </div>
                  {user?.email_verified ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Pending
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Change Password</h3>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
                    Current Password
                  </label>
                  <div className="mt-1 relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      id="currentPassword"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                    New Password
                  </label>
                  <div className="mt-1 relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      id="newPassword"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                    Confirm New Password
                  </label>
                  <div className="mt-1 relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    leftIcon={<Lock />}
                    isLoading={isChangingPassword}
                  >
                    Change Password
                  </Button>
                </div>
              </form>
            </div>
          </div>
        );

      case 'activity':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Activity Logs</h3>
              <p className="text-sm text-gray-600 mb-6">
                View your recent account activities and security events.
              </p>
              
              <ActivityLogViewer 
                limit={20}
                showFilters={true}
                title="My Activity History"
              />
            </div>

            {/* Admin Activity Control - Only show for admin users */}
            {user?.id === 2 && (
              <div className="border-t pt-6">
                <ActivityControl />
              </div>
            )}
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Preferences</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700">Email Notifications</label>
                    <p className="text-xs text-gray-500">Receive email notifications for account activities</p>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    defaultChecked
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700">Security Alerts</label>
                    <p className="text-xs text-gray-500">Get notified of important security events</p>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    defaultChecked
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700">Marketing Updates</label>
                    <p className="text-xs text-gray-500">Receive updates about new features and improvements</p>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'gallery':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Gallery Settings</h3>
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                      <Image className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                      <span>Gallery v2.0 - Modern</span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Active
                      </span>
                    </h4>
                    <p className="text-sm text-gray-600">Advanced features with gestures, animations, and accessibility</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <h5 className="font-medium text-gray-900">Enhanced Features:</h5>
                    <ul className="space-y-1 text-sm text-gray-600">
                      <li className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                        <span>Gesture controls & touch navigation</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                        <span>Pinch to zoom & smooth animations</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                        <span>Glassmorphism UI design</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                        <span>WCAG 2.1 AAA accessibility</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="space-y-2">
                    <h5 className="font-medium text-gray-900">Keyboard Shortcuts:</h5>
                    <ul className="space-y-1 text-sm text-gray-600">
                      <li><kbd className="px-2 py-1 bg-gray-100 rounded text-xs">←/→</kbd> Navigate images</li>
                      <li><kbd className="px-2 py-1 bg-gray-100 rounded text-xs">+/-</kbd> Zoom in/out</li>
                      <li><kbd className="px-2 py-1 bg-gray-100 rounded text-xs">R</kbd> Rotate image</li>
                      <li><kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Space</kbd> Reset view</li>
                      <li><kbd className="px-2 py-1 bg-gray-100 rounded text-xs">ESC</kbd> Close gallery</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-white rounded-lg border border-blue-200">
                  <p className="text-sm text-gray-700">
                    <strong>Gallery v2.0</strong> is now the default experience, featuring modern interactions, 
                    improved accessibility, and enhanced performance for viewing comment attachments and images.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="mt-2 text-gray-600">
            Manage your account settings and preferences.
          </p>
        </div>

        {/* Settings Content */}
        <div className="bg-white shadow rounded-lg">
          <div className="sm:flex">
            {/* Sidebar Navigation */}
            <div className="sm:w-1/4 border-r border-gray-200">
              <nav className="space-y-1 p-4">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        activeTab === tab.id
                          ? 'bg-primary-100 text-primary-700 border-primary-500'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{tab.name}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Main Content */}
            <div className="sm:w-3/4 p-6">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;