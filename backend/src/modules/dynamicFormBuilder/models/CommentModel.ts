/**
 * Comment Model for Form Submissions
 * Database operations for managing comments on submission rows
 */

import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';

export interface Comment {
  id: string;
  submissionId: string;
  userId: number;
  userEmail: string;
  userName: string;
  content: string;
  parentId?: string | null;
  isPrivate: boolean;
  isResolved: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface CreateCommentData {
  submissionId: string;
  userId: number;
  content: string;
  parentId?: string | null;
  isPrivate?: boolean;
}

export interface UpdateCommentData {
  content?: string;
  isResolved?: boolean;
  isPrivate?: boolean;
}

export class CommentModel {
  constructor(private db: Pool) {}

  /**
   * Create a new comment
   */
  async create(data: CreateCommentData): Promise<Comment> {
    console.log('🔍 CommentModel.create called with data:', JSON.stringify(data, null, 2));
    const client = await this.db.connect();
    
    try {
      const commentId = uuidv4();
      console.log('📝 Generated comment ID:', commentId);
      
      // Get user information
      const userQuery = `
        SELECT email, full_name 
        FROM users 
        WHERE id = $1
      `;
      console.log('🔍 Looking up user with ID:', data.userId);
      const userResult = await client.query(userQuery, [data.userId]);
      
      if (userResult.rows.length === 0) {
        console.error('❌ User not found for ID:', data.userId);
        throw new Error('User not found');
      }
      
      const user = userResult.rows[0];
      console.log('👤 Found user:', { email: user.email, full_name: user.full_name });
      
      const insertQuery = `
        INSERT INTO submission_comments (
          id, submission_id, user_id, user_email, user_name,
          content, parent_id, is_private, is_resolved, 
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING *
      `;
      
      const insertParams = [
        commentId,
        data.submissionId,
        data.userId,
        user.email,
        user.full_name,
        data.content,
        data.parentId || null,
        data.isPrivate || false,
        false // isResolved defaults to false
      ];
      
      console.log('💾 Executing insert with params:', JSON.stringify(insertParams, null, 2));
      const result = await client.query(insertQuery, insertParams);
      
      console.log('✅ Insert successful, rows:', result.rowCount);
      console.log('📄 Inserted row:', JSON.stringify(result.rows[0], null, 2));
      
      const mappedComment = this.mapRowToComment(result.rows[0]);
      console.log('🔄 Mapped comment:', JSON.stringify(mappedComment, null, 2));
      
      return mappedComment;
    } catch (error) {
      console.error('💥 CommentModel.create error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all comments for a submission
   */
  async getBySubmissionId(
    submissionId: string,
    userId?: number,
    isFormOwner: boolean = false
  ): Promise<Comment[]> {
    const client = await this.db.connect();
    
    try {
      let query = `
        SELECT 
          sc.id,
          sc.submission_id,
          sc.user_id,
          sc.user_email,
          sc.user_name,
          u.avatar_url,
          sc.content,
          sc.parent_id,
          sc.is_private,
          sc.is_resolved,
          sc.created_at,
          sc.updated_at,
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
        FROM submission_comments sc
        LEFT JOIN users u ON sc.user_id = u.id
        LEFT JOIN comment_attachments ca ON sc.id = ca.comment_id AND ca.deleted_at IS NULL
        WHERE sc.submission_id = $1
      `;
      
      const params = [submissionId];
      
      // Apply privacy filters
      if (!isFormOwner && userId) {
        query += ` AND (sc.is_private = false OR sc.user_id = $2)`;
        params.push(userId);
      } else if (!isFormOwner) {
        query += ` AND sc.is_private = false`;
      }
      
      query += ` GROUP BY sc.id, sc.submission_id, sc.user_id, sc.user_email, sc.user_name, u.avatar_url, sc.content, sc.parent_id, sc.is_private, sc.is_resolved, sc.created_at, sc.updated_at ORDER BY sc.created_at ASC`;
      
      console.log('🚨 CommentModel query:', query);
      console.log('🚨 CommentModel params:', params);
      
      const result = await client.query(query, params);
      console.log('🚨 CommentModel result rows:', result.rows.length);
      
      return result.rows.map(row => this.mapRowToComment(row));
    } finally {
      client.release();
    }
  }

  /**
   * Get comment by ID
   */
  async getById(commentId: string): Promise<Comment | null> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT 
          sc.id,
          sc.submission_id,
          sc.user_id,
          sc.user_email,
          sc.user_name,
          u.avatar_url,
          sc.content,
          sc.parent_id,
          sc.is_private,
          sc.is_resolved,
          sc.created_at,
          sc.updated_at,
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
        FROM submission_comments sc
        LEFT JOIN users u ON sc.user_id = u.id
        LEFT JOIN comment_attachments ca ON sc.id = ca.comment_id AND ca.deleted_at IS NULL
        WHERE sc.id = $1
        GROUP BY sc.id, sc.submission_id, sc.user_id, sc.user_email, sc.user_name, u.avatar_url, sc.content, sc.parent_id, sc.is_private, sc.is_resolved, sc.created_at, sc.updated_at
      `;
      
      const result = await client.query(query, [commentId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToComment(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Update a comment
   */
  async update(commentId: string, data: UpdateCommentData): Promise<Comment | null> {
    const client = await this.db.connect();
    
    try {
      const updates = [];
      const values = [];
      let paramCount = 0;
      
      if (data.content !== undefined) {
        updates.push(`content = $${++paramCount}`);
        values.push(data.content);
      }
      
      if (data.isResolved !== undefined) {
        updates.push(`is_resolved = $${++paramCount}`);
        values.push(data.isResolved);
      }
      
      if (data.isPrivate !== undefined) {
        updates.push(`is_private = $${++paramCount}`);
        values.push(data.isPrivate);
      }
      
      if (updates.length === 0) {
        return this.getById(commentId);
      }
      
      updates.push(`updated_at = NOW()`);
      values.push(commentId);
      
      const query = `
        UPDATE submission_comments 
        SET ${updates.join(', ')}
        WHERE id = $${++paramCount}
        RETURNING *
      `;
      
      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      // Get complete comment data with user info
      return this.getById(commentId);
    } finally {
      client.release();
    }
  }

  /**
   * Delete a comment and its replies
   */
  async delete(commentId: string): Promise<boolean> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Delete replies first
      await client.query(
        'DELETE FROM submission_comments WHERE parent_id = $1',
        [commentId]
      );
      
      // Delete the comment
      const result = await client.query(
        'DELETE FROM submission_comments WHERE id = $1',
        [commentId]
      );
      
      await client.query('COMMIT');
      
      return result.rowCount > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get comment statistics for a submission
   */
  async getSubmissionCommentStats(submissionId: string): Promise<{
    totalComments: number;
    unresolvedComments: number;
    privateComments: number;
    lastCommentAt: Date | null;
  }> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT 
          COUNT(*) as total_comments,
          COUNT(*) FILTER (WHERE is_resolved = false) as unresolved_comments,
          COUNT(*) FILTER (WHERE is_private = true) as private_comments,
          MAX(created_at) as last_comment_at
        FROM submission_comments 
        WHERE submission_id = $1
      `;
      
      const result = await client.query(query, [submissionId]);
      const row = result.rows[0];
      
      return {
        totalComments: parseInt(row.total_comments),
        unresolvedComments: parseInt(row.unresolved_comments),
        privateComments: parseInt(row.private_comments),
        lastCommentAt: row.last_comment_at ? new Date(row.last_comment_at) : null
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get comments count for multiple submissions
   */
  async getCommentsCountForSubmissions(submissionIds: string[]): Promise<Map<string, number>> {
    if (submissionIds.length === 0) {
      return new Map();
    }
    
    const client = await this.db.connect();
    
    try {
      const placeholders = submissionIds.map((_, index) => `$${index + 1}`).join(',');
      const query = `
        SELECT 
          submission_id,
          COUNT(*) as comment_count
        FROM submission_comments 
        WHERE submission_id IN (${placeholders})
        GROUP BY submission_id
      `;
      
      const result = await client.query(query, submissionIds);
      
      const countMap = new Map<string, number>();
      result.rows.forEach(row => {
        countMap.set(row.submission_id, parseInt(row.comment_count));
      });
      
      return countMap;
    } finally {
      client.release();
    }
  }

  /**
   * Check if user can access comment
   */
  async canUserAccessComment(commentId: string, userId: number, isFormOwner: boolean): Promise<boolean> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT sc.user_id, sc.is_private
        FROM submission_comments sc
        WHERE sc.id = $1
      `;
      
      const result = await client.query(query, [commentId]);
      
      if (result.rows.length === 0) {
        return false;
      }
      
      const comment = result.rows[0];
      
      // Form owners can access all comments
      if (isFormOwner) {
        return true;
      }
      
      // Comment authors can access their own comments
      if (comment.user_id === userId) {
        return true;
      }
      
      // Others can only access non-private comments
      return !comment.is_private;
    } finally {
      client.release();
    }
  }

  /**
   * Map database row to Comment object
   */
  private mapRowToComment(row: any): any {
    // Return snake_case for frontend compatibility
    return {
      id: row.id,
      submission_id: row.submission_id,
      user_id: row.user_id,
      user_email: row.user_email || '',
      user_name: row.user_name || row.full_name || 'Anonymous',
      user_avatar_url: row.avatar_url || null,
      content: row.content,
      parent_id: row.parent_id,
      is_private: row.is_private || false,
      is_resolved: row.is_resolved || false,
      is_edited: row.updated_at && row.updated_at !== row.created_at,
      is_deleted: false,
      created_at: row.created_at,
      updated_at: row.updated_at || row.created_at,
      attachments: row.attachments || []
    };
  }
}