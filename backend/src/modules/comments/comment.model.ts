// Comment Model - PostgreSQL with pg driver (Simple Version)
export interface Comment {
  id: string;
  submission_id: string;
  parent_id?: string | null;
  user_id: number;
  content: string;
  is_edited: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
  
  // Virtual fields (populated via joins)
  user_name?: string;
  user_email?: string;
  user_avatar?: string;
  replies?: Comment[];
  reply_count?: number;
  depth?: number;
}

export interface CommentCreateData {
  submission_id: string;
  user_id: number;
  content: string;
  parent_id?: string | null;
}

export interface CommentUpdateData {
  content: string;
  is_edited?: boolean;
}

export interface CommentAttachment {
  id: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  file_key: string;
  url?: string;
}

export interface CommentWithUser extends Comment {
  user_name: string;
  user_email: string;
  user_avatar?: string;
  attachments?: CommentAttachment[];
}

export interface CommentStats {
  total_comments: number;
  unique_commenters: number;
  last_comment_at?: Date;
  root_comments?: number;
  replies?: number;
  average_depth?: number;
}