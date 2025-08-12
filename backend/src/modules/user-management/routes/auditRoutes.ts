import { Router } from 'express';

const router = Router();

// Audit routes will be implemented here
router.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Audit routes - To be implemented',
    data: []
  });
});

export { router as auditRoutes };