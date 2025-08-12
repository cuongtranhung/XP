// Comment Routes - RESTful API routing
import { Router } from 'express';
import { commentController, uploadMiddleware } from './comment.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Submission-specific routes
router.get('/submission/:submissionId', commentController.getComments.bind(commentController));
// Add multer middleware for file upload support
router.post('/submission/:submissionId', uploadMiddleware, commentController.createComment.bind(commentController));
router.get('/submission/:submissionId/count', commentController.getCommentCount.bind(commentController));
router.get('/submission/:submissionId/stats', commentController.getCommentStats.bind(commentController));

// Batch operations
router.post('/counts', commentController.getCommentCounts.bind(commentController));

// Individual comment operations
router.get('/:id', commentController.getCommentById.bind(commentController));
router.put('/:id', commentController.updateComment.bind(commentController));
router.delete('/:id', commentController.deleteComment.bind(commentController));
router.post('/:id/restore', commentController.restoreComment.bind(commentController));

// User-specific routes
router.get('/user/:userId', commentController.getUserComments.bind(commentController));

// Attachment routes
router.get('/attachments/:attachmentId/download', commentController.downloadAttachment.bind(commentController));
router.delete('/attachments/:attachmentId', commentController.deleteAttachment.bind(commentController));

export default router;