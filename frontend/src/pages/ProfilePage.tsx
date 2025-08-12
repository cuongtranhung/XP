import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserProfile } from '../types/profile';
import { profileService } from '../services/profileService';
import DashboardLayout from '../components/layouts/DashboardLayout';
import ProfileForm from '../components/profile/ProfileForm';
import ProfilePreferences from '../components/profile/ProfilePreferences';
import SecuritySettings from '../components/profile/SecuritySettings';
import PageLoader from '../components/common/PageLoader';
import { User, Settings, Shield, Download, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';

type ProfileTab = 'profile' | 'preferences' | 'security';

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');
  const [isExporting, setIsExporting] = useState(false);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'preferences', label: 'Preferences', icon: Settings },
    { id: 'security', label: 'Security', icon: Shield }
  ] as const;

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await profileService.getCurrentProfile();
      if (response.success) {
        setProfile(response.data);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = (updatedProfile: UserProfile) => {
    setProfile(updatedProfile);
  };

  const handlePreferencesUpdate = (updatedPreferences: any) => {
    if (profile) {
      setProfile({
        ...profile,
        preferences: updatedPreferences
      });
    }
  };

  const handleSecurityUpdate = (updatedSecurity: any) => {
    if (profile) {
      setProfile({
        ...profile,
        security: updatedSecurity
      });
    }
  };

  const handleExportData = async () => {
    try {
      setIsExporting(true);
      const response = await profileService.exportProfileData();
      
      if (response.success) {
        // Create a temporary link to download the file
        const link = document.createElement('a');
        link.href = response.data.download_url;
        link.download = response.data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success('Profile data exported successfully!');
      }
    } catch (error: any) {
      console.error('Export failed:', error);
      toast.error(error.response?.data?.message || 'Failed to export profile data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmation = prompt(
      'Are you sure you want to delete your account? This action cannot be undone.\n\nType "DELETE" to confirm:'
    );
    
    if (confirmation !== 'DELETE') {
      return;
    }

    const password = prompt('Enter your password to confirm account deletion:');
    if (!password) return;

    try {
      const response = await profileService.deleteAccount(password);
      if (response.success) {
        toast.success('Account deletion initiated. You will be logged out shortly.');
        // The backend will handle logout and cleanup
      }
    } catch (error: any) {
      console.error('Account deletion failed:', error);
      toast.error(error.response?.data?.message || 'Failed to delete account');
    }
  };

  const renderTabContent = () => {
    if (!profile) return null;

    switch (activeTab) {
      case 'profile':
        return (
          <ProfileForm
            profile={profile}
            onProfileUpdate={handleProfileUpdate}
          />
        );
      case 'preferences':
        return (
          <ProfilePreferences
            preferences={profile.preferences}
            onPreferencesUpdate={handlePreferencesUpdate}
          />
        );
      case 'security':
        return (
          <SecuritySettings
            security={profile.security}
            onSecurityUpdate={handleSecurityUpdate}
          />
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoader />
      </DashboardLayout>
    );
  }

  if (!profile) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Profile Not Found
            </h2>
            <p className="text-gray-600">
              Unable to load your profile data.
            </p>
            <Button
              className="mt-4"
              onClick={loadProfile}
            >
              Try Again
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Manage your account settings and preferences
                </p>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center space-x-4">
                <Button
                  variant="outline"
                  onClick={handleExportData}
                  isLoading={isExporting}
                  size="sm"
                >
                  <Download size={16} className="mr-2" />
                  Export Data
                </Button>
                
                <Button
                  variant="outline"
                  onClick={handleDeleteAccount}
                  size="sm"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  <Trash2 size={16} className="mr-2" />
                  Delete Account
                </Button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Icon size={16} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {renderTabContent()}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ProfilePage;