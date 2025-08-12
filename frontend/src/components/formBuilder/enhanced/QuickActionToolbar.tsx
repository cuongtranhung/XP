/**
 * Quick Action Toolbar - Phase 2 Implementation
 * Contextual toolbar with quick actions for form fields
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Copy, 
  Settings, 
  Trash2, 
  Eye, 
  EyeOff, 
  ChevronUp, 
  ChevronDown,
  Lock,
  Unlock,
  Zap,
  MoreVertical,
  Code,
  Palette
} from 'lucide-react';
import { clsx } from 'clsx';

interface QuickAction {
  id: string;
  icon: React.ComponentType<any>;
  label: string;
  shortcut?: string;
  variant?: 'default' | 'danger' | 'warning';
  onClick: () => void;
  disabled?: boolean;
}

interface QuickActionToolbarProps {
  fieldId: string;
  fieldType: string;
  isVisible?: boolean;
  isRequired?: boolean;
  position?: 'top' | 'bottom' | 'inline';
  onAction: (action: string, fieldId: string) => void;
  className?: string;
}

export const QuickActionToolbar: React.FC<QuickActionToolbarProps> = ({
  fieldId,
  fieldType,
  isVisible = true,
  isRequired = false,
  position = 'inline',
  onAction,
  className
}) => {
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  // Primary actions always visible
  const primaryActions: QuickAction[] = [
    {
      id: 'duplicate',
      icon: Copy,
      label: 'Duplicate',
      shortcut: 'Ctrl+D',
      onClick: () => onAction('duplicate', fieldId)
    },
    {
      id: 'edit',
      icon: Settings,
      label: 'Edit Properties',
      shortcut: 'Ctrl+E',
      onClick: () => onAction('edit', fieldId)
    },
    {
      id: 'visibility',
      icon: isVisible ? EyeOff : Eye,
      label: isVisible ? 'Hide Field' : 'Show Field',
      onClick: () => onAction('toggle-visibility', fieldId)
    },
    {
      id: 'delete',
      icon: Trash2,
      label: 'Delete',
      shortcut: 'Del',
      variant: 'danger',
      onClick: () => onAction('delete', fieldId)
    }
  ];

  // Secondary actions in dropdown
  const secondaryActions: QuickAction[] = [
    {
      id: 'move-up',
      icon: ChevronUp,
      label: 'Move Up',
      shortcut: 'Alt+↑',
      onClick: () => onAction('move-up', fieldId)
    },
    {
      id: 'move-down',
      icon: ChevronDown,
      label: 'Move Down',
      shortcut: 'Alt+↓',
      onClick: () => onAction('move-down', fieldId)
    },
    {
      id: 'required',
      icon: isRequired ? Unlock : Lock,
      label: isRequired ? 'Make Optional' : 'Make Required',
      onClick: () => onAction('toggle-required', fieldId)
    },
    {
      id: 'validation',
      icon: Zap,
      label: 'Add Validation',
      onClick: () => onAction('add-validation', fieldId)
    },
    {
      id: 'styling',
      icon: Palette,
      label: 'Custom Styling',
      onClick: () => onAction('custom-styling', fieldId)
    },
    {
      id: 'advanced',
      icon: Code,
      label: 'Advanced Settings',
      onClick: () => onAction('advanced-settings', fieldId)
    }
  ];

  const ActionButton: React.FC<{ action: QuickAction; showLabel?: boolean }> = ({ 
    action, 
    showLabel = false 
  }) => {
    const Icon = action.icon;
    
    return (
      <motion.button
        key={action.id}
        onClick={action.onClick}
        disabled={action.disabled}
        onMouseEnter={() => setHoveredAction(action.id)}
        onMouseLeave={() => setHoveredAction(null)}
        className={clsx(
          "relative flex items-center justify-center transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
          showLabel ? "px-3 py-2 space-x-2" : "w-8 h-8",
          "rounded-lg",
          action.variant === 'danger' 
            ? "text-red-600 hover:bg-red-50 focus:ring-red-500" 
            : action.variant === 'warning'
            ? "text-orange-600 hover:bg-orange-50 focus:ring-orange-500"
            : "text-gray-600 hover:bg-gray-100 focus:ring-gray-500",
          action.disabled && "opacity-50 cursor-not-allowed"
        )}
        whileHover={!action.disabled ? { scale: 1.05 } : {}}
        whileTap={!action.disabled ? { scale: 0.95 } : {}}
      >
        <Icon className={clsx("w-4 h-4", showLabel && "flex-shrink-0")} />
        {showLabel && (
          <span className="text-sm font-medium">{action.label}</span>
        )}
        
        {/* Tooltip */}
        <AnimatePresence>
          {!showLabel && hoveredAction === action.id && (
            <motion.div
              className="absolute bottom-full mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap pointer-events-none z-50"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.15 }}
            >
              {action.label}
              {action.shortcut && (
                <span className="ml-2 text-gray-400">{action.shortcut}</span>
              )}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                <div className="w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-gray-900" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    );
  };

  return (
    <motion.div
      className={clsx(
        "flex items-center bg-white rounded-lg shadow-lg border border-gray-200",
        position === 'inline' && "space-x-1 p-1",
        position === 'top' && "flex-col space-y-1 p-2",
        position === 'bottom' && "flex-col space-y-1 p-2",
        className
      )}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      {/* Primary Actions */}
      <div className={clsx(
        "flex items-center",
        position === 'inline' ? "space-x-1" : "space-x-2"
      )}>
        {primaryActions.map(action => (
          <ActionButton key={action.id} action={action} />
        ))}
        
        {/* More Actions Dropdown */}
        <div className="relative">
          <motion.button
            onClick={() => setShowMoreActions(!showMoreActions)}
            className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <MoreVertical className="w-4 h-4" />
          </motion.button>
          
          <AnimatePresence>
            {showMoreActions && (
              <>
                {/* Backdrop to close dropdown */}
                <motion.div
                  className="fixed inset-0 z-40"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowMoreActions(false)}
                />
                
                {/* Dropdown Menu */}
                <motion.div
                  className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50"
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                >
                  {secondaryActions.map((action, index) => (
                    <React.Fragment key={action.id}>
                      {index === 2 && (
                        <div className="h-px bg-gray-200 my-1" />
                      )}
                      <motion.button
                        onClick={() => {
                          action.onClick();
                          setShowMoreActions(false);
                        }}
                        className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors"
                        whileHover={{ x: 2 }}
                      >
                        <div className="flex items-center space-x-3">
                          <action.icon className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-700">{action.label}</span>
                        </div>
                        {action.shortcut && (
                          <span className="text-xs text-gray-400">{action.shortcut}</span>
                        )}
                      </motion.button>
                    </React.Fragment>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Field Type Indicator */}
      {position !== 'inline' && (
        <motion.div
          className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600 font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {fieldType}
        </motion.div>
      )}
    </motion.div>
  );
};

export default QuickActionToolbar;