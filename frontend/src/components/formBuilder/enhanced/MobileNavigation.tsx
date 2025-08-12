/**
 * Mobile Navigation - Phase 1 Implementation
 * Bottom navigation component for mobile interface
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { Grid3x3, Edit3, Settings, Eye } from 'lucide-react';

type MobilePanel = 'fields' | 'canvas' | 'properties' | 'preview';

interface NavigationItem {
  id: MobilePanel;
  label: string;
  icon: React.ComponentType<any>;
  badge?: boolean;
}

interface MobileNavigationProps {
  activePanel: MobilePanel;
  onPanelChange: (panel: MobilePanel) => void;
  hasSelectedField?: boolean;
  className?: string;
}

const navigationItems: NavigationItem[] = [
  {
    id: 'fields',
    label: 'Fields',
    icon: Grid3x3
  },
  {
    id: 'canvas',
    label: 'Builder',
    icon: Edit3
  },
  {
    id: 'properties',
    label: 'Properties',
    icon: Settings
  },
  {
    id: 'preview',
    label: 'Preview',
    icon: Eye
  }
];

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  activePanel,
  onPanelChange,
  hasSelectedField = false,
  className
}) => {
  return (
    <motion.nav
      className={clsx(
        "bg-white border-t border-gray-200 pb-safe-area-inset-bottom",
        "shadow-lg shadow-gray-900/5",
        className
      )}
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        {navigationItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = activePanel === item.id;
          const isDisabled = item.id === 'properties' && !hasSelectedField;
          
          return (
            <motion.button
              key={item.id}
              onClick={() => !isDisabled && onPanelChange(item.id)}
              disabled={isDisabled}
              className={clsx(
                "relative flex flex-col items-center justify-center px-3 py-2 rounded-xl transition-all duration-200 min-w-0",
                "active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                isActive && !isDisabled && "bg-blue-600 text-white shadow-lg shadow-blue-600/25",
                !isActive && !isDisabled && "text-gray-600 hover:text-gray-800 hover:bg-gray-100",
                isDisabled && "text-gray-300 cursor-not-allowed"
              )}
              whileHover={!isDisabled ? { scale: 1.05 } : {}}
              whileTap={!isDisabled ? { scale: 0.95 } : {}}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + (index * 0.05) }}
            >
              {/* Background indicator */}
              <AnimatePresence>
                {isActive && !isDisabled && (
                  <motion.div
                    className="absolute inset-0 bg-blue-600 rounded-xl"
                    layoutId="mobile-nav-indicator"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </AnimatePresence>

              {/* Icon */}
              <motion.div
                className="relative z-10"
                animate={isActive && !isDisabled ? { scale: 1.1 } : { scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              >
                <Icon className={clsx(
                  "w-5 h-5 mb-1",
                  isActive && !isDisabled && "text-white",
                  !isActive && !isDisabled && "text-gray-600",
                  isDisabled && "text-gray-300"
                )} />
              </motion.div>

              {/* Label */}
              <motion.span
                className={clsx(
                  "text-xs font-medium relative z-10 truncate max-w-full",
                  isActive && !isDisabled && "text-white",
                  !isActive && !isDisabled && "text-gray-600",
                  isDisabled && "text-gray-300"
                )}
                animate={isActive && !isDisabled ? { 
                  fontWeight: 600,
                  fontSize: '0.75rem'
                } : { 
                  fontWeight: 500,
                  fontSize: '0.75rem'
                }}
              >
                {item.label}
              </motion.span>

              {/* Badge for notifications or states */}
              <AnimatePresence>
                {item.id === 'properties' && hasSelectedField && !isActive && (
                  <motion.div
                    className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 500 }}
                  />
                )}
              </AnimatePresence>

              {/* Ripple effect */}
              <motion.div
                className="absolute inset-0 rounded-xl overflow-hidden"
                initial={false}
                animate={isActive && !isDisabled ? {
                  background: "radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)"
                } : {}}
              />
            </motion.button>
          );
        })}
      </div>

      {/* Safe area padding handled by pb-safe-area-inset-bottom class */}
    </motion.nav>
  );
};

export default MobileNavigation;