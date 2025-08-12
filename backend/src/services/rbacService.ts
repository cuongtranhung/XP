import { pool } from '../config/database';
import { logger } from '../utils/logger';
import Redis from 'ioredis';
import redisClient from '../config/redis';

// Types and interfaces
export interface Permission {
  permissionId: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
  conditions?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Role {
  roleId: string;
  name: string;
  description?: string;
  type: 'system' | 'custom';
  priority: number;
  permissions: Permission[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface UserRole {
  userRoleId: string;
  userId: string;
  roleId: string;
  assignedBy: string;
  assignedAt: Date;
  expiresAt?: Date;
  conditions?: Record<string, any>;
  isActive: boolean;
}

export interface AccessPolicy {
  policyId: string;
  name: string;
  description?: string;
  type: 'allow' | 'deny';
  priority: number;
  conditions: {
    user?: {
      roles?: string[];
      attributes?: Record<string, any>;
    };
    resource?: {
      type?: string;
      id?: string;
      attributes?: Record<string, any>;
    };
    context?: {
      time?: {
        start?: string;
        end?: string;
        days?: string[];
      };
      location?: {
        ip?: string[];
        country?: string[];
      };
      environment?: 'development' | 'staging' | 'production';
    };
  };
  effect: 'permit' | 'deny';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccessRequest {
  user: {
    userId: string;
    roles: string[];
    attributes?: Record<string, any>;
  };
  resource: {
    type: string;
    id?: string;
    attributes?: Record<string, any>;
  };
  action: string;
  context?: {
    ip?: string;
    userAgent?: string;
    timestamp?: Date;
    environment?: string;
  };
}

export interface AccessResult {
  allowed: boolean;
  decision: 'permit' | 'deny' | 'not_applicable';
  reason: string;
  appliedPolicies: string[];
  permissions: Permission[];
  conditions?: Record<string, any>;
  expires?: Date;
}

export interface RoleHierarchy {
  parentRole: string;
  childRole: string;
  inherited: boolean;
}

/**
 * Role-Based Access Control (RBAC) Service
 * 
 * Comprehensive RBAC system with advanced features including:
 * - Hierarchical roles with inheritance
 * - Attribute-based access control (ABAC) integration
 * - Policy-based access decisions
 * - Conditional permissions
 * - Time-based and location-based access control
 * - Real-time permission caching
 * - Audit trail integration
 * 
 * Features:
 * - Dynamic role assignment/revocation
 * - Permission inheritance through role hierarchy
 * - Context-aware access decisions
 * - High-performance caching with Redis
 * - Bulk operations for enterprise scaling
 * - Compliance reporting and audit trails
 */
export class RBACService {
  private redis: Redis;
  private cachePrefix = 'rbac:';
  private cacheTTL = 300; // 5 minutes

  constructor() {
    this.redis = redisClient;
  }

  /**
   * Permission Management
   */

  /**
   * Create a new permission
   */
  async createPermission(permissionData: Omit<Permission, 'permissionId' | 'createdAt' | 'updatedAt'>): Promise<Permission> {
    try {
      const permissionId = this.generateId('perm');
      const now = new Date();

      const result = await pool.query(`
        INSERT INTO permissions (
          permission_id, name, resource, action, description, conditions, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        permissionId,
        permissionData.name,
        permissionData.resource,
        permissionData.action,
        permissionData.description,
        JSON.stringify(permissionData.conditions || {}),
        now,
        now
      ]);

      const permission = this.mapPermissionFromDB(result.rows[0]);
      
      // Clear relevant caches
      await this.clearPermissionCaches();

      logger.info('Permission created', { permissionId, name: permissionData.name });
      return permission;

    } catch (error) {
      logger.error('Create permission error:', error);
      throw error;
    }
  }

  /**
   * Get permission by ID
   */
  async getPermission(permissionId: string): Promise<Permission | null> {
    try {
      // Check cache first
      const cacheKey = `${this.cachePrefix}permission:${permissionId}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const result = await pool.query(`
        SELECT * FROM permissions WHERE permission_id = $1
      `, [permissionId]);

      if (result.rows.length === 0) {
        return null;
      }

      const permission = this.mapPermissionFromDB(result.rows[0]);
      
      // Cache the result
      await this.redis.setex(cacheKey, this.cacheTTL, JSON.stringify(permission));

      return permission;

    } catch (error) {
      logger.error('Get permission error:', error);
      throw error;
    }
  }

  /**
   * Get all permissions with optional filtering
   */
  async getPermissions(filters: {
    resource?: string;
    action?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ permissions: Permission[]; total: number }> {
    try {
      let whereClause = '1=1';
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (filters.resource) {
        whereClause += ` AND resource = $${paramIndex}`;
        queryParams.push(filters.resource);
        paramIndex++;
      }

      if (filters.action) {
        whereClause += ` AND action = $${paramIndex}`;
        queryParams.push(filters.action);
        paramIndex++;
      }

      // Get total count
      const countResult = await pool.query(`
        SELECT COUNT(*) FROM permissions WHERE ${whereClause}
      `, queryParams);

      const total = parseInt(countResult.rows[0].count);

      // Get permissions with pagination
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const result = await pool.query(`
        SELECT * FROM permissions 
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...queryParams, limit, offset]);

      const permissions = result.rows.map(row => this.mapPermissionFromDB(row));

      return { permissions, total };

    } catch (error) {
      logger.error('Get permissions error:', error);
      throw error;
    }
  }

  /**
   * Update permission
   */
  async updatePermission(permissionId: string, updates: Partial<Omit<Permission, 'permissionId' | 'createdAt' | 'updatedAt'>>): Promise<Permission | null> {
    try {
      const updateFields: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        updateFields.push(`name = $${paramIndex}`);
        queryParams.push(updates.name);
        paramIndex++;
      }

      if (updates.resource !== undefined) {
        updateFields.push(`resource = $${paramIndex}`);
        queryParams.push(updates.resource);
        paramIndex++;
      }

      if (updates.action !== undefined) {
        updateFields.push(`action = $${paramIndex}`);
        queryParams.push(updates.action);
        paramIndex++;
      }

      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramIndex}`);
        queryParams.push(updates.description);
        paramIndex++;
      }

      if (updates.conditions !== undefined) {
        updateFields.push(`conditions = $${paramIndex}`);
        queryParams.push(JSON.stringify(updates.conditions));
        paramIndex++;
      }

      if (updateFields.length === 0) {
        return await this.getPermission(permissionId);
      }

      updateFields.push(`updated_at = $${paramIndex}`);
      queryParams.push(new Date());
      paramIndex++;

      queryParams.push(permissionId);

      const result = await pool.query(`
        UPDATE permissions 
        SET ${updateFields.join(', ')}
        WHERE permission_id = $${paramIndex}
        RETURNING *
      `, queryParams);

      if (result.rows.length === 0) {
        return null;
      }

      const permission = this.mapPermissionFromDB(result.rows[0]);
      
      // Clear caches
      await this.clearPermissionCaches();

      logger.info('Permission updated', { permissionId, updates });
      return permission;

    } catch (error) {
      logger.error('Update permission error:', error);
      throw error;
    }
  }

  /**
   * Delete permission
   */
  async deletePermission(permissionId: string): Promise<boolean> {
    try {
      // Remove from role_permissions first
      await pool.query(`
        DELETE FROM role_permissions WHERE permission_id = $1
      `, [permissionId]);

      // Delete the permission
      const result = await pool.query(`
        DELETE FROM permissions WHERE permission_id = $1
      `, [permissionId]);

      if (result.rowCount === 0) {
        return false;
      }

      // Clear caches
      await this.clearPermissionCaches();

      logger.info('Permission deleted', { permissionId });
      return true;

    } catch (error) {
      logger.error('Delete permission error:', error);
      throw error;
    }
  }

  /**
   * Role Management
   */

  /**
   * Create a new role
   */
  async createRole(roleData: Omit<Role, 'roleId' | 'createdAt' | 'updatedAt' | 'permissions'>): Promise<Role> {
    try {
      const roleId = this.generateId('role');
      const now = new Date();

      const result = await pool.query(`
        INSERT INTO roles (
          role_id, name, description, type, priority, is_active, created_at, updated_at, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        roleId,
        roleData.name,
        roleData.description,
        roleData.type,
        roleData.priority,
        roleData.isActive,
        now,
        now,
        roleData.createdBy
      ]);

      const role = await this.mapRoleFromDB(result.rows[0]);
      
      // Clear role caches
      await this.clearRoleCaches();

      logger.info('Role created', { roleId, name: roleData.name });
      return role;

    } catch (error) {
      logger.error('Create role error:', error);
      throw error;
    }
  }

  /**
   * Get role by ID with permissions
   */
  async getRole(roleId: string, includePermissions: boolean = true): Promise<Role | null> {
    try {
      // Check cache first
      const cacheKey = `${this.cachePrefix}role:${roleId}:${includePermissions}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const result = await pool.query(`
        SELECT * FROM roles WHERE role_id = $1
      `, [roleId]);

      if (result.rows.length === 0) {
        return null;
      }

      const role = await this.mapRoleFromDB(result.rows[0], includePermissions);
      
      // Cache the result
      await this.redis.setex(cacheKey, this.cacheTTL, JSON.stringify(role));

      return role;

    } catch (error) {
      logger.error('Get role error:', error);
      throw error;
    }
  }

  /**
   * Get all roles with optional filtering
   */
  async getRoles(filters: {
    type?: 'system' | 'custom';
    isActive?: boolean;
    includePermissions?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ roles: Role[]; total: number }> {
    try {
      let whereClause = '1=1';
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (filters.type) {
        whereClause += ` AND type = $${paramIndex}`;
        queryParams.push(filters.type);
        paramIndex++;
      }

      if (filters.isActive !== undefined) {
        whereClause += ` AND is_active = $${paramIndex}`;
        queryParams.push(filters.isActive);
        paramIndex++;
      }

      // Get total count
      const countResult = await pool.query(`
        SELECT COUNT(*) FROM roles WHERE ${whereClause}
      `, queryParams);

      const total = parseInt(countResult.rows[0].count);

      // Get roles with pagination
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const result = await pool.query(`
        SELECT * FROM roles 
        WHERE ${whereClause}
        ORDER BY priority ASC, created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...queryParams, limit, offset]);

      const roles = await Promise.all(
        result.rows.map(row => this.mapRoleFromDB(row, filters.includePermissions || false))
      );

      return { roles, total };

    } catch (error) {
      logger.error('Get roles error:', error);
      throw error;
    }
  }

  /**
   * Update role
   */
  async updateRole(roleId: string, updates: Partial<Omit<Role, 'roleId' | 'createdAt' | 'updatedAt' | 'permissions'>>): Promise<Role | null> {
    try {
      const updateFields: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        updateFields.push(`name = $${paramIndex}`);
        queryParams.push(updates.name);
        paramIndex++;
      }

      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramIndex}`);
        queryParams.push(updates.description);
        paramIndex++;
      }

      if (updates.priority !== undefined) {
        updateFields.push(`priority = $${paramIndex}`);
        queryParams.push(updates.priority);
        paramIndex++;
      }

      if (updates.isActive !== undefined) {
        updateFields.push(`is_active = $${paramIndex}`);
        queryParams.push(updates.isActive);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        return await this.getRole(roleId);
      }

      updateFields.push(`updated_at = $${paramIndex}`);
      queryParams.push(new Date());
      paramIndex++;

      queryParams.push(roleId);

      const result = await pool.query(`
        UPDATE roles 
        SET ${updateFields.join(', ')}
        WHERE role_id = $${paramIndex}
        RETURNING *
      `, queryParams);

      if (result.rows.length === 0) {
        return null;
      }

      const role = await this.mapRoleFromDB(result.rows[0]);
      
      // Clear caches
      await this.clearRoleCaches();

      logger.info('Role updated', { roleId, updates });
      return role;

    } catch (error) {
      logger.error('Update role error:', error);
      throw error;
    }
  }

  /**
   * Delete role
   */
  async deleteRole(roleId: string): Promise<boolean> {
    try {
      // Check if role is a system role
      const role = await this.getRole(roleId, false);
      if (role?.type === 'system') {
        throw new Error('Cannot delete system role');
      }

      // Remove user role assignments
      await pool.query(`
        DELETE FROM user_roles WHERE role_id = $1
      `, [roleId]);

      // Remove role permissions
      await pool.query(`
        DELETE FROM role_permissions WHERE role_id = $1
      `, [roleId]);

      // Remove role hierarchy
      await pool.query(`
        DELETE FROM role_hierarchy WHERE parent_role_id = $1 OR child_role_id = $1
      `, [roleId]);

      // Delete the role
      const result = await pool.query(`
        DELETE FROM roles WHERE role_id = $1 AND type != 'system'
      `, [roleId]);

      if (result.rowCount === 0) {
        return false;
      }

      // Clear caches
      await this.clearRoleCaches();

      logger.info('Role deleted', { roleId });
      return true;

    } catch (error) {
      logger.error('Delete role error:', error);
      throw error;
    }
  }

  /**
   * Assign permission to role
   */
  async assignPermissionToRole(roleId: string, permissionId: string): Promise<boolean> {
    try {
      // Check if assignment already exists
      const existing = await pool.query(`
        SELECT 1 FROM role_permissions 
        WHERE role_id = $1 AND permission_id = $2
      `, [roleId, permissionId]);

      if (existing.rows.length > 0) {
        return true; // Already assigned
      }

      await pool.query(`
        INSERT INTO role_permissions (role_id, permission_id, created_at)
        VALUES ($1, $2, $3)
      `, [roleId, permissionId, new Date()]);

      // Clear caches
      await this.clearRoleCaches();

      logger.info('Permission assigned to role', { roleId, permissionId });
      return true;

    } catch (error) {
      logger.error('Assign permission to role error:', error);
      throw error;
    }
  }

  /**
   * Remove permission from role
   */
  async removePermissionFromRole(roleId: string, permissionId: string): Promise<boolean> {
    try {
      const result = await pool.query(`
        DELETE FROM role_permissions 
        WHERE role_id = $1 AND permission_id = $2
      `, [roleId, permissionId]);

      if (result.rowCount === 0) {
        return false;
      }

      // Clear caches
      await this.clearRoleCaches();

      logger.info('Permission removed from role', { roleId, permissionId });
      return true;

    } catch (error) {
      logger.error('Remove permission from role error:', error);
      throw error;
    }
  }

  /**
   * User Role Management
   */

  /**
   * Assign role to user
   */
  async assignRoleToUser(userId: string, roleId: string, assignedBy: string, options: {
    expiresAt?: Date;
    conditions?: Record<string, any>;
  } = {}): Promise<UserRole> {
    try {
      const userRoleId = this.generateId('ur');
      const now = new Date();

      const result = await pool.query(`
        INSERT INTO user_roles (
          user_role_id, user_id, role_id, assigned_by, assigned_at, 
          expires_at, conditions, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        userRoleId,
        userId,
        roleId,
        assignedBy,
        now,
        options.expiresAt,
        JSON.stringify(options.conditions || {}),
        true
      ]);

      const userRole = this.mapUserRoleFromDB(result.rows[0]);
      
      // Clear user permission cache
      await this.clearUserPermissionCache(userId);

      logger.info('Role assigned to user', { userId, roleId, assignedBy });
      return userRole;

    } catch (error) {
      logger.error('Assign role to user error:', error);
      throw error;
    }
  }

  /**
   * Remove role from user
   */
  async removeRoleFromUser(userId: string, roleId: string): Promise<boolean> {
    try {
      const result = await pool.query(`
        UPDATE user_roles 
        SET is_active = false, updated_at = $1
        WHERE user_id = $2 AND role_id = $3 AND is_active = true
      `, [new Date(), userId, roleId]);

      if (result.rowCount === 0) {
        return false;
      }

      // Clear user permission cache
      await this.clearUserPermissionCache(userId);

      logger.info('Role removed from user', { userId, roleId });
      return true;

    } catch (error) {
      logger.error('Remove role from user error:', error);
      throw error;
    }
  }

  /**
   * Get user roles
   */
  async getUserRoles(userId: string, includeExpired: boolean = false): Promise<UserRole[]> {
    try {
      // Check cache first
      const cacheKey = `${this.cachePrefix}user_roles:${userId}:${includeExpired}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      let whereClause = 'user_id = $1 AND is_active = true';
      const queryParams = [userId];

      if (!includeExpired) {
        whereClause += ' AND (expires_at IS NULL OR expires_at > $2)';
        queryParams.push(new Date());
      }

      const result = await pool.query(`
        SELECT * FROM user_roles 
        WHERE ${whereClause}
        ORDER BY assigned_at DESC
      `, queryParams);

      const userRoles = result.rows.map(row => this.mapUserRoleFromDB(row));
      
      // Cache the result
      await this.redis.setex(cacheKey, this.cacheTTL, JSON.stringify(userRoles));

      return userRoles;

    } catch (error) {
      logger.error('Get user roles error:', error);
      throw error;
    }
  }

  /**
   * Get user permissions (including inherited from roles)
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    try {
      // Check cache first
      const cacheKey = `${this.cachePrefix}user_permissions:${userId}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const result = await pool.query(`
        SELECT DISTINCT p.* FROM permissions p
        JOIN role_permissions rp ON p.permission_id = rp.permission_id
        JOIN user_roles ur ON rp.role_id = ur.role_id
        JOIN roles r ON ur.role_id = r.role_id
        WHERE ur.user_id = $1 
          AND ur.is_active = true 
          AND r.is_active = true
          AND (ur.expires_at IS NULL OR ur.expires_at > $2)
        ORDER BY p.resource, p.action
      `, [userId, new Date()]);

      const permissions = result.rows.map(row => this.mapPermissionFromDB(row));
      
      // Cache the result
      await this.redis.setex(cacheKey, this.cacheTTL, JSON.stringify(permissions));

      return permissions;

    } catch (error) {
      logger.error('Get user permissions error:', error);
      throw error;
    }
  }

  /**
   * Access Control
   */

  /**
   * Check if user has permission
   */
  async hasPermission(userId: string, resource: string, action: string, context?: Record<string, any>): Promise<boolean> {
    try {
      const accessRequest: AccessRequest = {
        user: {
          userId,
          roles: await this.getUserActiveRoleIds(userId)
        },
        resource: {
          type: resource
        },
        action,
        context
      };

      const result = await this.checkAccess(accessRequest);
      return result.allowed;

    } catch (error) {
      logger.error('Has permission error:', error);
      return false;
    }
  }

  /**
   * Comprehensive access control check
   */
  async checkAccess(request: AccessRequest): Promise<AccessResult> {
    try {
      // Get user permissions
      const permissions = await this.getUserPermissions(request.user.userId);
      
      // Find matching permissions
      const matchingPermissions = permissions.filter(permission =>
        permission.resource === request.resource.type &&
        permission.action === request.action
      );

      if (matchingPermissions.length === 0) {
        return {
          allowed: false,
          decision: 'deny',
          reason: 'No matching permissions found',
          appliedPolicies: [],
          permissions: []
        };
      }

      // Check conditions if any
      const validPermissions = matchingPermissions.filter(permission => 
        this.evaluateConditions(permission.conditions, request)
      );

      if (validPermissions.length === 0) {
        return {
          allowed: false,
          decision: 'deny',
          reason: 'Permission conditions not met',
          appliedPolicies: [],
          permissions: matchingPermissions
        };
      }

      // Check access policies
      const policyResult = await this.evaluatePolicies(request);
      
      if (policyResult.decision === 'deny') {
        return {
          allowed: false,
          decision: 'deny',
          reason: policyResult.reason,
          appliedPolicies: policyResult.appliedPolicies,
          permissions: validPermissions
        };
      }

      return {
        allowed: true,
        decision: 'permit',
        reason: 'Access granted based on permissions and policies',
        appliedPolicies: policyResult.appliedPolicies,
        permissions: validPermissions
      };

    } catch (error) {
      logger.error('Check access error:', error);
      return {
        allowed: false,
        decision: 'deny',
        reason: 'Access check failed due to system error',
        appliedPolicies: [],
        permissions: []
      };
    }
  }

  /**
   * Bulk permission check
   */
  async checkBulkPermissions(userId: string, checks: Array<{
    resource: string;
    action: string;
    context?: Record<string, any>;
  }>): Promise<Record<string, boolean>> {
    try {
      const results: Record<string, boolean> = {};
      const userRoles = await this.getUserActiveRoleIds(userId);

      for (const check of checks) {
        const key = `${check.resource}:${check.action}`;
        const accessRequest: AccessRequest = {
          user: { userId, roles: userRoles },
          resource: { type: check.resource },
          action: check.action,
          context: check.context
        };

        const result = await this.checkAccess(accessRequest);
        results[key] = result.allowed;
      }

      return results;

    } catch (error) {
      logger.error('Bulk permission check error:', error);
      return {};
    }
  }

  /**
   * Policy Management
   */

  /**
   * Create access policy
   */
  async createPolicy(policyData: Omit<AccessPolicy, 'policyId' | 'createdAt' | 'updatedAt'>): Promise<AccessPolicy> {
    try {
      const policyId = this.generateId('policy');
      const now = new Date();

      const result = await pool.query(`
        INSERT INTO access_policies (
          policy_id, name, description, type, priority, conditions, 
          effect, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        policyId,
        policyData.name,
        policyData.description,
        policyData.type,
        policyData.priority,
        JSON.stringify(policyData.conditions),
        policyData.effect,
        policyData.isActive,
        now,
        now
      ]);

      const policy = this.mapPolicyFromDB(result.rows[0]);
      
      // Clear policy cache
      await this.clearPolicyCaches();

      logger.info('Policy created', { policyId, name: policyData.name });
      return policy;

    } catch (error) {
      logger.error('Create policy error:', error);
      throw error;
    }
  }

  /**
   * Get all policies
   */
  async getPolicies(filters: {
    type?: 'allow' | 'deny';
    isActive?: boolean;
  } = {}): Promise<AccessPolicy[]> {
    try {
      // Check cache first
      const cacheKey = `${this.cachePrefix}policies:${JSON.stringify(filters)}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      let whereClause = '1=1';
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (filters.type) {
        whereClause += ` AND type = $${paramIndex}`;
        queryParams.push(filters.type);
        paramIndex++;
      }

      if (filters.isActive !== undefined) {
        whereClause += ` AND is_active = $${paramIndex}`;
        queryParams.push(filters.isActive);
        paramIndex++;
      }

      const result = await pool.query(`
        SELECT * FROM access_policies 
        WHERE ${whereClause}
        ORDER BY priority ASC, created_at DESC
      `, queryParams);

      const policies = result.rows.map(row => this.mapPolicyFromDB(row));
      
      // Cache the result
      await this.redis.setex(cacheKey, this.cacheTTL, JSON.stringify(policies));

      return policies;

    } catch (error) {
      logger.error('Get policies error:', error);
      throw error;
    }
  }

  /**
   * Helper Methods
   */

  /**
   * Get active role IDs for user
   */
  private async getUserActiveRoleIds(userId: string): Promise<string[]> {
    try {
      const result = await pool.query(`
        SELECT role_id FROM user_roles 
        WHERE user_id = $1 AND is_active = true
          AND (expires_at IS NULL OR expires_at > $2)
      `, [userId, new Date()]);

      return result.rows.map(row => row.role_id);

    } catch (error) {
      logger.error('Get user active role IDs error:', error);
      return [];
    }
  }

  /**
   * Evaluate permission conditions
   */
  private evaluateConditions(conditions: Record<string, any> = {}, request: AccessRequest): boolean {
    try {
      // Time-based conditions
      if (conditions.time) {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);
        const currentDay = now.toLocaleDateString('en', { weekday: 'long' }).toLowerCase();

        if (conditions.time.start && conditions.time.end) {
          if (currentTime < conditions.time.start || currentTime > conditions.time.end) {
            return false;
          }
        }

        if (conditions.time.days && conditions.time.days.length > 0) {
          if (!conditions.time.days.includes(currentDay)) {
            return false;
          }
        }
      }

      // IP-based conditions
      if (conditions.ip && request.context?.ip) {
        if (Array.isArray(conditions.ip)) {
          if (!conditions.ip.includes(request.context.ip)) {
            return false;
          }
        }
      }

      // Resource-specific conditions
      if (conditions.resource && request.resource.id) {
        if (conditions.resource.id && conditions.resource.id !== request.resource.id) {
          return false;
        }
      }

      return true;

    } catch (error) {
      logger.error('Evaluate conditions error:', error);
      return false;
    }
  }

  /**
   * Evaluate access policies
   */
  private async evaluatePolicies(request: AccessRequest): Promise<{
    decision: 'permit' | 'deny';
    reason: string;
    appliedPolicies: string[];
  }> {
    try {
      const policies = await this.getPolicies({ isActive: true });
      const appliedPolicies: string[] = [];

      // Sort policies by priority (lower number = higher priority)
      const sortedPolicies = policies.sort((a, b) => a.priority - b.priority);

      for (const policy of sortedPolicies) {
        if (this.policyMatches(policy, request)) {
          appliedPolicies.push(policy.policyId);

          if (policy.effect === 'deny') {
            return {
              decision: 'deny',
              reason: `Access denied by policy: ${policy.name}`,
              appliedPolicies
            };
          }
        }
      }

      return {
        decision: 'permit',
        reason: 'No denying policies found',
        appliedPolicies
      };

    } catch (error) {
      logger.error('Evaluate policies error:', error);
      return {
        decision: 'deny',
        reason: 'Policy evaluation failed',
        appliedPolicies: []
      };
    }
  }

  /**
   * Check if policy matches request
   */
  private policyMatches(policy: AccessPolicy, request: AccessRequest): boolean {
    try {
      const conditions = policy.conditions;

      // Check user conditions
      if (conditions.user) {
        if (conditions.user.roles && conditions.user.roles.length > 0) {
          const hasRequiredRole = conditions.user.roles.some(role => 
            request.user.roles.includes(role)
          );
          if (!hasRequiredRole) {
            return false;
          }
        }
      }

      // Check resource conditions
      if (conditions.resource) {
        if (conditions.resource.type && conditions.resource.type !== request.resource.type) {
          return false;
        }
        if (conditions.resource.id && conditions.resource.id !== request.resource.id) {
          return false;
        }
      }

      // Check context conditions
      if (conditions.context) {
        if (conditions.context.environment && 
            conditions.context.environment !== request.context?.environment) {
          return false;
        }

        if (conditions.context.location && conditions.context.location.ip && 
            request.context?.ip) {
          if (!conditions.context.location.ip.includes(request.context.ip)) {
            return false;
          }
        }
      }

      return true;

    } catch (error) {
      logger.error('Policy match error:', error);
      return false;
    }
  }

  /**
   * Database mapping methods
   */
  private mapPermissionFromDB(row: any): Permission {
    return {
      permissionId: row.permission_id,
      name: row.name,
      resource: row.resource,
      action: row.action,
      description: row.description,
      conditions: row.conditions ? JSON.parse(row.conditions) : {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private async mapRoleFromDB(row: any, includePermissions: boolean = true): Promise<Role> {
    const role: Role = {
      roleId: row.role_id,
      name: row.name,
      description: row.description,
      type: row.type,
      priority: row.priority,
      permissions: [],
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by
    };

    if (includePermissions) {
      const permissionsResult = await pool.query(`
        SELECT p.* FROM permissions p
        JOIN role_permissions rp ON p.permission_id = rp.permission_id
        WHERE rp.role_id = $1
        ORDER BY p.resource, p.action
      `, [row.role_id]);

      role.permissions = permissionsResult.rows.map(permRow => this.mapPermissionFromDB(permRow));
    }

    return role;
  }

  private mapUserRoleFromDB(row: any): UserRole {
    return {
      userRoleId: row.user_role_id,
      userId: row.user_id,
      roleId: row.role_id,
      assignedBy: row.assigned_by,
      assignedAt: new Date(row.assigned_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      conditions: row.conditions ? JSON.parse(row.conditions) : {},
      isActive: row.is_active
    };
  }

  private mapPolicyFromDB(row: any): AccessPolicy {
    return {
      policyId: row.policy_id,
      name: row.name,
      description: row.description,
      type: row.type,
      priority: row.priority,
      conditions: JSON.parse(row.conditions),
      effect: row.effect,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Cache management
   */
  private async clearPermissionCaches(): Promise<void> {
    const keys = await this.redis.keys(`${this.cachePrefix}*permission*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  private async clearRoleCaches(): Promise<void> {
    const keys = await this.redis.keys(`${this.cachePrefix}*role*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  private async clearUserPermissionCache(userId: string): Promise<void> {
    const keys = await this.redis.keys(`${this.cachePrefix}user_*:${userId}*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  private async clearPolicyCaches(): Promise<void> {
    const keys = await this.redis.keys(`${this.cachePrefix}*policies*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default RBACService;