import { Router, Request, Response } from 'express';
import PermissionService from '../services/PermissionService';
import { authMiddleware } from '../../../middleware/auth';
import { PermissionAssignment } from '../types/permission.types';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @route   GET /api/user-management/permissions/groups
 * @desc    Get all permission groups with permissions
 * @access  Protected
 */
router.get('/groups', async (req: Request, res: Response) => {
  try {
    const groups = await PermissionService.getPermissionGroups();
    res.json({
      success: true,
      data: groups
    });
  } catch (error: any) {
    console.error('Error fetching permission groups:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch permission groups'
    });
  }
});

/**
 * @route   GET /api/user-management/permissions
 * @desc    Get all permissions
 * @access  Protected
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const permissions = await PermissionService.getAllPermissions();
    res.json({
      success: true,
      data: permissions
    });
  } catch (error: any) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch permissions'
    });
  }
});

/**
 * @route   GET /api/user-management/permissions/matrix
 * @desc    Get permission matrix for all roles
 * @access  Protected (Admin only)
 */
router.get('/matrix', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin check
    const matrix = await PermissionService.getPermissionMatrix();
    res.json({
      success: true,
      data: matrix
    });
  } catch (error: any) {
    console.error('Error fetching permission matrix:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch permission matrix'
    });
  }
});

/**
 * @route   GET /api/user-management/permissions/role/:roleId
 * @desc    Get permissions for a specific role
 * @access  Protected
 */
router.get('/role/:roleId', async (req: Request, res: Response) => {
  try {
    const { roleId } = req.params;
    const permissions = await PermissionService.getRolePermissions(roleId);
    res.json({
      success: true,
      data: permissions
    });
  } catch (error: any) {
    console.error('Error fetching role permissions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch role permissions'
    });
  }
});

/**
 * @route   GET /api/user-management/permissions/user/:userId
 * @desc    Get permissions for a specific user
 * @access  Protected
 */
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const permissions = await PermissionService.getUserPermissions(parseInt(userId));
    res.json({
      success: true,
      data: permissions
    });
  } catch (error: any) {
    console.error('Error fetching user permissions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch user permissions'
    });
  }
});

/**
 * @route   POST /api/user-management/permissions/role/:roleId/assign
 * @desc    Assign permissions to a role
 * @access  Protected (Admin only)
 */
router.post('/role/:roleId/assign', async (req: Request, res: Response) => {
  try {
    const { roleId } = req.params;
    const { permissionIds } = req.body;
    const grantedBy = (req as any).user?.id;

    if (!Array.isArray(permissionIds)) {
      return res.status(400).json({
        success: false,
        error: 'permissionIds must be an array'
      });
    }

    await PermissionService.assignPermissionsToRole(roleId, permissionIds, grantedBy);
    
    res.json({
      success: true,
      message: 'Permissions assigned successfully'
    });
  } catch (error: any) {
    console.error('Error assigning permissions to role:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to assign permissions'
    });
  }
});

/**
 * @route   POST /api/user-management/permissions/user/:userId/assign
 * @desc    Assign direct permissions to a user
 * @access  Protected (Admin only)
 */
router.post('/user/:userId/assign', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { assignments } = req.body;
    const grantedBy = (req as any).user?.id;

    if (!Array.isArray(assignments)) {
      return res.status(400).json({
        success: false,
        error: 'assignments must be an array'
      });
    }

    const permissionAssignments: PermissionAssignment[] = assignments.map(a => ({
      permissionId: a.permissionId,
      granted: a.granted ?? true,
      reason: a.reason,
      expiresAt: a.expiresAt ? new Date(a.expiresAt) : undefined
    }));

    await PermissionService.assignPermissionsToUser(
      parseInt(userId), 
      permissionAssignments, 
      grantedBy
    );
    
    res.json({
      success: true,
      message: 'Permissions assigned successfully'
    });
  } catch (error: any) {
    console.error('Error assigning permissions to user:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to assign permissions'
    });
  }
});

/**
 * @route   POST /api/user-management/permissions/check
 * @desc    Check if user has a specific permission
 * @access  Protected
 */
router.post('/check', async (req: Request, res: Response) => {
  try {
    const { userId, resource, action, scope = 'all' } = req.body;

    if (!userId || !resource || !action) {
      return res.status(400).json({
        success: false,
        error: 'userId, resource, and action are required'
      });
    }

    const hasPermission = await PermissionService.userHasPermission(
      parseInt(userId),
      resource,
      action,
      scope
    );

    res.json({
      success: true,
      data: {
        hasPermission,
        userId,
        resource,
        action,
        scope
      }
    });
  } catch (error: any) {
    console.error('Error checking permission:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check permission'
    });
  }
});

/**
 * @route   POST /api/user-management/permissions
 * @desc    Create a new permission
 * @access  Protected (Super Admin only)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // TODO: Add super admin check
    const permission = await PermissionService.createPermission(req.body);
    res.status(201).json({
      success: true,
      data: permission
    });
  } catch (error: any) {
    console.error('Error creating permission:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create permission'
    });
  }
});

/**
 * @route   PUT /api/user-management/permissions/:id
 * @desc    Update a permission
 * @access  Protected (Super Admin only)
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    // TODO: Add super admin check
    const { id } = req.params;
    const permission = await PermissionService.updatePermission(id, req.body);
    res.json({
      success: true,
      data: permission
    });
  } catch (error: any) {
    console.error('Error updating permission:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update permission'
    });
  }
});

/**
 * @route   DELETE /api/user-management/permissions/:id
 * @desc    Delete a permission
 * @access  Protected (Super Admin only)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    // TODO: Add super admin check
    const { id } = req.params;
    await PermissionService.deletePermission(id);
    res.json({
      success: true,
      message: 'Permission deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting permission:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete permission'
    });
  }
});

export default router;