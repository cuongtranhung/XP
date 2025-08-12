/**
 * User Actions Component
 * Provides action buttons for user management operations
 */

import React, { useState } from 'react';
import { User } from '../../types/user.types';
import { AccessibleConfirmDialog } from '../accessibility/AccessibleModal';

interface UserActionsProps {
  user: User;
  onAction: (userId: string, action: string) => Promise<void>;
}

export const UserActions: React.FC<UserActionsProps> = ({ user, onAction }) => {
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    action: string;
    title: string;
    message: string;
  }>({
    isOpen: false,
    action: '',
    title: '',
    message: ''
  });

  const handleAction = (action: string) => {
    switch (action) {
      case 'approve':
        setConfirmDialog({
          isOpen: true,
          action,
          title: 'Approve User',
          message: `Are you sure you want to approve ${user.firstName} ${user.lastName}?`
        });
        break;
      case 'block':
        setConfirmDialog({
          isOpen: true,
          action,
          title: 'Block User',
          message: `Are you sure you want to block ${user.firstName} ${user.lastName}? They will not be able to access the system.`
        });
        break;
      case 'delete':
        setConfirmDialog({
          isOpen: true,
          action,
          title: 'Delete User',
          message: `Are you sure you want to permanently delete ${user.firstName} ${user.lastName}? This action cannot be undone.`
        });
        break;
      default:
        break;
    }
  };

  const handleConfirm = async () => {
    await onAction(user.id, confirmDialog.action);
    setConfirmDialog({ isOpen: false, action: '', title: '', message: '' });
  };

  const handleCancel = () => {
    setConfirmDialog({ isOpen: false, action: '', title: '', message: '' });
  };

  return (
    <>
      <div className="flex items-center space-x-2">
        {user.status === 'pending' && (
          <button
            onClick={() => handleAction('approve')}
            className="p-2 text-green-600 hover:bg-green-50 rounded-md transition-colors"
            aria-label={`Approve ${user.firstName} ${user.lastName}`}
            title="Approve user"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        )}
        
        {user.status !== 'blocked' && (
          <button
            onClick={() => handleAction('block')}
            className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-md transition-colors"
            aria-label={`Block ${user.firstName} ${user.lastName}`}
            title="Block user"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" 
              />
            </svg>
          </button>
        )}
        
        <button
          onClick={() => handleAction('delete')}
          className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
          aria-label={`Delete ${user.firstName} ${user.lastName}`}
          title="Delete user"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
            />
          </svg>
        </button>
      </div>

      <AccessibleConfirmDialog
        isOpen={confirmDialog.isOpen}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.action === 'delete' ? 'danger' : 'warning'}
        confirmText={
          confirmDialog.action === 'approve' ? 'Approve' :
          confirmDialog.action === 'block' ? 'Block' :
          'Delete'
        }
      />
    </>
  );
};