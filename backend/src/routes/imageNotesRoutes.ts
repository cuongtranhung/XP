import { Router } from 'express';
import { ImageNotesController } from '../controllers/ImageNotesController';
import { authenticate } from '../middleware/auth';

const router = Router();
const imageNotesController = new ImageNotesController();

// All image notes routes require authentication
router.use(authenticate);

// GET /api/comment-attachments/:attachmentId/notes - Get all notes for an attachment
router.get('/:attachmentId/notes', imageNotesController.getNotes);

// POST /api/comment-attachments/:attachmentId/notes - Create a new note
router.post('/:attachmentId/notes', imageNotesController.createNote);

// GET /api/comment-attachments/:attachmentId/notes/count - Get notes count
router.get('/:attachmentId/notes/count', imageNotesController.getNotesCount);

// GET /api/comment-attachments/:attachmentId/notes/:noteId - Get specific note
router.get('/:attachmentId/notes/:noteId', imageNotesController.getNote);

// PUT /api/comment-attachments/:attachmentId/notes/:noteId - Update note
router.put('/:attachmentId/notes/:noteId', imageNotesController.updateNote);

// DELETE /api/comment-attachments/:attachmentId/notes/:noteId - Delete note
router.delete('/:attachmentId/notes/:noteId', imageNotesController.deleteNote);

export { router as imageNotesRoutes };