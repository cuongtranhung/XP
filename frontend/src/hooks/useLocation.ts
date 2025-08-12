import { useState, useEffect, useCallback } from 'react';
import locationService, { LocationData, LocationPreferences } from '../services/locationService';

interface UseLocationReturn {
  isTracking: boolean;
  currentLocation: LocationData | null;
  preferences: LocationPreferences | null;
  permissionStatus: PermissionState | null;
  error: string | null;
  loading: boolean;
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<void>;
  updatePreferences: (prefs: Partial<LocationPreferences>) => Promise<void>;
  requestPermissions: () => Promise<void>;
  refreshLocation: () => Promise<void>;
}

export const useLocation = (): UseLocationReturn => {
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [preferences, setPreferences] = useState<LocationPreferences | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Check permission status
  const checkPermissionStatus = useCallback(async () => {
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      setPermissionStatus(result.state);
      
      // Listen for permission changes
      result.addEventListener('change', () => {
        setPermissionStatus(result.state);
      });
    } catch (error) {
      console.error('Error checking permission:', error);
      setPermissionStatus('denied');
    }
  }, []);

  // Load initial data
  useEffect(() => {
    const initializeLocation = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Check permissions first
        await checkPermissionStatus();
        
        // Always try to load preferences (these don't require geolocation permission)
        try {
          const prefs = await locationService.getPreferences();
          setPreferences(prefs);
        } catch (prefError) {
          console.warn('Could not load location preferences:', prefError);
          // Set default preferences if server call fails
          setPreferences({
            trackingEnabled: false,
            trackingInterval: 30,
            backgroundTrackingEnabled: false,
            highAccuracyMode: true,
            maxTrackingDuration: 3600
          });
        }
        
        // Only try to get current location if we have permission or it's granted
        // Don't fail the whole initialization if current location fails
        try {
          const location = await locationService.getCurrentLocation();
          setCurrentLocation(location);
        } catch (locationError) {
          console.warn('Could not get current location:', locationError);
          // This is not a fatal error - just means no current location available
        }
        
        // Check if already tracking
        setIsTracking(locationService.isCurrentlyTracking);
        
      } catch (err: any) {
        // Only set error for critical failures, not permission issues
        if (err.code !== 'PERMISSION_DENIED') {
          setError(err.message || 'Failed to initialize location service');
        }
      } finally {
        setLoading(false);
      }
    };

    initializeLocation();
  }, [checkPermissionStatus]);

  const requestPermissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      await locationService.initialize();
      await checkPermissionStatus();
      
      // After successful initialization, try to get current location
      try {
        const location = await locationService.getCurrentLocation();
        setCurrentLocation(location);
      } catch (locationError) {
        console.warn('Could not get current location after permission grant:', locationError);
        // This is not a critical error
      }
      
    } catch (err: any) {
      // Handle permission errors more gracefully
      if (err.code === 'PERMISSION_DENIED') {
        // Don't show error message for permission denied - the UI already shows this
        console.warn('Location permission denied by user');
      } else {
        setError(err.message || 'Permission request failed');
      }
    } finally {
      setLoading(false);
    }
  }, [checkPermissionStatus]);

  const startTracking = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      await locationService.startTracking();
      setIsTracking(true);
    } catch (err: any) {
      setError(err.message || 'Failed to start tracking');
    } finally {
      setLoading(false);
    }
  }, []);

  const stopTracking = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      await locationService.stopTracking();
      setIsTracking(false);
    } catch (err: any) {
      setError(err.message || 'Failed to stop tracking');
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePreferences = useCallback(async (prefs: Partial<LocationPreferences>) => {
    setLoading(true);
    setError(null);
    
    try {
      const updatedPrefs = await locationService.updatePreferences(prefs);
      setPreferences(updatedPrefs);
    } catch (err: any) {
      setError(err.message || 'Failed to update preferences');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const location = await locationService.getCurrentLocation();
      setCurrentLocation(location);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh location');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
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
  };
};