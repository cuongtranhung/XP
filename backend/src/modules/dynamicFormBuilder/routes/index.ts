/**
 * Multi-User System Routes Index
 * Central router for all multi-user access system routes
 * Created: 2025-01-12
 */

import express from 'express';
import { Pool } from 'pg';
import { initializeFormPermissionsMiddleware } from '../../../middleware/formPermissions';

// Import route modules
import { initializeSharingRoutes } from './sharing.routes';
import { initializePermissionsRoutes } from './permissions.routes';
import { initializeCloningRoutes } from './cloning.routes';
import { initializeAuditRoutes } from './audit.routes';
import { initializeDashboardRoutes } from './dashboard.routes';

const router = express.Router();

/**
 * Initialize all multi-user system routes
 */
export const initializeMultiUserRoutes = (dbPool: Pool) => {
  // Initialize middleware
  initializeFormPermissionsMiddleware(dbPool);

  // Initialize route modules
  const sharingRoutes = initializeSharingRoutes(dbPool);
  const permissionsRoutes = initializePermissionsRoutes(dbPool);
  const cloningRoutes = initializeCloningRoutes(dbPool);
  const auditRoutes = initializeAuditRoutes(dbPool);
  const dashboardRoutes = initializeDashboardRoutes(dbPool);

  // Mount routes
  router.use('/forms', sharingRoutes);      // Form sharing operations
  router.use('/forms', permissionsRoutes);  // Permission checking
  router.use('/forms', cloningRoutes);      // Form cloning and templates
  router.use('/forms', auditRoutes);        // Audit logs (form-specific)
  router.use('/audit', auditRoutes);        // Audit system operations
  router.use('/users', auditRoutes);        // User activity logs
  router.use('/dashboard', dashboardRoutes); // Dashboard data and statistics

  return router;
};

export default router;