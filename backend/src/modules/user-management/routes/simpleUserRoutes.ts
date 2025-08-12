import { Router, Request, Response } from 'express';
import { pool } from '../../../utils/database';

const router = Router();

// Simple test endpoint - list users from database
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id, 
        u.email, 
        u.username, 
        u.full_name,
        u.avatar_url,
        u.department,
        u.position,
        u.is_approved,
        u.is_blocked,
        u.status,
        u.created_at
      FROM users u
      WHERE u.deleted_at IS NULL
      ORDER BY u.created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: result.rows,
      total: result.rowCount
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        u.*,
        json_agg(DISTINCT jsonb_build_object('id', r.id, 'name', r.name)) as roles,
        json_agg(DISTINCT jsonb_build_object('id', g.id, 'name', g.name)) as groups
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      LEFT JOIN user_group_members ugm ON u.id = ugm.user_id
      LEFT JOIN user_groups g ON ugm.group_id = g.id
      WHERE u.id = $1 AND u.deleted_at IS NULL
      GROUP BY u.id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create new user (simple version for testing)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { email, firstName, lastName, password, department, position } = req.body;
    
    // Simple validation
    if (!email || !firstName || !lastName || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email, firstName, lastName and password are required'
      });
    }

    const result = await pool.query(`
      INSERT INTO users (email, full_name, password, department, position, status, is_approved, is_blocked, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'active', true, false, NOW(), NOW())
      RETURNING id, email, full_name, department, position, status, is_approved, is_blocked, created_at
    `, [email, `${firstName} ${lastName}`, password, department || null, position || null]);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    
    // Handle duplicate email
    if (error.code === '23505' && error.constraint === 'users_email_key') {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Toggle approval status
router.put('/:id/toggle-approval', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      UPDATE users 
      SET is_approved = NOT is_approved,
          updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id, is_approved
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: `User ${result.rows[0].is_approved ? 'approved' : 'disapproved'} successfully`,
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error toggling approval:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Toggle block status
router.put('/:id/toggle-block', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      UPDATE users 
      SET is_blocked = NOT is_blocked,
          status = CASE 
            WHEN is_blocked = false THEN 'inactive'
            ELSE 'active'
          END,
          updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id, is_blocked, status
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: `User ${result.rows[0].is_blocked ? 'blocked' : 'unblocked'} successfully`,
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error toggling block:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete user (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      UPDATE users 
      SET deleted_at = NOW(),
          status = 'deleted',
          updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id, email, full_name
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found or already deleted'
      });
    }

    res.json({
      success: true,
      message: `User ${result.rows[0].full_name || result.rows[0].email} deleted successfully`,
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export { router as simpleUserRoutes };