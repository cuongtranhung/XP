import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { cachingStrategies, invalidationStrategies } from '../middleware/cacheMiddleware';

const router = Router();

// User profile endpoints
router.get('/profile', authenticate, cachingStrategies.users, async (req, res) => {
  res.json({
    message: 'User profile endpoint',
    userId: (req as any).user?.id
  });
});

router.put('/profile', authenticate, invalidationStrategies.userUpdate, async (req, res) => {
  res.json({
    message: 'Update profile endpoint',
    userId: (req as any).user?.id
  });
});

export default router;