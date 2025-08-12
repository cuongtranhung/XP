let trackingConfig = null;
let trackingInterval = null;

self.addEventListener('message', (event) => {
  const { type, config } = event.data;
  
  switch (type) {
    case 'START_BACKGROUND_TRACKING':
      startBackgroundTracking(config);
      break;
    case 'STOP_BACKGROUND_TRACKING':
      stopBackgroundTracking();
      break;
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'location-sync') {
    event.waitUntil(syncOfflineLocations());
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'location-tracking') {
    event.waitUntil(trackLocationInBackground());
  }
});

function startBackgroundTracking(config) {
  trackingConfig = config;
  
  if (trackingInterval) {
    clearInterval(trackingInterval);
  }
  
  trackingInterval = setInterval(() => {
    trackLocationInBackground();
  }, config.interval);
  
  console.log('Background tracking started', config);
}

function stopBackgroundTracking() {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
  trackingConfig = null;
  console.log('Background tracking stopped');
}

async function trackLocationInBackground() {
  if (!trackingConfig) return;
  
  try {
    const position = await getCurrentPosition();
    
    const locationData = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      altitudeAccuracy: position.coords.altitudeAccuracy,
      heading: position.coords.heading,
      speed: position.coords.speed,
      isBackground: true,
      deviceId: await getDeviceId(),
      networkType: getNetworkType(),
      metadata: {
        timestamp: position.timestamp,
        serviceWorker: true
      }
    };
    
    await sendLocationToServer(locationData);
    
  } catch (error) {
    console.error('Background location tracking error:', error);
    await storeFailedLocation(locationData);
  }
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      {
        enableHighAccuracy: trackingConfig?.highAccuracy || true,
        timeout: 30000,
        maximumAge: 0
      }
    );
  });
}

async function sendLocationToServer(locationData) {
  const token = await getAuthToken();
  
  if (!token) {
    throw new Error('No auth token available');
  }
  
  const response = await fetch('/api/gps-module/location/record', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Tracking-Session': trackingConfig.sessionId
    },
    body: JSON.stringify({
      ...locationData,
      sessionId: trackingConfig.sessionId
    })
  });
  
  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
  }
  
  return response.json();
}

async function getAuthToken() {
  return new Promise((resolve) => {
    self.clients.matchAll().then(clients => {
      if (clients.length > 0) {
        clients[0].postMessage({ type: 'GET_AUTH_TOKEN' });
        
        // Set up one-time listener for token response
        const handler = (event) => {
          if (event.data.type === 'AUTH_TOKEN_RESPONSE') {
            self.removeEventListener('message', handler);
            resolve(event.data.token);
          }
        };
        
        self.addEventListener('message', handler);
        
        // Timeout after 5 seconds
        setTimeout(() => {
          self.removeEventListener('message', handler);
          resolve(null);
        }, 5000);
      } else {
        resolve(null);
      }
    });
  });
}

async function getDeviceId() {
  return 'sw-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function getNetworkType() {
  const connection = navigator.connection || 
                      navigator.mozConnection || 
                      navigator.webkitConnection;
  
  if (connection) {
    return connection.effectiveType || connection.type || 'unknown';
  }
  
  return 'unknown';
}

async function storeFailedLocation(locationData) {
  if (!locationData) return;
  
  try {
    // Store failed location in IndexedDB for later sync
    const failedLocation = {
      ...locationData,
      failedAt: new Date().toISOString(),
      sessionId: trackingConfig?.sessionId
    };
    
    // Simple storage using Cache API as fallback
    const cache = await caches.open('failed-locations');
    const request = new Request(`/failed-location-${Date.now()}`, {
      method: 'POST',
      body: JSON.stringify(failedLocation)
    });
    
    await cache.put(request, new Response(JSON.stringify(failedLocation)));
    
    // Register background sync if available
    if (self.registration && self.registration.sync) {
      await self.registration.sync.register('location-sync');
    }
  } catch (error) {
    console.error('Failed to store failed location:', error);
  }
}

async function syncOfflineLocations() {
  try {
    const cache = await caches.open('failed-locations');
    const requests = await cache.keys();
    
    for (const request of requests) {
      try {
        const response = await cache.match(request);
        const locationData = await response.json();
        
        await sendLocationToServer(locationData);
        await cache.delete(request);
        
        console.log('Synced offline location');
      } catch (error) {
        console.error('Failed to sync location:', error);
        // Keep in cache for next sync attempt
      }
    }
  } catch (error) {
    console.error('Background sync error:', error);
  }
}

// Install event
self.addEventListener('install', (event) => {
  console.log('Location tracking service worker installing');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Location tracking service worker activated');
  event.waitUntil(self.clients.claim());
});

console.log('Location tracking service worker loaded');