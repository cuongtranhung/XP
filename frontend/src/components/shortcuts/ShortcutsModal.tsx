/**
 * Keyboard Shortcuts Help Modal
 * Displays available keyboard shortcuts organized by category
 */

import React, { useState, useEffect } from 'react';
import { AccessibleModal } from '../accessibility/AccessibleModal';
import { useShortcutsState } from '../../hooks/useKeyboardShortcuts';

interface ShortcutsModalProps {
  shortcuts: Array<{
    key: string;
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
    description: string;
  }>;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ shortcuts }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { formatShortcut, getShortcutsByCategory } = useShortcutsState();

  useEffect(() => {
    const handleShowShortcuts = () => {
      setIsOpen(true);
    };

    document.addEventListener('show-shortcuts-modal', handleShowShortcuts);
    
    return () => {
      document.removeEventListener('show-shortcuts-modal', handleShowShortcuts);
    };
  }, []);

  const categorizedShortcuts = getShortcutsByCategory(shortcuts);

  const renderShortcutGroup = (title: string, groupShortcuts: typeof shortcuts) => {
    if (groupShortcuts.length === 0) return null;

    return (
      <div key={title} className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
          {title === 'Navigation' && '🧭'}
          {title === 'Actions' && '⚡'}
          {title === 'Interface' && '🎛️'}
          <span className="ml-2">{title}</span>
        </h3>
        <div className="space-y-2">
          {groupShortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <span className="text-sm text-gray-700">{shortcut.description}</span>
              <kbd className="inline-flex items-center px-3 py-1 bg-white border border-gray-300 rounded-md text-sm font-mono text-gray-800 shadow-sm">
                {formatShortcut(shortcut)}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="Keyboard Shortcuts"
      size="lg"
      data-shortcut="close-modal"
    >
      <div className="max-h-96 overflow-y-auto">
        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center mb-2">
            <span className="text-blue-600 mr-2">💡</span>
            <span className="text-sm font-medium text-blue-900">Pro Tip</span>
          </div>
          <p className="text-sm text-blue-800">
            Press <kbd className="px-2 py-1 bg-blue-100 rounded text-xs">?</kbd> anytime to show this help.
            Use <kbd className="px-2 py-1 bg-blue-100 rounded text-xs">Ctrl + K</kbd> to open the command palette.
          </p>
        </div>

        {renderShortcutGroup('Navigation', categorizedShortcuts.navigation)}
        {renderShortcutGroup('Actions', categorizedShortcuts.actions)}
        {renderShortcutGroup('Interface', categorizedShortcuts.interface)}

        {/* Additional shortcuts that don't fit categories */}
        {shortcuts.filter(s => 
          !categorizedShortcuts.navigation.includes(s) &&
          !categorizedShortcuts.actions.includes(s) &&
          !categorizedShortcuts.interface.includes(s)
        ).length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
              <span className="mr-2">⚙️</span>
              Other
            </h3>
            <div className="space-y-2">
              {shortcuts.filter(s => 
                !categorizedShortcuts.navigation.includes(s) &&
                !categorizedShortcuts.actions.includes(s) &&
                !categorizedShortcuts.interface.includes(s)
              ).map((shortcut, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <span className="text-sm text-gray-700">{shortcut.description}</span>
                  <kbd className="inline-flex items-center px-3 py-1 bg-white border border-gray-300 rounded-md text-sm font-mono text-gray-800 shadow-sm">
                    {formatShortcut(shortcut)}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>💡 Shortcuts work globally unless you're typing in a text field</span>
          <span>Press <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Esc</kbd> to close</span>
        </div>
      </div>
    </AccessibleModal>
  );
};

// Global shortcuts modal that automatically includes all global shortcuts
export const GlobalShortcutsModal: React.FC = () => {
  const globalShortcuts = [
    { key: '/', description: 'Focus search' },
    { key: 'G', shift: true, description: 'Go to User Management' },
    { key: 'R', shift: true, description: 'Go to Role Management' },
    { key: 'G', ctrl: true, description: 'Go to Group Management' },
    { key: '?', description: 'Show keyboard shortcuts help' },
    { key: 'N', ctrl: true, description: 'Create new user' },
    { key: 'R', ctrl: true, description: 'Refresh current page' },
    { key: 'K', ctrl: true, description: 'Open command palette' },
    { key: 'Escape', description: 'Close modals and dropdowns' }
  ];

  return <ShortcutsModal shortcuts={globalShortcuts} />;
};