import { pool } from '../utils/database';
import type { ImageNote, CreateImageNoteData, UpdateImageNoteData } from '../types/imageNotes';

export class ImageNotesService {
  /**
   * Get all notes for a specific image attachment
   */
  async getNotesForAttachment(attachmentId: string): Promise<ImageNote[]> {
    const query = `
      SELECT 
        n.id,
        n.attachment_id,
        n.user_id,
        n.content,
        n.created_at,
        n.updated_at,
        n.is_deleted,
        u.id as user_id,
        u.full_name as user_full_name,
        u.email as user_email,
        u.avatar_url as user_avatar_url,
        u.username as user_username
      FROM image_notes n
      JOIN users u ON n.user_id = u.id
      WHERE n.attachment_id = $1 
        AND n.is_deleted = FALSE
      ORDER BY n.created_at ASC
    `;

    const result = await pool.query(query, [attachmentId]);
    
    return result.rows.map(row => ({
      id: row.id,
      attachment_id: row.attachment_id,
      user_id: row.user_id,
      content: row.content,
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_deleted: row.is_deleted,
      user: {
        id: row.user_id,
        full_name: row.user_full_name,
        email: row.user_email,
        avatar_url: row.user_avatar_url,
        username: row.user_username
      }
    }));
  }

  /**
   * Create a new note for an image attachment
   */
  async createNote(data: CreateImageNoteData, userId: number): Promise<ImageNote> {
    // First verify the attachment exists
    const attachmentCheck = await pool.query(
      'SELECT id FROM comment_attachments WHERE id = $1',
      [data.attachment_id]
    );

    if (attachmentCheck.rows.length === 0) {
      throw new Error('Attachment not found');
    }

    const query = `
      INSERT INTO image_notes (attachment_id, user_id, content)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const result = await pool.query(query, [
      data.attachment_id,
      userId,
      data.content.trim()
    ]);

    const noteId = result.rows[0].id;
    
    // Get the complete note with user data
    const notes = await this.getNotesForAttachment(data.attachment_id);
    const createdNote = notes.find(note => note.id === noteId);
    
    if (!createdNote) {
      throw new Error('Failed to create note');
    }

    return createdNote;
  }

  /**
   * Update an existing note
   */
  async updateNote(noteId: string, data: UpdateImageNoteData, userId: number): Promise<ImageNote> {
    // Check if note exists and user owns it
    const existingNote = await pool.query(
      'SELECT * FROM image_notes WHERE id = $1 AND is_deleted = FALSE',
      [noteId]
    );

    if (existingNote.rows.length === 0) {
      throw new Error('Note not found');
    }

    if (existingNote.rows[0].user_id !== userId) {
      throw new Error('Permission denied');
    }

    const query = `
      UPDATE image_notes 
      SET content = $1, updated_at = NOW()
      WHERE id = $2 AND user_id = $3 AND is_deleted = FALSE
      RETURNING *
    `;

    const result = await pool.query(query, [
      data.content.trim(),
      noteId,
      userId
    ]);

    if (result.rows.length === 0) {
      throw new Error('Failed to update note');
    }

    // Get the updated note with user data
    const attachmentId = existingNote.rows[0].attachment_id;
    const notes = await this.getNotesForAttachment(attachmentId);
    const updatedNote = notes.find(note => note.id === noteId);

    if (!updatedNote) {
      throw new Error('Failed to retrieve updated note');
    }

    return updatedNote;
  }

  /**
   * Delete a note (soft delete)
   */
  async deleteNote(noteId: string, userId: number): Promise<void> {
    // Check if note exists and user owns it (or is admin)
    const existingNote = await pool.query(
      'SELECT * FROM image_notes WHERE id = $1 AND is_deleted = FALSE',
      [noteId]
    );

    if (existingNote.rows.length === 0) {
      throw new Error('Note not found');
    }

    // Check ownership (later we can add admin check)
    if (existingNote.rows[0].user_id !== userId) {
      throw new Error('Permission denied');
    }

    const query = `
      UPDATE image_notes 
      SET is_deleted = TRUE, updated_at = NOW()
      WHERE id = $1 AND user_id = $2
    `;

    const result = await pool.query(query, [noteId, userId]);

    if (result.rowCount === 0) {
      throw new Error('Failed to delete note');
    }
  }

  /**
   * Get a specific note by ID
   */
  async getNoteById(noteId: string): Promise<ImageNote | null> {
    const query = `
      SELECT 
        n.id,
        n.attachment_id,
        n.user_id,
        n.content,
        n.created_at,
        n.updated_at,
        n.is_deleted,
        u.full_name as user_full_name,
        u.email as user_email,
        u.avatar_url as user_avatar_url,
        u.username as user_username
      FROM image_notes n
      JOIN users u ON n.user_id = u.id
      WHERE n.id = $1 AND n.is_deleted = FALSE
    `;

    const result = await pool.query(query, [noteId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      attachment_id: row.attachment_id,
      user_id: row.user_id,
      content: row.content,
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_deleted: row.is_deleted,
      user: {
        id: row.user_id,
        full_name: row.user_full_name,
        email: row.user_email,
        avatar_url: row.user_avatar_url,
        username: row.user_username
      }
    };
  }

  /**
   * Get notes count for an attachment
   */
  async getNotesCount(attachmentId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM image_notes 
      WHERE attachment_id = $1 AND is_deleted = FALSE
    `;

    const result = await pool.query(query, [attachmentId]);
    return parseInt(result.rows[0].count);
  }
}