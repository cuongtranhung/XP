import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

// Admin endpoints
router.get('/dashboard', authenticate, async (req, res) => {
  res.json({
    message: 'Admin dashboard endpoint',
    userId: (req as any).user?.id
  });
});

router.get('/users', authenticate, async (req, res) => {
  res.json({
    message: 'Admin users list endpoint',
    users: []
  });
});

export default router;