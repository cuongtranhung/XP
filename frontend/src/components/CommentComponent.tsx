/**
 * Comment Component for Table View Rows
 * Allows adding, viewing, and managing comments on form submissions
 */

import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import Button from './common/Button';
import Input from './common/Input';
import Badge from './common/Badge';
import Avatar from './common/Avatar';
import { 
  MessageSquare,
  Send,
  Edit,
  Trash2,
  Reply,
  MoreHorizontal,
  X,
  Eye,
  Lock,
  Unlock
} from './icons';
import api from '../services/api';
import { toast } from 'react-hot-toast';

interface Comment {
  id: string;
  submissionId: string;
  userId: number;
  userEmail: string;
  userName: string;
  content: string;
  parentId?: string | null;
  isPrivate: boolean;
  isResolved: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface CommentComponentProps {
  submissionId: string;
  submissionData: Record<string, any>;
  isFormOwner: boolean;
  currentUser?: {
    id: number;
    email: string;
    name?: string;
  } | null;
  compact?: boolean;
}

const CommentComponent: React.FC<CommentComponentProps> = ({
  submissionId,
  submissionData,
  isFormOwner = false,
  currentUser,
  compact = false
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [commentCount, setCommentCount] = useState(0);

  useEffect(() => {
    if (isDialogOpen) {
      fetchComments();
    } else {
      // Just get comment count for compact view
      fetchCommentCount();
    }
  }, [isDialogOpen, submissionId]);

  const fetchComments = async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`/api/submissions/${submissionId}/comments`);
      if (response.data.success) {
        setComments(response.data.data.comments || []);
        setCommentCount(response.data.data.comments?.length || 0);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCommentCount = async () => {
    try {
      const response = await api.post('/api/submissions/batch/comments/count', {
        submissionIds: [submissionId]
      });
      if (response.data.success) {
        const count = response.data.data.commentCounts[submissionId] || 0;
        setCommentCount(count);
      }
    } catch (error) {
      console.error('Failed to fetch comment count:', error);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !currentUser) return;

    try {
      const response = await api.post(`/api/submissions/${submissionId}/comments`, {
        content: newComment.trim(),
        parentId: replyingTo,
        isPrivate
      });

      if (response.data.success) {
        setNewComment('');
        setReplyingTo(null);
        setIsPrivate(false);
        fetchComments();
        toast.success('Comment added successfully');
      }
    } catch (error) {
      console.error('Failed to submit comment:', error);
      toast.error('Failed to add comment');
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editContent.trim()) return;

    try {
      const response = await api.put(`/api/submissions/${submissionId}/comments/${commentId}`, {
        content: editContent.trim()
      });

      if (response.data.success) {
        setEditingComment(null);
        setEditContent('');
        fetchComments();
        toast.success('Comment updated successfully');
      }
    } catch (error) {
      console.error('Failed to update comment:', error);
      toast.error('Failed to update comment');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    try {
      const response = await api.delete(`/api/submissions/${submissionId}/comments/${commentId}`);

      if (response.data.success) {
        fetchComments();
        toast.success('Comment deleted successfully');
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
      toast.error('Failed to delete comment');
    }
  };

  const startEditing = (comment: Comment) => {
    setEditingComment(comment.id);
    setEditContent(comment.content);
  };

  const startReplying = (commentId: string) => {
    setReplyingTo(commentId);
    setNewComment('');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const canEditComment = (comment: Comment) => {
    return isFormOwner || comment.userId === currentUser?.id;
  };

  // Compact mode for table rows
  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        <button
          onClick={() => setIsDialogOpen(true)}
          className="relative p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          {commentCount > 0 && (
            <Badge 
              variant="info" 
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] text-xs"
            >
              {commentCount}
            </Badge>
          )}
        </button>
      </div>
    );
  }

  // Full dialog mode
  return (
    <>
      {/* Dialog Overlay */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* Dialog Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Comments ({commentCount})
              </h3>
              <button
                onClick={() => setIsDialogOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dialog Content */}
            <div className="flex flex-col max-h-[60vh]">
              {/* Comments List */}
              <div className="flex-1 overflow-y-auto p-6">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No comments yet</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Be the first to leave a comment
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {comments
                      .filter(comment => !comment.parentId) // Show root comments first
                      .map(comment => (
                        <div key={comment.id} className="space-y-3">
                          {/* Main Comment */}
                          <div className="flex items-start space-x-3">
                            <Avatar 
                              className="w-8 h-8 flex-shrink-0" 
                              name={comment.userName || comment.userEmail}
                              size="sm"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="bg-gray-50 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-medium text-sm text-gray-900">
                                      {comment.userName || comment.userEmail}
                                    </span>
                                    {comment.isPrivate && (
                                      <Lock className="w-3 h-3 text-gray-400" />
                                    )}
                                    {comment.isResolved && (
                                      <Badge variant="success" size="sm">Resolved</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <span className="text-xs text-gray-500">
                                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                                    </span>
                                    {canEditComment(comment) && (
                                      <div className="flex items-center space-x-1">
                                        <button
                                          onClick={() => startEditing(comment)}
                                          className="p-1 text-gray-400 hover:text-gray-600"
                                        >
                                          <Edit className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteComment(comment.id)}
                                          className="p-1 text-gray-400 hover:text-red-600"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {editingComment === comment.id ? (
                                  <div className="space-y-2">
                                    <textarea
                                      value={editContent}
                                      onChange={(e) => setEditContent(e.target.value)}
                                      className="w-full p-2 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                      rows={2}
                                    />
                                    <div className="flex items-center space-x-2">
                                      <Button
                                        size="sm"
                                        onClick={() => handleEditComment(comment.id)}
                                        disabled={!editContent.trim()}
                                      >
                                        Update
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setEditingComment(null);
                                          setEditContent('');
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                      {comment.content}
                                    </p>
                                    <button
                                      onClick={() => startReplying(comment.id)}
                                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center space-x-1 mt-2"
                                    >
                                      <Reply className="w-3 h-3" />
                                      <span>Reply</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Replies */}
                          {comments
                            .filter(reply => reply.parentId === comment.id)
                            .map(reply => (
                              <div key={reply.id} className="ml-11 flex items-start space-x-3">
                                <Avatar 
                                  className="w-6 h-6 flex-shrink-0" 
                                  name={reply.userName || reply.userEmail}
                                  size="sm"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="bg-gray-100 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="font-medium text-sm text-gray-900">
                                        {reply.userName || reply.userEmail}
                                      </span>
                                      <div className="flex items-center space-x-1">
                                        <span className="text-xs text-gray-500">
                                          {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                                        </span>
                                        {canEditComment(reply) && (
                                          <div className="flex items-center space-x-1">
                                            <button
                                              onClick={() => startEditing(reply)}
                                              className="p-1 text-gray-400 hover:text-gray-600"
                                            >
                                              <Edit className="w-3 h-3" />
                                            </button>
                                            <button
                                              onClick={() => handleDeleteComment(reply.id)}
                                              className="p-1 text-gray-400 hover:text-red-600"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    {editingComment === reply.id ? (
                                      <div className="space-y-2">
                                        <textarea
                                          value={editContent}
                                          onChange={(e) => setEditContent(e.target.value)}
                                          className="w-full p-2 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                          rows={2}
                                        />
                                        <div className="flex items-center space-x-2">
                                          <Button
                                            size="sm"
                                            onClick={() => handleEditComment(reply.id)}
                                            disabled={!editContent.trim()}
                                          >
                                            Update
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              setEditingComment(null);
                                              setEditContent('');
                                            }}
                                          >
                                            Cancel
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                        {reply.content}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* New Comment Form */}
              {currentUser && (
                <div className="border-t border-gray-200 p-6">
                  {replyingTo && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-blue-700">
                          Replying to {comments.find(c => c.id === replyingTo)?.userName}
                        </span>
                        <button
                          onClick={() => setReplyingTo(null)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-3">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
                      className="w-full p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <label className="flex items-center space-x-2 text-sm">
                          <input
                            type="checkbox"
                            checked={isPrivate}
                            onChange={(e) => setIsPrivate(e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="flex items-center space-x-1">
                            {isPrivate ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            <span>Private comment</span>
                          </span>
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        {replyingTo && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setReplyingTo(null)}
                          >
                            Cancel
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={handleSubmitComment}
                          disabled={!newComment.trim()}
                          leftIcon={<Send className="w-4 h-4" />}
                        >
                          {replyingTo ? 'Reply' : 'Comment'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CommentComponent;