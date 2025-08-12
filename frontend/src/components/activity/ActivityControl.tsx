// Activity Control Component (Admin Only)
// Date: 2025-08-04

import React, { useState, useEffect } from 'react';
import { activityService } from '../../services/activityService';
import LoadingSpinner from '../common/LoadingSpinner';
import Alert from '../common/Alert';
import Button from '../common/Button';

interface ActivityControlState {
  enabled: boolean;
  environment: string;
  asyncLogging: boolean;
}

export const ActivityControl: React.FC = () => {
  const [status, setStatus] = useState<ActivityControlState | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await activityService.getActivityStatus();
      setStatus(response.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    if (!status) return;

    try {
      setToggling(true);
      setError(null);
      setSuccess(null);
      
      const newEnabled = !status.enabled;
      const response = await activityService.toggleActivityLogging(newEnabled);
      
      setStatus(prev => prev ? { ...prev, enabled: newEnabled } : null);
      setSuccess(response.message || `Activity logging ${newEnabled ? 'enabled' : 'disabled'}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setToggling(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Activity Logging Control</h3>
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Activity Logging Control</h3>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Admin Only</span>
            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <Alert 
            type="error" 
            message={error}
            dismissible={true}
            onDismiss={clearMessages}
            className="mb-4"
          />
        )}

        {success && (
          <Alert 
            type="success" 
            message={success}
            dismissible={true}
            onDismiss={clearMessages}
            className="mb-4"
          />
        )}

        {status && (
          <div className="space-y-6">
            {/* Current Status */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Current Status</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Logging Status:</span>
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${status.enabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className={`font-medium ${status.enabled ? 'text-green-700' : 'text-red-700'}`}>
                      {status.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Environment:</span>
                  <span className="font-medium text-gray-900 capitalize">
                    {status.environment}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Async Processing:</span>
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${status.asyncLogging ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                    <span className="font-medium text-gray-900">
                      {status.asyncLogging ? 'On' : 'Off'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Control Actions */}
            <div className="border-t pt-6">
              <h4 className="font-medium text-gray-900 mb-4">Actions</h4>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">
                    {status.enabled ? 'Disable' : 'Enable'} activity logging system-wide
                  </p>
                  <p className="text-xs text-gray-500">
                    {status.enabled 
                      ? 'This will stop logging user activities immediately' 
                      : 'This will start logging user activities immediately'
                    }
                  </p>
                </div>
                
                <Button
                  onClick={handleToggle}
                  disabled={toggling}
                  variant={status.enabled ? "danger" : "primary"}
                  className="ml-4"
                >
                  {toggling ? (
                    <div className="flex items-center space-x-2">
                      <LoadingSpinner size="sm" />
                      <span>Processing...</span>
                    </div>
                  ) : (
                    status.enabled ? 'Disable Logging' : 'Enable Logging'
                  )}
                </Button>
              </div>
            </div>

            {/* Refresh Status */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">
                    Refresh current status
                  </p>
                  <p className="text-xs text-gray-500">
                    Get the latest activity logging configuration
                  </p>
                </div>
                
                <Button
                  onClick={fetchStatus}
                  disabled={loading}
                  variant="secondary"
                  className="ml-4"
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <LoadingSpinner size="sm" />
                      <span>Loading...</span>
                    </div>
                  ) : (
                    'Refresh Status'
                  )}
                </Button>
              </div>
            </div>

            {/* Warning Notice */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="text-yellow-600">⚠️</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Important Notice
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Disabling activity logging will stop tracking user actions</li>
                      <li>Historical logs will remain in the database</li>
                      <li>Changes take effect immediately</li>
                      <li>Only admin users can control this setting</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};