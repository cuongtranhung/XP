/**
 * PWA Installer Component - Phase 3 Implementation
 * Handles PWA installation and service worker registration
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Download, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Check, 
  X,
  Smartphone,
  Bell,
  Share2
} from 'lucide-react';
import { clsx } from 'clsx';
import { 
  useInstallPrompt, 
  useOfflineStatus, 
  useBackgroundSync,
  usePushNotifications,
  useNativeShare,
  useServiceWorkerUpdate,
  usePersistentStorage
} from '../../../hooks/usePWA';

/**
 * PWA Install Banner
 */
export const PWAInstallBanner: React.FC = () => {
  const { canInstall, promptInstall } = useInstallPrompt();
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Show banner after 30 seconds if can install
    const timer = setTimeout(() => {
      if (canInstall) {
        setShowBanner(true);
      }
    }, 30000);

    return () => clearTimeout(timer);
  }, [canInstall]);

  const handleInstall = async () => {
    setIsInstalling(true);
    const success = await promptInstall();
    
    if (success) {
      setShowBanner(false);
    }
    
    setIsInstalling(false);
  };

  if (!canInstall || !showBanner) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900">
                Install XP Form Builder
              </h3>
              <p className="text-xs text-gray-600 mt-1">
                Install our app for offline access and better performance
              </p>
              
              <div className="flex items-center space-x-2 mt-3">
                <motion.button
                  onClick={handleInstall}
                  disabled={isInstalling}
                  className={clsx(
                    "px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg",
                    "hover:bg-blue-700 transition-colors",
                    isInstalling && "opacity-50 cursor-not-allowed"
                  )}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isInstalling ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Download className="w-4 h-4 inline mr-2" />
                      Install
                    </>
                  )}
                </motion.button>
                
                <button
                  onClick={() => setShowBanner(false)}
                  className="px-4 py-2 text-gray-600 text-sm font-medium hover:text-gray-900 transition-colors"
                >
                  Later
                </button>
              </div>
            </div>
            
            <button
              onClick={() => setShowBanner(false)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Offline Status Indicator
 */
export const OfflineIndicator: React.FC = () => {
  const { isOffline, offlineDuration } = useOfflineStatus();
  const { pendingSyncs, isSyncing } = useBackgroundSync();

  if (!isOffline) return null;

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h offline`;
    if (minutes > 0) return `${minutes}m offline`;
    return `${seconds}s offline`;
  };

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-50"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      exit={{ y: -100 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="bg-orange-500 text-white px-4 py-2">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-3">
            <WifiOff className="w-4 h-4" />
            <span className="text-sm font-medium">
              Working Offline - {formatDuration(offlineDuration)}
            </span>
          </div>
          
          {pendingSyncs > 0 && (
            <div className="flex items-center space-x-2">
              {isSyncing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Syncing...</span>
                </>
              ) : (
                <span className="text-sm">{pendingSyncs} changes pending</span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/**
 * Service Worker Update Notification
 */
export const ServiceWorkerUpdateNotification: React.FC = () => {
  const { updateAvailable, updateServiceWorker } = useServiceWorkerUpdate();
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    if (updateAvailable) {
      setShowNotification(true);
    }
  }, [updateAvailable]);

  if (!showNotification) return null;

  return (
    <motion.div
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
    >
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <RefreshCw className="w-6 h-6 text-blue-600" />
          </div>
          
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-gray-900">
              Update Available
            </h4>
            <p className="text-xs text-gray-600 mt-1">
              A new version of the app is available
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={updateServiceWorker}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              Update
            </button>
            
            <button
              onClick={() => setShowNotification(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/**
 * PWA Features Panel
 */
export const PWAFeaturesPanel: React.FC = () => {
  const { isInstalled } = useInstallPrompt();
  const { isOnline } = useOfflineStatus();
  const { permission, requestPermission, subscribe, isSubscribed } = usePushNotifications();
  const { canShare } = useNativeShare();
  const { isPersistent, requestPersistence, storageEstimate } = usePersistentStorage();

  const features = [
    {
      id: 'offline',
      label: 'Offline Mode',
      icon: isOnline ? Wifi : WifiOff,
      status: isOnline ? 'Online' : 'Offline',
      enabled: true,
      color: isOnline ? 'green' : 'orange'
    },
    {
      id: 'notifications',
      label: 'Push Notifications',
      icon: Bell,
      status: isSubscribed ? 'Enabled' : 'Disabled',
      enabled: isSubscribed,
      color: isSubscribed ? 'green' : 'gray',
      action: !isSubscribed ? subscribe : undefined
    },
    {
      id: 'share',
      label: 'Native Share',
      icon: Share2,
      status: canShare ? 'Available' : 'Not Available',
      enabled: canShare,
      color: canShare ? 'green' : 'gray'
    },
    {
      id: 'storage',
      label: 'Persistent Storage',
      icon: Download,
      status: isPersistent ? 'Enabled' : 'Disabled',
      enabled: isPersistent,
      color: isPersistent ? 'green' : 'gray',
      action: !isPersistent ? requestPersistence : undefined
    }
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        PWA Features
      </h3>
      
      <div className="space-y-3">
        {features.map(feature => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <div className={clsx(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  feature.color === 'green' && "bg-green-100",
                  feature.color === 'orange' && "bg-orange-100",
                  feature.color === 'gray' && "bg-gray-100"
                )}>
                  <Icon className={clsx(
                    "w-5 h-5",
                    feature.color === 'green' && "text-green-600",
                    feature.color === 'orange' && "text-orange-600",
                    feature.color === 'gray' && "text-gray-600"
                  )} />
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {feature.label}
                  </p>
                  <p className="text-xs text-gray-500">
                    {feature.status}
                  </p>
                </div>
              </div>
              
              {feature.action && (
                <button
                  onClick={feature.action}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
                >
                  Enable
                </button>
              )}
              
              {feature.enabled && !feature.action && (
                <Check className="w-5 h-5 text-green-600" />
              )}
            </div>
          );
        })}
      </div>
      
      {storageEstimate && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-900 font-medium mb-2">
            Storage Usage
          </p>
          <div className="w-full bg-blue-100 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${storageEstimate.percentage}%` }}
            />
          </div>
          <p className="text-xs text-blue-700 mt-1">
            {(storageEstimate.usage / 1024 / 1024).toFixed(2)} MB / 
            {(storageEstimate.quota / 1024 / 1024).toFixed(0)} MB
          </p>
        </div>
      )}
    </div>
  );
};

// Register service worker on app mount
export const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('Service Worker registered:', registration);
      
      // Check for updates every hour
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);
      
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }
  return null;
};

export default PWAInstallBanner;