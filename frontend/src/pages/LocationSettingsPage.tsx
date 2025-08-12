import React, { useState } from 'react';
import { MapPin, Play, Square, Settings, Shield, History, RefreshCw } from '../components/icons';
import { useLocation } from '../hooks/useLocation';

const LocationSettingsPage: React.FC = () => {
  const {
    isTracking,
    currentLocation,
    preferences,
    permissionStatus,
    error,
    loading,
    startTracking,
    stopTracking,
    updatePreferences,
    requestPermissions,
    refreshLocation
  } = useLocation();

  const [showHistory, setShowHistory] = useState(false);

  const handleToggleTracking = async () => {
    if (isTracking) {
      await stopTracking();
    } else {
      await startTracking();
    }
  };

  const handlePreferenceChange = async (key: string, value: any) => {
    await updatePreferences({ [key]: value });
  };

  const getPermissionStatusColor = (status: PermissionState | null) => {
    switch (status) {
      case 'granted': return 'text-green-600 bg-green-50';
      case 'denied': return 'text-red-600 bg-red-50';
      case 'prompt': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPermissionStatusText = (status: PermissionState | null) => {
    switch (status) {
      case 'granted': return 'Location access granted';
      case 'denied': return 'Location access denied';
      case 'prompt': return 'Location permission required';
      default: return 'Checking permission...';
    }
  };

  if (loading && !preferences) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <MapPin className="h-8 w-8 text-blue-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900">GPS Location Tracking</h1>
          </div>
          <p className="text-gray-600">
            Manage your location tracking preferences and view your location history.
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex">
              <Shield className="h-5 w-5 text-red-400 mr-2 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Permission Status */}
        <div className="mb-6">
          <div className={`p-4 rounded-lg border ${getPermissionStatusColor(permissionStatus)}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                <span className="font-medium">{getPermissionStatusText(permissionStatus)}</span>
              </div>
              {permissionStatus !== 'granted' && (
                <button
                  onClick={requestPermissions}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Grant Permission
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tracking Control Panel */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <Settings className="h-6 w-6 text-gray-600 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900">Tracking Control</h2>
            </div>

            {/* Current Status */}
            <div className="mb-6">
              <div className={`p-4 rounded-lg ${isTracking ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'} border`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-3 ${isTracking ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                    <span className="font-medium">
                      {isTracking ? 'Tracking Active' : 'Tracking Inactive'}
                    </span>
                  </div>
                  <button
                    onClick={handleToggleTracking}
                    disabled={loading || permissionStatus !== 'granted'}
                    className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                      isTracking
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isTracking ? (
                      <>
                        <Square className="h-4 w-4 mr-2" />
                        Stop Tracking
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Start Tracking
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Current Location */}
            {currentLocation && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-700">Current Location</h3>
                  <button
                    onClick={refreshLocation}
                    disabled={loading}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Latitude: {currentLocation.latitude.toFixed(6)}</div>
                  <div>Longitude: {currentLocation.longitude.toFixed(6)}</div>
                  {currentLocation.accuracy && (
                    <div>Accuracy: {Math.round(currentLocation.accuracy)}m</div>
                  )}
                </div>
              </div>
            )}

            {/* Tracking Preferences */}
            {preferences && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700">Tracking Settings</h3>
                
                {/* Enable Tracking */}
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-600">Enable Location Tracking</label>
                  <input
                    type="checkbox"
                    checked={preferences.trackingEnabled}
                    onChange={(e) => handlePreferenceChange('trackingEnabled', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>

                {/* Background Tracking */}
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-600">Background Tracking</label>
                  <input
                    type="checkbox"
                    checked={preferences.backgroundTrackingEnabled}
                    onChange={(e) => handlePreferenceChange('backgroundTrackingEnabled', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>

                {/* High Accuracy Mode */}
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-600">High Accuracy Mode</label>
                  <input
                    type="checkbox"
                    checked={preferences.highAccuracyMode}
                    onChange={(e) => handlePreferenceChange('highAccuracyMode', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>

                {/* Tracking Interval */}
                <div>
                  <label className="block text-sm text-gray-600 mb-2">
                    Tracking Interval: {preferences.trackingInterval} seconds
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="300"
                    step="10"
                    value={preferences.trackingInterval}
                    onChange={(e) => handlePreferenceChange('trackingInterval', parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>10s</span>
                    <span>300s</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Location History Panel */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <History className="h-6 w-6 text-gray-600 mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">Location History</h2>
              </div>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                {showHistory ? 'Hide' : 'Show'} History
              </button>
            </div>

            {showHistory ? (
              <div className="space-y-3">
                <div className="text-sm text-gray-500">
                  Location history will be displayed here when available.
                </div>
                {/* TODO: Implement location history component */}
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                Click "Show History" to view your recent location data.
              </div>
            )}
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start">
            <Shield className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
            <div className="text-sm">
              <h3 className="font-medium text-blue-900 mb-1">Privacy & Security</h3>
              <p className="text-blue-800">
                Your location data is encrypted and stored securely. You can disable tracking at any time, 
                and historical data is automatically deleted after 30 days. We never share your location 
                data with third parties.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationSettingsPage;