import { v4 as uuidv4 } from 'uuid';
// Use shared pool instead of module-specific
import { pool } from '../../../utils/database';
import {
  UserGroup,
  UserGroupMember,
  AddUserToGroupDTO,
  ServiceResponse,
  PaginatedResponse,
  PaginationParams
} from '../types';
import { AuditService } from './AuditService';

// Helper function to execute queries with shared pool
async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries
    if (duration > 100) {
      console.log('Slow query detected:', {
        query: text,
        duration,
        rows: res.rowCount
      });
    }
    
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Transaction helper using shared pool
async function transaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Simple in-memory cache
interface CacheEntry {
  data: any;
  timestamp: number;
}

const groupsCache: Map<string, CacheEntry> = new Map();
const CACHE_TTL = 60000; // 60 seconds

export class GroupService {
  private auditService: AuditService;

  constructor() {
    this.auditService = new AuditService();
  }

  private getCacheKey(filters: any): string {
    return JSON.stringify(filters || {});
  }

  private getFromCache(key: string): any | null {
    const entry = groupsCache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
      console.log('Cache hit for groups');
      return entry.data;
    }
    if (entry) {
      groupsCache.delete(key);
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    groupsCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Test database connection
   */
  async testDatabaseConnection(): Promise<any> {
    try {
      // Simple query without any parameters
      const result = await query('SELECT COUNT(*) as count FROM user_groups');
      return {
        success: true,
        message: 'Database connection successful',
        groupCount: result.rows[0].count
      };
    } catch (error: any) {
      console.error('Database test error:', error);
      return {
        success: false,
        error: error.message || 'Database connection failed'
      };
    }
  }

  /**
   * Get all groups
   */
  async getAllGroups(
    filters: { group_type?: string; is_active?: boolean; search?: string } = {}
  ): Promise<ServiceResponse<UserGroup[]>> {
    try {
      // Check cache first
      const cacheKey = this.getCacheKey(filters);
      const cachedData = this.getFromCache(cacheKey);
      if (cachedData) {
        return {
          success: true,
          data: cachedData
        };
      }

      let whereConditions: string[] = [];
      let params: any[] = [];
      let paramCount = 1;

      if (filters.group_type) {
        whereConditions.push(`group_type = $${paramCount++}`);
        params.push(filters.group_type);
      }
      if (filters.is_active !== undefined) {
        whereConditions.push(`is_active = $${paramCount++}`);
        params.push(filters.is_active);
      }
      if (filters.search) {
        whereConditions.push(`(name ILIKE $${paramCount} OR display_name ILIKE $${paramCount++})`);
        params.push(`%${filters.search}%`);
      }

      const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      console.log('Executing groups query with shared pool...');
      const result = await query(
        `SELECT * FROM user_groups_summary 
         ${whereClause}
         ORDER BY name ASC`,
        params
      );

      // Cache the result
      this.setCache(cacheKey, result.rows);

      return {
        success: true,
        data: result.rows
      };
    } catch (error: any) {
      console.error('Error fetching groups:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch groups'
      };
    }
  }

  /**
   * Create a new group
   */
  async createGroup(
    groupData: Partial<UserGroup>,
    createdBy?: string
  ): Promise<ServiceResponse<UserGroup>> {
    try {
      // Check if group name already exists
      const existing = await query(
        'SELECT id FROM user_groups WHERE name = $1',
        [groupData.name]
      );

      if (existing.rows.length > 0) {
        return {
          success: false,
          error: 'Group with this name already exists'
        };
      }

      const result = await transaction(async (client) => {
        const groupResult = await client.query(
          `INSERT INTO user_groups (
            id, name, display_name, description,
            group_type, parent_group_id, settings,
            is_active, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
          ) RETURNING *`,
          [
            uuidv4(),
            groupData.name,
            groupData.display_name || groupData.name,
            groupData.description || null,
            groupData.group_type || 'custom',
            groupData.parent_group_id || null,
            groupData.metadata ? JSON.stringify(groupData.metadata) : '{}',
            true
          ]
        );

        const newGroup = groupResult.rows[0];

        // Log audit
        await this.auditService.logAction({
          user_id: createdBy,
          action: 'CREATE_GROUP',
          entity_type: 'group',
          entity_id: newGroup.id,
          new_values: newGroup
        });

        return newGroup;
      });

      return {
        success: true,
        data: result,
        message: 'Group created successfully'
      };
    } catch (error: any) {
      console.error('Error creating group:', error);
      return {
        success: false,
        error: error.message || 'Failed to create group'
      };
    }
  }

  /**
   * Update a group
   */
  async updateGroup(
    groupId: string,
    updates: Partial<UserGroup>,
    updatedBy?: string
  ): Promise<ServiceResponse<UserGroup>> {
    try {
      const result = await transaction(async (client) => {
        const updateResult = await client.query(
          `UPDATE user_groups SET
            display_name = COALESCE($1, display_name),
            description = COALESCE($2, description),
            group_type = COALESCE($3, group_type),
            parent_group_id = COALESCE($4, parent_group_id),
            settings = COALESCE($5, settings),
            is_active = COALESCE($6, is_active),
            updated_at = NOW()
           WHERE id = $7
           RETURNING *`,
          [
            updates.display_name,
            updates.description,
            updates.group_type,
            updates.parent_group_id,
            updates.metadata ? JSON.stringify(updates.metadata) : undefined,
            updates.is_active,
            groupId
          ]
        );

        if (updateResult.rows.length === 0) {
          throw new Error('Group not found');
        }

        // Log audit
        await this.auditService.logAction({
          user_id: updatedBy,
          action: 'UPDATE_GROUP',
          entity_type: 'group',
          entity_id: groupId,
          new_values: updates
        });

        return updateResult.rows[0];
      });

      return {
        success: true,
        data: result,
        message: 'Group updated successfully'
      };
    } catch (error: any) {
      console.error('Error updating group:', error);
      return {
        success: false,
        error: error.message || 'Failed to update group'
      };
    }
  }

  /**
   * Delete a group
   */
  async deleteGroup(
    groupId: string,
    deletedBy?: string
  ): Promise<ServiceResponse<void>> {
    try {
      await transaction(async (client) => {
        // Get group info for audit
        const groupInfo = await client.query(
          'SELECT name FROM user_groups WHERE id = $1',
          [groupId]
        );

        if (groupInfo.rows.length === 0) {
          throw new Error('Group not found');
        }

        // Remove all members first
        await client.query(
          'DELETE FROM user_group_members WHERE group_id = $1',
          [groupId]
        );

        // Delete the group
        await client.query(
          'DELETE FROM user_groups WHERE id = $1',
          [groupId]
        );

        // Log audit
        await this.auditService.logAction({
          user_id: deletedBy,
          action: 'DELETE_GROUP',
          entity_type: 'group',
          entity_id: groupId,
          old_values: { name: groupInfo.rows[0].name }
        });
      });

      return {
        success: true,
        message: 'Group deleted successfully'
      };
    } catch (error: any) {
      console.error('Error deleting group:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete group'
      };
    }
  }

  /**
   * Get user's groups
   */
  async getUserGroups(userId: string): Promise<ServiceResponse<UserGroup[]>> {
    try {
      const result = await query(
        `SELECT g.*, ugm.role_in_group, ugm.joined_at, ugm.added_by,
                u.full_name as added_by_name
         FROM user_group_members ugm
         JOIN user_groups g ON ugm.group_id = g.id
         LEFT JOIN users u ON ugm.added_by = u.id
         WHERE ugm.user_id = $1
         AND g.is_active = true
         ORDER BY g.name ASC`,
        [userId]
      );

      return {
        success: true,
        data: result.rows
      };
    } catch (error: any) {
      console.error('Error fetching user groups:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch user groups'
      };
    }
  }

  /**
   * Add user to group
   */
  async addUserToGroup(
    data: AddUserToGroupDTO,
    addedBy?: string
  ): Promise<ServiceResponse<UserGroupMember>> {
    try {
      // Check if group exists
      const groupCheck = await query(
        'SELECT name FROM user_groups WHERE id = $1 AND is_active = true',
        [data.group_id]
      );

      if (groupCheck.rows.length === 0) {
        return {
          success: false,
          error: 'Group not found or inactive'
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
        // Check if already a member
        const existing = await client.query(
          'SELECT * FROM user_group_members WHERE user_id = $1 AND group_id = $2',
          [data.user_id, data.group_id]
        );

        if (existing.rows.length > 0) {
          // Update role in group if different
          if (data.role_in_group && data.role_in_group !== existing.rows[0].role_in_group) {
            await client.query(
              'UPDATE user_group_members SET role_in_group = $1 WHERE user_id = $2 AND group_id = $3',
              [data.role_in_group, data.user_id, data.group_id]
            );
            existing.rows[0].role_in_group = data.role_in_group;
          }
          return existing.rows[0];
        }

        // Add new member
        const memberResult = await client.query(
          `INSERT INTO user_group_members (user_id, group_id, role_in_group, joined_at, added_by)
           VALUES ($1, $2, $3, NOW(), $4)
           RETURNING *`,
          [
            data.user_id,
            data.group_id,
            data.role_in_group || 'member',
            addedBy
          ]
        );

        // Log audit
        await this.auditService.logAction({
          user_id: addedBy,
          action: 'ADD_USER_TO_GROUP',
          entity_type: 'user',
          entity_id: data.user_id,
          new_values: {
            group_id: data.group_id,
            group_name: groupCheck.rows[0].name,
            role_in_group: data.role_in_group || 'member'
          }
        });

        return memberResult.rows[0];
      });

      return {
        success: true,
        data: result,
        message: 'User added to group successfully'
      };
    } catch (error: any) {
      console.error('Error adding user to group:', error);
      return {
        success: false,
        error: error.message || 'Failed to add user to group'
      };
    }
  }

  /**
   * Remove user from group
   */
  async removeUserFromGroup(
    userId: string,
    groupId: string,
    removedBy?: string
  ): Promise<ServiceResponse<void>> {
    try {
      const result = await transaction(async (client) => {
        // Get group info for audit
        const groupInfo = await client.query(
          'SELECT name FROM user_groups WHERE id = $1',
          [groupId]
        );

        // Remove member
        const deleteResult = await client.query(
          'DELETE FROM user_group_members WHERE user_id = $1 AND group_id = $2',
          [userId, groupId]
        );

        if (deleteResult.rowCount === 0) {
          throw new Error('User is not a member of this group');
        }

        // Log audit
        await this.auditService.logAction({
          user_id: removedBy,
          action: 'REMOVE_USER_FROM_GROUP',
          entity_type: 'user',
          entity_id: userId,
          old_values: {
            group_id: groupId,
            group_name: groupInfo.rows[0]?.name
          }
        });
      });

      return {
        success: true,
        message: 'User removed from group successfully'
      };
    } catch (error: any) {
      console.error('Error removing user from group:', error);
      return {
        success: false,
        error: error.message || 'Failed to remove user from group'
      };
    }
  }

  /**
   * Update user's role in group
   */
  async updateUserRoleInGroup(
    userId: string,
    groupId: string,
    roleInGroup: 'member' | 'manager' | 'owner',
    updatedBy?: string
  ): Promise<ServiceResponse<UserGroupMember>> {
    try {
      const result = await transaction(async (client) => {
        const updateResult = await client.query(
          `UPDATE user_group_members SET
            role_in_group = $1
           WHERE user_id = $2 AND group_id = $3
           RETURNING *`,
          [roleInGroup, userId, groupId]
        );

        if (updateResult.rows.length === 0) {
          throw new Error('User is not a member of this group');
        }

        // Log audit
        await this.auditService.logAction({
          user_id: updatedBy,
          action: 'UPDATE_USER_GROUP_ROLE',
          entity_type: 'user',
          entity_id: userId,
          new_values: {
            group_id: groupId,
            role_in_group: roleInGroup
          }
        });

        return updateResult.rows[0];
      });

      return {
        success: true,
        data: result,
        message: 'User role in group updated successfully'
      };
    } catch (error: any) {
      console.error('Error updating user role in group:', error);
      return {
        success: false,
        error: error.message || 'Failed to update user role in group'
      };
    }
  }

  /**
   * Get group members
   */
  async getGroupMembers(
    groupId: string,
    pagination: PaginationParams = {}
  ): Promise<ServiceResponse<PaginatedResponse<any>>> {
    try {
      const page = pagination.page || 1;
      const limit = pagination.limit || 10;
      const offset = (page - 1) * limit;

      // Get total count
      const countResult = await query(
        `SELECT COUNT(DISTINCT ugm.user_id)
         FROM user_group_members ugm
         JOIN users u ON ugm.user_id = u.id
         WHERE ugm.group_id = $1
         AND u.deleted_at IS NULL`,
        [groupId]
      );
      const total = parseInt(countResult.rows[0].count);

      // Get paginated members
      const result = await query(
        `SELECT u.id, u.email, u.full_name, u.department, u.status,
                u.is_approved, u.is_blocked,
                ugm.role_in_group, ugm.joined_at
         FROM user_group_members ugm
         JOIN users u ON ugm.user_id = u.id
         WHERE ugm.group_id = $1
         AND u.deleted_at IS NULL
         ORDER BY 
           CASE ugm.role_in_group 
             WHEN 'owner' THEN 1
             WHEN 'manager' THEN 2
             ELSE 3
           END,
           ugm.joined_at DESC
         LIMIT $2 OFFSET $3`,
        [groupId, limit, offset]
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
      console.error('Error fetching group members:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch group members'
      };
    }
  }

  /**
   * Get group hierarchy (for nested groups)
   */
  async getGroupHierarchy(
    groupId?: string
  ): Promise<ServiceResponse<any>> {
    try {
      const query_text = groupId
        ? `WITH RECURSIVE group_tree AS (
            SELECT *, 0 as level
            FROM user_groups
            WHERE id = $1
            
            UNION ALL
            
            SELECT g.*, gt.level + 1
            FROM user_groups g
            JOIN group_tree gt ON g.parent_group_id = gt.id
          )
          SELECT * FROM group_tree ORDER BY level, name`
        : `WITH RECURSIVE group_tree AS (
            SELECT *, 0 as level
            FROM user_groups
            WHERE parent_group_id IS NULL
            
            UNION ALL
            
            SELECT g.*, gt.level + 1
            FROM user_groups g
            JOIN group_tree gt ON g.parent_group_id = gt.id
          )
          SELECT * FROM group_tree ORDER BY level, name`;

      const params = groupId ? [groupId] : [];
      const result = await query(query_text, params);

      return {
        success: true,
        data: this.buildHierarchyTree(result.rows)
      };
    } catch (error: any) {
      console.error('Error fetching group hierarchy:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch group hierarchy'
      };
    }
  }

  /**
   * Build hierarchy tree from flat list
   */
  private buildHierarchyTree(groups: any[]): any[] {
    const map = new Map();
    const roots: any[] = [];

    // Create map of all groups
    groups.forEach(group => {
      map.set(group.id, { ...group, children: [] });
    });

    // Build tree structure
    groups.forEach(group => {
      if (group.parent_group_id) {
        const parent = map.get(group.parent_group_id);
        if (parent) {
          parent.children.push(map.get(group.id));
        }
      } else {
        roots.push(map.get(group.id));
      }
    });

    return roots;
  }

  /**
   * Get group by ID
   */
  async getGroupById(groupId: string): Promise<ServiceResponse<UserGroup>> {
    try {
      const result = await query(
        'SELECT * FROM user_groups WHERE id = $1',
        [groupId]
      );

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Group not found'
        };
      }

      return {
        success: true,
        data: result.rows[0]
      };
    } catch (error: any) {
      console.error('Error fetching group by ID:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch group'
      };
    }
  }

  /**
   * Search users available for assignment to group
   */
  async searchUsersForAssignment(
    groupId: string,
    searchTerm?: string,
    department?: string,
    limit: number = 20
  ): Promise<ServiceResponse<any[]>> {
    try {
      let whereConditions: string[] = ['u.deleted_at IS NULL'];
      let params: any[] = [groupId];
      let paramCount = 2;

      // Exclude users already in the group
      whereConditions.push(`u.id NOT IN (
        SELECT ugm.user_id 
        FROM user_group_members ugm 
        WHERE ugm.group_id = $1
      )`);

      // Add search term filter
      if (searchTerm) {
        whereConditions.push(`(
          u.full_name ILIKE $${paramCount} OR 
          u.email ILIKE $${paramCount}
        )`);
        params.push(`%${searchTerm}%`);
        paramCount++;
      }

      // Add department filter
      if (department) {
        whereConditions.push(`u.department = $${paramCount}`);
        params.push(department);
        paramCount++;
      }

      const whereClause = whereConditions.join(' AND ');

      const result = await query(
        `SELECT u.id, u.email, u.full_name, u.department, u.position, u.is_approved, u.is_blocked
         FROM users u
         WHERE ${whereClause}
         ORDER BY u.full_name ASC, u.email ASC
         LIMIT $${paramCount}`,
        [...params, limit]
      );

      return {
        success: true,
        data: result.rows
      };
    } catch (error: any) {
      console.error('Error searching users for assignment:', error);
      return {
        success: false,
        data: [],
        error: error.message || 'Failed to search users for assignment'
      };
    }
  }

  /**
   * Get group statistics
   */
  async getGroupStatistics(): Promise<ServiceResponse<any>> {
    try {
      // Get total groups count
      const totalGroupsQuery = await query('SELECT COUNT(*) as count FROM user_groups');
      const totalGroups = parseInt(totalGroupsQuery.rows[0].count);

      // Get groups by type
      const groupsByTypeQuery = await query(`
        SELECT 
          group_type,
          COUNT(*) as count,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_count
        FROM user_groups 
        GROUP BY group_type
      `);

      // Get total members across all groups
      const totalMembersQuery = await query(`
        SELECT COUNT(DISTINCT ugm.user_id) as count
        FROM user_group_members ugm
        JOIN user_groups ug ON ugm.group_id = ug.id
      `);
      const totalMembers = parseInt(totalMembersQuery.rows[0].count);

      // Get active/inactive groups
      const statusQuery = await query(`
        SELECT 
          is_active,
          COUNT(*) as count
        FROM user_groups 
        GROUP BY is_active
      `);

      const groupsByType = groupsByTypeQuery.rows.reduce((acc: any, row: any) => {
        acc[row.group_type] = {
          total: parseInt(row.count),
          active: parseInt(row.active_count)
        };
        return acc;
      }, {});

      const groupsByStatus = statusQuery.rows.reduce((acc: any, row: any) => {
        acc[row.is_active ? 'active' : 'inactive'] = parseInt(row.count);
        return acc;
      }, { active: 0, inactive: 0 });

      return {
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
      };
    } catch (error: any) {
      console.error('Error fetching group statistics:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch group statistics'
      };
    }
  }
}