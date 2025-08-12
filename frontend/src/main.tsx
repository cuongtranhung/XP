import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PerformanceMonitor } from './utils/performance-monitor';

// Start lightweight performance monitoring
if (import.meta.env.MODE === 'development') {
  const monitor = PerformanceMonitor.getInstance();
  monitor.startMonitoring();
}

// Disable StrictMode in development to prevent double rendering
const enableStrictMode = import.meta.env.VITE_DISABLE_STRICT_MODE !== 'true';

const AppWrapper = enableStrictMode ? (
  <React.StrictMode>
    <App />
  </React.StrictMode>
) : (
  <App />
);

ReactDOM.createRoot(document.getElementById('root')!).render(AppWrapper);