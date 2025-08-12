// Activity Control Routes - Simple admin controls
// Date: 2025-08-04

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
const { MinimalActivityLogger } = require('../services/minimalActivityLogger');

const router = Router();

// Simple admin check
const requireAdmin = (req: Request, res: Response, next: any) => {
  if (!req.user || String(req.user.id) !== '2') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  return next();
};

// GET /api/activity-control/status
router.get('/status', authenticate, requireAdmin, (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      enabled: MinimalActivityLogger.isEnabled(),
      environment: process.env.NODE_ENV ?? 'development',
      asyncLogging: process.env.ACTIVITY_ASYNC_PROCESSING !== 'false'
    }
  });
});

// POST /api/activity-control/toggle
router.post('/toggle', authenticate, requireAdmin, (req: Request, res: Response) => {
  const { enabled } = req.body;
  
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: 'enabled field must be a boolean'
    });
  }

  MinimalActivityLogger.setEnabled(enabled);
  
  return res.json({
    success: true,
    message: `Activity logging ${enabled ? 'enabled' : 'disabled'}`,
    data: { enabled }
  });
});

export default router;