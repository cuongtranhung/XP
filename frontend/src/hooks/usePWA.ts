/**
 * PWA Hooks - Phase 3 Implementation
 * Hooks for Progressive Web App features
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook to manage PWA installation
 */
export const useInstallPrompt = () => {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if app was installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setCanInstall(false);
      setInstallPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installPrompt) return false;

    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setInstallPrompt(null);
      setCanInstall(false);
      return true;
    }
    
    return false;
  }, [installPrompt]);

  return {
    canInstall,
    isInstalled,
    promptInstall
  };
};

/**
 * Hook to manage offline/online status
 */
export const useOfflineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineAt, setOfflineAt] = useState<Date | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setOfflineAt(null);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setOfflineAt(new Date());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
    offlineAt,
    offlineDuration: offlineAt ? Date.now() - offlineAt.getTime() : 0
  };
};

/**
 * Hook for background sync
 */
export const useBackgroundSync = () => {
  const [pendingSyncs, setPendingSyncs] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const registerSync = useCallback(async (tag: string = 'sync-forms') => {
    if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
      const registration = await navigator.serviceWorker.ready;
      try {
        await (registration as any).sync.register(tag);
        return true;
      } catch (error) {
        console.error('Background sync registration failed:', error);
        return false;
      }
    }
    return false;
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'SYNC_START') {
        setIsSyncing(true);
      } else if (event.data.type === 'SYNC_SUCCESS') {
        setIsSyncing(false);
        setLastSyncAt(new Date());
        setPendingSyncs(prev => Math.max(0, prev - 1));
      } else if (event.data.type === 'SYNC_QUEUED') {
        setPendingSyncs(prev => prev + 1);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  return {
    pendingSyncs,
    isSyncing,
    lastSyncAt,
    registerSync
  };
};

/**
 * Hook for push notifications
 */
export const usePushNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'default'
  );
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported');
      return 'denied';
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const subscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications not supported');
      return null;
    }

    if (permission !== 'granted') {
      const result = await requestPermission();
      if (result !== 'granted') return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.VITE_VAPID_PUBLIC_KEY
      });

      setSubscription(sub);
      return sub;
    } catch (error) {
      console.error('Push subscription failed:', error);
      return null;
    }
  }, [permission, requestPermission]);

  const unsubscribe = useCallback(async () => {
    if (!subscription) return false;

    try {
      await subscription.unsubscribe();
      setSubscription(null);
      return true;
    } catch (error) {
      console.error('Push unsubscribe failed:', error);
      return false;
    }
  }, [subscription]);

  return {
    permission,
    isSubscribed: !!subscription,
    requestPermission,
    subscribe,
    unsubscribe
  };
};

/**
 * Hook for native share API
 */
export const useNativeShare = () => {
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare('share' in navigator);
  }, []);

  const share = useCallback(async (data: ShareData) => {
    if (!canShare) {
      console.warn('Web Share API not supported');
      return false;
    }

    try {
      await navigator.share(data);
      return true;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Share failed:', error);
      }
      return false;
    }
  }, [canShare]);

  const shareForm = useCallback(async (formId: string, formName: string) => {
    const shareData: ShareData = {
      title: `Form: ${formName}`,
      text: `Check out this form I created with XP Form Builder`,
      url: `${window.location.origin}/form-builder/share/${formId}`
    };

    return share(shareData);
  }, [share]);

  return {
    canShare,
    share,
    shareForm
  };
};

/**
 * Hook for device capabilities
 */
export const useDeviceCapabilities = () => {
  const [capabilities, setCapabilities] = useState({
    hasCamera: false,
    hasMicrophone: false,
    hasGeolocation: false,
    hasVibration: false,
    hasBattery: false,
    hasNetworkInfo: false
  });

  useEffect(() => {
    const checkCapabilities = async () => {
      const caps = {
        hasCamera: false,
        hasMicrophone: false,
        hasGeolocation: 'geolocation' in navigator,
        hasVibration: 'vibrate' in navigator,
        hasBattery: 'getBattery' in navigator,
        hasNetworkInfo: 'connection' in navigator
      };

      // Check media devices
      if ('mediaDevices' in navigator && navigator.mediaDevices.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          caps.hasCamera = devices.some(device => device.kind === 'videoinput');
          caps.hasMicrophone = devices.some(device => device.kind === 'audioinput');
        } catch (error) {
          console.error('Error checking media devices:', error);
        }
      }

      setCapabilities(caps);
    };

    checkCapabilities();
  }, []);

  const vibrate = useCallback((pattern: number | number[] = 200) => {
    if (capabilities.hasVibration) {
      navigator.vibrate(pattern);
      return true;
    }
    return false;
  }, [capabilities.hasVibration]);

  return {
    ...capabilities,
    vibrate
  };
};

/**
 * Hook for service worker updates
 */
export const useServiceWorkerUpdate = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const checkForUpdates = async () => {
      const registration = await navigator.serviceWorker.ready;
      
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        setUpdateAvailable(true);
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
            setUpdateAvailable(true);
          }
        });
      });
    };

    checkForUpdates();
  }, []);

  const updateServiceWorker = useCallback(() => {
    if (!waitingWorker) return;

    waitingWorker.postMessage({ type: 'SKIP_WAITING' });

    // Reload page when new service worker takes control
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }, [waitingWorker]);

  return {
    updateAvailable,
    updateServiceWorker
  };
};

/**
 * Hook for persistent storage
 */
export const usePersistentStorage = () => {
  const [isPersistent, setIsPersistent] = useState(false);
  const [storageEstimate, setStorageEstimate] = useState<{
    usage: number;
    quota: number;
    percentage: number;
  } | null>(null);

  useEffect(() => {
    checkPersistence();
    estimateStorage();
  }, []);

  const checkPersistence = async () => {
    if ('storage' in navigator && 'persisted' in navigator.storage) {
      const persistent = await navigator.storage.persisted();
      setIsPersistent(persistent);
    }
  };

  const requestPersistence = async () => {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      const granted = await navigator.storage.persist();
      setIsPersistent(granted);
      return granted;
    }
    return false;
  };

  const estimateStorage = async () => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      
      setStorageEstimate({
        usage,
        quota,
        percentage: quota > 0 ? (usage / quota) * 100 : 0
      });
    }
  };

  return {
    isPersistent,
    storageEstimate,
    requestPersistence,
    refreshEstimate: estimateStorage
  };
};