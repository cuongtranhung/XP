import { Router, Request, Response } from 'express';
import { RoleService } from '../services/RoleService';
import { Role, AssignRoleDTO } from '../types';

const router = Router();
const roleService = new RoleService();

// Get all roles
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await roleService.getAllRoles();
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: 'Roles retrieved successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    console.error('Error in GET /roles:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create new role
router.post('/', async (req: Request, res: Response) => {
  try {
    const roleData: Partial<Role> = req.body;
    const createdBy = req.user?.id; // From auth middleware
    
    const result = await roleService.createRole(roleData, createdBy);
    if (result.success) {
      res.status(201).json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    console.error('Error in POST /roles:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update role
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const roleId = req.params.id;
    const updates: Partial<Role> = req.body;
    const updatedBy = req.user?.id;
    
    const result = await roleService.updateRole(roleId, updates, updatedBy);
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    console.error('Error in PUT /roles/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete role
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const roleId = req.params.id;
    const deletedBy = req.user?.id;
    
    const result = await roleService.deleteRole(roleId, deletedBy);
    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    console.error('Error in DELETE /roles/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get user's roles
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    
    const result = await roleService.getUserRoles(userId);
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: 'User roles retrieved successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    console.error('Error in GET /roles/user/:userId:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Assign role to user
router.post('/assign', async (req: Request, res: Response) => {
  try {
    const assignData: AssignRoleDTO = req.body;
    const assignedBy = req.user?.id;
    
    const result = await roleService.assignRoleToUser(assignData, assignedBy);
    if (result.success) {
      res.status(201).json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    console.error('Error in POST /roles/assign:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Remove role from user
router.delete('/remove/:userId/:roleId', async (req: Request, res: Response) => {
  try {
    const { userId, roleId } = req.params;
    const removedBy = req.user?.id;
    
    const result = await roleService.removeRoleFromUser(userId, roleId, removedBy);
    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    console.error('Error in DELETE /roles/remove/:userId/:roleId:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get users by role
router.get('/:roleId/users', async (req: Request, res: Response) => {
  try {
    const roleId = req.params.roleId;
    const pagination = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10
    };
    
    const result = await roleService.getUsersByRole(roleId, pagination);
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: 'Users by role retrieved successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    console.error('Error in GET /roles/:roleId/users:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export { router as roleRoutes };

// Type extensions for Request - using existing user interface structure
// The existing global type already defines user, we'll just use it