// Fixed Comment Service
import { randomUUID } from 'crypto';
import { pool, query, withTransaction, getClient } from '../../utils/database';
import { 
  Comment, 
  CommentCreateData, 
  CommentUpdateData, 
  CommentWithUser,
  CommentStats 
} from './comment.model';

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

export class CommentService {
  constructor() {
    // Using shared database pool from utils/database.ts
  }

  async getComments(
    filter: CommentFilter,
    pagination?: CommentPagination
  ): Promise<{ comments: CommentWithUser[]; total: number; page: number; pages: number }> {
    console.log('🚨 Simple query for submission:', filter.submission_id);
    
    const sql = `
      SELECT 
        c.id,
        c.submission_id,
        c.parent_id,
        c.user_id,
        c.user_name,
        c.user_email,
        c.content,
        c.created_at,
        c.updated_at,
        FALSE as is_edited,
        COALESCE(
          JSON_AGG(
            CASE WHEN ca.id IS NOT NULL THEN
              JSON_BUILD_OBJECT(
                'id', ca.id,
                'original_name', ca.original_name,
                'mime_type', ca.mime_type,
                'file_size', ca.file_size,
                'file_key', ca.file_key,
                'url', '/api/comment-attachments/' || ca.id || '/download'
              )
            ELSE NULL END
          ) FILTER (WHERE ca.id IS NOT NULL), 
          '[]'::json
        ) as attachments
      FROM submission_comments c
      LEFT JOIN comment_attachments ca ON c.id = ca.comment_id AND ca.deleted_at IS NULL
      WHERE c.submission_id = $1
      GROUP BY c.id, c.submission_id, c.parent_id, c.user_id, c.user_name, 
               c.user_email, c.content, c.created_at, c.updated_at
      ORDER BY c.created_at DESC
      LIMIT 20
    `;
    
    console.log('🚨 Executing SQL:', sql);
    
    try {
      const result = await query(sql, [filter.submission_id]);
      console.log('🚨 Query result:', result.rows.length, 'rows');
      
      return { 
        comments: result.rows.map(row => ({ ...row, replies: [] })), 
        total: result.rows.length,
        page: 1,
        pages: 1
      };
    } catch (error) {
      console.error('🚨 Query error:', error);
      throw error;
    }
  }

  async createComment(data: CommentCreateData): Promise<CommentWithUser> {
    const id = randomUUID();
    
    // Convert numeric user_id to UUID format if needed
    // Using a deterministic UUID based on the user ID
    const userIdStr = String(data.user_id);
    const userIdUuid = userIdStr.length < 36 
      ? `00000000-0000-0000-0000-${userIdStr.padStart(12, '0')}`
      : userIdStr;
    
    // Get user info first
    const userQuery = await query('SELECT full_name, email FROM users WHERE id = $1', [userIdStr]);
    const userInfo = userQuery.rows[0];
    const userName = userInfo?.full_name || 'Unknown User';
    const userEmail = userInfo?.email || '';
    
    const insertQuery = `
      INSERT INTO submission_comments (
        id, submission_id, parent_id, user_id, user_name, user_email, content, is_edited,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      id,
      data.submission_id,
      data.parent_id || null,
      userIdUuid,
      userName,
      userEmail,
      data.content
    ];

    const insertResult = await query(insertQuery, values);
    const comment = insertResult.rows[0];
    
    return { ...comment, replies: [], attachments: [] };
  }

  async getCommentById(id: string): Promise<CommentWithUser | null> {
    const selectQuery = `
      SELECT 
        c.*,
        COALESCE(
          JSON_AGG(
            CASE WHEN ca.id IS NOT NULL THEN
              JSON_BUILD_OBJECT(
                'id', ca.id,
                'original_name', ca.original_name,
                'mime_type', ca.mime_type,
                'file_size', ca.file_size,
                'file_key', ca.file_key,
                'url', '/api/comment-attachments/' || ca.id || '/download'
              )
            ELSE NULL END
          ) FILTER (WHERE ca.id IS NOT NULL), 
          '[]'::json
        ) as attachments
      FROM submission_comments c
      LEFT JOIN comment_attachments ca ON c.id = ca.comment_id AND ca.deleted_at IS NULL
      WHERE c.id = $1 AND c.deleted_at IS NULL
      GROUP BY c.id, c.submission_id, c.parent_id, c.user_id, c.user_name, 
               c.user_email, c.content, c.created_at, c.updated_at
    `;

    const result = await query(selectQuery, [id]);
    return result.rows[0] || null;
  }

  async getCommentCount(submissionId: string): Promise<number> {
    const sql = `
      SELECT COUNT(*) as count
      FROM submission_comments
      WHERE submission_id = $1 AND deleted_at IS NULL
    `;
    
    const result = await query(sql, [submissionId]);
    return parseInt(result.rows[0].count, 10);
  }

  async updateComment(
    id: string,
    userId: string,
    data: CommentUpdateData,
    isAdmin: boolean = false
  ): Promise<CommentWithUser | null> {
    // First check if comment exists and user has permission
    const checkQuery = `
      SELECT user_id FROM submission_comments WHERE id = $1 AND deleted_at IS NULL
    `;
    const checkResult = await query(checkQuery, [id]);
    
    if (!checkResult.rows[0]) {
      throw new Error('Comment not found');
    }
    
    // Convert numeric user_id to UUID format if needed
    const userIdStr = String(userId);
    const userIdUuid = userIdStr.length < 36 
      ? `00000000-0000-0000-0000-${userIdStr.padStart(12, '0')}`
      : userIdStr;
    
    if (checkResult.rows[0].user_id !== userIdUuid && !isAdmin) {
      throw new Error('Unauthorized to update this comment');
    }
    
    // Update the comment
    const updateQuery = `
      UPDATE submission_comments
      SET content = $1, is_edited = true, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    
    await query(updateQuery, [data.content, id]);
    
    // Return updated comment with user info
    return this.getCommentById(id);
  }

  async deleteComment(id: string, userId: string, isAdmin: boolean = false): Promise<void> {
    // First check if comment exists and user has permission
    const checkQuery = `
      SELECT user_id FROM submission_comments WHERE id = $1 AND deleted_at IS NULL
    `;
    const checkResult = await query(checkQuery, [id]);
    
    if (!checkResult.rows[0]) {
      throw new Error('Comment not found');
    }
    
    // Convert numeric user_id to UUID format if needed
    const userIdStr = String(userId);
    const userIdUuid = userIdStr.length < 36 
      ? `00000000-0000-0000-0000-${userIdStr.padStart(12, '0')}`
      : userIdStr;
    
    if (checkResult.rows[0].user_id !== userIdUuid && !isAdmin) {
      throw new Error('Unauthorized to delete this comment');
    }
    
    // Soft delete the comment
    const deleteQuery = `
      UPDATE submission_comments
      SET deleted_at = NOW()
      WHERE id = $1
    `;
    
    await query(deleteQuery, [id]);
  }

  async restoreComment(id: string, userId: string, isAdmin: boolean = false): Promise<CommentWithUser | null> {
    // First check if comment exists and user has permission
    const checkQuery = `
      SELECT user_id FROM submission_comments WHERE id = $1 AND deleted_at IS NOT NULL
    `;
    const checkResult = await query(checkQuery, [id]);
    
    if (!checkResult.rows[0]) {
      throw new Error('Comment not found or not deleted');
    }
    
    // Convert numeric user_id to UUID format if needed
    const userIdStr = String(userId);
    const userIdUuid = userIdStr.length < 36 
      ? `00000000-0000-0000-0000-${userIdStr.padStart(12, '0')}`
      : userIdStr;
    
    if (checkResult.rows[0].user_id !== userIdUuid && !isAdmin) {
      throw new Error('Unauthorized to restore this comment');
    }
    
    // Restore the comment
    const restoreQuery = `
      UPDATE submission_comments
      SET deleted_at = NULL
      WHERE id = $1
    `;
    
    await query(restoreQuery, [id]);
    return this.getCommentById(id);
  }

  async getUserComments(
    userId: string,
    pagination?: CommentPagination
  ): Promise<{ comments: CommentWithUser[]; total: number; page: number; pages: number }> {
    // Convert numeric user_id to UUID format if needed
    const userIdStr = String(userId);
    const userIdUuid = userIdStr.length < 36 
      ? `00000000-0000-0000-0000-${userIdStr.padStart(12, '0')}`
      : userIdStr;
    
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const offset = (page - 1) * limit;
    
    const sql = `
      SELECT 
        c.*,
        c.user_name,
        c.user_email
      FROM submission_comments c
      WHERE c.user_id = $1 AND c.deleted_at IS NULL
      ORDER BY c.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const countSql = `
      SELECT COUNT(*) as total
      FROM submission_comments
      WHERE user_id = $1 AND deleted_at IS NULL
    `;
    
    const [result, countResult] = await Promise.all([
      query(sql, [userIdUuid, limit, offset]),
      query(countSql, [userIdUuid])
    ]);
    
    const total = parseInt(countResult.rows[0].total, 10);
    const pages = Math.ceil(total / limit);
    
    return {
      comments: result.rows,
      total,
      page,
      pages
    };
  }

  async getCommentStats(submissionId: string): Promise<CommentStats> {
    const sql = `
      SELECT 
        COUNT(*) as total_comments,
        COUNT(DISTINCT user_id) as unique_commenters,
        MAX(created_at) as last_comment_at
      FROM submission_comments
      WHERE submission_id = $1 AND deleted_at IS NULL
    `;
    
    const result = await query(sql, [submissionId]);
    const stats = result.rows[0];
    
    return {
      total_comments: parseInt(stats.total_comments, 10),
      unique_commenters: parseInt(stats.unique_commenters, 10),
      last_comment_at: stats.last_comment_at
    };
  }

  async getCommentCounts(submissionIds: string[]): Promise<Map<string, number>> {
    if (submissionIds.length === 0) {
      return new Map();
    }
    
    const sql = `
      SELECT submission_id, COUNT(*) as count
      FROM submission_comments
      WHERE submission_id = ANY($1) AND deleted_at IS NULL
      GROUP BY submission_id
    `;
    
    const result = await query(sql, [submissionIds]);
    
    const countMap = new Map<string, number>();
    submissionIds.forEach(id => countMap.set(id, 0));
    result.rows.forEach(row => {
      countMap.set(row.submission_id, parseInt(row.count, 10));
    });
    
    return countMap;
  }

  async close(): Promise<void> {
    // Using shared pool - no need to close here
    console.log('Comment service using shared database pool');
  }
}

// Export singleton instance
export const commentService = new CommentService();

// Export class for testing
export default CommentService;