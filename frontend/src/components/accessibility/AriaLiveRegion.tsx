/**
 * ARIA Live Region Component
 * Announces dynamic content changes to screen readers
 * WCAG 2.1 Criterion 4.1.3 - Status Messages (Level AA)
 */

import React, { useState, useEffect, useRef } from 'react';

interface AriaLiveRegionProps {
  message: string;
  politeness?: 'polite' | 'assertive' | 'off';
  atomic?: boolean;
  relevant?: 'additions' | 'removals' | 'text' | 'all' | 'additions text' | 'removals text' | 'text additions' | 'text removals' | 'additions removals' | 'removals additions';
  className?: string;
}

export const AriaLiveRegion: React.FC<AriaLiveRegionProps> = ({
  message,
  politeness = 'polite',
  atomic = true,
  relevant = 'additions text',
  className = ''
}) => {
  const [currentMessage, setCurrentMessage] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (message && message !== currentMessage) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Update message immediately
      setCurrentMessage(message);

      // Clear message after 5 seconds to allow for repeated announcements
      timeoutRef.current = setTimeout(() => {
        setCurrentMessage('');
      }, 5000);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [message, currentMessage]);

  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic={atomic}
      aria-relevant={relevant}
      className={`sr-only ${className}`}
    >
      {currentMessage}
    </div>
  );
};

// Global live region for application-wide announcements
export const GlobalAriaLive: React.FC = () => {
  return (
    <>
      {/* Polite announcements for non-critical updates */}
      <div
        id="aria-live-polite"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      
      {/* Assertive announcements for important updates */}
      <div
        id="aria-live-assertive"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />
      
      {/* Alert region for error messages */}
      <div
        id="aria-live-alert"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />
    </>
  );
};

// Utility function to announce messages
export const announceToScreenReader = (
  message: string,
  politeness: 'polite' | 'assertive' | 'alert' = 'polite'
) => {
  const regionId = politeness === 'alert' 
    ? 'aria-live-alert' 
    : `aria-live-${politeness}`;
  
  const region = document.getElementById(regionId);
  if (region) {
    // Clear existing content
    region.textContent = '';
    
    // Use setTimeout to ensure the change is detected
    setTimeout(() => {
      region.textContent = message;
      
      // Clear after announcement
      setTimeout(() => {
        region.textContent = '';
      }, 5000);
    }, 100);
  }
};