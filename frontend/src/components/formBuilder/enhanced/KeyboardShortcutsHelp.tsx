/**
 * Keyboard Shortcuts Help Component
 * Shows available keyboard shortcuts for field reordering and navigation
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X, Info, ArrowUp, ArrowDown, Command } from 'lucide-react';
import { clsx } from 'clsx';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

interface ShortcutItem {
  keys: string[];
  action: string;
  category: 'movement' | 'selection' | 'navigation';
}

const shortcuts: ShortcutItem[] = [
  // Movement shortcuts
  { keys: ['Ctrl/⌘', '↑'], action: 'Move selected field up', category: 'movement' },
  { keys: ['Ctrl/⌘', '↓'], action: 'Move selected field down', category: 'movement' },
  { keys: ['K'], action: 'Move field up (vim-style)', category: 'movement' },
  { keys: ['J'], action: 'Move field down (vim-style)', category: 'movement' },
  { keys: ['Ctrl/⌘', 'Home'], action: 'Move field to top', category: 'movement' },
  { keys: ['Ctrl/⌘', 'End'], action: 'Move field to bottom', category: 'movement' },
  
  // Selection shortcuts
  { keys: ['Shift', '↑'], action: 'Select previous field', category: 'selection' },
  { keys: ['Shift', '↓'], action: 'Select next field', category: 'selection' },
  { keys: ['Tab'], action: 'Navigate to next element', category: 'selection' },
  { keys: ['Shift', 'Tab'], action: 'Navigate to previous element', category: 'selection' },
  
  // Navigation shortcuts
  { keys: ['Ctrl/⌘', 'S'], action: 'Save form', category: 'navigation' },
  { keys: ['Escape'], action: 'Close dialogs/deselect', category: 'navigation' },
  { keys: ['?'], action: 'Show keyboard shortcuts', category: 'navigation' }
];

const KeyIcon: React.FC<{ keyName: string }> = ({ keyName }) => {
  const getKeyIcon = (key: string) => {
    switch (key) {
      case '↑': return <ArrowUp className="w-3 h-3" />;
      case '↓': return <ArrowDown className="w-3 h-3" />;
      case 'Ctrl/⌘': return <Command className="w-3 h-3" />;
      default: return key;
    }
  };

  return (
    <span className={clsx(
      "inline-flex items-center justify-center px-2 py-1 text-xs font-mono font-medium rounded",
      "bg-gray-100 text-gray-700 border border-gray-300 shadow-sm min-w-[24px] h-6"
    )}>
      {getKeyIcon(keyName)}
    </span>
  );
};

const ShortcutRow: React.FC<{ shortcut: ShortcutItem; index: number }> = ({ shortcut, index }) => (
  <motion.div
    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.05 }}
  >
    <div className="flex items-center space-x-2">
      {shortcut.keys.map((key, keyIndex) => (
        <React.Fragment key={keyIndex}>
          {keyIndex > 0 && <span className="text-gray-400 text-xs">+</span>}
          <KeyIcon keyName={key} />
        </React.Fragment>
      ))}
    </div>
    <span className="text-sm text-gray-600 flex-1 ml-4">{shortcut.action}</span>
  </motion.div>
);

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  isOpen,
  onClose,
  className
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'movement' | 'selection' | 'navigation'>('all');

  const categories = [
    { id: 'all' as const, label: 'All Shortcuts', icon: Keyboard },
    { id: 'movement' as const, label: 'Field Movement', icon: ArrowUp },
    { id: 'selection' as const, label: 'Selection', icon: Info },
    { id: 'navigation' as const, label: 'Navigation', icon: Command }
  ];

  const filteredShortcuts = activeCategory === 'all' 
    ? shortcuts 
    : shortcuts.filter(s => s.category === activeCategory);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={clsx(
              "bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden",
              className
            )}
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Keyboard className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Keyboard Shortcuts</h3>
                  <p className="text-sm text-gray-500">Speed up your form building workflow</p>
                </div>
              </div>
              
              <motion.button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <X className="w-5 h-5 text-gray-500" />
              </motion.button>
            </div>

            {/* Category Tabs */}
            <div className="px-6 pt-4">
              <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                {categories.map((category) => {
                  const Icon = category.icon;
                  return (
                    <motion.button
                      key={category.id}
                      onClick={() => setActiveCategory(category.id)}
                      className={clsx(
                        "flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
                        activeCategory === category.id
                          ? "bg-white text-blue-700 shadow-sm"
                          : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                      )}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{category.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Shortcuts List */}
            <div className="px-6 py-4 max-h-96 overflow-y-auto">
              <motion.div
                className="space-y-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                {filteredShortcuts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Keyboard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No shortcuts available for this category.</p>
                  </div>
                ) : (
                  filteredShortcuts.map((shortcut, index) => (
                    <ShortcutRow key={`${shortcut.keys.join('+')}-${shortcut.action}`} shortcut={shortcut} index={index} />
                  ))
                )}
              </motion.div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2 text-gray-600">
                  <Info className="w-4 h-4" />
                  <span>Press <KeyIcon keyName="?" /> anytime to open this help</span>
                </div>
                <div className="text-gray-500">
                  {filteredShortcuts.length} shortcuts
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Keyboard shortcuts trigger button
export const KeyboardShortcutsButton: React.FC<{
  onClick: () => void;
  className?: string;
}> = ({ onClick, className }) => (
  <motion.button
    onClick={onClick}
    className={clsx(
      "flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-sm",
      className
    )}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    title="Show keyboard shortcuts (Press ? key)"
  >
    <Keyboard className="w-4 h-4" />
    <span>Shortcuts</span>
  </motion.button>
);

export default KeyboardShortcutsHelp;