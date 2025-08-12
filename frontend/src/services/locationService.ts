import api from './api';

// Enhanced type definitions
export interface LocationMetadata {
  timestamp?: number;
  serviceWorker?: boolean;
  source?: 'gps' | 'network' | 'passive';
  [key: string]: any;
}

export interface DeviceInfo {
  userAgent: string;
  platform: string;
  language: string;
  screenResolution: string;
  timezone: string;
  deviceId?: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
  deviceId?: string;
  networkType?: 'wifi' | 'cellular' | '4g' | '5g' | 'ethernet' | 'unknown';
  batteryLevel?: number;
  isBackground?: boolean;
  metadata?: LocationMetadata;
}

export interface LocationPreferences {
  trackingEnabled: boolean;
  trackingInterval: number; // seconds, 10-3600
  backgroundTrackingEnabled: boolean;
  highAccuracyMode: boolean;
  maxTrackingDuration: number; // seconds, 300-86400
}

export interface LocationHistoryParams {
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

// Event system types
export interface LocationServiceEvents {
  'tracking-started': { sessionId: string };
  'tracking-stopped': void;
  'location-updated': LocationData;
  'error': { error: Error; context: string };
  'permission-changed': PermissionState;
  'preferences-updated': LocationPreferences;
}

// Configuration constants
const LOCATION_CONFIG = {
  DISTANCE_THRESHOLD: 10, // meters
  UPDATE_DEBOUNCE: 1000, // ms
  API_RETRY_ATTEMPTS: 3,
  API_RETRY_DELAY: 1000, // ms
  POSITION_TIMEOUT: 30000, // ms
  MAX_FAILED_LOCATIONS: 100,
  SERVICE_WORKER_PATH: '/location-tracking-sw.js'
};

// Custom error classes
class LocationServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'LocationServiceError';
  }
}

class LocationPermissionError extends LocationServiceError {
  constructor(message: string = 'Location permission denied') {
    super(message, 'PERMISSION_DENIED');
  }
}

class LocationTrackingError extends LocationServiceError {
  constructor(message: string = 'Location tracking failed') {
    super(message, 'TRACKING_FAILED');
  }
}

class LocationService {
  // Event system
  private eventListeners: Map<keyof LocationServiceEvents, Set<Function>> = new Map();
  
  // Debouncing and throttling
  private updateDebounceTimer: NodeJS.Timeout | null = null;
  // private lastApiCall: number = 0; // Commented out - unused variable
  
  // State management
  private trackingSessionId: string | null = null;
  private watchId: number | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private lastLocation: LocationData | null = null;
  private isTracking: boolean = false;
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;

  // Event system methods
  on<K extends keyof LocationServiceEvents>(
    event: K, 
    callback: (data: LocationServiceEvents[K]) => void
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }
  
  off<K extends keyof LocationServiceEvents>(
    event: K, 
    callback: (data: LocationServiceEvents[K]) => void
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }
  
  private emit<K extends keyof LocationServiceEvents>(
    event: K, 
    data: LocationServiceEvents[K]
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  async initialize(): Promise<void> {
    try {
      if (!navigator.geolocation) {
        throw new LocationServiceError('Geolocation is not supported by this browser', 'GEOLOCATION_UNSUPPORTED');
      }

      const permission = await this.requestLocationPermission();
      if (permission !== 'granted') {
        throw new LocationPermissionError('Location permission denied');
      }

      if ('serviceWorker' in navigator) {
        await this.registerServiceWorker();
      }
      
      console.log('LocationService initialized successfully');
    } catch (error) {
      this.emit('error', { 
        error: error instanceof Error ? error : new Error('Unknown initialization error'), 
        context: 'initialization' 
      });
      throw error;
    }
  }

  private async requestLocationPermission(): Promise<PermissionState> {
    try {
      // First check current permission status
      const result = await navigator.permissions.query({ name: 'geolocation' });
      
      // Listen for permission changes
      result.addEventListener('change', () => {
        this.emit('permission-changed', result.state);
      });
      
      // If permission is not granted, try to request it by making a geolocation call
      if (result.state !== 'granted') {
        try {
          // This will trigger the browser's permission prompt
          await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              resolve,
              reject,
              {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 60000 // Allow cached position to avoid unnecessary GPS usage
              }
            );
          });
          
          // Check permission status again after the request
          const updatedResult = await navigator.permissions.query({ name: 'geolocation' });
          return updatedResult.state;
        } catch (geoError: any) {
          // If user denied permission, the geolocation call will fail
          if (geoError.code === 1) { // PERMISSION_DENIED
            return 'denied';
          }
          // For other errors (timeout, position unavailable), check permission status
          const finalResult = await navigator.permissions.query({ name: 'geolocation' });
          return finalResult.state;
        }
      }
      
      return result.state;
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return 'denied';
    }
  }

  private async registerServiceWorker(): Promise<void> {
    try {
      this.serviceWorkerRegistration = await navigator.serviceWorker.register(
        LOCATION_CONFIG.SERVICE_WORKER_PATH,
        { scope: '/' }
      );
      
      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      
      // Set up message handler for service worker communication
      navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));
      
      console.log('Service Worker registered successfully for location tracking');
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      this.emit('error', { 
        error: error instanceof Error ? error : new Error('Service Worker registration failed'), 
        context: 'service-worker-registration' 
      });
    }
  }
  
  private handleServiceWorkerMessage(event: MessageEvent): void {
    const { type, data } = event.data;
    
    switch (type) {
      case 'GET_AUTH_TOKEN':
        // Send auth token to service worker
        const token = localStorage.getItem('token'); // Adjust based on your auth implementation
        event.ports[0]?.postMessage({ type: 'AUTH_TOKEN_RESPONSE', token });
        break;
        
      case 'LOCATION_RECORDED':
        console.log('Background location recorded:', data);
        break;
        
      case 'LOCATION_ERROR':
        this.emit('error', { 
          error: new Error(data.message || 'Background location error'), 
          context: 'background-tracking' 
        });
        break;
    }
  }

  async startTracking(_preferences?: Partial<LocationPreferences>): Promise<void> {
    if (this.isTracking) {
      console.warn('Location tracking already active');
      return;
    }

    try {
      const currentPrefs = await this.getPreferences();
      
      if (!currentPrefs.trackingEnabled) {
        throw new LocationTrackingError('Location tracking is disabled in user preferences');
      }

      // Start tracking session
      const response = await this.retryApiCall(
        () => api.post('/api/gps-module/location/session/start', {
          deviceInfo: this.getDeviceInfo()
        })
      );
      
      this.trackingSessionId = (response as any).data.data.sessionId;
      this.isTracking = true;

      // Start foreground tracking
      this.startForegroundTracking(currentPrefs);

      // Start background tracking if enabled
      if (currentPrefs.backgroundTrackingEnabled) {
        await this.setupBackgroundTracking(currentPrefs);
      }

      // Emit tracking started event
      this.emit('tracking-started', { sessionId: this.trackingSessionId || '' });
      
      console.log('Location tracking started successfully', { 
        sessionId: this.trackingSessionId,
        backgroundTracking: currentPrefs.backgroundTrackingEnabled
      });
    } catch (error) {
      this.isTracking = false;
      this.trackingSessionId = null;
      
      const trackingError = error instanceof Error ? error : new LocationTrackingError('Unknown error starting tracking');
      
      this.emit('error', { 
        error: trackingError, 
        context: 'start-tracking' 
      });
      
      throw trackingError;
    }
  }

  private startForegroundTracking(preferences: LocationPreferences): void {
    const options: PositionOptions = {
      enableHighAccuracy: preferences.highAccuracyMode,
      timeout: LOCATION_CONFIG.POSITION_TIMEOUT,
      maximumAge: 0
    };

    // Start watching position
    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handleLocationUpdate(position),
      (error) => this.handleLocationError(error),
      options
    );

    // Set up interval for regular updates
    this.intervalId = setInterval(
      () => this.getCurrentLocationAndRecord(),
      preferences.trackingInterval * 1000
    );
    
    console.log('Foreground tracking started', {
      interval: preferences.trackingInterval,
      highAccuracy: preferences.highAccuracyMode
    });
  }

  private async setupBackgroundTracking(preferences: LocationPreferences): Promise<void> {
    if (!this.serviceWorkerRegistration) {
      console.warn('Service Worker not available for background tracking');
      return;
    }

    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'START_BACKGROUND_TRACKING',
        config: {
          sessionId: this.trackingSessionId,
          interval: preferences.trackingInterval * 1000,
          highAccuracy: preferences.highAccuracyMode
        }
      });
    }
  }

  private async handleLocationUpdate(position: GeolocationPosition): Promise<void> {
    // Debounce location updates
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
    }
    
    this.updateDebounceTimer = setTimeout(async () => {
      try {
        const locationData: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude || undefined,
          altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
          heading: position.coords.heading || undefined,
          speed: position.coords.speed || undefined,
          deviceId: this.getDeviceId(),
          networkType: this.getNetworkType() as LocationData['networkType'],
          batteryLevel: await this.getBatteryLevel(),
          isBackground: document.hidden,
          metadata: {
            timestamp: position.timestamp,
            source: 'gps'
          }
        };

        if (this.hasLocationChangedSignificantly(locationData)) {
          this.lastLocation = locationData;
          await this.recordLocation(locationData);
        }
      } catch (error) {
        this.emit('error', { 
          error: error instanceof Error ? error : new Error('Location update failed'), 
          context: 'location-update' 
        });
      }
    }, LOCATION_CONFIG.UPDATE_DEBOUNCE);
  }

  async recordLocation(location: LocationData): Promise<void> {
    if (!this.trackingSessionId) {
      const error = new LocationTrackingError('No active tracking session');
      this.emit('error', { error, context: 'record-location' });
      return;
    }

    try {
      await this.retryApiCall(
        () => api.post('/api/gps-module/location/record', {
          ...location,
          sessionId: this.trackingSessionId
        })
      );
      
      // Emit location updated event
      this.emit('location-updated', location);
    } catch (error) {
      const locationError = error instanceof Error ? error : new LocationTrackingError('Failed to record location');
      
      console.error('Failed to record location:', locationError);
      this.storeFailedLocation(location);
      
      this.emit('error', { 
        error: locationError, 
        context: 'record-location' 
      });
    }
  }
  
  // API retry logic
  private async retryApiCall<T>(apiCall: () => Promise<T>): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= LOCATION_CONFIG.API_RETRY_ATTEMPTS; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown API error');
        
        if (attempt === LOCATION_CONFIG.API_RETRY_ATTEMPTS) {
          break;
        }
        
        // Wait before retrying
        await new Promise(resolve => 
          setTimeout(resolve, LOCATION_CONFIG.API_RETRY_DELAY * attempt)
        );
      }
    }
    
    throw lastError!;
  }

  async stopTracking(): Promise<void> {
    if (!this.isTracking) {
      console.log('Tracking is not active');
      return;
    }

    try {
      // Clear all timers and watchers
      this.cleanup();

      // Stop background tracking
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'STOP_BACKGROUND_TRACKING'
        });
      }

      // End tracking session
      if (this.trackingSessionId) {
        try {
          await this.retryApiCall(
            () => api.post(`/api/gps-module/location/session/${this.trackingSessionId}/end`)
          );
        } catch (error) {
          console.error('Failed to end tracking session:', error);
          // Don't throw here as we still want to clean up local state
        }
      }

      // Reset state
      this.isTracking = false;
      this.trackingSessionId = null;
      this.lastLocation = null;
      
      // Emit tracking stopped event
      this.emit('tracking-stopped', undefined);
      
      console.log('Location tracking stopped successfully');
    } catch (error) {
      const stopError = error instanceof Error ? error : new LocationTrackingError('Failed to stop tracking');
      
      this.emit('error', { 
        error: stopError, 
        context: 'stop-tracking' 
      });
      
      // Still clean up state even if there was an error
      this.cleanup();
      this.isTracking = false;
      this.trackingSessionId = null;
      this.lastLocation = null;
      
      throw stopError;
    }
  }
  
  private cleanup(): void {
    // Clear geolocation watch
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    // Clear interval timer
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    // Clear debounce timer
    if (this.updateDebounceTimer !== null) {
      clearTimeout(this.updateDebounceTimer);
      this.updateDebounceTimer = null;
    }
  }

  async getPreferences(): Promise<LocationPreferences> {
    const response = await api.get('/api/gps-module/location/preferences');
    return (response as any).data.data;
  }

  async updatePreferences(preferences: Partial<LocationPreferences>): Promise<LocationPreferences> {
    try {
      const response = await this.retryApiCall(
        () => api.put('/api/gps-module/location/preferences', preferences)
      );
      
      const updatedPreferences = (response as any).data.data;
      
      // Emit preferences updated event
      this.emit('preferences-updated', updatedPreferences);
      
      return updatedPreferences;
    } catch (error) {
      const prefsError = error instanceof Error ? error : new LocationServiceError('Failed to update preferences', 'PREFERENCES_UPDATE_FAILED');
      
      this.emit('error', { 
        error: prefsError, 
        context: 'update-preferences' 
      });
      
      throw prefsError;
    }
  }

  async getLocationHistory(params?: any): Promise<any[]> {
    const response = await api.get('/api/gps-module/location/history', { params });
    return (response as any).data.data;
  }

  async getCurrentLocation(): Promise<LocationData | null> {
    try {
      const response = await api.get('/api/gps-module/location/current');
      return (response as any).data.data;
    } catch (error) {
      return null;
    }
  }

  // Getters for component integration
  get isCurrentlyTracking(): boolean {
    return this.isTracking;
  }

  get currentSessionId(): string | null {
    return this.trackingSessionId;
  }

  get latestLocation(): LocationData | null {
    return this.lastLocation;
  }

  // Helper methods
  private getCurrentLocationAndRecord(): void {
    navigator.geolocation.getCurrentPosition(
      (position) => this.handleLocationUpdate(position),
      (error) => this.handleLocationError(error),
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0
      }
    );
  }

  private handleLocationError(error: GeolocationPositionError): void {
    let errorMessage: string;
    let errorCode: string;
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location access denied by user';
        errorCode = 'PERMISSION_DENIED';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information unavailable';
        errorCode = 'POSITION_UNAVAILABLE';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timed out';
        errorCode = 'TIMEOUT';
        break;
      default:
        errorMessage = 'Unknown location error';
        errorCode = 'UNKNOWN_ERROR';
    }
    
    const locationError = new LocationServiceError(errorMessage, errorCode);
    
    console.error('Geolocation error:', {
      code: error.code,
      message: error.message,
      mappedError: errorMessage
    });
    
    this.emit('error', { error: locationError, context: 'geolocation' });
  }

  private hasLocationChangedSignificantly(newLocation: LocationData): boolean {
    if (!this.lastLocation) return true;
    
    const R = 6371e3; // Earth's radius in meters
    const φ1 = this.lastLocation.latitude * Math.PI / 180;
    const φ2 = newLocation.latitude * Math.PI / 180;
    const Δφ = (newLocation.latitude - this.lastLocation.latitude) * Math.PI / 180;
    const Δλ = (newLocation.longitude - this.lastLocation.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    return distance > 10; // 10 meters threshold
  }

  private getDeviceId(): string {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = this.generateDeviceId();
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  private generateDeviceId(): string {
    return 'web-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  private getNetworkType(): string {
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    if (connection) {
      return connection.effectiveType || connection.type || 'unknown';
    }
    
    return 'unknown';
  }

  private async getBatteryLevel(): Promise<number | undefined> {
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();
        return Math.round(battery.level * 100);
      } catch (error) {
        console.error('Failed to get battery level:', error);
      }
    }
    return undefined;
  }

  private getDeviceInfo(): DeviceInfo {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      deviceId: this.getDeviceId()
    };
  }
  
  // Method to get device capabilities
  getCapabilities(): {
    geolocation: boolean;
    serviceWorker: boolean;
    backgroundSync: boolean;
    battery: boolean;
    networkInfo: boolean;
  } {
    return {
      geolocation: 'geolocation' in navigator,
      serviceWorker: 'serviceWorker' in navigator,
      backgroundSync: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype,
      battery: 'getBattery' in navigator,
      networkInfo: 'connection' in navigator
    };
  }
  
  // Method to get tracking statistics
  getStatistics(): {
    isTracking: boolean;
    sessionId: string | null;
    lastLocationTime: Date | null;
    failedLocationsCount: number;
  } {
    const failedLocations = JSON.parse(
      localStorage.getItem('failedLocations') || '[]'
    );
    
    return {
      isTracking: this.isTracking,
      sessionId: this.trackingSessionId,
      lastLocationTime: this.lastLocation ? new Date() : null,
      failedLocationsCount: failedLocations.length
    };
  }

  private storeFailedLocation(location: LocationData): void {
    try {
      const failedLocations = JSON.parse(
        localStorage.getItem('failedLocations') || '[]'
      );
      
      // Add current failed location
      failedLocations.push({
        ...location,
        failedAt: new Date().toISOString(),
        sessionId: this.trackingSessionId
      });
      
      // Limit storage to prevent memory issues
      if (failedLocations.length > LOCATION_CONFIG.MAX_FAILED_LOCATIONS) {
        failedLocations.splice(0, failedLocations.length - LOCATION_CONFIG.MAX_FAILED_LOCATIONS);
      }
      
      localStorage.setItem('failedLocations', JSON.stringify(failedLocations));
      
      console.log('Stored failed location for retry', {
        locationCount: failedLocations.length,
        sessionId: this.trackingSessionId
      });
    } catch (error) {
      console.error('Failed to store failed location:', error);
    }
  }
  
  // Method to retry failed locations
  async retryFailedLocations(): Promise<void> {
    try {
      const failedLocations = JSON.parse(
        localStorage.getItem('failedLocations') || '[]'
      );
      
      if (failedLocations.length === 0) {
        return;
      }
      
      console.log(`Retrying ${failedLocations.length} failed locations`);
      
      const retryPromises = failedLocations.map(async (location: any) => {
        try {
          await this.recordLocation(location);
          return location;
        } catch (error) {
          return null; // Keep failed location for next retry
        }
      });
      
      const results = await Promise.allSettled(retryPromises);
      
      // Filter out successfully retried locations
      const stillFailed = results
        .map((result, index) => result.status === 'rejected' ? failedLocations[index] : null)
        .filter(Boolean);
      
      localStorage.setItem('failedLocations', JSON.stringify(stillFailed));
      
      const retriedCount = failedLocations.length - stillFailed.length;
      console.log(`Successfully retried ${retriedCount} locations, ${stillFailed.length} still failed`);
    } catch (error) {
      console.error('Error retrying failed locations:', error);
    }
  }
}

// Export error classes and types for use in components
export {
  LocationServiceError,
  LocationPermissionError,
  LocationTrackingError
};

export default new LocationService();