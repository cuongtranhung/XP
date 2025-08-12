/**
 * Reusable CommentButton Component
 * Shows comment icon with count and handles click events
 */

import React from 'react';
import { MessageSquare } from '../icons';
import Button from './Button';

interface CommentButtonProps {
  commentCount?: number;
  onClick: () => void;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showCount?: boolean;
}

const CommentButton: React.FC<CommentButtonProps> = ({
  commentCount = 0,
  onClick,
  variant = 'ghost',
  size = 'sm',
  className = '',
  showCount = true
}) => {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      className={`relative ${className}`}
      title={`${commentCount} comment${commentCount !== 1 ? 's' : ''}`}
    >
      <div className="flex items-center gap-1">
        <MessageSquare className="w-4 h-4" />
        {showCount && commentCount > 0 && (
          <span className="text-xs font-medium">
            {commentCount}
          </span>
        )}
      </div>
      
      {/* Badge indicator for comment count when count > 0 */}
      {commentCount > 0 && !showCount && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center min-w-[16px]">
          {commentCount > 99 ? '99+' : commentCount}
        </span>
      )}
    </Button>
  );
};

export default CommentButton;