import React, { useState } from 'react';
import { useCommentCount } from './useComments';
import { CommentButton } from '../components/comments/CommentButton';
import { CommentPanel } from '../components/comments/CommentPanel';

interface UseCommentButtonProps {
  submissionId: string;
  currentUserId: string;
  currentUserName?: string;
  isAdmin?: boolean;
}

/**
 * Hook to manage comment button and panel for a submission
 */
export function useCommentButton({
  submissionId,
  currentUserId,
  currentUserName,
  isAdmin = false
}: UseCommentButtonProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  
  // Fetch comment count
  const { data: countData } = useCommentCount(submissionId);
  const commentCount = countData?.data?.count || 0;

  const openPanel = () => setIsPanelOpen(true);
  const closePanel = () => setIsPanelOpen(false);

  const CommentButtonComponent = () => (
    <CommentButton
      submissionId={submissionId}
      commentCount={commentCount}
      onClick={openPanel}
    />
  );

  const CommentPanelComponent = () => (
    <CommentPanel
      isOpen={isPanelOpen}
      onClose={closePanel}
      submissionId={submissionId}
      currentUserId={currentUserId}
      currentUserName={currentUserName}
      isAdmin={isAdmin}
    />
  );

  return {
    commentCount,
    isPanelOpen,
    openPanel,
    closePanel,
    CommentButton: CommentButtonComponent,
    CommentPanel: CommentPanelComponent
  };
}