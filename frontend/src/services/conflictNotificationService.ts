/**
 * Conflict Notification Service
 * Handles displaying conflict notifications to users
 */

import toast from 'react-hot-toast';

interface ConflictNotification {
  message: string;
  operation: {
    type: string;
    fieldId?: string;
    field?: any;
    position?: number;
    fromIndex?: number;
    toIndex?: number;
  };
}

export class ConflictNotificationService {
  /**
   * Display conflict notification
   */
  static showConflict(conflict: ConflictNotification): void {
    const { message, operation } = conflict;
    
    // Create user-friendly message based on operation type
    let userMessage = message;
    
    switch (operation.type) {
      case 'add':
        userMessage = `Unable to add field: Another user added a field at the same position. The field has been moved to avoid conflict.`;
        break;
      case 'update':
        if (operation.fieldId) {
          userMessage = `Unable to update field: The field was modified by another user. Please refresh and try again.`;
        }
        break;
      case 'delete':
        if (operation.fieldId) {
          userMessage = `Unable to delete field: The field was already deleted or modified by another user.`;
        }
        break;
      case 'reorder':
        userMessage = `Unable to reorder fields: Another user reordered fields at the same time. The order has been adjusted.`;
        break;
    }
    
    // Show warning toast
    toast(userMessage, {
      icon: '⚠️',
      duration: 5000,
      position: 'top-center',
      style: {
        background: '#FEF3C7',
        color: '#92400E',
      },
    });
  }
  
  /**
   * Show merge notification
   */
  static showMerge(operation: any): void {
    let message = 'Your changes were merged with another user\'s changes.';
    
    if (operation.type === 'add' && operation.position !== undefined) {
      message = `Field added at position ${operation.position + 1} (adjusted due to concurrent edits)`;
    } else if (operation.type === 'update') {
      message = 'Field updated successfully (merged with concurrent changes)';
    } else if (operation.type === 'reorder') {
      message = 'Fields reordered successfully (adjusted for concurrent changes)';
    }
    
    toast(message, {
      icon: 'ℹ️',
      duration: 3000,
      position: 'top-center',
    });
  }
  
  /**
   * Show collaboration info
   */
  static showCollaborationInfo(message: string): void {
    toast(message, {
      icon: 'ℹ️',
      duration: 3000,
      position: 'bottom-right',
    });
  }
  
  /**
   * Show error notification
   */
  static showError(message: string): void {
    toast.error(message, {
      duration: 5000,
      position: 'top-center',
    });
  }
}