import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'react-hot-toast';
import apiService from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { CommentFileUpload } from '../upload/CommentFileUpload';
import { Paperclip, Download, FileText, Image } from 'lucide-react';
import Avatar from '../common/Avatar';
import { AuthenticatedImage } from '../common/AuthenticatedImage';
import { ImageGallery } from '../Gallery';
import type { GalleryImage } from '../Gallery';

interface FileAttachment {
  id: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  file_key: string;
  url?: string;
}

interface Comment {
  id: string;
  submission_id: string;
  parent_id?: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_avatar_url?: string | null;
  content: string;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  replies?: Comment[];
  attachments?: FileAttachment[];
}

interface CommentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  submissionId: string;
  currentUserId?: string;
  currentUserName?: string;
  isAdmin?: boolean;
}

export const CommentPanel: React.FC<CommentPanelProps> = ({
  isOpen,
  onClose,
  submissionId
}) => {
  
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  
  // File upload states
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [currentCommentId, setCurrentCommentId] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  
  // Gallery states
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);

  // Fetch comments when panel opens
  useEffect(() => {
    if (isOpen && submissionId) {
      fetchComments();
    }
  }, [isOpen, submissionId]);

  // Group comments hierarchically - parent comments with their replies nested
  const groupCommentsHierarchically = (flatComments: Comment[]): Comment[] => {
    const commentMap = new Map<string, Comment>();
    const rootComments: Comment[] = [];

    // First pass: create a map of all comments and initialize replies arrays
    flatComments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    // Second pass: nest replies under their parent comments
    flatComments.forEach(comment => {
      const commentWithReplies = commentMap.get(comment.id);
      if (!commentWithReplies) return;

      if (comment.parent_id) {
        // This is a reply - add it to parent's replies
        const parentComment = commentMap.get(comment.parent_id);
        if (parentComment) {
          parentComment.replies = parentComment.replies || [];
          parentComment.replies.push(commentWithReplies);
        }
      } else {
        // This is a root comment
        rootComments.push(commentWithReplies);
      }
    });

    // Sort root comments by creation date (newest first)
    rootComments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    // Sort replies within each comment by creation date (oldest first for natural flow)
    const sortRepliesRecursively = (comment: Comment) => {
      if (comment.replies && comment.replies.length > 0) {
        comment.replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        comment.replies.forEach(sortRepliesRecursively);
      }
    };
    
    rootComments.forEach(sortRepliesRecursively);

    return rootComments;
  };

  const fetchComments = async () => {
    try {
      setLoading(true);
      const response = await apiService.get(`/api/submissions/${submissionId}/comments`);
      console.log('Comments API response:', response.data);
      if (response.data.success) {
        const commentsData = response.data.data.comments || [];
        console.log('Comments data:', commentsData);
        
        // Group comments into hierarchical structure
        console.log('About to group comments. Original data:', commentsData);
        const groupedComments = groupCommentsHierarchically(commentsData);
        console.log('✅ Grouped comments:', groupedComments);
        setComments(groupedComments);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() && uploadedFiles.length === 0) {
      toast.error('Please enter a comment or attach files');
      return;
    }

    try {
      setUploadingFiles(true);
      console.log('Submitting comment for submission:', submissionId);
      
      // Create the comment with text content and attached file IDs
      const commentContent = newComment.trim() || 'File attachment';
      
      const commentData: any = {
        content: commentContent
      };
      
      // If files were uploaded, include their IDs
      if (uploadedFiles.length > 0) {
        commentData.attachmentIds = uploadedFiles.map(f => f.id);
      }
      
      const response = await apiService.post(`/api/submissions/${submissionId}/comments`, commentData);
      console.log('Comment submit response:', response.data);

      if (response.data.success) {
        toast.success('Comment posted successfully');
        
        // Clear form and refresh comments
        setNewComment('');
        setCommentFiles([]);
        setUploadedFiles([]);
        setCurrentCommentId(null);
        fetchComments();
      }
    } catch (error) {
      console.error('Failed to post comment:', error);
      toast.error('Failed to post comment');
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!replyContent.trim()) {
      toast.error('Please enter a reply');
      return;
    }

    try {
      const response = await apiService.post(`/api/submissions/${submissionId}/comments`, {
        content: replyContent.trim(),
        parentId: parentId
      });

      if (response.data.success) {
        toast.success('Reply posted successfully');
        setReplyContent('');
        setReplyingTo(null);
        fetchComments();
      }
    } catch (error) {
      console.error('Failed to post reply:', error);
      toast.error('Failed to post reply');
    }
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editContent.trim()) {
      toast.error('Please enter content');
      return;
    }

    try {
      const response = await apiService.put(`/api/submissions/${submissionId}/comments/${commentId}`, {
        content: editContent.trim()
      });

      if (response.data.success) {
        toast.success('Comment updated successfully');
        setEditContent('');
        setEditingComment(null);
        fetchComments();
      }
    } catch (error) {
      console.error('Failed to update comment:', error);
      toast.error('Failed to update comment');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    try {
      const response = await apiService.delete(`/api/submissions/${submissionId}/comments/${commentId}`);

      if (response.data.success) {
        toast.success('Comment deleted successfully');
        fetchComments();
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
      toast.error('Failed to delete comment');
    }
  };

  // Open gallery with comment's images
  const openGallery = (comment: Comment, startIndex: number = 0) => {
    if (!comment.attachments || comment.attachments.length === 0) return;
    
    // Filter only image attachments for gallery
    const imageAttachments = comment.attachments.filter(att => 
      att.mime_type.startsWith('image/')
    );
    
    if (imageAttachments.length === 0) {
      // If clicked on non-image, just download it
      const attachment = comment.attachments[startIndex];
      if (attachment) {
        window.open(attachment.url || `/api/comment-attachments/${attachment.id}/download`, '_blank');
      }
      return;
    }
    
    // Convert to GalleryImage format
    const images: GalleryImage[] = imageAttachments.map(att => ({
      id: att.id,
      url: `/api/comment-attachments/${att.id}/download?direct=true`,
      thumbnailUrl: `/api/comment-attachments/${att.id}/download?direct=true&thumb=true`,
      originalName: att.original_name,
      mimeType: att.mime_type,
      fileSize: att.file_size
    }));
    
    // Find the correct index in the filtered image array
    const clickedAttachment = comment.attachments[startIndex];
    const imageIndex = imageAttachments.findIndex(att => att.id === clickedAttachment.id);
    
    setGalleryImages(images);
    setGalleryInitialIndex(imageIndex >= 0 ? imageIndex : 0);
    setGalleryOpen(true);
  };

  const renderComment = (comment: Comment, depth = 0) => {
    const isOwner = user?.id && String(user.id) === String(comment.user_id);
    const isAdmin = user?.role === 'admin';
    const canEdit = isOwner && !comment.is_deleted;
    const canDelete = (isOwner || isAdmin) && !comment.is_deleted;

    // Format date with fallback - TEMPORARILY DISABLED
    /*
    const formatCommentDate = () => {
      try {
        const date = comment.created_at ? new Date(comment.created_at) : new Date();
        if (isNaN(date.getTime())) {
          return 'just now';
        }
        return formatDistanceToNow(date, { addSuffix: true });
      } catch (error) {
        console.error('Error formatting date:', error, comment.created_at);
        return 'recently';
      }
    };
    */

    return (
      <div key={comment.id} className={`${depth > 0 ? 'ml-8 border-l-2 border-gray-200 pl-4' : ''}`}>
        <div className="bg-white rounded-lg p-4 mb-2 hover:bg-gray-50">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center">
              <div className="flex-shrink-0 mr-3">
                <Avatar
                  src={comment.user_avatar_url}
                  name={comment.user_name || comment.user_email}
                  size="sm"
                  alt={`Avatar của ${comment.user_name || comment.user_email}`}
                />
              </div>
              <div>
                <span className="font-medium text-gray-900">{comment.user_name || 'Anonymous'}</span>
                {/* Temporarily disabled date display to fix error
                <span className="text-gray-500 text-sm ml-2">
                  {formatCommentDate()}
                </span>
                */}
                {comment.is_edited && (
                  <span className="text-gray-400 text-xs ml-2">(edited)</span>
                )}
              </div>
            </div>
            <div></div>
          </div>

          {editingComment === comment.id ? (
            <div className="mt-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handleUpdateComment(comment.id)}
                  className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditingComment(null);
                    setEditContent('');
                  }}
                  className="px-3 py-1 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-gray-800 whitespace-pre-wrap">{comment.content}</p>
              
              {/* Display attachments as horizontal thumbnail slider */}
              {comment.attachments && comment.attachments.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-gray-500 mb-2 font-medium">
                    📎 {comment.attachments.length} tệp đính kèm
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2" style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#CBD5E0 #F7FAFC'
                  }}>
                    {comment.attachments.map((attachment, index) => (
                      <div
                        key={attachment.id}
                        className="flex-shrink-0 group cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openGallery(comment, index);
                        }}
                      >
                        <div className="w-20 h-20 bg-gray-50 border border-gray-200 rounded-lg p-1 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md transition-all duration-200 flex flex-col items-center justify-center relative group-hover:scale-105">
                          {attachment.mime_type.startsWith('image/') ? (
                            <div className="w-full h-full relative overflow-hidden rounded">
                              <img
                                src={`/api/comment-attachments/${attachment.id}/download?direct=true&thumb=true`}
                                alt={attachment.original_name}
                                className="w-full h-full object-cover pointer-events-none"
                                draggable={false}
                                onError={(e) => {
                                  // Fallback to icon if image fails to load
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  if (target.parentElement) {
                                    target.parentElement.innerHTML = `
                                      <div class="w-full h-full flex flex-col items-center justify-center">
                                        <svg class="w-6 h-6 text-blue-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <div class="text-[10px] text-center text-gray-600 leading-tight">IMG</div>
                                      </div>
                                    `;
                                  }
                                }}
                              />
                            </div>
                          ) : attachment.mime_type === 'application/pdf' ? (
                            <div className="w-full h-full flex flex-col items-center justify-center">
                              <FileText className="w-6 h-6 text-red-500 mb-1" />
                              <div className="text-[10px] text-center text-gray-600 leading-tight">
                                PDF
                              </div>
                            </div>
                          ) : attachment.mime_type.includes('word') ? (
                            <div className="w-full h-full flex flex-col items-center justify-center">
                              <FileText className="w-6 h-6 text-blue-600 mb-1" />
                              <div className="text-[10px] text-center text-gray-600 leading-tight">
                                DOC
                              </div>
                            </div>
                          ) : attachment.mime_type.includes('excel') || attachment.mime_type.includes('sheet') ? (
                            <div className="w-full h-full flex flex-col items-center justify-center">
                              <FileText className="w-6 h-6 text-green-600 mb-1" />
                              <div className="text-[10px] text-center text-gray-600 leading-tight">
                                XLS
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center">
                              <FileText className="w-6 h-6 text-gray-500 mb-1" />
                              <div className="text-[10px] text-center text-gray-600 leading-tight">
                                FILE
                              </div>
                            </div>
                          )}
                        </div>
                        {/* File info tooltip on hover */}
                        <div className="mt-1 w-20">
                          <div className="text-[10px] text-gray-700 truncate text-center" title={attachment.original_name}>
                            {attachment.original_name.length > 12 
                              ? attachment.original_name.substring(0, 12) + '...' 
                              : attachment.original_name}
                          </div>
                          <div className="text-[9px] text-gray-500 text-center">
                            {Math.round(attachment.file_size / 1024)}KB
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    setReplyingTo(comment.id);
                    setReplyContent('');
                  }}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Reply
                </button>
                {canEdit && editingComment !== comment.id && (
                  <button
                    onClick={() => {
                      setEditingComment(comment.id);
                      setEditContent(comment.content);
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Edit
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => handleDeleteComment(comment.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete
                  </button>
                )}
              </div>
            </>
          )}

          {replyingTo === comment.id && (
            <div className="mt-3">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write a reply..."
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={2}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handleSubmitReply(comment.id)}
                  className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Post Reply
                </button>
                <button
                  onClick={() => {
                    setReplyingTo(null);
                    setReplyContent('');
                  }}
                  className="px-3 py-1 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Render replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2">
            {comment.replies.map((reply) => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col min-h-[70vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Comments for Submission
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading comments...</p>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No comments yet. Be the first to comment!
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => renderComment(comment))}
            </div>
          )}
        </div>

        {/* New Comment Form */}
        <div className="border-t p-4 min-h-[300px] flex flex-col justify-between">
          <div className="space-y-2 flex-1">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y min-h-[80px] max-h-[200px]"
              rows={3}
            />
            
            {/* File Upload Component */}
            <CommentFileUpload
              onFilesSelected={(files) => {
                setCommentFiles(files);
                // Files will be uploaded automatically with toast notifications
              }}
              onFileUploadComplete={(file) => {
                console.log('File uploaded:', file);
                setUploadedFiles(prev => [...prev, file]);
                // Remove from pending files
                setCommentFiles(prev => prev.filter(f => f.name !== file.name));
              }}
              onFileRemove={(fileId) => {
                setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
              }}
              uploadedFiles={uploadedFiles}
              maxFiles={20}
              maxSize={10 * 1024 * 1024} // 10MB
              disabled={false} // Don't disable upload area while submitting comment
              uploadUrl={`/api/comment-attachments/submission/${submissionId}/temp`}
            />
          </div>
          
          {/* Post Comment Button - Always visible at bottom */}
          <div className="flex justify-end mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={handleSubmitComment}
              disabled={(!newComment.trim() && commentFiles.length === 0) || uploadingFiles}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2 font-medium"
            >
              {uploadingFiles ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  {commentFiles.length > 0 && <Paperclip className="w-4 h-4" />}
                  <span>Post Comment</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Image Gallery Modal */}
      {galleryOpen && galleryImages.length > 0 && (
        <>
          <ImageGallery
          images={galleryImages}
          initialIndex={galleryInitialIndex}
          onClose={() => setGalleryOpen(false)}
          config={{
            theme: 'dark',
            layout: 'modal',
            enableKeyboard: true,
            enableTouch: true,
            enableZoom: true,
            enableRotation: true,
            enableFullscreen: true,
            enableThumbnails: true,
            enableDownload: true,
            enableShare: false,
            preloadCount: 2,
            animationDuration: 300,
            maxZoom: 4,
            minZoom: 0.5,
            zoomStep: 0.25,
            rotationStep: 90
          }}
        />
        </>
      )}
      
    </div>
  );
};