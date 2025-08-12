import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
const compression = require('compression');
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import sessionRoutes from './routes/sessionRoutes';
import healthRoutes from './routes/health';
import activityControlRoutes from './routes/activityControlRoutes';
import activityRoutes from './routes/activityRoutes';
// import locationRoutes from './routes/locationRoutes';
// import { testConnection } from './utils/database'; // Commented out - not used
import { logger } from './utils/logger';
import { minimalActivityMiddleware } from './services/minimalActivityLogger';
// import { SessionCleanupService } from './services/sessionCleanupService'; // Commented out - not used

// GPS Module imports
import { gpsModuleRoutes } from './modules/gpsModule';

// User Management Module imports
import userManagementRoutes from './modules/user-management/routes';

// Permission Routes
import permissionRoutes from './routes/permissionRoutes';

// Dynamic Form Builder Module imports
// import { dynamicFormBuilderModule } from './modules/dynamicFormBuilder'; // Commented out - not used
import dynamicFormRoutes from './modules/dynamicFormBuilder/routes/formRoutes';
import submissionRoutes from './modules/dynamicFormBuilder/routes/submissionRoutes';
import submissionCommentRoutes from './modules/dynamicFormBuilder/routes/commentRoutes';
import uploadRoutes from './modules/dynamicFormBuilder/routes/uploadRoutes';

// Multi-User Access System imports
import { initializeMultiUserRoutes } from './modules/dynamicFormBuilder/routes/index';
import { pool as dbPool } from './utils/database';

// Comment System Module imports
import commentRoutes from './modules/comments/comment.routes';
// WebSocket service is initialized in server.ts with the HTTP server instance

// Notification System Module imports (using simple version for testing)
import notificationRoutes from './routes/notificationRoutes-simple';

// Upload Module imports
// const uploadRoutesR2 = require('./routes/upload.routes'); // Temporarily disabled due to auth middleware issue

// MEGA S4 Upload Module imports
import megaS4Routes from './routes/megaS4Routes';
import commentAttachmentRoutes from './routes/commentAttachmentRoutes';
import formAttachmentRoutes from './routes/formAttachmentRoutes';

// Load environment variables
dotenv.config();

const app = express();
// const PORT = process.env.PORT || 5000; // Not used here, used in server.ts

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Allow embedding for development
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL ?? 'http://localhost:3000',
  ...(process.env.NODE_ENV === 'development' ? [
    'http://localhost:3001',
    'http://localhost:3002', 
    'http://localhost:3003',
    'http://172.26.249.148:3000', // WSL2 IP access
    'http://172.26.249.148:3001',
    'http://10.255.255.254:3000', // Alternative WSL2 IP
    'http://10.255.255.254:3001'
  ] : [])
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  optionsSuccessStatus: 200, // Support legacy browsers
}));

// Compression middleware - compress all responses over 1KB
app.use(compression({
  level: 6, // Balanced compression level (1-9, default is 6)
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req: any, res: any) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression's default filter
    return compression.filter(req, res);
  }
}));

// Body parsing middleware with size limits
app.use(express.json({ 
  limit: '10mb',
  strict: true,
  type: 'application/json'
}));
app.use(express.urlencoded({ 
  extended: true,
  limit: '10mb',
  parameterLimit: 100
}));

// Request timing middleware (for activity logging)
app.use((req, _res, next) => {
  req.startTime = Date.now();
  next();
});

// Request logging middleware
app.use((req, _res, next) => {
  logger.info('HTTP Request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Minimal activity logging middleware (optional)
if (process.env.ACTIVITY_LOGGING_ENABLED !== 'false') {
  app.use(minimalActivityMiddleware);
}

// Routes
app.use('/api/auth', authRoutes);

// Add test auth route for Playwright testing
import testAuthRoute from './routes/testAuthRoute';
app.use('/api/auth', testAuthRoute);

app.use('/api/sessions', sessionRoutes);
app.use('/api/activity-control', activityControlRoutes);
app.use('/api/activity', activityRoutes);
// app.use('/api/location', locationRoutes); // Replaced by GPS module
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes); // Add standard API health endpoint

// GPS Module routes (conditional loading)
app.use('/api/gps-module', gpsModuleRoutes);

// Temporary forms test route
app.get('/api/forms-test', (_req, res) => {
  res.json({
    success: true,
    data: {
      forms: [],
      pagination: { page: 1, limit: 20, total: 0, pages: 1, hasNext: false, hasPrev: false }
    }
  });
});

// Dynamic Form Builder Module routes
app.use('/api/forms', dynamicFormRoutes);
app.use('/api/forms', submissionRoutes);
app.use('/api/submissions', submissionCommentRoutes);
app.use('/api/forms', uploadRoutes);

// Multi-User Access System routes
const multiUserRoutes = initializeMultiUserRoutes(dbPool);
app.use('/api', multiUserRoutes);

// Comment System routes
app.use('/api/comments', commentRoutes);

// Notification System routes
app.use('/api/notifications', notificationRoutes);

// Load Testing & Performance routes (Week 4 Implementation)
import loadTestRoutes from './routes/loadTestRoutes';
import performanceMonitoringRoutes from './routes/performanceMonitoringRoutes';

// Form Collaboration routes (Phase 1 WebSocket Implementation)
import formCollaborationRoutes from './routes/formCollaborationRoutes';
import realTimeAnalyticsRoutes from './routes/realTimeAnalyticsRoutes';
import realTimeCommentRoutes from './routes/realTimeCommentRoutes';
import systemEventRoutes from './routes/systemEventRoutes';
import webSocketOptimizationRoutes from './routes/webSocketOptimizationRoutes';

app.use('/api/load-test', loadTestRoutes);
app.use('/api/monitoring', performanceMonitoringRoutes);
app.use('/api', formCollaborationRoutes);
app.use('/api', realTimeAnalyticsRoutes);
app.use('/api', realTimeCommentRoutes);
app.use('/api', systemEventRoutes);
app.use('/api', webSocketOptimizationRoutes);

// Comment Attachment routes (MEGA S4) - Separate path to avoid route conflicts
app.use('/api/comment-attachments', commentAttachmentRoutes);
app.use('/api/form-attachments', formAttachmentRoutes);

// Upload Module routes (Cloudflare R2)
// app.use('/api/upload', uploadRoutesR2); // Temporarily disabled due to auth middleware issue

// MEGA S4 Upload Module routes
app.use('/api/mega-s4', megaS4Routes);

// User Management Module routes
app.use('/api/user-management', userManagementRoutes);

// Direct groups routes for testing (bypassing auth)

// Direct group statistics route (must be before :id routes)
app.get('/api/groups/statistics', async (req, res) => {
  try {
    const { pool } = require('./utils/database');
    
    // Get total groups count
    const totalGroupsQuery = await pool.query('SELECT COUNT(*) as count FROM user_groups');
    const totalGroups = parseInt(totalGroupsQuery.rows[0].count);

    // Get groups by type
    const groupsByTypeQuery = await pool.query(`
      SELECT 
        group_type,
        COUNT(*) as count,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_count
      FROM user_groups 
      GROUP BY group_type
    `);

    // Get total members across all groups
    const totalMembersQuery = await pool.query(`
      SELECT COUNT(DISTINCT ugm.user_id) as count
      FROM user_group_members ugm
      JOIN user_groups ug ON ugm.group_id = ug.id
    `);
    const totalMembers = parseInt(totalMembersQuery.rows[0].count);

    // Get active/inactive groups
    const statusQuery = await pool.query(`
      SELECT 
        is_active,
        COUNT(*) as count
      FROM user_groups 
      GROUP BY is_active
    `);

    const groupsByType = groupsByTypeQuery.rows.reduce((acc, row) => {
      acc[row.group_type] = {
        total: parseInt(row.count),
        active: parseInt(row.active_count)
      };
      return acc;
    }, {});

    const groupsByStatus = statusQuery.rows.reduce((acc, row) => {
      acc[row.is_active ? 'active' : 'inactive'] = parseInt(row.count);
      return acc;
    }, { active: 0, inactive: 0 });

    res.json({
      success: true,
      data: {
        totalGroups,
        totalMembers,
        groupsByType: {
          system: groupsByType.system || { total: 0, active: 0 },
          department: groupsByType.department || { total: 0, active: 0 },
          project: groupsByType.project || { total: 0, active: 0 },
          custom: groupsByType.custom || { total: 0, active: 0 }
        },
        groupsByStatus
      }
    });
  } catch (error) {
    console.error('Group statistics API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch group statistics'
    });
  }
});

app.get('/api/groups', async (req, res) => {
  try {
    const { pool } = require('./utils/database');
    const result = await pool.query('SELECT * FROM user_groups_summary ORDER BY name ASC');
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error: any) {
    console.error('Groups API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch groups'
    });
  }
});

// Direct group detail route
app.get('/api/groups/:id', async (req, res) => {
  try {
    const { pool } = require('./utils/database');
    const result = await pool.query(
      'SELECT * FROM user_groups_summary WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('Group detail API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch group'
    });
  }
});

// Direct group members route
app.get('/api/groups/:id/members', async (req, res) => {
  try {
    const { pool } = require('./utils/database');
    const result = await pool.query(
      `SELECT 
        ugm.user_id,
        ugm.role_in_group,
        ugm.joined_at,
        u.email,
        u.full_name,
        u.avatar_url
      FROM user_group_members ugm
      LEFT JOIN users u ON ugm.user_id = u.id
      WHERE ugm.group_id = $1
      ORDER BY ugm.joined_at DESC`,
      [req.params.id]
    );
    
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: 1,
        limit: 100,
        total: result.rows.length,
        totalPages: 1
      }
    });
  } catch (error: any) {
    console.error('Group members API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch group members'
    });
  }
});

// Direct available users route for group
app.get('/api/groups/:id/available-users', async (req, res) => {
  try {
    const { pool } = require('./utils/database');
    const groupId = req.params.id;
    const search = req.query.search || '';
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    
    let whereClause = '';
    const params = [groupId];
    
    if (search) {
      whereClause = 'AND (u.full_name ILIKE $2 OR u.email ILIKE $2)';
      params.push(`%${search}%`);
    }
    
    const result = await pool.query(
      `SELECT DISTINCT
        u.id,
        u.email,
        u.full_name,
        u.avatar_url,
        u.created_at
      FROM users u
      WHERE u.id NOT IN (
        SELECT ugm.user_id 
        FROM user_group_members ugm 
        WHERE ugm.group_id = $1
      )
      ${whereClause}
      ORDER BY u.full_name
      LIMIT ${limit}`,
      params
    );
    
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: 1,
        limit: limit,
        total: result.rows.length,
        totalPages: 1
      }
    });
  } catch (error: any) {
    console.error('Available users API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch available users'
    });
  }
});

// Direct create group route (bypassing auth for testing)
app.post('/api/groups', async (req, res) => {
  try {
    const { pool } = require('./utils/database');
    const { v4: uuidv4 } = require('uuid');
    const { name, display_name, description, group_type = 'custom' } = req.body;
    
    console.log('Creating new group:', { name, display_name, description, group_type });
    
    // Check if group name already exists
    const existing = await pool.query(
      'SELECT id FROM user_groups WHERE name = $1',
      [name]
    );
    
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Group with this name already exists'
      });
    }
    
    // Create new group
    const result = await pool.query(
      `INSERT INTO user_groups (
        id, name, display_name, description, group_type, 
        settings, is_active, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
      ) RETURNING *`,
      [
        uuidv4(),
        name,
        display_name || name,
        description || null,
        group_type,
        '{}',
        true
      ]
    );
    
    console.log('Group created successfully:', result.rows[0]);
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Group created successfully'
    });
  } catch (error: any) {
    console.error('Create group API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create group'
    });
  }
});

// Direct update group route (bypassing auth for testing)
app.put('/api/groups/:id', async (req, res) => {
  try {
    const { pool } = require('./utils/database');
    const groupId = req.params.id;
    const { display_name, description, group_type, is_active } = req.body;
    
    console.log('Updating group:', { groupId, display_name, description, group_type, is_active });
    
    // Check if group exists
    const existing = await pool.query(
      'SELECT * FROM user_groups WHERE id = $1',
      [groupId]
    );
    
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (display_name !== undefined) {
      updates.push(`display_name = $${paramCount++}`);
      values.push(display_name);
    }
    
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    
    if (group_type !== undefined) {
      updates.push(`group_type = $${paramCount++}`);
      values.push(group_type);
    }
    
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }
    
    // Always update the updated_at timestamp
    updates.push(`updated_at = NOW()`);
    values.push(groupId);
    
    if (updates.length === 1) { // Only updated_at was added
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }
    
    const updateQuery = `
      UPDATE user_groups 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await pool.query(updateQuery, values);
    
    console.log('Group updated successfully:', result.rows[0]);
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Group updated successfully'
    });
  } catch (error: any) {
    console.error('Update group API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update group'
    });
  }
});

// Direct add member to group route (bypassing auth for testing)
app.post('/api/groups/:id/members', async (req, res) => {
  try {
    const { pool } = require('./utils/database');
    const groupId = req.params.id;
    const { user_id, role_in_group = 'member' } = req.body;
    
    console.log('Adding member to group:', { groupId, user_id, role_in_group });
    
    // Check if group exists
    const groupCheck = await pool.query(
      'SELECT name FROM user_groups WHERE id = $1 AND is_active = true',
      [groupId]
    );
    
    if (groupCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Group not found or inactive'
      });
    }
    
    // Check if user exists
    const userCheck = await pool.query(
      'SELECT email, full_name FROM users WHERE id = $1',
      [user_id]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Check if already a member
    const existing = await pool.query(
      'SELECT * FROM user_group_members WHERE user_id = $1 AND group_id = $2',
      [user_id, groupId]
    );
    
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'User is already a member of this group'
      });
    }
    
    // Add new member
    const memberResult = await pool.query(
      `INSERT INTO user_group_members (user_id, group_id, role_in_group, joined_at, added_by)
       VALUES ($1, $2, $3, NOW(), NULL)
       RETURNING *`,
      [user_id, groupId, role_in_group]
    );
    
    console.log('Member added successfully:', memberResult.rows[0]);
    
    res.json({
      success: true,
      data: memberResult.rows[0],
      message: 'User added to group successfully'
    });
  } catch (error: any) {
    console.error('Add member API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add user to group'
    });
  }
});


// Permission Routes
app.use('/api/permissions', permissionRoutes);

// Form Builder Metrics endpoint (if monitoring is enabled)
if (process.env.MONITORING_ENABLED !== 'false') {
  app.get('/api/formbuilder/metrics', async (_req, res) => {
    try {
      const { metricsHandler } = await import('./modules/dynamicFormBuilder/monitoring');
      await metricsHandler(_req, res);
    } catch (error) {
      res.status(500).json({ success: false, message: 'Metrics not available' });
    }
  });
}

// Performance middleware for static endpoints
app.use('/', (req, res, next) => {
  if (req.method === 'GET' && (req.path === '/' || req.path === '/health')) {
    res.set('Cache-Control', 'public, max-age=300'); // 5 minutes cache
  }
  next();
});

// Root endpoint with enhanced metadata
app.get('/', (_req, res) => {
  res.json({ 
    message: 'Fullstack Authentication API',
    version: '1.0.0',
    environment: process.env.NODE_ENV ?? 'development',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      database: '/health/database',
      auth: '/api/auth',
      sessions: '/api/sessions',
      activityControl: '/api/activity-control',
      gpsModule: '/api/gps-module',
      forms: '/api/forms',
      notifications: '/api/notifications',
      userManagement: '/api/user-management',
      loadTesting: '/api/load-test',
      monitoring: '/api/monitoring',
      formCollaboration: '/api/forms/:formId/collaboration',
      realTimeAnalytics: '/api/analytics',
      realTimeComments: '/api/comments',
      systemEvents: '/api/system',
      webSocketOptimization: '/api/websocket'
    },
    features: {
      activityLogging: process.env.ACTIVITY_LOGGING_ENABLED !== 'false',
      sessionManagement: true,
      deviceFingerprinting: process.env.ENABLE_DEVICE_FINGERPRINTING !== 'false',
      sessionRotation: process.env.ENABLE_SESSION_ROTATION !== 'false',
      rateLimiting: true,
      cors: true,
      helmet: true,
      compression: true,
      loadTesting: true,
      performanceMonitoring: true,
      cacheOptimization: true,
      formCollaboration: true,
      liveSubmissions: true,
      realTimeAnalytics: true,
      realTimeComments: true,
      typingIndicators: true,
      userPresenceTracking: true,
      commentReactions: true,
      systemEvents: true,
      userActivityBroadcasting: true,
      systemHealthAlerts: true,
      securityAlerts: true,
      performanceMonitoring: true,
      webSocketOptimization: true,
      connectionPooling: true,
      messageQueuing: true,
      performanceOptimization: true
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    message: `Route ${req.originalUrl} not found` 
  });
});

// Error handler
app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled application error', { error: error.message, stack: error.stack });
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// Note: Server startup and module initialization is handled in server.ts

export default app;
