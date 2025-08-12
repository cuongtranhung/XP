import { Router } from 'express';
// import { userRoutes } from './userRoutes'; // Complex routes - temporarily disabled
import { simpleUserRoutes } from './simpleUserRoutes'; // Simple routes for testing
import { roleRoutes } from './roleRoutes';
import { groupRoutes } from './groupRoutes';
import { auditRoutes } from './auditRoutes';
import permissionRoutes from './permissionRoutes';

const router = Router();

// Mount sub-routes
router.use('/users', simpleUserRoutes); // Using simple routes for now
router.use('/roles', roleRoutes);
router.use('/groups', groupRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/permissions', permissionRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    module: 'user-management',
    timestamp: new Date().toISOString()
  });
});

export default router;