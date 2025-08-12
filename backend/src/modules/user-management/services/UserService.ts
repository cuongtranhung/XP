import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { query, transaction, setCurrentUser } from '../config/database';
import {
  User,
  CreateUserDTO,
  UpdateUserDTO,
  UserFilter,
  PaginationParams,
  ServiceResponse,
  PaginatedResponse,
  UserRole,
  UserGroupMember
} from '../types';
import { AuditService } from './AuditService';
import { cachedRepositories } from '../../../services/cachedRepositoryService';

export class UserService {
  private auditService: AuditService;

  constructor() {
    this.auditService = new AuditService();
  }

  /**
   * Create a new user
   */
  async createUser(
    data: CreateUserDTO,
    createdBy?: string
  ): Promise<ServiceResponse<User>> {
    try {
      // Validate email uniqueness
      const existingUser = await query(
        'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
        [data.email]
      );

      if (existingUser.rows.length > 0) {
        return {
          success: false,
          error: 'User with this email already exists'
        };
      }

      // Hash password
      const passwordHash = await bcrypt.hash(data.password, 10);

      const user = await transaction(async (client) => {
        // Create user with simplified fields
        const userResult = await client.query(
          `INSERT INTO users (
            id, email, username, password_hash, full_name,
            phone_number, department, position,
            status, is_approved, is_blocked,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
          ) RETURNING *`,
          [
            uuidv4(),
            data.email,
            data.username || null,
            passwordHash,
            data.full_name || null,
            data.phone_number || null,
            data.department || null,
            data.position || null,
            'active',
            data.is_approved !== false, // Default true
            data.is_blocked === true    // Default false
          ]
        );

        const newUser = userResult.rows[0];

        // Assign default role if no roles specified
        const rolesToAssign = data.roles && data.roles.length > 0 
          ? data.roles 
          : ['user'];

        // Assign roles
        for (const roleName of rolesToAssign) {
          const roleResult = await client.query(
            'SELECT id FROM roles WHERE name = $1',
            [roleName]
          );

          if (roleResult.rows.length > 0) {
            await client.query(
              `INSERT INTO user_roles (user_id, role_id, assigned_by, assigned_at)
               VALUES ($1, $2, $3, NOW())`,
              [newUser.id, roleResult.rows[0].id, createdBy]
            );
          }
        }

        // Add to groups if specified
        if (data.groups && data.groups.length > 0) {
          for (const groupId of data.groups) {
            await client.query(
              `INSERT INTO user_group_members (user_id, group_id, role_in_group, joined_at, added_by)
               VALUES ($1, $2, 'member', NOW(), $3)`,
              [newUser.id, groupId, createdBy]
            );
          }
        }

        // Log audit
        await this.auditService.logAction({
          user_id: createdBy,
          action: 'CREATE_USER',
          entity_type: 'user',
          entity_id: newUser.id,
          new_values: { 
            email: data.email, 
            is_approved: newUser.is_approved,
            is_blocked: newUser.is_blocked 
          }
        });

        return newUser;
      });

      return {
        success: true,
        data: user,
        message: 'User created successfully'
      };
    } catch (error: any) {
      console.error('Error creating user:', error);
      return {
        success: false,
        error: error.message || 'Failed to create user'
      };
    }
  }

  /**
   * Toggle user approval status (Enable/Disable)
   */
  async toggleUserApproval(
    userId: string,
    approve: boolean,
    updatedBy?: string
  ): Promise<ServiceResponse<User>> {
    try {
      const result = await transaction(async (client) => {
        const updateResult = await client.query(
          `UPDATE users SET 
            is_approved = $1,
            updated_at = NOW()
           WHERE id = $2 AND deleted_at IS NULL
           RETURNING *`,
          [approve, userId]
        );

        if (updateResult.rows.length === 0) {
          throw new Error('User not found');
        }

        // Log audit
        await this.auditService.logAction({
          user_id: updatedBy,
          action: approve ? 'APPROVE_USER' : 'DISAPPROVE_USER',
          entity_type: 'user',
          entity_id: userId,
          new_values: { is_approved: approve }
        });

        return updateResult.rows[0];
      });

      return {
        success: true,
        data: result,
        message: `User ${approve ? 'approved' : 'disapproved'} successfully`
      };
    } catch (error: any) {
      console.error('Error toggling user approval:', error);
      return {
        success: false,
        error: error.message || 'Failed to toggle user approval'
      };
    }
  }

  /**
   * Toggle user block status (Enable/Disable)
   */
  async toggleUserBlock(
    userId: string,
    block: boolean,
    updatedBy?: string
  ): Promise<ServiceResponse<User>> {
    try {
      const result = await transaction(async (client) => {
        const updateResult = await client.query(
          `UPDATE users SET 
            is_blocked = $1,
            status = $2,
            updated_at = NOW()
           WHERE id = $3 AND deleted_at IS NULL
           RETURNING *`,
          [
            block,
            block ? 'suspended' : 'active',
            userId
          ]
        );

        if (updateResult.rows.length === 0) {
          throw new Error('User not found');
        }

        // Log audit
        await this.auditService.logAction({
          user_id: updatedBy,
          action: block ? 'BLOCK_USER' : 'UNBLOCK_USER',
          entity_type: 'user',
          entity_id: userId,
          new_values: { is_blocked: block }
        });

        return updateResult.rows[0];
      });

      return {
        success: true,
        data: result,
        message: `User ${block ? 'blocked' : 'unblocked'} successfully`
      };
    } catch (error: any) {
      console.error('Error toggling user block:', error);
      return {
        success: false,
        error: error.message || 'Failed to toggle user block'
      };
    }
  }

  /**
   * Get user by ID with caching
   */
  async getUserById(
    userId: string,
    requesterId?: string
  ): Promise<ServiceResponse<User>> {
    try {
      if (requesterId) {
        await setCurrentUser(requesterId);
      }

      // Use cached repository for user lookup
      const user = await cachedRepositories.users.getById<User>(
        userId,
        async () => {
          const result = await query(
            `SELECT * FROM user_details_view WHERE id = $1`,
            [userId]
          );
          return result.rows.length > 0 ? result.rows[0] : null;
        }
      );

      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      return {
        success: true,
        data: user
      };
    } catch (error: any) {
      console.error('Error fetching user:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch user'
      };
    }
  }

  /**
   * Update user
   */
  async updateUser(
    userId: string,
    data: UpdateUserDTO,
    updatedBy?: string
  ): Promise<ServiceResponse<User>> {
    try {
      const oldUser = await this.getUserById(userId);
      if (!oldUser.success || !oldUser.data) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      // Build dynamic update query
      if (data.email !== undefined) {
        updates.push(`email = $${paramCount++}`);
        values.push(data.email);
      }
      if (data.username !== undefined) {
        updates.push(`username = $${paramCount++}`);
        values.push(data.username);
      }
      if (data.full_name !== undefined) {
        updates.push(`full_name = $${paramCount++}`);
        values.push(data.full_name);
      }
      if (data.phone_number !== undefined) {
        updates.push(`phone_number = $${paramCount++}`);
        values.push(data.phone_number);
      }
      if (data.department !== undefined) {
        updates.push(`department = $${paramCount++}`);
        values.push(data.department);
      }
      if (data.position !== undefined) {
        updates.push(`position = $${paramCount++}`);
        values.push(data.position);
      }
      if (data.avatar_url !== undefined) {
        updates.push(`avatar_url = $${paramCount++}`);
        values.push(data.avatar_url);
      }
      if (data.status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        values.push(data.status);
      }
      if (data.is_approved !== undefined) {
        updates.push(`is_approved = $${paramCount++}`);
        values.push(data.is_approved);
      }
      if (data.is_blocked !== undefined) {
        updates.push(`is_blocked = $${paramCount++}`);
        values.push(data.is_blocked);
      }

      if (updates.length === 0) {
        return {
          success: false,
          error: 'No fields to update'
        };
      }

      updates.push(`updated_at = NOW()`);
      values.push(userId);

      const result = await transaction(async (client) => {
        const updateResult = await client.query(
          `UPDATE users SET ${updates.join(', ')} 
           WHERE id = $${paramCount} AND deleted_at IS NULL
           RETURNING *`,
          values
        );

        if (updateResult.rows.length === 0) {
          throw new Error('User not found or update failed');
        }

        // Log audit
        await this.auditService.logAction({
          user_id: updatedBy,
          action: 'UPDATE_USER',
          entity_type: 'user',
          entity_id: userId,
          old_values: oldUser.data,
          new_values: data
        });

        // Invalidate user cache after update
        await cachedRepositories.users.invalidate(userId);

        return updateResult.rows[0];
      });

      return {
        success: true,
        data: result,
        message: 'User updated successfully'
      };
    } catch (error: any) {
      console.error('Error updating user:', error);
      return {
        success: false,
        error: error.message || 'Failed to update user'
      };
    }
  }

  /**
   * List users with filters and pagination
   */
  async listUsers(
    filters: UserFilter = {},
    pagination: PaginationParams = {},
    requesterId?: string
  ): Promise<ServiceResponse<PaginatedResponse<User>>> {
    try {
      if (requesterId) {
        await setCurrentUser(requesterId);
      }

      const page = pagination.page || 1;
      const limit = pagination.limit || 10;
      const offset = (page - 1) * limit;
      const sortBy = pagination.sort_by || 'created_at';
      const sortOrder = pagination.sort_order || 'desc';

      let whereConditions: string[] = ['deleted_at IS NULL'];
      let params: any[] = [];
      let paramCount = 1;

      // Build filter conditions
      if (filters.status && filters.status.length > 0) {
        whereConditions.push(`status = ANY($${paramCount++})`);
        params.push(filters.status);
      }
      if (filters.department) {
        whereConditions.push(`department = $${paramCount++}`);
        params.push(filters.department);
      }
      if (filters.is_blocked !== undefined) {
        whereConditions.push(`is_blocked = $${paramCount++}`);
        params.push(filters.is_blocked);
      }
      if (filters.is_approved !== undefined) {
        whereConditions.push(`is_approved = $${paramCount++}`);
        params.push(filters.is_approved);
      }
      if (filters.search) {
        whereConditions.push(
          `(email ILIKE $${paramCount} OR username ILIKE $${paramCount} OR full_name ILIKE $${paramCount})`
        );
        params.push(`%${filters.search}%`);
        paramCount++;
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : '';

      // Create cache key for this query
      const queryKey = JSON.stringify({ filters, pagination, whereClause });
      const cacheKeyHash = Buffer.from(queryKey).toString('base64').substring(0, 16);

      // Try to get list from cache
      const cachedResult = await cachedRepositories.users.cacheQuery(
        'list',
        { filters, pagination, hash: cacheKeyHash },
        async () => {
          // Get total count
          const countResult = await query(
            `SELECT COUNT(*) FROM users ${whereClause}`,
            params
          );
          const total = parseInt(countResult.rows[0].count);

          // Get paginated results
          params.push(limit, offset);
          const result = await query(
            `SELECT * FROM user_details_view 
             ${whereClause}
             ORDER BY ${sortBy} ${sortOrder}
             LIMIT $${paramCount++} OFFSET $${paramCount}`,
            params
          );

          return {
            items: result.rows,
            total,
            page,
            limit,
            total_pages: Math.ceil(total / limit)
          };
        },
        300 // 5 minutes cache for lists
      );

      return {
        success: true,
        data: cachedResult
      };
    } catch (error: any) {
      console.error('Error listing users:', error);
      return {
        success: false,
        error: error.message || 'Failed to list users'
      };
    }
  }

  /**
   * Get user statistics
   */
  async getUserStatistics(): Promise<ServiceResponse<any>> {
    try {
      const stats = await query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(*) FILTER (WHERE status = 'active') as active_users,
          COUNT(*) FILTER (WHERE is_blocked = true) as blocked_users,
          COUNT(*) FILTER (WHERE is_approved = false) as unapproved_users,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as recent_registrations
        FROM users
        WHERE deleted_at IS NULL
      `);

      const byDepartment = await query(`
        SELECT department, COUNT(*) as count
        FROM users
        WHERE deleted_at IS NULL AND department IS NOT NULL
        GROUP BY department
      `);

      const byRole = await query(`
        SELECT r.display_name, COUNT(DISTINCT ur.user_id) as count
        FROM roles r
        LEFT JOIN user_roles ur ON r.id = ur.role_id
        GROUP BY r.id, r.display_name
      `);

      return {
        success: true,
        data: {
          ...stats.rows[0],
          users_by_department: byDepartment.rows.reduce((acc, row) => {
            acc[row.department] = parseInt(row.count);
            return acc;
          }, {}),
          users_by_role: byRole.rows.reduce((acc, row) => {
            acc[row.display_name] = parseInt(row.count);
            return acc;
          }, {})
        }
      };
    } catch (error: any) {
      console.error('Error fetching user statistics:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch user statistics'
      };
    }
  }

  /**
   * Delete user (soft delete)
   */
  async deleteUser(
    userId: string,
    deletedBy?: string
  ): Promise<ServiceResponse<void>> {
    try {
      await transaction(async (client) => {
        const result = await client.query(
          `UPDATE users SET 
            deleted_at = NOW(),
            status = 'inactive',
            updated_at = NOW()
           WHERE id = $1 AND deleted_at IS NULL`,
          [userId]
        );

        if (result.rowCount === 0) {
          throw new Error('User not found');
        }

        // Log audit
        await this.auditService.logAction({
          user_id: deletedBy,
          action: 'DELETE_USER',
          entity_type: 'user',
          entity_id: userId,
          new_values: { deleted: true }
        });
      });

      return {
        success: true,
        message: 'User deleted successfully'
      };
    } catch (error: any) {
      console.error('Error deleting user:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete user'
      };
    }
  }
}