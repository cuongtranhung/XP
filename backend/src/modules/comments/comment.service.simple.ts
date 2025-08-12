// SIMPLE Comment Service - Just GET comments
import { query } from '../../utils/database';

export async function getCommentsSimple(submissionId: string) {
  console.log('🚨 Simple query for submission:', submissionId);
  
  const sql = `
    SELECT 
      c.id,
      c.submission_id,
      c.parent_id,
      c.user_id,
      c.content,
      c.created_at,
      u.full_name as user_name
    FROM form_comments c
    JOIN users u ON c.user_id::text = u.id::text
    WHERE c.submission_id = $1
    ORDER BY c.created_at DESC
    LIMIT 10
  `;
  
  console.log('🚨 Executing SQL:', sql);
  
  try {
    const result = await query(sql, [submissionId]);
    console.log('🚨 Query result:', result.rows);
    return { success: true, comments: result.rows };
  } catch (error) {
    console.error('🚨 Query error:', error);
    return { success: false, error: error.message };
  }
}