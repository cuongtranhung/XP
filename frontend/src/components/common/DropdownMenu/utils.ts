/**
 * DropdownMenu utility functions
 */

import React, { ReactNode } from 'react';
import { MenuItem } from './DropdownMenu';
import { Eye, Edit2, Copy, FileText, RotateCw, Trash2 } from '../../icons';

/**
 * Create a menu item with common defaults
 */
export const createMenuItem = (
  id: string,
  label: string,
  onClick: () => void | Promise<void>,
  options: Partial<Omit<MenuItem, 'id' | 'label' | 'onClick'>> = {}
): MenuItem => ({
  id,
  label,
  onClick,
  show: true,
  disabled: false,
  ...options,
});

/**
 * Create multiple menu items from an array of configs
 */
export const createMenuItems = (
  configs: Array<{
    id: string;
    label: string;
    onClick: () => void | Promise<void>;
    options?: Partial<Omit<MenuItem, 'id' | 'label' | 'onClick'>>;
  }>
): MenuItem[] => {
  return configs.map(({ id, label, onClick, options = {} }) =>
    createMenuItem(id, label, onClick, options)
  );
};

/**
 * Create a divider item
 */
export const createDivider = (id: string = `divider-${Date.now()}`): MenuItem => ({
  id,
  label: '',
  onClick: () => {},
  divider: true,
  show: false, // Dividers are visual only
});

/**
 * Create a group of menu items with optional dividers
 */
export const createMenuGroup = (
  items: MenuItem[],
  addDividerBefore = false,
  addDividerAfter = false
): MenuItem[] => {
  const result: MenuItem[] = [];
  
  if (addDividerBefore) {
    result.push(createDivider());
  }
  
  result.push(...items);
  
  if (addDividerAfter) {
    result.push(createDivider());
  }
  
  return result;
};

/**
 * Filter visible menu items
 */
export const filterVisibleItems = (items: MenuItem[]): MenuItem[] => {
  return items.filter(item => item.show !== false);
};

/**
 * Get menu item by ID
 */
export const getMenuItemById = (items: MenuItem[], id: string): MenuItem | undefined => {
  return items.find(item => item.id === id);
};

/**
 * Check if menu has any enabled items
 */
export const hasEnabledItems = (items: MenuItem[]): boolean => {
  return filterVisibleItems(items).some(item => !item.disabled && !item.divider);
};

/**
 * Get keyboard shortcut display text
 */
export const formatShortcut = (shortcut: string): string => {
  return shortcut
    .replace(/cmd|meta/gi, '⌘')
    .replace(/ctrl/gi, '⌃')
    .replace(/alt/gi, '⌥')
    .replace(/shift/gi, '⇧')
    .replace(/\+/g, '');
};

/**
 * Create common action menu items for tables/lists
 */
export const createCommonActions = (
  id: string,
  actions: {
    onEdit?: () => void;
    onView?: () => void;
    onDuplicate?: () => void;
    onDelete?: () => void;
    onArchive?: () => void;
    onRestore?: () => void;
  }
): MenuItem[] => {
  const items: MenuItem[] = [];
  
  if (actions.onView) {
    items.push(createMenuItem(`${id}-view`, 'View', actions.onView, {
      icon: React.createElement(Eye, { className: 'w-4 h-4' }),
      variant: 'default'
    }));
  }
  
  if (actions.onEdit) {
    items.push(createMenuItem(`${id}-edit`, 'Edit', actions.onEdit, {
      icon: React.createElement(Edit2, { className: 'w-4 h-4' }),
      variant: 'default'
    }));
  }
  
  if (actions.onDuplicate) {
    items.push(createMenuItem(`${id}-duplicate`, 'Duplicate', actions.onDuplicate, {
      icon: React.createElement(Copy, { className: 'w-4 h-4' }),
      variant: 'default'
    }));
  }
  
  // Add divider before destructive actions
  if (actions.onArchive || actions.onRestore || actions.onDelete) {
    items.push(createDivider());
  }
  
  if (actions.onArchive) {
    items.push(createMenuItem(`${id}-archive`, 'Archive', actions.onArchive, {
      icon: React.createElement(FileText, { className: 'w-4 h-4' }),
      variant: 'warning'
    }));
  }
  
  if (actions.onRestore) {
    items.push(createMenuItem(`${id}-restore`, 'Restore', actions.onRestore, {
      icon: React.createElement(RotateCw, { className: 'w-4 h-4' }),
      variant: 'success'
    }));
  }
  
  if (actions.onDelete) {
    items.push(createMenuItem(`${id}-delete`, 'Delete', actions.onDelete, {
      icon: React.createElement(Trash2, { className: 'w-4 h-4' }),
      variant: 'danger'
    }));
  }
  
  return items;
};