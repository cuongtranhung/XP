import React from 'react';
// Using simple icon instead of lucide-react to avoid import issues

interface CommentButtonProps {
  submissionId: string;
  commentCount: number;
  onClick: () => void;
  className?: string;
}

export const CommentButton: React.FC<CommentButtonProps> = ({
  submissionId,
  commentCount,
  onClick,
  className = ''
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🔍 CommentButton handleClick called for:', submissionId);
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 ${className}`}
      aria-label={`View comments for submission ${submissionId}`}
      data-testid="comment-button"
      type="button"
    >
      <span className="text-lg">💬</span>
      <span>{commentCount}</span>
    </button>
  );
};