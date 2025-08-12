import { Request, Response } from 'express';
import { ImageNotesService } from '../services/ImageNotesService';
import type { 
  CreateImageNoteData, 
  UpdateImageNoteData,
  ImageNoteCreateResponse,
  ImageNotesGetResponse,
  ImageNote 
} from '../types/imageNotes';

export class ImageNotesController {
  private imageNotesService: ImageNotesService;

  constructor() {
    this.imageNotesService = new ImageNotesService();
  }

  /**
   * GET /api/comment-attachments/:attachmentId/notes
   * Get all notes for a specific image attachment
   */
  getNotes = async (req: Request, res: Response): Promise<void> => {
    try {
      const { attachmentId } = req.params;
      
      if (!attachmentId) {
        res.status(400).json({
          success: false,
          error: 'Attachment ID is required'
        });
        return;
      }

      const notes = await this.imageNotesService.getNotesForAttachment(attachmentId);
      const total = notes.length;

      const response: ImageNotesGetResponse = {
        success: true,
        data: {
          notes,
          total,
          attachment_id: attachmentId
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching image notes:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch notes'
      });
    }
  };

  /**
   * POST /api/comment-attachments/:attachmentId/notes
   * Create a new note for an image attachment
   */
  createNote = async (req: Request, res: Response): Promise<void> => {
    try {
      const { attachmentId } = req.params;
      const { content } = req.body;
      const userId = req.user?.id;

      if (!attachmentId) {
        res.status(400).json({
          success: false,
          error: 'Attachment ID is required'
        });
        return;
      }

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      if (!content || typeof content !== 'string' || !content.trim()) {
        res.status(400).json({
          success: false,
          error: 'Note content is required'
        });
        return;
      }

      if (content.trim().length > 1000) {
        res.status(400).json({
          success: false,
          error: 'Note content cannot exceed 1000 characters'
        });
        return;
      }

      const noteData: CreateImageNoteData = {
        attachment_id: attachmentId,
        content: content.trim()
      };

      const note = await this.imageNotesService.createNote(noteData, parseInt(userId));

      const response: ImageNoteCreateResponse = {
        success: true,
        data: {
          note
        }
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating image note:', error);
      
      if (error instanceof Error && error.message === 'Attachment not found') {
        res.status(404).json({
          success: false,
          error: 'Attachment not found'
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create note'
      });
    }
  };

  /**
   * PUT /api/comment-attachments/:attachmentId/notes/:noteId
   * Update an existing note
   */
  updateNote = async (req: Request, res: Response): Promise<void> => {
    try {
      const { attachmentId, noteId } = req.params;
      const { content } = req.body;
      const userId = req.user?.id;

      if (!noteId || !attachmentId) {
        res.status(400).json({
          success: false,
          error: 'Note ID and Attachment ID are required'
        });
        return;
      }

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      if (!content || typeof content !== 'string' || !content.trim()) {
        res.status(400).json({
          success: false,
          error: 'Note content is required'
        });
        return;
      }

      if (content.trim().length > 1000) {
        res.status(400).json({
          success: false,
          error: 'Note content cannot exceed 1000 characters'
        });
        return;
      }

      const updateData: UpdateImageNoteData = {
        content: content.trim()
      };

      const updatedNote = await this.imageNotesService.updateNote(noteId, updateData, parseInt(userId));

      const response: ImageNoteCreateResponse = {
        success: true,
        data: {
          note: updatedNote
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error updating image note:', error);
      
      if (error instanceof Error) {
        if (error.message === 'Note not found') {
          res.status(404).json({
            success: false,
            error: 'Note not found'
          });
          return;
        }
        
        if (error.message === 'Permission denied') {
          res.status(403).json({
            success: false,
            error: 'Permission denied'
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        error: 'Failed to update note'
      });
    }
  };

  /**
   * DELETE /api/comment-attachments/:attachmentId/notes/:noteId
   * Delete a note (soft delete)
   */
  deleteNote = async (req: Request, res: Response): Promise<void> => {
    try {
      const { attachmentId, noteId } = req.params;
      const userId = req.user?.id;

      if (!noteId || !attachmentId) {
        res.status(400).json({
          success: false,
          error: 'Note ID and Attachment ID are required'
        });
        return;
      }

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      await this.imageNotesService.deleteNote(noteId, parseInt(userId));

      res.json({
        success: true,
        message: 'Note deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting image note:', error);
      
      if (error instanceof Error) {
        if (error.message === 'Note not found') {
          res.status(404).json({
            success: false,
            error: 'Note not found'
          });
          return;
        }
        
        if (error.message === 'Permission denied') {
          res.status(403).json({
            success: false,
            error: 'Permission denied'
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        error: 'Failed to delete note'
      });
    }
  };

  /**
   * GET /api/comment-attachments/:attachmentId/notes/:noteId
   * Get a specific note by ID
   */
  getNote = async (req: Request, res: Response): Promise<void> => {
    try {
      const { attachmentId, noteId } = req.params;

      if (!noteId || !attachmentId) {
        res.status(400).json({
          success: false,
          error: 'Note ID and Attachment ID are required'
        });
        return;
      }

      const note = await this.imageNotesService.getNoteById(noteId);

      if (!note || note.attachment_id !== attachmentId) {
        res.status(404).json({
          success: false,
          error: 'Note not found'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          note
        }
      });
    } catch (error) {
      console.error('Error fetching image note:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch note'
      });
    }
  };

  /**
   * GET /api/comment-attachments/:attachmentId/notes/count
   * Get notes count for an attachment
   */
  getNotesCount = async (req: Request, res: Response): Promise<void> => {
    try {
      const { attachmentId } = req.params;

      if (!attachmentId) {
        res.status(400).json({
          success: false,
          error: 'Attachment ID is required'
        });
        return;
      }

      const count = await this.imageNotesService.getNotesCount(attachmentId);

      res.json({
        success: true,
        data: {
          count,
          attachment_id: attachmentId
        }
      });
    } catch (error) {
      console.error('Error fetching notes count:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch notes count'
      });
    }
  };
}

export default ImageNotesController;