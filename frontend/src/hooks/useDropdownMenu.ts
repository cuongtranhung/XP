/**
 * Custom hook for managing dropdown menu state and interactions
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseDropdownMenuOptions {
  closeOnSelect?: boolean;
  openOnHover?: boolean;
  hoverDelay?: number;
  onOpen?: () => void;
  onClose?: () => void;
}

export const useDropdownMenu = ({
  closeOnSelect = true,
  openOnHover = false,
  hoverDelay = 200,
  onOpen,
  onClose,
}: UseDropdownMenuOptions = {}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const hoverTimerRef = useRef<NodeJS.Timeout>();

  const open = useCallback(() => {
    setIsOpen(true);
    onOpen?.();
  }, [onOpen]);

  const close = useCallback(() => {
    setIsOpen(false);
    onClose?.();
  }, [onClose]);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  const handleItemClick = useCallback(
    async (onClick: () => void | Promise<void>) => {
      if (isLoading) return;

      try {
        setIsLoading(true);
        await onClick();
        if (closeOnSelect) {
          close();
        }
      } catch (error) {
        console.error('Menu item action failed:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, closeOnSelect, close]
  );

  const handleMouseEnter = useCallback(() => {
    if (openOnHover) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(open, hoverDelay);
    }
  }, [openOnHover, hoverDelay, open]);

  const handleMouseLeave = useCallback(() => {
    if (openOnHover) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(close, 150);
    }
  }, [openOnHover, close]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      clearTimeout(hoverTimerRef.current);
    };
  }, []);

  return {
    isOpen,
    isLoading,
    open,
    close,
    toggle,
    handleItemClick,
    handleMouseEnter,
    handleMouseLeave,
  };
};