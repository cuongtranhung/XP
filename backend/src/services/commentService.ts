import { db } from '../utils/database';

export interface Comment {
  id: string;
  submission_id: string;
  parent_id?: string;
  user_id: string;
  user_name: string;
  user_email: string;
  content: string;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
  replies?: Comment[];
}

export interface CreateCommentData {
  submissionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  content: string;
  parentId?: string;
}

// Helper function to build comment tree
function buildCommentTree(comments: Comment[]): Comment[] {
  const commentMap = new Map<string, Comment>();
  const rootComments: Comment[] = [];

  // First pass: create a map
  comments.forEach(comment => {
    comment.replies = [];
    commentMap.set(comment.id, comment);
  });

  // Second pass: build the tree
  comments.forEach(comment => {
    if (comment.parent_id) {
      const parent = commentMap.get(comment.parent_id);
      if (parent) {
        parent.replies!.push(comment);
      }
    } else {
      rootComments.push(comment);
    }
  });

  return rootComments;
}

// Get all comments for a submission
export async function getCommentsBySubmission(submissionId: string): Promise<Comment[]> {
  const query = `
    SELECT 
      id,
      submission_id,
      parent_id,
      user_id,
      user_name,
      user_email,
      content,
      is_edited,
      is_deleted,
      created_at,
      updated_at,
      deleted_at
    FROM form_comments
    WHERE submission_id = $1
      AND is_deleted = false
    ORDER BY created_at ASC
  `;

  const result = await db.query(query, [submissionId]);
  
  // Build comment tree
  return buildCommentTree(result.rows);
}

// Create a new comment
export async function createComment(data: CreateCommentData): Promise<Comment> {
  const query = `
    INSERT INTO form_comments (
      submission_id,
      parent_id,
      user_id,
      user_name,
      user_email,
      content
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;

  const values = [
    data.submissionId,
    data.parentId || null,
    data.userId,
    data.userName,
    data.userEmail,
    data.content
  ];

  const result = await db.query(query, values);
  return result.rows[0];
}

// Update a comment
export async function updateComment(commentId: string, userId: string, content: string): Promise<Comment | null> {
  // First check if the user owns this comment
  const checkQuery = `
    SELECT user_id FROM form_comments 
    WHERE id = $1 AND is_deleted = false
  `;
  
  const checkResult = await db.query(checkQuery, [commentId]);
  
  if (checkResult.rows.length === 0 || checkResult.rows[0].user_id !== userId) {
    return null;
  }

  const updateQuery = `
    UPDATE form_comments
    SET content = $1,
        is_edited = true,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND user_id = $3
    RETURNING *
  `;

  const result = await db.query(updateQuery, [content, commentId, userId]);
  return result.rows[0] || null;
}

// Delete a comment (soft delete)
export async function deleteComment(commentId: string, userId: string, isAdmin: boolean): Promise<boolean> {
  let query: string;
  let values: any[];

  if (isAdmin) {
    // Admin can delete any comment
    query = `
      UPDATE form_comments
      SET is_deleted = true,
          deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND is_deleted = false
    `;
    values = [commentId];
  } else {
    // Regular users can only delete their own comments
    query = `
      UPDATE form_comments
      SET is_deleted = true,
          deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2 AND is_deleted = false
    `;
    values = [commentId, userId];
  }

  const result = await db.query(query, values);
  return result.rowCount > 0;
}

// Get comment count for a submission
export async function getCommentCount(submissionId: string): Promise<number> {
  const query = `
    SELECT COUNT(*) as count
    FROM form_comments
    WHERE submission_id = $1
      AND is_deleted = false
  `;

  const result = await db.query(query, [submissionId]);
  return parseInt(result.rows[0].count, 10);
}