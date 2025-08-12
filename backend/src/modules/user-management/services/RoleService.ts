import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../config/database';
import {
  Role,
  UserRole,
  AssignRoleDTO,
  ServiceResponse,
  PaginatedResponse,
  PaginationParams
} from '../types';
import { AuditService } from './AuditService';

export class RoleService {
  private auditService: AuditService;

  constructor() {
    this.auditService = new AuditService();
  }

  /**
   * Get all roles
   */
  async getAllRoles(): Promise<ServiceResponse<Role[]>> {
    try {
      const result = await query(
        `SELECT * FROM roles 
         WHERE is_active = true 
         ORDER BY priority ASC, name ASC`
      );

      return {
        success: true,
        data: result.rows
      };
    } catch (error: any) {
      console.error('Error fetching roles:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch roles'
      };
    }
  }

  /**
   * Create a new role
   */
  async createRole(
    roleData: Partial<Role>,
    createdBy?: string
  ): Promise<ServiceResponse<Role>> {
    try {
      // Check if role name already exists
      const existing = await query(
        'SELECT id FROM roles WHERE name = $1',
        [roleData.name]
      );

      if (existing.rows.length > 0) {
        return {
          success: false,
          error: 'Role with this name already exists'
        };
      }

      const result = await transaction(async (client) => {
        const roleResult = await client.query(
          `INSERT INTO roles (
            id, name, display_name, description,
            priority, is_system, is_active,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
          ) RETURNING *`,
          [
            uuidv4(),
            roleData.name,
            roleData.display_name || roleData.name,
            roleData.description || null,
            roleData.priority || 100,
            false, // User-created roles are not system roles
            true
          ]
        );

        const newRole = roleResult.rows[0];

        // Log audit
        await this.auditService.logAction({
          user_id: createdBy,
          action: 'CREATE_ROLE',
          entity_type: 'role',
          entity_id: newRole.id,
          new_values: newRole
        });

        return newRole;
      });

      return {
        success: true,
        data: result,
        message: 'Role created successfully'
      };
    } catch (error: any) {
      console.error('Error creating role:', error);
      return {
        success: false,
        error: error.message || 'Failed to create role'
      };
    }
  }

  /**
   * Update a role
   */
  async updateRole(
    roleId: string,
    updates: Partial<Role>,
    updatedBy?: string
  ): Promise<ServiceResponse<Role>> {
    try {
      // Prevent updating system roles
      const roleCheck = await query(
        'SELECT is_system FROM roles WHERE id = $1',
        [roleId]
      );

      if (roleCheck.rows.length === 0) {
        return {
          success: false,
          error: 'Role not found'
        };
      }

      if (roleCheck.rows[0].is_system) {
        return {
          success: false,
          error: 'System roles cannot be modified'
        };
      }

      const result = await transaction(async (client) => {
        const updateResult = await client.query(
          `UPDATE roles SET
            display_name = COALESCE($1, display_name),
            description = COALESCE($2, description),
            priority = COALESCE($3, priority),
            is_active = COALESCE($4, is_active),
            updated_at = NOW()
           WHERE id = $5 AND is_system = false
           RETURNING *`,
          [
            updates.display_name,
            updates.description,
            updates.priority,
            updates.is_active,
            roleId
          ]
        );

        if (updateResult.rows.length === 0) {
          throw new Error('Role not found or is a system role');
        }

        // Log audit
        await this.auditService.logAction({
          user_id: updatedBy,
          action: 'UPDATE_ROLE',
          entity_type: 'role',
          entity_id: roleId,
          new_values: updates
        });

        return updateResult.rows[0];
      });

      return {
        success: true,
        data: result,
        message: 'Role updated successfully'
      };
    } catch (error: any) {
      console.error('Error updating role:', error);
      return {
        success: false,
        error: error.message || 'Failed to update role'
      };
    }
  }

  /**
   * Delete a role
   */
  async deleteRole(
    roleId: string,
    deletedBy?: string
  ): Promise<ServiceResponse<void>> {
    try {
      // Prevent deleting system roles
      const roleCheck = await query(
        'SELECT is_system, name FROM roles WHERE id = $1',
        [roleId]
      );

      if (roleCheck.rows.length === 0) {
        return {
          success: false,
          error: 'Role not found'
        };
      }

      if (roleCheck.rows[0].is_system) {
        return {
          success: false,
          error: 'System roles cannot be deleted'
        };
      }

      await transaction(async (client) => {
        // Remove all user assignments first
        await client.query(
          'DELETE FROM user_roles WHERE role_id = $1',
          [roleId]
        );

        // Delete the role
        await client.query(
          'DELETE FROM roles WHERE id = $1 AND is_system = false',
          [roleId]
        );

        // Log audit
        await this.auditService.logAction({
          user_id: deletedBy,
          action: 'DELETE_ROLE',
          entity_type: 'role',
          entity_id: roleId,
          old_values: { name: roleCheck.rows[0].name }
        });
      });

      return {
        success: true,
        message: 'Role deleted successfully'
      };
    } catch (error: any) {
      console.error('Error deleting role:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete role'
      };
    }
  }

  /**
   * Get user's roles
   */
  async getUserRoles(userId: string): Promise<ServiceResponse<Role[]>> {
    try {
      const result = await query(
        `SELECT r.*, ur.assigned_at, ur.expires_at, ur.assigned_by,
                u.full_name as assigned_by_name
         FROM user_roles ur
         JOIN roles r ON ur.role_id = r.id
         LEFT JOIN users u ON ur.assigned_by = u.id
         WHERE ur.user_id = $1
         AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
         ORDER BY r.priority ASC`,
        [userId]
      );

      return {
        success: true,
        data: result.rows
      };
    } catch (error: any) {
      console.error('Error fetching user roles:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch user roles'
      };
    }
  }

  /**
   * Assign role to user
   */
  async assignRoleToUser(
    data: AssignRoleDTO,
    assignedBy?: string
  ): Promise<ServiceResponse<UserRole>> {
    try {
      // Check if role exists
      const roleCheck = await query(
        'SELECT name FROM roles WHERE id = $1',
        [data.role_id]
      );

      if (roleCheck.rows.length === 0) {
        return {
          success: false,
          error: 'Role not found'
        };
      }

      // Check if user exists
      const userCheck = await query(
        'SELECT email FROM users WHERE id = $1',
        [data.user_id]
      );

      if (userCheck.rows.length === 0) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      const result = await transaction(async (client) => {
        // Check if already assigned
        const existing = await client.query(
          'SELECT * FROM user_roles WHERE user_id = $1 AND role_id = $2',
          [data.user_id, data.role_id]
        );

        if (existing.rows.length > 0) {
          // Update expiration if provided
          if (data.expires_at) {
            await client.query(
              'UPDATE user_roles SET expires_at = $1 WHERE user_id = $2 AND role_id = $3',
              [data.expires_at, data.user_id, data.role_id]
            );
          }
          return existing.rows[0];
        }

        // Assign new role
        const assignResult = await client.query(
          `INSERT INTO user_roles (user_id, role_id, assigned_by, assigned_at, expires_at)
           VALUES ($1, $2, $3, NOW(), $4)
           RETURNING *`,
          [data.user_id, data.role_id, assignedBy, data.expires_at || null]
        );

        // Log audit
        await this.auditService.logAction({
          user_id: assignedBy,
          action: 'ASSIGN_ROLE',
          entity_type: 'user',
          entity_id: data.user_id,
          new_values: {
            role_id: data.role_id,
            role_name: roleCheck.rows[0].name
          }
        });

        return assignResult.rows[0];
      });

      return {
        success: true,
        data: result,
        message: 'Role assigned successfully'
      };
    } catch (error: any) {
      console.error('Error assigning role:', error);
      return {
        success: false,
        error: error.message || 'Failed to assign role'
      };
    }
  }

  /**
   * Remove role from user
   */
  async removeRoleFromUser(
    userId: string,
    roleId: string,
    removedBy?: string
  ): Promise<ServiceResponse<void>> {
    try {
      const result = await transaction(async (client) => {
        // Get role info for audit
        const roleInfo = await client.query(
          'SELECT name FROM roles WHERE id = $1',
          [roleId]
        );

        // Remove assignment
        const deleteResult = await client.query(
          'DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2',
          [userId, roleId]
        );

        if (deleteResult.rowCount === 0) {
          throw new Error('User role assignment not found');
        }

        // Log audit
        await this.auditService.logAction({
          user_id: removedBy,
          action: 'REMOVE_ROLE',
          entity_type: 'user',
          entity_id: userId,
          old_values: {
            role_id: roleId,
            role_name: roleInfo.rows[0]?.name
          }
        });
      });

      return {
        success: true,
        message: 'Role removed successfully'
      };
    } catch (error: any) {
      console.error('Error removing role:', error);
      return {
        success: false,
        error: error.message || 'Failed to remove role'
      };
    }
  }

  /**
   * Update user's role (for changing expiration or other properties)
   */
  async updateUserRole(
    userId: string,
    roleId: string,
    updates: { expires_at?: Date },
    updatedBy?: string
  ): Promise<ServiceResponse<UserRole>> {
    try {
      const result = await transaction(async (client) => {
        const updateResult = await client.query(
          `UPDATE user_roles SET
            expires_at = $1
           WHERE user_id = $2 AND role_id = $3
           RETURNING *`,
          [updates.expires_at || null, userId, roleId]
        );

        if (updateResult.rows.length === 0) {
          throw new Error('User role assignment not found');
        }

        // Log audit
        await this.auditService.logAction({
          user_id: updatedBy,
          action: 'UPDATE_USER_ROLE',
          entity_type: 'user',
          entity_id: userId,
          new_values: {
            role_id: roleId,
            expires_at: updates.expires_at
          }
        });

        return updateResult.rows[0];
      });

      return {
        success: true,
        data: result,
        message: 'User role updated successfully'
      };
    } catch (error: any) {
      console.error('Error updating user role:', error);
      return {
        success: false,
        error: error.message || 'Failed to update user role'
      };
    }
  }

  /**
   * Get users by role
   */
  async getUsersByRole(
    roleId: string,
    pagination: PaginationParams = {}
  ): Promise<ServiceResponse<PaginatedResponse<any>>> {
    try {
      const page = pagination.page || 1;
      const limit = pagination.limit || 10;
      const offset = (page - 1) * limit;

      // Get total count
      const countResult = await query(
        `SELECT COUNT(DISTINCT ur.user_id)
         FROM user_roles ur
         JOIN users u ON ur.user_id = u.id
         WHERE ur.role_id = $1
         AND u.deleted_at IS NULL
         AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`,
        [roleId]
      );
      const total = parseInt(countResult.rows[0].count);

      // Get paginated users
      const result = await query(
        `SELECT u.id, u.email, u.full_name, u.department, u.status,
                ur.assigned_at, ur.expires_at
         FROM user_roles ur
         JOIN users u ON ur.user_id = u.id
         WHERE ur.role_id = $1
         AND u.deleted_at IS NULL
         AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
         ORDER BY ur.assigned_at DESC
         LIMIT $2 OFFSET $3`,
        [roleId, limit, offset]
      );

      return {
        success: true,
        data: {
          items: result.rows,
          total,
          page,
          limit,
          total_pages: Math.ceil(total / limit)
        }
      };
    } catch (error: any) {
      console.error('Error fetching users by role:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch users by role'
      };
    }
  }
}