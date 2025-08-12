import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { UserPreferences } from '../../types/profile';
import { profileService } from '../../services/profileService';
import Button from '../common/Button';
import { Moon, Sun, Globe, Bell, Shield, Eye } from 'lucide-react';

interface ProfilePreferencesProps {
  preferences: UserPreferences;
  onPreferencesUpdate: (preferences: UserPreferences) => void;
  className?: string;
}

const ProfilePreferences: React.FC<ProfilePreferencesProps> = ({
  preferences,
  onPreferencesUpdate,
  className = ''
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'notifications' | 'privacy'>('general');

  const {
    register,
    handleSubmit,
    formState: { isDirty, errors },
    reset,
    watch
  } = useForm<UserPreferences>({
    defaultValues: preferences
  });

  const tabs = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy', icon: Shield }
  ] as const;

  const onSubmit = async (data: UserPreferences) => {
    try {
      setIsLoading(true);
      const response = await profileService.updatePreferences(data);
      
      if (response.success) {
        onPreferencesUpdate(response.data);
        toast.success('Preferences updated successfully!');
        reset(data);
      }
    } catch (error: any) {
      console.error('Preferences update failed:', error);
      toast.error(error.response?.data?.message || 'Failed to update preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      {/* Theme */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Theme
        </label>
        <div className="flex space-x-4">
          {[
            { value: 'light', label: 'Light', icon: Sun },
            { value: 'dark', label: 'Dark', icon: Moon },
            { value: 'auto', label: 'Auto', icon: Globe }
          ].map(({ value, label, icon: Icon }) => (
            <label key={value} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                {...register('theme')}
                value={value}
                className="sr-only"
              />
              <div
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg border-2 transition-colors ${
                  watch('theme') === value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                <Icon size={16} />
                <span className="text-sm font-medium">{label}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Language */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Language
        </label>
        <select
          {...register('language')}
          className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="fr">Français</option>
          <option value="de">Deutsch</option>
          <option value="zh">中文</option>
          <option value="ja">日本語</option>
        </select>
      </div>

      {/* Timezone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Timezone
        </label>
        <select
          {...register('timezone')}
          className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="America/New_York">Eastern Time (EST/EDT)</option>
          <option value="America/Chicago">Central Time (CST/CDT)</option>
          <option value="America/Denver">Mountain Time (MST/MDT)</option>
          <option value="America/Los_Angeles">Pacific Time (PST/PDT)</option>
          <option value="Europe/London">GMT (London)</option>
          <option value="Europe/Paris">CET (Paris)</option>
          <option value="Asia/Tokyo">JST (Tokyo)</option>
          <option value="Asia/Shanghai">CST (Shanghai)</option>
          <option value="UTC">UTC</option>
        </select>
      </div>

      {/* Date Format */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Date Format
        </label>
        <select
          {...register('date_format')}
          className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
          <option value="DD/MM/YYYY">DD/MM/YYYY (European)</option>
          <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
        </select>
      </div>

      {/* Time Format */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Time Format
        </label>
        <div className="flex space-x-4">
          <label className="flex items-center">
            <input
              type="radio"
              {...register('time_format')}
              value="12h"
              className="mr-2"
            />
            12-hour (AM/PM)
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              {...register('time_format')}
              value="24h"
              className="mr-2"
            />
            24-hour
          </label>
        </div>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        {[
          { key: 'email_notifications', label: 'Email Notifications', description: 'Receive notifications via email' },
          { key: 'push_notifications', label: 'Push Notifications', description: 'Receive push notifications in your browser' },
          { key: 'sms_notifications', label: 'SMS Notifications', description: 'Receive important alerts via SMS' },
          { key: 'marketing_emails', label: 'Marketing Emails', description: 'Receive product updates and marketing content' },
          { key: 'security_alerts', label: 'Security Alerts', description: 'Important security notifications (recommended)' },
          { key: 'system_updates', label: 'System Updates', description: 'Notifications about system maintenance and updates' },
          { key: 'weekly_summary', label: 'Weekly Summary', description: 'Weekly digest of your activity and insights' }
        ].map(({ key, label, description }) => (
          <div key={key} className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              {...register(`notification_settings.${key}` as keyof UserPreferences)}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">{label}</div>
              <div className="text-sm text-gray-600">{description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPrivacySettings = () => (
    <div className="space-y-6">
      {/* Profile Visibility */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Profile Visibility
        </label>
        <div className="space-y-3">
          {[
            { value: 'public', label: 'Public', description: 'Anyone can view your profile' },
            { value: 'team_only', label: 'Team Only', description: 'Only team members can view your profile' },
            { value: 'private', label: 'Private', description: 'Only you can view your profile' }
          ].map(({ value, label, description }) => (
            <label key={value} className="flex items-start space-x-3 cursor-pointer">
              <input
                type="radio"
                {...register('privacy_settings.profile_visibility')}
                value={value}
                className="mt-1"
              />
              <div>
                <div className="font-medium text-gray-900">{label}</div>
                <div className="text-sm text-gray-600">{description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Individual Privacy Settings */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Show on Profile</h4>
        {[
          { key: 'show_email', label: 'Email Address' },
          { key: 'show_phone', label: 'Phone Number' },
          { key: 'show_location', label: 'Location' },
          { key: 'show_last_seen', label: 'Last Seen Status' }
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between py-2">
            <span className="text-gray-700">{label}</span>
            <input
              type="checkbox"
              {...register(`privacy_settings.${key}` as keyof UserPreferences)}
              className="rounded"
            />
          </div>
        ))}
      </div>

      {/* Search Settings */}
      <div className="border-t pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-gray-900">Allow Search</div>
            <div className="text-sm text-gray-600">Allow others to find you in search</div>
          </div>
          <input
            type="checkbox"
            {...register('privacy_settings.allow_search')}
            className="rounded"
          />
        </div>
      </div>
    </div>
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'general':
        return renderGeneralSettings();
      case 'notifications':
        return renderNotificationSettings();
      case 'privacy':
        return renderPrivacySettings();
      default:
        return renderGeneralSettings();
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6 pt-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
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

      {/* Tab Content */}
      <form onSubmit={handleSubmit(onSubmit)} className="p-6">
        {renderActiveTab()}

        {/* Form Actions */}
        <div className="flex items-center justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={() => reset()}
            disabled={!isDirty || isLoading}
          >
            Reset
          </Button>
          <Button
            type="submit"
            disabled={!isDirty || isLoading}
            isLoading={isLoading}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ProfilePreferences;