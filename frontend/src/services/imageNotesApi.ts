import apiService from './api';
import type { 
  ImageNote, 
  CreateImageNoteData, 
  UpdateImageNoteData,
  ImageNotesListResponse,
  ImageNoteCreateResponse,
  ImageNotesApiError 
} from '../types/imageNotes';

export class ImageNotesApi {
  /**
   * Get all notes for a specific image attachment
   */
  static async getNotes(attachmentId: string): Promise<ImageNote[]> {
    try {
      const response = await apiService.get<ImageNotesListResponse>(
        `/api/comment-attachments/${attachmentId}/notes`
      );
      
      if (response.data.success) {
        return response.data.data.notes;
      } else {
        throw new Error('Failed to fetch notes');
      }
    } catch (error) {
      console.error('Error fetching image notes:', error);
      throw error;
    }
  }

  /**
   * Create a new note for an image attachment
   */
  static async createNote(attachmentId: string, content: string): Promise<ImageNote> {
    try {
      const noteData: CreateImageNoteData = {
        attachment_id: attachmentId,
        content: content.trim()
      };

      const response = await apiService.post<ImageNoteCreateResponse>(
        `/api/comment-attachments/${attachmentId}/notes`,
        { content: noteData.content }
      );
      
      if (response.data.success) {
        return response.data.data.note;
      } else {
        throw new Error('Failed to create note');
      }
    } catch (error) {
      console.error('Error creating image note:', error);
      throw error;
    }
  }

  /**
   * Update an existing note
   */
  static async updateNote(attachmentId: string, noteId: string, content: string): Promise<ImageNote> {
    try {
      const updateData: UpdateImageNoteData = {
        content: content.trim()
      };

      const response = await apiService.put<ImageNoteCreateResponse>(
        `/api/comment-attachments/${attachmentId}/notes/${noteId}`,
        updateData
      );
      
      if (response.data.success) {
        return response.data.data.note;
      } else {
        throw new Error('Failed to update note');
      }
    } catch (error) {
      console.error('Error updating image note:', error);
      throw error;
    }
  }

  /**
   * Delete a note
   */
  static async deleteNote(attachmentId: string, noteId: string): Promise<void> {
    try {
      const response = await apiService.delete(
        `/api/comment-attachments/${attachmentId}/notes/${noteId}`
      );
      
      if (!response.data.success) {
        throw new Error('Failed to delete note');
      }
    } catch (error) {
      console.error('Error deleting image note:', error);
      throw error;
    }
  }

  /**
   * Get a specific note by ID
   */
  static async getNote(attachmentId: string, noteId: string): Promise<ImageNote | null> {
    try {
      const response = await apiService.get<ImageNoteCreateResponse>(
        `/api/comment-attachments/${attachmentId}/notes/${noteId}`
      );
      
      if (response.data.success) {
        return response.data.data.note;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error fetching image note:', error);
      return null;
    }
  }

  /**
   * Get notes count for an attachment
   */
  static async getNotesCount(attachmentId: string): Promise<number> {
    try {
      const response = await apiService.get<{
        success: true;
        data: { count: number; attachment_id: string; };
      }>(`/api/comment-attachments/${attachmentId}/notes/count`);
      
      if (response.data.success) {
        return response.data.data.count;
      } else {
        return 0;
      }
    } catch (error) {
      console.error('Error fetching notes count:', error);
      return 0;
    }
  }
}

export default ImageNotesApi;