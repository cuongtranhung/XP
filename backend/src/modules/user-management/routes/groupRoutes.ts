import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { GroupService } from '../services/GroupService';
import { authenticateToken } from '../middleware/auth';
import { checkPermission } from '../middleware/permission';

const router = Router();
const groupService = new GroupService();

// Apply authentication middleware to all routes (commented for testing)
// router.use(authenticateToken);

/**
 * @route   GET /api/user-management/groups/test
 * @desc    Test endpoint without database
 * @access  Public
 */
router.get('/test', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Groups endpoint is working',
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   GET /api/user-management/groups/test-db
 * @desc    Test database connection directly
 * @access  Public
 */
router.get('/test-db', async (req: Request, res: Response) => {
  try {
    // Simple hardcoded query to test database
    const result = await groupService.testDatabaseConnection();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Database test failed'
    });
  }
});

/**
 * @route   GET /api/user-management/groups/statistics
 * @desc    Get group statistics
 * @access  Private (requires READ_GROUPS permission)
 */
router.get('/statistics',
  // checkPermission('groups', 'read'), // Temporarily disabled for testing
  async (req: Request, res: Response) => {
    try {
      const result = await groupService.getGroupStatistics();
      
      if (result.success) {
        return res.json(result);
      } else {
        return res.status(500).json(result);
      }
    } catch (error) {
      console.error('Error in GET /groups/statistics:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

/**
 * @route   GET /api/user-management/groups
 * @desc    Get all groups with optional filters
 * @access  Private (requires READ_GROUPS permission)
 */
router.get('/',
  // checkPermission('groups', 'read'), // Temporarily disabled for testing
  [
    query('group_type').optional().isIn(['system', 'department', 'project', 'custom'])
      .withMessage('Invalid group type'),
    query('is_active').optional().isBoolean()
      .withMessage('is_active must be a boolean'),
    query('search').optional().isString().trim()
      .withMessage('Search must be a string')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const filters = {
        group_type: req.query.group_type as string,
        is_active: req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
        search: req.query.search as string
      };

      const result = await groupService.getAllGroups(filters);
      
      if (result.success) {
        return res.json(result);
      } else {
        return res.status(500).json(result);
      }
    } catch (error) {
      console.error('Error in GET /groups:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

/**
 * @route   GET /api/user-management/groups/:id
 * @desc    Get group by ID
 * @access  Private (requires READ_GROUPS permission)
 */
router.get('/:id',
  // checkPermission('groups', 'read'), // Temporarily disabled for testing
  [
    param('id').isUUID().withMessage('Group ID must be a valid UUID')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const result = await groupService.getGroupById(req.params.id);
      
      if (result.success) {
        return res.json(result);
      } else {
        return res.status(404).json(result);
      }
    } catch (error) {
      console.error('Error in GET /groups/:id:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

/**
 * @route   POST /api/user-management/groups
 * @desc    Create new group
 * @access  Private (requires CREATE_GROUPS permission)
 */
router.post('/',
  // checkPermission('groups', 'create'), // Temporarily disabled for testing
  [
    body('name').notEmpty().trim().isLength({ min: 2, max: 100 })
      .withMessage('Group name must be between 2 and 100 characters'),
    body('display_name').notEmpty().trim().isLength({ min: 2, max: 255 })
      .withMessage('Display name must be between 2 and 255 characters'),
    body('description').optional().trim().isLength({ max: 1000 })
      .withMessage('Description cannot exceed 1000 characters'),
    body('group_type').optional().isIn(['department', 'project', 'custom'])
      .withMessage('Invalid group type (system groups cannot be created via API)'),
    body('parent_group_id').optional().isUUID()
      .withMessage('Parent group ID must be a valid UUID')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const groupData = {
        name: req.body.name,
        display_name: req.body.display_name,
        description: req.body.description,
        group_type: req.body.group_type || 'custom',
        parent_group_id: req.body.parent_group_id
      };

      const result = await groupService.createGroup(groupData, (req as any).user?.id);
      
      if (result.success) {
        return res.status(201).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error in POST /groups:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

/**
 * @route   PUT /api/user-management/groups/:id
 * @desc    Update group
 * @access  Private (requires UPDATE_GROUPS permission)
 */
router.put('/:id',
  checkPermission('groups', 'update'),
  [
    param('id').isUUID().withMessage('Group ID must be a valid UUID'),
    body('display_name').optional().trim().isLength({ min: 2, max: 255 })
      .withMessage('Display name must be between 2 and 255 characters'),
    body('description').optional().trim().isLength({ max: 1000 })
      .withMessage('Description cannot exceed 1000 characters'),
    body('is_active').optional().isBoolean()
      .withMessage('is_active must be a boolean')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const updates = {
        display_name: req.body.display_name,
        description: req.body.description,
        is_active: req.body.is_active
      };

      const result = await groupService.updateGroup(req.params.id, updates, (req as any).user?.id);
      
      if (result.success) {
        return res.json(result);
      } else {
        return res.status(404).json(result);
      }
    } catch (error) {
      console.error('Error in PUT /groups/:id:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

/**
 * @route   DELETE /api/user-management/groups/:id
 * @desc    Delete group
 * @access  Private (requires DELETE_GROUPS permission)
 */
router.delete('/:id',
  checkPermission('groups', 'delete'),
  [
    param('id').isUUID().withMessage('Group ID must be a valid UUID')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const result = await groupService.deleteGroup(req.params.id, (req as any).user?.id);
      
      if (result.success) {
        return res.json(result);
      } else {
        return res.status(404).json(result);
      }
    } catch (error) {
      console.error('Error in DELETE /groups/:id:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

/**
 * @route   GET /api/user-management/groups/:id/members
 * @desc    Get group members with pagination
 * @access  Private (requires READ_GROUP_MEMBERS permission)
 */
router.get('/:id/members',
  // checkPermission('group_members', 'read'), // Temporarily disabled for testing
  [
    param('id').isUUID().withMessage('Group ID must be a valid UUID'),
    query('page').optional().isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const pagination = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10
      };

      const result = await groupService.getGroupMembers(req.params.id, pagination);
      
      if (result.success) {
        return res.json(result);
      } else {
        return res.status(404).json(result);
      }
    } catch (error) {
      console.error('Error in GET /groups/:id/members:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

/**
 * @route   POST /api/user-management/groups/:id/members
 * @desc    Add user to group (bulk assignment supported)
 * @access  Private (requires MANAGE_GROUP_MEMBERS permission)
 */
router.post('/:id/members',
  // checkPermission('group_members', 'manage'), // Temporarily disabled for testing
  [
    param('id').isUUID().withMessage('Group ID must be a valid UUID'),
    body('user_ids').isArray({ min: 1 })
      .withMessage('user_ids must be a non-empty array'),
    body('user_ids.*').isString().trim()
      .withMessage('Each user_id must be a valid string'),
    body('role_in_group').optional().isIn(['member', 'manager', 'owner'])
      .withMessage('Invalid role in group')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userIds = req.body.user_ids;
      const roleInGroup = req.body.role_in_group || 'member';
      const groupId = req.params.id;
      const addedBy = (req as any).user?.id;

      const results = [];
      const errors_bulk = [];

      // Process each user assignment
      for (const userId of userIds) {
        try {
          const result = await groupService.addUserToGroup({
            user_id: userId,
            group_id: groupId,
            role_in_group: roleInGroup
          }, addedBy);

          if (result.success) {
            results.push({
              user_id: userId,
              success: true,
              message: result.message
            });
          } else {
            errors_bulk.push({
              user_id: userId,
              success: false,
              error: result.error
            });
          }
        } catch (error) {
          errors_bulk.push({
            user_id: userId,
            success: false,
            error: 'Internal error during assignment'
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: `Processed ${userIds.length} user assignments`,
        data: {
          successful: results,
          failed: errors_bulk,
          summary: {
            total: userIds.length,
            successful_count: results.length,
            failed_count: errors_bulk.length
          }
        }
      });
    } catch (error) {
      console.error('Error in POST /groups/:id/members:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

/**
 * @route   DELETE /api/user-management/groups/:id/members/:userId
 * @desc    Remove user from group
 * @access  Private (requires MANAGE_GROUP_MEMBERS permission)
 */
router.delete('/:id/members/:userId',
  checkPermission('group_members', 'manage'),
  [
    param('id').isUUID().withMessage('Group ID must be a valid UUID'),
    param('userId').isString().trim().notEmpty()
      .withMessage('User ID is required')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const result = await groupService.removeUserFromGroup(
        req.params.userId,
        req.params.id,
        (req as any).user?.id
      );
      
      if (result.success) {
        return res.json(result);
      } else {
        return res.status(404).json(result);
      }
    } catch (error) {
      console.error('Error in DELETE /groups/:id/members/:userId:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

/**
 * @route   PUT /api/user-management/groups/:id/members/:userId
 * @desc    Update user's role in group
 * @access  Private (requires MANAGE_GROUP_MEMBERS permission)
 */
router.put('/:id/members/:userId',
  checkPermission('group_members', 'manage'),
  [
    param('id').isUUID().withMessage('Group ID must be a valid UUID'),
    param('userId').isString().trim().notEmpty()
      .withMessage('User ID is required'),
    body('role_in_group').isIn(['member', 'manager', 'owner'])
      .withMessage('Invalid role in group')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const result = await groupService.updateUserRoleInGroup(
        req.params.userId,
        req.params.id,
        req.body.role_in_group,
        (req as any).user?.id
      );
      
      if (result.success) {
        return res.json(result);
      } else {
        return res.status(404).json(result);
      }
    } catch (error) {
      console.error('Error in PUT /groups/:id/members/:userId:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

/**
 * @route   GET /api/user-management/groups/:id/available-users
 * @desc    Get users not in group (for assignment)
 * @access  Private (requires MANAGE_GROUP_MEMBERS permission)
 */
router.get('/:id/available-users',
  // checkPermission('group_members', 'manage'), // Temporarily disabled for testing
  [
    param('id').isUUID().withMessage('Group ID must be a valid UUID'),
    query('search').optional().isString().trim()
      .withMessage('Search must be a string'),
    query('department').optional().isString().trim()
      .withMessage('Department must be a string'),
    query('limit').optional().isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const searchTerm = req.query.search as string;
      const department = req.query.department as string;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await groupService.searchUsersForAssignment(
        req.params.id,
        searchTerm,
        department,
        limit
      );
      
      if (result.success) {
        return res.json(result);
      } else {
        return res.status(500).json(result);
      }
    } catch (error) {
      console.error('Error in GET /groups/:id/available-users:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

export { router as groupRoutes };