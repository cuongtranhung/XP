/**
 * Accessible Form Builder - Phase 4 Implementation
 * WCAG 2.1 AAA Compliant Form Builder Interface
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Eye, 
  EyeOff, 
  Volume2, 
  VolumeX,
  Keyboard,
  MousePointer,
  Contrast,
  ZoomIn,
  Info
} from 'lucide-react';
import { clsx } from 'clsx';
import { useKeyboardNavigation } from '../../../hooks/useAccessibility';
import { useAnnouncer } from '../../../hooks/useScreenReader';

interface AccessibleFormBuilderProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Main Accessible Form Builder Wrapper
 */
export const AccessibleFormBuilder: React.FC<AccessibleFormBuilderProps> = ({
  children,
  className
}) => {
  const [highContrast, setHighContrast] = useState(false);
  const [keyboardMode, setKeyboardMode] = useState(false);
  const [screenReaderMode, setScreenReaderMode] = useState(false);
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('normal');
  const announcer = useAnnouncer();

  // Detect keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setKeyboardMode(true);
      }
    };

    const handleMouseDown = () => {
      setKeyboardMode(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  // Detect screen reader
  useEffect(() => {
    const detectScreenReader = () => {
      // Check for common screen reader indicators
      const indicators = [
        window.navigator.userAgent.includes('NVDA'),
        window.navigator.userAgent.includes('JAWS'),
        document.body.getAttribute('role') === 'application',
        // Check for aria-live regions being actively used
        document.querySelectorAll('[aria-live]').length > 0
      ];

      setScreenReaderMode(indicators.some(Boolean));
    };

    detectScreenReader();
  }, []);

  return (
    <div
      className={clsx(
        "min-h-screen",
        highContrast && "high-contrast",
        keyboardMode && "keyboard-mode",
        fontSize === 'large' && "text-lg",
        fontSize === 'xlarge' && "text-xl",
        className
      )}
      data-a11y-mode={screenReaderMode ? 'screen-reader' : 'standard'}
    >
      {/* Skip Links */}
      <SkipLinks />

      {/* Accessibility Toolbar */}
      <AccessibilityToolbar
        highContrast={highContrast}
        onHighContrastToggle={() => {
          setHighContrast(!highContrast);
          announcer.announce(
            highContrast ? 'High contrast mode disabled' : 'High contrast mode enabled'
          );
        }}
        fontSize={fontSize}
        onFontSizeChange={(size) => {
          setFontSize(size);
          announcer.announce(`Font size changed to ${size}`);
        }}
        keyboardMode={keyboardMode}
        screenReaderMode={screenReaderMode}
      />

      {/* Main Content */}
      <main 
        role="main" 
        aria-label="Form Builder Interface"
        className="relative"
      >
        {children}
      </main>

      {/* ARIA Live Region for Announcements */}
      <AriaLiveRegion />

      {/* Keyboard Shortcuts Help */}
      {keyboardMode && <KeyboardShortcutsPanel />}
    </div>
  );
};

/**
 * Skip Links for Keyboard Navigation
 */
const SkipLinks: React.FC = () => {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <div className="absolute top-0 left-0 z-50 bg-white p-2">
        <a 
          href="#main-content" 
          className="text-blue-600 underline focus:outline-none focus:ring-2 focus:ring-blue-500 px-3 py-2 block"
        >
          Skip to main content
        </a>
        <a 
          href="#field-library" 
          className="text-blue-600 underline focus:outline-none focus:ring-2 focus:ring-blue-500 px-3 py-2 block"
        >
          Skip to field library
        </a>
        <a 
          href="#form-canvas" 
          className="text-blue-600 underline focus:outline-none focus:ring-2 focus:ring-blue-500 px-3 py-2 block"
        >
          Skip to form canvas
        </a>
        <a 
          href="#properties-panel" 
          className="text-blue-600 underline focus:outline-none focus:ring-2 focus:ring-blue-500 px-3 py-2 block"
        >
          Skip to properties panel
        </a>
      </div>
    </div>
  );
};

/**
 * Accessibility Toolbar
 */
interface AccessibilityToolbarProps {
  highContrast: boolean;
  onHighContrastToggle: () => void;
  fontSize: 'normal' | 'large' | 'xlarge';
  onFontSizeChange: (size: 'normal' | 'large' | 'xlarge') => void;
  keyboardMode: boolean;
  screenReaderMode: boolean;
}

const AccessibilityToolbar: React.FC<AccessibilityToolbarProps> = ({
  highContrast,
  onHighContrastToggle,
  fontSize,
  onFontSizeChange,
  keyboardMode,
  screenReaderMode
}) => {
  const [showToolbar, setShowToolbar] = useState(false);

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setShowToolbar(!showToolbar)}
        className="fixed top-4 right-4 z-50 p-2 bg-white rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50"
        aria-label="Accessibility Options"
        aria-expanded={showToolbar}
      >
        <Eye className="w-5 h-5 text-gray-700" />
      </button>

      {/* Toolbar Panel */}
      <AnimatePresence>
        {showToolbar && (
          <motion.div
            className="fixed top-16 right-4 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-72"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            role="toolbar"
            aria-label="Accessibility Controls"
          >
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Accessibility Options
            </h3>

            {/* High Contrast Toggle */}
            <div className="mb-4">
              <button
                onClick={onHighContrastToggle}
                className={clsx(
                  "w-full flex items-center justify-between p-3 rounded-lg border transition-colors",
                  highContrast 
                    ? "bg-gray-900 text-white border-gray-700"
                    : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
                )}
                aria-pressed={highContrast}
              >
                <div className="flex items-center space-x-2">
                  <Contrast className="w-5 h-5" />
                  <span className="text-sm font-medium">High Contrast</span>
                </div>
                <span className="text-xs">
                  {highContrast ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>

            {/* Font Size Controls */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Text Size
              </label>
              <div className="flex space-x-2">
                <button
                  onClick={() => onFontSizeChange('normal')}
                  className={clsx(
                    "flex-1 px-3 py-2 text-sm rounded-lg border transition-colors",
                    fontSize === 'normal'
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  )}
                  aria-pressed={fontSize === 'normal'}
                >
                  A
                </button>
                <button
                  onClick={() => onFontSizeChange('large')}
                  className={clsx(
                    "flex-1 px-3 py-2 text-lg rounded-lg border transition-colors",
                    fontSize === 'large'
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  )}
                  aria-pressed={fontSize === 'large'}
                >
                  A
                </button>
                <button
                  onClick={() => onFontSizeChange('xlarge')}
                  className={clsx(
                    "flex-1 px-3 py-2 text-xl rounded-lg border transition-colors",
                    fontSize === 'xlarge'
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  )}
                  aria-pressed={fontSize === 'xlarge'}
                >
                  A
                </button>
              </div>
            </div>

            {/* Mode Indicators */}
            <div className="space-y-2 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <Keyboard className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700">Keyboard Navigation</span>
                </div>
                <span className={clsx(
                  "text-xs font-medium",
                  keyboardMode ? "text-green-600" : "text-gray-400"
                )}>
                  {keyboardMode ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <Volume2 className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700">Screen Reader</span>
                </div>
                <span className={clsx(
                  "text-xs font-medium",
                  screenReaderMode ? "text-green-600" : "text-gray-400"
                )}>
                  {screenReaderMode ? 'DETECTED' : 'NOT DETECTED'}
                </span>
              </div>
            </div>

            {/* Keyboard Shortcuts Info */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-600">
                Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">?</kbd> for keyboard shortcuts
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

/**
 * ARIA Live Region for Screen Reader Announcements
 */
const AriaLiveRegion: React.FC = () => {
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const handleAnnouncement = (event: CustomEvent) => {
      setAnnouncement(event.detail.message);
      // Clear after announcement
      setTimeout(() => setAnnouncement(''), 100);
    };

    window.addEventListener('aria-announce' as any, handleAnnouncement);
    return () => {
      window.removeEventListener('aria-announce' as any, handleAnnouncement);
    };
  }, []);

  return (
    <>
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
      <div 
        role="alert" 
        aria-live="assertive" 
        aria-atomic="true"
        className="sr-only"
        id="alert-region"
      />
    </>
  );
};

/**
 * Keyboard Shortcuts Panel
 */
const KeyboardShortcutsPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && e.shiftKey) {
        setIsOpen(!isOpen);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const shortcuts = [
    { keys: 'Tab', description: 'Navigate forward' },
    { keys: 'Shift + Tab', description: 'Navigate backward' },
    { keys: 'Enter / Space', description: 'Activate element' },
    { keys: 'Arrow Keys', description: 'Navigate within components' },
    { keys: 'Escape', description: 'Close dialogs/Cancel operations' },
    { keys: 'Ctrl + D', description: 'Duplicate field' },
    { keys: 'Delete', description: 'Delete selected field' },
    { keys: 'Ctrl + Z', description: 'Undo' },
    { keys: 'Ctrl + Y', description: 'Redo' },
    { keys: 'Ctrl + S', description: 'Save form' },
    { keys: '/', description: 'Focus search' },
    { keys: '?', description: 'Show this help' }
  ];

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => setIsOpen(false)}
    >
      <motion.div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Keyboard Shortcuts"
        aria-modal="true"
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Keyboard Shortcuts
        </h2>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.keys}
              className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg"
            >
              <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">
                {shortcut.keys}
              </kbd>
              <span className="text-sm text-gray-700 ml-4">
                {shortcut.description}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={() => setIsOpen(false)}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AccessibleFormBuilder;