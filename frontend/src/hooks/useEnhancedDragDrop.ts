/**
 * Enhanced Drag & Drop Hook
 * Optimizes drag and drop experience with larger drop zones and better mobile support
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useHapticFeedback } from './useMobileGestures';

interface DragState {
  isDragging: boolean;
  draggedItem: any;
  draggedFrom: 'sidebar' | 'canvas' | null;
  hoveredDropZone: string | null;
  dropZoneSize: 'small' | 'medium' | 'large';
}

interface DropZoneConfig {
  id: string;
  size: 'small' | 'medium' | 'large';
  position: 'top' | 'middle' | 'bottom';
  acceptsFrom: ('sidebar' | 'canvas')[];
}

export const useEnhancedDragDrop = (isMobile: boolean = false) => {
  const haptic = useHapticFeedback();
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedItem: null,
    draggedFrom: null,
    hoveredDropZone: null,
    dropZoneSize: 'medium'
  });

  const dropZones = useRef<Map<string, DropZoneConfig>>(new Map());
  const dragStartTime = useRef<number>(0);

  // Register drop zone
  const registerDropZone = useCallback((config: DropZoneConfig) => {
    dropZones.current.set(config.id, config);
  }, []);

  // Unregister drop zone
  const unregisterDropZone = useCallback((id: string) => {
    dropZones.current.delete(id);
  }, []);

  // Start drag operation
  const startDrag = useCallback((item: any, from: 'sidebar' | 'canvas') => {
    dragStartTime.current = Date.now();
    setDragState(prev => ({
      ...prev,
      isDragging: true,
      draggedItem: item,
      draggedFrom: from,
      dropZoneSize: isMobile ? 'large' : 'medium'
    }));

    // Haptic feedback on drag start
    haptic.light();

    // Increase drop zone sizes during drag
    setTimeout(() => {
      setDragState(prev => ({
        ...prev,
        dropZoneSize: 'large'
      }));
    }, 100);
  }, [isMobile, haptic]);

  // End drag operation
  const endDrag = useCallback(() => {
    const dragDuration = Date.now() - dragStartTime.current;
    
    setDragState(prev => ({
      ...prev,
      isDragging: false,
      draggedItem: null,
      draggedFrom: null,
      hoveredDropZone: null,
      dropZoneSize: 'medium'
    }));

    // Success haptic if drag was meaningful
    if (dragDuration > 200) {
      haptic.success();
    }
  }, [haptic]);

  // Handle drop zone hover
  const handleDropZoneHover = useCallback((zoneId: string | null) => {
    if (zoneId !== dragState.hoveredDropZone) {
      setDragState(prev => ({
        ...prev,
        hoveredDropZone: zoneId
      }));

      // Light haptic feedback on zone hover
      if (zoneId && dragState.isDragging) {
        haptic.light();
      }
    }
  }, [dragState.hoveredDropZone, dragState.isDragging, haptic]);

  // Get drop zone style based on state
  const getDropZoneStyle = useCallback((zoneId: string, baseClass: string = '') => {
    const config = dropZones.current.get(zoneId);
    const isHovered = dragState.hoveredDropZone === zoneId;
    const size = dragState.dropZoneSize;

    let sizeClasses = '';
    if (dragState.isDragging) {
      switch (size) {
        case 'small':
          sizeClasses = 'h-8';
          break;
        case 'medium':
          sizeClasses = isMobile ? 'h-16' : 'h-12';
          break;
        case 'large':
          sizeClasses = isMobile ? 'h-24' : 'h-20';
          break;
      }
    }

    const hoverClasses = isHovered 
      ? 'border-blue-500 bg-blue-50 scale-105 shadow-lg' 
      : 'border-blue-300 bg-blue-50/50';

    const visibilityClasses = dragState.isDragging 
      ? 'opacity-100 visible' 
      : 'opacity-0 invisible';

    return `${baseClass} ${sizeClasses} ${hoverClasses} ${visibilityClasses} transition-all duration-200`;
  }, [dragState, isMobile]);

  // Check if drop is valid
  const isValidDrop = useCallback((zoneId: string) => {
    const config = dropZones.current.get(zoneId);
    if (!config || !dragState.draggedFrom) return false;
    
    return config.acceptsFrom.includes(dragState.draggedFrom);
  }, [dragState.draggedFrom]);

  // Get drop zone properties for enhanced feedback
  const getDropZoneProps = useCallback((zoneId: string) => {
    const config = dropZones.current.get(zoneId);
    const isHovered = dragState.hoveredDropZone === zoneId;
    const isValid = isValidDrop(zoneId);

    return {
      'data-drop-zone': zoneId,
      'data-drag-active': dragState.isDragging,
      'data-hovered': isHovered,
      'data-valid': isValid,
      onDragEnter: () => handleDropZoneHover(zoneId),
      onDragLeave: () => handleDropZoneHover(null),
      className: getDropZoneStyle(zoneId, 'border-2 border-dashed rounded-xl')
    };
  }, [dragState, handleDropZoneHover, isValidDrop, getDropZoneStyle]);

  // Enhanced visual feedback for different drop zones
  const getDropIndicatorIcon = useCallback((position: 'top' | 'middle' | 'bottom') => {
    switch (position) {
      case 'top':
        return '⬆️';
      case 'middle':
        return '➕';
      case 'bottom':
        return '⬇️';
      default:
        return '➕';
    }
  }, []);

  // Auto-expand drop zones on mobile
  useEffect(() => {
    if (isMobile && dragState.isDragging) {
      // Expand all drop zones for easier targeting on mobile
      setDragState(prev => ({
        ...prev,
        dropZoneSize: 'large'
      }));
    }
  }, [isMobile, dragState.isDragging]);

  return {
    dragState,
    startDrag,
    endDrag,
    registerDropZone,
    unregisterDropZone,
    handleDropZoneHover,
    getDropZoneStyle,
    getDropZoneProps,
    getDropIndicatorIcon,
    isValidDrop,
    // Helper methods
    isDragging: dragState.isDragging,
    draggedItem: dragState.draggedItem,
    hoveredDropZone: dragState.hoveredDropZone,
    canDrop: (zoneId: string) => dragState.isDragging && isValidDrop(zoneId)
  };
};

export default useEnhancedDragDrop;