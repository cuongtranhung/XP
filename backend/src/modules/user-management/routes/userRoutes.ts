import { Router, Request, Response } from 'express';
import { UserService } from '../services/UserService';
import { RoleService } from '../services/RoleService';
import { GroupService } from '../services/GroupService';
import { authenticateToken } from '../middleware/auth';
import { checkPermission } from '../middleware/permission';

const router = Router();
const userService = new UserService();
const roleService = new RoleService();
const groupService = new GroupService();

// Apply authentication to all routes
router.use(authenticateToken);

// List users with filters
router.get('/', checkPermission('users', 'read'), async (req: Request, res: Response) => {
  try {
    const filters = {
      status: req.query.status ? (req.query.status as string).split(',') : undefined,
      department: req.query.department as string,
      is_blocked: req.query.is_blocked === 'true' ? true : req.query.is_blocked === 'false' ? false : undefined,
      is_approved: req.query.is_approved === 'true' ? true : req.query.is_approved === 'false' ? false : undefined,
      search: req.query.search as string
    };

    const pagination = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      sort_by: req.query.sort_by as string,
      sort_order: req.query.sort_order as 'asc' | 'desc'
    };

    const result = await userService.listUsers(filters, pagination, req.user?.id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get user statistics
router.get('/statistics', checkPermission('users', 'read'), async (req: Request, res: Response) => {
  try {
    const result = await userService.getUserStatistics();
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get user by ID
router.get('/:userId', checkPermission('users', 'read'), async (req: Request, res: Response) => {
  try {
    const result = await userService.getUserById(req.params.userId, req.user?.id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Create new user
router.post('/', checkPermission('users', 'create'), async (req: Request, res: Response) => {
  try {
    const result = await userService.createUser(req.body, req.user?.id);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update user
router.put('/:userId', checkPermission('users', 'update'), async (req: Request, res: Response) => {
  try {
    const result = await userService.updateUser(req.params.userId, req.body, req.user?.id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Delete user
router.delete('/:userId', checkPermission('users', 'delete'), async (req: Request, res: Response) => {
  try {
    const result = await userService.deleteUser(req.params.userId, req.user?.id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Approve user (toggle is_approved = true)
router.put('/:userId/approve', checkPermission('users', 'approve'), async (req: Request, res: Response) => {
  try {
    const result = await userService.toggleUserApproval(req.params.userId, true, req.user?.id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Disapprove user (toggle is_approved = false)
router.put('/:userId/disapprove', checkPermission('users', 'approve'), async (req: Request, res: Response) => {
  try {
    const result = await userService.toggleUserApproval(req.params.userId, false, req.user?.id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Block user (toggle is_blocked = true)
router.put('/:userId/block', checkPermission('users', 'block'), async (req: Request, res: Response) => {
  try {
    const result = await userService.toggleUserBlock(req.params.userId, true, req.user?.id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Unblock user (toggle is_blocked = false)
router.put('/:userId/unblock', checkPermission('users', 'block'), async (req: Request, res: Response) => {
  try {
    const result = await userService.toggleUserBlock(req.params.userId, false, req.user?.id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// === USER ROLES MANAGEMENT ===

// Get user's roles
router.get('/:userId/roles', checkPermission('roles', 'read'), async (req: Request, res: Response) => {
  try {
    const result = await roleService.getUserRoles(req.params.userId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Assign role to user
router.post('/:userId/roles', checkPermission('roles', 'assign'), async (req: Request, res: Response) => {
  try {
    const data = {
      user_id: req.params.userId,
      role_id: req.body.role_id,
      expires_at: req.body.expires_at
    };
    
    const result = await roleService.assignRoleToUser(data, req.user?.id);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update user's role
router.put('/:userId/roles/:roleId', checkPermission('roles', 'assign'), async (req: Request, res: Response) => {
  try {
    const result = await roleService.updateUserRole(
      req.params.userId,
      req.params.roleId,
      req.body,
      req.user?.id
    );
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Remove role from user
router.delete('/:userId/roles/:roleId', checkPermission('roles', 'assign'), async (req: Request, res: Response) => {
  try {
    const result = await roleService.removeRoleFromUser(
      req.params.userId,
      req.params.roleId,
      req.user?.id
    );
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// === USER GROUPS MANAGEMENT ===

// Get user's groups
router.get('/:userId/groups', checkPermission('groups', 'read'), async (req: Request, res: Response) => {
  try {
    const result = await groupService.getUserGroups(req.params.userId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Add user to group
router.post('/:userId/groups', checkPermission('groups', 'manage_members'), async (req: Request, res: Response) => {
  try {
    const data = {
      user_id: req.params.userId,
      group_id: req.body.group_id,
      role_in_group: req.body.role_in_group
    };
    
    const result = await groupService.addUserToGroup(data, req.user?.id);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update user's role in group
router.put('/:userId/groups/:groupId', checkPermission('groups', 'manage_members'), async (req: Request, res: Response) => {
  try {
    const result = await groupService.updateUserRoleInGroup(
      req.params.userId,
      req.params.groupId,
      req.body.role_in_group,
      req.user?.id
    );
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Remove user from group
router.delete('/:userId/groups/:groupId', checkPermission('groups', 'manage_members'), async (req: Request, res: Response) => {
  try {
    const result = await groupService.removeUserFromGroup(
      req.params.userId,
      req.params.groupId,
      req.user?.id
    );
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export { router as userRoutes };