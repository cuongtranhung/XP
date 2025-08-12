import React, { useState, useEffect } from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import AppLayout from '../components/layout/AppLayout';
import { Button } from '../components/common/Button';
import { Switch } from '@headlessui/react';
import toast from 'react-hot-toast';

const NotificationSettingsPage: React.FC = () => {
  const { 
    preferences, 
    loading, 
    updatePreferences, 
    sendTestNotification,
    fetchPreferences
  } = useNotifications();

  const [localPreferences, setLocalPreferences] = useState(preferences);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingChannel, setTestingChannel] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Fetch preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      setIsInitializing(true);
      try {
        // Always fetch fresh preferences when the page loads
        await fetchPreferences();
        console.log('Fetched preferences successfully');
      } catch (error) {
        console.error('Failed to fetch preferences:', error);
        toast.error('Failed to load notification preferences');
      } finally {
        setIsInitializing(false);
      }
    };
    
    // Load preferences when component mounts
    loadPreferences();
  }, [fetchPreferences]);

  // Sync with context when preferences change
  useEffect(() => {
    if (preferences && !hasChanges) {
      setLocalPreferences(preferences);
    }
  }, [preferences, hasChanges]);

  // Detect changes
  useEffect(() => {
    if (preferences && localPreferences) {
      const hasChanges = JSON.stringify(preferences) !== JSON.stringify(localPreferences);
      setHasChanges(hasChanges);
    }
  }, [preferences, localPreferences]);

  const handleChannelChange = (channel: keyof typeof localPreferences.channels, enabled: boolean) => {
    if (!localPreferences) return;
    
    setLocalPreferences({
      ...localPreferences,
      channels: {
        ...localPreferences.channels,
        [channel]: enabled
      }
    });
  };

  const handleTypeChange = (type: keyof typeof localPreferences.types, enabled: boolean) => {
    if (!localPreferences) return;
    
    setLocalPreferences({
      ...localPreferences,
      types: {
        ...localPreferences.types,
        [type]: enabled
      }
    });
  };

  const handleFrequencyChange = (channel: keyof typeof localPreferences.frequency, frequency: string) => {
    if (!localPreferences) return;
    
    setLocalPreferences({
      ...localPreferences,
      frequency: {
        ...localPreferences.frequency,
        [channel]: frequency as any
      }
    });
  };

  const handleQuietHoursChange = (field: string, value: any) => {
    if (!localPreferences) return;
    
    setLocalPreferences({
      ...localPreferences,
      quiet_hours: {
        ...localPreferences.quiet_hours,
        [field]: value
      }
    });
  };

  const handleSave = async () => {
    if (!localPreferences || !hasChanges) return;

    setSaving(true);
    try {
      await updatePreferences(localPreferences);
      setHasChanges(false);
    } catch (error) {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (preferences) {
      setLocalPreferences(preferences);
      setHasChanges(false);
    }
  };

  const handleTestNotification = async (channel: 'email' | 'sms' | 'push' | 'in-app') => {
    setTestingChannel(channel);
    try {
      await sendTestNotification(channel);
    } catch (error) {
      toast.error(`Failed to send test ${channel} notification`);
    } finally {
      setTestingChannel(null);
    }
  };

  const handleRefresh = async () => {
    try {
      await fetchPreferences();
      toast.success('Preferences refreshed');
    } catch (error) {
      toast.error('Failed to refresh preferences');
    }
  };

  if (isInitializing || (loading && !localPreferences)) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!isInitializing && !localPreferences) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="text-gray-500 mb-4">Failed to load notification preferences</div>
            <Button onClick={handleRefresh}>
              Try Again
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Notification Settings
          </h1>
          <p className="text-gray-600">
            Manage how and when you receive notifications from the system.
          </p>
        </div>

        {/* Save/Reset Actions */}
        {hasChanges && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="text-blue-800">
                <p className="font-medium">You have unsaved changes</p>
                <p className="text-sm">Save your changes to apply new notification settings.</p>
              </div>
              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={saving}
                >
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-8">
          {/* Notification Channels */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Notification Channels
            </h2>
            <p className="text-gray-600 mb-6">
              Choose which channels you want to receive notifications through.
            </p>
            
            <div className="space-y-4">
              {Object.entries(localPreferences.channels).map(([channel, enabled]) => (
                <div key={channel} className="flex items-center justify-between py-3">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">
                      {channel === 'email' && '📧'}
                      {channel === 'sms' && '💬'}
                      {channel === 'push' && '🔔'}
                      {channel === 'in-app' && '📱'}
                    </div>
                    <div>
                      <div className="font-medium capitalize">{channel.replace('-', ' ')}</div>
                      <div className="text-sm text-gray-500">
                        {channel === 'email' && 'Receive notifications via email'}
                        {channel === 'sms' && 'Receive notifications via SMS (if enabled)'}
                        {channel === 'push' && 'Browser push notifications'}
                        {channel === 'in-app' && 'In-app notifications'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => handleTestNotification(channel as any)}
                      disabled={!enabled || testingChannel === channel}
                    >
                      {testingChannel === channel ? 'Testing...' : 'Test'}
                    </Button>
                    <Switch
                      checked={enabled}
                      onChange={(checked) => handleChannelChange(channel as any, checked)}
                      className={`${
                        enabled ? 'bg-blue-600' : 'bg-gray-200'
                      } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                    >
                      <span
                        className={`${
                          enabled ? 'translate-x-6' : 'translate-x-1'
                        } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                      />
                    </Switch>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notification Types */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Notification Types
            </h2>
            <p className="text-gray-600 mb-6">
              Choose which types of notifications you want to receive.
            </p>
            
            <div className="space-y-4">
              {Object.entries(localPreferences.types).map(([type, enabled]) => (
                <div key={type} className="flex items-center justify-between py-3">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">
                      {type === 'system' && '⚙️'}
                      {type === 'marketing' && '📢'}
                      {type === 'transactional' && '📋'}
                    </div>
                    <div>
                      <div className="font-medium capitalize">{type}</div>
                      <div className="text-sm text-gray-500">
                        {type === 'system' && 'System updates, security alerts, and maintenance notifications'}
                        {type === 'marketing' && 'Product updates, tips, and promotional content'}
                        {type === 'transactional' && 'Account activity, form submissions, and status updates'}
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={enabled}
                    onChange={(checked) => handleTypeChange(type as any, checked)}
                    className={`${
                      enabled ? 'bg-blue-600' : 'bg-gray-200'
                    } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                  >
                    <span
                      className={`${
                        enabled ? 'translate-x-6' : 'translate-x-1'
                      } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                    />
                  </Switch>
                </div>
              ))}
            </div>
          </div>

          {/* Frequency Settings */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Frequency Settings
            </h2>
            <p className="text-gray-600 mb-6">
              Control how often you receive notifications for each channel.
            </p>
            
            <div className="space-y-6">
              {Object.entries(localPreferences.frequency).map(([channel, frequency]) => (
                <div key={channel} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-xl">
                      {channel === 'email' && '📧'}
                      {channel === 'push' && '🔔'}
                    </div>
                    <div className="font-medium capitalize">{channel} Frequency</div>
                  </div>
                  <select
                    value={frequency}
                    onChange={(e) => handleFrequencyChange(channel as any, e.target.value)}
                    className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="immediate">Immediate</option>
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    {channel === 'email' && <option value="weekly">Weekly</option>}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Quiet Hours */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Quiet Hours
            </h2>
            <p className="text-gray-600 mb-6">
              Set specific hours when you don't want to receive notifications (except critical alerts).
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Switch
                  checked={localPreferences.quiet_hours?.enabled || false}
                  onChange={(checked) => handleQuietHoursChange('enabled', checked)}
                  className={`${
                    localPreferences.quiet_hours?.enabled ? 'bg-blue-600' : 'bg-gray-200'
                  } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                >
                  <span
                    className={`${
                      localPreferences.quiet_hours?.enabled ? 'translate-x-6' : 'translate-x-1'
                    } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                  />
                </Switch>
                <label className="font-medium">Enable Quiet Hours</label>
              </div>
              
              {localPreferences.quiet_hours?.enabled && (
                <div className="grid grid-cols-2 gap-4 mt-4 ml-8">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={localPreferences.quiet_hours?.start || '22:00'}
                      onChange={(e) => handleQuietHoursChange('start', e.target.value)}
                      className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={localPreferences.quiet_hours?.end || '08:00'}
                      onChange={(e) => handleQuietHoursChange('end', e.target.value)}
                      className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Language & Timezone */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Language & Timezone
            </h2>
            <p className="text-gray-600 mb-6">
              Set your preferred language and timezone for notifications.
            </p>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Language
                </label>
                <select
                  value={localPreferences.language}
                  onChange={(e) => setLocalPreferences({
                    ...localPreferences,
                    language: e.target.value
                  })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="en">English</option>
                  <option value="vi">Tiếng Việt</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timezone
                </label>
                <select
                  value={localPreferences.timezone}
                  onChange={(e) => setLocalPreferences({
                    ...localPreferences,
                    timezone: e.target.value
                  })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="Asia/Ho_Chi_Minh">Ho Chi Minh City (UTC+7)</option>
                  <option value="America/New_York">New York (UTC-5)</option>
                  <option value="Europe/London">London (UTC+0)</option>
                  <option value="Asia/Tokyo">Tokyo (UTC+9)</option>
                  <option value="Australia/Sydney">Sydney (UTC+11)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="mt-8 flex justify-end space-x-4">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </Button>
          
          {hasChanges && (
            <>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={saving}
              >
                Reset Changes
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default NotificationSettingsPage;