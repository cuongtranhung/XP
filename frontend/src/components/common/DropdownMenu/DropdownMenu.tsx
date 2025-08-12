/**
 * Reusable Dropdown Menu Component
 * Can be used in any table or list view
 */

import React, { useState, useEffect, useRef, ReactNode, useCallback, useMemo } from 'react';
import { MoreVertical } from '../../icons';

export interface MenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void | Promise<void>;
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info';
  show?: boolean;
  divider?: boolean;
  disabled?: boolean;
  description?: string;
  shortcut?: string;
  badge?: string | number;
  submenu?: MenuItem[];
}

export interface DropdownMenuProps {
  items: MenuItem[];
  triggerIcon?: ReactNode;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  position?: 'left' | 'right' | 'auto';
  align?: 'start' | 'end' | 'center';
  size?: 'sm' | 'md' | 'lg';
  triggerLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  maxHeight?: number;
  closeOnSelect?: boolean;
  openOnHover?: boolean;
  hoverDelay?: number;
  onOpen?: () => void;
  onClose?: () => void;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({
  items,
  triggerIcon,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  position = 'right',
  align = 'start',
  size = 'md',
  triggerLabel,
  loading = false,
  disabled = false,
  maxHeight = 384,
  closeOnSelect = true,
  openOnHover = false,
  hoverDelay = 200,
  onOpen,
  onClose
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<'left' | 'right'>('right');
  const [isLoading, setIsLoading] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout>();

  // Auto-position menu to prevent overflow
  useEffect(() => {
    if (isOpen && menuRef.current && position === 'auto') {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      
      if (rect.right > viewportWidth - 20) {
        setMenuPosition('left');
      } else if (rect.left < 20) {
        setMenuPosition('right');
      }
    }
  }, [isOpen, position]);

  // Handle click outside and escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    if (isOpen) {
      // Add small delay to prevent immediate close on open
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscKey);
      }, 10);

      // Focus first enabled item when opening with keyboard
      const firstItem = menuRef.current?.querySelector('button:not(:disabled)') as HTMLButtonElement;
      if (document.activeElement === buttonRef.current) {
        firstItem?.focus();
      }

      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscKey);
      };
    }
    
    // Return cleanup function even when not open
    return () => {};
  }, [isOpen]);

  const handleItemClick = async (item: MenuItem) => {
    if (item.disabled || isLoading) return;
    
    try {
      setIsLoading(true);
      await item.onClick();
      setIsOpen(false);
      buttonRef.current?.focus();
    } catch (error) {
      console.error('Menu item action failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !loading) {
      setIsOpen(!isOpen);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || loading) return;
    
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(!isOpen);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const firstItem = menuRef.current?.querySelector('button:not(:disabled)') as HTMLButtonElement;
        firstItem?.focus();
      }
    } else if (e.key === 'ArrowUp' && !isOpen) {
      e.preventDefault();
      setIsOpen(true);
      // Focus last item when opening with ArrowUp
      setTimeout(() => {
        const items = menuRef.current?.querySelectorAll('button:not(:disabled)') as NodeListOf<HTMLButtonElement>;
        items[items.length - 1]?.focus();
      }, 0);
    }
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent, index: number) => {
    const menuItems = menuRef.current?.querySelectorAll('button:not(:disabled)') as NodeListOf<HTMLButtonElement>;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        const nextIndex = (index + 1) % menuItems.length;
        menuItems[nextIndex]?.focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        const prevIndex = index === 0 ? menuItems.length - 1 : index - 1;
        menuItems[prevIndex]?.focus();
        break;
      case 'Tab':
        if (e.shiftKey && index === 0) {
          e.preventDefault();
          buttonRef.current?.focus();
        } else if (!e.shiftKey && index === menuItems.length - 1) {
          e.preventDefault();
          setIsOpen(false);
          buttonRef.current?.focus();
        }
        break;
      case 'Home':
        e.preventDefault();
        menuItems[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        menuItems[menuItems.length - 1]?.focus();
        break;
    }
  };

  const getVariantClasses = (variant?: string, disabled?: boolean) => {
    if (disabled) {
      return 'text-gray-400 cursor-not-allowed';
    }
    
    switch (variant) {
      case 'success':
        return 'text-green-600 hover:bg-green-50 focus:bg-green-50';
      case 'danger':
        return 'text-red-600 hover:bg-red-50 focus:bg-red-50';
      case 'warning':
        return 'text-yellow-600 hover:bg-yellow-50 focus:bg-yellow-50';
      default:
        return 'text-gray-700 hover:bg-gray-100 focus:bg-gray-100';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          button: 'p-1.5',
          menu: 'w-40',
          item: 'px-3 py-1.5 text-xs',
          icon: 'w-3 h-3'
        };
      case 'lg':
        return {
          button: 'p-3',
          menu: 'w-56',
          item: 'px-5 py-3 text-base',
          icon: 'w-5 h-5'
        };
      default:
        return {
          button: 'p-2',
          menu: 'w-48',
          item: 'px-4 py-2 text-sm',
          icon: 'w-4 h-4'
        };
    }
  };

  const sizeClasses = getSizeClasses();

  const visibleItems = items.filter(item => item.show !== false);
  const actualPosition = position === 'auto' ? menuPosition : position;
  
  // Calculate menu alignment classes
  const getAlignmentClasses = () => {
    if (actualPosition === 'left') {
      return align === 'end' ? 'left-0' : align === 'center' ? '-left-1/2 translate-x-1/2' : 'left-0';
    }
    return align === 'end' ? 'right-0' : align === 'center' ? 'right-1/2 translate-x-1/2' : 'right-0';
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled || loading}
        className={`
          ${sizeClasses.button}
          ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 active:bg-gray-200'}
          rounded-lg transition-all duration-150 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
          ${buttonClassName}
        `}
        aria-label={triggerLabel || 'Menu'}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-disabled={disabled || loading}
      >
        {loading ? (
          <svg className={`animate-spin ${sizeClasses.icon} text-gray-500`} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          triggerIcon || <MoreVertical className={`${sizeClasses.icon} text-gray-500`} />
        )}
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className={`
            absolute ${getAlignmentClasses()} top-full mt-1 ${sizeClasses.menu}
            rounded-lg shadow-xl bg-white border border-gray-200
            ring-1 ring-black ring-opacity-5 z-50
            transform transition-all duration-200 ease-out
            animate-in
            ${menuClassName}
          `}
          style={{ maxHeight: `${maxHeight}px` }}
          role="menu"
          aria-orientation="vertical"
        >
          <div className="py-1 overflow-y-auto" style={{ maxHeight: `${maxHeight - 8}px` }}>
            {visibleItems.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                No actions available
              </div>
            ) : (
              visibleItems.map((item, index) => {
                const itemIndex = items.findIndex(i => i.id === item.id);
                return (
                  <React.Fragment key={item.id}>
                    {item.divider && index > 0 && (
                      <hr className="my-1 border-gray-200" />
                    )}
                    <button
                      type="button"
                      onClick={() => handleItemClick(item)}
                      onKeyDown={(e) => handleMenuKeyDown(e, itemIndex)}
                      disabled={item.disabled || isLoading}
                      className={`
                        group flex items-center justify-between w-full ${sizeClasses.item} text-left
                        ${getVariantClasses(item.variant, item.disabled || isLoading)}
                        ${item.disabled || isLoading ? '' : 'transition-colors duration-150'}
                        focus:outline-none focus:ring-0
                      `}
                      role="menuitem"
                      aria-disabled={item.disabled || isLoading}
                    >
                      <div className="flex items-center min-w-0">
                        {item.icon && (
                          <span className={`${sizeClasses.icon} mr-2 flex-shrink-0`}>
                            {item.icon}
                          </span>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{item.label}</div>
                          {item.description && (
                            <div className="text-xs text-gray-500 truncate mt-0.5">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </div>
                      {item.shortcut && (
                        <kbd className="ml-3 flex-shrink-0 text-xs text-gray-400 font-mono">
                          {item.shortcut}
                        </kbd>
                      )}
                    </button>
                  </React.Fragment>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DropdownMenu;