const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/authMiddleware');

// Get all permissions
router.get('/all', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        resource,
        action,
        scope,
        display_name,
        description,
        category
      FROM permissions
      WHERE is_active = true
      ORDER BY resource, action, scope
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch permissions'
    });
  }
});

// Get role permissions
router.get('/roles/:roleId/permissions', authMiddleware, async (req, res) => {
  try {
    const { roleId } = req.params;

    const result = await pool.query(`
      SELECT 
        p.id,
        p.resource,
        p.action,
        p.scope,
        p.display_name,
        p.description,
        p.category
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = $1 AND p.is_active = true
      ORDER BY p.resource, p.action, p.scope
    `, [roleId]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch role permissions'
    });
  }
});

// Update role permissions
router.put('/roles/:roleId/permissions', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { roleId } = req.params;
    const { add = [], remove = [] } = req.body;

    await client.query('BEGIN');

    // Remove permissions
    if (remove.length > 0) {
      await client.query(`
        DELETE FROM role_permissions
        WHERE role_id = $1 AND permission_id = ANY($2::uuid[])
      `, [roleId, remove]);
    }

    // Add permissions
    if (add.length > 0) {
      const values = add.map(permId => `('${roleId}', '${permId}')`).join(',');
      await client.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ${values}
        ON CONFLICT (role_id, permission_id) DO NOTHING
      `);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Permissions updated successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating role permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update role permissions'
    });
  } finally {
    client.release();
  }
});

// Get current user permissions
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get role permissions
    const rolePermsResult = await pool.query(`
      SELECT DISTINCT
        p.id,
        p.resource,
        p.action,
        p.scope,
        p.display_name,
        p.description,
        r.name as from_role
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      INNER JOIN roles r ON r.id = rp.role_id
      INNER JOIN user_roles ur ON ur.role_id = r.id
      WHERE ur.user_id = $1 AND p.is_active = true AND r.is_active = true
    `, [userId]);

    // Get direct permissions (if any)
    const directPermsResult = await pool.query(`
      SELECT 
        p.id,
        p.resource,
        p.action,
        p.scope,
        p.display_name,
        p.description
      FROM permissions p
      INNER JOIN user_permissions up ON p.id = up.permission_id
      WHERE up.user_id = $1 AND p.is_active = true
    `, [userId]);

    res.json({
      success: true,
      data: {
        role_permissions: rolePermsResult.rows,
        direct_permissions: directPermsResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user permissions'
    });
  }
});

// Check permission
router.post('/check', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { resource, action, scope = 'all' } = req.body;

    const result = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM permissions p
        WHERE p.resource = $1 
          AND p.action = $2 
          AND (p.scope = $3 OR p.scope = 'all')
          AND p.is_active = true
          AND (
            -- Check role permissions
            EXISTS (
              SELECT 1
              FROM role_permissions rp
              INNER JOIN user_roles ur ON ur.role_id = rp.role_id
              WHERE rp.permission_id = p.id
                AND ur.user_id = $4
            )
            OR
            -- Check direct permissions
            EXISTS (
              SELECT 1
              FROM user_permissions up
              WHERE up.permission_id = p.id
                AND up.user_id = $4
            )
          )
      ) as has_permission
    `, [resource, action, scope, userId]);

    res.json({
      success: true,
      data: {
        hasPermission: result.rows[0].has_permission
      }
    });
  } catch (error) {
    console.error('Error checking permission:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check permission'
    });
  }
});

module.exports = router;