import { Pool } from 'pg';
import pool from '../../../config/database';
import { 
  Permission, 
  PermissionGroup, 
  RolePermission,
  UserPermission,
  PermissionAssignment 
} from '../types/permission.types';

export class PermissionService {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  /**
   * Get all permission groups with their permissions
   */
  async getPermissionGroups(): Promise<PermissionGroup[]> {
    try {
      const query = `
        SELECT 
          pg.id, pg.name, pg.display_name, pg.description, pg.icon, pg.sort_order,
          COALESCE(
            json_agg(
              json_build_object(
                'id', p.id,
                'resource', p.resource,
                'action', p.action,
                'scope', p.scope,
                'display_name', p.display_name,
                'description', p.description,
                'is_system', p.is_system
              ) ORDER BY p.resource, p.action
            ) FILTER (WHERE p.id IS NOT NULL), 
            '[]'::json
          ) as permissions
        FROM permission_groups pg
        LEFT JOIN permissions p ON pg.id = p.group_id AND COALESCE(p.is_active, true) = true
        WHERE pg.is_active = true
        GROUP BY pg.id, pg.name, pg.display_name, pg.description, pg.icon, pg.sort_order
        ORDER BY pg.sort_order, pg.name
      `;

      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error getting permission groups:', error);
      throw new Error('Failed to fetch permission groups');
    }
  }

  /**
   * Get all permissions
   */
  async getAllPermissions(): Promise<Permission[]> {
    try {
      const query = `
        SELECT 
          p.id, p.resource, p.action, p.scope, 
          p.display_name, p.description, p.is_system,
          pg.name as group_name, pg.display_name as group_display_name
        FROM permissions p
        LEFT JOIN permission_groups pg ON p.group_id = pg.id
        WHERE COALESCE(p.is_active, true) = true
        ORDER BY pg.sort_order, p.resource, p.action, p.scope
      `;

      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error getting permissions:', error);
      throw new Error('Failed to fetch permissions');
    }
  }

  /**
   * Get permissions for a specific role
   */
  async getRolePermissions(roleId: string): Promise<Permission[]> {
    try {
      const query = `
        SELECT * FROM get_role_permissions($1)
      `;

      const result = await this.pool.query(query, [roleId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting role permissions:', error);
      throw new Error('Failed to fetch role permissions');
    }
  }

  /**
   * Get permissions for a specific user
   */
  async getUserPermissions(userId: number): Promise<Permission[]> {
    try {
      const query = `
        SELECT * FROM get_user_permissions($1)
      `;

      const result = await this.pool.query(query, [userId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting user permissions:', error);
      throw new Error('Failed to fetch user permissions');
    }
  }

  /**
   * Assign permissions to a role
   */
  async assignPermissionsToRole(
    roleId: string, 
    permissionIds: string[], 
    grantedBy?: number
  ): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Remove existing permissions
      await client.query(
        'DELETE FROM role_permissions WHERE role_id = $1',
        [roleId]
      );

      // Add new permissions
      if (permissionIds.length > 0) {
        const values = permissionIds.map(
          (permId, index) => `($1, $${index + 2}, $${permissionIds.length + 2})`
        ).join(', ');

        const query = `
          INSERT INTO role_permissions (role_id, permission_id, granted_by)
          VALUES ${values}
        `;

        const params = [roleId, ...permissionIds, grantedBy || null];
        await client.query(query, params);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error assigning permissions to role:', error);
      throw new Error('Failed to assign permissions to role');
    } finally {
      client.release();
    }
  }

  /**
   * Assign direct permissions to a user
   */
  async assignPermissionsToUser(
    userId: number,
    assignments: PermissionAssignment[],
    grantedBy?: number
  ): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Remove existing direct permissions
      await client.query(
        'DELETE FROM user_permissions WHERE user_id = $1',
        [userId]
      );

      // Add new permissions
      for (const assignment of assignments) {
        await client.query(
          `INSERT INTO user_permissions 
           (user_id, permission_id, granted, granted_by, reason, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            userId,
            assignment.permissionId,
            assignment.granted ?? true,
            grantedBy || null,
            assignment.reason || null,
            assignment.expiresAt || null
          ]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error assigning permissions to user:', error);
      throw new Error('Failed to assign permissions to user');
    } finally {
      client.release();
    }
  }

  /**
   * Check if user has a specific permission
   */
  async userHasPermission(
    userId: number,
    resource: string,
    action: string,
    scope: string = 'all'
  ): Promise<boolean> {
    try {
      const query = `SELECT user_has_permission($1, $2, $3, $4) as has_permission`;
      const result = await this.pool.query(query, [userId, resource, action, scope]);
      return result.rows[0]?.has_permission || false;
    } catch (error) {
      console.error('Error checking user permission:', error);
      return false;
    }
  }

  /**
   * Get permission matrix for all roles
   */
  async getPermissionMatrix(): Promise<any> {
    try {
      const query = `
        SELECT 
          r.id as role_id,
          r.name as role_name,
          r.display_name as role_display_name,
          r.priority,
          pg.name as permission_group,
          pg.display_name as group_display_name,
          json_agg(
            json_build_object(
              'id', p.id,
              'name', CONCAT(p.resource, '.', p.action, 
                CASE WHEN p.scope != 'all' 
                  THEN CONCAT('.', p.scope) 
                  ELSE '' 
                END),
              'resource', p.resource,
              'action', p.action,
              'scope', p.scope,
              'display_name', p.display_name,
              'has_permission', CASE WHEN rp.role_id IS NOT NULL THEN true ELSE false END
            ) ORDER BY p.resource, p.action
          ) as permissions
        FROM roles r
        CROSS JOIN permission_groups pg
        LEFT JOIN permissions p ON p.group_id = pg.id AND COALESCE(p.is_active, true) = true
        LEFT JOIN role_permissions rp ON r.id = rp.role_id AND p.id = rp.permission_id
        WHERE r.is_active = true AND pg.is_active = true
        GROUP BY r.id, r.name, r.display_name, r.priority, pg.name, pg.display_name, pg.sort_order
        ORDER BY r.priority DESC, pg.sort_order
      `;

      const result = await this.pool.query(query);
      
      // Transform data into matrix format
      const matrix: any = {
        roles: [],
        groups: [],
        data: {}
      };

      const rolesMap = new Map();
      const groupsMap = new Map();

      result.rows.forEach(row => {
        // Add role if not exists
        if (!rolesMap.has(row.role_id)) {
          rolesMap.set(row.role_id, {
            id: row.role_id,
            name: row.role_name,
            display_name: row.role_display_name,
            priority: row.priority
          });
        }

        // Add group if not exists
        if (!groupsMap.has(row.permission_group)) {
          groupsMap.set(row.permission_group, {
            name: row.permission_group,
            display_name: row.group_display_name,
            permissions: []
          });
        }

        // Add permissions to matrix
        if (!matrix.data[row.role_id]) {
          matrix.data[row.role_id] = {};
        }

        matrix.data[row.role_id][row.permission_group] = row.permissions;

        // Collect unique permissions for the group
        const group = groupsMap.get(row.permission_group);
        row.permissions.forEach((perm: any) => {
          if (!group.permissions.find((p: any) => p.id === perm.id)) {
            group.permissions.push({
              id: perm.id,
              name: perm.name,
              display_name: perm.display_name,
              resource: perm.resource,
              action: perm.action,
              scope: perm.scope
            });
          }
        });
      });

      matrix.roles = Array.from(rolesMap.values());
      matrix.groups = Array.from(groupsMap.values());

      return matrix;
    } catch (error) {
      console.error('Error getting permission matrix:', error);
      throw new Error('Failed to fetch permission matrix');
    }
  }

  /**
   * Create a new permission
   */
  async createPermission(permission: Partial<Permission>): Promise<Permission> {
    try {
      const query = `
        INSERT INTO permissions (resource, action, scope, display_name, description, group_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const result = await this.pool.query(query, [
        permission.resource,
        permission.action,
        permission.scope || 'all',
        permission.display_name,
        permission.description,
        permission.group_id || null
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Error creating permission:', error);
      throw new Error('Failed to create permission');
    }
  }

  /**
   * Update a permission
   */
  async updatePermission(id: string, updates: Partial<Permission>): Promise<Permission> {
    try {
      const query = `
        UPDATE permissions
        SET display_name = COALESCE($2, display_name),
            description = COALESCE($3, description),
            group_id = COALESCE($4, group_id)
        WHERE id = $1 AND is_system = false
        RETURNING *
      `;

      const result = await this.pool.query(query, [
        id,
        updates.display_name,
        updates.description,
        updates.group_id
      ]);

      if (result.rows.length === 0) {
        throw new Error('Permission not found or is a system permission');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error updating permission:', error);
      throw new Error('Failed to update permission');
    }
  }

  /**
   * Delete a permission
   */
  async deletePermission(id: string): Promise<void> {
    try {
      const result = await this.pool.query(
        'DELETE FROM permissions WHERE id = $1 AND is_system = false',
        [id]
      );

      if (result.rowCount === 0) {
        throw new Error('Permission not found or is a system permission');
      }
    } catch (error) {
      console.error('Error deleting permission:', error);
      throw new Error('Failed to delete permission');
    }
  }
}

export default new PermissionService();