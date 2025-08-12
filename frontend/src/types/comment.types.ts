// Comment TypeScript Types
export interface Comment {
  id: string;
  submission_id: string;
  parent_id?: string | null;
  user_id: number;
  content: string;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  
  // User info (joined from backend)
  user_name?: string;
  user_email?: string;
  user_avatar?: string;
  
  // Frontend specific
  replies?: Comment[];
  reply_count?: number;
  depth?: number;
  isExpanded?: boolean;
  isReplying?: boolean;
  isEditing?: boolean;
}

export interface CommentCreateData {
  content: string;
  parent_id?: string | null;
}

export interface CommentUpdateData {
  content: string;
}

export interface CommentFilter {
  submission_id?: string;
  user_id?: string;
  parent_id?: string | null;
  include_deleted?: boolean;
}

export interface CommentPagination {
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'updated_at';
  sort_order?: 'ASC' | 'DESC';
}

export interface CommentsResponse {
  success: boolean;
  data: {
    comments: Comment[];
    total: number;
    page: number;
    pages: number;
  };
}

export interface CommentCountResponse {
  success: boolean;
  data: {
    count: number;
  };
}

export interface CommentStatsResponse {
  success: boolean;
  data: {
    total_comments: number;
    unique_commenters: number;
    root_comments: number;
    replies: number;
    average_depth: number;
  };
}

export interface CommentActionResponse {
  success: boolean;
  data?: Comment;
  message?: string;
  error?: string;
}