/**
 * Mobile Bottom Sheet - Phase 3 Implementation
 * Touch-optimized bottom sheet for mobile interfaces
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo, useAnimation } from 'framer-motion';
import { X, ChevronDown, Maximize2, Minimize2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useHapticFeedback } from '../../../hooks/useMobileGestures';

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  snapPoints?: number[];
  defaultSnapPoint?: number;
  showHandle?: boolean;
  showHeader?: boolean;
  closeOnOverlayClick?: boolean;
  enableSwipeDown?: boolean;
  maxHeight?: string;
  className?: string;
}

export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  snapPoints = [0.25, 0.5, 0.9],
  defaultSnapPoint = 1,
  showHandle = true,
  showHeader = true,
  closeOnOverlayClick = true,
  enableSwipeDown = true,
  maxHeight = '90vh',
  className
}) => {
  const [currentSnapPoint, setCurrentSnapPoint] = useState(defaultSnapPoint);
  const [isDragging, setIsDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  const haptic = useHapticFeedback();

  // Calculate sheet height based on snap point
  const getSheetHeight = (snapPoint: number) => {
    return `${snapPoint * 100}vh`;
  };

  // Find nearest snap point
  const findNearestSnapPoint = (percentage: number) => {
    return snapPoints.reduce((prev, curr) => {
      return Math.abs(curr - percentage) < Math.abs(prev - percentage) ? curr : prev;
    });
  };

  // Handle drag end
  const handleDragEnd = (_: any, info: PanInfo) => {
    setIsDragging(false);
    
    const sheetHeight = sheetRef.current?.offsetHeight || window.innerHeight;
    const draggedPercentage = 1 - (info.offset.y / sheetHeight);
    
    // Close if dragged down significantly
    if (enableSwipeDown && info.offset.y > 100 && info.velocity.y > 0) {
      haptic.impact('light');
      onClose();
      return;
    }
    
    // Snap to nearest point
    const nearestSnapPoint = findNearestSnapPoint(draggedPercentage);
    const nearestIndex = snapPoints.indexOf(nearestSnapPoint);
    
    if (nearestIndex !== currentSnapPoint) {
      haptic.impact('light');
    }
    
    setCurrentSnapPoint(nearestIndex);
    controls.start({
      y: 0,
      transition: { type: 'spring', stiffness: 300, damping: 30 }
    });
  };

  // Cycle through snap points
  const cycleSnapPoints = () => {
    const nextIndex = (currentSnapPoint + 1) % snapPoints.length;
    setCurrentSnapPoint(nextIndex);
    haptic.impact('light');
  };

  // Reset snap point when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentSnapPoint(defaultSnapPoint);
    }
  }, [isOpen, defaultSnapPoint]);

  const currentHeight = snapPoints[currentSnapPoint];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeOnOverlayClick ? onClose : undefined}
          />

          {/* Bottom Sheet */}
          <motion.div
            ref={sheetRef}
            className={clsx(
              "fixed bottom-0 left-0 right-0 z-50",
              "bg-white rounded-t-2xl shadow-2xl",
              "flex flex-col",
              className
            )}
            style={{
              height: getSheetHeight(currentHeight),
              maxHeight
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            drag={enableSwipeDown ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={handleDragEnd}
          >
            {/* Drag Handle */}
            {showHandle && (
              <div className="flex justify-center py-3">
                <motion.div
                  className={clsx(
                    "w-12 h-1 bg-gray-300 rounded-full",
                    isDragging && "bg-gray-400"
                  )}
                  animate={{ scale: isDragging ? 1.2 : 1 }}
                />
              </div>
            )}

            {/* Header */}
            {showHeader && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  {title || 'Options'}
                </h3>
                
                <div className="flex items-center space-x-2">
                  {/* Snap Point Toggle */}
                  {snapPoints.length > 1 && (
                    <motion.button
                      onClick={cycleSnapPoints}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {currentSnapPoint === snapPoints.length - 1 ? (
                        <Minimize2 className="w-5 h-5 text-gray-600" />
                      ) : (
                        <Maximize2 className="w-5 h-5 text-gray-600" />
                      )}
                    </motion.button>
                  )}
                  
                  {/* Close Button */}
                  <motion.button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </motion.button>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="p-6">
                {children}
              </div>
            </div>

            {/* iOS Safe Area */}
            <div className="pb-safe" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

/**
 * Mobile Action Sheet - Simplified bottom sheet for actions
 */
interface MobileActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  actions: Array<{
    id: string;
    label: string;
    icon?: React.ComponentType<any>;
    variant?: 'default' | 'danger' | 'warning';
    onClick: () => void;
  }>;
  showCancel?: boolean;
}

export const MobileActionSheet: React.FC<MobileActionSheetProps> = ({
  isOpen,
  onClose,
  title,
  actions,
  showCancel = true
}) => {
  const haptic = useHapticFeedback();

  const handleActionClick = (action: typeof actions[0]) => {
    haptic.impact('light');
    action.onClick();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Action Sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Title */}
            {title && (
              <div className="px-6 py-4 border-b border-gray-100">
                <p className="text-sm text-gray-500 text-center">{title}</p>
              </div>
            )}

            {/* Actions */}
            <div className="py-2">
              {actions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <React.Fragment key={action.id}>
                    {index > 0 && <div className="h-px bg-gray-100" />}
                    <motion.button
                      onClick={() => handleActionClick(action)}
                      className={clsx(
                        "w-full px-6 py-4 flex items-center space-x-3",
                        "text-left transition-colors",
                        action.variant === 'danger' 
                          ? "text-red-600 hover:bg-red-50"
                          : action.variant === 'warning'
                          ? "text-orange-600 hover:bg-orange-50"
                          : "text-gray-900 hover:bg-gray-50"
                      )}
                      whileHover={{ x: 4 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {Icon && <Icon className="w-5 h-5" />}
                      <span className="font-medium">{action.label}</span>
                    </motion.button>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Cancel Button */}
            {showCancel && (
              <>
                <div className="h-2 bg-gray-100" />
                <motion.button
                  onClick={onClose}
                  className="w-full px-6 py-4 text-center font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  whileTap={{ scale: 0.98 }}
                >
                  Cancel
                </motion.button>
              </>
            )}

            {/* iOS Safe Area */}
            <div className="pb-safe" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MobileBottomSheet;