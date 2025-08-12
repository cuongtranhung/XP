/**
 * Screen Reader Support Hooks - Phase 4 Implementation
 * Enhanced screen reader support and ARIA management
 */

import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Hook for screen reader announcements
 */
export const useAnnouncer = () => {
  const announcerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create announcer element if it doesn't exist
    if (!announcerRef.current) {
      const announcer = document.createElement('div');
      announcer.setAttribute('role', 'status');
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      announcer.className = 'sr-only';
      announcer.id = 'screen-reader-announcer';
      document.body.appendChild(announcer);
      announcerRef.current = announcer;
    }

    return () => {
      // Clean up announcer element
      if (announcerRef.current && document.body.contains(announcerRef.current)) {
        document.body.removeChild(announcerRef.current);
      }
    };
  }, []);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!announcerRef.current) return;

    // Update aria-live based on priority
    announcerRef.current.setAttribute('aria-live', priority);
    
    // Clear and set message to ensure it's announced
    announcerRef.current.textContent = '';
    setTimeout(() => {
      if (announcerRef.current) {
        announcerRef.current.textContent = message;
      }
    }, 100);

    // Clear after announcement
    setTimeout(() => {
      if (announcerRef.current) {
        announcerRef.current.textContent = '';
      }
    }, 1000);
  }, []);

  const announceAction = useCallback((action: string, target?: string) => {
    const message = target ? `${action} ${target}` : action;
    announce(message);
  }, [announce]);

  const announceError = useCallback((error: string) => {
    announce(`Error: ${error}`, 'assertive');
  }, [announce]);

  const announceSuccess = useCallback((message: string) => {
    announce(`Success: ${message}`, 'polite');
  }, [announce]);

  return {
    announce,
    announceAction,
    announceError,
    announceSuccess
  };
};

/**
 * Hook for ARIA descriptions
 */
export const useAriaDescriptions = () => {
  const [descriptions, setDescriptions] = useState<Map<string, string>>(new Map());
  const descriptionElementsRef = useRef<Map<string, HTMLElement>>(new Map());

  const addDescription = useCallback((id: string, description: string) => {
    setDescriptions(prev => new Map(prev).set(id, description));

    // Create or update description element
    let element = descriptionElementsRef.current.get(id);
    if (!element) {
      element = document.createElement('div');
      element.id = `aria-description-${id}`;
      element.className = 'sr-only';
      document.body.appendChild(element);
      descriptionElementsRef.current.set(id, element);
    }
    element.textContent = description;

    return `aria-description-${id}`;
  }, []);

  const removeDescription = useCallback((id: string) => {
    setDescriptions(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });

    // Remove element
    const element = descriptionElementsRef.current.get(id);
    if (element && document.body.contains(element)) {
      document.body.removeChild(element);
      descriptionElementsRef.current.delete(id);
    }
  }, []);

  const getDescriptionProps = useCallback((id: string) => {
    if (descriptions.has(id)) {
      return {
        'aria-describedby': `aria-description-${id}`
      };
    }
    return {};
  }, [descriptions]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      descriptionElementsRef.current.forEach(element => {
        if (document.body.contains(element)) {
          document.body.removeChild(element);
        }
      });
    };
  }, []);

  return {
    addDescription,
    removeDescription,
    getDescriptionProps
  };
};

/**
 * Hook for form validation announcements
 */
export const useValidationAnnouncer = () => {
  const announcer = useAnnouncer();
  const { addDescription, removeDescription, getDescriptionProps } = useAriaDescriptions();

  const announceFieldError = useCallback((fieldName: string, error: string) => {
    announcer.announceError(`${fieldName}: ${error}`);
    return addDescription(`${fieldName}-error`, error);
  }, [announcer, addDescription]);

  const clearFieldError = useCallback((fieldName: string) => {
    removeDescription(`${fieldName}-error`);
  }, [removeDescription]);

  const announceFormErrors = useCallback((errors: Record<string, string>) => {
    const errorCount = Object.keys(errors).length;
    if (errorCount === 0) {
      announcer.announceSuccess('Form is valid');
    } else {
      announcer.announceError(
        `Form has ${errorCount} error${errorCount === 1 ? '' : 's'}. ` +
        `First error: ${Object.values(errors)[0]}`
      );
    }
  }, [announcer]);

  const getFieldProps = useCallback((fieldName: string, hasError: boolean) => {
    return {
      'aria-invalid': hasError,
      'aria-required': false, // Set based on field requirements
      ...getDescriptionProps(`${fieldName}-error`)
    };
  }, [getDescriptionProps]);

  return {
    announceFieldError,
    clearFieldError,
    announceFormErrors,
    getFieldProps
  };
};

/**
 * Hook for progress announcements
 */
export const useProgressAnnouncer = () => {
  const announcer = useAnnouncer();
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const announceProgress = useCallback((current: number, total: number, label?: string) => {
    const percentage = Math.round((current / total) * 100);
    const message = label 
      ? `${label}: ${percentage}% complete`
      : `Progress: ${percentage}% complete`;
    
    announcer.announce(message);
  }, [announcer]);

  const startProgressAnnouncements = useCallback((
    getProgress: () => { current: number; total: number; label?: string },
    interval = 5000
  ) => {
    // Clear existing interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    // Start new interval
    progressIntervalRef.current = setInterval(() => {
      const { current, total, label } = getProgress();
      announceProgress(current, total, label);
      
      // Stop when complete
      if (current >= total) {
        stopProgressAnnouncements();
        announcer.announceSuccess(label ? `${label} complete` : 'Process complete');
      }
    }, interval);
  }, [announceProgress, announcer]);

  const stopProgressAnnouncements = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopProgressAnnouncements();
    };
  }, [stopProgressAnnouncements]);

  return {
    announceProgress,
    startProgressAnnouncements,
    stopProgressAnnouncements
  };
};

/**
 * Hook for list navigation announcements
 */
export const useListAnnouncer = () => {
  const announcer = useAnnouncer();

  const announceListItem = useCallback((
    index: number,
    total: number,
    label: string,
    selected = false
  ) => {
    const position = `${index + 1} of ${total}`;
    const status = selected ? 'selected' : '';
    const message = [label, position, status].filter(Boolean).join(', ');
    
    announcer.announce(message);
  }, [announcer]);

  const announceListChange = useCallback((action: string, itemLabel?: string) => {
    const message = itemLabel 
      ? `${action}: ${itemLabel}`
      : action;
    
    announcer.announce(message);
  }, [announcer]);

  const getListItemProps = useCallback((
    index: number,
    total: number,
    label: string,
    selected = false
  ) => {
    return {
      'aria-label': label,
      'aria-setsize': total,
      'aria-posinset': index + 1,
      'aria-selected': selected,
      role: 'option'
    };
  }, []);

  const getListProps = useCallback((label: string, multiselectable = false) => {
    return {
      role: 'listbox',
      'aria-label': label,
      'aria-multiselectable': multiselectable
    };
  }, []);

  return {
    announceListItem,
    announceListChange,
    getListItemProps,
    getListProps
  };
};

/**
 * Hook for drag and drop announcements
 */
export const useDragDropAnnouncer = () => {
  const announcer = useAnnouncer();

  const announceDragStart = useCallback((item: string) => {
    announcer.announce(`Grabbed ${item}. Use arrow keys to move, space to drop`);
  }, [announcer]);

  const announceDragOver = useCallback((target: string, position?: string) => {
    const message = position 
      ? `Over ${target}, ${position}`
      : `Over ${target}`;
    announcer.announce(message);
  }, [announcer]);

  const announceDrop = useCallback((item: string, target: string) => {
    announcer.announceSuccess(`Dropped ${item} on ${target}`);
  }, [announcer]);

  const announceDragCancel = useCallback((item: string) => {
    announcer.announce(`Cancelled moving ${item}`);
  }, [announcer]);

  const getDraggableProps = useCallback((label: string, isDragging = false) => {
    return {
      'aria-label': label,
      'aria-grabbed': isDragging,
      'aria-dropeffect': isDragging ? 'move' : 'none',
      role: 'button'
    };
  }, []);

  const getDropZoneProps = useCallback((label: string, isActive = false) => {
    return {
      'aria-label': label,
      'aria-dropeffect': isActive ? 'move' : 'none',
      role: 'region'
    };
  }, []);

  return {
    announceDragStart,
    announceDragOver,
    announceDrop,
    announceDragCancel,
    getDraggableProps,
    getDropZoneProps
  };
};